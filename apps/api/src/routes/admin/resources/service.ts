/**
 * 실전자료 관리 서비스 레이어 (Story 9.8).
 *
 * listResources, getResourceDetail, hideResource, deleteResource,
 * deleteResourceFile, listResourceReviews, hideReview, deleteReview
 *
 * 가드레일 UX-DR-A9: 응답에 "검수됨", "안전한 파일", "공식 인증" 필드 포함 금지.
 * resource_files 소프트딜리트: fileStatus='deleted' (resource_files.deleted_at 컬럼 없음).
 * 후기 숨김/삭제: comment_status enum이 visible|deleted 만 존재.
 *   hide/delete 모두 status='deleted' + deletedAt=now() 로 처리.
 *   가역적 숨김은 추후 'hidden' enum 추가 시 엔드포인트를 분기 예정.
 */

import { getDb } from "@ai-jakdang/database";
import { resources, resourceFiles, users } from "@ai-jakdang/database/schema";
import { comments } from "@ai-jakdang/database/schema";
import { eq, and, count, gte, lte, ilike, or, desc, sql } from "drizzle-orm";
import type { AdminResourcesQuery } from "@ai-jakdang/contracts/admin/resources";
import { tiptapJsonToHtml } from "../../../lib/tiptap-renderer.js";
import { sanitizeHtml } from "../../../lib/sanitize.js";

/**
 * 자료 본문(설명/사용법/주의사항 Tiptap JSON)을 렌더 가능한 HTML 로 변환한다.
 * - LightEditor 래퍼 `{ html: "..." }` 이면 새니타이즈만 적용.
 * - 표준 Tiptap JSON 이면 tiptapJsonToHtml(이미지·유튜브·코드블록 포함) 사용.
 * (웹 상세와 동일하게 서버에서 변환해 이미지/영상이 관리자에서도 보이도록 함)
 */
function renderContentHtml(contentJson: unknown): string {
  if (contentJson && typeof contentJson === "object") {
    const obj = contentJson as Record<string, unknown>;
    if (typeof obj.html === "string") return sanitizeHtml(obj.html);
  }
  return tiptapJsonToHtml(contentJson);
}

type AdminResourceWriteInput = {
  title: string;
  summary: string;
  resourceType: "prompt" | "claude-code-skill" | "mcp" | "rules-config" | "template-checklist";
  environment: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  descriptionJson: Record<string, unknown>;
  usageJson: Record<string, unknown>;
  status: "draft" | "published" | "hidden";
  version?: string | null;
};

function makeResourceSlug(title: string, resourceType: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) ||
    resourceType ||
    "resource";
  return `${base}-${Date.now()}`;
}

// ── 목록 조회 ─────────────────────────────────────────────────────────────────

export async function listResources(query: AdminResourcesQuery) {
  const db = getDb();
  const { type, status, hasReports, dateFrom, dateTo, q, page, pageSize } = query;

  const conditions = [];

  if (type) {
    conditions.push(eq(resources.resourceType, type));
  }
  if (status) {
    conditions.push(eq(resources.status, status));
  }
  if (dateFrom) {
    conditions.push(gte(resources.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(resources.createdAt, toDate));
  }
  if (q) {
    conditions.push(
      or(
        ilike(resources.title, `%${q}%`),
        ilike(resources.summary, `%${q}%`),
      ),
    );
  }
  if (hasReports === true) {
    conditions.push(
      sql`(SELECT COUNT(*) FROM reports WHERE target_type = 'resource' AND target_id = ${resources.id}) > 0`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(resources)
    .where(where);

  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: resources.id,
      slug: resources.slug,
      title: resources.title,
      summary: resources.summary,
      resourceType: resources.resourceType,
      difficulty: resources.difficulty,
      status: resources.status,
      userId: resources.userId,
      authorNickname: users.nickname,
      downloadCount: resources.downloadCount,
      viewCount: resources.viewCount,
      avgRating: resources.avgRating,
      ratingCount: resources.ratingCount,
      createdAt: resources.createdAt,
      updatedAt: resources.updatedAt,
      deletedAt: resources.deletedAt,
      reportCount: sql<number>`(SELECT COUNT(*)::int FROM reports WHERE target_type = 'resource' AND target_id = ${resources.id})`,
      reviewCount: sql<number>`(SELECT COUNT(*)::int FROM comments WHERE target_type = 'resource' AND target_id = ${resources.id} AND status = 'visible')`,
    })
    .from(resources)
    .leftJoin(users, eq(resources.userId, users.id))
    .where(where)
    .orderBy(desc(resources.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items = rows.map((r) => ({
    ...r,
    avgRating: String(r.avgRating),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
  }));

  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems: Number(totalItems),
      totalPages: Math.ceil(Number(totalItems) / pageSize),
    },
  };
}

// ── 등록/수정 ─────────────────────────────────────────────────────────────────

export async function createAdminResource(input: AdminResourceWriteInput) {
  const db = getDb();
  const slug = makeResourceSlug(input.title, input.resourceType);

  const [created] = await db
    .insert(resources)
    .values({
      userId: null,
      slug,
      title: input.title,
      summary: input.summary,
      resourceType: input.resourceType,
      environment: input.environment,
      difficulty: input.difficulty,
      descriptionJson: input.descriptionJson,
      usageJson: input.usageJson,
      cautionJson: null,
      version: input.version ?? null,
      referenceLinks: null,
      copyrightAgreed: true,
      status: input.status,
    })
    .returning({ id: resources.id, slug: resources.slug, status: resources.status });

  if (!created) {
    throw new Error("실전자료 INSERT 실패");
  }

  return created;
}

export async function updateAdminResource(id: string, input: Partial<AdminResourceWriteInput>) {
  const db = getDb();

  const [target] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);
  if (!target) {
    throw Object.assign(new Error("실전자료를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) updateSet.title = input.title;
  if (input.summary !== undefined) updateSet.summary = input.summary;
  if (input.resourceType !== undefined) updateSet.resourceType = input.resourceType;
  if (input.environment !== undefined) updateSet.environment = input.environment;
  if (input.difficulty !== undefined) updateSet.difficulty = input.difficulty;
  if (input.descriptionJson !== undefined) updateSet.descriptionJson = input.descriptionJson;
  if (input.usageJson !== undefined) updateSet.usageJson = input.usageJson;
  if (input.version !== undefined) updateSet.version = input.version;
  if (input.status !== undefined) {
    updateSet.status = input.status;
    updateSet.deletedAt = null;
  }

  const [updated] = await db
    .update(resources)
    .set(updateSet)
    .where(eq(resources.id, id))
    .returning({ id: resources.id, slug: resources.slug, status: resources.status, updatedAt: resources.updatedAt });

  return {
    id: updated.id,
    slug: updated.slug,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 상세 조회 (파일 목록 포함) ────────────────────────────────────────────────

export async function getResourceDetail(id: string) {
  const db = getDb();

  const [row] = await db
    .select({
      id: resources.id,
      slug: resources.slug,
      title: resources.title,
      summary: resources.summary,
      resourceType: resources.resourceType,
      difficulty: resources.difficulty,
      status: resources.status,
      userId: resources.userId,
      authorNickname: users.nickname,
      downloadCount: resources.downloadCount,
      viewCount: resources.viewCount,
      avgRating: resources.avgRating,
      ratingCount: resources.ratingCount,
      descriptionJson: resources.descriptionJson,
      usageJson: resources.usageJson,
      cautionJson: resources.cautionJson,
      environment: resources.environment,
      version: resources.version,
      referenceLinks: resources.referenceLinks,
      copyrightAgreed: resources.copyrightAgreed,
      createdAt: resources.createdAt,
      updatedAt: resources.updatedAt,
      deletedAt: resources.deletedAt,
      reportCount: sql<number>`(SELECT COUNT(*)::int FROM reports WHERE target_type = 'resource' AND target_id = ${resources.id})`,
      reviewCount: sql<number>`(SELECT COUNT(*)::int FROM comments WHERE target_type = 'resource' AND target_id = ${resources.id} AND status = 'visible')`,
    })
    .from(resources)
    .leftJoin(users, eq(resources.userId, users.id))
    .where(eq(resources.id, id))
    .limit(1);

  if (!row) {
    throw Object.assign(new Error("실전자료를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  // 첨부파일 목록 (active + deleted 모두 반환 — 관리자는 삭제된 것도 볼 수 있어야 함)
  const files = await db
    .select({
      id: resourceFiles.id,
      resourceId: resourceFiles.resourceId,
      originalName: resourceFiles.originalName,
      storageKey: resourceFiles.storageKey,
      fileSize: resourceFiles.fileSize,
      mimeType: resourceFiles.mimeType,
      allowedExtension: resourceFiles.allowedExtension,
      isPrimary: resourceFiles.isPrimary,
      displayOrder: resourceFiles.displayOrder,
      fileStatus: resourceFiles.fileStatus,
      createdAt: resourceFiles.createdAt,
    })
    .from(resourceFiles)
    .where(eq(resourceFiles.resourceId, id))
    .orderBy(resourceFiles.displayOrder);

  return {
    ...row,
    avgRating: String(row.avgRating),
    // 웹 상세와 동일하게 본문을 서버 렌더 HTML 로 내려 이미지·영상이 관리자에서도 보이게 함.
    descriptionHtml: renderContentHtml(row.descriptionJson),
    usageHtml: renderContentHtml(row.usageJson),
    cautionHtml: row.cautionJson ? renderContentHtml(row.cautionJson) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    files: files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    })),
  };
}

// ── 숨김 ──────────────────────────────────────────────────────────────────────

export async function hideResource(id: string) {
  const db = getDb();

  const [target] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);
  if (!target) {
    throw Object.assign(new Error("실전자료를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(resources)
    .set({ status: "hidden", updatedAt: now })
    .where(eq(resources.id, id))
    .returning({ id: resources.id, status: resources.status, updatedAt: resources.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 삭제 (soft-delete, super_admin 전용) ──────────────────────────────────────

export async function deleteResource(id: string) {
  const db = getDb();

  const [target] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);
  if (!target) {
    throw Object.assign(new Error("실전자료를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(resources)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(eq(resources.id, id))
    .returning({ id: resources.id, status: resources.status, updatedAt: resources.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 첨부파일 소프트딜리트 ─────────────────────────────────────────────────────
// resource_files에는 deleted_at 컬럼이 없고 fileStatus enum(active|deleted)만 있음.
// R2 실제 삭제는 9.10 cleanup worker에서 처리.
// UX-DR-A9: "안전성 보증/검수" 표시 없음.

export async function deleteResourceFile(resourceId: string, fileId: string) {
  const db = getDb();

  const [target] = await db
    .select({ id: resourceFiles.id, resourceId: resourceFiles.resourceId })
    .from(resourceFiles)
    .where(and(eq(resourceFiles.id, fileId), eq(resourceFiles.resourceId, resourceId)))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("첨부파일을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const [updated] = await db
    .update(resourceFiles)
    .set({ fileStatus: "deleted" })
    .where(eq(resourceFiles.id, fileId))
    .returning({ id: resourceFiles.id, fileStatus: resourceFiles.fileStatus });

  return {
    id: updated.id,
    fileStatus: updated.fileStatus,
  };
}

// ── 후기 목록 (comments WHERE target_type='resource') ─────────────────────────

export async function listResourceReviews(
  resourceId: string,
  page: number,
  pageSize: number,
) {
  const db = getDb();

  const where = and(
    eq(comments.targetType, "resource"),
    eq(comments.targetId, resourceId),
  );

  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(comments)
    .where(where);

  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      authorNickname: users.nickname,
      targetId: comments.targetId,
      parentId: comments.parentId,
      content: comments.content,
      status: comments.status,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      deletedAt: comments.deletedAt,
      reportCount: sql<number>`(SELECT COUNT(*)::int FROM reports WHERE target_type = 'comment' AND target_id = ${comments.id})`,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(where)
    .orderBy(comments.createdAt)
    .limit(pageSize)
    .offset(offset);

  const items = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
  }));

  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems: Number(totalItems),
      totalPages: Math.ceil(Number(totalItems) / pageSize),
    },
  };
}

// ── 후기 숨김 (PATCH .../reviews/:commentId/hide) ─────────────────────────────
// comment_status enum이 visible|deleted 만 존재하므로 숨김도 status='deleted'+deletedAt.
// 엔드포인트는 분리해 두어 추후 'hidden' enum 추가 시 동작만 교체 가능.

export async function hideReview(commentId: string) {
  const db = getDb();

  const [target] = await db
    .select({ id: comments.id, targetType: comments.targetType })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.targetType, "resource")))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("후기를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(comments)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(eq(comments.id, commentId))
    .returning({ id: comments.id, status: comments.status, updatedAt: comments.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 후기 삭제 (soft-delete, super_admin 전용) ─────────────────────────────────

export async function deleteReview(commentId: string) {
  const db = getDb();

  const [target] = await db
    .select({ id: comments.id, targetType: comments.targetType })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.targetType, "resource")))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("후기를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(comments)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(eq(comments.id, commentId))
    .returning({ id: comments.id, status: comments.status, updatedAt: comments.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

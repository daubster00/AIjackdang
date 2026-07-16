/**
 * 댓글·후기 통합 관리 서비스 레이어 (Story 9.9).
 *
 * listComments, hideComment, deleteComment, bulkCommentAction
 */

import { getDb } from "@ai-jakdang/database";
import { comments, users } from "@ai-jakdang/database/schema";
import { eq, and, inArray, count, gte, lte, ilike, isNotNull, isNull, desc, sql } from "drizzle-orm";
import type { AdminCommentsQuery } from "@ai-jakdang/contracts/admin/comments";

// ── 파생 유형 도출 ─────────────────────────────────────────────────────────────

type DerivedType = "일반댓글" | "대댓글" | "후기" | "Q&A답변";
type CommentTargetType = "post" | "question" | "answer" | "resource" | "comment";

function derivedType(targetType: CommentTargetType, parentId: string | null): DerivedType {
  if (parentId !== null) return "대댓글";
  if (targetType === "resource") return "후기";
  if (targetType === "question" || targetType === "answer") return "Q&A답변";
  return "일반댓글";
}

// ── 목록 조회 ─────────────────────────────────────────────────────────────────

export async function listComments(query: AdminCommentsQuery) {
  const db = getDb();
  const { type, status, hasReports, dateFrom, dateTo, q, page, pageSize } = query;

  const conditions = [];

  // 유형 필터 → targetType / parentId 조건으로 변환
  if (type === "일반댓글") {
    conditions.push(eq(comments.targetType, "post"));
    conditions.push(isNull(comments.parentId));
  } else if (type === "대댓글") {
    conditions.push(isNotNull(comments.parentId));
  } else if (type === "후기") {
    conditions.push(eq(comments.targetType, "resource"));
  } else if (type === "Q&A답변") {
    // question 또는 answer targetType
    conditions.push(
      sql`${comments.targetType} IN ('question', 'answer')`,
    );
  }

  if (status) {
    conditions.push(eq(comments.status, status));
  }

  if (hasReports === true) {
    conditions.push(
      sql`(SELECT COUNT(*) FROM reports WHERE target_type = 'comment' AND target_id = ${comments.id}) > 0`,
    );
  }

  if (dateFrom) {
    conditions.push(gte(comments.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(comments.createdAt, toDate));
  }

  if (q) {
    conditions.push(ilike(comments.content, `%${q}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // 총 개수
  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(comments)
    .where(where);

  const offset = (page - 1) * pageSize;

  // 목록 + 작성자 nickname join + 신고수 서브쿼리
  const rows = await db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      authorNickname: users.nickname,
      authorAvatarUrl: users.avatarUrl,
      authorImage: users.image,
      authorDefaultAvatarIndex: users.defaultAvatarIndex,
      targetType: comments.targetType,
      targetId: comments.targetId,
      // 게시글 댓글이면 상위 게시글의 board (상세페이지 링크 구성용)
      targetBoard: sql<string | null>`(SELECT board FROM posts WHERE id = ${comments.targetId})`,
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
    .orderBy(desc(comments.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items = rows.map((r) => ({
    id: r.id,
    authorId: r.authorId,
    authorNickname: r.authorNickname ?? null,
    authorAvatarUrl: r.authorAvatarUrl ?? null,
    authorImage: r.authorImage ?? null,
    authorDefaultAvatarIndex: r.authorDefaultAvatarIndex ?? null,
    targetType: r.targetType as CommentTargetType,
    targetId: r.targetId,
    targetBoard: r.targetBoard ?? null,
    parentId: r.parentId ?? null,
    contentPreview: r.content.slice(0, 100),
    derivedType: derivedType(r.targetType as CommentTargetType, r.parentId ?? null),
    status: r.status,
    reportCount: r.reportCount,
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

// ── 숨김 ──────────────────────────────────────────────────────────────────────

export async function hideComment(id: string) {
  const db = getDb();

  const [target] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("댓글을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(comments)
    .set({ status: "hidden", updatedAt: now })
    .where(eq(comments.id, id))
    .returning({ id: comments.id, status: comments.status, updatedAt: comments.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 삭제 (soft-delete, super_admin 전용) ──────────────────────────────────────

export async function deleteComment(id: string) {
  const db = getDb();

  const [target] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("댓글을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(comments)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(eq(comments.id, id))
    .returning({ id: comments.id, status: comments.status, updatedAt: comments.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 벌크 액션 ──────────────────────────────────────────────────────────────────

export async function bulkCommentAction(
  ids: string[],
  action: "hide" | "delete",
) {
  const db = getDb();
  const now = new Date();

  if (action === "hide") {
    await db
      .update(comments)
      .set({ status: "hidden", updatedAt: now })
      .where(inArray(comments.id, ids));
  } else if (action === "delete") {
    await db
      .update(comments)
      .set({ status: "deleted", deletedAt: now, updatedAt: now })
      .where(inArray(comments.id, ids));
  }

  return { affected: ids.length, action };
}

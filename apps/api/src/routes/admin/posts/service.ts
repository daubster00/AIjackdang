/**
 * 게시글 관리 서비스 레이어 (Story 9.6).
 *
 * listPosts, flagsPost, hidePost, restorePost, deletePost, seoPost, bulkPosts
 */

import { getDb } from "@ai-jakdang/database";
import { posts, users } from "@ai-jakdang/database/schema";
import { eq, and, inArray, count, gte, lte, ilike, or, sql } from "drizzle-orm";
import type { AdminPostsQuery } from "@ai-jakdang/contracts";

// ── 목록 조회 ─────────────────────────────────────────────────────────────────

export async function listPosts(query: AdminPostsQuery) {
  const db = getDb();
  const { board, status, isNotice, isPinned, isFeatured, isMainFeatured, hasReports, dateFrom, dateTo, q, page, pageSize } = query;

  const conditions = [];

  if (board) {
    conditions.push(eq(posts.board, board));
  }
  if (status) {
    conditions.push(eq(posts.status, status));
  }
  if (isNotice !== undefined) {
    conditions.push(eq(posts.isNotice, isNotice));
  }
  if (isPinned !== undefined) {
    conditions.push(eq(posts.isPinned, isPinned));
  }
  if (isFeatured !== undefined) {
    conditions.push(eq(posts.isFeatured, isFeatured));
  }
  if (isMainFeatured !== undefined) {
    conditions.push(eq(posts.isMainFeatured, isMainFeatured));
  }
  if (dateFrom) {
    conditions.push(gte(posts.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(posts.createdAt, toDate));
  }
  if (q) {
    conditions.push(
      or(
        ilike(posts.title, `%${q}%`),
        ilike(posts.searchVector, `%${q}%`),
      ),
    );
  }
  // hasReports=true → 신고가 1건 이상인 게시글만 반환 (서브쿼리)
  if (hasReports === true) {
    conditions.push(
      sql`(SELECT COUNT(*) FROM reports WHERE target_type = 'post' AND target_id = ${posts.id}) > 0`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // 총 개수
  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(posts)
    .where(where);

  const offset = (page - 1) * pageSize;

  // 목록 + 작성자 nickname join + 신고수 서브쿼리
  const rows = await db
    .select({
      id: posts.id,
      board: posts.board,
      category: posts.category,
      title: posts.title,
      slug: posts.slug,
      status: posts.status,
      userId: posts.userId,
      authorNickname: users.nickname,
      isNotice: posts.isNotice,
      isPinned: posts.isPinned,
      isFeatured: posts.isFeatured,
      isMainFeatured: posts.isMainFeatured,
      seoTitle: posts.seoTitle,
      seoDescription: posts.seoDescription,
      viewCount: posts.viewCount,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      deletedAt: posts.deletedAt,
      reportCount: sql<number>`(SELECT COUNT(*)::int FROM reports WHERE target_type = 'post' AND target_id = ${posts.id})`,
      commentCount: sql<number>`(SELECT COUNT(*)::int FROM comments WHERE target_type = 'post' AND target_id = ${posts.id} AND status = 'visible')`,
      likeCount: sql<number>`(SELECT COUNT(*)::int FROM reactions WHERE target_type = 'post' AND target_id = ${posts.id} AND reaction_type = 'like')`,
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(where)
    .orderBy(posts.createdAt)
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

// ── 플래그 토글 ────────────────────────────────────────────────────────────────

export async function updatePostFlags(
  id: string,
  flags: {
    isNotice?: boolean;
    isPinned?: boolean;
    isFeatured?: boolean;
    isMainFeatured?: boolean;
  },
) {
  const db = getDb();

  const [target] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("게시글을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const updateSet: Record<string, unknown> = { updatedAt: now };
  if (flags.isNotice !== undefined) updateSet.isNotice = flags.isNotice;
  if (flags.isPinned !== undefined) updateSet.isPinned = flags.isPinned;
  if (flags.isFeatured !== undefined) updateSet.isFeatured = flags.isFeatured;
  if (flags.isMainFeatured !== undefined) updateSet.isMainFeatured = flags.isMainFeatured;

  const [updated] = await db
    .update(posts)
    .set(updateSet)
    .where(eq(posts.id, id))
    .returning({ id: posts.id, status: posts.status, updatedAt: posts.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 숨김 ──────────────────────────────────────────────────────────────────────

export async function hidePost(id: string) {
  const db = getDb();

  const [target] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("게시글을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(posts)
    .set({ status: "hidden", updatedAt: now })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, status: posts.status, updatedAt: posts.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 복구 ──────────────────────────────────────────────────────────────────────

export async function restorePost(id: string) {
  const db = getDb();

  const [target] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("게시글을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(posts)
    .set({ status: "published", deletedAt: null, updatedAt: now })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, status: posts.status, updatedAt: posts.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 삭제 (soft-delete, super_admin 전용) ───────────────────────────────────────

export async function deletePost(id: string) {
  const db = getDb();

  const [target] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("게시글을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(posts)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(eq(posts.id, id))
    .returning({ id: posts.id, status: posts.status, updatedAt: posts.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── SEO 메타 ──────────────────────────────────────────────────────────────────

export async function updatePostSeo(
  id: string,
  seo: { seoTitle?: string | null; seoDescription?: string | null },
) {
  const db = getDb();

  const [target] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("게시글을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const updateSet: Record<string, unknown> = { updatedAt: now };
  if (seo.seoTitle !== undefined) updateSet.seoTitle = seo.seoTitle;
  if (seo.seoDescription !== undefined) updateSet.seoDescription = seo.seoDescription;

  const [updated] = await db
    .update(posts)
    .set(updateSet)
    .where(eq(posts.id, id))
    .returning({ id: posts.id, status: posts.status, updatedAt: posts.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 벌크 액션 ──────────────────────────────────────────────────────────────────

export async function bulkPostAction(
  ids: string[],
  action: "hide" | "delete",
) {
  const db = getDb();

  const now = new Date();

  if (action === "hide") {
    await db
      .update(posts)
      .set({ status: "hidden", updatedAt: now })
      .where(inArray(posts.id, ids));
  } else if (action === "delete") {
    await db
      .update(posts)
      .set({ status: "deleted", deletedAt: now, updatedAt: now })
      .where(inArray(posts.id, ids));
  }

  return { affected: ids.length, action };
}

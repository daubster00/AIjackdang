/**
 * 게시글 관리 서비스 레이어 (Story 9.6).
 *
 * listPosts, flagsPost, hidePost, restorePost, deletePost, seoPost, bulkPosts
 */

import { getDb } from "@ai-jakdang/database";
import { posts, users, tags as tagsTable, taggable } from "@ai-jakdang/database/schema";
import { eq, and, inArray, count, gte, lte, ilike, or, sql } from "drizzle-orm";
import type { AdminPostsQuery } from "@ai-jakdang/contracts";

function makeSlug(title: string): string {
  const baseSlug =
    title
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "post";
  return `${baseSlug}-${Date.now()}`;
}

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

// ── 상세 조회 ─────────────────────────────────────────────────────────────────

export async function getPostDetail(id: string) {
  const db = getDb();

  const [row] = await db
    .select({
      id: posts.id,
      board: posts.board,
      category: posts.category,
      title: posts.title,
      slug: posts.slug,
      contentJson: posts.contentJson,
      status: posts.status,
      userId: posts.userId,
      authorNickname: users.nickname,
      isNotice: posts.isNotice,
      isPinned: posts.isPinned,
      isFeatured: posts.isFeatured,
      isMainFeatured: posts.isMainFeatured,
      viewCount: posts.viewCount,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      deletedAt: posts.deletedAt,
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(eq(posts.id, id))
    .limit(1);

  if (!row) {
    throw Object.assign(new Error("게시글을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const tagRows = await db
    .select({ name: tagsTable.name })
    .from(taggable)
    .leftJoin(tagsTable, eq(taggable.tagId, tagsTable.id))
    .where(and(eq(taggable.targetType, "post"), eq(taggable.targetId, id)));

  return {
    ...row,
    tags: tagRows.map((tag) => tag.name).filter((name): name is string => Boolean(name)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

// ── 게시글 생성 (관리자 전용, Story 9.17) ─────────────────────────────────────

export async function createAdminPost(data: {
  title: string;
  contentJson: Record<string, unknown>;
  board?: string;
  category?: string | null;
  tags?: string[];
  status?: "draft" | "published";
  isNotice?: boolean;
  isPinned?: boolean;
  isFeatured?: boolean;
  isMainFeatured?: boolean;
}) {
  const db = getDb();

  const board = data.board?.trim() || "notice";
  const isNotice = data.isNotice ?? board === "notice";
  const slug = makeSlug(data.title);

  const postId = await db.transaction(async (tx) => {
    // posts INSERT (userId=null → 운영자 작성)
    const [inserted] = await tx
      .insert(posts)
      .values({
        userId: null,
        board,
        category: data.category ?? (isNotice ? "system" : null),
        title: data.title,
        slug,
        contentJson: data.contentJson,
        status: data.status ?? "published",
        isNotice,
        isPinned: data.isPinned ?? false,
        isFeatured: data.isFeatured ?? false,
        isMainFeatured: data.isMainFeatured ?? false,
      })
      .returning({ id: posts.id });

    const id = inserted.id;

    // 태그 처리
    if (data.tags && data.tags.length > 0) {
      const taggableValues: { targetType: string; targetId: string; tagId: string }[] = [];
      for (const tagName of data.tags) {
        const tagSlug = tagName.toLowerCase().replace(/\s+/g, "-");

        let [existing] = await tx
          .select({ id: tagsTable.id })
          .from(tagsTable)
          .where(eq(tagsTable.slug, tagSlug))
          .limit(1);

        if (!existing) {
          const ins = await tx
            .insert(tagsTable)
            .values({ name: tagName, slug: tagSlug })
            .onConflictDoNothing()
            .returning({ id: tagsTable.id });

          if (ins[0]) {
            existing = ins[0];
          } else {
            [existing] = await tx
              .select({ id: tagsTable.id })
              .from(tagsTable)
              .where(eq(tagsTable.slug, tagSlug))
              .limit(1);
          }
        }

        if (existing) {
          taggableValues.push({ targetType: "post", targetId: id, tagId: existing.id });
        }
      }

      if (taggableValues.length > 0) {
        await tx.insert(taggable).values(taggableValues).onConflictDoNothing();
      }
    }

    return id;
  });

  return { id: postId, slug, board, status: data.status ?? "published" };
}

// ── 내용 수정 (관리자 전용) ────────────────────────────────────────────────────

export async function updatePostContent(
  id: string,
  data: {
    title?: string;
    contentJson?: Record<string, unknown>;
    tags?: string[];
    status?: "draft" | "published" | "hidden";
    board?: string;
    category?: string | null;
  },
) {
  const db = getDb();

  const [target] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("게시글을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();

  const updated = await db.transaction(async (tx) => {
    // 1) posts 본문/제목 업데이트
    const updateSet: Record<string, unknown> = { updatedAt: now };
    if (data.title !== undefined) updateSet.title = data.title;
    if (data.contentJson !== undefined) updateSet.contentJson = data.contentJson;
    if (data.status !== undefined) {
      updateSet.status = data.status;
      updateSet.deletedAt = null;
    }
    if (data.board !== undefined) updateSet.board = data.board;
    if (data.category !== undefined) updateSet.category = data.category;

    const [row] = await tx
      .update(posts)
      .set(updateSet)
      .where(eq(posts.id, id))
      .returning({ id: posts.id, status: posts.status, updatedAt: posts.updatedAt });

    // 2) 태그 재계산 (taggable 전량 삭제 후 재삽입)
    if (data.tags !== undefined) {
      await tx
        .delete(taggable)
        .where(and(eq(taggable.targetType, "post"), eq(taggable.targetId, id)));

      if (data.tags.length > 0) {
        const taggableValues: { targetType: string; targetId: string; tagId: string }[] = [];
        for (const tagName of data.tags) {
          const tagSlug = tagName.toLowerCase().replace(/\s+/g, "-");

          // 기존 태그 찾기
          let [existing] = await tx
            .select({ id: tagsTable.id })
            .from(tagsTable)
            .where(eq(tagsTable.slug, tagSlug))
            .limit(1);

          // 없으면 삽입
          if (!existing) {
            const inserted = await tx
              .insert(tagsTable)
              .values({ name: tagName, slug: tagSlug })
              .onConflictDoNothing()
              .returning({ id: tagsTable.id });

            if (inserted[0]) {
              existing = inserted[0];
            } else {
              [existing] = await tx
                .select({ id: tagsTable.id })
                .from(tagsTable)
                .where(eq(tagsTable.slug, tagSlug))
                .limit(1);
            }
          }

          if (existing) {
            taggableValues.push({ targetType: "post", targetId: id, tagId: existing.id });
          }
        }

        if (taggableValues.length > 0) {
          await tx.insert(taggable).values(taggableValues).onConflictDoNothing();
        }
      }
    }

    return row;
  });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
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

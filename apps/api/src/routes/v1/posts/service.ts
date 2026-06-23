/**
 * 게시글 목록 서비스 — Story 2.3
 *
 * DB 접근은 이 파일(service 레이어)에서만. route handler 에서 직접 쿼리 금지.
 * N+1 방지: 작성자 닉네임은 LEFT JOIN users, 태그는 별도 inArray 배치 쿼리.
 *
 * commentCount · likeCount 는 Epic 5 활성화 전까지 0 고정.
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { PostCard } from "@ai-jakdang/contracts";
import { eq, and, isNull, desc, count, inArray } from "drizzle-orm";

export type SortOption = "latest" | "popular" | "most-comments";

export interface GetPostsParams {
  board: string;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface GetPostsResult {
  items: PostCard[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * 게시판 게시글 목록을 페이지네이션 + 정렬하여 반환한다.
 *
 * - status = 'published' AND deleted_at IS NULL 필터 필수
 * - 작성자 닉네임: LEFT JOIN users (탈퇴 회원 → null)
 * - 태그: taggable + tags 배치 inArray 쿼리 (N+1 방지)
 * - commentCount · likeCount: Epic 5 이전 0 고정
 */
export async function getPosts({
  board,
  sort = "latest",
  page = 1,
  pageSize = 20,
}: GetPostsParams): Promise<GetPostsResult> {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  // ── 정렬 컬럼 결정 ────────────────────────────────────────────────────────────
  // most-comments: comment_count 컬럼 없음(Epic 5 이전) → created_at DESC 폴백
  const orderBy =
    sort === "popular"
      ? desc(schema.posts.viewCount)
      : desc(schema.posts.createdAt);

  // ── WHERE 조건 ────────────────────────────────────────────────────────────────
  const whereCondition = and(
    eq(schema.posts.board, board),
    eq(schema.posts.status, "published"),
    isNull(schema.posts.deletedAt),
  );

  // ── 총 개수 쿼리 ──────────────────────────────────────────────────────────────
  const [countRow] = await db
    .select({ total: count() })
    .from(schema.posts)
    .where(whereCondition);

  const totalItems = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // ── 게시글 + 작성자 닉네임 LEFT JOIN ─────────────────────────────────────────
  const rows = await db
    .select({
      id: schema.posts.id,
      slug: schema.posts.slug,
      title: schema.posts.title,
      summary: schema.posts.summary,
      board: schema.posts.board,
      viewCount: schema.posts.viewCount,
      hasAttachment: schema.posts.isPinned, // isPinned 컬럼 임시 활용; hasAttachment 컬럼은 Epic 4에서 추가 예정 → false 고정
      createdAt: schema.posts.createdAt,
      authorNickname: schema.users.nickname,
    })
    .from(schema.posts)
    .leftJoin(schema.users, eq(schema.posts.userId, schema.users.id))
    .where(whereCondition)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  if (rows.length === 0) {
    return {
      items: [],
      meta: { page, pageSize, totalItems, totalPages },
    };
  }

  // ── 태그 배치 쿼리 (N+1 방지) ─────────────────────────────────────────────────
  const postIds = rows.map((r) => r.id);

  const taggableRows = await db
    .select({
      targetId: schema.taggable.targetId,
      tagName: schema.tags.name,
    })
    .from(schema.taggable)
    .innerJoin(schema.tags, eq(schema.taggable.tagId, schema.tags.id))
    .where(
      and(
        eq(schema.taggable.targetType, "post"),
        inArray(schema.taggable.targetId, postIds),
      ),
    );

  // postId → 태그명 배열 맵
  const tagMap = new Map<string, string[]>();
  for (const { targetId, tagName } of taggableRows) {
    const existing = tagMap.get(targetId) ?? [];
    existing.push(tagName);
    tagMap.set(targetId, existing);
  }

  // ── PostCard 조립 ─────────────────────────────────────────────────────────────
  const items: PostCard[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? null,
    board: row.board,
    authorNickname: row.authorNickname ?? null,
    createdAt: row.createdAt.toISOString(),
    viewCount: row.viewCount,
    commentCount: 0, // Epic 5 이전 고정
    likeCount: 0, // Epic 5 이전 고정
    hasAttachment: false, // Epic 4 이전 고정 (첨부파일 테이블 미존재)
    tags: tagMap.get(row.id) ?? [],
  }));

  return {
    items,
    meta: { page, pageSize, totalItems, totalPages },
  };
}

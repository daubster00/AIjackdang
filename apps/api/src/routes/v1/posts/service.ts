/**
 * 게시글 서비스 — Story 2.3 (목록) + Story 2.7 (작성·임시저장)
 *
 * DB 접근은 이 파일(service 레이어)에서만. route handler 에서 직접 쿼리 금지.
 * N+1 방지: 작성자 닉네임은 LEFT JOIN users, 태그는 별도 inArray 배치 쿼리.
 *
 * commentCount · likeCount 는 Epic 5 활성화 전까지 0 고정.
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { PostCard, PostDetail } from "@ai-jakdang/contracts";
import type { CreatePostInput } from "@ai-jakdang/contracts";
import { tiptapJsonToHtml } from "../../../lib/tiptap-renderer.js";
import { eq, and, isNull, desc, count, inArray } from "drizzle-orm";
import { slugify, generateUniqueSlug, generateSummary } from "@ai-jakdang/utilities";
import { Redis } from "ioredis";

// ── Redis 싱글톤 (조회수 버퍼링용) ───────────────────────────────────────────
let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6380";
    _redis = new Redis(url, { lazyConnect: true });
    _redis.on("error", (err) => console.error("[view-redis] 연결 오류:", err.message));
  }
  return _redis;
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Story 2.7: 게시글 작성 (POST /api/v1/posts)
// ─────────────────────────────────────────────────────────────────────────────

export type PostStatus = "draft" | "published";

export interface CreatePostParams {
  input: CreatePostInput & { status?: PostStatus };
  userId: string;
}

export interface CreatePostResult {
  id: string;
  slug: string;
  board: string;
  category: string | null;
  status: PostStatus;
}

/**
 * 게시글을 작성하거나 임시저장한다.
 *
 * - `db.transaction()` 으로 posts INSERT + tags upsert + taggable INSERT 원자 처리.
 * - slug: `slugify(title)` → DB uniqueness 체크 → 중복 시 `-{nanoid6}` suffix.
 * - summary: `generateSummary(contentJson)` 자동 생성 (명시적 summary 가 없을 때).
 * - status='draft' 일 때 tags 도 함께 저장한다 (재편집 시 복원 대비).
 *
 * @returns 생성된 post 의 `{ id, slug, board, category, status }`
 */
export async function createPost({
  input,
  userId,
}: CreatePostParams): Promise<CreatePostResult> {
  const db = getDb();

  const {
    board,
    category = null,
    title,
    contentJson,
    summary: explicitSummary,
    tags = [],
    status = "published",
  } = input;

  // ── slug 생성 ──────────────────────────────────────────────────────────────
  const baseSlug = slugify(title) || slugify(board) || "post";

  const slug = await generateUniqueSlug(baseSlug, async (candidate: string) => {
    const rows = await db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(eq(schema.posts.slug, candidate))
      .limit(1);
    return rows.length > 0;
  });

  // ── summary 자동 생성 ──────────────────────────────────────────────────────
  const summary =
    explicitSummary?.trim() ||
    generateSummary(contentJson) ||
    null;

  // ── 트랜잭션: posts INSERT + tags upsert + taggable INSERT ─────────────────
  return await db.transaction(async (tx) => {
    // 1) posts INSERT
    const [post] = await tx
      .insert(schema.posts)
      .values({
        userId,
        board,
        category: category ?? undefined,
        title,
        slug,
        contentJson,
        summary: summary ?? undefined,
        status,
      })
      .returning({
        id: schema.posts.id,
        slug: schema.posts.slug,
        board: schema.posts.board,
        category: schema.posts.category,
        status: schema.posts.status,
      });

    if (!post) {
      throw new Error("게시글 INSERT 실패");
    }

    // 2) tags upsert + taggable INSERT (태그가 있을 때만)
    if (tags.length > 0) {
      const tagIds: string[] = [];

      for (const tagName of tags) {
        const tagSlug = slugify(tagName) || tagName.toLowerCase();

        // 기존 태그 조회
        const existing = await tx
          .select({ id: schema.tags.id })
          .from(schema.tags)
          .where(eq(schema.tags.slug, tagSlug))
          .limit(1);

        if (existing.length > 0 && existing[0]) {
          tagIds.push(existing[0].id);
        } else {
          // 새 태그 INSERT
          const [created] = await tx
            .insert(schema.tags)
            .values({ name: tagName, slug: tagSlug })
            .onConflictDoNothing()
            .returning({ id: schema.tags.id });

          if (created) {
            tagIds.push(created.id);
          } else {
            // onConflictDoNothing 로 인해 반환이 없을 경우 재조회
            const retry = await tx
              .select({ id: schema.tags.id })
              .from(schema.tags)
              .where(eq(schema.tags.slug, tagSlug))
              .limit(1);
            if (retry[0]) tagIds.push(retry[0].id);
          }
        }
      }

      // taggable INSERT 배치
      if (tagIds.length > 0) {
        await tx.insert(schema.taggable).values(
          tagIds.map((tagId) => ({
            targetType: "post" as const,
            targetId: post.id,
            tagId,
          })),
        );
      }
    }

    return {
      id: post.id,
      slug: post.slug,
      board: post.board,
      category: post.category ?? null,
      status: post.status as PostStatus,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 2.7: 임시저장 draft 단건 조회 (GET /api/v1/posts/drafts/:id)
// ─────────────────────────────────────────────────────────────────────────────

export interface GetDraftParams {
  postId: string;
  userId: string;
}

/**
 * 본인의 임시저장 게시글 단건을 반환한다.
 * 다른 사용자의 draft 또는 존재하지 않는 id 는 null 반환 (404 처리는 route 레이어).
 */
export async function getDraft({
  postId,
  userId,
}: GetDraftParams): Promise<{
  id: string;
  title: string;
  contentJson: Record<string, unknown>;
  summary: string | null;
  tags: string[];
  board: string;
  category: string | null;
  status: string;
} | null> {
  const db = getDb();

  const rows = await db
    .select({
      id: schema.posts.id,
      title: schema.posts.title,
      contentJson: schema.posts.contentJson,
      summary: schema.posts.summary,
      board: schema.posts.board,
      category: schema.posts.category,
      status: schema.posts.status,
    })
    .from(schema.posts)
    .where(
      and(
        eq(schema.posts.id, postId),
        eq(schema.posts.userId, userId),
        eq(schema.posts.status, "draft"),
        isNull(schema.posts.deletedAt),
      ),
    )
    .limit(1);

  if (rows.length === 0 || !rows[0]) return null;

  const post = rows[0];

  // 태그 조회
  const taggableRows = await db
    .select({ tagName: schema.tags.name })
    .from(schema.taggable)
    .innerJoin(schema.tags, eq(schema.taggable.tagId, schema.tags.id))
    .where(
      and(
        eq(schema.taggable.targetType, "post"),
        eq(schema.taggable.targetId, postId),
      ),
    );

  return {
    id: post.id,
    title: post.title,
    contentJson: post.contentJson as Record<string, unknown>,
    summary: post.summary ?? null,
    board: post.board,
    category: post.category ?? null,
    status: post.status,
    tags: taggableRows.map((r) => r.tagName),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 2.4: 게시글 상세 조회 (GET /api/v1/posts/:slug)
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Redis INCR 조회수 버퍼링.
 * dedup key: view:post:{postId}:{fingerprint} — NX EX 1800
 * incr key:  view:post:{postId} (집계, worker가 flush)
 * AR-16·AR-17: 직접 DB UPDATE 절대 금지.
 */
async function incrementViewCount(postId: string, fingerprint: string): Promise<void> {
  try {
    const redis = getRedis();
    const dedupKey = `view:post:${postId}:${fingerprint}`;
    const incrKey = `view:post:${postId}`;
    // NX = 없을 때만 SET. "OK" = 새 조회, null = dedup
    const result = await redis.set(dedupKey, "1", "EX", 1800, "NX");
    if (result === "OK") {
      await redis.incr(incrKey);
    }
  } catch (err) {
    console.warn("[view-redis] INCR 실패 (무시):", (err as Error).message);
  }
}

/**
 * slug로 게시글 상세를 조회한다.
 *
 * - status !== 'published' 이고 본인이 아니면 null 반환 (→ 404).
 * - 조회 시 Redis INCR 버퍼링 (fire-and-forget) — AR-16·AR-17.
 * - contentHtml: Tiptap JSON → `@tiptap/html` + sanitize-html 화이트리스트 (Story 2.6).
 */
export async function getPostBySlug(
  slug: string,
  currentUserId?: string,
): Promise<PostDetail | null> {
  const db = getDb();

  // posts + author LEFT JOIN
  const rows = await db
    .select({
      id: schema.posts.id,
      slug: schema.posts.slug,
      title: schema.posts.title,
      summary: schema.posts.summary,
      board: schema.posts.board,
      viewCount: schema.posts.viewCount,
      createdAt: schema.posts.createdAt,
      updatedAt: schema.posts.updatedAt,
      isPinned: schema.posts.isPinned,
      seoTitle: schema.posts.seoTitle,
      seoDescription: schema.posts.seoDescription,
      status: schema.posts.status,
      contentJson: schema.posts.contentJson,
      userId: schema.posts.userId,
      authorNickname: schema.users.nickname,
    })
    .from(schema.posts)
    .leftJoin(schema.users, eq(schema.posts.userId, schema.users.id))
    .where(
      and(
        eq(schema.posts.slug, slug),
        isNull(schema.posts.deletedAt),
      ),
    )
    .limit(1);

  if (rows.length === 0 || !rows[0]) return null;
  const row = rows[0];

  // Only published posts are visible to non-owners
  const isOwner = !!currentUserId && row.userId === currentUserId;
  if (row.status !== "published" && !isOwner) return null;

  // Tags
  const taggableRows = await db
    .select({ tagName: schema.tags.name })
    .from(schema.taggable)
    .innerJoin(schema.tags, eq(schema.taggable.tagId, schema.tags.id))
    .where(
      and(
        eq(schema.taggable.targetType, "post"),
        eq(schema.taggable.targetId, row.id),
      ),
    );

  const tags = taggableRows.map((r) => r.tagName);

  // contentHtml — Tiptap JSON → HTML + sanitize-html 화이트리스트 (Story 2.6)
  const contentHtml = tiptapJsonToHtml(row.contentJson);

  // View count: Redis INCR with dedup (30min TTL per IP/session)
  // Fire-and-forget — don't let Redis failures block the response
  void incrementViewCount(row.id, currentUserId ?? "anon");

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? null,
    board: row.board,
    viewCount: row.viewCount,
    commentCount: 0, // Epic 5 이전 고정
    likeCount: 0,    // Epic 5 이전 고정
    hasAttachment: false, // Epic 4 이전 고정
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isPinned: row.isPinned,
    seoTitle: row.seoTitle ?? null,
    seoDescription: row.seoDescription ?? null,
    status: row.status as PostDetail["status"],
    contentHtml,
    contentJson: row.contentJson as Record<string, unknown>,
    authorId: row.userId ?? null,
    authorNickname: row.authorNickname ?? null,
    isOwner,
    tags,
  };
}

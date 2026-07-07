/**
 * 게시글 서비스 — Story 2.3 (목록) + Story 2.7 (작성·임시저장)
 *
 * DB 접근은 이 파일(service 레이어)에서만. route handler 에서 직접 쿼리 금지.
 * N+1 방지: 작성자 닉네임은 LEFT JOIN users, 태그는 별도 inArray 배치 쿼리.
 *
 * commentCount · likeCount 는 Epic 5 활성화 전까지 0 고정.
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { PostCard, PostDetail, CreativeSpec } from "@ai-jakdang/contracts";
import type { CreatePostInput, RecruitPost, RecruitMeta, AttachmentInput } from "@ai-jakdang/contracts";

/** Story 8.6: OG 링크 미리보기 맵 타입 (contracts/index.ts 추가 전 로컬 정의) */
type LinkPreviewMap = Record<string, {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}>;
import { tiptapJsonToHtml } from "../../../lib/tiptap-renderer.js";
import { eq, and, isNull, desc, count, inArray, sql } from "drizzle-orm";
import { slugify, generateUniqueSlug, generateSummary } from "@ai-jakdang/utilities";
import { getDefaultAvatarUrl } from "@ai-jakdang/core";
import sanitizeHtml from "sanitize-html";
import { earnPoints, revokePoints, getTodayCount } from "../gamification/points.service.js";
import { extractExternalUrls } from "../../../lib/extract-urls.js";
import { extractFirstImageUrl } from "../../../lib/extract-first-image.js";
import { getOgFetchQueue, OG_FETCH_JOB_NAME } from "../../../lib/queues.js";

/** byte 크기를 사람이 읽기 쉬운 문자열로 변환한다. 예: 2516582 → "2.4 MB" */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type SortOption = "latest" | "popular" | "most-comments";

export interface GetPostsParams {
  board: string;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  /** Story 2.12: gigs 전용 필터 */
  postKind?: "request" | "offer";
  fields?: string;
  recruitStatus?: "open" | "closed";
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
  postKind,
  fields,
  recruitStatus,
}: GetPostsParams): Promise<GetPostsResult> {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  // ── 정렬 컬럼 결정 ────────────────────────────────────────────────────────────
  // most-comments: comment_count 컬럼 없음(Epic 5 이전) → created_at DESC 폴백
  // Story 2.9: notice 게시판은 is_pinned DESC 우선 정렬 (핀된 글 최상단)
  const secondaryOrder =
    sort === "popular"
      ? desc(schema.posts.viewCount)
      : desc(schema.posts.createdAt);

  // ── WHERE 조건 ────────────────────────────────────────────────────────────────
  // Story 2.12: gigs 필터 (postKind, recruitStatus, fields)
  const recruitFilters = [];
  if (board === "gigs") {
    if (postKind) recruitFilters.push(eq(schema.recruitPost.postKind, postKind));
    if (recruitStatus) recruitFilters.push(eq(schema.recruitPost.recruitStatus, recruitStatus));
    if (fields) {
      recruitFilters.push(sql`${schema.recruitPost.fields} @> ${JSON.stringify([fields])}::jsonb`);
    }
  }

  const whereCondition = and(
    eq(schema.posts.board, board),
    eq(schema.posts.status, "published"),
    isNull(schema.posts.deletedAt),
    ...recruitFilters,
  );

  // ── 총 개수 쿼리 ──────────────────────────────────────────────────────────────
  // Story 2.12: gigs 필터가 recruit_post를 참조하는 경우 LEFT JOIN 필요
  const countQuery = db
    .select({ total: count() })
    .from(schema.posts);

  const countRow = recruitFilters.length > 0
    ? await countQuery
        .leftJoin(schema.recruitPost, eq(schema.recruitPost.postId, schema.posts.id))
        .where(whereCondition)
        .then(([row]) => row)
    : await countQuery
        .where(whereCondition)
        .then(([row]) => row);

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
      isPinned: schema.posts.isPinned,
      createdAt: schema.posts.createdAt,
      userId: schema.posts.userId,
      thumbnailUrl: schema.posts.thumbnailUrl,
      authorNickname: schema.users.nickname,
      authorAvatarUrl: schema.users.avatarUrl,
      authorImage: schema.users.image,
      authorDefaultAvatarIndex: schema.users.defaultAvatarIndex,
      // Story 2.12: 구인·외주 메타 JOIN (board='gigs' 전용)
      recruitPostKind: schema.recruitPost.postKind,
      recruitFields: schema.recruitPost.fields,
      recruitStatus: schema.recruitPost.recruitStatus,
      recruitBudget: schema.recruitPost.budget,
      recruitDuration: schema.recruitPost.duration,
      recruitWorkMode: schema.recruitPost.workMode,
      recruitContactMethod: schema.recruitPost.contactMethod,
    })
    .from(schema.posts)
    .leftJoin(schema.users, eq(schema.posts.userId, schema.users.id))
    .leftJoin(schema.recruitPost, eq(schema.recruitPost.postId, schema.posts.id))
    .where(whereCondition)
    .orderBy(desc(schema.posts.isPinned), secondaryOrder)
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

  // 첨부파일 보유 여부 배치 조회 (N+1 방지) — distinct post_id 집합
  const attachmentRows = await db
    .selectDistinct({ postId: schema.postAttachments.postId })
    .from(schema.postAttachments)
    .where(inArray(schema.postAttachments.postId, postIds));
  const attachmentPostIds = new Set(attachmentRows.map((r) => r.postId));

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

  // likeCount 배치 집계 — reactions 테이블 실집계 (N+1 방지)
  const likeCountRows = await db
    .select({
      targetId: schema.reactions.targetId,
      cnt: sql<number>`cast(count(*) as int)`,
    })
    .from(schema.reactions)
    .where(
      and(
        eq(schema.reactions.targetType, "post"),
        eq(schema.reactions.reactionType, "like"),
        inArray(schema.reactions.targetId, postIds),
      ),
    )
    .groupBy(schema.reactions.targetId);

  const likeCountMap = new Map<string, number>(
    likeCountRows.map((r) => [r.targetId, r.cnt]),
  );

  // commentCount 배치 집계 — visible 댓글만 집계 (N+1 방지)
  const commentCountRows = await db
    .select({
      targetId: schema.comments.targetId,
      cnt: sql<number>`cast(count(*) as int)`,
    })
    .from(schema.comments)
    .where(
      and(
        eq(schema.comments.targetType, "post"),
        eq(schema.comments.status, "visible"),
        inArray(schema.comments.targetId, postIds),
      ),
    )
    .groupBy(schema.comments.targetId);

  const commentCountMap = new Map<string, number>(
    commentCountRows.map((r) => [r.targetId, r.cnt]),
  );

  // ── PostCard 조립 ─────────────────────────────────────────────────────────────
  const items: PostCard[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? null,
    board: row.board,
    authorNickname: row.authorNickname ?? null,
    authorAvatarUrl: row.authorNickname != null
      ? (row.authorAvatarUrl || row.authorImage || getDefaultAvatarUrl(row.authorDefaultAvatarIndex ?? 0))
      : null,
    createdAt: row.createdAt.toISOString(),
    viewCount: row.viewCount,
    commentCount: commentCountMap.get(row.id) ?? 0,
    likeCount: likeCountMap.get(row.id) ?? 0,
    hasAttachment: attachmentPostIds.has(row.id),
    isPinned: row.isPinned, // Story 2.9: 공지 핀 고정 여부
    tags: tagMap.get(row.id) ?? [],
    userId: row.userId ?? null,
    thumbnailUrl: row.thumbnailUrl ?? null,
    // Story 2.12: gigs 전용 recruitMeta
    recruitMeta: row.recruitPostKind != null
      ? {
          postKind: row.recruitPostKind as "request" | "offer",
          fields: Array.isArray(row.recruitFields) ? (row.recruitFields as string[]) : [],
          recruitStatus: (row.recruitStatus ?? "open") as "open" | "closed",
          budget: row.recruitBudget ?? null,
          duration: row.recruitDuration ?? null,
          workMode: (row.recruitWorkMode ?? null) as ("remote" | "onsite" | "hybrid") | null,
          contactMethod: (row.recruitContactMethod ?? { types: [] }) as RecruitMeta["contactMethod"],
        }
      : null,
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
  input: CreatePostInput & { status?: PostStatus; creativeSpec?: CreativeSpec; recruitPost?: RecruitPost };
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
    creativeSpec,
    recruitPost,
    attachments = [],
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

  // ── 썸네일 URL: 본문 첫 번째 이미지 src 추출 ────────────────────────────────
  const thumbnailUrl = extractFirstImageUrl(contentJson);

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
        thumbnailUrl: thumbnailUrl ?? null,
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

    // 1.5) post_attachments INSERT (첨부파일이 있을 때만)
    if (attachments.length > 0) {
      await tx.insert(schema.postAttachments).values(
        attachments.slice(0, 5).map((att, idx) => ({
          postId: post.id,
          fileUrl: att.url,
          fileName: att.name,
          fileSize: att.size,
          mimeType: att.mimeType,
          displayOrder: idx,
        })),
      );
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

    // 3) post_creative_spec INSERT (board='ai-creation'이고 creativeSpec이 있을 때만)
    if (board === "ai-creation" && creativeSpec) {
      // XSS 새니타이즈: prompt·negPrompt는 사용자 자유 텍스트 → plaintext only
      const sanitizedPrompt = creativeSpec.prompt
        ? sanitizeHtml(creativeSpec.prompt, { allowedTags: [], allowedAttributes: {} })
        : undefined;
      const sanitizedNegPrompt = creativeSpec.negPrompt
        ? sanitizeHtml(creativeSpec.negPrompt, { allowedTags: [], allowedAttributes: {} })
        : undefined;

      // license + commercial → licenseNote 병합 (CreativeSpecFields에서 별도 필드로 관리)
      // licenseNote는 이미 클라이언트에서 병합해서 전송하거나 직접 전달
      const licenseNote = creativeSpec.licenseNote ?? undefined;

      await tx.insert(schema.postCreativeSpec).values({
        postId: post.id,
        mediaType: creativeSpec.mediaType ?? null,
        tools: creativeSpec.tools ?? null,
        prompt: sanitizedPrompt ?? null,
        negativePrompt: sanitizedNegPrompt ?? null,
        params: creativeSpec.params ?? null,
        postprocess: creativeSpec.postProcess ? creativeSpec.postProcess : null,
        costType: creativeSpec.costType ?? null,
        timeSpent: creativeSpec.timeSpent ?? null,
        licenseNote: licenseNote ?? null,
      });
    }

    // 4) recruit_post INSERT (board='gigs'이고 recruitPost가 있을 때만)
    if (board === "gigs" && recruitPost) {
      await tx.insert(schema.recruitPost).values({
        postId: post.id,
        postKind: recruitPost.postKind,
        fields: recruitPost.fields,
        recruitStatus: recruitPost.recruitStatus ?? "open",
        budget: recruitPost.budget ?? null,
        duration: recruitPost.duration ?? null,
        workMode: recruitPost.workMode ?? null,
        contactMethod: recruitPost.contactMethod,
      });
    }

    // 5) 포인트 적립 (published 게시글만, 실패해도 콘텐츠 저장은 유지)
    if (status === "published") {
      try {
        const todayCount = await getTodayCount(tx, { userId, reason: "post.created" });
        await earnPoints(tx, {
          userId,
          reason: "post.created",
          sourceType: "post",
          sourceId: post.id,
          todayCount,
        });
      } catch (err) {
        console.error("[points] 게시글 적립 실패 (무시):", (err as Error).message);
      }
    }

    return {
      id: post.id,
      slug: post.slug,
      board: post.board,
      category: post.category ?? null,
      status: post.status as PostStatus,
    };
  }).then(async (result) => {
    // ── [8.6] OG 잡 발행 (published 게시글만, fire-and-forget) ──────────────
    if (input.status !== "draft") {
      try {
        const siteUrl = process.env.SITE_URL ?? "";
        const urls = extractExternalUrls(input.contentJson, siteUrl);
        if (urls.length > 0) {
          await getOgFetchQueue().add(OG_FETCH_JOB_NAME, {
            targetType: "post",
            targetId: result.id,
            urls,
          }, {
            attempts: 2,
            backoff: { type: "fixed", delay: 5000 },
          });
        }
      } catch (err) {
        console.error("[og-fetch] 잡 발행 실패 (무시):", (err as Error).message);
      }
    }
    // ── [8.6] END ─────────────────────────────────────────────────────────────
    return result;
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
// Story 2.8: 게시글 수정 (PATCH /api/v1/posts/:id)
// ─────────────────────────────────────────────────────────────────────────────

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "권한이 없습니다.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class PostNotFoundError extends Error {
  readonly code = "POST_NOT_FOUND";
  constructor(message = "게시글을 찾을 수 없습니다.") {
    super(message);
    this.name = "PostNotFoundError";
  }
}

export interface UpdatePostParams {
  postId: string;
  userId: string;
  input: {
    title?: string;
    contentJson?: Record<string, unknown>;
    summary?: string;
    tags?: string[];
    status?: string;
    board?: string;
    category?: string;
    /** 지정 시 첨부파일 전량 교체. undefined 면 기존 첨부 보존. */
    attachments?: AttachmentInput[];
  };
}

export interface UpdatePostResult {
  id: string;
  slug: string;
  board: string;
  category: string | null;
}

/**
 * 게시글을 수정한다.
 *
 * - slug 는 NFR-8(불변) 에 따라 절대 변경하지 않는다.
 * - summary: input 에 없으면 contentJson 으로 재생성.
 * - taggable 재계산: 트랜잭션 내에서 기존 taggable 전량 삭제 후 새로 삽입.
 * - 작성자가 아닌 경우 ForbiddenError.
 */
export async function updatePost({
  postId,
  userId,
  input,
}: UpdatePostParams): Promise<UpdatePostResult> {
  const db = getDb();

  // 1) 게시글 조회 + 권한 검증
  const rows = await db
    .select({
      id: schema.posts.id,
      slug: schema.posts.slug,
      board: schema.posts.board,
      category: schema.posts.category,
      userId: schema.posts.userId,
      contentJson: schema.posts.contentJson,
    })
    .from(schema.posts)
    .where(and(eq(schema.posts.id, postId), isNull(schema.posts.deletedAt)))
    .limit(1);

  if (rows.length === 0 || !rows[0]) {
    throw new PostNotFoundError();
  }

  const post = rows[0];

  if (post.userId !== userId) {
    throw new ForbiddenError();
  }

  // 2) summary 재생성 (명시적 summary 없을 때 contentJson 기반)
  const effectiveContentJson = input.contentJson ?? (post.contentJson as Record<string, unknown>);
  const summary =
    input.summary?.trim() || generateSummary(effectiveContentJson) || null;

  // 3) 트랜잭션: posts UPDATE + taggable 재계산
  return await db.transaction(async (tx) => {
    // posts UPDATE (slug 제외)
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
      summary: summary ?? undefined,
    };
    if (input.title !== undefined) updateValues.title = input.title;
    if (input.contentJson !== undefined) {
      updateValues.contentJson = input.contentJson;
      // contentJson 변경 시 썸네일 URL 재추출
      updateValues.thumbnailUrl = extractFirstImageUrl(input.contentJson);
    }
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.board !== undefined) updateValues.board = input.board;
    if (input.category !== undefined) updateValues.category = input.category;

    const [updated] = await tx
      .update(schema.posts)
      .set(updateValues)
      .where(eq(schema.posts.id, postId))
      .returning({
        id: schema.posts.id,
        slug: schema.posts.slug,
        board: schema.posts.board,
        category: schema.posts.category,
      });

    if (!updated) {
      throw new Error("게시글 UPDATE 실패");
    }

    // taggable 재계산 (input.tags 가 있을 때만 실행)
    if (input.tags !== undefined) {
      // 기존 taggable 전량 삭제
      await tx
        .delete(schema.taggable)
        .where(
          and(
            eq(schema.taggable.targetType, "post"),
            eq(schema.taggable.targetId, postId),
          ),
        );

      // 새 태그 upsert + taggable INSERT
      if (input.tags.length > 0) {
        const tagIds: string[] = [];

        for (const tagName of input.tags) {
          const tagSlug = slugify(tagName) || tagName.toLowerCase();

          const existing = await tx
            .select({ id: schema.tags.id })
            .from(schema.tags)
            .where(eq(schema.tags.slug, tagSlug))
            .limit(1);

          if (existing.length > 0 && existing[0]) {
            tagIds.push(existing[0].id);
          } else {
            const [created] = await tx
              .insert(schema.tags)
              .values({ name: tagName, slug: tagSlug })
              .onConflictDoNothing()
              .returning({ id: schema.tags.id });

            if (created) {
              tagIds.push(created.id);
            } else {
              const retry = await tx
                .select({ id: schema.tags.id })
                .from(schema.tags)
                .where(eq(schema.tags.slug, tagSlug))
                .limit(1);
              if (retry[0]) tagIds.push(retry[0].id);
            }
          }
        }

        if (tagIds.length > 0) {
          await tx.insert(schema.taggable).values(
            tagIds.map((tagId) => ({
              targetType: "post" as const,
              targetId: postId,
              tagId,
            })),
          );
        }
      }
    }

    // 첨부파일 교체 (input.attachments 가 명시된 경우에만 — 미지정 시 기존 보존)
    if (input.attachments !== undefined) {
      await tx
        .delete(schema.postAttachments)
        .where(eq(schema.postAttachments.postId, postId));

      if (input.attachments.length > 0) {
        await tx.insert(schema.postAttachments).values(
          input.attachments.slice(0, 5).map((att, idx) => ({
            postId,
            fileUrl: att.url,
            fileName: att.name,
            fileSize: att.size,
            mimeType: att.mimeType,
            displayOrder: idx,
          })),
        );
      }
    }

    return {
      id: updated.id,
      slug: updated.slug,
      board: updated.board,
      category: updated.category ?? null,
    };
  }).then(async (result) => {
    // ── [8.6] OG 잡 발행 (contentJson 변경 시, fire-and-forget) ─────────────
    if (input.contentJson) {
      try {
        const siteUrl = process.env.SITE_URL ?? "";
        const urls = extractExternalUrls(input.contentJson, siteUrl);
        if (urls.length > 0) {
          await getOgFetchQueue().add(OG_FETCH_JOB_NAME, {
            targetType: "post",
            targetId: postId,
            urls,
          }, {
            attempts: 2,
            backoff: { type: "fixed", delay: 5000 },
          });
        }
      } catch (err) {
        console.error("[og-fetch] 잡 발행 실패 (무시):", (err as Error).message);
      }
    }
    // ── [8.6] END ─────────────────────────────────────────────────────────────
    return result;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 2.8: 게시글 삭제 (DELETE /api/v1/posts/:id) — soft-delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 게시글을 soft-delete 처리한다.
 *
 * - `status='deleted'` + `deleted_at=NOW()` 로 마킹 (물리 삭제 금지, AR-7).
 * - 작성자가 아닌 경우 ForbiddenError.
 */
export async function deletePost({
  postId,
  userId,
}: {
  postId: string;
  userId: string;
}): Promise<void> {
  const db = getDb();

  // 게시글 조회 + 권한 검증
  const rows = await db
    .select({ id: schema.posts.id, userId: schema.posts.userId })
    .from(schema.posts)
    .where(and(eq(schema.posts.id, postId), isNull(schema.posts.deletedAt)))
    .limit(1);

  if (rows.length === 0 || !rows[0]) {
    throw new PostNotFoundError();
  }

  if (rows[0].userId !== userId) {
    throw new ForbiddenError();
  }

  // soft-delete + 포인트 회수 (동일 트랜잭션)
  await db.transaction(async (tx) => {
    await tx
      .update(schema.posts)
      .set({ status: "deleted", deletedAt: new Date() })
      .where(eq(schema.posts.id, postId));

    try {
      await revokePoints(tx, {
        userId,
        reason: "post.created",
        sourceType: "post",
        sourceId: postId,
      });
    } catch (err) {
      console.error("[points] 게시글 회수 실패 (무시):", (err as Error).message);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 2.4: 게시글 상세 조회 (GET /api/v1/posts/:slug)
// ─────────────────────────────────────────────────────────────────────────────


/**
 * slug로 게시글 상세를 조회한다.
 *
 * - status !== 'published' 이고 본인이 아니면 null 반환 (→ 404).
 * - 조회수는 여기서 올리지 않는다. 브라우저 ViewBeacon → POST /api/v1/views 가 담당
 *   (SSR fetch는 실제 클라이언트 IP를 알 수 없어 IP 중복 제거가 불가능하기 때문).
 * - contentHtml: Tiptap JSON → `@tiptap/html` + sanitize-html 화이트리스트 (Story 2.6).
 */
export async function getPostBySlug(
  slug: string,
  currentUserId?: string,
): Promise<PostDetail | null> {
  const db = getDb();

  // posts + author + creative spec LEFT JOIN
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
      authorAvatarUrl: schema.users.avatarUrl,
      authorImage: schema.users.image,
      authorDefaultAvatarIndex: schema.users.defaultAvatarIndex,
      // Story 2.11: 창작 스펙 JOIN 컬럼
      specMediaType: schema.postCreativeSpec.mediaType,
      specTools: schema.postCreativeSpec.tools,
      specPrompt: schema.postCreativeSpec.prompt,
      specNegativePrompt: schema.postCreativeSpec.negativePrompt,
      specParams: schema.postCreativeSpec.params,
      specPostprocess: schema.postCreativeSpec.postprocess,
      specCostType: schema.postCreativeSpec.costType,
      specTimeSpent: schema.postCreativeSpec.timeSpent,
      specLicenseNote: schema.postCreativeSpec.licenseNote,
      // Story 2.12: 구인·외주 스펙 JOIN 컬럼
      recruitPostKind: schema.recruitPost.postKind,
      recruitFields: schema.recruitPost.fields,
      recruitStatus: schema.recruitPost.recruitStatus,
      recruitBudget: schema.recruitPost.budget,
      recruitDuration: schema.recruitPost.duration,
      recruitWorkMode: schema.recruitPost.workMode,
      recruitContactMethod: schema.recruitPost.contactMethod,
    })
    .from(schema.posts)
    .leftJoin(schema.users, eq(schema.posts.userId, schema.users.id))
    .leftJoin(
      schema.postCreativeSpec,
      eq(schema.postCreativeSpec.postId, schema.posts.id),
    )
    .leftJoin(
      schema.recruitPost,
      eq(schema.recruitPost.postId, schema.posts.id),
    )
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

  // 첨부파일 조회 (displayOrder 순)
  const attachmentRows = await db
    .select({
      fileUrl: schema.postAttachments.fileUrl,
      fileName: schema.postAttachments.fileName,
      fileSize: schema.postAttachments.fileSize,
    })
    .from(schema.postAttachments)
    .where(eq(schema.postAttachments.postId, row.id))
    .orderBy(schema.postAttachments.displayOrder);

  const attachments = attachmentRows.map((a) => ({
    name: a.fileName,
    size: formatFileSize(a.fileSize),
    url: a.fileUrl,
  }));

  // likeCount 집계 — reactions 테이블 실집계
  const [likeCountResult] = await db
    .select({ cnt: sql<number>`cast(count(*) as int)` })
    .from(schema.reactions)
    .where(
      and(
        eq(schema.reactions.targetType, "post"),
        eq(schema.reactions.targetId, row.id),
        eq(schema.reactions.reactionType, "like"),
      ),
    );

  // commentCount 집계 — visible 댓글만 집계
  const [commentCountResult] = await db
    .select({ cnt: sql<number>`cast(count(*) as int)` })
    .from(schema.comments)
    .where(
      and(
        eq(schema.comments.targetType, "post"),
        eq(schema.comments.targetId, row.id),
        eq(schema.comments.status, "visible"),
      ),
    );

  // contentHtml — Tiptap JSON → HTML + sanitize-html 화이트리스트 (Story 2.6)
  const contentHtml = tiptapJsonToHtml(row.contentJson);

  // 조회수: 브라우저 ViewBeacon(POST /api/v1/views)이 담당하므로 여기서 올리지 않는다.

  // Story 2.11: 창작 스펙 조립 — spec 레코드 존재 여부는 postId(non-null) 로 판별
  const hasSpec = row.specPostprocess !== undefined || row.specPrompt !== null || row.specTools !== null || row.specMediaType !== null;
  // LEFT JOIN이므로 post_creative_spec 레코드가 없으면 모든 spec 컬럼이 null
  const creativeSpecRow = row.specMediaType !== null ||
    row.specTools !== null ||
    row.specPrompt !== null ||
    row.specNegativePrompt !== null ||
    row.specParams !== null ||
    row.specPostprocess !== null ||
    row.specCostType !== null ||
    row.specTimeSpent !== null ||
    row.specLicenseNote !== null;

  const creativeSpec: CreativeSpec | null = creativeSpecRow
    ? {
        mediaType: Array.isArray(row.specMediaType) ? (row.specMediaType as string[]) : undefined,
        tools: Array.isArray(row.specTools) ? (row.specTools as CreativeSpec["tools"]) : undefined,
        prompt: row.specPrompt ?? undefined,
        negPrompt: row.specNegativePrompt ?? undefined,
        params: row.specParams != null ? (row.specParams as Record<string, string>) : undefined,
        postProcess: typeof row.specPostprocess === "string" ? row.specPostprocess : undefined,
        costType: row.specCostType ?? undefined,
        timeSpent: row.specTimeSpent ?? undefined,
        licenseNote: row.specLicenseNote ?? undefined,
      }
    : null;

  // suppress unused variable warning
  void hasSpec;

  // Story 2.12: 구인·외주 스펙 조립
  const recruitPostData: RecruitPost | null = row.recruitPostKind != null
    ? {
        postKind: row.recruitPostKind as "request" | "offer",
        fields: Array.isArray(row.recruitFields) ? (row.recruitFields as string[]) : [],
        recruitStatus: (row.recruitStatus ?? "open") as "open" | "closed",
        budget: row.recruitBudget ?? undefined,
        duration: row.recruitDuration ?? undefined,
        workMode: (row.recruitWorkMode ?? undefined) as ("remote" | "onsite" | "hybrid") | undefined,
        contactMethod: (row.recruitContactMethod ?? { types: [] }) as RecruitMeta["contactMethod"],
      }
    : null;

  // ── [8.6] linkPreviews 조회 ────────────────────────────────────────────────
  // NOTE: link_previews 테이블은 schema/index.ts 등록 전까지 raw SQL 조회 사용
  const siteUrl = process.env.SITE_URL ?? "";
  const externalUrls = extractExternalUrls(row.contentJson, siteUrl);
  let linkPreviews: LinkPreviewMap = {};

  if (externalUrls.length > 0) {
    try {
      // drizzle-orm sql`` 템플릿으로 raw SQL 실행 (link_previews는 schema 미등록 상태)
      const inList = sql.join(
        externalUrls.map((u) => sql`${u}`),
        sql`, `,
      );
      const rawResult = await db.execute(
        sql`SELECT url, title, description, image_url, site_name
            FROM link_previews
            WHERE url IN (${inList})
              AND error_at IS NULL`,
      );

      type PreviewRow = {
        url: string;
        title: string | null;
        description: string | null;
        image_url: string | null;
        site_name: string | null;
      };

      for (const preview of (rawResult.rows as PreviewRow[])) {
        if (preview.url) {
          linkPreviews[preview.url] = {
            title: preview.title ?? null,
            description: preview.description ?? null,
            imageUrl: preview.image_url ?? null,
            siteName: preview.site_name ?? null,
          };
        }
      }
    } catch (err) {
      console.warn("[link-previews] 조회 실패 (무시):", (err as Error).message);
    }
  }
  // ── [8.6] END ──────────────────────────────────────────────────────────────

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? null,
    board: row.board,
    viewCount: row.viewCount,
    commentCount: commentCountResult?.cnt ?? 0,
    likeCount: likeCountResult?.cnt ?? 0,
    hasAttachment: attachments.length > 0,
    attachments,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isPinned: row.isPinned,
    seoTitle: row.seoTitle ?? null,
    seoDescription: row.seoDescription ?? null,
    status: row.status as PostDetail["status"],
    contentHtml,
    contentJson: row.contentJson as Record<string, unknown>,
    authorId: row.userId ?? null,
    userId: row.userId ?? null,
    authorNickname: row.authorNickname ?? null,
    authorAvatarUrl: row.authorNickname != null
      ? (row.authorAvatarUrl || row.authorImage || getDefaultAvatarUrl(row.authorDefaultAvatarIndex ?? 0))
      : null,
    isOwner,
    tags,
    creativeSpec,
    recruitPost: recruitPostData,
    linkPreviews,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 2.9: 공지 핀 고정 토글 (PATCH /api/v1/posts/:id/pin)
// ─────────────────────────────────────────────────────────────────────────────

export interface PinPostResult {
  id: string;
  isPinned: boolean;
}

/**
 * 게시글 isPinned 값을 토글한다.
 * 관리자 전용 — route 레이어에서 권한 검증 후 호출.
 */
export async function pinPost({ postId }: { postId: string }): Promise<PinPostResult> {
  const db = getDb();

  const rows = await db
    .select({ id: schema.posts.id, isPinned: schema.posts.isPinned })
    .from(schema.posts)
    .where(and(eq(schema.posts.id, postId), isNull(schema.posts.deletedAt)))
    .limit(1);

  if (rows.length === 0 || !rows[0]) {
    throw new PostNotFoundError();
  }

  const current = rows[0];
  const newIsPinned = !current.isPinned;

  await db
    .update(schema.posts)
    .set({ isPinned: newIsPinned })
    .where(eq(schema.posts.id, postId));

  return { id: current.id, isPinned: newIsPinned };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 2.12: 모집상태 토글 (PATCH /api/v1/posts/:id/recruit-status)
// ─────────────────────────────────────────────────────────────────────────────

export interface ToggleRecruitStatusParams {
  postId: string;
  userId: string;
  recruitStatus: "open" | "closed";
}

export interface ToggleRecruitStatusResult {
  recruitStatus: "open" | "closed";
}

/**
 * 모집상태를 변경한다.
 * - 작성자 본인만 가능 (ForbiddenError)
 * - recruit_post 레코드가 없으면 PostNotFoundError
 */
export async function toggleRecruitStatus({
  postId,
  userId,
  recruitStatus,
}: ToggleRecruitStatusParams): Promise<ToggleRecruitStatusResult> {
  const db = getDb();

  // 게시글 조회 + 권한 검증
  const rows = await db
    .select({ id: schema.posts.id, userId: schema.posts.userId })
    .from(schema.posts)
    .where(and(eq(schema.posts.id, postId), isNull(schema.posts.deletedAt)))
    .limit(1);

  if (rows.length === 0 || !rows[0]) {
    throw new PostNotFoundError();
  }

  if (rows[0].userId !== userId) {
    throw new ForbiddenError();
  }

  // recruit_post UPDATE
  const updated = await db
    .update(schema.recruitPost)
    .set({ recruitStatus, updatedAt: new Date() })
    .where(eq(schema.recruitPost.postId, postId))
    .returning({ recruitStatus: schema.recruitPost.recruitStatus });

  if (updated.length === 0) {
    throw new PostNotFoundError("recruit_post 레코드를 찾을 수 없습니다.");
  }

  return { recruitStatus: updated[0]!.recruitStatus as "open" | "closed" };
}

/**
 * 통합 검색 서비스 — Story 8.1 (pg_bigm 전문 검색)
 *
 * AR-5: bigm_similarity(search_vector, query) 점수로 각 유형 독립 질의 후
 *       UNION ALL 병합. 유형별 max 스코어로 [0,1] 정규화 후 재정렬.
 * AR-6: taggable 다형 참조로 태그 조인 (N+1 방지 — 배치 inArray).
 * AR-13: DB 접근은 이 service 레이어에서만. route handler 에서 직접 쿼리 금지.
 *
 * 주의:
 * - search_vector 컬럼이 GENERATED ALWAYS AS STORED 이므로 INSERT/UPDATE 시 직접 지정 불가.
 * - bigm_similarity 는 pg_bigm 확장 설치 전제 (infra/postgres 에서 이미 설치됨, AR-3).
 * - tags 테이블에 usage_count 컬럼이 없으므로 suggestedTags 는 taggable 빈도 기준으로 반환.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { sql, eq, and, isNull, inArray, desc, count } from "drizzle-orm";
import type {
  SearchResultItem,
  SearchResponse,
} from "@ai-jakdang/contracts";

// ── 내부 타입 ─────────────────────────────────────────────────────────────────

interface SearchParams {
  q: string;
  type: "all" | "post" | "question" | "resource";
  page: number;
  pageSize: number;
}

/** raw DB row 형 — 공통 score 포함 */
interface RawPostRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  board: string;
  authorNickname: string | null;
  createdAt: Date;
  viewCount: number;
  score: number;
}

interface RawQuestionRow {
  id: string;
  slug: string;
  title: string;
  isResolved: boolean;
  authorNickname: string | null;
  createdAt: Date;
  score: number;
}

interface RawResourceRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  resourceType: string;
  authorNickname: string | null;
  createdAt: Date;
  downloadCount: number;
  score: number;
}

// ── 유형별 쿼리 함수 ─────────────────────────────────────────────────────────

/**
 * posts 테이블에서 bigm_similarity 기반 검색.
 * LIMIT 100 — 유형별 상한 (최종 페이지네이션은 병합 후 적용).
 */
async function searchPosts(q: string): Promise<RawPostRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: schema.posts.id,
      slug: schema.posts.slug,
      title: schema.posts.title,
      summary: schema.posts.summary,
      board: schema.posts.board,
      authorNickname: schema.users.nickname,
      createdAt: schema.posts.createdAt,
      viewCount: schema.posts.viewCount,
      score: sql<number>`bigm_similarity(${schema.posts.searchVector}, ${q})`.as("score"),
    })
    .from(schema.posts)
    .leftJoin(schema.users, eq(schema.posts.userId, schema.users.id))
    .where(
      and(
        eq(schema.posts.status, "published"),
        isNull(schema.posts.deletedAt),
        sql`bigm_similarity(${schema.posts.searchVector}, ${q}) > 0`,
      ),
    )
    .orderBy(desc(sql`bigm_similarity(${schema.posts.searchVector}, ${q})`))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary ?? null,
    board: r.board,
    authorNickname: r.authorNickname ?? null,
    createdAt: r.createdAt,
    viewCount: r.viewCount,
    score: Number(r.score),
  }));
}

/**
 * questions 테이블에서 bigm_similarity 기반 검색.
 */
async function searchQuestions(q: string): Promise<RawQuestionRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: schema.questions.id,
      slug: schema.questions.slug,
      title: schema.questions.title,
      isResolved: schema.questions.isResolved,
      authorNickname: schema.users.nickname,
      createdAt: schema.questions.createdAt,
      score: sql<number>`bigm_similarity(${schema.questions.searchVector}, ${q})`.as("score"),
    })
    .from(schema.questions)
    .leftJoin(schema.users, eq(schema.questions.userId, schema.users.id))
    .where(
      and(
        eq(schema.questions.status, "published"),
        isNull(schema.questions.deletedAt),
        sql`bigm_similarity(${schema.questions.searchVector}, ${q}) > 0`,
      ),
    )
    .orderBy(desc(sql`bigm_similarity(${schema.questions.searchVector}, ${q})`))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    isResolved: r.isResolved,
    authorNickname: r.authorNickname ?? null,
    createdAt: r.createdAt,
    score: Number(r.score),
  }));
}

/**
 * resources 테이블에서 bigm_similarity 기반 검색.
 */
async function searchResources(q: string): Promise<RawResourceRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: schema.resources.id,
      slug: schema.resources.slug,
      title: schema.resources.title,
      summary: schema.resources.summary,
      resourceType: schema.resources.resourceType,
      authorNickname: schema.users.nickname,
      createdAt: schema.resources.createdAt,
      downloadCount: schema.resources.downloadCount,
      score: sql<number>`bigm_similarity(${schema.resources.searchVector}, ${q})`.as("score"),
    })
    .from(schema.resources)
    .leftJoin(schema.users, eq(schema.resources.userId, schema.users.id))
    .where(
      and(
        eq(schema.resources.status, "published"),
        isNull(schema.resources.deletedAt),
        sql`bigm_similarity(${schema.resources.searchVector}, ${q}) > 0`,
      ),
    )
    .orderBy(desc(sql`bigm_similarity(${schema.resources.searchVector}, ${q})`))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    resourceType: r.resourceType,
    authorNickname: r.authorNickname ?? null,
    createdAt: r.createdAt,
    downloadCount: r.downloadCount,
    score: Number(r.score),
  }));
}

// ── 태그 배치 조회 ────────────────────────────────────────────────────────────

interface TagBatchResult {
  [targetId: string]: string[];
}

async function fetchTagsForIds(
  ids: string[],
  targetType: "post" | "question" | "resource",
): Promise<TagBatchResult> {
  if (ids.length === 0) return {};
  const db = getDb();

  const rows = await db
    .select({
      targetId: schema.taggable.targetId,
      tagName: schema.tags.name,
    })
    .from(schema.taggable)
    .innerJoin(schema.tags, eq(schema.taggable.tagId, schema.tags.id))
    .where(
      and(
        eq(schema.taggable.targetType, targetType),
        inArray(schema.taggable.targetId, ids),
      ),
    );

  const map: TagBatchResult = {};
  for (const { targetId, tagName } of rows) {
    if (!map[targetId]) map[targetId] = [];
    map[targetId].push(tagName);
  }
  return map;
}

// ── 인기 태그 조회 (suggestedTags) ────────────────────────────────────────────

/**
 * taggable 빈도 기준 인기 태그 최대 5개.
 * (tags.usage_count 컬럼이 없으므로 taggable COUNT 집계로 대체)
 */
async function getPopularTags(limit: number = 5): Promise<string[]> {
  const db = getDb();

  const rows = await db
    .select({
      name: schema.tags.name,
      cnt: count(schema.taggable.tagId).as("cnt"),
    })
    .from(schema.tags)
    .leftJoin(schema.taggable, eq(schema.tags.id, schema.taggable.tagId))
    .groupBy(schema.tags.id, schema.tags.name)
    .orderBy(desc(count(schema.taggable.tagId)))
    .limit(limit);

  return rows.map((r) => r.name);
}

// ── 점수 정규화 ───────────────────────────────────────────────────────────────

function normalizeScores<T extends { score: number }>(items: T[], maxScore: number): T[] {
  if (maxScore <= 0) return items.map((item) => ({ ...item, score: 0 }));
  return items.map((item) => ({ ...item, score: item.score / maxScore }));
}

// ── commentCount 배치 조회 (posts / questions 공통) ───────────────────────────
// Epic 5 comments 테이블 활성화 후 실수치 반환. 현재는 0으로 고정.

async function fetchCommentCounts(
  _ids: string[],
  _targetType: "post" | "question",
): Promise<Record<string, number>> {
  // TODO(Epic 5): SELECT target_id, COUNT(*) FROM comments WHERE target_type=? AND target_id IN (?)
  return {};
}

// ── 메인 검색 함수 ────────────────────────────────────────────────────────────

export async function search(params: SearchParams): Promise<SearchResponse> {
  const { q, type, page, pageSize } = params;

  let postResults: RawPostRow[] = [];
  let questionResults: RawQuestionRow[] = [];
  let resourceResults: RawResourceRow[] = [];

  // ── 유형별 쿼리 실행 ─────────────────────────────────────────────────────────
  if (type === "all") {
    [postResults, questionResults, resourceResults] = await Promise.all([
      searchPosts(q),
      searchQuestions(q),
      searchResources(q),
    ]);
  } else if (type === "post") {
    postResults = await searchPosts(q);
  } else if (type === "question") {
    questionResults = await searchQuestions(q);
  } else {
    resourceResults = await searchResources(q);
  }

  // ── 점수 정규화 (AR-5) ────────────────────────────────────────────────────────
  const maxPostScore = Math.max(...postResults.map((r) => r.score), 0);
  const maxQuestionScore = Math.max(...questionResults.map((r) => r.score), 0);
  const maxResourceScore = Math.max(...resourceResults.map((r) => r.score), 0);

  const normalizedPosts = normalizeScores(postResults, maxPostScore);
  const normalizedQuestions = normalizeScores(questionResults, maxQuestionScore);
  const normalizedResources = normalizeScores(resourceResults, maxResourceScore);

  // ── byType 카운트 ─────────────────────────────────────────────────────────────
  const byType = {
    post: normalizedPosts.length,
    question: normalizedQuestions.length,
    resource: normalizedResources.length,
  };

  const totalItems = byType.post + byType.question + byType.resource;

  // ── suggestedTags (결과 0건 & type=all) ───────────────────────────────────────
  let suggestedTags: string[] | undefined;
  if (totalItems === 0 && type === "all") {
    suggestedTags = await getPopularTags(5);
  }

  // ── 병합 + 재정렬 ─────────────────────────────────────────────────────────────
  const allRaw: Array<{ item: SearchResultItem; score: number }> = [];

  for (const r of normalizedPosts) {
    allRaw.push({
      score: r.score,
      item: {
        type: "post",
        id: r.id,
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        board: r.board,
        authorNickname: r.authorNickname,
        tags: [],
        createdAt: r.createdAt.toISOString(),
        viewCount: r.viewCount,
        commentCount: 0,
        score: r.score,
      },
    });
  }

  for (const r of normalizedQuestions) {
    allRaw.push({
      score: r.score,
      item: {
        type: "question",
        id: r.id,
        slug: r.slug,
        title: r.title,
        summary: null,
        isResolved: r.isResolved,
        authorNickname: r.authorNickname,
        tags: [],
        createdAt: r.createdAt.toISOString(),
        commentCount: 0,
        score: r.score,
      },
    });
  }

  for (const r of normalizedResources) {
    allRaw.push({
      score: r.score,
      item: {
        type: "resource",
        id: r.id,
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        resourceType: r.resourceType,
        authorNickname: r.authorNickname,
        tags: [],
        createdAt: r.createdAt.toISOString(),
        downloadCount: r.downloadCount,
        score: r.score,
      },
    });
  }

  // score DESC 재정렬
  allRaw.sort((a, b) => b.score - a.score);

  // ── 페이지네이션 ───────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const offset = (page - 1) * pageSize;
  const pageItems = allRaw.slice(offset, offset + pageSize);

  // ── 태그 배치 조회 (N+1 방지) ─────────────────────────────────────────────────
  const pagePostIds = pageItems
    .filter((x) => x.item.type === "post")
    .map((x) => x.item.id);
  const pageQuestionIds = pageItems
    .filter((x) => x.item.type === "question")
    .map((x) => x.item.id);
  const pageResourceIds = pageItems
    .filter((x) => x.item.type === "resource")
    .map((x) => x.item.id);

  // commentCount 배치 조회 (현재 0 고정, Epic 5 이후 활성화)
  const [postTagMap, questionTagMap, resourceTagMap, postCommentMap, questionCommentMap] =
    await Promise.all([
      fetchTagsForIds(pagePostIds, "post"),
      fetchTagsForIds(pageQuestionIds, "question"),
      fetchTagsForIds(pageResourceIds, "resource"),
      fetchCommentCounts(pagePostIds, "post"),
      fetchCommentCounts(pageQuestionIds, "question"),
    ]);

  // ── 최종 아이템 조립 (태그 + commentCount 주입) ────────────────────────────────
  const items: SearchResultItem[] = pageItems.map(({ item }) => {
    if (item.type === "post") {
      return {
        ...item,
        tags: postTagMap[item.id] ?? [],
        commentCount: postCommentMap[item.id] ?? 0,
      };
    }
    if (item.type === "question") {
      return {
        ...item,
        tags: questionTagMap[item.id] ?? [],
        commentCount: questionCommentMap[item.id] ?? 0,
      };
    }
    // resource
    return {
      ...item,
      tags: resourceTagMap[item.id] ?? [],
    };
  });

  return {
    items,
    meta: { page, pageSize, totalItems, totalPages },
    byType,
    ...(suggestedTags !== undefined ? { suggestedTags } : {}),
  };
}

/**
 * 태그 서비스 — Story 8.3
 *
 * getTagContent: 태그별 콘텐츠 통합 조회 (post / question / resource)
 * getPopularTags: 사용 횟수 기준 인기 태그 목록
 *
 * DB 접근은 반드시 이 서비스 레이어에서만. route handler 직접 쿼리 금지.
 * taggables 다형 참조: target_type = 'post' | 'question' | 'resource'
 * soft-delete 필터: status = 'published' AND deleted_at IS NULL 필수
 */

import { getDb, schema } from "@ai-jakdang/database";
import type {
  TagContentResponse,
  TagContentItem,
  PopularTagsResponse,
} from "@ai-jakdang/contracts/tag";
import { sql } from "drizzle-orm";

export interface GetTagContentParams {
  tagName: string;
  type: "all" | "post" | "question" | "resource";
  sort: "latest" | "popular";
  page: number;
  pageSize: number;
}

/**
 * 태그별 콘텐츠를 통합 조회한다.
 *
 * 1. 태그 존재 여부 확인 (LOWER 대소문자 무감)
 * 2. 타입별 전체 카운트 쿼리 (필터 무관)
 * 3. 콘텐츠 쿼리: UNION ALL SQL로 병합 후 정렬·페이지네이션
 *
 * @returns TagContentResponse 또는 null (태그 미존재)
 */
export async function getTagContent(
  params: GetTagContentParams,
): Promise<TagContentResponse | null> {
  const { tagName, type, sort, page, pageSize } = params;
  const db = getDb();
  const offset = (page - 1) * pageSize;

  // ── 1. 태그 존재 확인 ────────────────────────────────────────────────────────
  const tagRows = await db
    .select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.tags)
    .where(sql`LOWER(${schema.tags.name}) = LOWER(${tagName})`)
    .limit(1);

  if (tagRows.length === 0) {
    return null;
  }

  const tag = tagRows[0]!;
  const tagId = tag.id;

  // ── 2. 타입별 전체 카운트 (필터 무관) ────────────────────────────────────────
  // taggable.target_type 기준으로 GROUP BY 집계
  const countRows = await db.execute<{ target_type: string; cnt: string }>(sql`
    SELECT t.target_type, COUNT(*) AS cnt
    FROM taggable t
    WHERE t.tag_id = ${tagId}
    GROUP BY t.target_type
  `);

  let postCount = 0;
  let questionCount = 0;
  let resourceCount = 0;

  for (const row of countRows.rows) {
    const n = parseInt(String(row.cnt), 10);
    if (row.target_type === "post") postCount = n;
    else if (row.target_type === "question") questionCount = n;
    else if (row.target_type === "resource") resourceCount = n;
  }

  const totalCount = postCount + questionCount + resourceCount;

  // ── 3. 콘텐츠 쿼리 ─────────────────────────────────────────────────────────
  const orderClause =
    sort === "popular" ? "ORDER BY sort_score DESC, created_at DESC" : "ORDER BY created_at DESC";

  // 각 유형의 CTE 쿼리 (UNION ALL 방식)
  const postCte = `
    SELECT
      'post'::text AS type,
      p.id::text AS id,
      p.slug AS slug,
      p.title AS title,
      p.summary AS summary,
      u.nickname AS author_nickname,
      p.created_at::text AS created_at,
      p.view_count AS view_count,
      0 AS comment_count,
      p.board AS extra1,
      NULL::text AS extra2,
      FALSE AS extra3,
      (p.view_count)::bigint AS sort_score
    FROM posts p
    JOIN taggable tg ON tg.target_id = p.id AND tg.target_type = 'post'
    LEFT JOIN users u ON u.id = p.user_id
    WHERE tg.tag_id = '${tagId}'
      AND p.status = 'published'
      AND p.deleted_at IS NULL
  `;

  const questionCte = `
    SELECT
      'question'::text AS type,
      q.id::text AS id,
      q.slug AS slug,
      q.title AS title,
      NULL::varchar AS summary,
      u.nickname AS author_nickname,
      q.created_at::text AS created_at,
      q.view_count AS view_count,
      0 AS comment_count,
      NULL::text AS extra1,
      NULL::text AS extra2,
      q.is_resolved AS extra3,
      (q.view_count)::bigint AS sort_score
    FROM questions q
    JOIN taggable tg ON tg.target_id = q.id AND tg.target_type = 'question'
    LEFT JOIN users u ON u.id = q.user_id
    WHERE tg.tag_id = '${tagId}'
      AND q.status = 'published'
      AND q.deleted_at IS NULL
  `;

  const resourceCte = `
    SELECT
      'resource'::text AS type,
      r.id::text AS id,
      r.slug AS slug,
      r.title AS title,
      r.summary AS summary,
      u.nickname AS author_nickname,
      r.created_at::text AS created_at,
      r.view_count AS view_count,
      0 AS comment_count,
      r.resource_type::text AS extra1,
      NULL::text AS extra2,
      FALSE AS extra3,
      (r.view_count + r.download_count)::bigint AS sort_score
    FROM resources r
    JOIN taggable tg ON tg.target_id = r.id AND tg.target_type = 'resource'
    LEFT JOIN users u ON u.id = r.user_id
    WHERE tg.tag_id = '${tagId}'
      AND r.status = 'published'
      AND r.deleted_at IS NULL
  `;

  // type 필터에 따라 UNION ALL 구성
  let unionParts: string[] = [];
  if (type === "all" || type === "post") unionParts.push(postCte);
  if (type === "all" || type === "question") unionParts.push(questionCte);
  if (type === "all" || type === "resource") unionParts.push(resourceCte);

  const unionSql = unionParts.join("\nUNION ALL\n");

  // 총 건수 (필터 적용 후)
  const totalItemsResult = await db.execute<{ total: string }>(sql.raw(`
    SELECT COUNT(*) AS total FROM (
      ${unionSql}
    ) AS combined
  `));
  const totalItems = parseInt(String(totalItemsResult.rows[0]?.total ?? "0"), 10);
  const totalPages = Math.ceil(totalItems / pageSize);

  // 실제 아이템 조회
  const itemRows = await db.execute<{
    type: string;
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    author_nickname: string | null;
    created_at: string;
    view_count: number;
    comment_count: number;
    extra1: string | null;
    extra2: string | null;
    extra3: boolean;
  }>(sql.raw(`
    SELECT * FROM (
      ${unionSql}
    ) AS combined
    ${orderClause}
    LIMIT ${pageSize} OFFSET ${offset}
  `));

  // 행 → TagContentItem 변환
  const items: TagContentItem[] = itemRows.rows.map((row) => {
    if (row.type === "post") {
      return {
        type: "post",
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        authorNickname: row.author_nickname,
        createdAt: row.created_at,
        viewCount: Number(row.view_count),
        commentCount: Number(row.comment_count),
        board: row.extra1 ?? "",
      };
    } else if (row.type === "question") {
      return {
        type: "question",
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        authorNickname: row.author_nickname,
        createdAt: row.created_at,
        viewCount: Number(row.view_count),
        commentCount: Number(row.comment_count),
        isResolved: Boolean(row.extra3),
      };
    } else {
      return {
        type: "resource",
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        authorNickname: row.author_nickname,
        createdAt: row.created_at,
        viewCount: Number(row.view_count),
        commentCount: Number(row.comment_count),
        resourceType: row.extra1 ?? "",
      };
    }
  });

  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
    tag: {
      name: tag.name,
      postCount,
      questionCount,
      resourceCount,
      totalCount,
    },
  };
}

/**
 * 인기 태그 목록을 반환한다.
 * taggable 테이블에서 사용 횟수를 집계하여 내림차순 정렬.
 *
 * @param limit - 반환할 태그 수 (기본값 20)
 */
export async function getPopularTags(limit = 20): Promise<PopularTagsResponse> {
  const db = getDb();

  const rows = await db.execute<{ name: string; slug: string; usage_count: string }>(sql`
    SELECT
      tg.name,
      tg.slug,
      COUNT(tb.tag_id)::integer AS usage_count
    FROM tags tg
    LEFT JOIN taggable tb ON tb.tag_id = tg.id
    GROUP BY tg.id, tg.name, tg.slug
    ORDER BY usage_count DESC, tg.name ASC
    LIMIT ${limit}
  `);

  return {
    items: rows.rows.map((row) => ({
      name: row.name,
      slug: row.slug,
      usageCount: parseInt(String(row.usage_count), 10),
    })),
  };
}

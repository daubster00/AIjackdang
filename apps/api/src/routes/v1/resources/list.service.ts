/**
 * 실전자료 목록 서비스 — Story 4.2
 *
 * GET /api/v1/resources 목록 조회 로직.
 * DB 접근은 이 service 레이어에서만. route handler에서 직접 쿼리 금지.
 *
 * commentCount: Epic 5(댓글 도메인) 활성화 전까지 항상 0 반환.
 * tag: taggable 다형 테이블 JOIN (post와 동일 패턴, targetType='resource').
 * N+1 방지: users LEFT JOIN + tags 배치 inArray 쿼리.
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { ResourceCard, ListResourcesQuery } from "@ai-jakdang/contracts";
import { eq, and, isNull, desc, count, inArray } from "drizzle-orm";

export interface ListResourcesResult {
  items: ResourceCard[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * published 실전자료 목록을 페이지네이션 + 정렬하여 반환한다.
 *
 * - status = 'published' AND deleted_at IS NULL 필터 필수
 * - type / environment / difficulty 선택 필터
 * - 작성자 닉네임·avatarIndex: LEFT JOIN users (탈퇴 회원 → null)
 * - 태그: taggable + tags 배치 inArray 쿼리 (N+1 방지)
 * - commentCount: Epic 5 이전 0 고정
 */
export async function listResources(query: ListResourcesQuery): Promise<ListResourcesResult> {
  const { type, environment, difficulty, sort = "latest", page = 1, pageSize = 20 } = query;

  const db = getDb();
  const offset = (page - 1) * pageSize;

  // ── WHERE 조건 ────────────────────────────────────────────────────────────────
  const conditions = [
    eq(schema.resources.status, "published"),
    isNull(schema.resources.deletedAt),
  ];

  if (type) {
    conditions.push(eq(schema.resources.resourceType, type));
  }

  if (difficulty) {
    conditions.push(eq(schema.resources.difficulty, difficulty));
  }

  // environment 필터: PostgreSQL array에서 ANY() 매칭
  // Drizzle 0.38에서 arrayContains 지원 → 단일 환경 문자열로 필터
  // (복수 선택 시 OR 조합, 현재 쿼리 스키마는 단일 string)
  if (environment) {
    // PostgreSQL: environment @> ARRAY[environment]::text[]
    // Drizzle sql 템플릿 활용
    const { sql } = await import("drizzle-orm");
    conditions.push(
      sql`${schema.resources.environment} @> ARRAY[${environment}]::text[]`,
    );
  }

  const whereCondition = and(...conditions);

  // ── 총 개수 쿼리 ──────────────────────────────────────────────────────────────
  const [countRow] = await db
    .select({ total: count() })
    .from(schema.resources)
    .where(whereCondition);

  const totalItems = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // ── 정렬 컬럼 결정 ────────────────────────────────────────────────────────────
  let orderByClause;
  switch (sort) {
    case "popular":
      // 다운로드 수 기반 인기순
      orderByClause = desc(schema.resources.downloadCount);
      break;
    case "rating":
      orderByClause = desc(schema.resources.avgRating);
      break;
    case "downloads":
      orderByClause = desc(schema.resources.downloadCount);
      break;
    case "reviews":
      // Epic 5 이전: reviews(commentCount)는 0 고정 → createdAt DESC 폴백
      orderByClause = desc(schema.resources.createdAt);
      break;
    case "latest":
    default:
      orderByClause = desc(schema.resources.updatedAt);
      break;
  }

  // ── 자료 목록 + 작성자 LEFT JOIN ──────────────────────────────────────────────
  const rows = await db
    .select({
      id: schema.resources.id,
      slug: schema.resources.slug,
      title: schema.resources.title,
      summary: schema.resources.summary,
      resourceType: schema.resources.resourceType,
      environment: schema.resources.environment,
      difficulty: schema.resources.difficulty,
      avgRating: schema.resources.avgRating,
      ratingCount: schema.resources.ratingCount,
      downloadCount: schema.resources.downloadCount,
      updatedAt: schema.resources.updatedAt,
      status: schema.resources.status,
      // 작성자 정보 (탈퇴 시 null)
      authorId: schema.resources.userId,
      authorNickname: schema.users.nickname,
      authorAvatarIndex: schema.users.defaultAvatarIndex,
    })
    .from(schema.resources)
    .leftJoin(schema.users, eq(schema.resources.userId, schema.users.id))
    .where(whereCondition)
    .orderBy(orderByClause)
    .limit(pageSize)
    .offset(offset);

  if (rows.length === 0) {
    return {
      items: [],
      meta: { page, pageSize, totalItems, totalPages },
    };
  }

  // ── 태그 배치 쿼리 (N+1 방지) ─────────────────────────────────────────────────
  const resourceIds = rows.map((r) => r.id);

  const taggableRows = await db
    .select({
      targetId: schema.taggable.targetId,
      tagName: schema.tags.name,
    })
    .from(schema.taggable)
    .innerJoin(schema.tags, eq(schema.taggable.tagId, schema.tags.id))
    .where(
      and(
        eq(schema.taggable.targetType, "resource"),
        inArray(schema.taggable.targetId, resourceIds),
      ),
    );

  // resourceId → 태그명 배열 맵
  const tagMap = new Map<string, string[]>();
  for (const { targetId, tagName } of taggableRows) {
    const existing = tagMap.get(targetId) ?? [];
    existing.push(tagName);
    tagMap.set(targetId, existing);
  }

  // ── ResourceCard 조립 ─────────────────────────────────────────────────────────
  const items: ResourceCard[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    resourceType: row.resourceType,
    environment: row.environment ?? [],
    difficulty: row.difficulty,
    authorId: row.authorId ?? null,
    authorNickname: row.authorNickname ?? null,
    authorAvatarIndex: row.authorAvatarIndex ?? 0, // defaultAvatarIndex: integer not null default 0
    avgRating: typeof row.avgRating === "string" ? parseFloat(row.avgRating) : (row.avgRating ?? 0),
    ratingCount: row.ratingCount,
    downloadCount: row.downloadCount,
    commentCount: 0, // TODO: Epic 5 활성화 전 항상 0 반환
    tagNames: tagMap.get(row.id) ?? [],
    updatedAt: row.updatedAt.toISOString(),
    status: row.status,
  }));

  return {
    items,
    meta: { page, pageSize, totalItems, totalPages },
  };
}

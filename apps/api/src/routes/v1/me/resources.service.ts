/**
 * 마이페이지 내 자료 목록 서비스 — Story 4.9
 *
 * GET /api/v1/me/resources 비즈니스 로직.
 * 본인 자료만 반환: draft + published + hidden 포함, deleted 제외.
 * hiddenReason: DB 컬럼이 아직 없으므로 현재 null 고정 (Epic 4 운영자 기능 확장 시 추가).
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { MyResourceCard, ListMyResourcesQuery } from "@ai-jakdang/contracts";
import { eq, and, ne, isNull, desc, count } from "drizzle-orm";

export interface ListMyResourcesResult {
  items: MyResourceCard[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * 본인 자료 목록을 페이지네이션하여 반환한다.
 *
 * - status != 'deleted' AND deleted_at IS NULL 필터 (soft-delete 기준)
 * - userId 소유권 필수 (타인 자료 절대 포함 금지)
 * - 최신순(createdAt DESC) 정렬 고정
 */
export async function listMyResources(
  userId: string,
  query: ListMyResourcesQuery,
): Promise<ListMyResourcesResult> {
  const { page = 1, pageSize = 20 } = query;
  const db = getDb();
  const offset = (page - 1) * pageSize;

  // ── WHERE 조건 ────────────────────────────────────────────────────────────────
  const whereCondition = and(
    eq(schema.resources.userId, userId),
    ne(schema.resources.status, "deleted"),
    isNull(schema.resources.deletedAt),
  );

  // ── 총 개수 ──────────────────────────────────────────────────────────────────
  const [countRow] = await db
    .select({ total: count() })
    .from(schema.resources)
    .where(whereCondition);

  const totalItems = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // ── 목록 쿼리 ────────────────────────────────────────────────────────────────
  const rows = await db
    .select({
      id: schema.resources.id,
      slug: schema.resources.slug,
      title: schema.resources.title,
      resourceType: schema.resources.resourceType,
      status: schema.resources.status,
      downloadCount: schema.resources.downloadCount,
      avgRating: schema.resources.avgRating,
      ratingCount: schema.resources.ratingCount,
      createdAt: schema.resources.createdAt,
      updatedAt: schema.resources.updatedAt,
    })
    .from(schema.resources)
    .where(whereCondition)
    .orderBy(desc(schema.resources.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items: MyResourceCard[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    resourceType: row.resourceType,
    status: row.status,
    /**
     * hiddenReason: DB 컬럼 미존재 — 현재 null 반환.
     * Epic 4 운영자 숨김 기능(resources.hidden_reason 컬럼) 추가 시 여기서 참조.
     */
    hiddenReason: null,
    downloadCount: row.downloadCount,
    avgRating: Number(row.avgRating),
    ratingCount: row.ratingCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

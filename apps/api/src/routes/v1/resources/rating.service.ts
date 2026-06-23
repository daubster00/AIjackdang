/**
 * 평점 서비스 — Story 4.7
 *
 * upsertRating: 평점 등록·수정(upsert) + avg_rating·rating_count 재집계 (트랜잭션).
 * getMyRating: 현재 로그인 회원의 기존 평점 조회.
 *
 * 아키텍처 가드레일 (AR-2, AR-12):
 * - ratings upsert + resources 재계산은 단일 db.transaction() 내 원자적 실행.
 * - 본인 자료 평점 불가 (resource.userId === userId → 403 SELF_RATING_NOT_ALLOWED).
 */

import { eq, sql, and } from "drizzle-orm";
import { getDb, schema } from "@ai-jakdang/database";

export class RatingServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RatingServiceError";
  }
}

export interface UpsertRatingResult {
  id: string;
  resourceId: string;
  userId: string;
  score: number;
  createdAt: string;
  updatedAt: string;
  avgRating: number;
  ratingCount: number;
}

/**
 * 평점 등록·수정 (upsert).
 *
 * 1. resource 조회 (없으면 404 → RatingServiceError RESOURCE_NOT_FOUND)
 * 2. 본인 자료 확인: resource.userId === userId → 403 SELF_RATING_NOT_ALLOWED (AR-12)
 * 3. db.transaction():
 *    a. ratings upsert (onConflict: resource_id+user_id → score, updatedAt 갱신)
 *    b. resources.avg_rating, resources.rating_count 재계산 (서브쿼리)
 * 4. 갱신된 avg_rating, rating_count 반환
 */
export async function upsertRating(
  resourceId: string,
  userId: string,
  score: number,
): Promise<UpsertRatingResult> {
  const db = getDb();

  // 1. resource 존재 확인
  const resourceRows = await db
    .select({
      id: schema.resources.id,
      userId: schema.resources.userId,
    })
    .from(schema.resources)
    .where(eq(schema.resources.id, resourceId))
    .limit(1);

  if (resourceRows.length === 0) {
    throw new RatingServiceError("RESOURCE_NOT_FOUND", "자료를 찾을 수 없습니다.");
  }

  const resource = resourceRows[0];

  // 2. 본인 자료 평점 방지 (AR-12)
  if (resource.userId && resource.userId === userId) {
    throw new RatingServiceError(
      "SELF_RATING_NOT_ALLOWED",
      "본인이 등록한 자료에는 평점을 줄 수 없습니다.",
    );
  }

  // 3. 트랜잭션: upsert + 재집계
  const result = await db.transaction(async (tx) => {
    // 3a. ratings upsert
    const [upsertedRating] = await tx
      .insert(schema.ratings)
      .values({
        resourceId,
        userId,
        score,
      })
      .onConflictDoUpdate({
        target: [schema.ratings.resourceId, schema.ratings.userId],
        set: {
          score,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: schema.ratings.id,
        resourceId: schema.ratings.resourceId,
        userId: schema.ratings.userId,
        score: schema.ratings.score,
        createdAt: schema.ratings.createdAt,
        updatedAt: schema.ratings.updatedAt,
      });

    // 3b. resources.avg_rating, resources.rating_count 재계산 (서브쿼리)
    const [updatedResource] = await tx
      .update(schema.resources)
      .set({
        avgRating: sql`(SELECT AVG(score)::numeric(3,2) FROM ${schema.ratings} WHERE resource_id = ${resourceId})`,
        ratingCount: sql`(SELECT COUNT(*)::int FROM ${schema.ratings} WHERE resource_id = ${resourceId})`,
        updatedAt: new Date(),
      })
      .where(eq(schema.resources.id, resourceId))
      .returning({
        avgRating: schema.resources.avgRating,
        ratingCount: schema.resources.ratingCount,
      });

    return { upsertedRating, updatedResource };
  });

  const { upsertedRating, updatedResource } = result;
  const avgRatingNum =
    updatedResource.avgRating != null ? parseFloat(String(updatedResource.avgRating)) : 0;

  return {
    id: upsertedRating.id,
    resourceId: upsertedRating.resourceId,
    userId: upsertedRating.userId ?? userId,
    score: upsertedRating.score,
    createdAt: upsertedRating.createdAt.toISOString(),
    updatedAt: upsertedRating.updatedAt.toISOString(),
    avgRating: avgRatingNum,
    ratingCount: updatedResource.ratingCount,
  };
}

/**
 * 현재 로그인 회원의 기존 평점 조회.
 *
 * - ratings where resource_id=resourceId AND user_id=userId 조회
 * - 없으면 null 반환 (404 아님)
 */
export async function getMyRating(
  resourceId: string,
  userId: string,
): Promise<{ id: string; score: number; createdAt: string; updatedAt: string } | null> {
  const db = getDb();

  const rows = await db
    .select({
      id: schema.ratings.id,
      score: schema.ratings.score,
      createdAt: schema.ratings.createdAt,
      updatedAt: schema.ratings.updatedAt,
    })
    .from(schema.ratings)
    .where(
      and(
        eq(schema.ratings.resourceId, resourceId),
        eq(schema.ratings.userId, userId),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    score: row.score,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

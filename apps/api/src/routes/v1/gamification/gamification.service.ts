/**
 * 게이미피케이션 서비스 — Story 6.3
 *
 * getUserGrade(db, userId): 유저의 누적 포인트 + 현재 등급 + 다음 등급 + 잔여 포인트 반환.
 *
 * 설계 원칙:
 * - core 순수 함수(gradeForPoints, nextGrade, pointsToNextGrade)를 주입 방식으로 호출
 * - grades 배열은 이 함수에서 1회 조회 (N+1 방지)
 * - DB 접근은 apps/api 에서만
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as dbSchema from "@ai-jakdang/database";
import { schema } from "@ai-jakdang/database";
import { gradeForPoints, nextGrade, pointsToNextGrade, rankingWindowDates, computeRanking } from "@ai-jakdang/core";
import type { GradeRow } from "@ai-jakdang/core";
import type { GamificationPeriodType, RankingResponse } from "@ai-jakdang/contracts";
import { rankingResponseSchema } from "@ai-jakdang/contracts";
import { eq, sql, inArray } from "drizzle-orm";
import { getApiRedis } from "../../../lib/redis.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = NodePgDatabase<typeof dbSchema.schema> | any;

// ── 응답 타입 ─────────────────────────────────────────────────────────────────

export interface GradeInfo {
  level: number;
  name: string;
}

export interface UserGradeResult {
  totalPoints: number;
  grade: GradeInfo;
  nextGrade: GradeInfo | null;
  pointsToNext: number | null;
}

// ── grades 조회 헬퍼 ──────────────────────────────────────────────────────────

/**
 * grades 테이블 전체를 조회한다 (5행, 변동 빈도 매우 낮음).
 * 호출자에서 캐싱 처리 가능; 지금은 직접 DB 조회.
 */
async function fetchGrades(db: DbLike): Promise<GradeRow[]> {
  const rows = await db
    .select({
      id: schema.grades.id,
      level: schema.grades.level,
      name: schema.grades.name,
      minPoints: schema.grades.minPoints,
      maxPoints: schema.grades.maxPoints,
    })
    .from(schema.grades);

  return rows as GradeRow[];
}

// ── getUserGrade ──────────────────────────────────────────────────────────────

/**
 * 유저의 누적 포인트와 현재 등급 정보를 반환한다.
 *
 * 1. points_ledger SUM(delta) WHERE user_id = userId → totalPoints
 * 2. grades 전체 조회 (5행)
 * 3. gradeForPoints(totalPoints, grades) → 현재 등급
 * 4. nextGrade / pointsToNextGrade 계산
 */
export async function getUserGrade(db: DbLike, userId: string): Promise<UserGradeResult> {
  // ── 1. 누적 포인트 조회 ────────────────────────────────────────────────────
  const sumRows = await db
    .select({
      total: sql<number>`coalesce(cast(sum(${schema.pointsLedger.delta}) as int), 0)`,
    })
    .from(schema.pointsLedger)
    .where(eq(schema.pointsLedger.userId, userId));

  const totalPoints = sumRows[0]?.total ?? 0;

  // ── 2. grades 전체 조회 ───────────────────────────────────────────────────
  const gradeRows = await fetchGrades(db);

  if (gradeRows.length === 0) {
    // grades 테이블이 비어 있는 경우 (시드 미실행 등) 안전 fallback
    return {
      totalPoints,
      grade: { level: 1, name: "새내기" },
      nextGrade: null,
      pointsToNext: null,
    };
  }

  // ── 3. 현재 등급 도출 ─────────────────────────────────────────────────────
  const currentGrade = gradeForPoints(totalPoints, gradeRows);
  const next = nextGrade(currentGrade, gradeRows);
  const toNext = pointsToNextGrade(totalPoints, gradeRows);

  return {
    totalPoints,
    grade: {
      level: currentGrade.level,
      name: currentGrade.name,
    },
    nextGrade: next
      ? { level: next.level, name: next.name }
      : null,
    pointsToNext: toNext,
  };
}

// ── fetchGrades re-export (points.service.ts 에서 재사용 가능) ────────────────

export { fetchGrades };

// ── [6.5] getRanking ──────────────────────────────────────────────────────────

/** 랭킹 응답 내 각 항목 타입 */
export interface RankItemResult {
  rank: number;
  userId: string;
  nickname: string;
  gradeLevel: number;
  gradeName: string;
  totalDelta: number;
}

/** getRanking 응답 타입 */
export interface RankingResult {
  period: GamificationPeriodType;
  items: RankItemResult[];
  generatedAt: string;
}

/**
 * 랭킹을 조회한다. Redis 캐시 hit → 반환, miss → DB 즉석 계산 후 Redis 저장 + 반환.
 *
 * 1. Redis ranking:{period} 조회
 * 2. hit: 파싱 후 limit 적용 반환
 * 3. miss: DB points_ledger 집계 → computeRanking(10) → 사용자 프로필 배치 조회 → Redis SET EX 3600 → 반환
 *
 * @param db - Drizzle DB 인스턴스 (apps/api getDb())
 * @param period - 'weekly' | 'monthly'
 * @param limit - 반환 건수 (1~10, 기본 10)
 */
export async function getRanking(
  db: DbLike,
  period: GamificationPeriodType,
  limit: number = 10,
): Promise<RankingResult> {
  const redis = getApiRedis();
  const cacheKey = `ranking:${period}`;

  // ── 1. Redis 캐시 조회 ────────────────────────────────────────────────────────
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = rankingResponseSchema.safeParse(JSON.parse(cached));
      if (parsed.success) {
        return {
          period: parsed.data.period,
          items: parsed.data.items.slice(0, limit),
          generatedAt: parsed.data.generatedAt,
        };
      }
    }
  } catch (err) {
    console.warn("[gamification.service] Redis 캐시 조회 실패 (무시):", (err as Error).message);
  }

  // ── 2. 캐시 miss: DB 즉석 계산 ───────────────────────────────────────────────
  const now = new Date();
  const { start, end } = rankingWindowDates(period, now);

  // 기간 내 userId별 포인트 합산 (delta > 0만)
  const ledgerRows = await db
    .select({
      userId: schema.pointsLedger.userId,
      delta: sql<number>`cast(sum(${schema.pointsLedger.delta}) as int)`,
    })
    .from(schema.pointsLedger)
    .where(
      sql`${schema.pointsLedger.createdAt} >= ${start.toISOString()}
        AND ${schema.pointsLedger.createdAt} <= ${end.toISOString()}
        AND ${schema.pointsLedger.delta} > 0`,
    )
    .groupBy(schema.pointsLedger.userId);

  // computeRanking으로 TOP 10 산출
  const top10 = computeRanking(
    ledgerRows.map((r: { userId: string; delta: number }) => ({ userId: r.userId, delta: r.delta })),
    10,
  );

  let items: RankItemResult[] = [];

  if (top10.length > 0) {
    const userIds = top10.map((e) => e.userId);

    // ── users.nickname 배치 조회 ─────────────────────────────────────────────
    const usersRows = await db
      .select({
        id: schema.users.id,
        nickname: schema.users.nickname,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, userIds));

    const nicknameMap = new Map<string, string>(
      usersRows.map((r: { id: string; nickname: string }) => [r.id, r.nickname] as [string, string]),
    );

    // ── userId별 누적 총 포인트 배치 조회 (등급 결정용) ──────────────────────
    const totalPointsRows = await db
      .select({
        userId: schema.pointsLedger.userId,
        total: sql<number>`cast(coalesce(sum(${schema.pointsLedger.delta}), 0) as int)`,
      })
      .from(schema.pointsLedger)
      .where(inArray(schema.pointsLedger.userId, userIds))
      .groupBy(schema.pointsLedger.userId);

    const totalPointsMap = new Map<string, number>(
      totalPointsRows.map((r: { userId: string; total: number }) => [r.userId, r.total] as [string, number]),
    );

    // ── grades 전체 조회 ─────────────────────────────────────────────────────
    const gradeRows = await fetchGrades(db);

    // ── RankItemResult[] 구성 ────────────────────────────────────────────────
    items = top10.map((entry) => {
      const nickname = nicknameMap.get(entry.userId) ?? "(탈퇴회원)";
      const totalPoints = totalPointsMap.get(entry.userId) ?? 0;
      const currentGrade =
        gradeRows.length > 0
          ? gradeForPoints(totalPoints, gradeRows)
          : { level: 1, name: "새내기" };

      return {
        rank: entry.rank,
        userId: entry.userId,
        nickname,
        gradeLevel: currentGrade.level,
        gradeName: currentGrade.name,
        totalDelta: entry.totalDelta,
      };
    });
  }

  const result: RankingResponse = {
    period,
    items: items.map((item) => ({
      rank: item.rank,
      userId: item.userId,
      nickname: item.nickname,
      gradeLevel: item.gradeLevel,
      gradeName: item.gradeName,
      totalDelta: item.totalDelta,
    })),
    generatedAt: now.toISOString(),
  };

  // ── 3. Redis에 저장 (항상 10개 저장, TTL 1h) ────────────────────────────────
  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", 3600);
  } catch (err) {
    console.warn("[gamification.service] Redis 캐시 저장 실패 (무시):", (err as Error).message);
  }

  return {
    period,
    items: result.items.slice(0, limit),
    generatedAt: result.generatedAt,
  };
}

// ── [6.5] END ─────────────────────────────────────────────────────────────────

// ── [6.4] getUserBadges ───────────────────────────────────────────────────────

/** 보유 뱃지 단건 응답 타입 (AC#4) */
export interface UserBadgeItem {
  badgeSlug: string;
  badgeName: string;
  iconUrl: string;
  grantedAt: string;
}

/** getUserBadges 응답 타입 (AC#4, AC#7: 미보유·달성조건 노출 금지) */
export interface UserBadgesResult {
  items: UserBadgeItem[];
}

/**
 * 사용자의 보유 뱃지 목록을 반환한다.
 *
 * - user_badges JOIN badges 쿼리
 * - 보유 뱃지만 반환 (미보유·달성조건 절대 노출 금지 — AC#7)
 * - 비회원 열람 가능 (공개 프로필 SSR용 — AC#5)
 */
export async function getUserBadges(db: DbLike, userId: string): Promise<UserBadgesResult> {
  const rows = await db
    .select({
      badgeSlug: schema.badges.slug,
      badgeName: schema.badges.name,
      iconUrl: schema.badges.iconUrl,
      grantedAt: schema.userBadges.grantedAt,
    })
    .from(schema.userBadges)
    .innerJoin(schema.badges, eq(schema.userBadges.badgeId, schema.badges.id))
    .where(eq(schema.userBadges.userId, userId))
    .orderBy(schema.userBadges.grantedAt);

  return {
    items: rows.map((row: { badgeSlug: string; badgeName: string; iconUrl: string; grantedAt: Date | string }) => ({
      badgeSlug: row.badgeSlug,
      badgeName: row.badgeName,
      iconUrl: row.iconUrl,
      grantedAt: row.grantedAt instanceof Date ? row.grantedAt.toISOString() : String(row.grantedAt),
    })),
  };
}

// ── [6.4] END ─────────────────────────────────────────────────────────────────

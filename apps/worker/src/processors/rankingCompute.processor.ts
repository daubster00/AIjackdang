/**
 * rankingCompute.processor — Story 6.5
 *
 * BullMQ ranking 큐의 'ranking.compute' 잡 소비.
 *
 * 처리 흐름:
 * 1. period 수신 ('weekly' | 'monthly')
 * 2. rankingWindowDates(period, now) → { start, end }
 * 3. points_ledger에서 기간 내 userId별 SUM(delta) 집계 (delta > 0만)
 * 4. computeRanking(rows, 10) → TOP 10 RankEntry[]
 * 5. userId 배열로 users.nickname + 현재 grade 배치 조회 (inArray 2쿼리)
 * 6. RankEntry[]를 rankingResponseSchema 형태로 Redis SET (ranking:{period}, EX 3600)
 * 7. 멱등: 동일 period 재실행 시 동일 결과 (Redis 덮어쓰기)
 *
 * 설계 원칙:
 * - core 순수 함수(rankingWindowDates/computeRanking)를 주입 방식으로 호출
 * - N+1 방지: userId 배열 → inArray 단일 쿼리
 * - DB 접근은 worker 전용 pg Pool (apps/api getDb와 별도)
 */

// ── [6.5] rankingCompute.processor START ─────────────────────────────────────

import type { Job } from "bullmq";
import { Redis } from "ioredis";
import pg from "pg";
import { rankingWindowDates, computeRanking } from "@ai-jakdang/core";
import type { RankingComputeJobPayload } from "@ai-jakdang/contracts";

// ── DB 연결 (worker 전용) ──────────────────────────────────────────────────────
let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    const url =
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5433/ai_jakdang";
    _pool = new pg.Pool({ connectionString: url });
    _pool.on("error", (err) => {
      console.error("[rankingCompute.processor] DB pool 오류:", err.message);
    });
  }
  return _pool;
}

// ── Redis 연결 (랭킹 캐시 저장용) ─────────────────────────────────────────────
let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    _redis = new Redis(url, { maxRetriesPerRequest: null });
    _redis.on("error", (err) => {
      console.error("[rankingCompute.processor] Redis 오류:", err.message);
    });
  }
  return _redis;
}

// ── 집계 쿼리 ─────────────────────────────────────────────────────────────────

/**
 * 기간 내 userId별 포인트 합산 (delta > 0만, 어뷰징 차단은 업스트림에서 처리됨).
 */
async function fetchLedgerAggregates(
  start: Date,
  end: Date,
): Promise<Array<{ userId: string; delta: number }>> {
  const pool = getPool();
  const result = await pool.query<{ user_id: string; total: string }>(
    `SELECT user_id, SUM(delta)::int AS total
       FROM points_ledger
      WHERE created_at >= $1
        AND created_at <= $2
        AND delta > 0
      GROUP BY user_id`,
    [start.toISOString(), end.toISOString()],
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    delta: parseInt(row.total, 10),
  }));
}

/**
 * userId 배열로 users.nickname + 현재 grade 배치 조회 (N+1 방지).
 *
 * 현재 grade는 users.total_points 없음 — points_ledger SUM으로 산출해야 하나
 * 랭킹 컴퓨팅 시점에 이미 집계됐으므로 grades 테이블에서 포인트 기준으로 결정.
 * 단순화: users JOIN + grades 배치 조회 (각 user별 SUM은 이미 집계됨).
 *
 * 실제 구현: user별 총 포인트(기간 무관 전체)를 별도 쿼리 1개로 배치 조회
 * → grades와 range 비교로 등급 결정.
 */
async function fetchUserProfiles(
  userIds: string[],
): Promise<
  Map<string, { nickname: string; gradeLevel: number; gradeName: string }>
> {
  if (userIds.length === 0) return new Map();

  const pool = getPool();

  // ── 1. users.nickname 배치 조회 ─────────────────────────────────────────────
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(", ");
  const usersResult = await pool.query<{ id: string; nickname: string }>(
    `SELECT id, nickname
       FROM users
      WHERE id IN (${placeholders})`,
    userIds,
  );

  const nicknameMap = new Map<string, string>(
    usersResult.rows.map((r) => [r.id, r.nickname]),
  );

  // ── 2. userId별 누적 총 포인트 배치 조회 ────────────────────────────────────
  // (기간 무관 전체 원장 SUM — 현재 등급 결정용)
  const totalPointsResult = await pool.query<{ user_id: string; total: string }>(
    `SELECT user_id, COALESCE(SUM(delta), 0)::int AS total
       FROM points_ledger
      WHERE user_id IN (${placeholders})
      GROUP BY user_id`,
    userIds,
  );
  const totalPointsMap = new Map<string, number>(
    totalPointsResult.rows.map((r) => [r.user_id, parseInt(r.total, 10)]),
  );

  // ── 3. grades 전체 조회 (5행 고정) ──────────────────────────────────────────
  const gradesResult = await pool.query<{
    level: number;
    name: string;
    min_points: number;
    max_points: number | null;
  }>(
    `SELECT level, name, min_points, max_points
       FROM grades
      ORDER BY level ASC`,
  );
  const gradesSorted = gradesResult.rows;

  // ── 4. 각 userId의 등급 결정 ─────────────────────────────────────────────────
  function resolveGrade(
    totalPoints: number,
  ): { gradeLevel: number; gradeName: string } {
    let matched = gradesSorted[0] ?? { level: 1, name: "새내기" };
    for (const grade of gradesSorted) {
      if (totalPoints >= grade.min_points) {
        matched = grade;
      }
    }
    return { gradeLevel: matched.level, gradeName: matched.name };
  }

  const profileMap = new Map<
    string,
    { nickname: string; gradeLevel: number; gradeName: string }
  >();

  for (const userId of userIds) {
    const nickname = nicknameMap.get(userId) ?? "(탈퇴회원)";
    const totalPoints = totalPointsMap.get(userId) ?? 0;
    const { gradeLevel, gradeName } = resolveGrade(totalPoints);
    profileMap.set(userId, { nickname, gradeLevel, gradeName });
  }

  return profileMap;
}

// ── 프로세서 ─────────────────────────────────────────────────────────────────

/**
 * ranking.compute 잡 처리기.
 *
 * - 기간 경계 계산 → DB 집계 → TOP 10 산출 → Redis 캐시 저장
 * - 멱등: Redis SET으로 덮어쓰기 (재실행 안전)
 */
export async function rankingComputeProcessor(
  job: Job<RankingComputeJobPayload>,
): Promise<void> {
  const { period } = job.data;

  console.info(
    `[rankingCompute.processor] ranking.compute 잡 처리 시작: period=${period} jobId=${job.id}`,
  );

  // ── 1. 기간 경계 계산 ────────────────────────────────────────────────────────
  const now = new Date();
  const { start, end } = rankingWindowDates(period, now);

  console.info(`[rankingCompute.processor] 기간 경계:`, {
    period,
    start: start.toISOString(),
    end: end.toISOString(),
  });

  // ── 2. DB 집계 ───────────────────────────────────────────────────────────────
  const ledgerRows = await fetchLedgerAggregates(start, end);

  console.info(
    `[rankingCompute.processor] 집계 완료: ${ledgerRows.length}명 대상`,
  );

  if (ledgerRows.length === 0) {
    // 데이터 없음 — 빈 랭킹 캐시 저장 (TTL 동일 적용)
    const redis = getRedis();
    const cacheKey = `ranking:${period}`;
    const emptyResponse = {
      period,
      items: [],
      generatedAt: now.toISOString(),
    };
    await redis.set(cacheKey, JSON.stringify(emptyResponse), "EX", 3600);
    console.info(
      `[rankingCompute.processor] 데이터 없음 — 빈 랭킹 캐시 저장: ${cacheKey}`,
    );
    return;
  }

  // ── 3. TOP 10 산출 ───────────────────────────────────────────────────────────
  const top10 = computeRanking(ledgerRows, 10);

  console.info(`[rankingCompute.processor] TOP 10 산출 완료:`, {
    count: top10.length,
  });

  // ── 4. 사용자 프로필 배치 조회 ───────────────────────────────────────────────
  const userIds = top10.map((e) => e.userId);
  const profileMap = await fetchUserProfiles(userIds);

  // ── 5. RankEntry[] 구성 ──────────────────────────────────────────────────────
  const items = top10.map((entry) => {
    const profile = profileMap.get(entry.userId) ?? {
      nickname: "(탈퇴회원)",
      gradeLevel: 1,
      gradeName: "새내기",
    };
    return {
      rank: entry.rank,
      userId: entry.userId,
      nickname: profile.nickname,
      gradeLevel: profile.gradeLevel,
      gradeName: profile.gradeName,
      totalDelta: entry.totalDelta,
    };
  });

  // ── 6. Redis 캐시 저장 (EX 3600 = 1h) ───────────────────────────────────────
  const redis = getRedis();
  const cacheKey = `ranking:${period}`;
  const rankingResponse = {
    period,
    items,
    generatedAt: now.toISOString(),
  };

  await redis.set(cacheKey, JSON.stringify(rankingResponse), "EX", 3600);

  console.info(
    `[rankingCompute.processor] 처리 완료: period=${period} items=${items.length} cacheKey=${cacheKey}`,
  );
}

// ── [6.5] rankingCompute.processor END ───────────────────────────────────────

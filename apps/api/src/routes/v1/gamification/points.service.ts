/**
 * 포인트 서비스 — Story 6.2
 *
 * earnPoints  : 포인트 적립 (일일 상한 체크 + 멱등 체크)
 * revokePoints: 포인트 회수 (soft-delete 시 음수 delta insert)
 * getTodayCount: 오늘 특정 reason 적립 건수 조회
 *
 * 설계 원칙:
 * - DB 접근은 apps/api 에서만
 * - 트랜잭션 경계는 호출자(posts.service.ts 등)가 열어 전달 → earnPoints(db, ...) 는 db 파라미터 받아 참여
 * - 포인트 insert 실패(상한·멱등)는 콘텐츠 저장을 롤백시키지 않는다 (호출자가 try/catch 처리)
 * - 회수 실패(원본 없음)는 no-op
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as dbSchema from "@ai-jakdang/database";
import { schema } from "@ai-jakdang/database";
import { canEarnPoint, pointsForAction, gradeForPoints } from "@ai-jakdang/core";
import type { PointReason } from "@ai-jakdang/core";
import { eq, and, gt, sql, gte } from "drizzle-orm";
import { getRankingQueue, GRADE_UP_JOB_NAME } from "../../../lib/queues.js";
import { fetchGrades } from "./gamification.service.js";

// ── 공용 DB 타입 ────────────────────────────────────────────────────────────
// NodePgDatabase<schema> + 트랜잭션 객체 모두 같은 인터페이스를 공유한다.
// drizzle-orm node-postgres 트랜잭션 타입은 NodePgDatabase 와 동일한 메서드를 구현한다.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = NodePgDatabase<typeof dbSchema.schema> | any;

// ── 입력 타입 ────────────────────────────────────────────────────────────────

export interface EarnPointsParams {
  userId: string;
  reason: PointReason;
  sourceType: string;
  sourceId: string;
  todayCount: number;
}

export interface RevokePointsParams {
  userId: string;
  reason: PointReason;
  sourceType: string;
  sourceId: string;
}

// ── getTodayCount ─────────────────────────────────────────────────────────────

/**
 * 오늘 UTC 00:00:00 이후 해당 userId + reason 으로 적립된 행 수를 반환한다.
 * 호출자가 earnPoints 전에 호출해 todayCount 를 획득한다.
 */
export async function getTodayCount(
  db: DbLike,
  { userId, reason }: { userId: string; reason: PointReason },
): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const rows = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(schema.pointsLedger)
    .where(
      and(
        eq(schema.pointsLedger.userId, userId),
        eq(schema.pointsLedger.reason, reason),
        gt(schema.pointsLedger.delta, 0),
        gte(schema.pointsLedger.createdAt, todayStart),
      ),
    );

  return rows[0]?.count ?? 0;
}

// ── earnPoints ────────────────────────────────────────────────────────────────

/**
 * 포인트를 적립한다.
 *
 * 1. canEarnPoint({ reason, userId, todayCount }) → false 면 skip (일일 상한 초과)
 * 2. 멱등 체크: (user_id, reason, source_id) AND delta > 0 인 행이 이미 존재하면 skip
 * 3. 조건 통과 시 points_ledger INSERT
 *
 * @returns true = 실제 적립됨, false = skip(상한/멱등)
 */
export async function earnPoints(
  db: DbLike,
  { userId, reason, sourceType, sourceId, todayCount }: EarnPointsParams,
): Promise<boolean> {
  // ── 1. 일일 상한 체크 ──────────────────────────────────────────────────────
  if (!canEarnPoint({ reason, userId, todayCount })) {
    return false;
  }

  // ── 2. 멱등 체크: 동일 (userId, reason, sourceId) delta>0 행 존재 시 skip ──
  const existing = await db
    .select({ id: schema.pointsLedger.id })
    .from(schema.pointsLedger)
    .where(
      and(
        eq(schema.pointsLedger.userId, userId),
        eq(schema.pointsLedger.reason, reason),
        eq(schema.pointsLedger.sourceId, sourceId),
        gt(schema.pointsLedger.delta, 0),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return false; // 이미 적립됨
  }

  // ── 3. points_ledger INSERT ────────────────────────────────────────────────
  const delta = pointsForAction(reason);

  // insert 전 총점 조회 (등급 변동 감지용)
  const prevSumRows = await db
    .select({
      total: sql<number>`coalesce(cast(sum(${schema.pointsLedger.delta}) as int), 0)`,
    })
    .from(schema.pointsLedger)
    .where(eq(schema.pointsLedger.userId, userId));

  const prevTotal = prevSumRows[0]?.total ?? 0;

  await db
    .insert(schema.pointsLedger)
    .values({
      userId,
      delta,
      reason,
      sourceType,
      sourceId,
    });

  // ── 4. 등급 변동 감지 + 큐 enqueue (best-effort) ──────────────────────────
  try {
    const newTotal = prevTotal + delta;
    const gradeRows = await fetchGrades(db);

    if (gradeRows.length > 0) {
      const prevGrade = gradeForPoints(prevTotal, gradeRows);
      const newGrade = gradeForPoints(newTotal, gradeRows);

      if (prevGrade.level !== newGrade.level) {
        // 등급 변동 감지 → ranking 큐에 gamification.grade-up 잡 enqueue
        await getRankingQueue().add(GRADE_UP_JOB_NAME, {
          userId,
          prevLevel: prevGrade.level,
          newLevel: newGrade.level,
          newGradeName: newGrade.name,
        });
      }
    }
  } catch (err) {
    // 포인트 적립은 성공으로 유지 — 큐 enqueue 실패는 로그만 남김
    console.error("[points.service] 등급 변동 큐 enqueue 실패:", (err as Error).message);
  }

  return true;
}

// ── revokePoints ──────────────────────────────────────────────────────────────

/**
 * 포인트를 회수한다.
 *
 * 1. 원본 적립 행 조회 (동일 userId/reason/sourceId, delta > 0)
 * 2. 없으면 no-op
 * 3. 이미 회수된 경우 ({reason}.revoked 행 존재) no-op
 * 4. 원본 delta의 음수값으로 {reason}.revoked INSERT
 *
 * @returns true = 실제 회수됨, false = no-op
 */
export async function revokePoints(
  db: DbLike,
  { userId, reason, sourceType, sourceId }: RevokePointsParams,
): Promise<boolean> {
  const revokedReason = `${reason}.revoked`;

  // ── 1. 원본 적립 행 조회 ────────────────────────────────────────────────────
  const original = await db
    .select({ id: schema.pointsLedger.id, delta: schema.pointsLedger.delta })
    .from(schema.pointsLedger)
    .where(
      and(
        eq(schema.pointsLedger.userId, userId),
        eq(schema.pointsLedger.reason, reason),
        eq(schema.pointsLedger.sourceId, sourceId),
        gt(schema.pointsLedger.delta, 0),
      ),
    )
    .limit(1);

  if (original.length === 0 || !original[0]) {
    return false; // 원본 없음 — no-op
  }

  // ── 2. 이미 회수된 경우 no-op ──────────────────────────────────────────────
  const alreadyRevoked = await db
    .select({ id: schema.pointsLedger.id })
    .from(schema.pointsLedger)
    .where(
      and(
        eq(schema.pointsLedger.userId, userId),
        eq(schema.pointsLedger.reason, revokedReason),
        eq(schema.pointsLedger.sourceId, sourceId),
      ),
    )
    .limit(1);

  if (alreadyRevoked.length > 0) {
    return false; // 이미 회수됨 — no-op
  }

  // ── 3. 회수 행 INSERT (원본 delta 음수) ────────────────────────────────────
  const negativeDelta = -original[0].delta;

  await db
    .insert(schema.pointsLedger)
    .values({
      userId,
      delta: negativeDelta,
      reason: revokedReason,
      sourceType,
      sourceId,
    });

  return true;
}

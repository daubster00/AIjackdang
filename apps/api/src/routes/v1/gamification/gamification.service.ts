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
import { gradeForPoints, nextGrade, pointsToNextGrade } from "@ai-jakdang/core";
import type { GradeRow } from "@ai-jakdang/core";
import { eq, sql } from "drizzle-orm";

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

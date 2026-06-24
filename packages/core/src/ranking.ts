/**
 * 랭킹 도메인 순수 함수 — Epic 6.
 *
 * DB 미참조. 호출자가 ledger 집계 행을 주입한다.
 */

// ── 타입 ──────────────────────────────────────────────────────────────────────

/** 랭킹 집계 기간 타입. */
export type PeriodType = "weekly" | "monthly";

/** 랭킹 항목. rank 는 1부터 시작. */
export interface RankEntry {
  rank: number;
  userId: string;
  totalDelta: number;
}

// ── 함수 ──────────────────────────────────────────────────────────────────────

/**
 * 기간에 해당하는 조회 윈도 날짜를 반환한다.
 *
 * weekly  : 이번 주 월요일 00:00:00.000 UTC ~ 이번 주 일요일 23:59:59.999 UTC
 * monthly : 이번 달 1일 00:00:00.000 UTC ~ 이번 달 마지막 날 23:59:59.999 UTC
 */
export function rankingWindowDates(
  period: PeriodType,
  now: Date,
): { start: Date; end: Date } {
  if (period === "weekly") {
    // ISO 주 기준: 월요일(dayOfWeek=1) ~ 일요일(dayOfWeek=0)
    const dayOfWeek = now.getUTCDay(); // 0=일, 1=월, ..., 6=토
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const start = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysFromMonday,
        0, 0, 0, 0,
      ),
    );
    const end = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysFromMonday + 6,
        23, 59, 59, 999,
      ),
    );

    return { start, end };
  }

  // monthly
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );

  return { start, end };
}

/**
 * 원장 행 집합에서 랭킹을 계산한다.
 *
 * 1. userId 별 delta SUM
 * 2. totalDelta 내림차순 정렬
 * 3. rank 1 부터 순번 부여 (동점 처리: 동점자는 같은 rank, 이후 rank 는 건너뜀 — 표준 밀집 미적용)
 * 4. limit 까지만 반환
 */
export function computeRanking(
  ledgerRows: { userId: string; delta: number }[],
  limit: number,
): RankEntry[] {
  // userId 별 delta 합산
  const totals = new Map<string, number>();
  for (const row of ledgerRows) {
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.delta);
  }

  // 내림차순 정렬
  const sorted = [...totals.entries()]
    .map(([userId, totalDelta]) => ({ userId, totalDelta }))
    .sort((a, b) => b.totalDelta - a.totalDelta);

  // rank 부여 (동점자 동일 rank, 다음 rank 는 건너뜀 — standard competition ranking)
  const result: RankEntry[] = [];
  let rank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (result.length >= limit) break;

    const entry = sorted[i];
    // 이전 항목과 점수가 다르면 rank 를 현재 순번(1-based)으로 업데이트
    if (i > 0 && entry.totalDelta !== sorted[i - 1].totalDelta) {
      rank = i + 1;
    }

    result.push({ rank, userId: entry.userId, totalDelta: entry.totalDelta });
  }

  return result;
}

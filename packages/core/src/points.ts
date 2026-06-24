/**
 * 포인트 도메인 규칙 (비시각적 공유 코드) — Epic 6.
 *
 * DB 미참조 순수 함수.
 * reason 은 'domain.action' 형식 문자열.
 */

// ── 타입 ──────────────────────────────────────────────────────────────────────

/** 포인트를 부여하는 활동 이유 ('domain.action' 형식). */
export type PointReason =
  | "post.created"
  | "answer.created"
  | "comment.created"
  | "resource.created"
  | "reaction.received"
  | "download.given";

// ── 포인트 규칙 ───────────────────────────────────────────────────────────────

/** 활동별 1회 지급 포인트. */
export const POINT_RULES: Record<PointReason, number> = {
  "post.created": 10,
  "answer.created": 5,
  "comment.created": 1,
  "resource.created": 20,
  "reaction.received": 2,
  "download.given": 1,
};

/** 활동별 일일 적립 상한 횟수. 이 횟수 이상이면 해당 이유로 포인트를 더 받지 않는다. */
export const DAILY_CAPS: Record<PointReason, number> = {
  "post.created": 10,
  "answer.created": 10,
  "comment.created": 20,
  "resource.created": 5,
  "reaction.received": 50,
  "download.given": 30,
};

// ── 함수 ──────────────────────────────────────────────────────────────────────

/** 활동에 대한 1회 지급 포인트를 반환한다. */
export function pointsForAction(reason: PointReason): number {
  return POINT_RULES[reason];
}

/** canEarnPoint 의 옵션. */
export interface CanEarnPointOpts {
  reason: PointReason;
  userId: string;
  /** 오늘 해당 reason 으로 이미 적립된 횟수 (호출자가 DB에서 집계해 전달). */
  todayCount: number;
}

/**
 * 해당 reason 으로 포인트를 더 받을 수 있는지 확인한다.
 * todayCount >= DAILY_CAPS[reason] 이면 false (일일 상한 초과).
 */
export function canEarnPoint({ reason, todayCount }: CanEarnPointOpts): boolean {
  return todayCount < DAILY_CAPS[reason];
}

export * from "./qna";
export * from "./nickname";
export * from "./avatar";
export * from "./disposable-emails";

// ── points (전면 재작성) ───────────────────────────────────────────────────────
export {
  POINT_RULES,
  DAILY_CAPS,
  pointsForAction,
  canEarnPoint,
} from "./points";
export type { PointReason, CanEarnPointOpts } from "./points";

// ── grades ────────────────────────────────────────────────────────────────────
export { gradeForPoints, nextGrade, pointsToNextGrade } from "./grades";
export type { GradeRow } from "./grades";

// ── ranking ───────────────────────────────────────────────────────────────────
export { rankingWindowDates, computeRanking } from "./ranking";
export type { PeriodType, RankEntry } from "./ranking";

// ── moderation (Story 9.10 · 9.11) ───────────────────────────────────────────
export { deriveReportAction, detectForbiddenWord, detectSpam, maskForbiddenWord } from "./moderation";

// ── legal (Story 10.2 · 10.4) — 약관 버전 단일 상수 ─────────────────────────────
export { CURRENT_TERMS_VERSION, TERMS_EFFECTIVE_DATE } from "./legal";

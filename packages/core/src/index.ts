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

// ── badges ────────────────────────────────────────────────────────────────────
export { BADGE_CONDITIONS, shouldAwardBadge } from "./badges";
export type { BadgeSlug, BadgeCheckOpts } from "./badges";

// ── ranking ───────────────────────────────────────────────────────────────────
export { rankingWindowDates, computeRanking } from "./ranking";
export type { PeriodType, RankEntry } from "./ranking";

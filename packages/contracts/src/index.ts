export * from "./common";
export * from "./auth";
export * from "./user";
export * from "./post";
export * from "./board";
export * from "./jobs/email";
export * from "./editor";
export * from "./qna";
export * from "./resource";
export * from "./engagement";

// ── 알림·쪽지·문의 (Epic 7) ───────────────────────────────────────────────────
export * from "./notification";
export * from "./notification-settings";
export * from "./message";
export * from "./inquiry";

// ── 검색 (Story 8.1) ──────────────────────────────────────────────────────────
export * from "./search";

// ── 태그 콘텐츠 API (Story 8.3) ──────────────────────────────────────────────
export * from "./tag";

// ── 홈 페이지 SSR (Story 8.5) ─────────────────────────────────────────────────
export * from "./home";

// ── OG 링크 미리보기 (Story 8.6) ─────────────────────────────────────────────
export * from "./link-preview";

// ── sitemap API 응답 스키마 (Story 8.7) ──────────────────────────────────────
export * from "./sitemap";

// ── 관리자 인증 (Story 9.2) ───────────────────────────────────────────────────
export * from "./admin/auth";

// ── gamification ──────────────────────────────────────────────────────────────
export {
  gradeSchema,
  badgeSchema,
  userBadgeSchema,
  pointsLedgerEntrySchema,
  rankEntrySchema,
  periodTypeSchema,
  rankingResponseSchema,
  userBadgesResponseSchema,
  gradeUpJobSchema,
  // ── [6.4] ──
  badgeCheckJobSchema,
  // ── [6.5] ──
  rankingComputeJobSchema,
  // ── [6.6] ──
  meResponseSchema,
} from "./gamification";
export type {
  Grade,
  Badge,
  UserBadge,
  PointsLedgerEntry,
  RankEntry as GamificationRankEntry,
  PeriodType as GamificationPeriodType,
  RankingResponse,
  UserBadgesResponse,
  GradeUpJobPayload,
  // ── [6.4] ──
  BadgeCheckJobPayload,
  // ── [6.5] ──
  RankingComputeJobPayload,
  // ── [6.6] ──
  MeResponse,
} from "./gamification";

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

// ── 관리자 대시보드·운영자·게시글 (Story 9.4·9.5·9.6) ────────────────────────────
export * from "./admin/dashboard";
export * from "./admin/admin-members";
export * from "./admin/posts";

// ── 관리자 콘텐츠·운영 관리 (Story 9.7·9.8·9.12·9.14·9.15) ────────────────────
export * from "./admin/qna";
export * from "./admin/resources";
export * from "./admin/members";
export * from "./admin/inquiries";
export * from "./admin/settings";

// ── 관리자 Wave B (9.9 댓글·9.13 게이미피케이션·9.16 광고·9.18 쪽지) ───────────
export * from "./admin/comments";
export * from "./admin/ads";
export * from "./admin/gamification";
export * from "./admin/messages";

// ── 신고 관리 (Story 9.10) ────────────────────────────────────────────────────
export * from "./admin/reports";

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

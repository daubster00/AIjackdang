/**
 * 유저 회원 관리 계약 (Story 9.12).
 *
 * 목록/상세/제재/포인트/등급/뱃지 요청·응답 Zod 스키마와 타입.
 * 실제 스키마 기준:
 *  - sanction_type: "warning" | "suspend" | "permaban"
 *  - user_sanctions.reason (note 아님)
 *  - points_ledger.delta(+/-) + reason("admin.grant"|"admin.deduct")
 *  - grade는 points_ledger SUM으로 도출 (users.grade 컬럼 없음)
 */

import { z } from "zod";

// ── 공통 ──────────────────────────────────────────────────────────────────────

/** sanction_type enum — DB 실제 값 */
export const sanctionTypeSchema = z.enum(["warning", "suspend", "permaban"]);
export type SanctionType = z.infer<typeof sanctionTypeSchema>;

// ── 목록 쿼리 파라미터 ─────────────────────────────────────────────────────────

/** GET /api/v1/admin/members 쿼리 파라미터 */
export const adminUserMembersQuerySchema = z.object({
  /** 상태 필터: active(정상) | suspended(이용제한) | withdrawn(탈퇴) */
  status: z.enum(["active", "suspended", "withdrawn"]).optional(),
  /** 등급 레벨 필터 (1~5) */
  grade: z.coerce.number().int().min(1).max(5).optional(),
  /** 가입일 범위 시작 (YYYY-MM-DD) */
  dateFrom: z.string().optional(),
  /** 가입일 범위 끝 (YYYY-MM-DD) */
  dateTo: z.string().optional(),
  /** 닉네임 또는 이메일 검색 */
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminUserMembersQuery = z.infer<typeof adminUserMembersQuerySchema>;

// ── 회원 목록 아이템 ───────────────────────────────────────────────────────────

/** 목록에서 반환하는 회원 항목 */
export const adminUserMemberItemSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  email: z.string(),
  status: z.enum(["active", "suspended", "withdrawn"]),
  suspendedUntil: z.string().nullable(),
  createdAt: z.string(),
  /** 아바타 관련 필드 (story 9.12 #5) */
  avatarUrl: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  defaultAvatarIndex: z.number().optional(),
  /** 현재 총 포인트 (points_ledger SUM) */
  totalPoints: z.number(),
  /** 파생 등급 레벨 (1~5) */
  gradeLevel: z.number(),
  /** 파생 등급명 */
  gradeName: z.string(),
  /** 작성 게시글 수 */
  postCount: z.number(),
  /** 신고 받은 수 (raw, status 무관) */
  reportCount: z.number(),
  /** 처리완료 신고 수 (status='resolved' 기준) */
  resolvedReportCount: z.number(),
});
export type AdminUserMemberItem = z.infer<typeof adminUserMemberItemSchema>;

/** GET /api/v1/admin/members 응답 */
export const adminUserMembersListResponseSchema = z.object({
  items: z.array(adminUserMemberItemSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
  }),
});
export type AdminUserMembersListResponse = z.infer<typeof adminUserMembersListResponseSchema>;

// ── 피신고 이력 항목 (Story 12.3) ─────────────────────────────────────────────

/** 회원 상세 - 처리완료 신고 항목 */
export const adminReceivedReportItemSchema = z.object({
  id: z.string().uuid(),
  targetType: z.string(),
  reasonCode: z.string(),
  reviewedAt: z.string().nullable(),
  reviewedByName: z.string().nullable(),
});
export type AdminReceivedReportItem = z.infer<typeof adminReceivedReportItemSchema>;

// ── 제재 이력 항목 ─────────────────────────────────────────────────────────────

export const adminUserSanctionItemSchema = z.object({
  id: z.string().uuid(),
  type: sanctionTypeSchema,
  reason: z.string(),
  issuedBy: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminUserSanctionItem = z.infer<typeof adminUserSanctionItemSchema>;

// ── 뱃지 보유 항목 ─────────────────────────────────────────────────────────────

export const adminUserBadgeItemSchema = z.object({
  id: z.string().uuid(),
  badgeId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  iconUrl: z.string(),
  grantedAt: z.string(),
  grantedBy: z.string().nullable(),
});
export type AdminUserBadgeItem = z.infer<typeof adminUserBadgeItemSchema>;

// ── 활동내역 탭 아이템 ─────────────────────────────────────────────────────────

/** 회원 상세 - 최근 게시글 항목 */
export const adminUserRecentPostItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  status: z.string(),
  createdAt: z.string(),
  /** DB posts.board 값 (예: "vibe-coding-guide"). 관리자 상세 URL 구성에 사용. */
  board: z.string(),
});
export type AdminUserRecentPostItem = z.infer<typeof adminUserRecentPostItemSchema>;

/** 회원 상세 - 최근 댓글 항목 */
export const adminUserRecentCommentItemSchema = z.object({
  id: z.string().uuid(),
  targetType: z.string(),
  targetId: z.string(),
  content: z.string(),
  createdAt: z.string(),
  /** 댓글 대상이 게시글(post)인 경우 DB posts.board 값. 상세 URL 구성에 사용. */
  board: z.string().nullable(),
});
export type AdminUserRecentCommentItem = z.infer<typeof adminUserRecentCommentItemSchema>;

/** 회원 상세 - 로그인 세션 항목 */
export const adminUserLoginSessionItemSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string(),
});
export type AdminUserLoginSessionItem = z.infer<typeof adminUserLoginSessionItemSchema>;

// ── 회원 상세 응답 ──────────────────────────────────────────────────────────────

export const adminUserMemberDetailSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  bio: z.string().nullable(),
  status: z.enum(["active", "suspended", "withdrawn"]),
  suspendedUntil: z.string().nullable(),
  createdAt: z.string(),
  /** 총 포인트 */
  totalPoints: z.number(),
  /** 파생 등급 레벨 */
  gradeLevel: z.number(),
  /** 파생 등급명 */
  gradeName: z.string(),
  /** 게시글 수 */
  postCount: z.number(),
  /** 신고 수 (raw, status 무관) */
  reportCount: z.number(),
  /** 처리완료 신고 수 (status='resolved' 기준, story 12.3) */
  resolvedReportCount: z.number(),
  /** 신고 임계치 (site_settings report_escalation_threshold, 없으면 5) */
  reportEscalationThreshold: z.number(),
  /** 처리완료 신고 목록 (최대 20건, 최신순) */
  receivedReports: z.array(adminReceivedReportItemSchema),
  /** 제재 이력 */
  sanctions: z.array(adminUserSanctionItemSchema),
  /** 활동내역 탭 데이터 (#22) */
  recentPosts: z.array(adminUserRecentPostItemSchema),
  recentComments: z.array(adminUserRecentCommentItemSchema),
  loginSessions: z.array(adminUserLoginSessionItemSchema),
});
export type AdminUserMemberDetail = z.infer<typeof adminUserMemberDetailSchema>;

// ── 제재 요청 ──────────────────────────────────────────────────────────────────

/** POST /api/v1/admin/members/:id/sanctions */
export const adminSanctionMemberSchema = z.object({
  type: sanctionTypeSchema,
  /** 사유 필수 */
  reason: z.string().min(1, "사유를 입력하세요"),
  /** 일시정지(suspend)일 때 종료일 */
  endsAt: z.string().datetime().nullable().optional(),
});
export type AdminSanctionMemberInput = z.infer<typeof adminSanctionMemberSchema>;

/** POST /api/v1/admin/members/:id/sanctions 응답 */
export const adminSanctionResponseSchema = z.object({
  sanctionId: z.string().uuid(),
  userId: z.string().uuid(),
  type: sanctionTypeSchema,
  status: z.enum(["active", "suspended", "withdrawn"]),
});
export type AdminSanctionResponse = z.infer<typeof adminSanctionResponseSchema>;

// ── 포인트 조정 요청 ────────────────────────────────────────────────────────────

/** POST /api/v1/admin/members/:id/points — 지급 */
export const adminGrantPointsSchema = z.object({
  amount: z.number().int().positive("포인트는 양수여야 합니다"),
  reason: z.string().optional(),
});
export type AdminGrantPointsInput = z.infer<typeof adminGrantPointsSchema>;

/** DELETE /api/v1/admin/members/:id/points — 차감 (super_admin) */
export const adminDeductPointsSchema = z.object({
  amount: z.number().int().positive("차감 포인트는 양수여야 합니다"),
  reason: z.string().min(1, "차감 사유를 입력하세요"),
});
export type AdminDeductPointsInput = z.infer<typeof adminDeductPointsSchema>;

/** 포인트 조정 응답 */
export const adminPointsResponseSchema = z.object({
  ledgerId: z.string().uuid(),
  userId: z.string().uuid(),
  delta: z.number(),
  totalPoints: z.number(),
});
export type AdminPointsResponse = z.infer<typeof adminPointsResponseSchema>;

// ── 등급 변경 요청 ─────────────────────────────────────────────────────────────

/** PATCH /api/v1/admin/members/:id/grade — 등급 변경 (super_admin) */
export const adminChangeGradeSchema = z.object({
  /** 목표 등급 레벨 1~5 */
  targetLevel: z.number().int().min(1).max(5),
  reason: z.string().min(1, "사유를 입력하세요"),
});
export type AdminChangeGradeInput = z.infer<typeof adminChangeGradeSchema>;

/** 등급 변경 응답 */
export const adminGradeResponseSchema = z.object({
  userId: z.string().uuid(),
  gradeLevel: z.number(),
  gradeName: z.string(),
  totalPoints: z.number(),
  adjustedDelta: z.number(),
});
export type AdminGradeResponse = z.infer<typeof adminGradeResponseSchema>;

// ── 뱃지 조작 요청 ─────────────────────────────────────────────────────────────

/** POST /api/v1/admin/members/:id/badges — 뱃지 지급 */
export const adminGrantBadgeSchema = z.object({
  badgeId: z.string().uuid("유효한 뱃지 ID를 입력하세요"),
});
export type AdminGrantBadgeInput = z.infer<typeof adminGrantBadgeSchema>;

/** 뱃지 지급 응답 */
export const adminBadgeGrantResponseSchema = z.object({
  userBadgeId: z.string().uuid(),
  userId: z.string().uuid(),
  badgeId: z.string().uuid(),
  badgeName: z.string(),
});
export type AdminBadgeGrantResponse = z.infer<typeof adminBadgeGrantResponseSchema>;

/** 뱃지 사용가능 목록 아이템 */
export const adminBadgeListItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  iconUrl: z.string(),
  isAuto: z.boolean(),
});
export type AdminBadgeListItem = z.infer<typeof adminBadgeListItemSchema>;

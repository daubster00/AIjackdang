/**
 * 관리자 접속통계·방문로그 계약 타입.
 *
 * 방문 적재:   POST /api/v1/analytics/collect (공개 비인증)
 * 방문자 추이: GET /api/v1/admin/analytics/visitor-trend?from=&to=
 * 유입 경로:   GET /api/v1/admin/analytics/referrers?from=&to=
 * 검색 키워드: GET /api/v1/admin/analytics/keywords?from=&to=&page=&pageSize=
 * 게시글 성과: GET /api/v1/admin/analytics/post-performance?from=&to=&limit=
 * 자료 성과:   GET /api/v1/admin/analytics/resource-performance?from=&to=&limit=
 * 최근 콘텐츠: GET /api/v1/admin/dashboard/recent-content?limit=
 * 페이지 체류: GET /api/v1/admin/analytics/page-dwell-time
 */

import { z } from "zod";

// ── 방문 적재 요청 (POST /api/v1/analytics/collect) ──────────────────────────

export const pageViewCollectBodySchema = z.object({
  /** 방문한 경로 (쿼리스트링 제외). 예: /lounge/talk/my-slug */
  path: z.string().min(1).max(2048),
  /** document.referrer 값 (전체 URL). 없으면 생략. */
  referrer: z.string().max(2048).optional(),
  /** 사이트 내부 검색 유입어. /search?q=... 등에서 추출. */
  searchKeyword: z.string().max(500).optional(),
  /** 브라우저 localStorage에 저장된 익명 방문자 ID (crypto.randomUUID). */
  visitorId: z.string().min(1).max(100),
  /** 페이지 체류 시간(ms). 이탈 시 sendBeacon으로 전송. 없으면 생략. */
  dwellMs: z.number().int().positive().optional(),
});
export type PageViewCollectBody = z.infer<typeof pageViewCollectBodySchema>;

// ── 방문자 추이 (GET /api/v1/admin/analytics/visitor-trend) ───────────────────

/** 일자별 방문자 수 / 페이지뷰 */
export const visitorTrendItemSchema = z.object({
  date: z.string(),                                        // YYYY-MM-DD
  visitors: z.number().int().nonnegative(),               // 고유 visitor_id 수
  pageViews: z.number().int().nonnegative(),              // 총 행 수 (PV)
});
export type VisitorTrendItem = z.infer<typeof visitorTrendItemSchema>;

export const visitorTrendResponseSchema = z.object({
  items: z.array(visitorTrendItemSchema),
});
export type VisitorTrendResponse = z.infer<typeof visitorTrendResponseSchema>;

// ── 유입 경로 (GET /api/v1/admin/analytics/referrers) ────────────────────────

/** 채널별 방문 수·비율 */
export const referrerItemSchema = z.object({
  source: z.string(),                                    // 검색엔진 | SNS | 직접 | 기타
  count: z.number().int().nonnegative(),
  percent: z.number().nonnegative(),                     // 0~100
});
export type ReferrerItem = z.infer<typeof referrerItemSchema>;

export const referrersResponseSchema = z.object({
  items: z.array(referrerItemSchema),
  total: z.number().int().nonnegative(),                 // 전체 방문 수
});
export type ReferrersResponse = z.infer<typeof referrersResponseSchema>;

// ── 검색 키워드 (GET /api/v1/admin/analytics/keywords) ───────────────────────

/** 검색 키워드별 유입 수 */
export const keywordItemSchema = z.object({
  keyword: z.string(),
  count: z.number().int().nonnegative(),
});
export type KeywordItem = z.infer<typeof keywordItemSchema>;

export const keywordsResponseSchema = z.object({
  items: z.array(keywordItemSchema),
  total: z.number().int().nonnegative(),                 // 고유 키워드 총 수 (페이지네이션 용)
});
export type KeywordsResponse = z.infer<typeof keywordsResponseSchema>;

// ── 게시글별 성과 (GET /api/v1/admin/analytics/post-performance) ──────────────

export const postPerformanceItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  board: z.string(),
  authorNickname: z.string().nullable(),
  status: z.string(),
  viewCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  likeCount: z.number().int().nonnegative(),
  reportCount: z.number().int().nonnegative(),
  createdAt: z.string(),                                 // ISO 8601
});
export type PostPerformanceItem = z.infer<typeof postPerformanceItemSchema>;

export const postPerformanceResponseSchema = z.object({
  items: z.array(postPerformanceItemSchema),
});
export type PostPerformanceResponse = z.infer<typeof postPerformanceResponseSchema>;

// ── 실전자료별 성과 (GET /api/v1/admin/analytics/resource-performance) ────────

export const resourcePerformanceItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  resourceType: z.string(),
  viewCount: z.number().int().nonnegative(),
  downloadCount: z.number().int().nonnegative(),
  /** 다운로드 전환율 = downloadCount / viewCount * 100 (0나눗셈 가드 적용) */
  conversionRate: z.number().nonnegative(),
  avgRating: z.number().nonnegative(),
  ratingCount: z.number().int().nonnegative(),
  reportCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type ResourcePerformanceItem = z.infer<typeof resourcePerformanceItemSchema>;

export const resourcePerformanceResponseSchema = z.object({
  items: z.array(resourcePerformanceItemSchema),
});
export type ResourcePerformanceResponse = z.infer<typeof resourcePerformanceResponseSchema>;

// ── 페이지별 체류시간 (GET /api/v1/admin/analytics/page-dwell-time) ──────────

export const pageDwellTimeItemSchema = z.object({
  /** 방문 경로 (쿼리스트링 제외). 예: /automation/some-slug */
  path: z.string(),
  /** dwell_ms IS NOT NULL 행 수 (체류시간 기록된 뷰 수) */
  views: z.number().int().nonnegative(),
  /** AVG(dwell_ms) — 밀리초 단위 평균 체류시간 */
  avgDwellMs: z.number().nonnegative(),
});
export type PageDwellTimeItem = z.infer<typeof pageDwellTimeItemSchema>;

export const pageDwellTimeResponseSchema = z.object({
  items: z.array(pageDwellTimeItemSchema),
});
export type PageDwellTimeResponse = z.infer<typeof pageDwellTimeResponseSchema>;

// ── 최근 콘텐츠 (GET /api/v1/admin/dashboard/recent-content) ─────────────────

export const recentContentItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  type: z.enum(["post", "resource", "question"]),
  title: z.string(),
  board: z.string().nullable(),                          // 게시글: board slug. 자료/질문: null.
  authorNickname: z.string().nullable(),
  status: z.string(),
  views: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type RecentContentItem = z.infer<typeof recentContentItemSchema>;

export const recentContentResponseSchema = z.object({
  items: z.array(recentContentItemSchema),
});
export type RecentContentResponse = z.infer<typeof recentContentResponseSchema>;

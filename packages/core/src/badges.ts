/**
 * 뱃지 도메인 순수 함수 — Epic 6.
 *
 * DB 미참조. 호출자가 집계값을 주입한다.
 * admin-special 은 shouldAwardBadge 에서 항상 제외된다 (운영자 수동 수여).
 */

// ── 타입 ──────────────────────────────────────────────────────────────────────

/** 뱃지 식별자 union type. */
export type BadgeSlug =
  | "first-post"
  | "resource-contributor"
  | "popular-resource"
  | "popular-post"
  | "answer-pro"
  | "consistent"
  | "admin-special";

/** 뱃지 수여 조건 판단에 필요한 집계값. 호출자가 DB에서 집계 후 주입. */
export interface BadgeCheckOpts {
  /** 총 게시글 수 */
  postCount: number;
  /** 총 자료 등록 수 */
  resourceCount: number;
  /** 총 자료 다운로드 수 (받은 것) */
  downloadCount: number;
  /** 총 좋아요 받은 수 */
  likeReceivedCount: number;
  /** 총 답변 수 */
  answerCount: number;
  /** 주간 활동 연속 주 수 */
  weeklyActiveCount: number;
  /** 운영자 직접 수여 여부 (shouldAwardBadge 는 이 값을 무시하고 admin-special 을 제외) */
  isAdminGrant?: boolean;
}

// ── 뱃지 조건 정의 ────────────────────────────────────────────────────────────

/**
 * 각 BadgeSlug 별 자동 수여 조건 체크 함수.
 * admin-special 은 자동 수여 대상이 아니므로 항상 false.
 */
export const BADGE_CONDITIONS: Record<BadgeSlug, (opts: BadgeCheckOpts) => boolean> = {
  "first-post": (opts) => opts.postCount >= 1,
  "resource-contributor": (opts) => opts.resourceCount >= 1,
  "popular-resource": (opts) => opts.downloadCount >= 50,
  "popular-post": (opts) => opts.likeReceivedCount >= 20,
  "answer-pro": (opts) => opts.answerCount >= 5,
  "consistent": (opts) => opts.weeklyActiveCount >= 4,
  "admin-special": () => false, // 운영자 수동 수여 전용 — 자동 수여 불가
};

// ── 함수 ──────────────────────────────────────────────────────────────────────

/**
 * 집계값 기준으로 달성한 BadgeSlug 목록을 반환한다.
 * admin-special 은 항상 제외된다.
 */
export function shouldAwardBadge(opts: BadgeCheckOpts): BadgeSlug[] {
  const autoSlugs = (Object.keys(BADGE_CONDITIONS) as BadgeSlug[]).filter(
    (slug) => slug !== "admin-special",
  );

  return autoSlugs.filter((slug) => BADGE_CONDITIONS[slug](opts));
}

/**
 * moderation — Story 9.10 신고 처리 판단 순수 함수.
 *             Story 9.11 금칙어/스팸 탐지 순수 함수.
 *
 * 의존성 없음(순수 함수). 단위 테스트(moderation.test.ts)에서 검증.
 */

/**
 * 신고 누적 수(reportCount)와 임계치(threshold)를 받아
 * 자동 숨김 여부를 반환한다.
 *
 * - threshold <= 0 : 자동 숨김 미설정 → 항상 queue_only
 * - reportCount >= threshold : auto_hide (임계치 초과·도달)
 * - reportCount < threshold  : queue_only (아직 임계치 미달)
 *
 * @param reportCount 현재 신고 누적 건수
 * @param threshold   자동 숨김 발동 임계치 (site_settings 에서 조회)
 * @returns 'auto_hide' | 'queue_only'
 */
export function deriveReportAction(
  reportCount: number,
  threshold: number,
): "auto_hide" | "queue_only" {
  if (threshold <= 0) return "queue_only"; // 임계치 미설정
  return reportCount >= threshold ? "auto_hide" : "queue_only";
}

// ── 금칙어 탐지 (Story 9.11, AC #3) ─────────────────────────────────────────

/**
 * 콘텐츠에 금칙어가 포함되어 있으면 true를 반환한다.
 *
 * 대소문자를 구분하지 않는 단순 포함 검사(indexOf)를 사용한다.
 * 금칙어 목록은 site_settings.forbidden_words(JSON 배열)에서 주입된다.
 *
 * @param content       검사할 텍스트
 * @param forbiddenList 금칙어 문자열 배열 (site_settings에서 조회)
 * @returns 금칙어 포함 여부
 */
export function detectForbiddenWord(
  content: string,
  forbiddenList: string[],
): boolean {
  if (forbiddenList.length === 0) return false;
  const lower = content.toLowerCase();
  return forbiddenList.some((word) => word.length > 0 && lower.includes(word.toLowerCase()));
}

// ── 스팸 링크 탐지 (Story 9.11, AC #4) ──────────────────────────────────────

/** 알려진 단축 URL / 광고 도메인 목록 */
const SPAM_DOMAINS = ["bit.ly", "tinyurl.com", "t.co"] as const;

/** URL 추출용 정규식 */
const URL_REGEX = /https?:\/\/[^\s]+/g;

/**
 * 콘텐츠에 스팸 링크 패턴이 포함되어 있으면 true를 반환한다.
 *
 * 두 가지 조건 중 하나라도 해당되면 스팸으로 판정한다:
 * 1. URL이 4개 이상 포함된 경우 (urls.length > 3)
 * 2. SPAM_DOMAINS 중 하나가 URL에 포함된 경우
 *
 * @param content 검사할 텍스트
 * @returns 스팸 여부
 */
export function detectSpam(content: string): boolean {
  const urls = content.match(URL_REGEX) ?? [];
  if (urls.length > 3) return true;
  return urls.some((url) => SPAM_DOMAINS.some((d) => url.includes(d)));
}

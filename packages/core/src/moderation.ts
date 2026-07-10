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

/** 정규식 메타문자를 이스케이프한다(금칙어를 리터럴로 매칭하기 위함). */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 콘텐츠에서 금칙어를 같은 길이의 별표('*')로 치환해 돌려준다.
 *
 * - 글 등록을 막지 않고(하드 차단 폐기), 금칙어만 가린다(네이버 댓글 방식).
 * - 대소문자를 구분하지 않으며, 각 금칙어가 나타나는 모든 위치를 치환한다.
 * - 치환 길이는 금칙어 글자 수와 동일(예: "씨발" → "**").
 *
 * @param content       원본 텍스트
 * @param forbiddenList 금칙어 문자열 배열 (site_settings에서 조회)
 * @returns 금칙어가 가려진 텍스트(금칙어가 없으면 원본 그대로)
 */
export function maskForbiddenWord(
  content: string,
  forbiddenList: string[],
): string {
  if (!content || forbiddenList.length === 0) return content;
  let result = content;
  for (const word of forbiddenList) {
    if (!word || word.length === 0) continue;
    const re = new RegExp(escapeRegExp(word), "gi");
    result = result.replace(re, "*".repeat(word.length));
  }
  return result;
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
 * @param options.allowManyUrls true면 "URL 4개 이상" 조건을 무시한다.
 *   실전자료 큐레이션처럼 출처·참고 링크가 정당하게 여러 개 들어가는 글에서,
 *   링크 수만으로 부당하게 스팸 판정되는 것을 막기 위한 예외. 단축·광고 도메인
 *   차단은 이 옵션과 무관하게 항상 유지된다.
 * @returns 스팸 여부
 */
export function detectSpam(
  content: string,
  options?: { allowManyUrls?: boolean },
): boolean {
  const urls = content.match(URL_REGEX) ?? [];
  if (!options?.allowManyUrls && urls.length > 3) return true;
  return urls.some((url) => SPAM_DOMAINS.some((d) => url.includes(d)));
}

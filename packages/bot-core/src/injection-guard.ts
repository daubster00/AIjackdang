/**
 * injection-guard — Story 11.10
 *
 * 원본 게시글·댓글에 포함된 프롬프트 인젝션 의심 패턴을 탐지한다.
 * 순수 함수만 — DB·네트워크·env 접근 금지.
 *
 * 3중 방어 계층 중 계층 1 (키워드 필터):
 *  - detectInjection(text): 탐지 → true. 이후 댓글 생성 파이프라인 즉시 중단.
 *  - wrapUntrusted(text): AI 프롬프트에 비신뢰 경계 태그 삽입 (계층 2 지원).
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md §11 보안·실패 모드 — 비신뢰 입력 래핑 + 키워드 필터]
 */

/**
 * 프롬프트 인젝션 탐지 정규식 목록.
 *
 * - 영어·한국어 혼재 패턴 모두 포함.
 * - 패턴은 확장 가능 (배열에 추가).
 * - 각 패턴은 부분 문자열(substring) 매치 — `.test()` 사용.
 */
export const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|prior|all)\s+instructions?/i,
  /system\s+prompt/i,
  /forget\s+(everything|all|your)(\s+\w+)?\s+(instructions?|prompt)/i,
  /now\s+you\s+(are|must|should|will)/i,
  /환경\s*변수/, // environment variable (환경변수)
  /비밀\s*키/, // secret key (비밀키)
  /api\s*[-_\s]*key/i, // API 키
  /관리자\s*권한/, // admin privilege (관리자 권한)
  /관리자\s*설정/, // admin settings (관리자 설정)
  /prompt\s*injection/i,
  /jailbreak/i,
  /disregard\s+(your|the)\s+(instructions?|rules?)/i,
  /actual\s+(instructions?|prompt|role)/i,
];

/**
 * 텍스트에 프롬프트 인젝션 의심 패턴이 포함되어 있는지 검사한다.
 *
 * - `INJECTION_PATTERNS` 중 하나라도 매치하면 `true`.
 * - 빈 문자열은 항상 `false`.
 * - 부분 문자열 매치 — 패턴이 문장 중간에 있어도 탐지.
 *
 * @param text 검사할 텍스트 (게시글 제목·본문·댓글 결합 문자열)
 * @returns 인젝션 의심 여부
 */
export function detectInjection(text: string): boolean {
  if (!text) return false;
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * 텍스트를 `<untrusted_user_content>` 태그로 래핑한다.
 *
 * Claude/GPT 계열 모델은 XML 스타일 태그를 "비신뢰 경계" 신호로 인식한다.
 * 이 함수가 반환하는 블록만 래핑 — 앞뒤 system 지시는 파이프라인(호출자)이 추가한다.
 *
 * @param text 래핑할 사용자 생성 콘텐츠
 * @returns `<untrusted_user_content>\n{text}\n</untrusted_user_content>` 형태 문자열
 */
export function wrapUntrusted(text: string): string {
  return `<untrusted_user_content>\n${text}\n</untrusted_user_content>`;
}

/**
 * injection-guard — Story 11.10 (2026-07-16 오탐 축소 개편)
 *
 * 원본 게시글·댓글에 포함된 프롬프트 인젝션 의심 패턴을 탐지한다.
 * 순수 함수만 — DB·네트워크·env 접근 금지.
 *
 * 3중 방어 계층 중 계층 1 (키워드 필터):
 *  - detectInjection(text): 탐지 → true. 이후 댓글 생성 파이프라인 즉시 중단.
 *  - wrapUntrusted(text): AI 프롬프트에 비신뢰 경계 태그 삽입 (계층 2 지원).
 *
 * ── 설계 원칙 (오탐 축소) ─────────────────────────────────────────────────────
 * 이곳은 AI·바이브코딩 개발 커뮤니티라 "환경변수 / API 키 / 비밀키 / 시스템 프롬프트 /
 * 관리자 설정" 같은 기술 용어가 **정상 글에 일상적으로** 등장한다. 과거처럼 이런 명사
 * 단독을 하드 차단하면 정상 기술 글마다 오탐이 나서 봇 댓글이 영구히 보류큐에 묶인다
 * (2026-07-15 OTel 로깅 글 사례). 따라서 계층 1은 **명령형 공격 형태만** 차단한다:
 *   1) 지시·규칙·프롬프트를 무시/망각하게 만드는 오버라이드 명령
 *   2) 비밀 정보(환경변수·API 키·비밀키·시스템 프롬프트 등)를 **유출하라는 명령**
 *      — 비밀 명사와 유출 동사가 **근접(15자 이내)** 할 때만 매치
 * 명사 단독은 계층 2(wrapUntrusted, 비신뢰 경계 래핑)에 맡긴다.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md §11 보안·실패 모드 — 비신뢰 입력 래핑 + 키워드 필터]
 */

// ── 비밀 정보 명사 / 유출 동사 (근접 결합 시에만 인젝션으로 간주) ─────────────
/** 유출 대상이 되는 민감 정보 명사 (단독으로는 차단하지 않음). */
const SECRET_NOUN = String.raw`(?:환경\s*변수|비밀\s*키|비밀번호|시크릿|secret\s*key|api[\s\-_]*key|access[\s\-_]*token|시스템\s*프롬프트|system\s*prompt|관리자\s*(?:권한|설정|계정|비밀번호|비번))`;
/** 정보를 밖으로 빼내려는 유출·노출 동사. */
const EXFIL_VERB = String.raw`(?:알려|출력|공개|보여|말해|뱉|노출|유출|넘겨|찍어|덤프|reveal|expose|print|show|leak|dump|give\s+me|send\s+me|tell\s+me|what\s+is\s+your)`;
/** 두 토큰 사이 허용 간격(짧을수록 오탐 적음). */
const NEAR = String.raw`[\s\S]{0,15}`;

/**
 * 프롬프트 인젝션 탐지 정규식 목록.
 *
 * - 명령형(오버라이드·유출)만 포함 — 명사 단독은 제외.
 * - 영어·한국어 혼재 패턴 모두 포함.
 * - 각 패턴은 부분 문자열(substring) 매치 — `.test()` 사용.
 */
export const INJECTION_PATTERNS: RegExp[] = [
  // ── 지시·규칙·프롬프트 오버라이드 (영어) ───────────────────────────────────
  /ignore\s+(?:the\s+|all\s+|your\s+|previous\s+|prior\s+|above\s+)+(?:instructions?|prompts?|rules?)/i,
  /disregard\s+(?:the\s+|all\s+|your\s+|previous\s+|prior\s+|above\s+)+(?:instructions?|prompts?|rules?)/i,
  /forget\s+(?:everything|all|your|previous|prior)(?:\s+\w+)?\s+(?:instructions?|prompt)/i,
  /now\s+you\s+(?:are|must|should|will)\b/i,
  /actual\s+(?:instructions?|prompt|role)/i,
  /jailbreak/i,
  /prompt\s+injection/i,
  // ── 지시·규칙·프롬프트 오버라이드 (한국어) ─────────────────────────────────
  //    "이전 지시를 무시하고", "위의 규칙 잊어버리고", "기존 프롬프트 무시" 등
  /(?:이전|위의|앞의|기존|모든)\s*(?:지시|명령|규칙|프롬프트|설정)(?:사항)?\s*(?:을|를|은|는)?\s*(?:무시|잊어|잊고|버리)/,
  // ── 비밀 정보 유출 명령 (명사+동사 근접, 순서 무관) ─────────────────────────
  new RegExp(`${SECRET_NOUN}${NEAR}${EXFIL_VERB}`, "i"),
  new RegExp(`${EXFIL_VERB}${NEAR}${SECRET_NOUN}`, "i"),
];

/**
 * 텍스트에 프롬프트 인젝션 의심 패턴이 포함되어 있는지 검사한다.
 *
 * - `INJECTION_PATTERNS` 중 하나라도 매치하면 `true`.
 * - 빈 문자열은 항상 `false`.
 * - 명사 단독(환경변수·API 키 등)은 매치하지 않음 — 유출 동사가 근접해야 탐지.
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

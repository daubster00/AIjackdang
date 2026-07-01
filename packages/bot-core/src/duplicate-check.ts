/**
 * 자카드 유사도 기반 중복 글 1차 필터 — Story 11.9 (bot-core 순수 함수).
 *
 * 검열관 AI 호출 전 빠른 사전 필터링으로 비용을 절약한다.
 * DB·네트워크 접근 없음. 순수 함수.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md §7 글 생성 파이프라인 — 중복 1차 필터]
 */

/**
 * 텍스트를 소문자 단어 집합으로 변환.
 * 1글자 이하 토큰은 제외 (조사·구두점 노이즈 제거).
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
}

/**
 * 두 텍스트의 자카드 유사도를 반환한다 (0.0 ~ 1.0).
 *
 * - 동일 문자열: 1.0
 * - 완전히 다름: 0.0
 * - 두 텍스트 모두 빈 문자열: 1.0 (동등으로 간주)
 */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const word of setA) {
    if (setB.has(word)) intersectionCount++;
  }

  const unionCount = setA.size + setB.size - intersectionCount;
  return intersectionCount / unionCount;
}

/**
 * 초안이 기존 글 목록 중 하나와 threshold 이상 유사하면 true를 반환한다.
 *
 * @param draft 생성된 초안 텍스트
 * @param existingPosts 비교 대상 기존 글 텍스트 배열
 * @param threshold 유사도 임계값 (기본 0.6 = 60%)
 */
export function isTooSimilar(
  draft: string,
  existingPosts: string[],
  threshold = 0.6,
): boolean {
  for (const post of existingPosts) {
    if (jaccardSimilarity(draft, post) >= threshold) return true;
  }
  return false;
}

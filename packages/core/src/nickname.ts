/**
 * 자동 닉네임 생성기 (Story 1.3).
 *
 * 한국어 형용사 + 명사 + 3자리 숫자 접미 조합으로 유니크 닉네임을 생성한다.
 * Math.random 금지 — crypto.randomInt 사용.
 */

import { randomInt } from "node:crypto";

// ── 형용사 풀 (50개 이상) ─────────────────────────────────────────────────────
const ADJECTIVES: readonly string[] = [
  "빠른", "느린", "멋진", "귀여운", "용감한",
  "신비로운", "조용한", "활발한", "영리한", "따뜻한",
  "차가운", "날카로운", "부드러운", "강한", "약한",
  "밝은", "어두운", "푸른", "붉은", "하얀",
  "검은", "황금빛", "은빛", "투명한", "화려한",
  "소박한", "우아한", "거친", "섬세한", "독특한",
  "익숙한", "낯선", "고요한", "시끄러운", "평화로운",
  "열정적인", "차분한", "궁금한", "호기로운", "성실한",
  "게으른", "창의적인", "논리적인", "감성적인", "이성적인",
  "솔직한", "신중한", "대담한", "당당한", "겸손한",
  "자유로운", "책임감있는", "유쾌한", "진지한", "상냥한",
] as const;

// ── 명사 풀 (50개 이상) ───────────────────────────────────────────────────────
const NOUNS: readonly string[] = [
  "탐험가", "개발자", "작당원", "분석가", "디자이너",
  "연구자", "기획자", "아키텍트", "엔지니어", "마법사",
  "전사", "현자", "학자", "작가", "음악가",
  "예술가", "여행자", "모험가", "철학자", "과학자",
  "나비", "늑대", "독수리", "고래", "여우",
  "호랑이", "판다", "펭귄", "올빼미", "하마",
  "별", "달", "태양", "구름", "바람",
  "바다", "산", "숲", "강", "사막",
  "검객", "기사", "닌자", "해적", "탐정",
  "파일럿", "대장", "코더", "빌더", "해커",
  "선구자", "혁신가", "창조자", "발명가", "전략가",
] as const;

/**
 * 닉네임을 무작위 생성한다.
 * 형식: 형용사 + 명사 + 3자리 숫자 (예: "빠른탐험가042")
 */
export function generateNickname(): string {
  const adj = ADJECTIVES[randomInt(0, ADJECTIVES.length)];
  const noun = NOUNS[randomInt(0, NOUNS.length)];
  const num = randomInt(0, 1000).toString().padStart(3, "0");
  return `${adj}${noun}${num}`;
}

/**
 * 재시도 횟수(attempt)에 따른 fallback 닉네임 생성.
 * - attempt <= 10: 3자리 숫자 접미 (generateNickname 와 동일)
 * - attempt > 10: 6자리 숫자 접미 (충돌 공간 확장)
 */
export function generateNicknameWithFallback(attempt: number): string {
  const adj = ADJECTIVES[randomInt(0, ADJECTIVES.length)];
  const noun = NOUNS[randomInt(0, NOUNS.length)];

  if (attempt <= 10) {
    const num = randomInt(0, 1000).toString().padStart(3, "0");
    return `${adj}${noun}${num}`;
  }

  // attempt > 10: 6자리 숫자로 충돌 가능성 대폭 축소
  const num = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return `${adj}${noun}${num}`;
}

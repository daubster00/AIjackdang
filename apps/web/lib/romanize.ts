// 한글 닉네임 → 로마자(라틴 문자) 변환.
// 공개 프로필 배너(/u/[nickname])에서 Ballet 폰트로 닉네임을 영문 표기하기 위해 사용한다.
// - Ballet 폰트는 라틴 알파벳만 지원하므로 한글은 반드시 라틴 문자로 바꿔야 한다.
// - 국립국어원 로마자 표기법(Revised Romanization) 음절 단위 매핑을 사용한다.
//   (음절 경계를 넘는 자음 동화는 적용하지 않는 실용 버전 — 닉네임 표기에는 충분)
// - 이미 영문/숫자/기호인 문자는 그대로 유지한다.
// - 결정론적(offline)이므로 가입 시점에 별도 저장 없이 렌더 시 매번 동일한 결과를 낸다.

// 초성 19자
const CHO = [
  "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s",
  "ss", "", "j", "jj", "ch", "k", "t", "p", "h",
];
// 중성 21자
const JUNG = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa",
  "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];
// 종성 28자(0 = 받침 없음)
const JONG = [
  "", "g", "kk", "gs", "n", "nj", "nh", "d", "l", "lg",
  "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "bs", "s",
  "ss", "ng", "j", "ch", "k", "t", "p", "h",
];

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

/** 한글 완성형 한 글자를 로마자로. 완성형이 아니면 원문 그대로 반환. */
function romanizeSyllable(code: number): string | null {
  if (code < HANGUL_BASE || code > HANGUL_END) return null;
  const offset = code - HANGUL_BASE;
  const jong = offset % 28;
  const jung = Math.floor(offset / 28) % 21;
  const cho = Math.floor(offset / 28 / 21);
  return CHO[cho] + JUNG[jung] + JONG[jong];
}

/**
 * 닉네임을 로마자(영문) 표기로 변환한다.
 * 한글 → 로마자, 그 외(영문·숫자·기호)는 유지. 단어별 첫 글자를 대문자로.
 * 변환 결과에 라틴 문자가 하나도 없으면 원본 닉네임을 그대로 돌려준다(안전장치).
 */
export function romanizeNickname(nickname: string): string {
  if (!nickname) return nickname;

  let out = "";
  for (const ch of nickname) {
    const roman = romanizeSyllable(ch.codePointAt(0) ?? 0);
    out += roman ?? ch;
  }

  // 단어별 첫 글자 대문자화 (예: "gimcheolsu" → "Gimcheolsu")
  const titled = out.replace(/[A-Za-z][A-Za-z']*/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1),
  );

  // 라틴 문자가 전혀 없으면(이모지·기호만 등) 원본 유지
  return /[A-Za-z]/.test(titled) ? titled : nickname;
}

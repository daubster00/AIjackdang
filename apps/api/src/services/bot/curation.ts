/**
 * AI 창작마당 큐레이션(퍼오기) 정책 — Epic 11 확장.
 *
 * AI 창작마당(ai-creation)은 봇이 직접 만든 AI 창작물만 올리는 게 아니라,
 * 돌아다니는 AI 창작물(유튜브 AI 영상·AI 밈)을 퍼와서 소개하기도 한다.
 * 이 모듈은 "이번 글을 어떤 방식으로 만들지"를 결정하고, 큐레이션용 검색어를 만든다.
 *
 * 모드:
 *  - 'youtube' : 유튜브 AI 영상 임베드 + 소개글
 *  - 'meme'    : 웹 AI 밈/이미지 퍼오기(출처표기) + 소개글
 *  - 'ai'      : 봇이 직접 AI 이미지 생성 (기존 동작)
 *
 * 사용자 결정(2026-07-03): AI 창작마당은 "퍼오기 위주". 아래 가중치로 반영.
 */

/** 큐레이션 대상 게시판. */
const CURATION_BOARD = "ai-creation";

/** 큐레이션 모드. */
export type CurationMode = "youtube" | "meme" | "ai";

/**
 * 퍼오기 위주 가중치 (합 100). 유튜브·밈 퍼오기가 대부분, 봇 직접 생성은 가끔.
 * 조정 시 이 값만 바꾼다.
 */
const CURATION_WEIGHTS: Record<CurationMode, number> = {
  youtube: 45,
  meme: 40,
  ai: 15,
};

/**
 * 이번 글의 큐레이션 모드를 결정한다.
 * ai-creation 게시판 + 비관리자 페르소나일 때만 큐레이션(그 외 null → 기존 동작).
 * 관리자 캐릭터(AI작당지기)는 가이드/AI 생성 유지.
 */
export function decideCurationMode(
  board: string,
  isAdminPersona: boolean,
): CurationMode | null {
  if (board !== CURATION_BOARD || isAdminPersona) return null;

  const total =
    CURATION_WEIGHTS.youtube + CURATION_WEIGHTS.meme + CURATION_WEIGHTS.ai;
  let roll = Math.random() * total;
  if ((roll -= CURATION_WEIGHTS.youtube) < 0) return "youtube";
  if ((roll -= CURATION_WEIGHTS.meme) < 0) return "meme";
  return "ai";
}

/** 유튜브 AI 영상 검색어 풀(영어). */
const VIDEO_QUERIES = [
  "AI generated short film",
  "AI music video Suno Udio",
  "AI animation short film Sora",
  "AI generated movie trailer",
  "Runway Sora AI video showcase",
  "AI art animation viral",
];

/** AI 밈/이미지 검색어 풀(밈 특화 캐릭터는 더 밈 지향). */
const MEME_QUERIES_DEFAULT = [
  "AI generated art showcase",
  "Midjourney AI art trending",
  "AI generated image funny",
  "AI art meme",
];
const MEME_QUERIES_MEME_PERSONA = [
  "AI generated meme funny",
  "AI art fail funny meme",
  "AI image meme viral",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** 유튜브 영상 검색어 선택(페르소나 무관 — AI 영상 지향). */
export function curationVideoQuery(): string {
  return pickRandom(VIDEO_QUERIES);
}

/** AI 밈/이미지 검색어 선택(밈 특화 캐릭터 '냉장고털이'는 밈 지향 풀). */
export function curationMemeQuery(nickname: string): string {
  const pool =
    nickname === "냉장고털이" ? MEME_QUERIES_MEME_PERSONA : MEME_QUERIES_DEFAULT;
  return pickRandom(pool);
}

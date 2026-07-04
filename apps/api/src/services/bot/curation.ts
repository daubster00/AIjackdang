/**
 * 큐레이션(퍼오기) 정책 — Epic 11 구현, Story 13.8 범위 확장.
 *
 * 이제 ai-creation(AI 창작마당) 외 다른 게시판에도 설정으로 퍼오기 모드를 켤 수 있다.
 * 게시판별 curationEnabled/curationWeights를 bot_persona_boards에서 조회해
 * decideCurationMode()에 주입하는 방식으로 하드코딩을 제거했다.
 *
 * 모드:
 *  - 'youtube' : 유튜브 AI 영상 임베드 + 소개글
 *  - 'meme'    : 웹 AI 밈/이미지 퍼오기(출처표기) + 소개글
 *  - 'ai'      : 봇이 직접 AI 이미지 생성 (기존 동작)
 *
 * [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md §1]
 * [Source: _bmad-output/implementation-artifacts/13-8-curation-media-first-scope-expansion.md]
 */

/** 큐레이션 모드. */
export type CurationMode = "youtube" | "meme" | "ai";

/**
 * 게시판별 퍼오기 설정 — bot_persona_boards.curation_enabled/curation_weights에서 읽어서 주입.
 */
export interface BoardCurationConfig {
  /** 이 게시판에서 퍼오기 모드를 켤지 여부. */
  enabled: boolean;
  /**
   * 퍼오기 가중치(합 100 권장). 미지정 또는 불완전하면 CURATION_WEIGHTS(기본값)로 폴백.
   * e.g. { youtube: 45, meme: 40, ai: 15 }
   */
  weights?: Partial<Record<CurationMode, number>>;
}

/**
 * 퍼오기 위주 기본 가중치 (합 100). 유튜브·밈 퍼오기가 대부분, 봇 직접 생성은 가끔.
 * curationWeights가 없거나 불완전할 때 폴백으로 사용한다.
 */
const CURATION_WEIGHTS: Record<CurationMode, number> = {
  youtube: 45,
  meme: 40,
  ai: 15,
};

/**
 * 이번 글의 큐레이션 모드를 결정한다.
 *
 * - isAdminPersona=true → null (관리자 페르소나는 가이드/AI 생성 유지)
 * - curationConfig가 null/undefined이거나 enabled=false → null (기존 동작 유지)
 * - enabled=true → weights(또는 CURATION_WEIGHTS 기본값)로 youtube/meme/ai 중 하나 확률 추출
 *
 * @param board          대상 게시판 슬러그 (더 이상 직접 참조하지 않음 — 설정 기반 판단)
 * @param isAdminPersona 관리자 페르소나 여부
 * @param curationConfig 게시판별 퍼오기 설정 (bot_persona_boards에서 조회해 주입)
 */
export function decideCurationMode(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _board: string,
  isAdminPersona: boolean,
  curationConfig?: BoardCurationConfig | null,
): CurationMode | null {
  // 관리자 페르소나는 퍼오기 미적용(가이드/AI 생성 유지)
  if (isAdminPersona) return null;
  // 설정이 없거나 비활성이면 퍼오기 미적용
  if (!curationConfig || !curationConfig.enabled) return null;

  // 가중치 폴백: weights가 없거나 불완전하면 기본값 사용
  const w: Record<CurationMode, number> = {
    youtube: curationConfig.weights?.youtube ?? CURATION_WEIGHTS.youtube,
    meme: curationConfig.weights?.meme ?? CURATION_WEIGHTS.meme,
    ai: curationConfig.weights?.ai ?? CURATION_WEIGHTS.ai,
  };

  const total = w.youtube + w.meme + w.ai;
  let roll = Math.random() * total;
  if ((roll -= w.youtube) < 0) return "youtube";
  if ((roll -= w.meme) < 0) return "meme";
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

/** 저작권 위험 스톡 사이트 호스트 목록. */
const PAID_STOCK_HOSTS = [
  "shutterstock.com",
  "gettyimages.com",
  "istockphoto.com",
  "alamy.com",
  "stock.adobe.com",
];

/**
 * URL이 유료 스톡 이미지 사이트에서 온 것인지 확인한다(저작권 위험 판정).
 *
 * 밈 퍼오기(effectiveCuration === "meme") 시 imageSource.url에 호출해
 * true이면 bot_hold_queue에 reason="copyright_risk"로 적재하고 파이프라인을 중단한다.
 *
 * @param sourceUrl 이미지 출처 원본 페이지 URL (web.sourcePageUrl)
 * @returns 유료 스톡 사이트이면 true
 */
export function checkCurationCopyrightRisk(sourceUrl: string): boolean {
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase();
    return PAID_STOCK_HOSTS.some((h) => host.endsWith(h));
  } catch {
    return false;
  }
}

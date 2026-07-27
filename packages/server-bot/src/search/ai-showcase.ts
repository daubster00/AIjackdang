/**
 * 해외 AI 창작 쇼케이스 큐레이션 — AI 창작마당(ai-creation) 전용.
 *
 * 작당 수다방(community-scrape)이 "국내 커뮤니티 화제글"을 퍼온다면, 이 모듈은
 * "해외에서 실제로 반응이 터진 잘 만든 AI 창작물(이미지)"을 퍼온다. AI 창작마당은
 * 밈·잡담이 아니라 "멋진 AI 결과물을 자랑·소개"하는 곳이므로, 랜덤 웹 밈이 아니라
 * AI 창작물 공유로 유명한 Civitai의 인기 이미지를 출처와 함께 가져온다.
 *
 * 왜 Civitai API인가:
 *  - 공개 REST API(/api/v1/images)로 반응순·안전등급 필터가 가능해 스크래핑보다 안정적.
 *  - nsfw=None + per-item 안전등급 이중 필터로 선정적 이미지를 배제한다(공개 사이트 노출).
 *  - 고해상도 실제 AI 아트(base 모델·작성자·반응 수 메타 포함) → 출처 표기가 명확하다.
 *
 * 저작권/안전: 원문 이미지를 재호스팅하되 출처(Civitai·작성자·모델·원문 링크)를 반드시
 *   표기한다. 안전등급이 조금이라도 의심되면(선정성) 후보에서 제외한다.
 *
 * 무결과·차단·전부 부적합 시 null 반환 → 파이프라인은 다른 큐레이션(유튜브/직접생성)으로 폴백.
 */

import type { FactGrounding } from './index';

/** 발굴한 해외 AI 쇼케이스 이미지 1건. */
export interface DiscoveredAiShowcase {
  /** 원문 이미지 URL(다운로드·재호스팅 대상). */
  imageUrl: string;
  /** 원문 페이지 URL(출처 링크). */
  sourceUrl: string;
  /** 출처 라벨. */
  sourceLabel: string;
  /** 생성 모델(예: "Krea 2", "Flux"). 없으면 null. */
  model: string | null;
  /** 작성자(Civitai username). 없으면 null. */
  author: string | null;
  /** 반응 수(좋아요+하트 등). */
  reactions: number;
  /** AI 창작마당에 올릴 한국어 제목(제목 씨앗). */
  titleSeed: string;
  /** 글 작성에 넘길 사실 근거. */
  grounding: FactGrounding;
}

export interface DiscoverAiShowcaseOptions {
  /** 후보 회전용 인덱스(선택). */
  seedIndex?: number;
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * "멋진 AI 창작물을 자랑·소개"하는 제목 풀. 봇은 이미지 내용을 직접 보지 못하므로
 * (Civitai 인기글은 프롬프트 메타가 제거된 경우가 많음), 내용을 구체적으로 설명하는
 * 대신 궁금증·감탄을 유발하는 짧은 제목으로 클릭을 이끈다. 실제 사람이 짤 올릴 때처럼.
 */
const SHOWCASE_TITLES = [
  '이걸 AI가 그렸다고?',
  '사람 손 안 탄 그림입니다',
  '요즘 AI 근황 ㄷㄷ',
  '이 퀄리티가 진짜 AI라고?',
  'AI가 여기까지 왔네',
  '이제 이런 것도 AI가 함',
  '무슨 프롬프트 넣으면 이게 나옴',
  'AI 그림 이 정도면 반칙 아님?',
  '이거 보고 그림 접었다',
  '실사인 줄 알았는데 AI래',
];

/** 궁금증·감탄형 쇼케이스 제목 1개 선택(직접 생성 모드 등에서 재사용). */
export function pickShowcaseTitle(index: number): string {
  return SHOWCASE_TITLES[Math.abs(index) % SHOWCASE_TITLES.length]!;
}

/** 안전(비선정) 판정 — 쿼리 nsfw=None에 더해 per-item 등급을 이중 확인. */
function isSafeImage(it: Record<string, unknown>): boolean {
  // Civitai: nsfw(boolean) false, nsfwLevel(문자열 'None' 또는 숫자 1=None)만 통과.
  const nsfw = it.nsfw;
  if (nsfw === true) return false;
  const level = it.nsfwLevel;
  if (typeof level === 'string') return level === 'None';
  if (typeof level === 'number') return level <= 1; // 1=None
  return nsfw === false || nsfw === 'None';
}

/**
 * Civitai 반응순 이미지 중 안전·고품질 1건을 골라 쇼케이스 소재를 만든다.
 * @returns DiscoveredAiShowcase | null (무결과·전부 부적합·차단 시 null).
 */
export async function discoverAiShowcase(
  options?: DiscoverAiShowcaseOptions,
): Promise<DiscoveredAiShowcase | null> {
  const url =
    'https://civitai.com/api/v1/images?limit=40&sort=Most%20Reactions&period=Week&nsfw=None';
  let items: Array<Record<string, unknown>> = [];
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.log(`[ai-showcase] Civitai ${res.status} — 발굴 실패`);
      return null;
    }
    const data = (await res.json()) as { items?: Array<Record<string, unknown>> };
    items = data.items ?? [];
  } catch (err) {
    console.log('[ai-showcase] Civitai fetch 실패:', (err as Error).message);
    return null;
  }

  // 안전 + 고품질(가로 768px 이상) + 정지 이미지만.
  const candidates = items.filter((it) => {
    if (it.type !== 'image') return false;
    if (typeof it.url !== 'string' || !it.url) return false;
    const w = typeof it.width === 'number' ? it.width : 0;
    if (w < 768) return false;
    return isSafeImage(it);
  });

  if (candidates.length === 0) {
    console.log('[ai-showcase] 안전·고품질 후보 0건 — 발굴 실패');
    return null;
  }

  // 회전 인덱스로 상위 후보 중 하나 선택(반응순이라 상위일수록 화제).
  const idx = Math.abs(options?.seedIndex ?? 0) % Math.min(candidates.length, 20);
  const chosen = candidates[idx]!;

  const id = chosen.id;
  const sourceUrl = `https://civitai.com/images/${id}`;
  const model = typeof chosen.baseModel === 'string' ? chosen.baseModel : null;
  const author = typeof chosen.username === 'string' ? chosen.username : null;
  const stats = (chosen.stats ?? {}) as Record<string, number>;
  const reactions =
    (stats.likeCount ?? 0) + (stats.heartCount ?? 0) + (stats.laughCount ?? 0);

  const titleSeed =
    SHOWCASE_TITLES[Math.abs(options?.seedIndex ?? 0) % SHOWCASE_TITLES.length]!;

  const facts = [
    'Civitai에서 지금 반응이 높은 AI 생성 이미지(해외 AI 창작 커뮤니티).',
    ...(model ? [`생성 모델: ${model}`] : []),
    ...(author ? [`작성자: ${author}`] : []),
    `반응 수: 약 ${reactions}`,
    `원문: ${sourceUrl}`,
  ];

  return {
    imageUrl: chosen.url as string,
    sourceUrl,
    sourceLabel: 'Civitai',
    model,
    author,
    reactions,
    titleSeed,
    grounding: {
      facts,
      sourceUrls: [sourceUrl],
      rawSnippetCount: candidates.length,
      confidence: 'medium',
      costUsd: 0,
    },
  };
}

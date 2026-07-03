/**
 * Brave Video Search 어댑터 — "유튜브 AI 영상을 퍼오는" 큐레이션 경로.
 *
 * Brave의 videos/search 엔드포인트로 주제 관련 동영상을 찾고, 그중
 * **유튜브(youtube.com / youtu.be) 링크만** 후보로 골라 1건 반환한다.
 * (게시판 렌더러가 youtube 노드만 iframe 임베드를 허용하므로 유튜브로 한정.)
 *
 * 키 미설정·무결과·오류 시 null 반환(graceful skip) — 상위 파이프라인이 폴백.
 */

import { env } from '@ai-jakdang/config';

/** 큐레이션 대상 유튜브 영상(출처 포함). */
export interface CuratedVideo {
  /** 유튜브 watch URL (youtube 노드의 src로 그대로 삽입 — 임베드 URL 자동 변환됨). */
  url: string;
  /** 영상 제목. */
  title: string;
  /** 채널·게시자명(있으면, 출처 표기용). */
  channel: string | null;
  /** 원본 페이지 URL(출처 링크, 보통 url과 동일). */
  pageUrl: string;
}

/** 무작위 1개 선택. */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** youtube.com / youtu.be 호스트인지 판정. */
function isYoutubeUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return (
      host === 'www.youtube.com' ||
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be'
    );
  } catch {
    return false;
  }
}

/**
 * Brave 동영상 검색으로 유튜브 영상 1건을 고른다.
 * @param query - 검색어(영어 권장, 예: "AI generated short film").
 * @returns CuratedVideo | null (키 미설정·유튜브 결과 없음·오류 시 null).
 */
export async function searchYoutubeVideo(
  query: string,
): Promise<CuratedVideo | null> {
  if (!env.BRAVE_SEARCH_API_KEY) return null;
  if (!query || !query.trim()) return null;

  const params = new URLSearchParams({
    q: query,
    count: '10',
    safesearch: 'strict',
    country: 'US',
    search_lang: 'en',
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/videos/search?${params.toString()}`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY,
        },
      },
    );
    if (!response.ok) {
      console.error(`[search/brave-video] HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        video?: { creator?: string; publisher?: string };
        meta_url?: { hostname?: string };
      }>;
    };

    // 유튜브 링크만 후보로.
    const candidates = (data.results ?? []).filter(
      (it) => typeof it.url === 'string' && isYoutubeUrl(it.url),
    );
    if (candidates.length === 0) return null;

    const chosen = pickRandom(candidates);
    const url = chosen.url!;
    return {
      url,
      title: chosen.title?.trim() || 'AI 영상',
      channel: chosen.video?.creator ?? chosen.video?.publisher ?? null,
      pageUrl: url,
    };
  } catch (err) {
    const errName = (err as { name?: string }).name;
    if (errName === 'AbortError') {
      console.error('[search/brave-video] 타임아웃(5s)');
    } else {
      console.error('[search/brave-video] 검색 실패:', err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

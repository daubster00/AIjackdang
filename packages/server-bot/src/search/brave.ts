/**
 * Brave Search API 어댑터.
 *
 * Google Custom Search JSON API가 신규 고객에게 닫혀 있어, 해외/전체 웹 검색의
 * 기본 provider로 사용한다. 키 미설정·HTTP 오류·타임아웃 시 throw하지 않고 []
 * 반환해 기존 검색 파이프라인의 부분 가동 원칙을 유지한다.
 */

import { env } from '@ai-jakdang/config';
import type { SearchResult } from './google';

/**
 * Brave 요금은 계정 플랜/할당량에 따라 달라질 수 있어 앱 내부 비용 가드에는
 * 0으로 적산한다. 실제 과금/쿼터는 Brave 대시보드에서 관리한다.
 */
export const BRAVE_SEARCH_COST_PER_QUERY_USD = 0;

export type BraveFreshness = 'pd' | 'pw' | 'pm' | 'py' | string;

export interface BraveSearchOptions {
  freshness?: BraveFreshness;
  country?: string;
  searchLang?: string;
}

export async function searchBrave(
  query: string,
  maxResults = 8,
  options?: BraveSearchOptions,
): Promise<SearchResult[]> {
  if (!env.BRAVE_SEARCH_API_KEY) {
    console.log('[search/brave] API 키 미설정 — 검색 skip');
    return [];
  }
  if (!query || !query.trim()) return [];

  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(Math.max(maxResults, 1), 20)),
    safesearch: 'moderate',
    text_decorations: 'false',
  });

  if (options?.freshness) params.set('freshness', options.freshness);
  if (options?.country) params.set('country', options.country);
  if (options?.searchLang) params.set('search_lang', options.searchLang);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': env.BRAVE_SEARCH_API_KEY,
        },
      },
    );

    if (!response.ok) {
      console.error(`[search/brave] HTTP ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as {
      web?: {
        results?: Array<{
          title?: string;
          description?: string;
          url?: string;
          extra_snippets?: string[];
        }>;
      };
    };

    return (data.web?.results ?? [])
      .filter((item) => item.url)
      .map((item) => ({
        title: item.title ?? item.url ?? '',
        snippet: [item.description, ...(item.extra_snippets ?? [])]
          .filter(Boolean)
          .join('\n'),
        url: item.url!,
        source: 'brave' as const,
      }));
  } catch (err) {
    const errName = (err as { name?: string }).name;
    if (errName === 'AbortError') {
      console.error('[search/brave] 타임아웃(5s) — 검색 실패');
    } else {
      console.error('[search/brave] 검색 실패:', err);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

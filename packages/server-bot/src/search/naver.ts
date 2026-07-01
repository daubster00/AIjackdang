/**
 * Naver 검색 Open API 어댑터 (Story 11.7 / AC #2).
 *
 * 역할: "국내 보조" 검색 출처. 한국어 토픽을 그대로 사용.
 * Google 어댑터(해외 AI 전문 도메인)와 조합해 full/light 강도 검색을 구성한다.
 *
 * 주의: NAVER_SEARCH_CLIENT_ID/SECRET은 소셜 로그인 키(NAVER_CLIENT_ID/SECRET)와 별개.
 *   Naver Developers Console에서 검색 API용 별도 애플리케이션을 생성해야 한다.
 *
 * 키 미설정 시 graceful skip(빈 배열 반환) — ARCHITECTURE §8 원칙.
 */

import { env } from '@ai-jakdang/config';
import type { SearchResult } from './google';

/** Naver 검색 API 문서 유형. 기본값 'news'. */
export type NaverSearchType = 'news' | 'blog' | 'webkr';

/**
 * Naver 검색 API 비용: 무료(일 25,000회 한도).
 * 비용 계산에서 0으로 적산 — 일일 비용 가드에 영향 없음.
 */
export const NAVER_SEARCH_COST_PER_QUERY_USD = 0;

/**
 * HTML 태그 제거.
 * Naver API 응답의 title/description에는 <b>키워드</b> 형태 태그가 포함된다.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Naver 검색 Open API 호출 (뉴스·블로그·웹문서).
 *
 * @param query - 검색어. 한국어 토픽을 그대로 사용(국내 출처).
 * @param type - 검색 문서 유형. 기본 'news'.
 * @param maxResults - 최대 결과 수 (기본 5).
 * @returns SearchResult[] — 키 미설정·HTTP 오류·타임아웃 시 [] (graceful skip, throw 금지).
 */
export async function searchNaver(
  query: string,
  type: NaverSearchType = 'news',
  maxResults = 5,
): Promise<SearchResult[]> {
  if (!env.NAVER_SEARCH_CLIENT_ID || !env.NAVER_SEARCH_CLIENT_SECRET) {
    console.log('[search/naver] API 키 미설정 — 검색 skip');
    return [];
  }

  const params = new URLSearchParams({
    query,
    display: String(maxResults),
    sort: 'sim',
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/${type}.json?${params.toString()}`,
      {
        signal: controller.signal,
        headers: {
          'X-Naver-Client-Id': env.NAVER_SEARCH_CLIENT_ID,
          'X-Naver-Client-Secret': env.NAVER_SEARCH_CLIENT_SECRET,
        },
      },
    );

    if (!response.ok) {
      console.error(`[search/naver] HTTP ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as {
      items?: Array<{
        title: string;
        description: string;
        link?: string;
        originallink?: string;
      }>;
    };

    return (data.items ?? []).map((item) => ({
      title: stripHtml(item.title),
      snippet: stripHtml(item.description),
      url: item.originallink ?? item.link ?? '',
      source: 'naver' as const,
    }));
  } catch (err) {
    const errName = (err as { name?: string }).name;
    if (errName === 'AbortError') {
      console.error('[search/naver] 타임아웃(5s) — 검색 실패');
    } else {
      console.error('[search/naver] 검색 실패:', err);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

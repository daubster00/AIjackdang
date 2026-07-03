/**
 * Google Custom Search JSON API 어댑터 (Story 11.7 / AC #1, legacy).
 *
 * 2026-02 Google 공식 문서 기준 Custom Search JSON API는 신규 고객에게 닫혔다.
 * 신규 프로젝트에서는 403 PERMISSION_DENIED가 정상적으로 발생할 수 있으므로,
 * 메인 검색 파이프라인은 Brave Search를 사용하고 이 어댑터는 과거 프로젝트용
 * 직접 호출 fallback으로만 남긴다.
 *
 * CX(GOOGLE_SEARCH_CX) 큐레이션 전략 (2026-01 구글 정책 변경 반영):
 *   구글이 Programmable Search Engine의 "전체 웹 검색"을 신규 엔진에서 폐지(최대 50개 도메인).
 *   본 봇은 이를 **의도된 큐레이션**으로 활용 — 해외 AI 전문 출처(AI 회사 공식 블로그·
 *   AI 뉴스 미디어·커뮤니티·논문·툴/프롬프트 자료 사이트) 약 50개 도메인 허용목록 등록.
 *   → Google 어댑터 = "해외 AI 최신 소식 전용", Naver 어댑터 = "국내 보조".
 *   허용 도메인 목록 참고: docs/seeding-bot/ARCHITECTURE.md §5-검색-어댑터
 *
 * 키 미설정 시 graceful skip(빈 배열 반환) — ARCHITECTURE §8 "부분 가동 허용" 원칙.
 */

import { env } from '@ai-jakdang/config';

/**
 * 검색 결과 단건.
 * google.ts에서 정의하고 index.ts가 re-export — 외부는 단일 진입점에서 가져온다.
 *
 * source: 출처 구분자. 'full' 강도에서 Brave/Google(해외 출처)을 앞에 정렬하는 데 사용.
 */
export interface SearchResult {
  title: string;                // 검색 결과 제목
  snippet: string;              // 검색 결과 요약 스니펫
  url: string;                  // 원본 URL
  source: 'brave' | 'google' | 'naver';  // 출처 구분자
}

/**
 * Google CSE 요금 추정: 무료 100회/일 초과 시 $5/1000쿼리.
 * 무료 할당 내에서도 보수적으로 항상 적산 — 일일 비용 가드 계산 단순화.
 */
export const GOOGLE_SEARCH_COST_PER_QUERY_USD = 0.005;

/**
 * Google Custom Search JSON API 호출.
 *
 * @param query - 검색어. CX 도메인(영어 AI 전문 사이트) 특성상 영어 쿼리가 효과적.
 *   한국어 토픽은 상위 파이프라인(11.9)이 영어로 번역해 주입한다.
 * @param maxResults - 최대 결과 수 (1~10, 기본 5). Google API 상한 10.
 * @param lang - 언어/지역 필터:
 *   'en'(기본): lr=lang_en + gl=US — CX 도메인 대부분이 영어 AI 사이트이므로 기본값.
 *   'ko': lr=lang_ko + gl=KR — 국내 도메인을 CX에 일부 섞은 경우용.
 *   'any': 언어/지역 파라미터 미부착.
 * @param opts - 추가 옵션.
 *   opts.dateRestrict: 최근 결과만 (예: 'd14'=최근 14일, 'w1'=최근 1주, 'm1'=최근 1개월).
 *     주제 발굴(discovery)에서 "새로 업데이트된 소식"만 뽑을 때 사용.
 *   opts.sort: 'date' 지정 시 최신순 정렬(CX가 지원할 때). 미지정 시 관련도순.
 * @returns SearchResult[] — 키 미설정·HTTP 오류·타임아웃 시 [] (graceful skip, throw 금지).
 */
export async function searchGoogle(
  query: string,
  maxResults = 5,
  lang: 'en' | 'ko' | 'any' = 'en',
  opts?: { dateRestrict?: string; sort?: 'date' },
): Promise<SearchResult[]> {
  if (!env.GOOGLE_SEARCH_API_KEY || !env.GOOGLE_SEARCH_CX) {
    console.log('[search/google] API 키 미설정 — 검색 skip');
    return [];
  }

  const params = new URLSearchParams({
    key: env.GOOGLE_SEARCH_API_KEY,
    cx: env.GOOGLE_SEARCH_CX,
    q: query,
    num: String(Math.min(maxResults, 10)),
  });

  if (lang === 'en') {
    params.set('lr', 'lang_en');
    params.set('gl', 'US');
  } else if (lang === 'ko') {
    params.set('lr', 'lang_ko');
    params.set('gl', 'KR');
  }
  // lang === 'any': 언어/지역 파라미터 미부착

  if (opts?.dateRestrict) params.set('dateRestrict', opts.dateRestrict);
  if (opts?.sort === 'date') params.set('sort', 'date');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const response = await fetch(
      `https://customsearch.googleapis.com/customsearch/v1?${params.toString()}`,
      { signal: controller.signal },
    );

    if (!response.ok) {
      console.error(`[search/google] HTTP ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as {
      items?: Array<{ title: string; snippet: string; link: string }>;
    };

    return (data.items ?? []).map((item) => ({
      title: item.title,
      snippet: item.snippet,
      url: item.link,
      source: 'google' as const,
    }));
  } catch (err) {
    const errName = (err as { name?: string }).name;
    if (errName === 'AbortError') {
      console.error('[search/google] 타임아웃(5s) — 검색 실패');
    } else {
      console.error('[search/google] 검색 실패:', err);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

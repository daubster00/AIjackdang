/**
 * 웹 이미지 검색 어댑터 — "검색해서 퍼오는" 이미지 경로.
 *
 * Brave Image Search로 주제와 관련된 실제 이미지를 찾는다.
 *
 * ⚠️ 타사 이미지이므로 **반드시 출처(sourcePageUrl/sourceLabel)를 함께 반환**한다.
 *    호출부(파이프라인)는 본문에 "이미지 출처: ..." 캡션을 붙인다.
 *
 * 키 미설정·무결과·오류 시 null 반환(graceful skip) — 스톡 이미지로 폴백.
 */

import { env } from "@ai-jakdang/config";

/** 웹 검색으로 찾은 이미지(출처 포함). */
export interface WebImage {
  /** 이미지 직접 URL. */
  url: string;
  /** 이미지가 실린 원본 페이지 URL(출처 링크). */
  sourcePageUrl: string;
  /** 출처 표기용 라벨(도메인 등, 예: "anthropic.com"). */
  sourceLabel: string;
  /** 대체 텍스트(검색 결과 제목). */
  alt: string | null;
}

/** 무작위 1개 선택. */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Brave 이미지 검색.
 * @param query - 검색어(영어 제품/기능명 권장).
 * @returns WebImage | null (키 미설정·무결과·오류 시 null).
 */
export async function searchWebImage(query: string): Promise<WebImage | null> {
  if (!env.BRAVE_SEARCH_API_KEY) {
    return null;
  }
  if (!query || !query.trim()) return null;

  const params = new URLSearchParams({
    q: query,
    count: "5",
    safesearch: "strict",
    country: "US",
    search_lang: "en",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/images/search?${params.toString()}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY,
        },
      },
    );
    if (!response.ok) {
      console.error(`[image/web] HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        source?: string;
        properties?: { url?: string };
      }>;
    };

    // http(s) 이미지 URL이면서 컨텍스트 페이지가 있는 항목만 후보로.
    const candidates = (data.results ?? []).filter(
      (it) =>
        typeof (it.properties?.url ?? it.url) === "string" &&
        /^https?:\/\//.test(it.properties?.url ?? it.url ?? ""),
    );
    if (candidates.length === 0) return null;

    const chosen = pickRandom(candidates);
    const imageUrl = chosen.properties?.url ?? chosen.url ?? "";
    const sourcePageUrl = chosen.url ?? imageUrl;
    const sourceLabel =
      chosen.source ??
      (sourcePageUrl ? new URL(sourcePageUrl).hostname : "web");

    return {
      url: imageUrl,
      sourcePageUrl,
      sourceLabel,
      alt: chosen.title ?? null,
    };
  } catch (err) {
    const errName = (err as { name?: string }).name;
    if (errName === "AbortError") {
      console.error("[image/web] 타임아웃(5s)");
    } else {
      console.error("[image/web] 검색 실패:", err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

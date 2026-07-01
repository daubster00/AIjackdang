/**
 * 스톡 이미지 조달 어댑터 (Story 11.8 AC #1).
 *
 * Unsplash → Pexels 순서로 시도한다.
 * 키가 없는 소스는 건너뛴다(graceful skip).
 * 두 키가 모두 없거나 결과가 없으면 null 반환.
 * 모든 HTTP 에러는 catch 후 null 반환 — 봇 글 게시 차단 금지.
 *
 * 라이선스:
 * - Unsplash License: 상업적 사용 가능, 출처 표시 불필요
 * - Pexels License : 상업적 사용 가능, 출처 표시 불필요
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md#6-이미지-엔진]
 */

import { env } from "@ai-jakdang/config";

/** 스톡 이미지 검색 결과. */
export interface StockImage {
  /** 원본 이미지 직접 URL (다운로드 가능). */
  url: string;
  source: "unsplash" | "pexels";
  altText: string | null;
  /**
   * Unsplash API 이용 약관: 이미지 선택 후 이 URL에 GET 요청 필수 (다운로드 카운터 증가).
   * Pexels는 해당 없음.
   */
  downloadUrl?: string;
}

/** Unsplash 검색 응답 단일 항목 (필요한 필드만). */
interface UnsplashPhoto {
  urls: { regular: string };
  alt_description: string | null;
  links: { download: string };
}

/** Pexels 검색 응답 단일 항목 (필요한 필드만). */
interface PexelsPhoto {
  src: { large: string };
  alt: string | null;
}

/** 배열에서 무작위 1개를 반환한다. */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Unsplash에서 landscape 이미지를 검색한다.
 * UNSPLASH_ACCESS_KEY 미설정 시 null 반환.
 */
async function pickFromUnsplash(keyword: string): Promise<StockImage | null> {
  const key = env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  try {
    const url = [
      "https://api.unsplash.com/search/photos",
      `?query=${encodeURIComponent(keyword)}`,
      "&per_page=5&orientation=landscape",
    ].join("");

    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { results: UnsplashPhoto[] };
    if (!Array.isArray(data.results) || data.results.length === 0) return null;

    const photo = pickRandom(data.results);
    return {
      url: photo.urls.regular,
      source: "unsplash",
      altText: photo.alt_description ?? null,
      downloadUrl: photo.links.download,
    };
  } catch {
    return null;
  }
}

/**
 * Pexels에서 landscape 이미지를 검색한다.
 * PEXELS_API_KEY 미설정 시 null 반환.
 */
async function pickFromPexels(keyword: string): Promise<StockImage | null> {
  const key = env.PEXELS_API_KEY;
  if (!key) return null;

  try {
    const url = [
      "https://api.pexels.com/v1/search",
      `?query=${encodeURIComponent(keyword)}`,
      "&per_page=5&orientation=landscape",
    ].join("");

    const res = await fetch(url, {
      // Pexels: Authorization 헤더에 키 직접 사용 (Bearer/Basic 아님)
      headers: { Authorization: key },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { photos: PexelsPhoto[] };
    if (!Array.isArray(data.photos) || data.photos.length === 0) return null;

    const photo = pickRandom(data.photos);
    return {
      url: photo.src.large,
      source: "pexels",
      altText: photo.alt ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * 스톡 이미지를 검색한다. Unsplash 우선, 없으면 Pexels 시도.
 * 두 키 모두 없거나 결과 없으면 null 반환.
 *
 * ⚠️ Unsplash API 이용 약관: 이미지 선택 후 StockImage.downloadUrl 에
 * GET 요청(fire-and-forget)을 해야 한다. 이 함수는 URL 반환만 담당하며,
 * 실제 트리거는 fetchBotImage (index.ts) 에서 처리한다.
 */
export async function pickStock(keyword: string): Promise<StockImage | null> {
  const fromUnsplash = await pickFromUnsplash(keyword);
  if (fromUnsplash) return fromUnsplash;
  return pickFromPexels(keyword);
}

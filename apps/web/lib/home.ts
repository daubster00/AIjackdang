/**
 * 홈 페이지(/) 섹션별 서버 fetch 함수 — Story 8.5
 *
 * 서버 컴포넌트 전용 (Next.js App Router). "use client" 불가.
 * 모든 함수는 실패 시 빈 배열 또는 null 반환 (graceful degradation, AC #9).
 * Next.js fetch revalidate: 60 (목록 TTL 규약, AR-17).
 *
 * API 내부 통신: API_INTERNAL_URL (SSR 전용). 기본값 'http://localhost:4003'.
 * ⚠️ 반드시 API_INTERNAL_URL 로 통일한다. 예전 오타(INTERNAL_API_URL)는 운영에서
 *    미설정 → localhost:4003 폴백 → 웹 컨테이너에서 API 미연결 → 홈 전 섹션 공백 버그.
 */

import type {
  PopularPostItem,
  QuestionItem,
  ResourceItem,
  NoticeBanner,
} from "@ai-jakdang/contracts/home";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4003";
const REVALIDATE = 60; // 초 (AR-17 목록 TTL)

/** fetch 공통 옵션 */
const fetchOpts: RequestInit = {
  next: { revalidate: REVALIDATE },
};

// ── ② 실전 인기글 탭 ──────────────────────────────────────────────────────────

/**
 * 탭 ID → API category 파라미터 매핑.
 * '바이브코딩'·'자동화'·'수익화'·'라운지' 4탭 — 라운지는 board 기반 조회.
 */
const TAB_CATEGORY_MAP: Record<string, string | null> = {
  "vibe-coding": "vibe-coding",
  "ai-automation": "ai-automation",
  "ai-monetization": "ai-monetization",
  lounge: null, // board 기반 → 별도 함수(fetchLoungeLatest) 사용
};

/**
 * 탭 인기글 조회 — ② 실전 인기글 탭 섹션.
 * tab='lounge' 이면 자동으로 라운지 최신 글로 위임.
 */
export async function fetchPopularPosts(tab: string): Promise<PopularPostItem[]> {
  if (tab === "lounge") {
    return fetchLoungeLatest();
  }

  const category = TAB_CATEGORY_MAP[tab] ?? tab;

  try {
    const res = await fetch(
      `${API_BASE}/api/v1/posts/popular?category=${encodeURIComponent(category)}&period=7d&limit=5`,
      fetchOpts,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: PopularPostItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ── ③ 묻고답하기 최신 ─────────────────────────────────────────────────────────

export async function fetchLatestQuestions(): Promise<QuestionItem[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/questions?limit=5&sort=latest&status=published`,
      fetchOpts,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: QuestionItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ── ④ AI 수익화 인기글 ────────────────────────────────────────────────────────

export async function fetchMonetizationPosts(): Promise<PopularPostItem[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/posts/popular?category=ai-monetization&period=30d&limit=5`,
      fetchOpts,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: PopularPostItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ── ⑤ 실전자료 인기 ──────────────────────────────────────────────────────────

export async function fetchPopularResources(): Promise<ResourceItem[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/resources/popular?limit=4`,
      fetchOpts,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: ResourceItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ── ⑥ 작당 라운지 최신 ───────────────────────────────────────────────────────

export async function fetchLoungeLatest(): Promise<PopularPostItem[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/posts/popular?board=ai-creation,ai-products,free&sort=latest&limit=5`,
      fetchOpts,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: PopularPostItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ── ① 공지 배너 ──────────────────────────────────────────────────────────────

export async function fetchPinnedNotice(): Promise<NoticeBanner | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/notices/pinned?limit=1`,
      fetchOpts,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as NoticeBanner | null;
    return data ?? null;
  } catch {
    return null;
  }
}

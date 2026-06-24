/**
 * Redis 캐시 키 상수 — AR-17 규약: 모든 캐시 키는 이 파일에서만 정의.
 *
 * 형식: `{domain}:{sub}:{qualifier}`
 *
 * TTL 기준:
 *   - popular/ranking : 3600s (1h)
 *   - latest/list     : 60s   (Next.js fetch revalidate 와 동일)
 */

// ── 태그 캐시 키 (Story 8.4) ──────────────────────────────────────────────────

/** 인기 태그 목록 — TTL 3600s (1h) */
export const TAGS_POPULAR = "tags:popular" as const;

/** 인기 태그 캐시 TTL (초) */
export const TAGS_POPULAR_TTL = 3600;

// ── 홈 페이지 섹션 캐시 키 (Story 8.5) ───────────────────────────────────────

/** ②실전 인기글 탭 — 전 카테고리 7일 인기 (category 없음 → all) */
export const MAIN_POPULAR_ALL_7D = "main:popular:all:7d" as const;

/** ②실전 인기글 탭 — vibe-coding 7일 인기 */
export const MAIN_POPULAR_VIBE_7D = "main:popular:vibe-coding:7d" as const;

/** ②실전 인기글 탭 — ai-automation 7일 인기 */
export const MAIN_POPULAR_AUTOMATION_7D = "main:popular:ai-automation:7d" as const;

/** ④AI 수익화 인기글 — 30일 인기 */
export const MAIN_POPULAR_MONETIZATION_30D = "main:popular:ai-monetization:30d" as const;

/** ⑤실전자료 인기 (download_count 기준) */
export const MAIN_RESOURCES_POPULAR = "main:resources:popular" as const;

/** ⑥작당 라운지 최신 5건 */
export const MAIN_LOUNGE_LATEST = "main:lounge:latest" as const;

// ── 캐시 키 빌더 헬퍼 ────────────────────────────────────────────────────────

/**
 * 카테고리 + 기간 조합으로 캐시 키를 동적 생성한다.
 * 예: buildPopularKey('vibe-coding', '7d') → 'main:popular:vibe-coding:7d'
 */
export function buildPopularKey(category: string, period: "7d" | "30d"): string {
  return `main:popular:${category}:${period}`;
}

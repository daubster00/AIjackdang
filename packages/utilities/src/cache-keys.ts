/**
 * Redis 캐시 키 중앙 정의 — AR-17 규약
 *
 * 모든 캐시 키는 이 파일(packages/utilities)에서만 정의한다.
 * apps/api, apps/worker 모두 이 패키지를 import하여 사용한다.
 *
 * TTL 기준:
 *   - popular/ranking : 3600s (1h)
 *   - list/latest     : 300s  (5분)
 */

export const CACHE_KEYS = {
  /** 메인 페이지 전체 인기글 7일 */
  POPULAR_ALL_7D: "main:popular:all:7d",
  /** 카테고리별 인기글 30일 — 함수형 키 빌더 */
  POPULAR_CATEGORY_30D: (category: string) =>
    `main:popular:${category}:30d` as const,
  /** 메인 인기 자료 (download_count 기준) */
  RESOURCES_POPULAR: "main:resources:popular",
  /** 메인 라운지 최신글 5건 */
  LOUNGE_LATEST: "main:lounge:latest",
  /** 인기 태그 목록 */
  TAGS_POPULAR: "tags:popular",
  /** 주간 랭킹 */
  RANKING_WEEKLY: "ranking:weekly",
  /** 월간 랭킹 */
  RANKING_MONTHLY: "ranking:monthly",
} as const;

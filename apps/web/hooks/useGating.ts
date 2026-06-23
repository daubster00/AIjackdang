"use client";

/**
 * useGating 훅 (Story 1.7 — AC #6).
 *
 * GatingContext의 requireAuth를 래핑하여 소비한다.
 *
 * 사용법:
 * ```tsx
 * const { requireAuth } = useGating();
 *
 * function handleLike() {
 *   if (!requireAuth('like')) return;
 *   // 좋아요 로직
 * }
 * ```
 *
 * - 로그인 상태: requireAuth() → true, 행동 진행
 * - 비로그인: requireAuth() → false + 로그인 유도 모달 열림
 */

import { useGatingContext } from "@/contexts/GatingContext";

export function useGating() {
  return useGatingContext();
}

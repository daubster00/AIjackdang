/**
 * 기본 아바타 유틸리티 (Story 1.3).
 *
 * 가입 시 defaultAvatarIndex 로 /images/avatars/{index}.webp 경로를 구성한다.
 * 실제 이미지 파일은 apps/web/public/images/avatars/ 에 위치한다.
 */

/** 준비된 기본 아바타 이미지 수 (0 ~ DEFAULT_AVATAR_COUNT-1) */
export const DEFAULT_AVATAR_COUNT = 10 as const;

/**
 * defaultAvatarIndex 로 기본 아바타 URL 경로를 반환한다.
 * @param index 0 ~ DEFAULT_AVATAR_COUNT-1
 * @returns `/images/avatars/{index}.webp`
 */
export function getDefaultAvatarUrl(index: number): string {
  const safeIndex = Math.max(0, Math.min(index, DEFAULT_AVATAR_COUNT - 1));
  return `/images/avatars/${safeIndex}.webp`;
}

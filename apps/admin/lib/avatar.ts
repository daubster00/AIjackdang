/**
 * 관리자 앱 아바타 URL 해석 유틸리티.
 * apps/web/lib/avatar.ts 와 동일한 우선순위 로직을 인라인으로 구현.
 * (기본 아바타 이미지는 apps/admin/public/images/avatars/ 에 위치)
 */

const DEFAULT_AVATAR_COUNT = 10;

function getDefaultAvatarUrl(index: number): string {
  const safeIndex = Math.max(0, Math.min(index, DEFAULT_AVATAR_COUNT - 1));
  return `/images/avatars/${safeIndex}.webp`;
}

export interface AvatarSource {
  /** 사용자가 직접 업로드한 프로필 사진 */
  avatarUrl?: string | null;
  /** 소셜 provider 프로필 사진 */
  image?: string | null;
  /** 기본 아바타 인덱스 */
  defaultAvatarIndex?: number | null;
}

/**
 * 프로필 사진 표시 URL을 우선순위로 해석한다.
 * 직접 업로드(avatarUrl) > 소셜 사진(image) > 기본 아바타(defaultAvatarIndex).
 */
export function resolveAvatarUrl(u: AvatarSource): string {
  return u.avatarUrl || u.image || getDefaultAvatarUrl(u.defaultAvatarIndex ?? 0);
}

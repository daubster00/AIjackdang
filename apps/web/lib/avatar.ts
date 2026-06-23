import { getDefaultAvatarUrl, DEFAULT_AVATAR_COUNT } from "@ai-jakdang/core";

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

export { getDefaultAvatarUrl, DEFAULT_AVATAR_COUNT };

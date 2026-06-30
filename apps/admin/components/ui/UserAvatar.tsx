/**
 * 공통 유저 아바타 컴포넌트.
 *
 * 관리자 앱 전역에서 유저 프로필 사진을 표시하는 단일 진입점.
 * (G5) "프로필 사진을 한 곳에서 관리" — 각 페이지가 직접 이니셜/아이콘을
 * 렌더하지 말고 이 컴포넌트를 사용한다. avatarUrl > image > 기본아바타 순으로 해석.
 *
 * 사용처에서 백엔드 응답에 avatarUrl·image·defaultAvatarIndex 를 함께 내려주면
 * 실제 프로필 사진이 표시된다. 없으면 기본 아바타로 폴백한다.
 */

import { resolveAvatarUrl, type AvatarSource } from "@/lib/avatar";

interface UserAvatarProps extends AvatarSource {
  /** 픽셀 크기(정사각). 기본 32 */
  size?: number;
  /** 접근성 라벨(닉네임 등) */
  alt?: string;
  /** 추가 className */
  className?: string;
  /** 인라인 style 보강 */
  style?: React.CSSProperties;
}

export function UserAvatar({
  size = 32,
  alt = "프로필",
  className,
  style,
  ...source
}: UserAvatarProps) {
  const src = resolveAvatarUrl(source);
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        background: "var(--gray-100)",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

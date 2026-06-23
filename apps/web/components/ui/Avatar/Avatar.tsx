import { cn } from "@/lib/cn";
import styles from "./Avatar.module.css";

export interface AvatarProps {
  /** 표시 이름(이미지가 없을 때 첫 글자 표시 + alt) */
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** 프로필 아바타. 이미지가 없으면 이름 첫 글자를 표시한다. */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  return (
    <span className={cn(styles.avatar, styles[size], className)}>
      {src ? (
        // 디자인 시스템 데모용. 실제 페이지에서는 next/image 사용을 권장한다.
        <img className={styles.image} src={src} alt={name} />
      ) : (
        <span aria-hidden="true">{name.trim().charAt(0)}</span>
      )}
    </span>
  );
}

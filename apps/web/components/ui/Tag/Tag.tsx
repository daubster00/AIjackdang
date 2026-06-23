import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../Icon";
import styles from "./Tag.module.css";

export interface TagProps {
  children: ReactNode;
  /** 강조 채움 스타일 */
  filled?: boolean;
  disabled?: boolean;
  /** 링크 이동(태그 페이지). 지정 시 <a> 로 렌더링한다. */
  href?: string;
  /** 삭제 콜백. 지정 시 삭제 버튼을 노출한다(등록 화면 등). */
  onRemove?: () => void;
  /** 삭제 버튼 접근성 라벨 */
  removeLabel?: string;
  className?: string;
}

/** 키워드 표시 태그. 링크 이동 또는 삭제 버튼을 선택적으로 지원한다. */
export function Tag({
  children,
  filled = false,
  disabled = false,
  href,
  onRemove,
  removeLabel,
  className,
}: TagProps) {
  const classes = cn(
    styles.tag,
    filled && styles.filled,
    disabled && styles.disabled,
    (href || onRemove) && styles.interactive,
    className,
  );

  const removeButton = onRemove ? (
    <button
      type="button"
      className={styles.remove}
      aria-label={removeLabel ?? "태그 삭제"}
      onClick={onRemove}
    >
      <Icon name="close-line" />
    </button>
  ) : null;

  if (href && !onRemove) {
    return (
      <a className={classes} href={href}>
        {children}
      </a>
    );
  }

  return (
    <span className={classes}>
      {children}
      {removeButton}
    </span>
  );
}

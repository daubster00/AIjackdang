import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import type { ButtonProps } from "./Button.types";
import styles from "./Button.module.css";

/**
 * 공통 버튼.
 * - 상태(hover/active/focus/disabled)는 CSS 가 자동 처리한다.
 * - 로딩 중에는 스피너를 표시하고 중복 클릭을 막는다.
 * - TypeScript 는 상태/이벤트만, 시각 표현은 CSS Module 이 담당한다.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    disabled,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        styles.btn,
        styles[variant],
        styles[size],
        fullWidth && styles.full,
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        leftIcon && <span className={styles.icon}>{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && <span className={styles.icon}>{rightIcon}</span>}
    </button>
  );
});

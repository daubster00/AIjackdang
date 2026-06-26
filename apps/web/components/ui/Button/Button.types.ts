import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";
export type ButtonSize = "lg" | "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 시각적 종류. Primary 는 화면 핵심 행동 1개에만 사용한다. */
  variant?: ButtonVariant;
  /** 크기 (lg 44px / md 40px / sm 36px) */
  size?: ButtonSize;
  /** 전체 너비 (모바일에서 주로 사용) */
  fullWidth?: boolean;
  /** 로딩 상태. true 면 스피너를 표시하고 클릭을 막는다. */
  loading?: boolean;
  /** 왼쪽 아이콘 슬롯 */
  leftIcon?: ReactNode;
  /** 오른쪽 아이콘 슬롯 */
  rightIcon?: ReactNode;
  children?: ReactNode;
}

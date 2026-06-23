import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./Badge.module.css";

export type BadgeTone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";
export type BadgeVariant = "soft" | "outline" | "solid";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** soft(기본) / outline / solid */
  variant?: BadgeVariant;
  children: ReactNode;
}

const SOFT_CLASS: Record<BadgeTone, string> = {
  primary: styles.primary,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
  info: styles.info,
  neutral: styles.neutral,
};

const SOLID_CLASS: Partial<Record<BadgeTone, string>> = {
  primary: styles.solidPrimary,
  success: styles.solidSuccess,
  danger: styles.solidDanger,
};

/** 상태·유형 표시 배지. 클릭 기능은 없다(선택형은 Chip, 키워드는 Tag 사용). */
export function Badge({ tone = "primary", variant = "soft", className, children, ...rest }: BadgeProps) {
  const toneClass =
    variant === "outline"
      ? styles.outline
      : variant === "solid"
        ? (SOLID_CLASS[tone] ?? styles.solidPrimary)
        : SOFT_CLASS[tone];

  return (
    <span className={cn(styles.badge, toneClass, className)} {...rest}>
      {children}
    </span>
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./Stack.module.css";

export type Gap = "xs" | "sm" | "md" | "lg";

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: Gap;
  align?: "start" | "center" | "stretch";
}

const GAP_CLASS: Record<Gap, string> = {
  xs: styles.gapXs,
  sm: styles.gapSm,
  md: styles.gapMd,
  lg: styles.gapLg,
};

const ALIGN_CLASS = {
  start: styles.alignStart,
  center: styles.alignCenter,
  stretch: styles.alignStretch,
} as const;

/** 세로 배치 레이아웃 프리미티브. */
export function Stack({ gap = "md", align, className, children, ...rest }: StackProps) {
  return (
    <div
      className={cn(styles.stack, GAP_CLASS[gap], align && ALIGN_CLASS[align], className)}
      {...rest}
    >
      {children}
    </div>
  );
}

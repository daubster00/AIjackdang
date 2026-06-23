import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import type { Gap } from "../Stack";
import styles from "./Inline.module.css";

export interface InlineProps extends HTMLAttributes<HTMLDivElement> {
  gap?: Gap;
  justify?: "between" | "end";
  /** 줄바꿈 금지 */
  noWrap?: boolean;
}

const GAP_CLASS: Record<Gap, string> = {
  xs: styles.gapXs,
  sm: styles.gapSm,
  md: styles.gapMd,
  lg: styles.gapLg,
};

/** 가로 배치 레이아웃 프리미티브(기본 줄바꿈 허용). */
export function Inline({ gap = "sm", justify, noWrap, className, children, ...rest }: InlineProps) {
  return (
    <div
      className={cn(
        styles.inline,
        GAP_CLASS[gap],
        justify === "between" && styles.justifyBetween,
        justify === "end" && styles.justifyEnd,
        noWrap && styles.noWrap,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

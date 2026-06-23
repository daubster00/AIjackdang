import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import styles from "./Skeleton.module.css";

export interface SkeletonProps {
  /** line(텍스트 줄) / title(제목) / circle(원형) */
  variant?: "line" | "title" | "short" | "circle";
  width?: string | number;
  height?: string | number;
  className?: string;
}

/** 로딩 스켈레톤. 실제 콘텐츠 구조와 비슷한 크기로 사용한다. */
export function Skeleton({ variant = "line", width, height, className }: SkeletonProps) {
  const style: CSSProperties = {
    width,
    height,
  };
  return (
    <span
      aria-hidden="true"
      className={cn(styles.skeleton, variant && styles[variant], className)}
      style={style}
    />
  );
}

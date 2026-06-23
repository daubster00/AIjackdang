import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./Tooltip.module.css";

export interface TooltipProps {
  /** 툴팁 문구(짧게) */
  label: string;
  children: ReactNode;
  className?: string;
}

/** 툴팁. hover 와 focus 모두에서 노출된다. 필수 정보는 툴팁에만 의존하지 않는다. */
export function Tooltip({ label, children, className }: TooltipProps) {
  const tooltipId = useId();
  return (
    <span className={cn(styles.tooltip, className)} aria-describedby={tooltipId}>
      {children}
      <span role="tooltip" id={tooltipId} className={styles.bubble}>
        {label}
      </span>
    </span>
  );
}

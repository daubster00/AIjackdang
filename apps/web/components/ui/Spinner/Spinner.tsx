import { cn } from "@/lib/cn";
import styles from "./Spinner.module.css";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  /** 스크린리더용 라벨 */
  label?: string;
  className?: string;
}

/** 로딩 스피너. 색상은 currentColor 를 따른다. */
export function Spinner({ size = "md", label = "불러오는 중", className }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className={cn(styles.spinner, styles[size], className)}>
      <span className="sr-only">{label}</span>
    </span>
  );
}

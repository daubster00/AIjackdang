import { cn } from "@/lib/cn";
import styles from "./Divider.module.css";

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/** 구분선. 가로/세로 방향을 지원한다. */
export function Divider({ orientation = "horizontal", className }: DividerProps) {
  return (
    <hr
      className={cn(orientation === "vertical" ? styles.vertical : styles.horizontal, className)}
      aria-orientation={orientation}
    />
  );
}

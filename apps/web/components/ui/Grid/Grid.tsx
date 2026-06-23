import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./Grid.module.css";

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** 데스크톱 기준 열 개수(태블릿·모바일에서 자동 축소) */
  columns?: 2 | 3 | 4;
}

const COLS_CLASS = {
  2: styles.cols2,
  3: styles.cols3,
  4: styles.cols4,
} as const;

/** 반응형 그리드. 데스크톱→태블릿→모바일로 열 수를 자동 축소한다. */
export function Grid({ columns = 3, className, children, ...rest }: GridProps) {
  return (
    <div className={cn(styles.grid, COLS_CLASS[columns], className)} {...rest}>
      {children}
    </div>
  );
}

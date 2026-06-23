import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../Icon";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  /** Remix Icon 이름 */
  icon?: string;
  title: string;
  description?: string;
  /** 행동 버튼 영역(있으면 primary 1개만 권장) */
  actions?: ReactNode;
  className?: string;
}

/** 빈 상태. 원인과 다음 행동을 짧게 안내한다. */
export function EmptyState({ icon = "inbox-line", title, description, actions, className }: EmptyStateProps) {
  return (
    <div className={cn(styles.empty, className)}>
      <div className={styles.icon}>
        <Icon name={icon} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.desc}>{description}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

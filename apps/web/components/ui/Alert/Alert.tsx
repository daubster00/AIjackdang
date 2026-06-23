import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../Icon";
import styles from "./Alert.module.css";

export type AlertTone = "success" | "warning" | "danger" | "info";

export interface AlertProps {
  tone?: AlertTone;
  title: string;
  children?: ReactNode;
  className?: string;
}

const TONE_ICON: Record<AlertTone, string> = {
  success: "checkbox-circle-line",
  warning: "alert-line",
  danger: "error-warning-line",
  info: "information-line",
};

/** 인라인 알림. 색상과 함께 아이콘·텍스트로 상태를 전달한다(색상 단독 의존 금지). */
export function Alert({ tone = "info", title, children, className }: AlertProps) {
  return (
    <div className={cn(styles.alert, styles[tone], className)} role="alert">
      <Icon name={TONE_ICON[tone]} className={styles.icon} />
      <div className={styles.content}>
        <strong className={styles.title}>{title}</strong>
        {children && <span className={styles.desc}>{children}</span>}
      </div>
    </div>
  );
}

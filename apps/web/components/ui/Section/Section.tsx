import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./Section.module.css";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  tight?: boolean;
  /** 헤더 우측 액션 */
  action?: ReactNode;
}

/** 콘텐츠 섹션. 제목/설명 헤더를 선택적으로 포함한다. */
export function Section({ title, description, tight, action, className, children, ...rest }: SectionProps) {
  return (
    <section className={cn(styles.section, tight && styles.tight, className)} {...rest}>
      {(title || action) && (
        <header className={styles.header}>
          <div>
            {title && <h2 className={styles.title}>{title}</h2>}
            {description && <p className={styles.desc}>{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

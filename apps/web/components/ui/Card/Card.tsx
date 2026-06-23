import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./Card.module.css";

export type CardVariant = "default" | "highlight" | "resource" | "question" | "summary";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
  compact?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

const VARIANT_CLASS: Record<CardVariant, string | undefined> = {
  default: undefined,
  highlight: styles.highlight,
  resource: styles.resource,
  question: styles.question,
  summary: styles.summary,
};

/** 콘텐츠/자료/질문/요약을 묶는 카드. 카드 안에 또 다른 카드는 넣지 않는다. */
export function Card({
  variant = "default",
  interactive,
  compact,
  selected,
  disabled,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <article
      className={cn(
        styles.card,
        VARIANT_CLASS[variant],
        interactive && styles.interactive,
        compact && styles.compact,
        selected && styles.selected,
        disabled && styles.disabled,
        className,
      )}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      {children}
    </article>
  );
}

export function CardHead({ children }: { children: ReactNode }) {
  return <div className={styles.head}>{children}</div>;
}
export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className={styles.title}>{children}</h3>;
}
export function CardDesc({ children }: { children: ReactNode }) {
  return <p className={styles.desc}>{children}</p>;
}
export function CardMeta({ children }: { children: ReactNode }) {
  return <div className={styles.meta}>{children}</div>;
}
export function CardActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
export function CardNumber({ children }: { children: ReactNode }) {
  return <p className={styles.number}>{children}</p>;
}

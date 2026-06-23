import type { ElementType, HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./Container.module.css";

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  /** 좁은 본문 폭(읽기 중심 페이지) */
  narrow?: boolean;
  as?: ElementType;
}

/** 페이지 가로 폭을 제한하는 컨테이너. */
export function Container({ narrow, as, className, children, ...rest }: ContainerProps) {
  const Component = as ?? "div";
  return (
    <Component className={cn(styles.container, narrow && styles.narrow, className)} {...rest}>
      {children}
    </Component>
  );
}

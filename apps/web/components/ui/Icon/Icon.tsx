import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface IconProps extends HTMLAttributes<HTMLElement> {
  /** Remix Icon 이름 ("ri-" 접두사 제외). 예: "search-line" */
  name: string;
}

/**
 * Remix Icon 래퍼. 아이콘은 Remix Icon 으로 통일한다.
 * 장식용 아이콘은 aria-hidden 으로 처리하고, 의미가 있으면 부모가 aria-label 을 제공한다.
 */
export function Icon({ name, className, ...rest }: IconProps) {
  return <i className={cn(`ri-${name}`, className)} aria-hidden="true" {...rest} />;
}

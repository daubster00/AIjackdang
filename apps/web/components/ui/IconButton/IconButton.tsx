import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./IconButton.module.css";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 아이콘 전용 버튼은 접근성을 위해 라벨이 필수다. */
  "aria-label": string;
  size?: "md" | "sm";
  /** 테두리 없는 변형 */
  ghost?: boolean;
  children: ReactNode;
}

/** 아이콘 전용 버튼. aria-label 을 반드시 받는다(접근성). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = "md", ghost = false, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(styles.iconBtn, styles[size], ghost && styles.ghost, className)}
      {...rest}
    >
      {children}
    </button>
  );
});

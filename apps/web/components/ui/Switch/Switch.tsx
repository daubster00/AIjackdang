import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./Switch.module.css";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  children?: ReactNode;
}

/** 토글 스위치. 네이티브 checkbox 를 role 의미로 사용한다. */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { children, className, disabled, ...rest },
  ref,
) {
  return (
    <label className={cn(styles.wrapper, disabled && styles.disabled, className)}>
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        className={styles.native}
        disabled={disabled}
        {...rest}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {children && <span className={styles.label}>{children}</span>}
    </label>
  );
});

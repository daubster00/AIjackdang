import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../Icon";
import styles from "./Checkbox.module.css";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  children?: ReactNode;
}

/** 커스텀 체크박스. 네이티브 input 을 유지해 폼/접근성을 보장한다. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { children, className, disabled, ...rest },
  ref,
) {
  return (
    <label className={cn(styles.wrapper, disabled && styles.disabled, className)}>
      <input ref={ref} type="checkbox" className={styles.native} disabled={disabled} {...rest} />
      <span className={styles.box} aria-hidden="true">
        <Icon name="check-line" className={styles.check} />
      </span>
      {children && <span className={styles.label}>{children}</span>}
    </label>
  );
});

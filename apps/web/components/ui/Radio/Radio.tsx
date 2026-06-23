import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./Radio.module.css";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  children?: ReactNode;
}

/** 커스텀 라디오. 같은 name 을 공유해 그룹으로 동작한다. */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { children, className, disabled, ...rest },
  ref,
) {
  return (
    <label className={cn(styles.wrapper, disabled && styles.disabled, className)}>
      <input ref={ref} type="radio" className={styles.native} disabled={disabled} {...rest} />
      <span className={styles.circle} aria-hidden="true">
        <span className={styles.dot} />
      </span>
      {children && <span className={styles.label}>{children}</span>}
    </label>
  );
});

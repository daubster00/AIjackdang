import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./Input.module.css";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  required?: boolean;
  helpText?: string;
  /** 오류 메시지(있으면 오류 상태로 표시) */
  error?: string;
  /** 성공 메시지(있으면 성공 상태로 표시) */
  success?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/**
 * 라벨·도움말·상태(error/success)를 포함한 공통 텍스트 입력.
 * label 과 input 은 htmlFor/id 로 연결한다(접근성).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, required, helpText, error, success, leftIcon, rightIcon, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedById = helpText || error || success ? `${inputId}-desc` : undefined;
  const state = error ? "error" : success ? "success" : undefined;

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div
        className={cn(
          styles.control,
          Boolean(leftIcon) && styles.hasLeftIcon,
          Boolean(rightIcon) && styles.hasRightIcon,
          state === "error" && styles.isError,
          state === "success" && styles.isSuccess,
        )}
      >
        {leftIcon && <span className={cn(styles.controlIcon, styles.left)}>{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(styles.input, className)}
          required={required}
          aria-invalid={state === "error" || undefined}
          aria-describedby={describedById}
          {...rest}
        />
        {rightIcon && <span className={cn(styles.controlIcon, styles.right)}>{rightIcon}</span>}
      </div>
      {error ? (
        <span id={describedById} className={cn(styles.message, styles.error)}>
          {error}
        </span>
      ) : success ? (
        <span id={describedById} className={cn(styles.message, styles.success)}>
          {success}
        </span>
      ) : (
        helpText && (
          <span id={describedById} className={styles.help}>
            {helpText}
          </span>
        )
      )}
    </div>
  );
});

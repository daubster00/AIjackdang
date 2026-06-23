import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./Textarea.module.css";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  required?: boolean;
  /** 현재 글자 수 (제어 컴포넌트에서 표시용으로 전달) */
  currentLength?: number;
  /** 최대 글자 수 (표시용) */
  maxLengthHint?: number;
}

/** 여러 줄 입력. 선택적으로 글자 수 카운터를 표시한다. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, required, currentLength, maxLengthHint, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const showCounter = typeof maxLengthHint === "number";

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={fieldId}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        className={cn(styles.textarea, className)}
        required={required}
        maxLength={maxLengthHint}
        {...rest}
      />
      {showCounter && (
        <span className={styles.counter}>
          {(currentLength ?? 0).toLocaleString()} / {maxLengthHint?.toLocaleString()}
        </span>
      )}
    </div>
  );
});

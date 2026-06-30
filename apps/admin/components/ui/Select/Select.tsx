"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  /** 선택된 값(제어 모드). 미지정 시 내부 상태로 동작한다. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** 폼 제출용 name (숨겨진 native select에 적용) */
  name?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * 어드민 커스텀 셀렉트.
 *
 * - 브라우저 기본 셀렉트 UI를 절대 노출하지 않는다(OS 드롭다운 금지).
 * - 폼 제출/접근성을 위해 숨겨진 native <select>를 유지한다.
 * - 키보드: ArrowUp/Down 이동, Enter/Space 선택, Esc 닫기, 바깥 클릭 닫기.
 * - 옵션 overflow 시 보라색 얇은 커스텀 스크롤바로 메뉴 자체가 스크롤된다.
 */
export function Select({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  label,
  placeholder = "선택하세요",
  name,
  id,
  className,
  disabled = false,
}: SelectProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = isControlled ? controlledValue : internalValue;

  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const generatedLabelId = useId();
  const generatedTriggerId = useId();
  const labelId = generatedLabelId;
  const triggerId = id ?? generatedTriggerId;

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  function choose(next: string) {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
    setOpen(false);
  }

  function openMenu() {
    if (disabled) return;
    setOpen(true);
    setFocusedIndex(Math.max(0, options.findIndex((o) => o.value === value)));
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      if (!open) { openMenu(); return; }
      if (e.key === "ArrowDown") {
        setFocusedIndex((i) => (i + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        setFocusedIndex((i) => (i - 1 + options.length) % options.length);
      } else {
        const opt = options[focusedIndex];
        if (opt) choose(opt.value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const wrapperClass = [styles.customSelect, open ? styles.open : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      {label && (
        <span className={styles.label} id={labelId}>
          {label}
        </span>
      )}
      <div ref={rootRef} className={wrapperClass}>
        {/* 폼 제출/접근성용 숨겨진 native select */}
        <select
          className={styles.nativeSelect}
          name={name}
          value={value}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => choose(e.target.value)}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          id={triggerId}
          className={styles.trigger}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={label ? labelId : undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
        >
          <span className={selected ? undefined : styles.placeholder}>
            {selected ? selected.label : placeholder}
          </span>
          <i className={`ri-arrow-down-s-line ${styles.arrow}`} aria-hidden="true" />
        </button>

        {open && (
          <ul
            className={styles.menu}
            role="listbox"
            aria-labelledby={label ? labelId : undefined}
          >
            {options.map((opt, index) => {
              const isSelected = opt.value === value;
              const isFocused = index === focusedIndex;
              const optClass = [
                styles.option,
                isSelected ? styles.selected : "",
                isFocused ? styles.focused : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  className={optClass}
                  onMouseEnter={() => setFocusedIndex(index)}
                  onClick={() => choose(opt.value)}
                >
                  <span>{opt.label}</span>
                  <i className={`ri-check-line ${styles.check}`} aria-hidden="true" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../Icon";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  /** 선택된 값(제어). 미지정 시 내부 상태로 동작한다. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** 폼 제출용 name (숨겨진 native select 에 적용) */
  name?: string;
  disabled?: boolean;
}

/**
 * 커스텀 셀렉트.
 * - 브라우저 기본 셀렉트 UI 를 노출하지 않는다.
 * - 폼 제출/접근성을 위해 숨겨진 native <select> 를 유지한다.
 * - 키보드: ArrowUp/Down 이동, Enter/Space 선택, Esc 닫기, 바깥 클릭 닫기.
 */
export function Select({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  label,
  placeholder = "선택하세요",
  name,
  disabled = false,
}: SelectProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = isControlled ? controlledValue : internalValue;

  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
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
    setFocusedIndex(Math.max(0, options.findIndex((option) => option.value === value)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      if (event.key === "ArrowDown") {
        setFocusedIndex((index) => (index + 1) % options.length);
      } else if (event.key === "ArrowUp") {
        setFocusedIndex((index) => (index - 1 + options.length) % options.length);
      } else {
        const option = options[focusedIndex];
        if (option) choose(option.value);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.field}>
      {label && (
        <span className={styles.label} id={labelId}>
          {label}
        </span>
      )}
      <div ref={rootRef} className={cn(styles.customSelect, open && styles.open)}>
        {/* 폼 제출 / 접근성용 숨겨진 native select */}
        <select
          className={styles.nativeSelect}
          name={name}
          value={value}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => choose(event.target.value)}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
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
          <Icon name="arrow-down-s-line" className={styles.arrow} />
        </button>

        {open && (
          <ul className={styles.menu} role="listbox" aria-labelledby={label ? labelId : undefined}>
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    styles.option,
                    isSelected && styles.selected,
                    index === focusedIndex && styles.focused,
                  )}
                  onMouseEnter={() => setFocusedIndex(index)}
                  onClick={() => choose(option.value)}
                >
                  <span>{option.label}</span>
                  <Icon name="check-line" className={styles.check} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../Icon";
import styles from "./SearchInput.module.css";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onSubmit"> {
  /** 검색 실행 콜백(Enter 또는 검색 버튼 클릭 시) */
  onSearch?: (value: string) => void;
  /** 검색 버튼 라벨(숨김 처리 시 aria-label 로도 사용) */
  buttonLabel?: string;
  /** 검색 버튼 노출 여부 */
  showButton?: boolean;
}

/** 검색창. 입력 + 검색 아이콘 + (선택)검색 버튼 조합. */
export function SearchInput({
  onSearch,
  buttonLabel = "검색",
  showButton = true,
  defaultValue = "",
  className,
  placeholder = "검색어 입력",
  ...rest
}: SearchInputProps) {
  const [value, setValue] = useState(String(defaultValue));
  const inputId = useId();

  function submit() {
    onSearch?.(value);
  }

  return (
    <form
      className={styles.search}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <span className={styles.control}>
        <Icon name="search-line" className={styles.icon} />
        <label className="sr-only" htmlFor={inputId}>
          {placeholder}
        </label>
        <input
          id={inputId}
          type="search"
          className={cn(styles.input, className)}
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          {...rest}
        />
      </span>
      {showButton && (
        <button type="submit" className={styles.button} aria-label={buttonLabel}>
          <Icon name="search-line" />
          <span>{buttonLabel}</span>
        </button>
      )}
    </form>
  );
}

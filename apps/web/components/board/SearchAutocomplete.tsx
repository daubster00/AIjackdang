"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import styles from "./SearchAutocomplete.module.css";

export interface SearchAutocompleteProps {
  /** 검색 입력 라벨(스크린리더용) */
  label: string;
  placeholder?: string;
  /** 포커스 시 노출할 인기 태그 (목업 데이터, 개발 시 실제 데이터로 교체) */
  popularTags?: string[];
  /** 포커스 시 노출할 최근 검색어 (목업 데이터) */
  recentSearches?: string[];
  /** 태그/검색어 → 이동 경로 생성 함수 */
  hrefFor?: (term: string) => string;
  className?: string;
}

const DEFAULT_POPULAR = [
  "바이브코딩",
  "ClaudeCode",
  "Cursor",
  "n8n",
  "자동화",
  "프롬프트",
  "MCP",
  "수익화",
];

const DEFAULT_RECENT = ["cursor php 구조", "n8n gmail 자동화", "claude code 검증"];

/**
 * 검색창 + 자동완성 드롭다운 (목업).
 * - 입력 전(포커스): 최근 검색어 + 인기 태그 노출 (UX-DR-U10)
 * - 입력 중: 매칭되는 추천 태그 목록으로 교체
 * 실제 검색/추천 데이터는 개발 단계에서 연결한다. 현재는 형태만 구현한 목업.
 */
export function SearchAutocomplete({
  label,
  placeholder = "검색어 입력",
  popularTags = DEFAULT_POPULAR,
  recentSearches = DEFAULT_RECENT,
  hrefFor = (term) => `/tags/${encodeURIComponent(term)}`,
  className,
}: SearchAutocompleteProps) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = value.trim();
  const matches = query
    ? popularTags.filter((tag) =>
        tag.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  function openPanel() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setOpen(true);
  }

  function closeSoon() {
    // 드롭다운 항목 클릭이 blur보다 먼저 처리되도록 약간 지연
    blurTimer.current = setTimeout(() => setOpen(false), 120);
  }

  const panelId = `${inputId}-panel`;

  return (
    <form
      className={cn(styles.form, className)}
      role="search"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className={styles.box}>
        <Icon name="search-line" />
        <label className="sr-only" htmlFor={inputId}>
          {label}
        </label>
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={panelId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={openPanel}
          onBlur={closeSoon}
        />
      </div>
      <button type="submit" className={styles.button}>
        검색
      </button>

      {open ? (
        <div id={panelId} className={styles.panel} role="listbox" aria-label="검색 추천">
          {query ? (
            matches.length > 0 ? (
              <ul className={styles.matchList}>
                {matches.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={hrefFor(tag)}
                      className={styles.matchItem}
                      role="option"
                      aria-selected={false}
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      <Icon name="search-line" />
                      <span>#{tag}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>
                &lsquo;{query}&rsquo;에 해당하는 추천 태그가 없습니다
              </p>
            )
          ) : (
            <>
              {recentSearches.length > 0 ? (
                <section className={styles.section}>
                  <p className={styles.sectionTitle}>최근 검색어</p>
                  <div className={styles.chips}>
                    {recentSearches.map((term) => (
                      <Link
                        key={term}
                        href={hrefFor(term)}
                        className={styles.chip}
                        onMouseDown={(event) => event.preventDefault()}
                      >
                        <Icon name="history-line" />
                        {term}
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className={styles.section}>
                <p className={styles.sectionTitle}>인기 태그</p>
                <div className={styles.chips}>
                  {popularTags.map((tag) => (
                    <Link
                      key={tag}
                      href={hrefFor(tag)}
                      className={styles.chip}
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}

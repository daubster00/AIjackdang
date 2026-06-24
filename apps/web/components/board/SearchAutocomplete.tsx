"use client";

import { useId, useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import styles from "./SearchAutocomplete.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4003";
const DEBOUNCE_MS = 300;

export interface SearchAutocompleteProps {
  /** 검색 입력 라벨(스크린리더용) */
  label: string;
  placeholder?: string;
  /** 포커스 시 노출할 인기 태그 (서버 사이드 프리패치용, 없으면 클라이언트에서 fetch) */
  popularTags?: string[];
  /** 포커스 시 노출할 최근 검색어 */
  recentSearches?: string[];
  /** 태그/검색어 → 이동 경로 생성 함수 */
  hrefFor?: (term: string) => string;
  className?: string;
}

interface PopularTagItem {
  name: string;
  slug: string;
  usageCount: number;
}

interface AutocompleteItem {
  id: string;
  name: string;
  usageCount: number;
}

const DEFAULT_RECENT = ["cursor php 구조", "n8n gmail 자동화", "claude code 검증"];

/**
 * 검색창 + 자동완성 드롭다운 (Story 8.4 실 API 연결).
 * - 입력 전(포커스): 최근 검색어 + 인기 태그(/api/v1/tags/popular) 노출 (UX-DR-U10)
 * - 입력 중(2자 이상): /api/v1/tags/autocomplete?q= 매칭 결과로 교체
 * - popularTags prop이 전달되면 API fetch 스킵 (서버 사이드 프리패치 활용)
 */
export function SearchAutocomplete({
  label,
  placeholder = "검색어 입력",
  popularTags: popularTagsProp,
  recentSearches = DEFAULT_RECENT,
  hrefFor = (term) => `/tags/${encodeURIComponent(term)}`,
  className,
}: SearchAutocompleteProps) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [popularTags, setPopularTags] = useState<string[]>(popularTagsProp ?? []);
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([]);
  const [popularLoaded, setPopularLoaded] = useState((popularTagsProp?.length ?? 0) > 0);

  const inputId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const query = value.trim();

  // ── 인기 태그 fetch (포커스 시 1회) ─────────────────────────────────────────
  const fetchPopularTags = useCallback(async () => {
    if (popularLoaded) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/tags/popular?limit=20`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: PopularTagItem[] };
      setPopularTags((data.items ?? []).map((t) => t.name));
      setPopularLoaded(true);
    } catch {
      // 무시 — 기존 popularTagsProp 유지
    }
  }, [popularLoaded]);

  // ── 자동완성 fetch (입력 2자 이상, debounce) ──────────────────────────────
  const fetchAutocomplete = useCallback(async (q: string) => {
    if (q.length < 2) {
      setAutocompleteItems([]);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/tags/autocomplete?q=${encodeURIComponent(q)}&limit=10`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setAutocompleteItems([]);
        return;
      }
      const data = (await res.json()) as { items: AutocompleteItem[] };
      setAutocompleteItems(data.items ?? []);
    } catch {
      setAutocompleteItems([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchAutocomplete(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchAutocomplete]);

  function openPanel() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setOpen(true);
    void fetchPopularTags();
  }

  function closeSoon() {
    // 드롭다운 항목 클릭이 blur보다 먼저 처리되도록 약간 지연
    blurTimer.current = setTimeout(() => setOpen(false), 120);
  }

  const panelId = `${inputId}-panel`;

  // 입력 중이면 autocomplete 결과, 아니면 인기 태그 로컬 필터
  const showAutocomplete = query.length >= 2;
  const displayItems = showAutocomplete ? autocompleteItems : [];
  const displayPopular = !showAutocomplete ? popularTags : [];

  return (
    <form
      className={cn(styles.form, className)}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          setOpen(false);
          router.push(`/search?q=${encodeURIComponent(trimmed)}&type=all&page=1`);
        }
      }}
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
          {showAutocomplete ? (
            displayItems.length > 0 ? (
              <ul className={styles.matchList}>
                {displayItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={hrefFor(item.name)}
                      className={styles.matchItem}
                      role="option"
                      aria-selected={false}
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      <Icon name="search-line" />
                      <span>#{item.name}</span>
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
                  {displayPopular.length > 0 ? (
                    displayPopular.map((tag) => (
                      <Link
                        key={tag}
                        href={hrefFor(tag)}
                        className={styles.chip}
                        onMouseDown={(event) => event.preventDefault()}
                      >
                        #{tag}
                      </Link>
                    ))
                  ) : (
                    <span className={styles.loadingHint}>로딩 중…</span>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}

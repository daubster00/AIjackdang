"use client";

/**
 * TagInput — 태그 입력 컴포넌트 (Story 2.7 AC #7 + Story 8.4 AC #3~#6)
 *
 * - 포커스 시 /api/v1/tags/popular 인기 태그 섹션 표시 (Story 8.4 AC #3)
 * - 입력 2자 이상 시 debounce(300ms) → GET /api/v1/tags/autocomplete?q= → 드롭다운
 * - 방향키+Enter/Space 선택, Backspace 마지막 태그 삭제
 * - 최대 10개 초과 시 입력 비활성
 * - 쉼표(,) 또는 Enter 로 자유 태그 추가
 * - 드롭다운: role="listbox", 각 항목 role="option", aria-haspopup/aria-expanded/aria-activedescendant
 * - 칩 삭제: aria-label="태그 {name} 삭제" (UX-DR-U9)
 */

import { useState, useCallback, useRef, useEffect, useId } from "react";
import styles from "./TagInput.module.css";

const MAX_TAGS = 10;
const DEBOUNCE_MS = 300;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4003";

interface TagSuggestion {
  id: string;
  name: string;
  usageCount: number;
}

interface PopularTag {
  name: string;
  slug: string;
  usageCount: number;
}

interface TagInputProps {
  /** 현재 선택된 태그 배열 */
  value: string[];
  /** 태그 배열 변경 콜백 */
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** 추천 태그 (게시판별 고정 추천, 하위 호환용 optional) */
  suggestedTags?: string[];
  /** 최대 태그 수 (기본 10) */
  maxTags?: number;
  disabled?: boolean;
}

export function TagInput({
  value,
  onChange,
  placeholder = "태그를 입력하세요",
  suggestedTags = [],
  maxTags = MAX_TAGS,
  disabled = false,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [popularTags, setPopularTags] = useState<PopularTag[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [popularLoaded, setPopularLoaded] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();

  // ── 인기 태그 fetch (포커스 시 1회) ─────────────────────────────────────────
  const fetchPopularTags = useCallback(async () => {
    if (popularLoaded) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/tags/popular?limit=20`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: PopularTag[] };
      setPopularTags(data.items ?? []);
      setPopularLoaded(true);
    } catch {
      // 무시
    }
  }, [popularLoaded]);

  // ── API 자동완성 ────────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/tags/autocomplete?q=${encodeURIComponent(q.trim())}&limit=10`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setSuggestions([]);
        return;
      }
      const data = (await res.json()) as { items: TagSuggestion[] };
      setSuggestions(data.items ?? []);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInput(val);
      setOpen(true);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void fetchSuggestions(val);
      }, DEBOUNCE_MS);
    },
    [fetchSuggestions],
  );

  // 컴포넌트 unmount 시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── 태그 추가 ──────────────────────────────────────────────────────────────
  const addTag = useCallback(
    (tagName: string) => {
      const trimmed = tagName.trim().replace(/^#/, "");
      if (!trimmed) return;
      if (value.includes(trimmed)) return;
      if (value.length >= maxTags) return;
      onChange([...value, trimmed]);
      setInput("");
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
    },
    [value, onChange, maxTags],
  );

  // ── 태그 제거 ──────────────────────────────────────────────────────────────
  const removeTag = useCallback(
    (idx: number) => {
      onChange(value.filter((_, i) => i !== idx));
    },
    [value, onChange],
  );

  // ── 키보드 처리 ─────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          suggestions.length === 0 ? -1 : Math.min(prev + 1, suggestions.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          addTag(suggestions[activeIndex].name);
        } else {
          addTag(input);
        }
      } else if (e.key === " " && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        addTag(suggestions[activeIndex].name);
      } else if (e.key === ",") {
        e.preventDefault();
        addTag(input);
      } else if (e.key === "Backspace" && input === "" && value.length > 0) {
        onChange(value.slice(0, -1));
      } else if (e.key === "Escape") {
        setOpen(false);
        setSuggestions([]);
        setActiveIndex(-1);
      }
    },
    [activeIndex, addTag, input, suggestions, value, onChange],
  );

  const handleFocus = useCallback(() => {
    setOpen(true);
    void fetchPopularTags();
  }, [fetchPopularTags]);

  const handleBlur = useCallback(() => {
    // 드롭다운 클릭 처리를 위해 약간 지연
    setTimeout(() => {
      setOpen(false);
      setSuggestions([]);
      setActiveIndex(-1);
    }, 150);
  }, []);

  const isAtMax = value.length >= maxTags;

  // 현재 활성 항목의 id
  const activeDescendant =
    open && activeIndex >= 0 ? `tag-option-${activeIndex}` : undefined;

  // 드롭다운에 표시할 항목: 입력 2자+ → suggestions, 그외 → 인기 태그
  const showSuggestions = open && input.trim().length >= 2 && suggestions.length > 0;
  const showPopular = open && input.trim().length < 2 && (popularTags.length > 0 || suggestedTags.length > 0);

  return (
    <div className={styles.tagInput}>
      {/* 선택된 태그 칩 + 입력창 */}
      <div
        className={styles.tagField}
        onClick={() => !isAtMax && inputRef.current?.focus()}
        role="group"
        aria-label="태그 입력 영역"
      >
        {value.map((tag, i) => (
          <span key={i} className={styles.tagChip}>
            #{tag}
            <button
              type="button"
              className={styles.removeBtn}
              aria-label={`태그 ${tag} 삭제`}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
              disabled={disabled}
            >
              ×
            </button>
          </span>
        ))}

        {!isAtMax && (
          <input
            ref={inputRef}
            id={`${listboxId}-input`}
            className={styles.input}
            type="text"
            role="combobox"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={value.length === 0 ? placeholder : `태그 추가 (최대 ${maxTags}개)`}
            aria-label="태그 입력"
            aria-haspopup="listbox"
            aria-expanded={open && (showSuggestions || showPopular)}
            aria-activedescendant={activeDescendant}
            aria-controls={`${listboxId}-listbox`}
            disabled={disabled}
            autoComplete="off"
          />
        )}
      </div>

      {/* 자동완성 드롭다운 */}
      {showSuggestions && (
        <ul
          id={`${listboxId}-listbox`}
          className={styles.dropdown}
          role="listbox"
          aria-label="태그 추천"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`tag-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`${styles.dropdownItem} ${i === activeIndex ? styles.dropdownItemActive : ""}`}
              onMouseDown={(e) => {
                e.preventDefault(); // blur 방지
                addTag(s.name);
              }}
            >
              #{s.name}
              {s.usageCount > 0 && (
                <span className={styles.usageCount}>{s.usageCount}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 인기 태그 드롭다운 (포커스 시, 입력 없을 때) */}
      {showPopular && (
        <div
          id={`${listboxId}-listbox`}
          className={styles.popularDropdown}
          role="listbox"
          aria-label="인기 태그"
        >
          {popularTags.length > 0 && (
            <section>
              <p className={styles.sectionTitle}>인기 태그</p>
              <div className={styles.popularChips}>
                {popularTags
                  .filter((t) => !value.includes(t.name))
                  .slice(0, 10)
                  .map((tag) => (
                    <button
                      key={tag.name}
                      type="button"
                      className={styles.suggestedTag}
                      disabled={isAtMax || disabled}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addTag(tag.name);
                      }}
                    >
                      #{tag.name}
                    </button>
                  ))}
              </div>
            </section>
          )}

          {/* 게시판별 추천 태그 (하위 호환) */}
          {suggestedTags.filter((t) => !value.includes(t)).length > 0 && (
            <section>
              <p className={styles.sectionTitle}>추천 태그</p>
              <div className={styles.popularChips}>
                {suggestedTags
                  .filter((t) => !value.includes(t))
                  .slice(0, 10)
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={styles.suggestedTag}
                      disabled={isAtMax || disabled}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addTag(tag);
                      }}
                    >
                      #{tag}
                    </button>
                  ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

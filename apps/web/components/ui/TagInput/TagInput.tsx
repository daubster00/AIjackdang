"use client";

/**
 * TagInput — 태그 입력 컴포넌트 (Story 2.7 AC #7)
 *
 * - 입력 중 debounce 300ms → GET /api/v1/tags?q= → 드롭다운 최대 5개
 * - 방향키+Enter 선택, Backspace 마지막 태그 삭제
 * - 최대 10개 초과 시 입력 비활성
 * - 쉼표(,) 또는 Enter 로 자유 태그 추가
 */

import { useState, useCallback, useRef, useEffect } from "react";
import styles from "./TagInput.module.css";

const MAX_TAGS = 10;
const DEBOUNCE_MS = 300;

interface TagSuggestion {
  id: string;
  name: string;
  slug: string;
}

interface TagInputProps {
  /** 현재 선택된 태그 배열 */
  value: string[];
  /** 태그 배열 변경 콜백 */
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** 추천 태그 (게시판별 고정 추천) */
  suggestedTags?: string[];
  disabled?: boolean;
}

export function TagInput({
  value,
  onChange,
  placeholder = "태그를 입력하세요",
  suggestedTags = [],
  disabled = false,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── API 자동완성 ────────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/v1/tags?q=${encodeURIComponent(q.trim())}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setSuggestions([]);
        return;
      }
      const data = (await res.json()) as { items: TagSuggestion[] };
      setSuggestions(data.items ?? []);
      setShowDropdown(data.items.length > 0);
      setActiveSuggestionIdx(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInput(val);

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
      if (value.length >= MAX_TAGS) return;
      onChange([...value, trimmed]);
      setInput("");
      setSuggestions([]);
      setShowDropdown(false);
      setActiveSuggestionIdx(-1);
    },
    [value, onChange],
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
        setActiveSuggestionIdx((prev) =>
          suggestions.length === 0 ? -1 : Math.min(prev + 1, suggestions.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestionIdx((prev) => Math.max(prev - 1, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeSuggestionIdx >= 0 && suggestions[activeSuggestionIdx]) {
          addTag(suggestions[activeSuggestionIdx].name);
        } else {
          addTag(input);
        }
      } else if (e.key === ",") {
        e.preventDefault();
        addTag(input);
      } else if (e.key === "Backspace" && input === "" && value.length > 0) {
        onChange(value.slice(0, -1));
      } else if (e.key === "Escape") {
        setShowDropdown(false);
        setSuggestions([]);
        setActiveSuggestionIdx(-1);
      }
    },
    [activeSuggestionIdx, addTag, input, suggestions, value, onChange],
  );

  const handleBlur = useCallback(() => {
    // 드롭다운 클릭 처리를 위해 약간 지연
    setTimeout(() => {
      setShowDropdown(false);
      setSuggestions([]);
      setActiveSuggestionIdx(-1);
    }, 150);
  }, []);

  const isAtMax = value.length >= MAX_TAGS;

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
              aria-label={`${tag} 태그 제거`}
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
            className={styles.input}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={() => input.trim() && setShowDropdown(suggestions.length > 0)}
            placeholder={value.length === 0 ? placeholder : "태그 추가 (최대 10개)"}
            aria-label="태그 입력"
            disabled={disabled}
            autoComplete="off"
          />
        )}
      </div>

      {/* 자동완성 드롭다운 */}
      {showDropdown && suggestions.length > 0 && (
        <ul className={styles.dropdown} role="listbox" aria-label="태그 추천">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === activeSuggestionIdx}
              className={`${styles.dropdownItem} ${i === activeSuggestionIdx ? styles.dropdownItemActive : ""}`}
              onMouseDown={(e) => {
                e.preventDefault(); // blur 방지
                addTag(s.name);
              }}
            >
              #{s.name}
            </li>
          ))}
        </ul>
      )}

      {/* 추천 태그 */}
      {suggestedTags.length > 0 && (
        <div className={styles.suggested}>
          <span className={styles.suggestedLabel}>추천 태그:</span>
          {suggestedTags
            .filter((t) => !value.includes(t))
            .slice(0, 10)
            .map((tag) => (
              <button
                key={tag}
                type="button"
                className={styles.suggestedTag}
                disabled={isAtMax || disabled}
                onClick={() => addTag(tag)}
              >
                #{tag}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

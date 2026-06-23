"use client";

/**
 * 별점 입력 컴포넌트 — Story 4.7
 *
 * 재사용 가능한 1~5점 별점 입력 UI.
 * - hover 미리보기 + click 확정
 * - disabled: 색상 약화 + 클릭 차단 + 텍스트 안내(color-only 금지)
 * - 접근성: aria-label, aria-pressed, sr-only 현재 선택값
 */

import { useState } from "react";
import styles from "./RatingInput.module.css";

export interface RatingInputProps {
  /** 현재 선택된 점수 (0 = 미선택) */
  value: number;
  /** 별점 클릭 시 호출 (disabled/readOnly 시 호출 안 됨) */
  onChange?: (score: number) => void;
  /** 비활성 — 클릭 차단 + 시각 약화 */
  disabled?: boolean;
  /** 읽기 전용 — hover 효과 없음, onChange 호출 안 됨 */
  readOnly?: boolean;
  /** 비활성 시 표시할 안내 텍스트 */
  disabledLabel?: string;
  /** 컨테이너 추가 className */
  className?: string;
}

const STAR_COUNT = 5;

export function RatingInput({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  disabledLabel = "로그인 후 평점 등록",
  className,
}: RatingInputProps) {
  const [hoverScore, setHoverScore] = useState(0);

  const interactive = !disabled && !readOnly;

  /** 실제 표시할 점수: hover 중이면 hover 값, 아니면 현재 선택 값 */
  const displayScore = interactive && hoverScore > 0 ? hoverScore : value;

  const handleClick = (score: number) => {
    if (!interactive) return;
    onChange?.(score);
  };

  const handleMouseEnter = (score: number) => {
    if (!interactive) return;
    setHoverScore(score);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    setHoverScore(0);
  };

  return (
    <div
      className={[styles.ratingInput, disabled ? styles.disabled : "", className ?? ""].join(" ").trim()}
    >
      <div
        className={styles.stars}
        role="group"
        aria-label={disabled ? disabledLabel : "별점 선택 (1~5점)"}
        onMouseLeave={handleMouseLeave}
      >
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const n = i + 1;
          const isOn = n <= displayScore;

          return (
            <button
              key={n}
              type="button"
              className={[styles.star, isOn ? styles.starOn : styles.starOff].join(" ")}
              onClick={() => handleClick(n)}
              onMouseEnter={() => handleMouseEnter(n)}
              disabled={disabled}
              aria-label={`${n}점으로 평점 등록`}
              aria-pressed={value === n}
            >
              {/* 별 아이콘 — CSS로 렌더 */}
              <span aria-hidden="true">{isOn ? "★" : "☆"}</span>
            </button>
          );
        })}
      </div>

      {/* 현재 선택값을 스크린 리더에 전달 */}
      <span className={styles.srOnly}>
        {value > 0 ? `현재 ${value}점 선택됨` : "미선택"}
      </span>

      {/* 비활성 안내 텍스트 (color-only 금지 대응) */}
      {disabled && (
        <span className={styles.disabledLabel} aria-hidden="true">
          {disabledLabel}
        </span>
      )}
    </div>
  );
}

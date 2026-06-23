"use client";

import styles from "./resource-new.module.css";

const STEP_LABELS = [
  "유형 선택",
  "공통 정보",
  "첨부파일",
  "사용법",
  "태그",
  "미리보기",
  "등록",
];

interface StepIndicatorProps {
  /** 현재 활성 스텝 (1~7) */
  currentStep: number;
  /** 완료 처리할 최대 스텝 번호 (currentStep - 1 이하 스텝은 완료로 표시) */
  onStepClick: (step: number) => void;
}

/**
 * 7-Step 자료 등록 폼의 상단 진행 표시자.
 *
 * - 완료된 스텝(< currentStep): 클릭 가능, 체크 표시.
 * - 현재 스텝(= currentStep): 활성 스타일.
 * - 미완료 스텝(> currentStep): 클릭 불가, 시각적 비활성.
 */
export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav
      className={styles.stepIndicator}
      aria-label="자료 등록 단계"
    >
      {STEP_LABELS.map((label, idx) => {
        const step = idx + 1;
        const isDone = step < currentStep;
        const isActive = step === currentStep;
        const isDisabled = step > currentStep;

        return (
          <button
            key={step}
            type="button"
            className={[
              styles.stepItem,
              isActive ? styles.stepActive : "",
              isDone ? styles.stepCompleted : "",
              isDisabled ? styles.stepDisabled : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => !isDisabled && onStepClick(step)}
            disabled={isDisabled}
            aria-current={isActive ? "step" : undefined}
            aria-disabled={isDisabled}
            title={`Step ${step}: ${label}`}
          >
            <span className={styles.stepNumber}>
              {isDone ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12l5 5L20 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                step
              )}
            </span>
            <span className={styles.stepLabel}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

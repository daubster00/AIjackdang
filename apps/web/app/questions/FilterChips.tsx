"use client";

/**
 * 상태 필터 칩 — Story 3.2
 *
 * 칩 클릭 시 URL ?status= 파라미터를 업데이트하고 SSR 재요청으로 목록이 필터링된다.
 * 필터 변경 시 page 파라미터는 1로 리셋한다 (URL 상태 설계 UX-DR-U2).
 *
 * ⚠️ SSR 500 함정 방지:
 *   이 파일의 STATUS_FILTERS 상수를 서버 컴포넌트(page.tsx)가 import 하면
 *   런타임 500이 발생한다. 상수는 반드시 이 파일(클라이언트 컴포넌트) 안에만 선언.
 */

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./questions.module.css";

export interface StatusFilter {
  value: string;
  label: string;
}

export const STATUS_FILTERS: StatusFilter[] = [
  { value: "all", label: "전체" },
  { value: "waiting", label: "답변대기" },
  { value: "answered", label: "답변있음" },
  { value: "resolved", label: "해결됨" },
  { value: "popular", label: "인기질문" },
];

interface FilterChipsProps {
  currentStatus: string;
}

export function FilterChips({ currentStatus }: FilterChipsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleClick(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    // 필터 변경 시 page 파라미터 리셋 (UX-DR-U2)
    params.delete("page");
    router.push(`/questions?${params.toString()}`);
  }

  return (
    <div className={styles.filterGroup} role="group" aria-label="상태 필터">
      {STATUS_FILTERS.map((filter) => {
        const isActive =
          filter.value === currentStatus ||
          (filter.value === "all" && (currentStatus === "all" || !currentStatus));
        return (
          <button
            key={filter.value}
            type="button"
            className={styles.filterChip}
            aria-pressed={isActive}
            onClick={() => handleClick(filter.value)}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

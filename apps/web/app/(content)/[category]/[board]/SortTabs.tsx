"use client";

/**
 * 게시판 정렬 탭 클라이언트 컴포넌트 — Story 2.3
 *
 * URL ?sort= 쿼리를 업데이트하여 서버 재렌더를 유도한다.
 * role=tablist + aria-selected 접근성. 모바일 가로 스크롤 지원.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import styles from "./SortTabs.module.css";

export type SortValue = "latest" | "popular" | "most-comments";

interface SortTab {
  value: SortValue;
  label: string;
}

const SORT_TABS: SortTab[] = [
  { value: "latest", label: "최신" },
  { value: "popular", label: "인기" },
  { value: "most-comments", label: "댓글 많은" },
];

interface SortTabsProps {
  currentSort: SortValue;
}

export function SortTabs({ currentSort }: SortTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSort = useCallback(
    (sort: SortValue) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", sort);
      // 정렬 변경 시 페이지를 1로 초기화
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className={styles.tabsWrapper}>
      <div role="tablist" aria-label="게시글 정렬" className={styles.tabs}>
        {SORT_TABS.map((tab) => {
          const isSelected = tab.value === currentSort;
          return (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={isSelected}
              className={`${styles.tab} ${isSelected ? styles.tabActive : ""}`}
              onClick={() => handleSort(tab.value)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

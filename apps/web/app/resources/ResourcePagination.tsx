"use client";

/**
 * ResourcePagination — 실전자료 페이지네이션 (Story 4.2)
 *
 * 4개 독립 페이지가 공유.
 * URL searchParams 기반 페이지 이동 (router.push).
 * aria-current="page" 적용, 무한스크롤 미사용 (AR-13).
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Icon } from "@/components/ui/Icon";
import styles from "./ResourcePagination.module.css";

export interface ResourcePaginationProps {
  page: number;
  totalPages: number;
  /** 한 번에 보여줄 페이지 번호 개수 */
  windowSize?: number;
}

function buildWindow(page: number, totalPages: number, windowSize: number): number[] {
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let i = start; i <= end; i += 1) pages.push(i);
  return pages;
}

export function ResourcePagination({ page, totalPages, windowSize = 5 }: ResourcePaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goToPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(p));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  if (totalPages <= 1) return null;

  const pages = buildWindow(page, totalPages, windowSize);
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <nav className={styles.pagination} aria-label="페이지 이동">
      <button
        type="button"
        className={styles.pageBtn}
        aria-label="이전 페이지"
        disabled={atStart}
        onClick={() => goToPage(page - 1)}
      >
        <Icon name="arrow-left-s-line" />
      </button>

      {/* 모바일 축약형: 앞뒤가 많을 때 줄임표 표시 */}
      {pages[0] > 1 && (
        <>
          <button type="button" className={styles.pageBtn} onClick={() => goToPage(1)}>
            1
          </button>
          {pages[0] > 2 && (
            <span className={styles.ellipsis} aria-hidden="true">
              …
            </span>
          )}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`${styles.pageBtn}${p === page ? ` ${styles.active}` : ""}`}
          aria-current={p === page ? "page" : undefined}
          onClick={() => goToPage(p)}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className={styles.ellipsis} aria-hidden="true">
              …
            </span>
          )}
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => goToPage(totalPages)}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        type="button"
        className={styles.pageBtn}
        aria-label="다음 페이지"
        disabled={atEnd}
        onClick={() => goToPage(page + 1)}
      >
        <Icon name="arrow-right-s-line" />
      </button>
    </nav>
  );
}

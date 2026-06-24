"use client";

/**
 * Q&A 목록 페이지네이션 — Story 3.2
 *
 * URL ?page= 파라미터를 업데이트하는 클라이언트 컴포넌트.
 * aria-current="page" 현재 페이지 표시 (UX-DR-U3).
 * 모바일 축약형: 현재/전체 + 이전·다음 버튼.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui";
import styles from "./questions.module.css";

interface QuestionsPaginationProps {
  page: number;
  totalPages: number;
}

function buildWindow(page: number, totalPages: number, windowSize: number): number[] {
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

export function QuestionsPagination({ page, totalPages }: QuestionsPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (p === 1) {
      params.delete("page");
    } else {
      params.set("page", String(p));
    }
    router.push(`/questions?${params.toString()}`);
  }

  if (totalPages <= 1) return null;

  const pages = buildWindow(page, totalPages, 5);
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <nav className={styles.pagination} aria-label="페이지 이동">
      <button
        type="button"
        aria-label="이전 페이지"
        disabled={atStart}
        onClick={() => goToPage(page - 1)}
      >
        <Icon name="arrow-left-s-line" />
      </button>

      {/* 데스크톱: 번호 버튼 */}
      <span className={styles.pageNumbers}>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            aria-current={p === page ? "page" : undefined}
            onClick={() => goToPage(p)}
          >
            {p}
          </button>
        ))}
      </span>

      {/* 모바일 축약형: 현재/전체 */}
      <span className={styles.pageMobile} aria-label={`${page} / ${totalPages} 페이지`}>
        {page} / {totalPages}
      </span>

      <button
        type="button"
        aria-label="다음 페이지"
        disabled={atEnd}
        onClick={() => goToPage(page + 1)}
      >
        <Icon name="arrow-right-s-line" />
      </button>
    </nav>
  );
}

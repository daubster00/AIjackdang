import { cn } from "@/lib/cn";
import { Icon } from "../Icon";
import styles from "./Pagination.module.css";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** 한 번에 보여줄 페이지 번호 개수 */
  windowSize?: number;
  className?: string;
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

/** 페이지네이션. 처음/이전/번호/다음/마지막을 제공한다. */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  windowSize = 5,
  className,
}: PaginationProps) {
  const pages = buildWindow(page, totalPages, windowSize);
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <nav className={cn(styles.pagination, className)} aria-label="페이지 이동">
      <button
        type="button"
        className={styles.pageBtn}
        aria-label="처음 페이지"
        disabled={atStart}
        onClick={() => onPageChange(1)}
      >
        <Icon name="skip-left-line" />
      </button>
      <button
        type="button"
        className={styles.pageBtn}
        aria-label="이전 페이지"
        disabled={atStart}
        onClick={() => onPageChange(page - 1)}
      >
        <Icon name="arrow-left-s-line" />
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={cn(styles.pageBtn, p === page && styles.active)}
          aria-current={p === page ? "page" : undefined}
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        className={styles.pageBtn}
        aria-label="다음 페이지"
        disabled={atEnd}
        onClick={() => onPageChange(page + 1)}
      >
        <Icon name="arrow-right-s-line" />
      </button>
      <button
        type="button"
        className={styles.pageBtn}
        aria-label="마지막 페이지"
        disabled={atEnd}
        onClick={() => onPageChange(totalPages)}
      >
        <Icon name="skip-right-line" />
      </button>
    </nav>
  );
}

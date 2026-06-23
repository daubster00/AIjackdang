"use client";

/**
 * 게시판 URL 기반 페이지네이션 클라이언트 컴포넌트 — Story 2.3
 *
 * 기존 Pagination 컴포넌트(onPageChange 콜백 기반)를 URL 라우터에 연결한다.
 * SSR 목록 페이지에서 페이지 이동을 URL 쿼리 변경으로 처리한다.
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Pagination } from "@/components/ui";

interface BoardPaginationProps {
  page: number;
  totalPages: number;
}

export function BoardPagination({ page, totalPages }: BoardPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newPage === 1) {
        params.delete("page");
      } else {
        params.set("page", String(newPage));
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  if (totalPages <= 1) return null;

  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      onPageChange={handlePageChange}
    />
  );
}

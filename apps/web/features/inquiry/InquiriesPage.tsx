"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, Pagination, Skeleton } from "@/components/ui";
import { InquiryListItem, type InquiryListItemData } from "./InquiryListItem";
import styles from "./inquiry.module.css";

// ── API 응답 타입 ─────────────────────────────────────────────────────────────

interface InquiryListMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface InquiryListResponse {
  items: InquiryListItemData[];
  meta: InquiryListMeta;
}

// ── 스켈레톤 ──────────────────────────────────────────────────────────────────

function InquiryListSkeleton() {
  return (
    <div className={styles.skeletonList}>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} height={72} className={styles.skeletonItem} />
      ))}
    </div>
  );
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export function InquiriesPage() {
  const router = useRouter();
  const [items, setItems] = useState<InquiryListItemData[]>([]);
  const [meta, setMeta] = useState<InquiryListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInquiries = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/inquiries?page=${targetPage}&pageSize=${PAGE_SIZE}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) {
        setError("문의 목록을 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as InquiryListResponse;
      setItems(data.items);
      setMeta(data.meta);
    } catch {
      setError("문의 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInquiries(page);
  }, [fetchInquiries, page]);

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* 페이지 헤더 */}
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>1:1 문의</h1>
          <Button
            variant="primary"
            onClick={() => router.push("/inquiries/new")}
          >
            새 문의 작성
          </Button>
        </div>

        {/* 목록 영역 */}
        {loading ? (
          <InquiryListSkeleton />
        ) : error ? (
          <EmptyState
            icon="error-warning-line"
            title="불러오기 실패"
            description={error}
            actions={
              <Button variant="ghost" onClick={() => fetchInquiries(page)}>
                다시 시도
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="customer-service-2-line"
            title="아직 문의 내역이 없어요."
            description="궁금하신 점이나 도움이 필요하신 사항을 문의해 주세요."
            actions={
              <Button variant="primary" onClick={() => router.push("/inquiries/new")}>
                새 문의 작성
              </Button>
            }
          />
        ) : (
          <>
            <div className={styles.listStack}>
              {items.map((item) => (
                <InquiryListItem key={item.id} item={item} />
              ))}
            </div>
            {meta && meta.totalPages > 1 && (
              <div className={styles.paginationWrapper}>
                <Pagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

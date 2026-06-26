"use client";

/**
 * 마이페이지 내 자료 탭 컴포넌트 (Story 4.9)
 *
 * GET /api/v1/me/resources 호출 → 본인 등록 자료 목록 표시.
 * - 상태 배지: published(success) / draft(warning "임시저장") / hidden(danger "숨김 처리됨")
 * - draft: [이어 작성하기] 링크 → 4단계 등록 폼
 * - hidden: hiddenReason 사유 안내
 * - EmptyState + [첫 자료 등록하기] 버튼
 * - [수정] → /resources/{id}/edit, [삭제] → 확인 다이얼로그 → DELETE API → 목록 갱신
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, EmptyState, Icon } from "@/components/ui";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { useToast } from "@/components/ui/Toast/Toast";
import type { MyResourceCard } from "@ai-jakdang/contracts";
import styles from "./mypage.module.css";
import resourceStyles from "./MyResourceList.module.css";

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** 날짜 ISO → "YYYY.MM.DD" 포맷 */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}`;
  } catch {
    return "";
  }
}

/** 평점 소수점 1자리 표시 */
function formatRating(avg: number, count: number): string {
  if (count === 0) return "평점 없음";
  return `★ ${avg.toFixed(1)} (${count})`;
}

export function MyResourceList() {
  const { toast } = useToast();
  const [items, setItems] = useState<MyResourceCard[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MyResourceCard | null>(null);

  const fetchMyResources = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/me/resources?page=${page}&pageSize=20`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          setError("로그인이 필요합니다.");
        } else {
          setError("자료 목록을 불러오지 못했습니다.");
        }
        return;
      }
      const data = (await res.json()) as { items: MyResourceCard[]; meta: PaginationMeta };
      setItems(data.items ?? []);
      setMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
    } catch {
      setError("자료 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMyResources(1);
  }, [fetchMyResources]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const item = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/v1/resources/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        await fetchMyResources(meta.page);
      } else {
        const data = (await res.json()) as { error?: { message?: string } };
        toast({ tone: "danger", title: data?.error?.message ?? "삭제에 실패했습니다." });
      }
    } catch {
      toast({ tone: "danger", title: "삭제 중 오류가 발생했습니다." });
    } finally {
      setDeletingId(null);
    }
  }, [deleteTarget, fetchMyResources, meta.page, toast]);

  if (loading) {
    return (
      <div className={resourceStyles.loadingState}>
        <Icon name="loader-4-line" />
        <span>자료 목록을 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="error-warning-line"
        title="자료를 불러오지 못했습니다"
        description={error}
        actions={
          <Button variant="secondary" onClick={() => void fetchMyResources(1)}>
            다시 시도
          </Button>
        }
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="file-download-line"
        title="등록한 자료가 없습니다"
        description="유용한 자료를 공유해 커뮤니티에 기여해 보세요."
        actions={
          <Link href="/resources/new">
            <Button>첫 자료 등록하기</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className={resourceStyles.resourceListWrap}>
      <DeleteConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
        title="자료를 삭제하시겠습니까?"
        description={deleteTarget ? `"${deleteTarget.title}" 자료를 삭제하면 복구할 수 없습니다.` : "삭제된 자료는 복구할 수 없습니다."}
      />
      <ul className={styles.activityList}>
        {items.map((item) => (
          <li key={item.id} className={styles.activityItem}>
            {/* 상단 행: 상태 배지 + 관리 버튼 */}
            <div className={styles.activityTop}>
              {/* 상태 배지 */}
              {item.status === "published" && (
                <Badge tone="success" variant="soft">
                  게시됨
                </Badge>
              )}
              {item.status === "draft" && (
                <Badge tone="warning" variant="soft">
                  임시저장
                </Badge>
              )}
              {item.status === "hidden" && (
                <Badge tone="danger" variant="soft">
                  숨김 처리됨
                </Badge>
              )}

              <div className={resourceStyles.itemActions}>
                {/* draft: 이어 작성하기 */}
                {item.status === "draft" && (
                  <Link href={`/resources/${item.id}/edit`} className={resourceStyles.actionBtn}>
                    <Icon name="edit-line" />
                    이어 작성하기
                  </Link>
                )}
                {/* published/hidden: 수정 */}
                {item.status !== "draft" && (
                  <Link href={`/resources/${item.id}/edit`} className={resourceStyles.actionBtn}>
                    <Icon name="edit-line" />
                    수정
                  </Link>
                )}
                {/* 삭제 버튼 */}
                <button
                  type="button"
                  className={`${resourceStyles.actionBtn} ${resourceStyles.actionBtnDanger}`}
                  onClick={() => setDeleteTarget(item)}
                  disabled={deletingId === item.id}
                  aria-label={`${item.title} 삭제`}
                >
                  <Icon name="delete-bin-line" />
                  삭제
                </button>
              </div>
            </div>

            {/* 제목 */}
            {item.status === "published" ? (
              <Link
                href={`/resources/${item.slug}`}
                className={styles.activityTitle}
              >
                {item.title}
              </Link>
            ) : (
              <span className={styles.activityTitle}>{item.title}</span>
            )}

            {/* 숨김 처리됨 사유 안내 */}
            {item.status === "hidden" && (
              <p className={resourceStyles.hiddenReason}>
                <Icon name="information-line" />
                {item.hiddenReason
                  ? `숨김 사유: ${item.hiddenReason}`
                  : "운영자에 의해 숨김 처리된 자료입니다. 문의사항은 고객센터로 연락해 주세요."}
              </p>
            )}

            {/* 하단 메타 정보 */}
            <div className={styles.activityFooter}>
              <span className={styles.activityDate}>{formatDate(item.createdAt)}</span>
              <div className={styles.activityStats} aria-label="자료 통계">
                <span title="다운로드 수">
                  <Icon name="download-line" />
                  {item.downloadCount.toLocaleString()}
                </span>
                <span title="평점">
                  <Icon name="star-line" />
                  {formatRating(item.avgRating, item.ratingCount)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* 페이지네이션 */}
      {meta.totalPages > 1 && (
        <div className={resourceStyles.pagination}>
          {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              className={`${resourceStyles.pageBtn} ${p === meta.page ? resourceStyles.pageBtnActive : ""}`}
              onClick={() => void fetchMyResources(p)}
              aria-current={p === meta.page ? "page" : undefined}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <p className={resourceStyles.totalInfo}>총 {meta.totalItems}개</p>
    </div>
  );
}

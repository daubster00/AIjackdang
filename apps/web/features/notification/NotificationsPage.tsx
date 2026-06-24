"use client";

/**
 * NotificationsPage — 알림 목록 클라이언트 컴포넌트 (Story 7.2)
 *
 * - 마운트 시 GET /api/v1/notifications?page&pageSize 호출
 * - [전체 읽음] → PATCH /read-all → 토스트 + 배지 0
 * - 개별 클릭 → PATCH /{id}/read → 배지 감소 (NotificationItem 내부에서 처리)
 * - EmptyState (0건), 스켈레톤 (로딩), Pagination (다중 페이지)
 */

import { useCallback, useEffect, useState } from "react";
import { Badge, EmptyState, Icon, Pagination } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { NotificationItem, type NotificationItemData } from "./NotificationItem";
import styles from "./notifications.module.css";

const PAGE_SIZE = 20;

interface Meta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface NotificationsPageProps {
  /** useAuth の user がいるかどうか (SSRで認証済み確認済みなので常に true) */
  isLoggedIn?: boolean;
}

export function NotificationsPage({ isLoggedIn = true }: NotificationsPageProps) {
  const { toast } = useToast();
  const { reset: resetBadge, decrement: decrementBadge } = useUnreadNotifications(isLoggedIn);

  const [items, setItems] = useState<NotificationItemData[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/notifications?page=${targetPage}&pageSize=${PAGE_SIZE}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = (await res.json()) as { items: NotificationItemData[]; meta: Meta };
      setItems(data.items);
      setMeta(data.meta);
    } catch {
      toast({ tone: "danger", title: "알림 목록을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchList(page);
  }, [fetchList, page]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /** 개별 읽음 처리 후 호출 → 로컬 상태 갱신 + 배지 감소 */
  const handleRead = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.isRead ? { ...n, isRead: true } : n)),
    );
    decrementBadge(1);
  }, [decrementBadge]);

  /** 전체 읽음 처리 */
  const handleReadAll = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications/read-all", {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("전체 읽음 처리 실패");
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      resetBadge();
      toast({ tone: "success", title: "모든 알림을 읽음 처리했습니다." });
    } catch {
      toast({ tone: "danger", title: "읽음 처리에 실패했습니다. 다시 시도해주세요." });
    }
  }, [resetBadge, toast]);

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <main id="main" className={styles.page}>
      {/* ── 헤더 영역 ── */}
      <header className={styles.head}>
        <div className={styles.headInner}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>
              <Icon name="notification-3-line" aria-hidden="true" />
              알림
            </h1>
            {unreadCount > 0 && (
              <Badge tone="primary" variant="solid" className={styles.unreadBadge}>
                안 읽음 {unreadCount}
              </Badge>
            )}
          </div>

          <div className={styles.headActions}>
            <button
              type="button"
              className={styles.markAllButton}
              onClick={handleReadAll}
              disabled={unreadCount === 0 || loading}
              aria-label="모든 알림 읽음 처리"
            >
              <Icon name="check-double-line" aria-hidden="true" />
              모두 읽음
            </button>
          </div>
        </div>
      </header>

      {/* ── 목록 영역 ── */}
      <div className={styles.listLayout}>
        {loading ? (
          <SkeletonList />
        ) : items.length === 0 ? (
          <EmptyState
            icon="notification-off-line"
            title="아직 알림이 없어요."
            description="새로운 댓글·답변·좋아요가 생기면 여기에서 가장 먼저 알려드릴게요."
          />
        ) : (
          <ul aria-label="알림 목록" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--space-2)" }}>
            {items.map((item) => (
              <NotificationItem key={item.id} item={item} onRead={handleRead} />
            ))}
          </ul>
        )}

        {/* 페이지네이션 */}
        {meta && meta.totalPages > 1 && (
          <nav className={styles.pagination} aria-label="알림 페이지 이동">
            <Pagination
              page={page}
              totalPages={meta.totalPages}
              onPageChange={handlePageChange}
            />
          </nav>
        )}
      </div>
    </main>
  );
}

/** 로딩 스켈레톤 */
function SkeletonList() {
  return (
    <div className={styles.skeletonList} aria-busy="true" aria-label="알림 목록 불러오는 중">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.skeletonItem} />
      ))}
    </div>
  );
}

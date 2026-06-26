"use client";

/**
 * MessagesPage — 메일박스형 쪽지함 (Story 7.4 개편)
 *
 * - 상단 탭: "받은 쪽지" / "보낸 쪽지" / "휴지통"
 * - 받은/보낸 탭: 개별 쪽지 목록 (최신순)
 *   - [Avatar] [AuthorName] [본문 미리보기] [시간] [안읽음 배지]
 *   - 행 클릭 → MessageDetailModal (삭제 버튼 포함)
 * - 휴지통 탭: 체크박스 다중 선택 + 선택 영구삭제
 *   - 30일 후 자동 영구삭제 안내 문구
 */

import { useEffect, useState, useCallback } from "react";
import { Avatar, EmptyState, Icon } from "@/components/ui";
import { AuthorName } from "@/components/ui/AuthorName/AuthorName";
import { useToast } from "@/components/ui/Toast/Toast";
import { MessageDetailModal, type MessageBoxItem } from "./MessageDetailModal";
import styles from "./messages.module.css";

// ── 유틸리티 ──────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const now = Date.now();
  const past = new Date(isoString).getTime();
  const diffMs = now - past;
  if (diffMs < 0) return "방금 전";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "방금 전";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}주 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  const years = Math.floor(days / 365);
  return `${years}년 전`;
}

function preview(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

// ── 스켈레톤 ──────────────────────────────────────────────────────────────────

function SkeletonItem() {
  return (
    <li className={styles.skeletonItem} aria-hidden="true">
      <div className={styles.skeletonAvatar} />
      <div className={styles.skeletonText}>
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
      </div>
    </li>
  );
}

// ── 타입 ──────────────────────────────────────────────────────────────────────

type Tab = "received" | "sent" | "trash";

// 휴지통 아이템 — MessageBoxItem 확장
type TrashItem = MessageBoxItem & {
  trashedAt: string | null;
  originalBox: "received" | "sent";
};

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function MessagesPage() {
  const [tab, setTab] = useState<Tab>("received");
  const [items, setItems] = useState<MessageBoxItem[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MessageBoxItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // 휴지통 체크박스 선택
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkPurging, setBulkPurging] = useState(false);
  const { toast } = useToast();

  const loadMessages = useCallback(async (currentTab: Tab) => {
    setLoading(true);
    setError(null);
    setCheckedIds(new Set());
    try {
      if (currentTab === "trash") {
        const res = await fetch(`/api/v1/messages/trash`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          setError("휴지통 목록을 불러오지 못했습니다.");
          return;
        }
        const data = (await res.json()) as { items: TrashItem[] };
        setTrashItems(data.items ?? []);
      } else {
        const res = await fetch(`/api/v1/messages?box=${currentTab}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          setError("쪽지 목록을 불러오지 못했습니다.");
          return;
        }
        const data = (await res.json()) as { items: MessageBoxItem[] };
        setItems(data.items ?? []);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages(tab);
  }, [loadMessages, tab]);

  function handleTabChange(newTab: Tab) {
    if (newTab === tab) return;
    setDetailOpen(false);
    setSelectedItem(null);
    setTab(newTab);
  }

  // ── 일반 탭 아이템 클릭 ───────────────────────────────────────────────────

  function handleItemClick(item: MessageBoxItem) {
    setSelectedItem(item);
    setDetailOpen(true);

    // 받은 쪽지이고 미읽음이면 읽음 처리 (fire-and-forget)
    if (tab === "received" && !item.isRead) {
      fetch(`/api/v1/messages/${item.id}/read`, {
        method: "POST",
        credentials: "include",
      })
        .then(() => {
          setItems((prev) =>
            prev.map((m) => (m.id === item.id ? { ...m, isRead: true } : m)),
          );
        })
        .catch(() => {});
    }
  }

  // 삭제(휴지통 이동) 후 낙관적 제거
  function handleTrashSuccess(id: string) {
    setItems((prev) => prev.filter((m) => m.id !== id));
  }

  // ── 휴지통 탭 아이템 클릭 ────────────────────────────────────────────────

  function handleTrashItemClick(item: TrashItem) {
    setSelectedItem(item);
    setDetailOpen(true);
  }

  // 영구삭제 후 낙관적 제거
  function handlePurgeSuccess(id: string) {
    setTrashItems((prev) => prev.filter((m) => m.id !== id));
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // ── 체크박스 핸들러 ──────────────────────────────────────────────────────

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checkedIds.size === trashItems.length && trashItems.length > 0) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(trashItems.map((m) => m.id)));
    }
  }

  // ── 선택 영구삭제 ────────────────────────────────────────────────────────

  async function handleBulkPurge() {
    if (checkedIds.size === 0) return;
    setBulkPurging(true);
    try {
      const res = await fetch(`/api/v1/messages/purge`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(checkedIds) }),
      });
      if (res.ok) {
        const count = checkedIds.size;
        setTrashItems((prev) => prev.filter((m) => !checkedIds.has(m.id)));
        setCheckedIds(new Set());
        toast({ tone: "success", title: `${count}건을 영구삭제했습니다` });
      } else {
        toast({ tone: "danger", title: "영구삭제에 실패했습니다" });
      }
    } catch {
      toast({ tone: "danger", title: "네트워크 오류가 발생했습니다" });
    } finally {
      setBulkPurging(false);
    }
  }

  function handleDetailClose() {
    setDetailOpen(false);
  }

  // ── 헤더 + 탭 (로딩/에러/정상 공통) ───────────────────────────────────────

  const header = (
    <header className={styles.head}>
      <div className={styles.headInner}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <Icon name="mail-line" />
            쪽지함
          </h1>
        </div>
      </div>
      {/* 탭 바 */}
      <nav className={styles.tabsNav} aria-label="쪽지함 탭">
        <button
          role="tab"
          type="button"
          aria-selected={tab === "received"}
          className={`${styles.tab} ${tab === "received" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("received")}
        >
          받은 쪽지
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === "sent"}
          className={`${styles.tab} ${tab === "sent" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("sent")}
        >
          보낸 쪽지
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === "trash"}
          className={`${styles.tab} ${tab === "trash" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("trash")}
        >
          <Icon name="delete-bin-line" />
          휴지통
        </button>
      </nav>
    </header>
  );

  if (loading) {
    return (
      <main id="main" className={styles.page}>
        {header}
        <div className={styles.listLayout}>
          <ul className={styles.list} aria-label="쪽지 목록 로딩 중">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonItem key={i} />
            ))}
          </ul>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main id="main" className={styles.page}>
        {header}
        <div className={styles.listLayout}>
          <EmptyState
            icon="error-warning-line"
            title="불러오기 실패"
            description={error}
            actions={
              <button
                type="button"
                onClick={() => void loadMessages(tab)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  cursor: "pointer",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                다시 시도
              </button>
            }
          />
        </div>
      </main>
    );
  }

  // ── 휴지통 탭 렌더 ──────────────────────────────────────────────────────────

  if (tab === "trash") {
    const allChecked =
      trashItems.length > 0 && checkedIds.size === trashItems.length;
    const someChecked = checkedIds.size > 0;

    return (
      <main id="main" className={styles.page}>
        {header}

        <div className={styles.listLayout}>
          {/* 휴지통 안내 문구 */}
          <p className={styles.trashNotice}>
            <Icon name="information-line" />
            휴지통의 쪽지는 30일 후 자동으로 영구삭제됩니다.
          </p>

          {trashItems.length === 0 ? (
            <EmptyState
              icon="delete-bin-line"
              title="휴지통이 비어있어요"
              description="삭제한 쪽지는 30일간 여기에 보관됩니다."
            />
          ) : (
            <>
              {/* 전체 선택 + 선택 영구삭제 툴바 */}
              <div className={styles.trashToolbar}>
                <label className={styles.checkAll}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="전체 선택"
                  />
                  전체 선택
                </label>
                <button
                  type="button"
                  className={styles.purgeBtn}
                  disabled={!someChecked || bulkPurging}
                  onClick={() => void handleBulkPurge()}
                >
                  {bulkPurging ? "처리 중…" : `선택 영구삭제 (${checkedIds.size})`}
                </button>
              </div>

              <ul
                className={styles.list}
                aria-label="휴지통 쪽지 목록"
              >
                {trashItems.map((item) => {
                  const isChecked = checkedIds.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className={`${styles.item} ${styles.trashItem} ${isChecked ? styles.trashItemChecked : ""}`}
                    >
                      {/* 체크박스 — 클릭 시 행 클릭(모달 열기)과 분리 */}
                      <span
                        className={styles.trashCheckbox}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCheck(item.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleCheck(item.id);
                          }
                        }}
                        role="checkbox"
                        aria-checked={isChecked}
                        tabIndex={0}
                        aria-label={`${item.counterpart.nickname}님의 쪽지 선택`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCheck(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </span>

                      {/* 나머지 행: 클릭 → 상세 모달 */}
                      <span
                        className={styles.trashItemContent}
                        onClick={() => handleTrashItemClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleTrashItemClick(item);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${item.counterpart.nickname}님의 쪽지 상세 보기`}
                      >
                        <Avatar
                          name={item.counterpart.nickname}
                          src={item.counterpart.avatarUrl ?? undefined}
                          size="md"
                        />
                        <div className={styles.itemBody}>
                          <div className={styles.itemTop}>
                            <span
                              className={styles.partner}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <AuthorName
                                name={item.counterpart.nickname}
                                authorId={item.counterpart.id}
                                authorAvatarUrl={item.counterpart.avatarUrl}
                              />
                              <span className={styles.trashBoxLabel}>
                                {item.originalBox === "received" ? "받은" : "보낸"}
                              </span>
                            </span>
                            <span className={styles.date}>
                              {item.trashedAt
                                ? timeAgo(item.trashedAt)
                                : timeAgo(item.createdAt)}
                            </span>
                          </div>
                          <span className={styles.excerpt}>
                            {preview(item.body)}
                          </span>
                        </div>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* 쪽지 상세 모달 (휴지통) */}
        <MessageDetailModal
          open={detailOpen}
          onClose={handleDetailClose}
          item={selectedItem}
          box="trash"
          onPurge={handlePurgeSuccess}
        />
      </main>
    );
  }

  // ── 받은/보낸 탭 렌더 ─────────────────────────────────────────────────────

  const emptyTitle =
    tab === "received" ? "받은 쪽지가 없어요" : "보낸 쪽지가 없어요";
  const emptyDesc =
    tab === "received"
      ? "다른 회원이 쪽지를 보내면 여기에 표시됩니다."
      : "다른 회원에게 쪽지를 보내면 여기에 표시됩니다.";

  return (
    <main id="main" className={styles.page}>
      {header}

      <div className={styles.listLayout}>
        {items.length === 0 ? (
          <EmptyState
            icon="mail-line"
            title={emptyTitle}
            description={emptyDesc}
          />
        ) : (
          <ul
            className={styles.list}
            aria-label={tab === "received" ? "받은 쪽지 목록" : "보낸 쪽지 목록"}
          >
            {items.map((item) => {
              const isUnread = tab === "received" && !item.isRead;
              return (
                <li
                  key={item.id}
                  className={`${styles.item} ${isUnread ? styles.itemUnread : ""}`}
                  onClick={() => handleItemClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleItemClick(item);
                    }
                  }}
                  aria-label={`${item.counterpart.nickname}님의 쪽지${isUnread ? " (안읽음)" : ""}`}
                >
                  <Avatar
                    name={item.counterpart.nickname}
                    src={item.counterpart.avatarUrl ?? undefined}
                    size="md"
                  />
                  <div className={styles.itemBody}>
                    <div className={styles.itemTop}>
                      {/*
                        AuthorName 클릭 시 쪽지/팔로우/계정 메뉴가 열려야 하므로
                        stopPropagation으로 행 클릭(모달 열기)과 분리한다.
                      */}
                      <span
                        className={styles.partner}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <AuthorName
                          name={item.counterpart.nickname}
                          authorId={item.counterpart.id}
                          authorAvatarUrl={item.counterpart.avatarUrl}
                        />
                      </span>
                      <span className={styles.date}>{timeAgo(item.createdAt)}</span>
                    </div>
                    <span
                      className={`${styles.excerpt} ${isUnread ? styles.excerptUnread : ""}`}
                    >
                      {preview(item.body)}
                    </span>
                  </div>
                  {isUnread && (
                    <span className={styles.unreadBadge} aria-label="안읽음">
                      ●
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 쪽지 상세 모달 */}
      <MessageDetailModal
        open={detailOpen}
        onClose={handleDetailClose}
        item={selectedItem}
        box={tab as "received" | "sent"}
        onTrash={handleTrashSuccess}
      />
    </main>
  );
}

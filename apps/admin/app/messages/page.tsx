"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RowActionMenu, type RowActionItem } from "@/components/ui/RowActionMenu";
import { API_BASE_URL } from "@/lib/api";

/**
 * 쪽지 관리 페이지 (Story 9.18).
 * GET /api/v1/admin/messages 실제 API 연동.
 * URL 파라미터: page, tab, hasReport, from, to
 */

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface MessageAdminRow {
  id: string;
  senderId: string;
  senderNickname: string;
  senderAvatarUrl: string | null;
  senderImage: string | null;
  senderDefaultAvatarIndex: number;
  receiverId: string;
  receiverNickname: string;
  receiverAvatarUrl: string | null;
  receiverImage: string | null;
  receiverDefaultAvatarIndex: number;
  bodyPreview: string;
  createdAt: string;
  hiddenByAdmin: boolean;
  reportCount: number;
  deletedAt: string | null;
}

// ── 탭 정의 ───────────────────────────────────────────────────────────────────

const TABS = [
  { value: "all", label: "전체" },
  { value: "reported", label: "신고있음" },
  { value: "hidden", label: "숨김" },
] as const;

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

function statusBadge(row: MessageAdminRow): [string, string] {
  if (row.deletedAt) return ["badge-gray", "삭제됨"];
  if (row.hiddenByAdmin) return ["badge-gray", "숨김"];
  if (row.reportCount > 0) return ["badge-orange", "신고있음"];
  return ["badge-green", "정상"];
}

// ── 모달 컴포넌트 ─────────────────────────────────────────────────────────────

function RestrictModal({
  messageId,
  senderNickname,
  onConfirm,
  onClose,
}: {
  messageId: string;
  senderNickname: string;
  onConfirm: (messageId: string, days: number, reason: string) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--gray-0, #fff)", borderRadius: 8, padding: 24,
          width: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 8, fontSize: 16 }}>쪽지 발신제한</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          <strong>{senderNickname}</strong> 회원의 쪽지 발송을 제한합니다.
        </p>
        <label style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}>
          제한 기간 (일 수, 0 = 영구)
        </label>
        <input
          type="number"
          min={0}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="control"
          style={{ marginBottom: 16 }}
        />
        <label style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}>
          제한 사유 (필수)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="제한 사유를 입력하세요"
          rows={3}
          style={{
            width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
            borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>취소</button>
          <button
            className="btn btn-primary"
            disabled={!reason.trim()}
            onClick={() => onConfirm(messageId, days, reason.trim())}
          >
            발신제한 확정
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({
  count: cnt,
  onConfirm,
  onClose,
}: {
  count: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--gray-0, #fff)", borderRadius: 8, padding: 24,
          width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>쪽지 삭제</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          선택한 <strong>{cnt}개</strong> 쪽지를 삭제합니다. (최고관리자 전용)
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>취소</button>
          <button className="btn btn-danger" onClick={onConfirm}>
            삭제 확정
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 토스트 ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff", borderRadius: 8, padding: "12px 20px",
        fontSize: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex", alignItems: "center", gap: 10,
      }}
    >
      <i className={type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} />
      {message}
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8 }}
        aria-label="닫기"
      >
        <i className="ri-close-line" />
      </button>
    </div>
  );
}

// ── 메인 페이지 컴포넌트 ───────────────────────────────────────────────────────

function AdminMessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const tabParam = (searchParams.get("tab") ?? "all") as "all" | "reported" | "hidden";
  const hasReportParam = searchParams.get("hasReport") ?? "";
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";

  const [items, setItems] = useState<MessageAdminRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [restrictModal, setRestrictModal] = useState<{ messageId: string; senderNickname: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // 현재 관리자 role 확인
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/get-session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.role === "super_admin") setIsSuperAdmin(true);
      })
      .catch(() => {});
  }, []);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("pageSize", "20");
      if (tabParam && tabParam !== "all") params.set("tab", tabParam);
      if (hasReportParam === "true") params.set("hasReport", "true");
      if (fromParam) params.set("from", fromParam);
      if (toParam) params.set("to", toParam);

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = await res.json();
      setItems(data.items ?? []);
      setMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("쪽지 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [pageParam, tabParam, hasReportParam, fromParam, toParam, showToast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "all" && v !== "") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`/messages?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/messages?${next.toString()}`);
  }

  // ── 액션 ─────────────────────────────────────────────────────────────────────

  async function handleHide(id: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages/${id}/hide`, {
        method: "PATCH", credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("숨김 처리되었습니다.", "success");
      fetchMessages();
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleUnhide(id: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages/${id}/unhide`, {
        method: "PATCH", credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("숨김이 복구되었습니다.", "success");
      fetchMessages();
    } catch {
      showToast("숨김 복구 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleDelete(id: string) {
    setSingleDeleteId(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("쪽지가 삭제되었습니다.", "success");
      fetchMessages();
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleRestrictConfirm(messageId: string, days: number, reason: string) {
    setRestrictModal(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages/${messageId}/restrict-sender`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, reason }),
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("발신제한이 적용되었습니다.", "success");
    } catch {
      showToast("발신제한 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleBulkHide() {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages/bulk-hide`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error();
      showToast(`${selectedIds.size}개 쪽지가 숨김 처리되었습니다.`, "success");
      setSelectedIds(new Set());
      fetchMessages();
    } catch {
      showToast("일괄 숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleBulkDelete() {
    setBulkDeleteOpen(false);
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages/bulk`, {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast(`${selectedIds.size}개 쪽지가 삭제되었습니다.`, "success");
      setSelectedIds(new Set());
      fetchMessages();
    } catch {
      showToast("일괄 삭제 중 오류가 발생했습니다.", "error");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((m) => m.id)));
    }
  }

  const hasSelection = selectedIds.size > 0;

  return (
    <AdminShell breadcrumb={["관리자", "쪽지 관리"]} activeKey="messages">
      <div className="page-header">
        <div>
          <h1 className="page-title">쪽지 관리</h1>
          <p className="page-description">회원 간 1:1 쪽지를 모니터링하고 스팸·사기·욕설 쪽지를 숨김·삭제·발신 제한으로 처리합니다.</p>
        </div>
      </div>

      <section className="section">
        <article className="card">
          {/* 탭 */}
          <div className="line-tabs" style={{ padding: "0 16px" }} aria-label="쪽지 상태 탭">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                className={`line-tab${tabParam === tab.value ? " active" : ""}`}
                data-tab={tab.value}
                type="button"
                onClick={() => updateParams({ tab: tab.value })}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 필터 패널 */}
          <div className="filter-panel">
            <div className="filter-row">
              {/* 신고 여부 필터 */}
              <div className="custom-select" data-select="hasReport">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{hasReportParam === "true" ? "신고 있음" : "신고: 전체"}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button
                    className={`select-option${!hasReportParam ? " selected" : ""}`}
                    onClick={() => updateParams({ hasReport: "" })}
                  >
                    신고: 전체
                    {!hasReportParam ? <i className="ri-check-line" /> : null}
                  </button>
                  <button
                    className={`select-option${hasReportParam === "true" ? " selected" : ""}`}
                    onClick={() => updateParams({ hasReport: "true" })}
                  >
                    신고 있음
                    {hasReportParam === "true" ? <i className="ri-check-line" /> : null}
                  </button>
                </div>
              </div>

              {/* 기간 필터 */}
              <div className="input-icon">
                <i className="ri-calendar-line" />
                <input
                  className="control"
                  type="date"
                  aria-label="시작 날짜"
                  value={fromParam}
                  onChange={(e) => updateParams({ from: e.target.value })}
                  placeholder="시작 날짜"
                />
              </div>
              <div className="input-icon">
                <i className="ri-calendar-line" />
                <input
                  className="control"
                  type="date"
                  aria-label="종료 날짜"
                  value={toParam}
                  onChange={(e) => updateParams({ to: e.target.value })}
                  placeholder="종료 날짜"
                />
              </div>

              <div className="filter-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => router.push("/messages")}
                >
                  <i className="ri-refresh-line" />
                  초기화
                </button>
              </div>
            </div>
          </div>

          {/* 툴바 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 {meta.totalItems}개의 쪽지</span>
              <button
                className="btn btn-outline btn-sm"
                disabled={!hasSelection}
                onClick={handleBulkHide}
              >
                <i className="ri-eye-off-line" />
                숨김 처리
              </button>
              {isSuperAdmin && (
                <button
                  className="btn btn-danger btn-sm"
                  disabled={!hasSelection}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <i className="ri-delete-bin-line" />
                  일괄 삭제
                </button>
              )}
            </div>
          </div>

          {/* 테이블 */}
          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
                불러오는 중...
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>
                      <input
                        className="check"
                        type="checkbox"
                        aria-label="전체 선택"
                        checked={items.length > 0 && selectedIds.size === items.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>쪽지 내용</th>
                    <th>발신자</th>
                    <th>수신자</th>
                    <th>신고</th>
                    <th>상태</th>
                    <th>발송일</th>
                    <th style={{ width: 60 }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>
                        쪽지가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    items.map((m) => {
                      const [badgeClass, statusLabel] = statusBadge(m);
                      const isSpam = m.hiddenByAdmin || m.reportCount > 0;
                      return (
                        <tr key={m.id}>
                          <td>
                            <input
                              className="check row-check"
                              type="checkbox"
                              aria-label="행 선택"
                              checked={selectedIds.has(m.id)}
                              onChange={() => toggleSelect(m.id)}
                            />
                          </td>
                          <td>
                            <Link className="content-title" href={`/messages/${m.id}`}>
                              {isSpam ? (
                                <span className="badge badge-purple" title="스팸 의심" style={{ marginRight: 6 }}>스팸</span>
                              ) : null}
                              {m.bodyPreview}
                            </Link>
                          </td>
                          <td>
                            <div className="author">
                              <UserAvatar
                                size={28}
                                alt={m.senderNickname}
                                avatarUrl={m.senderAvatarUrl}
                                image={m.senderImage}
                                defaultAvatarIndex={m.senderDefaultAvatarIndex}
                              />
                              <span>{m.senderNickname}</span>
                            </div>
                          </td>
                          <td>
                            <div className="author">
                              <UserAvatar
                                size={28}
                                alt={m.receiverNickname}
                                avatarUrl={m.receiverAvatarUrl}
                                image={m.receiverImage}
                                defaultAvatarIndex={m.receiverDefaultAvatarIndex}
                              />
                              <span>{m.receiverNickname}</span>
                            </div>
                          </td>
                          <td className="num">
                            {m.reportCount > 0 ? (
                              <span className="badge badge-red">{m.reportCount}</span>
                            ) : (
                              <span className="content-meta">0</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                          </td>
                          <td className="num">{formatDate(m.createdAt)}</td>
                          <td>
                            <RowActionMenu
                              items={[
                                { label: "원문보기", icon: "ri-eye-line", href: `/messages/${m.id}` },
                                ...(m.hiddenByAdmin
                                  ? [{ label: "숨김 복구", icon: "ri-eye-line", onClick: () => handleUnhide(m.id) } as RowActionItem]
                                  : [{ label: "숨김", icon: "ri-eye-off-line", onClick: () => handleHide(m.id) } as RowActionItem]),
                                { label: "발신제한", icon: "ri-user-forbid-line", onClick: () => setRestrictModal({ messageId: m.id, senderNickname: m.senderNickname }) },
                                ...(isSuperAdmin ? [{ label: "삭제", icon: "ri-delete-bin-line", danger: true, onClick: () => setSingleDeleteId(m.id) } as RowActionItem] : []),
                              ]}
                              ariaLabel="쪽지 관리 메뉴"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* 페이지네이션 */}
          {meta.totalPages > 1 && (
            <div className="pagination">
              <div className="page-info">
                {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.totalItems)} / 총 {meta.totalItems}개
              </div>
              <div className="page-buttons">
                <button
                  className="page-button"
                  aria-label="이전 페이지"
                  disabled={meta.page <= 1}
                  onClick={() => goPage(meta.page - 1)}
                >
                  <i className="ri-arrow-left-s-line" />
                </button>
                {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      className={`page-button${meta.page === p ? " active" : ""}`}
                      onClick={() => goPage(p)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  className="page-button"
                  aria-label="다음 페이지"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => goPage(meta.page + 1)}
                >
                  <i className="ri-arrow-right-s-line" />
                </button>
              </div>
            </div>
          )}
        </article>
      </section>

      {/* 발신제한 모달 */}
      {restrictModal && (
        <RestrictModal
          messageId={restrictModal.messageId}
          senderNickname={restrictModal.senderNickname}
          onConfirm={handleRestrictConfirm}
          onClose={() => setRestrictModal(null)}
        />
      )}

      {/* 단일 삭제 확인 */}
      {singleDeleteId && (
        <DeleteModal
          count={1}
          onConfirm={() => handleDelete(singleDeleteId)}
          onClose={() => setSingleDeleteId(null)}
        />
      )}

      {/* 벌크 삭제 모달 */}
      {bulkDeleteOpen && (
        <DeleteModal
          count={selectedIds.size}
          onConfirm={handleBulkDelete}
          onClose={() => setBulkDeleteOpen(false)}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

export default function AdminMessagesPage() {
  return (
    <Suspense>
      <AdminMessagesContent />
    </Suspense>
  );
}

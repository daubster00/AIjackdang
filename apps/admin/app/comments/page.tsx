"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../lib/api";
import { getCrossLink } from "../../lib/contentCrossLink";
import type { AdminCommentItem } from "@ai-jakdang/contracts/admin/comments";

/**
 * 댓글·후기 통합 관리 페이지 (Story 9.9).
 * GET /api/v1/admin/comments 실제 API 연동.
 * URL 파라미터: page, type, status, hasReports, dateFrom, dateTo, q
 * 숨김/삭제 행 액션 + 벌크 툴바.
 * 삭제는 super_admin 역할만 표시.
 * 댓글 내용 직접 수정 없음 (UX-DR-A9).
 */

// 댓글 유형 탭
const COMMENT_TYPES = [
  { value: "all", label: "전체" },
  { value: "일반댓글", label: "일반댓글" },
  { value: "대댓글", label: "대댓글" },
  { value: "후기", label: "후기" },
  { value: "Q&A답변", label: "Q&A답변" },
] as const;

// 상태 목록
const STATUSES = [
  { value: "all", label: "상태: 전체" },
  { value: "visible", label: "공개" },
  { value: "hidden", label: "숨김" },
  { value: "deleted", label: "삭제" },
] as const;

// 신고 여부
const REPORT_FILTERS = [
  { value: "all", label: "신고: 전체" },
  { value: "reported", label: "신고 있음" },
] as const;

function statusBadge(status: string): [string, string] {
  switch (status) {
    case "visible": return ["badge-green", "공개"];
    case "hidden": return ["badge-gray", "숨김"];
    case "deleted": return ["badge-gray", "삭제"];
    default: return ["badge-gray", status];
  }
}

function typeBadge(derivedType: string): [string, string] {
  switch (derivedType) {
    case "일반댓글": return ["badge-blue", "일반댓글"];
    case "대댓글": return ["badge-cyan", "대댓글"];
    case "후기": return ["badge-orange", "후기"];
    case "Q&A답변": return ["badge-purple", "Q&A답변"];
    default: return ["badge-gray", derivedType];
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

// ── 삭제 확인 모달 ──────────────────────────────────────────────────────────────

function DeleteModal({
  commentId,
  onConfirm,
  onClose,
}: {
  commentId: string;
  onConfirm: (id: string, reason: string) => void;
  onClose: () => void;
}) {
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
          background: "var(--surface)", borderRadius: 8, padding: 24,
          width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>댓글 삭제</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          이 댓글을 삭제합니다. 삭제 후에도 관리자는 내용을 조회할 수 있습니다.
        </p>
        <label style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}>
          삭제 사유 (필수)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="삭제 사유를 입력하세요"
          rows={3}
          style={{
            width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
            borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>취소</button>
          <button
            className="btn btn-danger"
            disabled={!reason.trim()}
            onClick={() => onConfirm(commentId, reason.trim())}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 벌크 삭제 모달 ──────────────────────────────────────────────────────────────

function BulkDeleteModal({
  count: cnt,
  onConfirm,
  onClose,
}: {
  count: number;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
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
          background: "var(--surface)", borderRadius: 8, padding: 24,
          width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>일괄 삭제</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          선택한 <strong>{cnt}개</strong> 댓글을 삭제합니다.
        </p>
        <label style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}>
          삭제 사유 (필수)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="삭제 사유를 입력하세요"
          rows={3}
          style={{
            width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
            borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>취소</button>
          <button
            className="btn btn-danger"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
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

function AdminCommentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const typeParam = searchParams.get("type") ?? "all";
  const statusParam = searchParams.get("status") ?? "all";
  const hasReportsParam = searchParams.get("hasReports") === "true";
  const dateFromParam = searchParams.get("dateFrom") ?? "";
  const dateToParam = searchParams.get("dateTo") ?? "";
  const qParam = searchParams.get("q") ?? "";

  const [commentItems, setCommentItems] = useState<AdminCommentItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(qParam);

  // super_admin 여부: 삭제 버튼 노출 제어
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [deleteModal, setDeleteModal] = useState<string | null>(null); // commentId
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // API 호출
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("pageSize", "20");
      if (typeParam && typeParam !== "all") params.set("type", typeParam);
      if (statusParam && statusParam !== "all") params.set("status", statusParam);
      if (hasReportsParam) params.set("hasReports", "true");
      if (dateFromParam) params.set("dateFrom", dateFromParam);
      if (dateToParam) params.set("dateTo", dateToParam);
      if (qParam) params.set("q", qParam);

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/comments?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = await res.json();
      setCommentItems(data.items ?? []);
      setMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("댓글 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [pageParam, typeParam, statusParam, hasReportsParam, dateFromParam, dateToParam, qParam, showToast]);

  // 현재 관리자 role 조회
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/get-session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.role === "super_admin") setIsSuperAdmin(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // URL 파라미터 업데이트
  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "all" && v !== "") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`/comments?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/comments?${next.toString()}`);
  }

  // ── 액션 함수들 ──────────────────────────────────────────────────────────────

  async function handleHide(id: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/comments/${id}/hide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("댓글이 숨김 처리되었습니다.", "success");
      fetchComments();
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleDeleteConfirm(id: string, _reason: string) {
    setDeleteModal(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/comments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("댓글이 삭제되었습니다.", "success");
      fetchComments();
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleBulkHide() {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/comments/bulk`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "hide" }),
      });
      if (!res.ok) throw new Error();
      showToast(`${selectedIds.size}개 댓글이 숨김 처리되었습니다.`, "success");
      setSelectedIds(new Set());
      fetchComments();
    } catch {
      showToast("일괄 숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleBulkDelete(reason: string) {
    if (selectedIds.size === 0) return;
    setBulkDeleteOpen(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/comments/bulk`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "delete", note: reason }),
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast(`${selectedIds.size}개 댓글이 삭제되었습니다.`, "success");
      setSelectedIds(new Set());
      fetchComments();
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
    if (selectedIds.size === commentItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(commentItems.map((c) => c.id)));
    }
  }

  const hasSelection = selectedIds.size > 0;

  return (
    <AdminShell breadcrumb={["관리자", "댓글·후기 관리"]} activeKey="comments">
      <div className="page-header">
        <div>
          <h1 className="page-title">댓글·후기 관리</h1>
          <p className="page-description">일반 댓글 · 대댓글 · Q&A 답변 · 실전자료 후기를 한 곳에서 관리합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            CSV 내보내기
          </button>
        </div>
      </div>

      <section className="section" aria-label="댓글·후기 목록">
        <article className="card">
          {/* 댓글 유형 탭 */}
          <div className="line-tabs" role="tablist" aria-label="댓글 유형">
            {COMMENT_TYPES.map((t) => (
              <button
                key={t.value}
                className={`line-tab${typeParam === t.value || (t.value === "all" && typeParam === "all") ? " active" : ""}`}
                role="tab"
                aria-selected={typeParam === t.value || (t.value === "all" && typeParam === "all")}
                onClick={() => updateParams({ type: t.value })}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 필터 패널 */}
          <div className="filter-panel">
            {/* 댓글 페이지는 날짜 범위(2개 입력) 때문에 항목이 5개라 고정 5칼럼 grid(.filter-row)에서
                날짜 칸이 넘쳐 액션 버튼과 겹쳤다 → 이 페이지만 flex-wrap으로 전환해 줄바꿈되게 한다. */}
            <div className="filter-row" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <div className="input-icon" style={{ flex: "1 1 240px", minWidth: 0 }}>
                <i className="ri-search-line" />
                <input
                  className="control"
                  type="search"
                  placeholder="댓글 내용 검색"
                  aria-label="댓글 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") updateParams({ q: searchInput }); }}
                />
              </div>

              <div className="custom-select" data-select="status">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{STATUSES.find((s) => s.value === statusParam)?.label ?? "상태: 전체"}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      className={`select-option${statusParam === s.value ? " selected" : ""}`}
                      data-value={s.value}
                      onClick={() => updateParams({ status: s.value })}
                    >
                      {s.label}
                      {statusParam === s.value ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-select" data-select="hasReports">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{hasReportsParam ? "신고 있음" : "신고: 전체"}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {REPORT_FILTERS.map((r) => (
                    <button
                      key={r.value}
                      className={`select-option${(r.value === "reported" && hasReportsParam) || (r.value === "all" && !hasReportsParam) ? " selected" : ""}`}
                      data-value={r.value}
                      onClick={() => updateParams({ hasReports: r.value === "reported" ? "true" : "" })}
                    >
                      {r.label}
                      {(r.value === "reported" && hasReportsParam) || (r.value === "all" && !hasReportsParam) ? (
                        <i className="ri-check-line" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  className="control"
                  type="date"
                  aria-label="시작일"
                  value={dateFromParam}
                  onChange={(e) => updateParams({ dateFrom: e.target.value })}
                  style={{ fontSize: 13, padding: "6px 10px" }}
                />
                <span style={{ color: "var(--gray-400)", fontSize: 13 }}>~</span>
                <input
                  className="control"
                  type="date"
                  aria-label="종료일"
                  value={dateToParam}
                  onChange={(e) => updateParams({ dateTo: e.target.value })}
                  style={{ fontSize: 13, padding: "6px 10px" }}
                />
              </div>

              <div className="filter-actions" style={{ marginLeft: "auto" }}>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setSearchInput("");
                    router.push("/comments");
                  }}
                >
                  <i className="ri-refresh-line" />
                  초기화
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => updateParams({ q: searchInput })}
                >
                  <i className="ri-search-line" />
                  검색
                </button>
              </div>
            </div>
          </div>

          {/* 벌크 툴바 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 {meta.totalItems}개의 댓글·후기</span>
              <button
                className="btn btn-outline btn-sm"
                disabled={!hasSelection}
                onClick={handleBulkHide}
              >
                <i className="ri-eye-off-line" />
                일괄 숨김
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
            <div className="toolbar-right">
              <button className="btn btn-outline btn-sm">
                <i className="ri-file-excel-2-line" />
                CSV 다운로드
              </button>
            </div>
          </div>

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
                        checked={commentItems.length > 0 && selectedIds.size === commentItems.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>댓글 내용</th>
                    <th>유형</th>
                    <th>작성자</th>
                    <th>대상 콘텐츠</th>
                    <th>신고</th>
                    <th>상태</th>
                    <th>작성일</th>
                    <th style={{ width: 60 }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {commentItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>
                        댓글이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    commentItems.map((c) => {
                      const [statusClass, statusLabel] = statusBadge(c.status);
                      const [typeClass, typeLabel] = typeBadge(c.derivedType);
                      const crossLink = getCrossLink(c.targetType, c.targetId);
                      return (
                        <tr key={c.id}>
                          <td>
                            <input
                              className="check row-check"
                              type="checkbox"
                              aria-label="행 선택"
                              checked={selectedIds.has(c.id)}
                              onChange={() => toggleSelect(c.id)}
                            />
                          </td>
                          <td>
                            <Link className="content-title" href={`/comments/${c.id}`}>
                              {c.contentPreview}
                            </Link>
                          </td>
                          <td>
                            <span className={`badge ${typeClass}`}>{typeLabel}</span>
                          </td>
                          <td>
                            <div className="author">
                              <span className="author-avatar">
                                {c.authorNickname ? c.authorNickname.slice(0, 1) : "?"}
                              </span>
                              <span>{c.authorNickname ?? "(탈퇴)"}</span>
                            </div>
                          </td>
                          <td>
                            <div className="content-meta">{c.targetType} / {c.targetId.slice(0, 8)}...</div>
                          </td>
                          <td className="num">
                            {c.reportCount > 0 ? (
                              <span className="badge badge-red">{c.reportCount}</span>
                            ) : (
                              <span className="content-meta">0</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${statusClass}`}>{statusLabel}</span>
                          </td>
                          <td className="num">{formatDate(c.createdAt)}</td>
                          <td>
                            <div className="row-actions">
                              <button className="icon-button row-action-button" aria-label="행 메뉴">
                                <i className="ri-more-2-fill" />
                              </button>
                              <div className="action-menu">
                                <Link href={`/comments/${c.id}`}>
                                  <i className="ri-file-text-line" />원문 보기
                                </Link>
                                {crossLink ? (
                                  <Link href={crossLink}>
                                    <i className="ri-external-link-line" />관련 글로 이동
                                  </Link>
                                ) : null}
                                {c.status !== "hidden" && (
                                  <button type="button" onClick={() => handleHide(c.id)}>
                                    <i className="ri-eye-off-line" />댓글 숨김
                                  </button>
                                )}
                                {isSuperAdmin && c.status !== "deleted" && (
                                  <button
                                    className="danger"
                                    type="button"
                                    onClick={() => setDeleteModal(c.id)}
                                  >
                                    <i className="ri-delete-bin-line" />댓글 삭제
                                  </button>
                                )}
                              </div>
                            </div>
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

      {/* 단일 삭제 모달 */}
      {deleteModal && (
        <DeleteModal
          commentId={deleteModal}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteModal(null)}
        />
      )}

      {/* 벌크 삭제 모달 */}
      {bulkDeleteOpen && (
        <BulkDeleteModal
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

export default function AdminCommentsPage() {
  return (
    <Suspense>
      <AdminCommentsContent />
    </Suspense>
  );
}

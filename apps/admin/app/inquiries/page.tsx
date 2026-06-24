"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../lib/api";
import { InquiryDrawer } from "./InquiryDrawer";

// 로컬 타입 정의 — contracts/src/index.ts export 전 임시 선언
interface AdminInquiryItem {
  id: string;
  userId: string;
  userNickname: string | null;
  title: string;
  status: "pending" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

/**
 * 문의 관리 페이지 (Story 9.14).
 * GET /api/v1/admin/inquiries 실제 API 연동.
 * URL 파라미터: page, status, dateFrom, dateTo, q
 * 행 클릭 → InquiryDrawer (상세+스레드+답변 작성).
 */

// ── 상수 ─────────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: "all", label: "상태: 전체" },
  { value: "pending", label: "접수" },
  { value: "in_progress", label: "처리중" },
  { value: "resolved", label: "완료" },
] as const;

function statusBadge(status: string): [string, string] {
  switch (status) {
    case "pending":
      return ["badge-gray", "접수"];
    case "in_progress":
      return ["badge-blue", "처리중"];
    case "resolved":
      return ["badge-green", "완료"];
    default:
      return ["badge-gray", status];
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

// ── 토스트 ────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff",
        borderRadius: 8,
        padding: "12px 20px",
        fontSize: 14,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 240,
        justifyContent: "center",
      }}
    >
      <i className={type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} />
      {message}
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "#fff",
          cursor: "pointer",
          marginLeft: 8,
        }}
        aria-label="닫기"
      >
        <i className="ri-close-line" />
      </button>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

function AdminInquiriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const statusParam = searchParams.get("status") ?? "all";
  const dateFromParam = searchParams.get("dateFrom") ?? "";
  const dateToParam = searchParams.get("dateTo") ?? "";
  const qParam = searchParams.get("q") ?? "";

  const [inquiries, setInquiries] = useState<AdminInquiryItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(qParam);
  const [dateFrom, setDateFrom] = useState(dateFromParam);
  const [dateTo, setDateTo] = useState(dateToParam);

  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // API 호출
  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("pageSize", "20");
      if (statusParam && statusParam !== "all") params.set("status", statusParam);
      if (dateFromParam) params.set("dateFrom", dateFromParam);
      if (dateToParam) params.set("dateTo", dateToParam);
      if (qParam) params.set("q", qParam);

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/inquiries?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = await res.json();
      setInquiries(data.items ?? []);
      setMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("문의 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [pageParam, statusParam, dateFromParam, dateToParam, qParam, showToast]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  // URL 파라미터 업데이트
  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "all" && v !== "") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`/inquiries?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/inquiries?${next.toString()}`);
  }

  function handleSearch() {
    updateParams({ q: searchInput, dateFrom, dateTo });
  }

  function handleReset() {
    setSearchInput("");
    setDateFrom("");
    setDateTo("");
    router.push("/inquiries");
  }

  return (
    <AdminShell breadcrumb={["관리자", "문의 관리"]} activeKey="inquiries">
      <div className="page-header">
        <div>
          <h1 className="page-title">문의 관리</h1>
          <p className="page-description">
            회원 1:1 문의를 조회하고 상태를 변경하거나 운영자 답변을 작성합니다.
          </p>
        </div>
      </div>

      <section className="section" aria-label="문의 목록">
        <article className="card">
          {/* 필터 패널 */}
          <div className="filter-panel">
            <div className="filter-row">
              {/* 검색어 */}
              <div className="input-icon">
                <i className="ri-search-line" />
                <input
                  className="control"
                  type="search"
                  placeholder="제목 검색"
                  aria-label="문의 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                />
              </div>

              {/* 상태 필터 */}
              <div className="custom-select" data-select="status">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>
                    {STATUSES.find((s) => s.value === statusParam)?.label ?? "상태: 전체"}
                  </span>
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

              {/* 기간 필터 */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  className="control"
                  type="date"
                  aria-label="접수일 시작"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ width: 140, fontSize: 13 }}
                />
                <span style={{ color: "var(--gray-400)", fontSize: 13 }}>~</span>
                <input
                  className="control"
                  type="date"
                  aria-label="접수일 종료"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{ width: 140, fontSize: 13 }}
                />
              </div>
            </div>

            <div className="filter-row">
              <div className="filter-actions">
                <button className="btn btn-outline" onClick={handleReset}>
                  <i className="ri-refresh-line" />
                  초기화
                </button>
                <button className="btn btn-primary" onClick={handleSearch}>
                  <i className="ri-search-line" />
                  검색
                </button>
              </div>
            </div>
          </div>

          {/* 툴바 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 {meta.totalItems}개의 문의</span>
            </div>
          </div>

          {/* 테이블 */}
          <div className="table-wrap">
            {loading ? (
              <div
                style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}
              >
                불러오는 중...
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>제목</th>
                    <th>문의자</th>
                    <th>접수일</th>
                    <th>처리일</th>
                    <th>상태</th>
                    <th style={{ width: 80 }}>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          textAlign: "center",
                          padding: 40,
                          color: "var(--gray-400)",
                        }}
                      >
                        문의가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    inquiries.map((inquiry) => {
                      const [badgeClass, statusText] = statusBadge(inquiry.status);
                      return (
                        <tr
                          key={inquiry.id}
                          style={{ cursor: "pointer" }}
                          onClick={() => setSelectedInquiryId(inquiry.id)}
                        >
                          <td>
                            <div
                              className="content-title"
                              style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {inquiry.title}
                            </div>
                          </td>
                          <td>
                            <div className="author">
                              <span className="author-avatar">
                                {inquiry.userNickname
                                  ? inquiry.userNickname.slice(0, 1)
                                  : "?"}
                              </span>
                              <span>{inquiry.userNickname ?? "(탈퇴)"}</span>
                            </div>
                          </td>
                          <td className="num">{formatDate(inquiry.createdAt)}</td>
                          <td className="num">
                            {inquiry.resolvedAt ? formatDate(inquiry.resolvedAt) : "—"}
                          </td>
                          <td>
                            <span className={`badge ${badgeClass}`}>{statusText}</span>
                          </td>
                          <td>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInquiryId(inquiry.id);
                              }}
                            >
                              <i className="ri-eye-line" />
                              보기
                            </button>
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
                {(meta.page - 1) * meta.pageSize + 1}–
                {Math.min(meta.page * meta.pageSize, meta.totalItems)} / 총 {meta.totalItems}개
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

      {/* 상세 드로어 */}
      {selectedInquiryId && (
        <InquiryDrawer
          inquiryId={selectedInquiryId}
          onClose={() => setSelectedInquiryId(null)}
          onStatusChanged={() => fetchInquiries()}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AdminShell>
  );
}

export default function AdminInquiriesPage() {
  return (
    <Suspense>
      <AdminInquiriesContent />
    </Suspense>
  );
}

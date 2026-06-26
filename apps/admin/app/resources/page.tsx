"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../lib/api";
import type { AdminResourceItem } from "@ai-jakdang/contracts/admin/resources";

/**
 * 실전자료 관리 페이지 (Story 9.8).
 * GET /api/v1/admin/resources 실제 API 연동.
 * URL 파라미터: page, type, status, hasReports, q, dateFrom, dateTo
 * 숨김/삭제 → API 호출 후 목록 재조회.
 * 삭제는 super_admin 역할만 표시.
 *
 * 가드레일 UX-DR-A9: "검수됨", "안전한 파일", "공식 인증" 레이블 표시 금지.
 */

const TYPE_OPTIONS = [
  { value: "all", label: "자료유형: 전체" },
  { value: "prompt", label: "프롬프트" },
  { value: "claude-code-skill", label: "Claude Code Skill" },
  { value: "mcp", label: "MCP" },
  { value: "rules-config", label: "Rules / Config" },
  { value: "template-checklist", label: "템플릿 / 체크리스트" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "상태: 전체" },
  { value: "published", label: "공개" },
  { value: "hidden", label: "숨김" },
  { value: "deleted", label: "삭제됨" },
  { value: "draft", label: "초안" },
] as const;

const REPORT_OPTIONS = [
  { value: "all", label: "신고: 전체" },
  { value: "true", label: "신고 있음" },
] as const;

const RESOURCE_TYPE_BADGE: Record<string, string> = {
  "prompt": "badge-cyan",
  "claude-code-skill": "badge-blue",
  "mcp": "badge-purple",
  "rules-config": "badge-orange",
  "template-checklist": "badge-gray",
};

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  "prompt": "프롬프트",
  "claude-code-skill": "Claude Code Skill",
  "mcp": "MCP",
  "rules-config": "Rules / Config",
  "template-checklist": "템플릿 / 체크리스트",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  "beginner": "입문",
  "intermediate": "중급",
  "advanced": "고급",
};

function statusBadge(status: string): [string, string] {
  switch (status) {
    case "published": return ["badge-green", "공개"];
    case "hidden": return ["badge-gray", "숨김"];
    case "deleted": return ["badge-gray", "삭제"];
    case "draft": return ["badge-yellow", "초안"];
    default: return ["badge-gray", status];
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

// ── 삭제 모달 ─────────────────────────────────────────────────────────────────

function DeleteModal({
  title,
  label,
  onConfirm,
  onClose,
}: {
  title: string;
  label: string;
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
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>{label}</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          아래 자료를 삭제합니다. (soft-delete — 복구 가능)
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, wordBreak: "break-all" }}>
          {title}
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
            삭제
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
        position: "fixed",
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        zIndex: 99999,
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

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

function AdminResourcesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const typeParam = searchParams.get("type") ?? "all";
  const statusParam = searchParams.get("status") ?? "all";
  const hasReportsParam = searchParams.get("hasReports") ?? "all";
  const qParam = searchParams.get("q") ?? "";
  const dateFromParam = searchParams.get("dateFrom") ?? "";
  const dateToParam = searchParams.get("dateTo") ?? "";

  const [items, setItems] = useState<AdminResourceItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(qParam);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("pageSize", "20");
      if (typeParam && typeParam !== "all") params.set("type", typeParam);
      if (statusParam && statusParam !== "all") params.set("status", statusParam);
      if (hasReportsParam === "true") params.set("hasReports", "true");
      if (qParam) params.set("q", qParam);
      if (dateFromParam) params.set("dateFrom", dateFromParam);
      if (dateToParam) params.set("dateTo", dateToParam);

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/resources?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = await res.json();
      setItems(data.items ?? []);
      setMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("실전자료 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [pageParam, typeParam, statusParam, hasReportsParam, qParam, dateFromParam, dateToParam, showToast]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/get-session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.user?.role === "super_admin") setIsSuperAdmin(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "all" && v !== "") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`/resources?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/resources?${next.toString()}`);
  }

  async function handleHide(id: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/resources/${id}/hide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("자료가 숨김 처리되었습니다.", "success");
      fetchResources();
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleDeleteConfirm(id: string, reason: string) {
    setDeleteModal(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/resources/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reason }),
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("자료가 삭제되었습니다.", "success");
      fetchResources();
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  }

  return (
    <AdminShell breadcrumb={["관리자", "실전자료 관리"]} activeKey="resources">
      <div className="page-header">
        <div>
          <h1 className="page-title">실전자료 관리</h1>
          <p className="page-description">회원이 올린 Claude Code Skill·MCP·프롬프트·템플릿 등 다운로드형 자료를 점검합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            CSV 다운로드
          </button>
        </div>
      </div>

      <section className="section" aria-label="실전자료 목록">
        <article className="card">
          {/* 필터 패널 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input
                  className="control"
                  type="search"
                  placeholder="자료명 또는 요약 검색"
                  aria-label="자료 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") updateParams({ q: searchInput }); }}
                />
              </div>

              <div className="custom-select" data-select="resourceType">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{TYPE_OPTIONS.find((o) => o.value === typeParam)?.label ?? "자료유형: 전체"}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {TYPE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      className={`select-option${typeParam === o.value ? " selected" : ""}`}
                      data-value={o.value}
                      onClick={() => updateParams({ type: o.value })}
                    >
                      {o.label}
                      {typeParam === o.value ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-select" data-select="resourceStatus">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{STATUS_OPTIONS.find((o) => o.value === statusParam)?.label ?? "상태: 전체"}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {STATUS_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      className={`select-option${statusParam === o.value ? " selected" : ""}`}
                      data-value={o.value}
                      onClick={() => updateParams({ status: o.value })}
                    >
                      {o.label}
                      {statusParam === o.value ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-select" data-select="resourceReport">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>
                    {hasReportsParam === "true" ? "신고 있음" : "신고: 전체"}
                  </span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {REPORT_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      className={`select-option${hasReportsParam === o.value ? " selected" : ""}`}
                      data-value={o.value}
                      onClick={() => updateParams({ hasReports: o.value === "all" ? "" : o.value })}
                    >
                      {o.label}
                      {(hasReportsParam === o.value || (o.value === "all" && hasReportsParam !== "true")) ? (
                        <i className="ri-check-line" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-calendar-line" />
                <input
                  className="control"
                  type="text"
                  placeholder="시작일 (YYYY-MM-DD)"
                  aria-label="시작일"
                  value={dateFromParam}
                  onChange={(e) => updateParams({ dateFrom: e.target.value })}
                />
              </div>
              <div className="input-icon">
                <i className="ri-calendar-line" />
                <input
                  className="control"
                  type="text"
                  placeholder="종료일 (YYYY-MM-DD)"
                  aria-label="종료일"
                  value={dateToParam}
                  onChange={(e) => updateParams({ dateTo: e.target.value })}
                />
              </div>
              <div className="filter-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => { setSearchInput(""); router.push("/resources"); }}
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

          {/* 툴바 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 {meta.totalItems}개의 자료</span>
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
                    <th>자료명</th>
                    <th>자료유형</th>
                    <th>난이도</th>
                    <th>작성자</th>
                    <th>등록일</th>
                    <th>다운로드</th>
                    <th>평점</th>
                    <th>후기</th>
                    <th>신고</th>
                    <th>상태</th>
                    <th style={{ width: 60 }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>
                        자료가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    items.map((r) => {
                      const [badgeClass, statusLabel] = statusBadge(r.status);
                      const typeBadge = RESOURCE_TYPE_BADGE[r.resourceType] ?? "badge-gray";
                      const typeLabel = RESOURCE_TYPE_LABEL[r.resourceType] ?? r.resourceType;
                      const difficultyLabel = DIFFICULTY_LABEL[r.difficulty] ?? r.difficulty;
                      return (
                        <tr key={r.id}>
                          <td>
                            <Link className="content-title" href={`/resources/${r.id}`}>
                              {r.title}
                            </Link>
                            <div className="content-meta">{r.summary}</div>
                          </td>
                          <td>
                            <span className={`badge ${typeBadge}`}>{typeLabel}</span>
                          </td>
                          <td>
                            <span className="badge badge-gray">{difficultyLabel}</span>
                          </td>
                          <td>
                            <div className="author">
                              <span className="author-avatar">
                                {r.authorNickname ? r.authorNickname.slice(0, 1) : "?"}
                              </span>
                              <span>{r.authorNickname ?? "(탈퇴)"}</span>
                            </div>
                          </td>
                          <td className="num">{formatDate(r.createdAt)}</td>
                          <td className="num">{r.downloadCount.toLocaleString()}</td>
                          <td className="num">
                            <i className="ri-star-fill" style={{ color: "var(--warning)" }} aria-hidden="true" />
                            {" "}{r.avgRating}
                          </td>
                          <td className="num">{r.reviewCount}</td>
                          <td className="num">
                            {r.reportCount > 0 ? (
                              <span className="badge badge-red">{r.reportCount}</span>
                            ) : (
                              <span style={{ color: "var(--gray-400)" }}>0</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button className="icon-button row-action-button" aria-label="행 메뉴">
                                <i className="ri-more-2-fill" />
                              </button>
                              <div className="action-menu">
                                <Link href={`/resources/${r.id}`}>
                                  <i className="ri-eye-line" />
                                  자료 상세 보기
                                </Link>
                                {r.status !== "hidden" && r.status !== "deleted" && (
                                  <button onClick={() => handleHide(r.id)}>
                                    <i className="ri-eye-off-line" />
                                    숨김
                                  </button>
                                )}
                                {isSuperAdmin && r.status !== "deleted" && (
                                  <button
                                    className="danger"
                                    onClick={() => setDeleteModal({ id: r.id, title: r.title })}
                                  >
                                    <i className="ri-delete-bin-line" />
                                    삭제
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

      {/* 삭제 모달 */}
      {deleteModal && (
        <DeleteModal
          title={deleteModal.title}
          label="자료 삭제"
          onConfirm={(reason) => handleDeleteConfirm(deleteModal.id, reason)}
          onClose={() => setDeleteModal(null)}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

export default function AdminResourcesPage() {
  return (
    <Suspense>
      <AdminResourcesContent />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../lib/api";
import { getCrossLink } from "@/lib/contentCrossLink";
import type { AdminReportItem } from "@ai-jakdang/contracts";

/**
 * 신고 관리 페이지 (Story 9.10).
 * GET /api/v1/admin/reports 실제 API 연동.
 * URL 파라미터: page, status, targetType, dateFrom, dateTo, q
 * 상태 탭: 전체/접수/확인중/처리완료/반려
 * 드로어 방식 신고 상세: 확인중(즉시+토스트)·숨김(즉시+토스트)·반려(모달+사유 필수)
 */

// ── 상수 ─────────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "all", label: "전체" },
  { key: "pending", label: "접수" },
  { key: "reviewing", label: "확인중" },
  { key: "resolved", label: "처리완료" },
  { key: "dismissed", label: "반려" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["key"];

const TARGET_OPTIONS = [
  { value: "all", label: "대상 유형: 전체" },
  { value: "post", label: "게시글" },
  { value: "comment", label: "댓글" },
  { value: "question", label: "질문" },
  { value: "answer", label: "답변" },
  { value: "resource", label: "실전자료" },
  { value: "message", label: "쪽지" },
] as const;

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function statusBadge(status: string): [string, string] {
  switch (status) {
    case "pending": return ["badge-gray", "접수"];
    case "reviewing": return ["badge-purple", "확인중"];
    case "resolved": return ["badge-green", "처리완료"];
    case "dismissed": return ["badge-blue", "반려"];
    default: return ["badge-gray", status];
  }
}

function targetBadge(targetType: string): [string, string] {
  switch (targetType) {
    case "post": return ["badge-blue", "게시글"];
    case "comment": return ["badge-purple", "댓글"];
    case "question": return ["badge-blue", "질문"];
    case "answer": return ["badge-purple", "답변"];
    case "resource": return ["badge-cyan", "실전자료"];
    case "message": return ["badge-gray", "쪽지"];
    default: return ["badge-gray", targetType];
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
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff",
        borderRadius: 8,
        padding: "12px 20px",
        fontSize: 14,
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      <i className={type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} />
      {message}
    </div>
  );
}

// ── 반려 모달 ─────────────────────────────────────────────────────────────────

function RejectModal({
  reportId,
  onConfirm,
  onClose,
}: {
  reportId: string;
  onConfirm: (id: string, note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 8,
          padding: 24,
          width: 420,
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>신고 반려</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          반려 처리 후 복구가 어렵습니다. 반려 사유를 반드시 입력해주세요.
        </p>
        <label
          style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}
        >
          반려 사유 (필수)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="반려 사유를 입력하세요. (운영진만 열람)"
          rows={4}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 13,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            justifyContent: "flex-end",
          }}
        >
          <button className="btn btn-outline" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn-danger"
            disabled={!note.trim()}
            onClick={() => onConfirm(reportId, note.trim())}
          >
            반려 확정
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 상세 드로어 ───────────────────────────────────────────────────────────────

function ReportDrawer({
  report,
  onClose,
  onReview,
  onHide,
  onReject,
}: {
  report: AdminReportItem;
  onClose: () => void;
  onReview: (id: string) => void;
  onHide: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [sb, sl] = statusBadge(report.status);
  const [tb, tl] = targetBadge(report.targetType);
  const crossLink = getCrossLink(report.targetType, report.targetId);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 8000,
        display: "flex",
      }}
    >
      {/* Backdrop */}
      <div
        style={{ flex: 1, background: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
        aria-label="드로어 닫기"
      />
      {/* Panel */}
      <div
        style={{
          width: 440,
          background: "var(--surface)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>신고 상세</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="닫기"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        <div style={{ padding: "20px", flex: 1 }}>
          {/* 대상 정보 */}
          <div className="detail-list">
            <div className="detail-row">
              <div className="detail-label">대상 유형</div>
              <div className="detail-value">
                <span className={`badge ${tb}`}>{tl}</span>
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">대상 내용</div>
              <div className="detail-value">
                {report.targetPreview ?? "(미리보기 없음)"}
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">신고 사유</div>
              <div className="detail-value">{report.reasonCode}</div>
            </div>
            {report.detail && (
              <div className="detail-row">
                <div className="detail-label">상세 내용</div>
                <div className="detail-value">{report.detail}</div>
              </div>
            )}
            <div className="detail-row">
              <div className="detail-label">신고자</div>
              <div className="detail-value">
                <div className="author">
                  <span className="author-avatar">
                    {(report.reporterNickname ?? "?")[0]}
                  </span>
                  <span>{report.reporterNickname ?? "(알 수 없음)"}</span>
                </div>
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-label">신고일</div>
              <div className="detail-value">{formatDate(report.createdAt)}</div>
            </div>
            <div className="detail-row">
              <div className="detail-label">처리 상태</div>
              <div className="detail-value">
                <span className={`badge ${sb}`}>{sl}</span>
              </div>
            </div>
            {report.reviewedByName && (
              <div className="detail-row">
                <div className="detail-label">처리자</div>
                <div className="detail-value">{report.reviewedByName}</div>
              </div>
            )}
            {report.reviewedAt && (
              <div className="detail-row">
                <div className="detail-label">처리일시</div>
                <div className="detail-value">{formatDate(report.reviewedAt)}</div>
              </div>
            )}
          </div>

          {/* 신고 대상 보기 크로스 링크 */}
          {crossLink && (
            <div style={{ marginTop: 16 }}>
              <Link
                href={crossLink}
                className="btn btn-outline btn-sm"
                style={{ width: "100%", justifyContent: "center" }}
              >
                <i className="ri-external-link-line" />
                신고 대상 보기
              </Link>
            </div>
          )}

          <Link
            href={`/reports/${report.id}`}
            className="btn btn-outline btn-sm"
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            <i className="ri-eye-line" />
            상세 페이지 열기
          </Link>
        </div>

        {/* 액션 버튼 */}
        {report.status !== "resolved" && report.status !== "dismissed" && (
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {report.status === "pending" && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => onReview(report.id)}
              >
                <i className="ri-search-eye-line" />
                확인중
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onHide(report.id)}
            >
              <i className="ri-eye-off-line" />
              숨김 처리
            </button>
            <button
              className="btn btn-outline btn-sm"
              style={{ marginLeft: "auto" }}
              onClick={() => onReject(report.id)}
            >
              <i className="ri-close-circle-line" />
              반려
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 메인 페이지 컴포넌트 ──────────────────────────────────────────────────────

function AdminReportsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 파라미터
  const statusParam = (searchParams.get("status") ?? "all") as StatusTab;
  const targetTypeParam = searchParams.get("targetType") ?? "all";
  const dateFromParam = searchParams.get("dateFrom") ?? "";
  const dateToParam = searchParams.get("dateTo") ?? "";
  const qParam = searchParams.get("q") ?? "";
  const pageParam = Number(searchParams.get("page") ?? "1");

  // 로컬 필터 상태 (검색 버튼 누를 때 URL 반영)
  const [localQ, setLocalQ] = useState(qParam);
  const [localTargetType, setLocalTargetType] = useState(targetTypeParam);
  const [localDateFrom, setLocalDateFrom] = useState(dateFromParam);
  const [localDateTo, setLocalDateTo] = useState(dateToParam);

  // 데이터
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI 상태
  const [selectedReport, setSelectedReport] = useState<AdminReportItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
    },
    [],
  );

  // ── 목록 조회 ────────────────────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (statusParam !== "all") params.set("status", statusParam);
    if (targetTypeParam !== "all") params.set("targetType", targetTypeParam);
    if (dateFromParam) params.set("dateFrom", dateFromParam);
    if (dateToParam) params.set("dateTo", dateToParam);
    if (qParam) params.set("q", qParam);
    params.set("page", String(pageParam));
    params.set("pageSize", "20");

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        items: AdminReportItem[];
        meta: typeof meta;
      };
      setReports(data.items);
      setMeta(data.meta);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [statusParam, targetTypeParam, dateFromParam, dateToParam, qParam, pageParam]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  // ── URL 업데이트 헬퍼 ─────────────────────────────────────────────────────
  const updateUrl = useCallback(
    (patch: Record<string, string>) => {
      const p = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([k, v]) => {
        if (v) p.set(k, v);
        else p.delete(k);
      });
      p.set("page", "1");
      router.push(`/reports?${p.toString()}`);
    },
    [searchParams, router],
  );

  const handleSearch = () => {
    updateUrl({
      q: localQ,
      targetType: localTargetType === "all" ? "" : localTargetType,
      dateFrom: localDateFrom,
      dateTo: localDateTo,
    });
  };

  const handleReset = () => {
    setLocalQ("");
    setLocalTargetType("all");
    setLocalDateFrom("");
    setLocalDateTo("");
    router.push("/reports");
  };

  // ── 상태 변경 액션 ────────────────────────────────────────────────────────
  const handleReview = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${id}/review`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("확인중으로 변경되었습니다.");
      setSelectedReport(null);
      void fetchReports();
    } catch {
      showToast("처리 중 오류가 발생했습니다.", "error");
    }
  };

  const handleHide = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${id}/hide`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("숨김 처리되었습니다.");
      setSelectedReport(null);
      void fetchReports();
    } catch {
      showToast("처리 중 오류가 발생했습니다.", "error");
    }
  };

  const handleReject = async (id: string, note: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${id}/reject`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("신고가 반려되었습니다.");
      setRejectTarget(null);
      setSelectedReport(null);
      void fetchReports();
    } catch {
      showToast("처리 중 오류가 발생했습니다.", "error");
    }
  };

  return (
    <AdminShell breadcrumb={["관리자", "신고 관리"]} activeKey="reports">
      <div className="page-header">
        <div>
          <h1 className="page-title">신고 관리</h1>
          <p className="page-description">회원이 접수한 신고를 한 곳에서 확인하고 처리합니다.</p>
        </div>
      </div>

      {/* 운영 원칙 안내 */}
      <div className="alert alert-warning" role="note" style={{ marginBottom: "20px" }}>
        <i className="ri-alert-line" />
        <div>
          <strong>처리 원칙</strong>
          <br />
          신고가 들어왔다고 무조건 삭제하지 않습니다. 신고 대상과 사유를 먼저 확인한 뒤
          숨김 · 반려 중 적절한 조치를 선택하세요.
        </div>
      </div>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">신고 목록</h2>
            <p className="section-description">
              처리 상태 · 대상 유형 · 기간으로 좁혀 확인할 수 있습니다.
            </p>
          </div>
        </div>

        <article className="card">
          {/* 처리 상태 탭 */}
          <div className="line-tabs" role="tablist" aria-label="처리 상태">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                className={`line-tab${statusParam === t.key ? " active" : ""}`}
                onClick={() =>
                  updateUrl({ status: t.key === "all" ? "" : t.key })
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 필터 패널 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input
                  className="control"
                  type="search"
                  placeholder="대상 내용 또는 신고자 검색"
                  aria-label="신고 검색"
                  value={localQ}
                  onChange={(e) => setLocalQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>

              <select
                className="control"
                value={localTargetType}
                onChange={(e) => setLocalTargetType(e.target.value)}
                aria-label="대상 유형 필터"
              >
                {TARGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <input
                className="control"
                type="date"
                value={localDateFrom}
                onChange={(e) => setLocalDateFrom(e.target.value)}
                aria-label="시작 날짜"
                placeholder="시작 날짜"
              />
              <input
                className="control"
                type="date"
                value={localDateTo}
                onChange={(e) => setLocalDateTo(e.target.value)}
                aria-label="종료 날짜"
                placeholder="종료 날짜"
              />

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
              <span className="selection-info">
                총 {meta.totalItems}건의 신고
              </span>
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <div className="alert alert-error" style={{ margin: "0 20px 16px" }}>
              <i className="ri-error-warning-line" />
              {error}
            </div>
          )}

          {/* 신고 테이블 */}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>신고 대상</th>
                  <th>신고 사유</th>
                  <th>신고자</th>
                  <th>신고일</th>
                  <th>처리 상태</th>
                  <th>처리자</th>
                  <th style={{ width: "60px" }}>처리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px" }}>
                      불러오는 중...
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--gray-500)" }}>
                      신고가 없습니다.
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => {
                    const [sb, sl] = statusBadge(r.status);
                    const [tb, tl] = targetBadge(r.targetType);
                    return (
                      <tr key={r.id}>
                        <td>
                          <button
                            className="content-title"
                            style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
                            onClick={() => setSelectedReport(r)}
                          >
                            {r.targetPreview ?? "(미리보기 없음)"}
                          </button>
                          <div className="content-meta">
                            <span className={`badge ${tb}`}>{tl}</span>
                          </div>
                        </td>
                        <td>{r.reasonCode}</td>
                        <td>
                          <div className="author">
                            <span className="author-avatar">
                              {(r.reporterNickname ?? "?")[0]}
                            </span>
                            <span>{r.reporterNickname ?? "(알 수 없음)"}</span>
                          </div>
                        </td>
                        <td className="num">{formatDate(r.createdAt)}</td>
                        <td>
                          <span className={`badge ${sb}`}>{sl}</span>
                        </td>
                        <td>{r.reviewedByName ?? "-"}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button row-action-button"
                              aria-label="행 메뉴"
                              onClick={() => setSelectedReport(r)}
                            >
                              <i className="ri-more-2-fill" />
                            </button>
                            <div className="action-menu">
                              <button onClick={() => setSelectedReport(r)}>
                                <i className="ri-eye-line" />
                                상세보기
                              </button>
                              {r.status !== "resolved" && r.status !== "dismissed" && (
                                <>
                                  {r.status === "pending" && (
                                    <button onClick={() => void handleReview(r.id)}>
                                      <i className="ri-search-eye-line" />
                                      확인중으로 변경
                                    </button>
                                  )}
                                  <button onClick={() => void handleHide(r.id)}>
                                    <i className="ri-eye-off-line" />
                                    대상 숨김
                                  </button>
                                  <button onClick={() => setRejectTarget(r.id)}>
                                    <i className="ri-close-circle-line" />
                                    신고 반려
                                  </button>
                                </>
                              )}
                              <Link href={`/reports/${r.id}`}>
                                <i className="ri-external-link-line" />
                                상세 페이지
                              </Link>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {meta.totalPages > 1 && (
            <div className="pagination">
              <div className="page-info">
                {(meta.page - 1) * meta.pageSize + 1}–
                {Math.min(meta.page * meta.pageSize, meta.totalItems)} / 총 {meta.totalItems}건
              </div>
              <div className="page-buttons">
                <button
                  className="page-button"
                  aria-label="이전 페이지"
                  disabled={meta.page <= 1}
                  onClick={() =>
                    updateUrl({ page: String(meta.page - 1) })
                  }
                >
                  <i className="ri-arrow-left-s-line" />
                </button>
                {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      className={`page-button${meta.page === p ? " active" : ""}`}
                      onClick={() => updateUrl({ page: String(p) })}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  className="page-button"
                  aria-label="다음 페이지"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() =>
                    updateUrl({ page: String(meta.page + 1) })
                  }
                >
                  <i className="ri-arrow-right-s-line" />
                </button>
              </div>
            </div>
          )}
        </article>
      </section>

      {/* 상세 드로어 */}
      {selectedReport && (
        <ReportDrawer
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onReview={(id) => void handleReview(id)}
          onHide={(id) => void handleHide(id)}
          onReject={(id) => setRejectTarget(id)}
        />
      )}

      {/* 반려 모달 */}
      {rejectTarget && (
        <RejectModal
          reportId={rejectTarget}
          onConfirm={(id, note) => void handleReject(id, note)}
          onClose={() => setRejectTarget(null)}
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

export default function AdminReportsPage() {
  return (
    <Suspense fallback={null}>
      <AdminReportsPageInner />
    </Suspense>
  );
}

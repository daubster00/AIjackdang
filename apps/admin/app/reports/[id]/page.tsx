"use client";

import Link from "next/link";
import { use, useState, useEffect, useCallback } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../../lib/api";
import { getCrossLink } from "@/lib/contentCrossLink";
import type { AdminReportDetail } from "@ai-jakdang/contracts";

/**
 * 신고 상세 페이지 (Story 9.10).
 * GET /api/v1/admin/reports/:id 실제 API 연동.
 * 상태 변경 버튼: 확인중(즉시+토스트)·숨김(즉시+토스트)·반려(모달+사유 필수).
 */

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

function targetLabel(targetType: string): [string, string] {
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

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [report, setReport] = useState<AdminReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
    },
    [],
  );

  // ── 상세 조회 ──────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${id}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as AdminReportDetail;
      setReport(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  // ── 상태 변경 ──────────────────────────────────────────────────────────────
  const handleReview = async () => {
    if (!report || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${id}/review`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("확인중으로 변경되었습니다.");
      void fetchReport();
    } catch {
      showToast("처리 중 오류가 발생했습니다.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleHide = async () => {
    if (!report || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${id}/hide`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("숨김 처리되었습니다.");
      void fetchReport();
    } catch {
      showToast("처리 중 오류가 발생했습니다.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reportId: string, note: string) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/${reportId}/reject`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("신고가 반려되었습니다.");
      setRejectOpen(false);
      void fetchReport();
    } catch {
      showToast("처리 중 오류가 발생했습니다.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const crossLink = report ? getCrossLink(report.targetType, report.targetId) : null;
  const canAct =
    report &&
    report.status !== "resolved" &&
    report.status !== "dismissed";

  return (
    <AdminShell breadcrumb={["관리자", "신고 관리", "신고 상세"]} activeKey="reports">
      <div className="page-header">
        <div>
          <h1 className="page-title">신고 상세</h1>
          <p className="page-description">
            신고 번호 {id} · 대상과 사유를 확인하고 조치를 선택합니다.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href="/reports">
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
          {canAct && (
            <>
              {report.status === "pending" && (
                <button
                  className="btn btn-outline"
                  disabled={actionLoading}
                  onClick={() => void handleReview()}
                >
                  <i className="ri-search-eye-line" />
                  확인중으로 변경
                </button>
              )}
              <button
                className="btn btn-secondary"
                disabled={actionLoading}
                onClick={() => void handleHide()}
              >
                <i className="ri-eye-off-line" />
                대상 숨김
              </button>
              <button
                className="btn btn-outline"
                disabled={actionLoading}
                onClick={() => setRejectOpen(true)}
              >
                <i className="ri-close-circle-line" />
                신고 반려
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--gray-500)" }}>
          불러오는 중...
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <i className="ri-error-warning-line" />
          {error}
        </div>
      )}

      {report && (
        <>
          {/* 신고 대상 정보 */}
          <section className="section">
            <article className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">신고 대상 정보</h2>
                  <div className="card-subtitle">신고된 콘텐츠와 대상 유형 정보입니다.</div>
                </div>
                {crossLink && (
                  <Link href={crossLink} className="btn btn-outline btn-sm">
                    <i className="ri-external-link-line" />
                    신고 대상 보기
                  </Link>
                )}
              </div>
              <div className="card-body">
                <div className="detail-list">
                  <div className="detail-row">
                    <div className="detail-label">신고 대상</div>
                    <div className="detail-value">
                      {(() => {
                        const [tb, tl] = targetLabel(report.targetType);
                        return <span className={`badge ${tb}`}>{tl}</span>;
                      })()}
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
                    <div className="detail-label">처리 상태</div>
                    <div className="detail-value">
                      {(() => {
                        const [sb, sl] = statusBadge(report.status);
                        return <span className={`badge ${sb}`}>{sl}</span>;
                      })()}
                    </div>
                  </div>
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
                    <div className="detail-label">최초 신고일</div>
                    <div className="detail-value">{formatDate(report.createdAt)}</div>
                  </div>
                  {report.reviewedByName && (
                    <div className="detail-row">
                      <div className="detail-label">처리자</div>
                      <div className="detail-value">{report.reviewedByName}</div>
                    </div>
                  )}
                  {report.reviewedAt && (
                    <div className="detail-row">
                      <div className="detail-label">처리 일시</div>
                      <div className="detail-value">{formatDate(report.reviewedAt)}</div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          </section>
        </>
      )}

      {/* 반려 모달 */}
      {rejectOpen && report && (
        <RejectModal
          reportId={report.id}
          onConfirm={(rid, note) => void handleReject(rid, note)}
          onClose={() => setRejectOpen(false)}
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

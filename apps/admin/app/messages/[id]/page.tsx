"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "@/lib/api";

/**
 * 쪽지 상세 페이지 (Story 9.18).
 * GET /api/v1/admin/messages/:id 실제 API 연동.
 * 원문 카드 + 신고 내역 + 숨김/복구/발신제한/삭제 액션.
 */

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface MessageReportItem {
  id: string;
  reporterNickname: string;
  reasonCode: string;
  createdAt: string;
  status: string;
}

interface MessageDetail {
  id: string;
  senderId: string;
  senderNickname: string;
  receiverId: string;
  receiverNickname: string;
  body: string;
  createdAt: string;
  hiddenByAdmin: boolean;
  deletedAt: string | null;
  reportCount: number;
  reports: MessageReportItem[];
}

// ── 모달 ──────────────────────────────────────────────────────────────────────

function RestrictModal({
  senderNickname,
  onConfirm,
  onClose,
}: {
  senderNickname: string;
  onConfirm: (days: number, reason: string) => void;
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
      <div style={{ background: "var(--surface)", borderRadius: 8, padding: 24, width: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
        <h3 style={{ marginBottom: 8, fontSize: 16 }}>쪽지 발신제한</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          <strong>{senderNickname}</strong> 회원의 쪽지 발송을 제한합니다.
        </p>
        <label style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}>
          제한 기간 (일 수, 0 = 영구)
        </label>
        <input
          type="number" min={0} value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="control" style={{ marginBottom: 16 }}
        />
        <label style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}>
          제한 사유 (필수)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="제한 사유를 입력하세요"
          rows={3}
          style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>취소</button>
          <button
            className="btn btn-primary"
            disabled={!reason.trim()}
            onClick={() => onConfirm(days, reason.trim())}
          >
            발신제한 확정
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "var(--surface)", borderRadius: 8, padding: 24, width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>쪽지 삭제</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          이 쪽지를 삭제합니다. 최고관리자 전용 작업입니다.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>취소</button>
          <button className="btn btn-danger" onClick={onConfirm}>삭제 확정</button>
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
    </div>
  );
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function reportStatusBadge(status: string): [string, string] {
  switch (status) {
    case "pending": return ["badge-orange", "대기"];
    case "reviewing": return ["badge-blue", "검토중"];
    case "resolved": return ["badge-green", "처리됨"];
    case "dismissed": return ["badge-gray", "기각"];
    default: return ["badge-gray", status];
  }
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function MessageDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showRestrictModal, setShowRestrictModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages/${id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("상세 조회 실패");
      const data = await res.json();
      setDetail(data);
    } catch {
      showToast("쪽지 정보를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/get-session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.user?.role === "super_admin") setIsSuperAdmin(true); })
      .catch(() => {});
  }, []);

  async function handleHide() {
    if (!detail) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages/${id}/hide`, {
        method: "PATCH", credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("숨김 처리되었습니다.", "success");
      fetchDetail();
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleUnhide() {
    if (!detail) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages/${id}/unhide`, {
        method: "PATCH", credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("숨김이 복구되었습니다.", "success");
      fetchDetail();
    } catch {
      showToast("숨김 복구 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleDelete() {
    setShowDeleteModal(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("쪽지가 삭제되었습니다.", "success");
      fetchDetail();
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleRestrictConfirm(days: number, reason: string) {
    setShowRestrictModal(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/messages/${id}/restrict-sender`, {
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

  return (
    <AdminShell breadcrumb={["관리자", "쪽지 관리", "쪽지 상세"]} activeKey="messages">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">쪽지 상세</h1>
          <p className="page-description">발송된 쪽지 1건의 내용과 신고 정보를 확인하고 처리합니다.</p>
        </div>
        <div className="page-actions">
          <a className="btn btn-outline" href="/messages">
            <i className="ri-arrow-left-line" />
            목록으로
          </a>
          {detail && !detail.hiddenByAdmin ? (
            <button className="btn btn-outline" type="button" onClick={handleHide}>
              <i className="ri-eye-off-line" />
              숨김 처리
            </button>
          ) : detail?.hiddenByAdmin ? (
            <button className="btn btn-outline" type="button" onClick={handleUnhide}>
              <i className="ri-eye-line" />
              숨김 복구
            </button>
          ) : null}
          {detail && (
            <button className="btn btn-outline" type="button" onClick={() => setShowRestrictModal(true)}>
              <i className="ri-user-forbid-line" />
              발신제한
            </button>
          )}
          {isSuperAdmin && detail && (
            <button className="btn btn-danger" type="button" onClick={() => setShowDeleteModal(true)}>
              <i className="ri-delete-bin-line" />
              삭제
            </button>
          )}
        </div>
      </div>

      <section className="section">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>불러오는 중...</div>
        ) : !detail ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>쪽지를 찾을 수 없습니다.</div>
        ) : (
          <>
            {/* 쪽지 원문 카드 */}
            <article className="card">
              <div className="card-body">
                <div className="detail-list">
                  <div className="detail-row">
                    <div className="detail-label">발신자</div>
                    <div className="detail-value">
                      {detail.senderNickname}
                      <span className="content-meta" style={{ marginLeft: 8 }}>({detail.senderId.slice(0, 8)}...)</span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">수신자</div>
                    <div className="detail-value">
                      {detail.receiverNickname}
                      <span className="content-meta" style={{ marginLeft: 8 }}>({detail.receiverId.slice(0, 8)}...)</span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">발송 시각</div>
                    <div className="detail-value">{formatDate(detail.createdAt)}</div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">상태</div>
                    <div className="detail-value">
                      {detail.deletedAt ? (
                        <span className="badge badge-gray">삭제됨</span>
                      ) : detail.hiddenByAdmin ? (
                        <span className="badge badge-gray">숨김</span>
                      ) : detail.reportCount > 0 ? (
                        <span className="badge badge-orange">신고있음</span>
                      ) : (
                        <span className="badge badge-green">정상</span>
                      )}
                    </div>
                  </div>
                  {detail.reportCount > 0 && (
                    <div className="detail-row">
                      <div className="detail-label">신고 누적</div>
                      <div className="detail-value">
                        <span className="badge badge-red">{detail.reportCount}건</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 쪽지 본문 */}
                <div style={{ marginTop: 24 }}>
                  <div className="field-label" style={{ marginBottom: 8 }}>본문 내용</div>
                  <div
                    className="card"
                    style={{
                      padding: "16px 20px",
                      background: "var(--gray-50)",
                      borderColor: "var(--gray-200)",
                      lineHeight: 1.7,
                      fontSize: 14,
                      color: "var(--gray-800)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {detail.body}
                  </div>
                </div>
              </div>
            </article>

            {/* 신고 내역 */}
            {detail.reportCount > 0 && (
              <>
                <div className="section-heading" style={{ margin: "24px 0 12px" }}>
                  <div>
                    <h2 className="section-title">신고 내역 ({detail.reports.length})</h2>
                    <p className="section-description">이 쪽지에 누적된 신고 기록입니다.</p>
                  </div>
                </div>
                <article className="card">
                  <div className="alert alert-warning" style={{ margin: "16px 16px 0" }}>
                    <i className="ri-alert-line" />
                    <div>
                      <strong>신고 {detail.reportCount}건</strong>
                      <br />
                      내용 확인 후 숨김·삭제로 처리하세요.
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>사유 코드</th>
                          <th>신고자</th>
                          <th>접수일</th>
                          <th>상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.reports.map((rp) => {
                          const [badgeClass, badgeLabel] = reportStatusBadge(rp.status);
                          return (
                            <tr key={rp.id}>
                              <td><span className="badge badge-red">{rp.reasonCode}</span></td>
                              <td>{rp.reporterNickname}</td>
                              <td className="num">{formatDate(rp.createdAt)}</td>
                              <td><span className={`badge ${badgeClass}`}>{badgeLabel}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </article>
              </>
            )}
          </>
        )}
      </section>

      {/* 발신제한 모달 */}
      {showRestrictModal && detail && (
        <RestrictModal
          senderNickname={detail.senderNickname}
          onConfirm={handleRestrictConfirm}
          onClose={() => setShowRestrictModal(false)}
        />
      )}

      {/* 삭제 모달 */}
      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

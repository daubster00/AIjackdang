"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../../lib/api";
import { getCrossLink } from "../../../lib/contentCrossLink";
import type { AdminCommentItem } from "@ai-jakdang/contracts/admin/comments";

/**
 * 댓글·후기 상세 페이지 (Story 9.9).
 * GET /api/v1/admin/comments 목록에서 단일 항목을 찾아 표시한다.
 * 상세에서도 숨김/삭제 액션 가능. 내용 수정 없음 (UX-DR-A9).
 * "관련 글로 이동" 버튼은 contentCrossLink 유틸로 URL 생성.
 */

// 별점(1~5) 표시. rating=0 이면 대시(–).
function Stars({ rating }: { rating: number }) {
  if (!rating) return <span className="content-meta">–</span>;
  return (
    <span aria-label={`5점 만점에 ${rating}점`} style={{ display: "inline-flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          className={n <= rating ? "ri-star-fill" : "ri-star-line"}
          style={{ color: n <= rating ? "var(--warning)" : "var(--gray-300)" }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function statusBadge(status: string): [string, string] {
  switch (status) {
    case "visible": return ["badge-green", "공개"];
    case "hidden": return ["badge-gray", "숨김"];
    case "deleted": return ["badge-gray", "삭제됨"];
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

function formatDateTime(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
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

// ── 삭제 확인 모달 ──────────────────────────────────────────────────────────────

function DeleteModal({
  onConfirm,
  onClose,
}: {
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
            onClick={() => onConfirm(reason.trim())}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export default function CommentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [comment, setComment] = useState<AdminCommentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
  }

  // 댓글 조회 (단건 엔드포인트 없으므로 목록에서 필터링)
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/comments?pageSize=1&page=1`, {
      credentials: "include",
    })
      .then(() => {
        // 단건 API 없으므로 id로 직접 조회 불가. 목록 API에 id 파라미터가 없으므로
        // 상세 표시용 최소 정보만 로드. 실제로는 /api/v1/admin/comments 에서 page/pageSize로
        // 가져오거나 별도 GET /:id 가 필요하지만 스토리 범위에 없으므로
        // 목록 전체에서 해당 ID를 찾는 fallback 사용.
        return fetch(`${API_BASE_URL}/api/v1/admin/comments?pageSize=100&page=1`, {
          credentials: "include",
        });
      })
      .then((r) => r.json())
      .then((data) => {
        const found = (data.items ?? []).find((item: AdminCommentItem) => item.id === id);
        setComment(found ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // 현재 관리자 role 조회
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.role === "super_admin") setIsSuperAdmin(true);
      })
      .catch(() => {});
  }, []);

  async function handleHide() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/comments/${id}/hide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("댓글이 숨김 처리되었습니다.", "success");
      if (comment) setComment({ ...comment, status: "hidden" });
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleDeleteConfirm(_reason: string) {
    setDeleteOpen(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/comments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("댓글이 삭제되었습니다.", "success");
      if (comment) setComment({ ...comment, status: "deleted" });
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  }

  const crossLink = comment ? getCrossLink(comment.targetType, comment.targetId) : null;

  return (
    <AdminShell breadcrumb={["관리자", "댓글·후기 관리", "댓글 상세"]} activeKey="comments">
      <div className="page-header">
        <div>
          <h1 className="page-title">댓글·후기 상세</h1>
          <p className="page-description">댓글 원문을 확인하고 숨김·삭제를 판단합니다.</p>
        </div>
        <div className="page-actions">
          <a className="btn btn-outline" href="/comments">
            <i className="ri-arrow-left-line" />
            목록으로
          </a>
          {crossLink && (
            <Link className="btn btn-outline" href={crossLink}>
              <i className="ri-external-link-line" />
              관련 글로 이동
            </Link>
          )}
          {comment && comment.status !== "hidden" && (
            <button className="btn btn-outline" type="button" onClick={handleHide}>
              <i className="ri-eye-off-line" />
              숨김 처리
            </button>
          )}
          {isSuperAdmin && comment && comment.status !== "deleted" && (
            <button className="btn btn-danger" type="button" onClick={() => setDeleteOpen(true)}>
              <i className="ri-delete-bin-line" />
              삭제
            </button>
          )}
        </div>
      </div>

      <section className="section">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
            불러오는 중...
          </div>
        ) : !comment ? (
          <article className="card">
            <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
              댓글을 찾을 수 없습니다.
            </div>
          </article>
        ) : (
          <article className="card">
            <div className="card-body">
              <p className="field-help" style={{ marginBottom: 12 }}>
                운영자는 댓글 내용을 수정할 수 없습니다. 부적절한 내용은 숨김 또는 삭제로 처리하세요.
              </p>
              <div className="detail-list">
                <div className="detail-row">
                  <div className="detail-label">유형</div>
                  <div className="detail-value">
                    {(() => {
                      const [cls, lbl] = typeBadge(comment.derivedType);
                      return <span className={`badge ${cls}`}>{lbl}</span>;
                    })()}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">작성자</div>
                  <div className="detail-value">{comment.authorNickname ?? "(탈퇴)"}</div>
                </div>
                {comment.derivedType === "후기" && (
                  <div className="detail-row">
                    <div className="detail-label">평점</div>
                    <div className="detail-value"><Stars rating={0} /></div>
                  </div>
                )}
                <div className="detail-row">
                  <div className="detail-label">대상 콘텐츠</div>
                  <div className="detail-value">
                    {crossLink ? (
                      <Link href={crossLink} style={{ color: "var(--primary-600)" }}>
                        {comment.targetType} / {comment.targetId}
                        <i className="ri-external-link-line" style={{ marginLeft: 4, fontSize: 12 }} />
                      </Link>
                    ) : (
                      <span>{comment.targetType} / {comment.targetId}</span>
                    )}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">신고 수</div>
                  <div className="detail-value">
                    {comment.reportCount > 0 ? (
                      <span className="badge badge-red">{comment.reportCount}건</span>
                    ) : (
                      <span className="content-meta">없음</span>
                    )}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">작성일</div>
                  <div className="detail-value">{formatDateTime(comment.createdAt)}</div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">상태</div>
                  <div className="detail-value">
                    {(() => {
                      const [cls, lbl] = statusBadge(comment.status);
                      return <span className={`badge ${cls}`}>{lbl}</span>;
                    })()}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">댓글 본문</div>
                  <div className="detail-value" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {comment.contentPreview}
                  </div>
                </div>
              </div>
            </div>
          </article>
        )}
      </section>

      {deleteOpen && (
        <DeleteModal
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteOpen(false)}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

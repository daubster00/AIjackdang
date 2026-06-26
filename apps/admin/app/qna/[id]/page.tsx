"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../../lib/api";
import type {
  AdminQnaQuestionItem,
  AdminQnaAnswerItem,
  QnaStatus,
} from "@ai-jakdang/contracts/admin/qna";

/**
 * Q&A 질문 상세 페이지 (Story 9.7).
 *
 * - 질문 메타 + Q&A 상태 강제 변경 셀렉트 + 저장 버튼
 * - 답변 목록: 숨김/삭제 액션
 * - 가드레일: 내용 직접 수정 UI 없음(UX-DR-A9)
 * - 도움된 답변 지정 기능 없음 — 배지 표시만
 */

const QNA_STATUS_OPTIONS: { value: QnaStatus; label: string }[] = [
  { value: "pending", label: "답변대기" },
  { value: "answered", label: "답변있음" },
  { value: "resolved", label: "해결됨" },
];

function qnaStatusBadge(qnaStatus: string): [string, string] {
  switch (qnaStatus) {
    case "pending": return ["badge-orange", "답변대기"];
    case "answered": return ["badge-cyan", "답변있음"];
    case "resolved": return ["badge-green", "해결됨"];
    default: return ["badge-gray", qnaStatus];
  }
}

function contentStatusBadge(status: string): [string, string] {
  switch (status) {
    case "published": return ["badge-green", "공개"];
    case "hidden": return ["badge-gray", "숨김"];
    case "deleted": return ["badge-red", "삭제"];
    case "draft": return ["badge-yellow", "초안"];
    default: return ["badge-gray", status];
  }
}

function answerStatusBadge(status: string): [string, string] {
  switch (status) {
    case "published": return ["badge-green", "공개"];
    case "hidden": return ["badge-gray", "숨김"];
    case "deleted": return ["badge-red", "삭제"];
    default: return ["badge-gray", status];
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
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
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff",
        borderRadius: 8,
        padding: "14px 24px",
        fontSize: 14,
        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 240,
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

// ── 삭제 모달 ────────────────────────────────────────────────────────────────

function DeleteModal({
  targetLabel,
  onConfirm,
  onClose,
}: {
  targetLabel: string;
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
          width: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>삭제 확인</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 8 }}>
          soft-delete이므로 복구 가능합니다.
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, wordBreak: "break-all" }}>
          {targetLabel}
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

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function QnaDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [question, setQuestion] = useState<AdminQnaQuestionItem | null>(null);
  const [answers, setAnswers] = useState<AdminQnaAnswerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Q&A 상태 강제 변경용 로컬 상태
  const [selectedQnaStatus, setSelectedQnaStatus] = useState<QnaStatus>("pending");
  const [savingStatus, setSavingStatus] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ type: "question" | "answer"; id: string; label: string } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // 관리자 role 조회
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/get-session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.role === "super_admin") setIsSuperAdmin(true);
      })
      .catch(() => {});
  }, []);

  // 질문 상세 조회
  const fetchQuestion = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 단건 조회는 목록 API에서 ID 필터로 대신한다.
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/questions?pageSize=1&page=1`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      // 목록에서 해당 ID 탐색
      const found = (data.items as AdminQnaQuestionItem[]).find((q) => q.id === id);
      if (found) {
        setQuestion(found);
        setSelectedQnaStatus(found.qnaStatus);
      }
    } catch {
      showToast("질문 정보를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  // 답변 목록 조회
  const fetchAnswers = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/answers?questionId=${id}&pageSize=100`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAnswers(data.items ?? []);
    } catch {
      showToast("답변 목록을 불러오지 못했습니다.", "error");
    }
  }, [id, showToast]);

  useEffect(() => {
    fetchQuestion();
    fetchAnswers();
  }, [fetchQuestion, fetchAnswers]);

  // Q&A 상태 강제 저장
  async function handleSaveStatus() {
    if (!question) return;
    setSavingStatus(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/questions/${question.id}/status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qnaStatus: selectedQnaStatus }),
        },
      );
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("Q&A 상태가 변경되었습니다.", "success");
      fetchQuestion();
    } catch {
      showToast("상태 변경 중 오류가 발생했습니다.", "error");
    } finally {
      setSavingStatus(false);
    }
  }

  // 질문 숨김
  async function handleHideQuestion() {
    if (!question) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/questions/${question.id}/hide`,
        { method: "PATCH", credentials: "include" },
      );
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("질문이 숨김 처리되었습니다.", "success");
      fetchQuestion();
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  // 답변 숨김
  async function handleHideAnswer(answerId: string) {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/answers/${answerId}/hide`,
        { method: "PATCH", credentials: "include" },
      );
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("답변이 숨김 처리되었습니다.", "success");
      fetchAnswers();
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  // 삭제 실행
  async function handleDeleteConfirm() {
    if (!deleteModal) return;
    const { type, id: targetId } = deleteModal;
    setDeleteModal(null);
    try {
      const url =
        type === "question"
          ? `${API_BASE_URL}/api/v1/admin/qna/questions/${targetId}`
          : `${API_BASE_URL}/api/v1/admin/qna/answers/${targetId}`;
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast(type === "question" ? "질문이 삭제되었습니다." : "답변이 삭제되었습니다.", "success");
      if (type === "question") {
        fetchQuestion();
      } else {
        fetchAnswers();
      }
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  }

  if (loading) {
    return (
      <AdminShell breadcrumb={["관리자", "묻고답하기 관리", "질문 상세"]} activeKey="qna">
        <div style={{ padding: 60, textAlign: "center", color: "var(--gray-400)" }}>
          불러오는 중...
        </div>
      </AdminShell>
    );
  }

  const [qnaBadge, qnaLabel] = question ? qnaStatusBadge(question.qnaStatus) : ["badge-gray", "알 수 없음"];
  const [contentBadge, contentLabel] = question ? contentStatusBadge(question.status) : ["badge-gray", "알 수 없음"];

  return (
    <AdminShell breadcrumb={["관리자", "묻고답하기 관리", "질문 상세"]} activeKey="qna">
      <div className="page-header">
        <div>
          <h1 className="page-title">질문 상세</h1>
          <p className="page-description">질문 정보를 확인하고 Q&A 상태 강제 변경 및 숨김·삭제를 처리합니다.</p>
        </div>
        <div className="page-actions">
          <a className="btn btn-outline" href="/qna">
            <i className="ri-arrow-left-line" />
            목록으로
          </a>
          {/* 운영 가드레일: 내용 직접 수정 버튼 없음 (UX-DR-A9) */}
        </div>
      </div>

      <section className="section">
        {/* 운영 안내 배너 */}
        <div className="alert alert-warning" style={{ marginBottom: 18 }}>
          <i className="ri-alert-line" />
          <div>
            <strong>운영 안내</strong>
            <br />
            도움된 답변 지정은 질문 작성자만 할 수 있습니다. 운영자는 Q&A 상태 변경·숨김·삭제만 처리하세요.
            내용 직접 수정은 허용되지 않습니다.
          </div>
        </div>

        {!question ? (
          <article className="card">
            <div className="card-body">
              <p style={{ color: "var(--gray-500)" }}>질문을 찾을 수 없습니다.</p>
            </div>
          </article>
        ) : (
          <>
            {/* 질문 메타 카드 */}
            <article className="card">
              <div className="card-body">
                <div className="detail-list">
                  <div className="detail-row">
                    <div className="detail-label">제목</div>
                    <div className="detail-value" style={{ fontWeight: 600 }}>{question.title}</div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">Q&A 상태</div>
                    <div className="detail-value">
                      <span className={`badge ${qnaBadge}`}>{qnaLabel}</span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">콘텐츠 상태</div>
                    <div className="detail-value">
                      <span className={`badge ${contentBadge}`}>{contentLabel}</span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">작성자</div>
                    <div className="detail-value">{question.authorNickname ?? "(탈퇴)"}</div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">작성일</div>
                    <div className="detail-value">{formatDate(question.createdAt)}</div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-label">통계</div>
                    <div className="detail-value">
                      조회 {question.viewCount.toLocaleString()} · 답변 {question.answerCount} · 신고 {question.reportCount}
                    </div>
                  </div>
                  {question.helpfulAnswerId && (
                    <div className="detail-row">
                      <div className="detail-label">도움된 답변</div>
                      <div className="detail-value">
                        <span className="badge badge-purple">
                          <i className="ri-medal-line" /> 지정됨 (질문자가 지정)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Q&A 상태 강제 변경 */}
                <div
                  style={{
                    marginTop: 24,
                    padding: "16px 20px",
                    background: "var(--gray-50, #f9fafb)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-700)", marginBottom: 12 }}>
                    Q&A 상태 강제 변경
                  </p>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <select
                      className="control"
                      value={selectedQnaStatus}
                      onChange={(e) => setSelectedQnaStatus(e.target.value as QnaStatus)}
                      style={{ maxWidth: 200 }}
                    >
                      {QNA_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-primary"
                      disabled={savingStatus || selectedQnaStatus === question.qnaStatus}
                      onClick={handleSaveStatus}
                    >
                      {savingStatus ? "저장 중..." : "저장"}
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 8 }}>
                    &lsquo;해결됨&rsquo;으로 변경하면 isResolved=true로 강제 설정됩니다.
                  </p>
                </div>

                {/* 질문 액션 */}
                <div className="button-showcase" style={{ marginTop: 20 }}>
                  {question.status !== "hidden" && question.status !== "deleted" && (
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={handleHideQuestion}
                    >
                      <i className="ri-eye-off-line" />
                      질문 숨김
                    </button>
                  )}
                  {isSuperAdmin && question.status !== "deleted" && (
                    <button
                      className="btn btn-danger btn-sm"
                      type="button"
                      onClick={() =>
                        setDeleteModal({
                          type: "question",
                          id: question.id,
                          label: question.title,
                        })
                      }
                    >
                      <i className="ri-delete-bin-line" />
                      질문 삭제
                    </button>
                  )}
                </div>
              </div>
            </article>

            {/* 답변 목록 */}
            <div className="section-heading" style={{ margin: "24px 0 12px" }}>
              <div>
                <h2 className="section-title">답변 목록 ({answers.length})</h2>
                <p className="section-description">답변별 숨김·삭제만 처리합니다. 내용 수정은 불가합니다(UX-DR-A9).</p>
              </div>
            </div>

            <article className="card">
              <div className="card-body component-stack">
                {answers.length === 0 ? (
                  <p style={{ color: "var(--gray-400)", textAlign: "center", padding: "20px 0" }}>
                    등록된 답변이 없습니다.
                  </p>
                ) : (
                  answers.map((ans) => {
                    const [ansBadge, ansLabel] = answerStatusBadge(ans.status);
                    const isHelpful = question.helpfulAnswerId === ans.id;
                    return (
                      <div
                        key={ans.id}
                        style={
                          ans.status === "hidden" || ans.status === "deleted"
                            ? { opacity: 0.55 }
                            : isHelpful
                              ? { borderLeft: "3px solid var(--primary-600)", paddingLeft: 12 }
                              : undefined
                        }
                      >
                        <div className="detail-list">
                          <div className="detail-row">
                            <div className="detail-label">
                              <div className="author">
                                <span className="author-avatar">
                                  {ans.authorNickname ? ans.authorNickname.slice(0, 1) : "?"}
                                </span>
                                <span>{ans.authorNickname ?? "(탈퇴)"}</span>
                              </div>
                            </div>
                            <div className="detail-value" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <span className={`badge ${ansBadge}`}>{ansLabel}</span>
                              {isHelpful && (
                                <span className="badge badge-purple">
                                  <i className="ri-medal-line" /> 도움된답변
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="detail-row">
                            <div className="detail-label">작성일</div>
                            <div className="detail-value">{formatDate(ans.createdAt)}</div>
                          </div>
                          {ans.reportCount > 0 && (
                            <div className="detail-row">
                              <div className="detail-label">신고수</div>
                              <div className="detail-value">
                                <span className="badge badge-red">{ans.reportCount}건</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* 답변 액션 — 내용 수정 버튼 없음 */}
                        <div className="button-showcase" style={{ marginTop: 10 }}>
                          {ans.status !== "hidden" && ans.status !== "deleted" && (
                            <button
                              className="btn btn-outline btn-sm"
                              type="button"
                              onClick={() => handleHideAnswer(ans.id)}
                            >
                              <i className="ri-eye-off-line" />
                              답변 숨김
                            </button>
                          )}
                          {isSuperAdmin && ans.status !== "deleted" && (
                            <button
                              className="btn btn-danger btn-sm"
                              type="button"
                              onClick={() =>
                                setDeleteModal({
                                  type: "answer",
                                  id: ans.id,
                                  label: `답변 #${ans.id.slice(0, 8)} — ${ans.authorNickname ?? "(탈퇴)"}`,
                                })
                              }
                            >
                              <i className="ri-delete-bin-line" />
                              답변 삭제
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </article>
          </>
        )}
      </section>

      {/* 삭제 모달 */}
      {deleteModal && (
        <DeleteModal
          targetLabel={deleteModal.label}
          onConfirm={handleDeleteConfirm}
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

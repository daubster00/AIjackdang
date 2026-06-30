"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { Select } from "@/components/ui/Select";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { confirmDialog, notifyDialog } from "@/lib/dialog";
import { API_BASE_URL } from "../../../lib/api";
import type {
  AdminQnaQuestionItem,
  AdminQnaAnswerItem,
  QnaStatus,
} from "@ai-jakdang/contracts/admin/qna";

/**
 * Q&A 질문 상세 페이지 (Story 9.7 + 이슈 1~4 수정).
 *
 * 이슈 1: 답변 본문(contentJson) 렌더링 추가
 * 이슈 2: 답변 클릭 → 상세 뷰 전환(답변 본문 + 원본 질문 내용)
 * 이슈 3: 삭제 후 낙관적으로 목록에서 즉시 제거
 * 이슈 4: 숨김된 답변에 "다시 보이기" 버튼 추가 + API 연동
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

/**
 * contentJson → 렌더 가능한 HTML 문자열.
 * LightEditor 래퍼 `{ html: "..." }` 가 있으면 우선 사용하고,
 * 없으면 Tiptap JSON 노드에서 텍스트를 재귀 추출한다.
 */
function contentJsonToHtml(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const obj = json as Record<string, unknown>;
  if (typeof obj.html === "string") return obj.html;

  function extractText(node: Record<string, unknown>): string {
    if (node.type === "text") return String(node.text ?? "");
    if (Array.isArray(node.content)) {
      return (node.content as Record<string, unknown>[])
        .map((child) => extractText(child))
        .join(" ");
    }
    return "";
  }
  const text = extractText(obj);
  return text ? `<p>${text}</p>` : "";
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

  // 이슈 2: 선택된 답변 상세 뷰 상태
  const [selectedAnswer, setSelectedAnswer] = useState<AdminQnaAnswerItem | null>(null);

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
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/questions/${id}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error();
      const found = await res.json() as AdminQnaQuestionItem;
      setQuestion(found);
      setSelectedQnaStatus(found.qnaStatus);
    } catch {
      await notifyDialog("질문 정보를 불러오지 못했습니다.", "danger");
    } finally {
      setLoading(false);
    }
  }, [id]);

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
      await notifyDialog("답변 목록을 불러오지 못했습니다.", "danger");
    }
  }, [id]);

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
      if (res.status === 403) { await notifyDialog("권한이 없습니다.", "danger"); return; }
      if (!res.ok) throw new Error();
      await notifyDialog("Q&A 상태가 변경되었습니다.", "success");
      fetchQuestion();
    } catch {
      await notifyDialog("상태 변경 중 오류가 발생했습니다.", "danger");
    } finally {
      setSavingStatus(false);
    }
  }

  // 질문 숨김
  async function handleHideQuestion() {
    if (!question) return;
    const ok = await confirmDialog("질문을 숨김 처리하겠습니까?");
    if (!ok) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/questions/${question.id}/hide`,
        { method: "PATCH", credentials: "include" },
      );
      if (res.status === 403) { await notifyDialog("권한이 없습니다.", "danger"); return; }
      if (!res.ok) throw new Error();
      await notifyDialog("질문이 숨김 처리되었습니다.", "success");
      fetchQuestion();
    } catch {
      await notifyDialog("숨김 처리 중 오류가 발생했습니다.", "danger");
    }
  }

  // 질문 숨김 복구
  async function handleUnhideQuestion() {
    if (!question) return;
    const ok = await confirmDialog("질문을 다시 공개 처리하겠습니까?");
    if (!ok) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/questions/${question.id}/unhide`,
        { method: "PATCH", credentials: "include" },
      );
      if (res.status === 403) { await notifyDialog("권한이 없습니다.", "danger"); return; }
      if (!res.ok) throw new Error();
      await notifyDialog("질문이 다시 공개 처리되었습니다.", "success");
      fetchQuestion();
    } catch {
      await notifyDialog("공개 처리 중 오류가 발생했습니다.", "danger");
    }
  }

  // 질문 삭제
  async function handleDeleteQuestion() {
    if (!question) return;
    const ok = await confirmDialog(
      `질문 "${question.title}"을(를) 삭제하겠습니까?\n(soft-delete — 복구 가능)`,
    );
    if (!ok) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/questions/${question.id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (res.status === 403) { await notifyDialog("최고 관리자(super_admin) 권한이 필요합니다.", "danger"); return; }
      if (!res.ok) throw new Error();
      await notifyDialog("질문이 삭제되었습니다.", "success");
      fetchQuestion();
    } catch {
      await notifyDialog("삭제 중 오류가 발생했습니다.", "danger");
    }
  }

  // 답변 숨김 (이슈 4)
  async function handleHideAnswer(answerId: string) {
    const ok = await confirmDialog("이 답변을 숨김 처리하겠습니까?");
    if (!ok) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/answers/${answerId}/hide`,
        { method: "PATCH", credentials: "include" },
      );
      if (res.status === 403) { await notifyDialog("권한이 없습니다.", "danger"); return; }
      if (!res.ok) throw new Error();
      // 낙관적 업데이트: 해당 답변 status를 'hidden'으로 변경
      setAnswers((prev) =>
        prev.map((a) => (a.id === answerId ? { ...a, status: "hidden" as const } : a)),
      );
      // 상세 뷰에서 숨김 처리 시 상세 뷰도 업데이트
      if (selectedAnswer?.id === answerId) {
        setSelectedAnswer((prev) => prev ? { ...prev, status: "hidden" as const } : null);
      }
      await notifyDialog("답변이 숨김 처리되었습니다.", "success");
    } catch {
      await notifyDialog("숨김 처리 중 오류가 발생했습니다.", "danger");
    }
  }

  // 답변 숨김 복구 (이슈 4)
  async function handleUnhideAnswer(answerId: string) {
    const ok = await confirmDialog("이 답변을 다시 공개 처리하겠습니까?");
    if (!ok) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/answers/${answerId}/unhide`,
        { method: "PATCH", credentials: "include" },
      );
      if (res.status === 403) { await notifyDialog("권한이 없습니다.", "danger"); return; }
      if (!res.ok) throw new Error();
      // 낙관적 업데이트
      setAnswers((prev) =>
        prev.map((a) => (a.id === answerId ? { ...a, status: "published" as const } : a)),
      );
      if (selectedAnswer?.id === answerId) {
        setSelectedAnswer((prev) => prev ? { ...prev, status: "published" as const } : null);
      }
      await notifyDialog("답변이 다시 공개 처리되었습니다.", "success");
    } catch {
      await notifyDialog("공개 처리 중 오류가 발생했습니다.", "danger");
    }
  }

  // 답변 삭제 (이슈 3: 낙관적 제거)
  async function handleDeleteAnswer(answerId: string, label: string) {
    const ok = await confirmDialog(
      `답변 "${label}"을(를) 삭제하겠습니까?\n(soft-delete — 복구 가능)`,
    );
    if (!ok) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/qna/answers/${answerId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (res.status === 403) { await notifyDialog("최고 관리자(super_admin) 권한이 필요합니다.", "danger"); return; }
      if (!res.ok) throw new Error();
      // 이슈 3: 목록에서 즉시 제거 (낙관적)
      setAnswers((prev) => prev.filter((a) => a.id !== answerId));
      // 상세 뷰에서 삭제한 경우 뷰 닫기
      if (selectedAnswer?.id === answerId) {
        setSelectedAnswer(null);
      }
      await notifyDialog("답변이 삭제되었습니다.", "success");
    } catch {
      await notifyDialog("삭제 중 오류가 발생했습니다.", "danger");
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

  // 이슈 2: 답변 상세 뷰
  if (selectedAnswer) {
    const [ansBadge, ansLabel] = answerStatusBadge(selectedAnswer.status);
    const ansHtml = contentJsonToHtml(selectedAnswer.contentJson);
    const questionHtml = question ? contentJsonToHtml(question.contentJson) : "";

    return (
      <AdminShell breadcrumb={["관리자", "묻고답하기 관리", "질문 상세", "답변 상세"]} activeKey="qna">
        <div className="page-header">
          <div>
            <h1 className="page-title">답변 상세</h1>
            <p className="page-description">선택한 답변의 내용과 원본 질문을 확인합니다.</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-outline" type="button" onClick={() => setSelectedAnswer(null)}>
              <i className="ri-arrow-left-line" />
              답변 목록으로
            </button>
          </div>
        </div>

        <section className="section">
          {/* 답변 본문 */}
          <div className="section-heading" style={{ margin: "0 0 12px" }}>
            <h2 className="section-title">답변 내용</h2>
          </div>
          <article className="card" style={{ marginBottom: 24 }}>
            <div className="card-body">
              <div className="detail-list" style={{ marginBottom: 16 }}>
                <div className="detail-row">
                  <div className="detail-label">작성자</div>
                  <div className="detail-value">
                    <div className="author">
                      <UserAvatar
                        size={28}
                        alt={selectedAnswer.authorNickname ?? "탈퇴"}
                        avatarUrl={selectedAnswer.authorAvatarUrl}
                        image={selectedAnswer.authorImage}
                        defaultAvatarIndex={selectedAnswer.authorDefaultAvatarIndex ?? 0}
                      />
                      <span>{selectedAnswer.authorNickname ?? "(탈퇴)"}</span>
                    </div>
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">상태</div>
                  <div className="detail-value">
                    <span className={`badge ${ansBadge}`}>{ansLabel}</span>
                    {question?.helpfulAnswerId === selectedAnswer.id && (
                      <span className="badge badge-purple" style={{ marginLeft: 6 }}>
                        <i className="ri-medal-line" /> 도움된답변
                      </span>
                    )}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">작성일</div>
                  <div className="detail-value">{formatDate(selectedAnswer.createdAt)}</div>
                </div>
                {selectedAnswer.reportCount > 0 && (
                  <div className="detail-row">
                    <div className="detail-label">신고수</div>
                    <div className="detail-value">
                      <span className="badge badge-red">{selectedAnswer.reportCount}건</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 답변 본문 렌더 (이슈 1) */}
              {ansHtml ? (
                <div
                  className="prose"
                  style={{
                    padding: "16px",
                    background: "var(--gray-50, #f9fafb)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 14,
                    lineHeight: 1.7,
                  }}
                  dangerouslySetInnerHTML={{ __html: ansHtml }}
                />
              ) : (
                <p style={{ color: "var(--gray-400)", fontSize: 13 }}>본문이 없습니다.</p>
              )}

              {/* 답변 액션 */}
              <div className="button-showcase" style={{ marginTop: 16 }}>
                {selectedAnswer.status === "published" && (
                  <button
                    className="btn btn-outline btn-sm"
                    type="button"
                    onClick={() => handleHideAnswer(selectedAnswer.id)}
                  >
                    <i className="ri-eye-off-line" />
                    답변 숨김
                  </button>
                )}
                {selectedAnswer.status === "hidden" && (
                  <button
                    className="btn btn-outline btn-sm"
                    type="button"
                    onClick={() => handleUnhideAnswer(selectedAnswer.id)}
                  >
                    <i className="ri-eye-line" />
                    다시 보이기
                  </button>
                )}
                {isSuperAdmin && selectedAnswer.status !== "deleted" && (
                  <button
                    className="btn btn-danger btn-sm"
                    type="button"
                    onClick={() =>
                      handleDeleteAnswer(
                        selectedAnswer.id,
                        `답변 #${selectedAnswer.id.slice(0, 8)} — ${selectedAnswer.authorNickname ?? "(탈퇴)"}`,
                      )
                    }
                  >
                    <i className="ri-delete-bin-line" />
                    답변 삭제
                  </button>
                )}
              </div>
            </div>
          </article>

          {/* 이슈 2: 하단에 원본 질문 내용 */}
          <div className="section-heading" style={{ margin: "0 0 12px" }}>
            <h2 className="section-title">원본 질문</h2>
          </div>
          <article className="card">
            <div className="card-body">
              {question ? (
                <>
                  <p style={{ fontWeight: 600, marginBottom: 12 }}>{question.title}</p>
                  {questionHtml ? (
                    <div
                      className="prose"
                      style={{
                        padding: "16px",
                        background: "var(--gray-50, #f9fafb)",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        fontSize: 14,
                        lineHeight: 1.7,
                      }}
                      dangerouslySetInnerHTML={{ __html: questionHtml }}
                    />
                  ) : (
                    <p style={{ color: "var(--gray-400)", fontSize: 13 }}>질문 본문이 없습니다.</p>
                  )}
                </>
              ) : (
                <p style={{ color: "var(--gray-400)", fontSize: 13 }}>질문 정보를 불러오지 못했습니다.</p>
              )}
            </div>
          </article>
        </section>
      </AdminShell>
    );
  }

  // ── 기본 뷰: 질문 메타 + 답변 목록 ──────────────────────────────────────────

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
                    <div style={{ minWidth: 200 }}>
                      <Select
                        options={QNA_STATUS_OPTIONS}
                        value={selectedQnaStatus}
                        onChange={(v) => setSelectedQnaStatus(v as QnaStatus)}
                      />
                    </div>
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
                  {question.status === "hidden" && (
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={handleUnhideQuestion}
                    >
                      <i className="ri-eye-line" />
                      다시 보이기
                    </button>
                  )}
                  {isSuperAdmin && question.status !== "deleted" && (
                    <button
                      className="btn btn-danger btn-sm"
                      type="button"
                      onClick={handleDeleteQuestion}
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
                <h2 className="section-title">답변 목록 ({answers.filter((a) => a.status !== "deleted").length})</h2>
                <p className="section-description">
                  항목을 클릭하면 답변 상세 내용을 확인할 수 있습니다. 숨김·삭제만 처리 가능합니다(UX-DR-A9).
                </p>
              </div>
            </div>

            <div className="component-stack">
              {answers.length === 0 ? (
                <p style={{ color: "var(--gray-400)", textAlign: "center", padding: "20px 0" }}>
                  등록된 답변이 없습니다.
                </p>
              ) : (
                /* M10: deleted 답변은 렌더에서 제외 */
                answers.filter((a) => a.status !== "deleted").map((ans) => {
                  const [ansBadge, ansLabel] = answerStatusBadge(ans.status);
                  const isHelpful = question.helpfulAnswerId === ans.id;
                  /* M8: 목록 카드에서 바로 렌더할 본문 HTML */
                  const ansContentHtml = contentJsonToHtml(ans.contentJson);
                  return (
                    <article
                      key={ans.id}
                      className="card"
                      style={{
                        opacity: ans.status === "hidden" ? 0.75 : 1,
                        borderLeft: isHelpful ? "3px solid var(--primary-600)" : undefined,
                        cursor: "pointer",
                      }}
                      /* M9: 카드 전체 클릭 → 답변 상세 뷰로 전환 */
                      onClick={() => setSelectedAnswer(ans)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedAnswer(ans); }}
                      aria-label={`답변 상세 보기 — ${ans.authorNickname ?? "(탈퇴)"}`}
                    >
                      <div className="card-body">
                        <div className="detail-list">
                          <div className="detail-row">
                            <div className="detail-label">
                              <div className="author">
                                <UserAvatar
                                  size={28}
                                  alt={ans.authorNickname ?? "탈퇴"}
                                  avatarUrl={ans.authorAvatarUrl}
                                  image={ans.authorImage}
                                  defaultAvatarIndex={ans.authorDefaultAvatarIndex ?? 0}
                                />
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
                              {/* M9: 클릭으로 상세 뷰 전환 안내 */}
                              <span style={{ fontSize: 12, color: "var(--primary-500, #6366f1)", marginLeft: "auto" }}>
                                답변 상세 →
                              </span>
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

                        {/* M8: 답변 본문 즉시 표시 — 클릭 없이 바로 보임 */}
                        {ansContentHtml ? (
                          <div
                            dangerouslySetInnerHTML={{ __html: ansContentHtml }}
                            style={{
                              marginTop: 12,
                              padding: "12px 16px",
                              background: "var(--gray-50, #f9fafb)",
                              borderRadius: 6,
                              border: "1px solid var(--border)",
                              fontSize: 13,
                              lineHeight: 1.65,
                              color: "var(--gray-700)",
                              maxHeight: 120,
                              overflow: "hidden",
                            }}
                          />
                        ) : (
                          <p style={{ marginTop: 8, fontSize: 12, color: "var(--gray-400)" }}>
                            (본문 없음)
                          </p>
                        )}

                        {/* 답변 액션 — 버튼 클릭 시 상위 onClick 전파 방지 */}
                        <div
                          className="button-showcase"
                          style={{ marginTop: 10 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {ans.status === "published" && (
                            <button
                              className="btn btn-outline btn-sm"
                              type="button"
                              onClick={() => handleHideAnswer(ans.id)}
                            >
                              <i className="ri-eye-off-line" />
                              답변 숨김
                            </button>
                          )}
                          {ans.status === "hidden" && (
                            <button
                              className="btn btn-outline btn-sm"
                              type="button"
                              onClick={() => handleUnhideAnswer(ans.id)}
                            >
                              <i className="ri-eye-line" />
                              다시 보이기
                            </button>
                          )}
                          {isSuperAdmin && (
                            <button
                              className="btn btn-danger btn-sm"
                              type="button"
                              onClick={() =>
                                handleDeleteAnswer(
                                  ans.id,
                                  `답변 #${ans.id.slice(0, 8)} — ${ans.authorNickname ?? "(탈퇴)"}`,
                                )
                              }
                            >
                              <i className="ri-delete-bin-line" />
                              답변 삭제
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </>
        )}
      </section>
    </AdminShell>
  );
}

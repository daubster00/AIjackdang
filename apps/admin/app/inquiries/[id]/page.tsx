"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, use } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "@/lib/api";
import { confirmDialog, notifyDialog } from "@/lib/dialog";

/**
 * 문의 상세 페이지 (/inquiries/[id]) — Item 18.
 *
 * 문의 본문 + 답변 스레드 + 상태 변경 + 답변 작성
 * InquiryDrawer 의 로직을 상세 페이지로 이전.
 */

// ── Tiptap JSON → 텍스트 변환 헬퍼 ──────────────────────────────────────────

function tiptapToText(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const node = json as { type?: string; text?: string; content?: unknown[] };
  if (node.type === "text" && node.text) return node.text;
  if (Array.isArray(node.content)) {
    const parts = node.content.map((child) => tiptapToText(child));
    const blockTypes = new Set([
      "paragraph", "heading", "bulletList", "orderedList",
      "listItem", "blockquote", "codeBlock", "hardBreak",
    ]);
    const childNode = node as { type?: string };
    if (childNode.type && blockTypes.has(childNode.type)) {
      return parts.join("") + "\n";
    }
    return parts.join("");
  }
  return "";
}

// ── 타입 ─────────────────────────────────────────────────────────────────────

interface InquiryDetail {
  id: string;
  userId: string;
  userNickname: string | null;
  title: string;
  body: unknown;
  status: "pending" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

interface InquiryReply {
  id: string;
  inquiryId: string;
  authorType: "user" | "admin";
  authorId: string;
  body: unknown;
  createdAt: string;
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function statusBadge(status: string): [string, string] {
  switch (status) {
    case "pending": return ["badge-gray", "접수"];
    case "in_progress": return ["badge-blue", "처리중"];
    case "resolved": return ["badge-green", "완료"];
    default: return ["badge-gray", status];
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

function InquiryDetailContent({ id }: { id: string }) {
  const [detail, setDetail] = useState<InquiryDetail | null>(null);
  const [replies, setReplies] = useState<InquiryReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  // 답변 수정 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // 상세 데이터 로드
  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/inquiries/${id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      setDetail(data.inquiry);
      setReplies(data.replies ?? []);
    } catch {
      void notifyDialog("문의 상세를 불러오지 못했습니다.", "danger");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // 상태 변경
  async function handleStatusChange(newStatus: "in_progress" | "resolved") {
    if (!detail) return;
    setStatusChanging(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/inquiries/${id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetail((prev) =>
        prev ? { ...prev, status: data.status, updatedAt: data.updatedAt } : prev,
      );
      const label = newStatus === "in_progress" ? "처리중" : "완료";
      void notifyDialog(`상태가 '${label}'으로 변경되었습니다.`);
    } catch {
      void notifyDialog("상태 변경 중 오류가 발생했습니다.", "danger");
    } finally {
      setStatusChanging(false);
    }
  }

  // 답변 작성
  async function handleReplySubmit() {
    if (!replyText.trim()) return;
    setSubmitting(true);

    const bodyJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: replyText.trim() }],
        },
      ],
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/inquiries/${id}/replies`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: bodyJson }),
      });
      if (!res.ok) throw new Error();
      const newReply: InquiryReply = await res.json();

      setReplies((prev) => [...prev, newReply]);
      setDetail((prev) =>
        prev ? { ...prev, status: "resolved", resolvedAt: newReply.createdAt } : prev,
      );
      setReplyText("");
      void notifyDialog("답변이 등록되었습니다.");
    } catch {
      void notifyDialog("답변 등록 중 오류가 발생했습니다.", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  // 관리자 답변 수정
  async function handleUpdateReply(replyId: string) {
    if (!editText.trim()) return;
    setEditSubmitting(true);
    const bodyJson = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: editText.trim() }] }],
    };
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/inquiries/${id}/replies/${replyId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: bodyJson }),
      });
      if (!res.ok) throw new Error();
      const updated: InquiryReply = await res.json();
      setReplies((prev) => prev.map((r) => (r.id === replyId ? updated : r)));
      setEditingId(null);
      setEditText("");
      void notifyDialog("답변이 수정되었습니다.");
    } catch {
      void notifyDialog("답변 수정 중 오류가 발생했습니다.", "danger");
    } finally {
      setEditSubmitting(false);
    }
  }

  // 관리자 답변 삭제
  async function handleDeleteReply(replyId: string) {
    if (!(await confirmDialog({ title: "삭제", message: "이 답변을 삭제하시겠습니까?", tone: "danger" }))) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/inquiries/${id}/replies/${replyId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setReplies((prev) => prev.filter((r) => r.id !== replyId));
      void notifyDialog("답변이 삭제되었습니다.");
    } catch {
      void notifyDialog("답변 삭제 중 오류가 발생했습니다.", "danger");
    }
  }

  if (loading) {
    return (
      <AdminShell breadcrumb={["관리자", "문의 관리", "문의 상세"]} activeKey="inquiries">
        <div style={{ padding: 60, textAlign: "center", color: "var(--gray-400)" }}>
          불러오는 중...
        </div>
      </AdminShell>
    );
  }

  if (!detail) {
    return (
      <AdminShell breadcrumb={["관리자", "문의 관리", "문의 상세"]} activeKey="inquiries">
        <div style={{ padding: 60, textAlign: "center", color: "var(--gray-500)" }}>
          문의를 찾을 수 없습니다.
        </div>
      </AdminShell>
    );
  }

  const [badgeClass, statusLabel] = statusBadge(detail.status);

  return (
    <AdminShell breadcrumb={["관리자", "문의 관리", "문의 상세"]} activeKey="inquiries">
      <div className="page-header">
        <div>
          <h1 className="page-title">문의 상세</h1>
          <p className="page-description">문의 내용을 확인하고 답변을 작성합니다.</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline" href="/inquiries">
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
        </div>
      </div>

      <section className="section">
        {/* 문의 메타 카드 */}
        <article className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div className="detail-list">
              <div className="detail-row">
                <div className="detail-label">제목</div>
                <div className="detail-value" style={{ fontWeight: 600 }}>{detail.title}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">문의자</div>
                <div className="detail-value">
                  <div className="author">
                    <span className="author-avatar">
                      {detail.userNickname ? detail.userNickname.slice(0, 1) : "?"}
                    </span>
                    <span>{detail.userNickname ?? "(탈퇴)"}</span>
                  </div>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">접수일</div>
                <div className="detail-value">{formatDate(detail.createdAt)}</div>
              </div>
              {detail.resolvedAt && (
                <div className="detail-row">
                  <div className="detail-label">처리일</div>
                  <div className="detail-value">{formatDate(detail.resolvedAt)}</div>
                </div>
              )}
              <div className="detail-row">
                <div className="detail-label">상태</div>
                <div className="detail-value">
                  <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                </div>
              </div>
            </div>

            {/* 상태 변경 버튼 */}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {detail.status === "pending" && (
                <button
                  className="btn btn-outline btn-sm"
                  disabled={statusChanging}
                  onClick={() => handleStatusChange("in_progress")}
                >
                  <i className="ri-loader-line" />
                  처리중으로 변경
                </button>
              )}
              {detail.status === "resolved" && (
                <button
                  className="btn btn-outline btn-sm"
                  disabled={statusChanging}
                  onClick={() => handleStatusChange("in_progress")}
                >
                  <i className="ri-arrow-go-back-line" />
                  처리중으로 되돌리기
                </button>
              )}
            </div>
          </div>
        </article>

        {/* 문의 본문 카드 */}
        <article className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <h2 className="section-title" style={{ marginBottom: 12 }}>문의 내용</h2>
            <div
              style={{
                fontSize: 14, color: "var(--gray-800)", lineHeight: 1.7,
                whiteSpace: "pre-wrap", wordBreak: "break-all",
                background: "var(--gray-50)", borderRadius: 8, padding: "14px 16px",
              }}
            >
              {tiptapToText(detail.body) || "(내용 없음)"}
            </div>
          </div>
        </article>

        {/* 답변 스레드 */}
        <article className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <h2 className="section-title" style={{ marginBottom: 12 }}>
              답변 스레드 ({replies.length}개)
            </h2>
            {replies.length === 0 ? (
              <p style={{ color: "var(--gray-400)", textAlign: "center", padding: "16px 0", fontSize: 13 }}>
                아직 답변이 없습니다.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {replies.map((reply) => {
                  const isAdmin = reply.authorType === "admin";
                  const isEditing = editingId === reply.id;

                  if (isAdmin) {
                    // ── 관리자 답변: 전체 너비 블록 + 수정/삭제 ──────────────
                    return (
                      <div
                        key={reply.id}
                        style={{
                          padding: "12px 16px", borderRadius: 10,
                          fontSize: 13, lineHeight: 1.6,
                          background: "var(--primary-50, #eff6ff)",
                          border: "1px solid var(--primary-200, #bfdbfe)",
                          color: "var(--gray-800)", wordBreak: "break-all",
                        }}
                      >
                        {/* 답변 헤더: 레이블 + 수정/삭제 버튼 */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--primary-600, #2563eb)" }}>
                            관리자 답변 · {formatDate(reply.createdAt)}
                          </span>
                          {!isEditing && (
                            <div style={{ display: "flex", gap: 5 }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  setEditingId(reply.id);
                                  setEditText(tiptapToText(reply.body));
                                }}
                              >
                                <i className="ri-edit-line" />
                                수정
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteReply(reply.id)}
                              >
                                <i className="ri-delete-bin-line" />
                                삭제
                              </button>
                            </div>
                          )}
                        </div>
                        {/* 본문 또는 인라인 에디터 */}
                        {isEditing ? (
                          <div>
                            <textarea
                              className="control"
                              rows={4}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              style={{ resize: "vertical", fontSize: 13, lineHeight: 1.6, marginBottom: 8, width: "100%" }}
                            />
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => { setEditingId(null); setEditText(""); }}
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={!editText.trim() || editSubmitting}
                                onClick={() => handleUpdateReply(reply.id)}
                              >
                                {editSubmitting ? "저장 중..." : "저장"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ whiteSpace: "pre-wrap" }}>
                            {tiptapToText(reply.body) || "(내용 없음)"}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // ── 사용자 추가 문의: 기존 말풍선 스타일 유지 ────────────────
                  return (
                    <div key={reply.id} style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div
                        style={{
                          maxWidth: "75%", padding: "10px 14px", borderRadius: 10,
                          fontSize: 13, lineHeight: 1.6,
                          background: "var(--gray-100, #f3f4f6)",
                          color: "var(--gray-800)", wordBreak: "break-all",
                          border: "1px solid var(--gray-200, #e5e7eb)",
                        }}
                      >
                        <div style={{ fontSize: 11, marginBottom: 6, fontWeight: 600, color: "var(--gray-500)" }}>
                          추가 문의 · {formatDate(reply.createdAt)}
                        </div>
                        <div style={{ whiteSpace: "pre-wrap" }}>
                          {tiptapToText(reply.body) || "(내용 없음)"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>

        {/* 답변 작성 카드 */}
        <article className="card">
          <div className="card-body">
            <h2 className="section-title" style={{ marginBottom: 12 }}>답변 작성</h2>
            <textarea
              className="control"
              rows={5}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="답변 내용을 입력하세요. 저장 시 상태가 '완료'로 변경됩니다."
              style={{ resize: "vertical", fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                disabled={!replyText.trim() || submitting}
                onClick={handleReplySubmit}
              >
                {submitting ? "저장 중..." : "답변 저장"}
              </button>
            </div>
          </div>
        </article>
      </section>

    </AdminShell>
  );
}

export default function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <InquiryDetailContent id={id} />;
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../../lib/api";

// ── Tiptap JSON → 텍스트 변환 헬퍼 ──────────────────────────────────────────

/**
 * Tiptap JSON 콘텐츠에서 순수 텍스트를 추출한다.
 * 서버에서 실행되는 tiptap-renderer와 달리 클라이언트에서는
 * 단순 노드 순회 방식으로 텍스트를 추출한다.
 */
function tiptapToText(json: unknown): string {
  if (!json || typeof json !== "object") return "";

  const node = json as { type?: string; text?: string; content?: unknown[] };

  if (node.type === "text" && node.text) {
    return node.text;
  }

  if (Array.isArray(node.content)) {
    const parts = node.content.map((child) => tiptapToText(child));
    // 블록 노드(paragraph, heading 등) 사이에 줄바꿈 삽입
    const blockTypes = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock", "hardBreak"]);
    const childNode = node as { type?: string };
    if (childNode.type && blockTypes.has(childNode.type)) {
      return parts.join("") + "\n";
    }
    return parts.join("");
  }

  return "";
}

// ── 타입 ─────────────────────────────────────────────────────────────────────

export interface InquiryDetail {
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

export interface InquiryReply {
  id: string;
  inquiryId: string;
  authorType: "user" | "admin";
  authorId: string;
  body: unknown;
  createdAt: string;
}

interface InquiryDrawerProps {
  inquiryId: string | null;
  onClose: () => void;
  onStatusChanged: () => void;
}

// ── 토스트 ────────────────────────────────────────────────────────────────────

function DrawerToast({
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

// ── 상태 배지 ─────────────────────────────────────────────────────────────────

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
  return iso.slice(0, 16).replace("T", " ");
}

// ── 드로어 메인 컴포넌트 ──────────────────────────────────────────────────────

export function InquiryDrawer({ inquiryId, onClose, onStatusChanged }: InquiryDrawerProps) {
  const [detail, setDetail] = useState<InquiryDetail | null>(null);
  const [replies, setReplies] = useState<InquiryReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // 상세 데이터 로드
  const loadDetail = useCallback(async () => {
    if (!inquiryId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/inquiries/${inquiryId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      setDetail(data.inquiry);
      setReplies(data.replies ?? []);
    } catch {
      showToast("문의 상세를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [inquiryId, showToast]);

  useEffect(() => {
    if (inquiryId) {
      setDetail(null);
      setReplies([]);
      setReplyText("");
      loadDetail();
    }
  }, [inquiryId, loadDetail]);

  // 상태 변경
  async function handleStatusChange(newStatus: "in_progress" | "resolved") {
    if (!inquiryId || !detail) return;
    setStatusChanging(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/inquiries/${inquiryId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetail((prev) =>
        prev
          ? { ...prev, status: data.status, updatedAt: data.updatedAt }
          : prev,
      );
      const label = newStatus === "in_progress" ? "처리중" : "완료";
      showToast(`상태가 '${label}'으로 변경되었습니다.`, "success");
      onStatusChanged();
    } catch {
      showToast("상태 변경 중 오류가 발생했습니다.", "error");
    } finally {
      setStatusChanging(false);
    }
  }

  // 답변 작성
  async function handleReplySubmit() {
    if (!inquiryId || !replyText.trim()) return;
    setSubmitting(true);

    // Tiptap JSON 형태로 wrapping (단순 텍스트 → paragraph 노드)
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
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/inquiries/${inquiryId}/replies`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: bodyJson }),
      });
      if (!res.ok) throw new Error();
      const newReply: InquiryReply = await res.json();

      // 낙관적 업데이트 — 스레드에 즉시 추가
      setReplies((prev) => [...prev, newReply]);
      // 상태 resolved 반영
      setDetail((prev) =>
        prev ? { ...prev, status: "resolved", resolvedAt: newReply.createdAt } : prev,
      );
      setReplyText("");
      showToast("답변이 등록되었습니다.", "success");
      onStatusChanged();
    } catch {
      showToast("답변 등록 중 오류가 발생했습니다.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!inquiryId) return null;

  const [badgeClass, statusLabel] = detail ? statusBadge(detail.status) : ["badge-gray", ""];

  return (
    <>
      {/* 오버레이 */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.3)",
          zIndex: 9997,
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 드로어 패널 */}
      <div
        role="dialog"
        aria-label="문의 상세"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 520,
          background: "var(--gray-0, #fff)",
          zIndex: 9998,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 0 24px rgba(0,0,0,.12)",
          overflowY: "hidden",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--gray-900)",
              margin: 0,
            }}
          >
            문의 상세
          </h2>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <i className="ri-close-line" />
          </button>
        </div>

        {loading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--gray-400)",
              fontSize: 14,
            }}
          >
            불러오는 중...
          </div>
        ) : detail ? (
          <>
            {/* 스크롤 가능 본문 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* 문의 메타 정보 */}
              <div
                style={{
                  background: "var(--gray-50)",
                  borderRadius: 8,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--gray-900)",
                      margin: 0,
                      wordBreak: "break-all",
                      flex: 1,
                    }}
                  >
                    {detail.title}
                  </h3>
                  <span className={`badge ${badgeClass}`} style={{ flexShrink: 0 }}>
                    {statusLabel}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                    fontSize: 12,
                    color: "var(--gray-500)",
                  }}
                >
                  <span>
                    <i className="ri-user-line" style={{ marginRight: 4 }} />
                    {detail.userNickname ?? "(탈퇴)"}
                  </span>
                  <span>
                    <i className="ri-time-line" style={{ marginRight: 4 }} />
                    접수일 {formatDate(detail.createdAt)}
                  </span>
                  {detail.resolvedAt && (
                    <span>
                      <i className="ri-check-line" style={{ marginRight: 4 }} />
                      처리일 {formatDate(detail.resolvedAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* 문의 본문 */}
              <div
                style={{
                  background: "var(--gray-0, #fff)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "14px 16px",
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--gray-600)",
                    marginBottom: 10,
                    marginTop: 0,
                  }}
                >
                  문의 내용
                </p>
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--gray-800)",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {tiptapToText(detail.body) || "(내용 없음)"}
                </div>
              </div>

              {/* 상태 변경 버튼 */}
              <div style={{ display: "flex", gap: 8 }}>
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

              {/* 답변 스레드 */}
              {replies.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--gray-600)",
                      margin: 0,
                    }}
                  >
                    답변 스레드 ({replies.length}개)
                  </p>
                  {replies.map((reply) => {
                    const isAdmin = reply.authorType === "admin";
                    return (
                      <div
                        key={reply.id}
                        style={{
                          display: "flex",
                          justifyContent: isAdmin ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "80%",
                            padding: "10px 14px",
                            borderRadius: 10,
                            fontSize: 13,
                            lineHeight: 1.6,
                            background: isAdmin
                              ? "var(--primary-50, #eff6ff)"
                              : "var(--gray-100, #f3f4f6)",
                            color: "var(--gray-800)",
                            wordBreak: "break-all",
                            border: isAdmin
                              ? "1px solid var(--primary-200, #bfdbfe)"
                              : "1px solid var(--gray-200, #e5e7eb)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              color: isAdmin ? "var(--primary-600, #2563eb)" : "var(--gray-500)",
                              marginBottom: 6,
                              fontWeight: 600,
                            }}
                          >
                            {isAdmin ? "관리자 답변" : "추가 문의"} · {formatDate(reply.createdAt)}
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

              {replies.length === 0 && (
                <div
                  style={{
                    padding: "16px",
                    textAlign: "center",
                    color: "var(--gray-400)",
                    fontSize: 13,
                    background: "var(--gray-50)",
                    borderRadius: 8,
                  }}
                >
                  아직 답변이 없습니다.
                </div>
              )}
            </div>

            {/* 답변 작성 폼 (하단 고정) */}
            <div
              style={{
                borderTop: "1px solid var(--border)",
                padding: "16px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                flexShrink: 0,
                background: "var(--gray-0, #fff)",
              }}
            >
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--gray-700)",
                }}
              >
                답변 작성
              </label>
              <textarea
                className="control"
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="답변 내용을 입력하세요. 저장 시 상태가 '완료'로 변경됩니다."
                style={{
                  resize: "vertical",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
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
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--gray-400)",
              fontSize: 14,
            }}
          >
            데이터를 불러올 수 없습니다.
          </div>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <DrawerToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

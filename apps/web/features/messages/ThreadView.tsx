"use client";

/**
 * ThreadView — 특정 상대와의 대화 스레드 클라이언트 컴포넌트 (Story 7.4)
 *
 * - 마운트 시 GET /api/v1/messages/conversations/{userId} → 메시지 시간순 렌더
 * - 진입 즉시 POST /conversations/{userId}/read-all → 미읽음 자동 처리
 * - 하단 입력창 (500자) → [보내기] → POST /api/v1/messages → 스레드 append
 * - [신고] 버튼 → ReportModal (target_type="message")
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Icon } from "@/components/ui";
import { useToast } from "@/components/ui/Toast/Toast";
import styles from "./messages.module.css";

// ── 상대시간 로컬 헬퍼 ─────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const now = Date.now();
  const past = new Date(isoString).getTime();
  const diffMs = now - past;
  if (diffMs < 0) return "방금 전";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "방금 전";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}주 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  const years = Math.floor(days / 365);
  return `${years}년 전`;
}

// ── 신고 모달 (인라인 — 기존 ReportModal은 각 게시판 로컬 컴포넌트) ─────────────

const REPORT_REASONS = [
  { code: "spam", label: "스팸 또는 광고" },
  { code: "abuse", label: "욕설 / 혐오 표현" },
  { code: "privacy", label: "개인정보 침해" },
  { code: "misinformation", label: "허위 정보" },
  { code: "other", label: "기타" },
] as const;

type ReasonCode = (typeof REPORT_REASONS)[number]["code"];

interface ReportModalProps {
  targetId: string;
  onClose: () => void;
}

function ReportModal({ targetId, onClose }: ReportModalProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<ReasonCode | "">("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  async function handleSubmit() {
    if (!selected) return;
    if (selected === "other" && !detail.trim()) {
      setError("기타 사유를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "message",
          targetId,
          reasonCode: selected,
          detail: selected === "other" ? detail.trim() : undefined,
        }),
      });
      if (res.status === 409) {
        setError("이미 신고한 쪽지입니다.");
        return;
      }
      if (!res.ok) {
        setError("신고 제출에 실패했습니다.");
        return;
      }
      toast({ tone: "success", title: "신고가 접수됐습니다." });
      onClose();
    } catch {
      setError("신고 제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="thread-report-modal-title"
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-xl)",
        padding: 0,
        maxWidth: "400px",
        width: "90vw",
        background: "var(--color-surface)",
      }}
    >
      <div style={{ padding: "24px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h3 id="thread-report-modal-title" style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>신고하기</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: "20px" }}
          >
            <Icon name="close-line" />
          </button>
        </header>
        <p style={{ color: "var(--color-text-sub)", fontSize: "var(--font-size-sm)", marginBottom: "16px" }}>
          신고 사유를 선택해 주세요. 검토 후 적절한 조치를 취하겠습니다.
        </p>
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
          <legend className="sr-only">신고 사유</legend>
          {REPORT_REASONS.map((reason) => (
            <label
              key={reason.code}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 12px",
                marginBottom: "6px",
                border: `1px solid ${selected === reason.code ? "var(--color-primary)" : "var(--color-border)"}`,
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                background: selected === reason.code ? "var(--color-primary-soft)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="thread-report-reason"
                value={reason.code}
                checked={selected === reason.code}
                onChange={() => setSelected(reason.code)}
              />
              <span style={{ fontSize: "var(--font-size-sm)" }}>{reason.label}</span>
            </label>
          ))}
        </fieldset>
        {selected === "other" && (
          <textarea
            placeholder="기타 사유를 입력해주세요 (필수)"
            rows={3}
            maxLength={500}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            style={{
              width: "100%",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              padding: "10px 12px",
              fontSize: "var(--font-size-sm)",
              resize: "vertical",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />
        )}
        {error && (
          <p role="alert" style={{ color: "var(--color-danger)", fontSize: "var(--font-size-sm)", marginBottom: "12px" }}>
            {error}
          </p>
        )}
        <footer style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            type="button"
            disabled={!selected || submitting}
            onClick={() => void handleSubmit()}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-md)",
              border: 0,
              background: "var(--color-primary)",
              color: "white",
              cursor: "pointer",
              opacity: !selected || submitting ? 0.5 : 1,
            }}
          >
            {submitting ? "제출 중..." : "신고하기"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

// ── ThreadView 타입 ────────────────────────────────────────────────────────────

interface MessageItem {
  id: string;
  senderId: string;
  receiverId: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  isMine: boolean;
}

export interface ThreadViewProps {
  /** 상대 userId */
  partnerId: string;
  /** 상대 닉네임 (서버 컴포넌트에서 주입하거나 API에서 조회) */
  partnerNickname?: string;
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

const MAX_BODY = 500;

export function ThreadView({ partnerId, partnerNickname }: ThreadViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/messages/conversations/${partnerId}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: MessageItem[] };
      setMessages(data.items ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void (async () => {
      await loadThread();
      // 진입 즉시 읽음 처리
      await fetch(`/api/v1/messages/conversations/${partnerId}/read-all`, {
        method: "POST",
        credentials: "include",
      }).catch(() => null);
    })();
  }, [partnerId, loadThread]);

  // 새 메시지 추가 시 스크롤 하단
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/v1/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: partnerId, body: trimmed }),
      });

      if (res.status === 429) {
        const data = (await res.json()) as { error?: { message?: string } };
        toast({ tone: "danger", title: data.error?.message ?? "1시간에 최대 10개까지 보낼 수 있습니다." });
        return;
      }
      if (res.status === 403) {
        const data = (await res.json()) as { error?: { message?: string } };
        toast({ tone: "danger", title: data.error?.message ?? "보낼 수 없는 상대입니다." });
        return;
      }
      if (!res.ok) {
        toast({ tone: "danger", title: "메시지 발송에 실패했습니다." });
        return;
      }

      setBody("");
      // 스레드 새로고침
      await loadThread();
      // 읽음 처리
      await fetch(`/api/v1/messages/conversations/${partnerId}/read-all`, {
        method: "POST",
        credentials: "include",
      }).catch(() => null);
    } catch {
      toast({ tone: "danger", title: "네트워크 오류가 발생했습니다." });
    } finally {
      setSending(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className={styles.thread}>
      {/* 상단 헤더 */}
      <header className={styles.threadHead}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => router.push("/messages")}
          aria-label="쪽지함으로 돌아가기"
        >
          <Icon name="arrow-left-line" />
        </button>
        <div className={styles.threadPartner}>
          <Avatar name={partnerNickname ?? "?"} size="sm" />
          <span>{partnerNickname ?? "상대방"}</span>
        </div>
      </header>

      {/* 메시지 목록 */}
      <div className={styles.messageList} role="log" aria-live="polite" aria-label="메시지 목록">
        {loading ? (
          <p style={{ color: "var(--color-text-sub)", textAlign: "center", padding: "48px 0" }}>
            메시지를 불러오는 중...
          </p>
        ) : messages.length === 0 ? (
          <p style={{ color: "var(--color-text-sub)", textAlign: "center", padding: "48px 0" }}>
            아직 주고받은 메시지가 없어요. 먼저 인사를 건네보세요.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.messageBubble} ${msg.isMine ? styles.mine : styles.theirs}`}
            >
              <div className={styles.bubbleBody}>{msg.body}</div>
              <div className={styles.bubbleMeta}>
                <time dateTime={msg.createdAt}>{timeAgo(msg.createdAt)}</time>
                {!msg.isMine && (
                  <button
                    type="button"
                    className={styles.reportBtn}
                    onClick={() => setReportTargetId(msg.id)}
                    aria-label="이 메시지 신고하기"
                  >
                    신고
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      <div className={styles.inputArea}>
        <div className={styles.inputRow}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <textarea
              className={styles.inputBox}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요. (Ctrl+Enter로 전송)"
              rows={2}
              disabled={sending}
              aria-label="메시지 입력"
            />
            <p className={styles.charCount}>{body.length} / {MAX_BODY}</p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => void handleSend()}
            disabled={!body.trim() || sending}
            loading={sending}
            aria-label="메시지 보내기"
          >
            <Icon name="send-plane-fill" />
          </Button>
        </div>
      </div>

      {/* 신고 모달 */}
      {reportTargetId && (
        <ReportModal
          targetId={reportTargetId}
          onClose={() => setReportTargetId(null)}
        />
      )}
    </div>
  );
}

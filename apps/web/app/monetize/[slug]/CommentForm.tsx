"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useGating } from "@/hooks/useGating";
import { useToast } from "@/components/ui/Toast/Toast";
import { resolveAvatarUrl } from "@/lib/avatar";
import styles from "../monetize.module.css";

const MAX_LENGTH = 1000;

/** CommentForm이 onSuccess 콜백에 전달하는 낙관적(optimistic) 댓글 객체 타입 */
export type CreatedComment = {
  id: string;
  authorId: string;
  authorNickname: string | null;
  authorAvatarUrl: string | null;
  targetType: string;
  targetId: string;
  parentId: string | null;
  content: string;
  status: "visible";
  deletedAt: null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  dislikeCount: number;
  myReaction: null;
  myReactionId: null;
};

interface CommentFormProps {
  targetType?: string;
  targetId?: string;
  parentId?: string;
  /** 등록 성공 시 낙관적 댓글 객체를 인자로 받는 콜백. 미제공 시 router.refresh() 호출. */
  onSuccess?: (created: CreatedComment) => void;
  onCancel?: () => void;
  placeholder?: string;
  compact?: boolean;
  /** 제출 시 본문 맨 앞에 붙일 멘션 접두사 (예: "@철수 "). 기존 호출부에 영향 없는 optional. */
  mentionPrefix?: string;
}

export function CommentForm({
  targetType,
  targetId,
  parentId,
  onSuccess,
  onCancel,
  placeholder = "댓글을 작성하세요.",
  compact = false,
  mentionPrefix,
}: CommentFormProps) {
  const { user } = useAuth();
  const { requireAuth } = useGating();
  const { toast } = useToast();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = MAX_LENGTH - value.length;
  const isNearLimit = remaining <= 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requireAuth("comment")) return;
    if (!value.trim()) {
      setError("댓글 내용을 입력해주세요.");
      return;
    }
    if (!targetType || !targetId) return;

    setSubmitting(true);
    setError(null);
    try {
      // mentionPrefix가 있으면 제출 본문 앞에 @닉네임 를 붙인다.
      const finalContent = mentionPrefix
        ? `${mentionPrefix}${value.trim()}`
        : value.trim();
      const res = await fetch("/api/v1/comments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, content: finalContent, parentId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        setError(data.error?.message ?? "댓글 등록에 실패했습니다.");
        return;
      }
      const data = (await res.json()) as { id: string };
      const now = new Date().toISOString();
      // API는 id만 반환하므로 user 정보로 낙관적 객체를 구성한다.
      const created: CreatedComment = {
        id: data.id,
        authorId: user?.id ?? "",
        authorNickname: user?.nickname ?? null,
        authorAvatarUrl: user ? resolveAvatarUrl(user) : null,
        targetType: targetType,
        targetId: targetId,
        parentId: parentId ?? null,
        content: finalContent,
        status: "visible",
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        likeCount: 0,
        dislikeCount: 0,
        myReaction: null,
        myReactionId: null,
      };
      setValue("");
      setError(null);
      if (onSuccess) {
        onSuccess(created);
      } else {
        router.refresh();
      }
    } catch {
      setError("댓글 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
      toast({ tone: "danger", title: "댓글 등록에 실패했습니다." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.commentForm} onSubmit={handleSubmit}>
      <div className={styles.commentInputBox}>
        <label className="sr-only" htmlFor={parentId ? `reply-${parentId}` : "comment"}>
          {parentId ? "답글 작성" : "댓글 작성"}
        </label>
        <textarea
          id={parentId ? `reply-${parentId}` : "comment"}
          placeholder={placeholder}
          rows={compact ? 3 : 4}
          maxLength={MAX_LENGTH}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onFocus={() => requireAuth("comment")}
          disabled={submitting}
        />
        <div className={styles.commentCharCount} aria-live="polite">
          <span className={isNearLimit ? styles.commentCharNearLimit : undefined}>
            {value.length}
          </span>
          <span className={styles.commentCharMax}> / {MAX_LENGTH}</span>
        </div>
      </div>
      {error && (
        <p role="alert" style={{ color: "var(--color-danger, #e53e3e)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          {error}
        </p>
      )}
      <div className={styles.commentFormActions}>
        {onCancel && (
          <button type="button" className={styles.inlineFormCancel} onClick={onCancel}>
            취소
          </button>
        )}
        <Button
          type="submit"
          leftIcon={<Icon name="chat-3-line" />}
          disabled={submitting || value.trim().length === 0}
        >
          {parentId ? "답글 등록" : "댓글 등록"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import { useGating } from "@/hooks/useGating";
import { useToast } from "@/components/ui/Toast/Toast";
import styles from "../monetize.module.css";

const MAX_LENGTH = 1000;

interface CommentFormProps {
  targetType?: string;
  targetId?: string;
  parentId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  compact?: boolean;
}

export function CommentForm({
  targetType,
  targetId,
  parentId,
  onSuccess,
  onCancel,
  placeholder = "댓글을 작성하세요.",
  compact = false,
}: CommentFormProps) {
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
      const res = await fetch("/api/v1/comments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, content: value.trim(), parentId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        setError(data.error?.message ?? "댓글 등록에 실패했습니다.");
        return;
      }
      setValue("");
      setError(null);
      if (onSuccess) {
        onSuccess();
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import { useGating } from "@/hooks/useGating";
import { useToast } from "@/components/ui/Toast/Toast";
import styles from "./resource-review.module.css";

const MAX_LENGTH = 1000;

interface ReviewFormProps {
  resourceId: string;
  /** 대댓글용 부모 ID. 없으면 최상위 후기(별점 필수). */
  parentId?: string;
  onSuccess?: (avgRating: number, ratingCount: number) => void;
  onCancel?: () => void;
  placeholder?: string;
  compact?: boolean;
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className={styles.reviewStarPicker} role="radiogroup" aria-label="별점 선택">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}점`}
          className={styles.reviewStarPickerBtn}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
        >
          <Icon
            name={n <= (hover || value) ? "star-fill" : "star-line"}
            className={n <= (hover || value) ? styles.starOn : styles.starOff}
          />
        </button>
      ))}
      {value > 0 && (
        <span className={styles.reviewStarPickerLabel}>{value}점</span>
      )}
    </div>
  );
}

export function ReviewForm({
  resourceId,
  parentId,
  onSuccess,
  onCancel,
  placeholder = "후기를 작성하세요.",
  compact = false,
}: ReviewFormProps) {
  const { requireAuth } = useGating();
  const { toast } = useToast();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = MAX_LENGTH - value.length;
  const isNearLimit = remaining <= 100;
  const isTopLevel = !parentId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requireAuth("review")) return;
    if (!value.trim()) {
      setError("후기 내용을 입력해주세요.");
      return;
    }
    if (isTopLevel && rating < 1) {
      setError("별점을 선택해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        content: value.trim(),
        ...(isTopLevel ? { rating } : { parentId }),
      };
      const res = await fetch(`/api/v1/resources/${resourceId}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        setError(data.error?.message ?? "후기 등록에 실패했습니다.");
        return;
      }
      const data = (await res.json()) as { id: string; avgRating: number; ratingCount: number };
      setValue("");
      setRating(0);
      setError(null);
      if (onSuccess) {
        onSuccess(data.avgRating, data.ratingCount);
      } else {
        router.refresh();
      }
    } catch {
      setError("후기 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
      toast({ tone: "danger", title: "후기 등록에 실패했습니다." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.commentForm} onSubmit={handleSubmit}>
      {isTopLevel && (
        <StarPicker value={rating} onChange={setRating} />
      )}
      <div className={styles.commentInputBox}>
        <label className="sr-only" htmlFor={parentId ? `reply-review-${parentId}` : "review"}>
          {parentId ? "답글 작성" : "후기 작성"}
        </label>
        <textarea
          id={parentId ? `reply-review-${parentId}` : "review"}
          placeholder={placeholder}
          rows={compact ? 3 : 4}
          maxLength={MAX_LENGTH}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onFocus={() => { if (!requireAuth("review")) return; }}
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
          leftIcon={<Icon name={parentId ? "reply-line" : "star-line"} />}
          disabled={submitting || value.trim().length === 0 || (isTopLevel && rating === 0)}
        >
          {parentId ? "답글 등록" : "후기 등록"}
        </Button>
      </div>
    </form>
  );
}

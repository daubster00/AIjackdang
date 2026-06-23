"use client";

import { useState } from "react";
import { Button, Icon } from "@/components/ui";
import { useGating } from "@/hooks/useGating";
import styles from "../lounge.module.css";

const MAX_LENGTH = 1000;

export function CommentForm() {
  const { requireAuth } = useGating();
  const [value, setValue] = useState("");
  const remaining = MAX_LENGTH - value.length;
  const isNearLimit = remaining <= 100;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requireAuth("comment")) return;
    // 댓글 등록 로직은 Epic 5에서 구현
  }

  return (
    <form className={styles.commentForm} onSubmit={handleSubmit}>
      <div className={styles.commentInputBox}>
        <label className="sr-only" htmlFor="comment">
          댓글 작성
        </label>
        <textarea
          id="comment"
          placeholder="댓글을 작성하세요."
          rows={4}
          maxLength={MAX_LENGTH}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => requireAuth("comment")}
        />
        <div className={styles.commentCharCount} aria-live="polite">
          <span className={isNearLimit ? styles.commentCharNearLimit : undefined}>
            {value.length}
          </span>
          <span className={styles.commentCharMax}> / {MAX_LENGTH}</span>
        </div>
      </div>
      <div className={styles.commentFormActions}>
        <Button leftIcon={<Icon name="chat-3-line" />}>댓글 등록</Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Button, Icon } from "@/components/ui";
import styles from "../automation.module.css";

const MAX_LENGTH = 1000;

export function CommentForm() {
  const [value, setValue] = useState("");
  const remaining = MAX_LENGTH - value.length;
  const isNearLimit = remaining <= 100;

  return (
    <form className={styles.commentForm}>
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

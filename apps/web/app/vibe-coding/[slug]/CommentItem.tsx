"use client";

import { useState, useRef, useEffect } from "react";
import { AuthorName, Icon } from "@/components/ui";
import styles from "../vibe-coding.module.css";
import { ReportModal } from "./ReportModal";

const MAX_LENGTH = 1000;

type Reply = {
  author: string;
  date: string;
  text: string;
};

type Comment = {
  author: string;
  date: string;
  text: string;
  replies?: Reply[];
};

export function CommentItem({ comment }: { comment: Comment }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState(comment.text);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyValue, setReplyValue] = useState("");
  const [repliesVisible, setRepliesVisible] = useState(false);
  const [voteState, setVoteState] = useState<"like" | "dislike" | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);

  function handleVote(v: "like" | "dislike") {
    const isCancel = voteState === v;
    const wasLike = voteState === "like";
    const wasDislike = voteState === "dislike";
    setLikeCount((c) => {
      if (v === "like") return isCancel ? c - 1 : c + 1;
      if (wasLike) return c - 1;
      return c;
    });
    setDislikeCount((c) => {
      if (v === "dislike") return isCancel ? c - 1 : c + 1;
      if (wasDislike) return c - 1;
      return c;
    });
    setVoteState(isCancel ? null : v);
  }
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function openEdit() {
    setEditValue(comment.text);
    setReplyOpen(false);
    setMenuOpen(false);
    setEditOpen(true);
  }

  function openReply() {
    setEditOpen(false);
    setMenuOpen(false);
    setReplyOpen(true);
  }

  const editRemaining = MAX_LENGTH - editValue.length;
  const replyRemaining = MAX_LENGTH - replyValue.length;

  const initial = comment.author.slice(0, 1);

  return (
    <article className={styles.commentItem}>
      <div className={styles.commentMeta}>
        <div className={styles.commentAvatar} aria-hidden="true">
          {initial}
        </div>
        <div className={styles.commentAuthorInfo}>
          <strong><AuthorName name={comment.author} /></strong>
          <span>{comment.date}</span>
        </div>
        <div className={styles.commentMenuWrapper} ref={menuRef}>
          <button
            type="button"
            className={styles.commentMenuButton}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="댓글 메뉴"
            aria-expanded={menuOpen}
          >
            <Icon name="more-2-fill" />
          </button>
          {menuOpen && (
            <div className={styles.commentMenuDropdown} role="menu">
              <button type="button" role="menuitem" onClick={openEdit}>
                <Icon name="edit-2-line" />수정
              </button>
              <hr className={styles.menuDivider} />
              <button type="button" role="menuitem">
                <Icon name="delete-bin-line" />삭제
              </button>
              <hr className={styles.menuDivider} />
              <button type="button" role="menuitem" onClick={openReply}>
                <Icon name="reply-line" />답변
              </button>
              <hr className={styles.menuDivider} />
              <button
                type="button"
                role="menuitem"
                className={styles.menuItemDanger}
                onClick={() => { setMenuOpen(false); setReportOpen(true); }}
              >
                <Icon name="alarm-warning-line" />신고
              </button>
            </div>
          )}
        </div>
      </div>

      {editOpen ? (
        <div className={styles.inlineForm}>
          <div className={styles.commentInputBox}>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              maxLength={MAX_LENGTH}
              rows={3}
              autoFocus
            />
            <div className={styles.commentCharCount} aria-live="polite">
              <span className={editRemaining <= 100 ? styles.commentCharNearLimit : undefined}>
                {editValue.length}
              </span>
              <span className={styles.commentCharMax}> / {MAX_LENGTH}</span>
            </div>
          </div>
          <div className={styles.inlineFormActions}>
            <button
              type="button"
              className={styles.inlineFormCancel}
              onClick={() => setEditOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className={styles.inlineFormSubmit}
              onClick={() => setEditOpen(false)}
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <p>{comment.text}</p>
      )}

      <div className={styles.commentVote}>
        <button
          type="button"
          className={`${styles.commentVoteBtn} ${voteState === "like" ? styles.commentVoteLike : ""}`}
          onClick={() => handleVote("like")}
          aria-pressed={voteState === "like"}
          aria-label="좋아요"
        >
          <Icon name={voteState === "like" ? "thumb-up-fill" : "thumb-up-line"} />
          <span className={styles.commentVoteCount}>{likeCount}</span>
        </button>
        <button
          type="button"
          className={`${styles.commentVoteBtn} ${voteState === "dislike" ? styles.commentVoteDislike : ""}`}
          onClick={() => handleVote("dislike")}
          aria-pressed={voteState === "dislike"}
          aria-label="싫어요"
        >
          <Icon name={voteState === "dislike" ? "thumb-down-fill" : "thumb-down-line"} />
          <span className={styles.commentVoteCount}>{dislikeCount}</span>
        </button>
      </div>

      {replyOpen && (
        <div className={styles.replyForm}>
          <div className={styles.replyFormLabel}>
            <Icon name="corner-down-right-line" />
            <span>{comment.author}님께 답변</span>
          </div>
          <div className={styles.commentInputBox}>
            <textarea
              value={replyValue}
              onChange={(e) => setReplyValue(e.target.value)}
              placeholder={`${comment.author}님께 답변을 작성하세요.`}
              maxLength={MAX_LENGTH}
              rows={3}
              autoFocus
            />
            <div className={styles.commentCharCount} aria-live="polite">
              <span className={replyRemaining <= 100 ? styles.commentCharNearLimit : undefined}>
                {replyValue.length}
              </span>
              <span className={styles.commentCharMax}> / {MAX_LENGTH}</span>
            </div>
          </div>
          <div className={styles.inlineFormActions}>
            <button
              type="button"
              className={styles.inlineFormCancel}
              onClick={() => { setReplyOpen(false); setReplyValue(""); }}
            >
              취소
            </button>
            <button
              type="button"
              className={styles.inlineFormSubmit}
              disabled={replyValue.trim().length === 0}
              onClick={() => { setReplyOpen(false); setReplyValue(""); }}
            >
              답변 등록
            </button>
          </div>
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <>
          {!repliesVisible && (
            <button
              type="button"
              className={styles.replyToggleBtn}
              onClick={() => setRepliesVisible(true)}
            >
              <Icon name="arrow-down-s-line" />
              {`답글 ${comment.replies.length}개`}
            </button>
          )}

          {repliesVisible && (
            <>
              <ul className={styles.replyList}>
                {comment.replies.map((reply) => (
                  <ReplyItem key={`${reply.author}-${reply.date}`} reply={reply} />
                ))}
              </ul>
              <button
                type="button"
                className={styles.replyToggleBtn}
                onClick={() => setRepliesVisible(false)}
              >
                <Icon name="arrow-up-s-line" />
                답글 숨기기
              </button>
            </>
          )}
        </>
      )}

      <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />
    </article>
  );
}

function ReplyItem({ reply }: { reply: Reply }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState(reply.text);
  const [voteState, setVoteState] = useState<"like" | "dislike" | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  function handleVote(v: "like" | "dislike") {
    const isCancel = voteState === v;
    const wasLike = voteState === "like";
    const wasDislike = voteState === "dislike";
    setLikeCount((c) => {
      if (v === "like") return isCancel ? c - 1 : c + 1;
      if (wasLike) return c - 1;
      return c;
    });
    setDislikeCount((c) => {
      if (v === "dislike") return isCancel ? c - 1 : c + 1;
      if (wasDislike) return c - 1;
      return c;
    });
    setVoteState(isCancel ? null : v);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function openEdit() {
    setEditValue(reply.text);
    setMenuOpen(false);
    setEditOpen(true);
  }

  const editRemaining = MAX_LENGTH - editValue.length;

  return (
    <li className={styles.replyItem}>
      <div className={styles.replyItemMeta}>
        <div className={styles.replyAvatar} aria-hidden="true">
          {reply.author.slice(0, 1)}
        </div>
        <div className={styles.commentAuthorInfo}>
          <strong><AuthorName name={reply.author} /></strong>
          <span>{reply.date}</span>
        </div>
        <div className={styles.commentMenuWrapper} ref={menuRef}>
          <button
            type="button"
            className={styles.commentMenuButton}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="답글 메뉴"
            aria-expanded={menuOpen}
          >
            <Icon name="more-2-fill" />
          </button>
          {menuOpen && (
            <div className={styles.commentMenuDropdown} role="menu">
              <button type="button" role="menuitem" onClick={openEdit}>
                <Icon name="edit-2-line" />수정
              </button>
              <hr className={styles.menuDivider} />
              <button type="button" role="menuitem">
                <Icon name="delete-bin-line" />삭제
              </button>
              <hr className={styles.menuDivider} />
              <button
                type="button"
                role="menuitem"
                className={styles.menuItemDanger}
                onClick={() => { setMenuOpen(false); setReportOpen(true); }}
              >
                <Icon name="alarm-warning-line" />신고
              </button>
            </div>
          )}
        </div>
      </div>

      {editOpen ? (
        <div className={styles.inlineForm}>
          <div className={styles.commentInputBox}>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              maxLength={MAX_LENGTH}
              rows={3}
              autoFocus
            />
            <div className={styles.commentCharCount} aria-live="polite">
              <span className={editRemaining <= 100 ? styles.commentCharNearLimit : undefined}>
                {editValue.length}
              </span>
              <span className={styles.commentCharMax}> / {MAX_LENGTH}</span>
            </div>
          </div>
          <div className={styles.inlineFormActions}>
            <button
              type="button"
              className={styles.inlineFormCancel}
              onClick={() => setEditOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className={styles.inlineFormSubmit}
              onClick={() => setEditOpen(false)}
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.replyItemText}>{reply.text}</p>
      )}

      <div className={styles.commentVote}>
        <button
          type="button"
          className={`${styles.commentVoteBtn} ${voteState === "like" ? styles.commentVoteLike : ""}`}
          onClick={() => handleVote("like")}
          aria-pressed={voteState === "like"}
          aria-label="좋아요"
        >
          <Icon name={voteState === "like" ? "thumb-up-fill" : "thumb-up-line"} />
          <span className={styles.commentVoteCount}>{likeCount}</span>
        </button>
        <button
          type="button"
          className={`${styles.commentVoteBtn} ${voteState === "dislike" ? styles.commentVoteDislike : ""}`}
          onClick={() => handleVote("dislike")}
          aria-pressed={voteState === "dislike"}
          aria-label="싫어요"
        >
          <Icon name={voteState === "dislike" ? "thumb-down-fill" : "thumb-down-line"} />
          <span className={styles.commentVoteCount}>{dislikeCount}</span>
        </button>
      </div>

      <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />
    </li>
  );
}

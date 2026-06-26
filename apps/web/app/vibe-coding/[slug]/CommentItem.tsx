"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthorName, Avatar, Icon } from "@/components/ui";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { useAuth } from "@/hooks/useAuth";
import { useGating } from "@/hooks/useGating";
import { useToast } from "@/components/ui/Toast/Toast";
import styles from "../vibe-coding.module.css";
import { ReportModal } from "./ReportModal";
import { CommentForm } from "./CommentForm";
import type { CreatedComment } from "./CommentForm";

const MAX_LENGTH = 1000;

export type ApiComment = {
  id: string;
  authorId: string;
  authorNickname: string | null;
  authorAvatarUrl: string | null;
  targetType: string;
  targetId: string;
  parentId: string | null;
  content: string | null;
  status: "visible" | "deleted";
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  dislikeCount: number;
  myReaction: "like" | "dislike" | null;
  myReactionId: string | null;
  replies: Omit<ApiComment, "replies">[];
};

export function CommentItem({ comment }: { comment: ApiComment }) {
  const { user } = useAuth();
  const { requireAuth } = useGating();
  const { toast } = useToast();

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState(comment.content ?? "");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [repliesVisible, setRepliesVisible] = useState(false);

  const [localContent, setLocalContent] = useState(comment.content);
  const [localStatus, setLocalStatus] = useState(comment.status);
  const [deleted, setDeleted] = useState(false);
  /** 대댓글 목록. 초기값은 서버 props, 답글 작성 시 낙관적으로 즉시 추가된다. */
  const [localReplies, setLocalReplies] = useState<Omit<ApiComment, "replies">[]>(comment.replies);

  const [voteState, setVoteState] = useState<"like" | "dislike" | null>(comment.myReaction);
  const [myReactionId, setMyReactionId] = useState<string | null>(comment.myReactionId);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [dislikeCount, setDislikeCount] = useState(comment.dislikeCount);

  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = user !== null && user.id === comment.authorId;
  const isSelf = isOwner;
  const isDeleted = deleted || localStatus === "deleted";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function openEdit() {
    setEditValue(localContent ?? "");
    setReplyOpen(false);
    setMenuOpen(false);
    setEditOpen(true);
  }

  function openReply() {
    setEditOpen(false);
    setMenuOpen(false);
    setReplyOpen(true);
  }

  async function handleSaveEdit() {
    if (!editValue.trim()) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/v1/comments/${comment.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editValue.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        toast({ tone: "danger", title: data.error?.message ?? "수정에 실패했습니다." });
        return;
      }
      setLocalContent(editValue.trim());
      setEditOpen(false);
    } catch {
      toast({ tone: "danger", title: "수정에 실패했습니다." });
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/v1/comments/${comment.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        toast({ tone: "danger", title: data.error?.message ?? "삭제에 실패했습니다." });
        return;
      }
      setLocalStatus("deleted");
      setDeleted(false);
      setMenuOpen(false);
      setDeleteOpen(false);
    } catch {
      toast({ tone: "danger", title: "삭제에 실패했습니다." });
    }
  }

  async function handleVote(v: "like" | "dislike") {
    if (!requireAuth("vote")) return;
    if (isSelf) return;

    const prevVote = voteState;
    const prevId = myReactionId;
    const prevLike = likeCount;
    const prevDislike = dislikeCount;
    const isCancel = voteState === v;

    // 낙관적 업데이트
    if (isCancel) {
      setVoteState(null);
      setMyReactionId(null);
      if (v === "like") setLikeCount((c) => c - 1);
      else setDislikeCount((c) => c - 1);
    } else {
      if (voteState === "like") setLikeCount((c) => c - 1);
      else if (voteState === "dislike") setDislikeCount((c) => c - 1);
      setVoteState(v);
      if (v === "like") setLikeCount((c) => c + 1);
      else setDislikeCount((c) => c + 1);
    }

    try {
      if (isCancel && prevId) {
        const res = await fetch(`/api/v1/reactions/${prevId}`, { method: "DELETE", credentials: "include" });
        if (!res.ok) throw new Error("delete failed");
        setMyReactionId(null);
      } else {
        // 기존 반응 먼저 삭제 (반응 전환 시)
        if (prevId) {
          await fetch(`/api/v1/reactions/${prevId}`, { method: "DELETE", credentials: "include" });
        }
        const res = await fetch("/api/v1/reactions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType: "comment", targetId: comment.id, reactionType: v }),
        });
        if (!res.ok) throw new Error("post failed");
        const data = (await res.json()) as { id: string };
        setMyReactionId(data.id);
      }
    } catch {
      // 롤백
      setVoteState(prevVote);
      setMyReactionId(prevId);
      setLikeCount(prevLike);
      setDislikeCount(prevDislike);
      toast({ tone: "danger", title: "반응 처리에 실패했습니다." });
    }
  }

  const editRemaining = MAX_LENGTH - editValue.length;

  if (isDeleted && localReplies.length === 0) {
    return (
      <article className={styles.commentItem}>
        <p className={styles.commentDeleted}>삭제된 댓글입니다.</p>
      </article>
    );
  }

  return (
    <article className={styles.commentItem}>
      <div className={styles.commentMeta}>
        <Avatar
          name={comment.authorNickname ?? "?"}
          src={!isDeleted && comment.authorAvatarUrl ? comment.authorAvatarUrl : undefined}
          size="sm"
        />
        <div className={styles.commentAuthorInfo}>
          {isDeleted ? (
            <strong>삭제된 댓글</strong>
          ) : (
            <strong><AuthorName name={comment.authorNickname ?? "익명"} authorId={comment.authorId} authorAvatarUrl={comment.authorAvatarUrl} /></strong>
          )}
          <span>{new Date(comment.createdAt).toLocaleDateString("ko-KR")}</span>
        </div>
        {!isDeleted && isOwner && (
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
                <button
                  type="button"
                  role="menuitem"
                  aria-label="댓글 삭제"
                  onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                >
                  <Icon name="delete-bin-line" />삭제
                </button>
                {comment.parentId === null && (
                  <>
                    <hr className={styles.menuDivider} />
                    <button type="button" role="menuitem" onClick={openReply}>
                      <Icon name="reply-line" />답글
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {!isDeleted && !isOwner && (
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
                {comment.parentId === null && (
                  <>
                    <button type="button" role="menuitem" onClick={openReply}>
                      <Icon name="reply-line" />답글
                    </button>
                    <hr className={styles.menuDivider} />
                  </>
                )}
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
        )}
      </div>

      {isDeleted ? (
        <p className={styles.commentDeleted}>삭제된 댓글입니다.</p>
      ) : editOpen ? (
        <div className={styles.inlineForm}>
          <div className={styles.commentInputBox}>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              maxLength={MAX_LENGTH}
              rows={3}
              autoFocus
              disabled={editSubmitting}
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
              disabled={editSubmitting}
            >
              취소
            </button>
            <button
              type="button"
              className={styles.inlineFormSubmit}
              onClick={handleSaveEdit}
              disabled={editSubmitting || editValue.trim().length === 0}
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <p>{localContent}</p>
      )}

      {!isDeleted && (
        <div className={styles.commentVote}>
          <button
            type="button"
            className={`${styles.commentVoteBtn} ${voteState === "like" ? styles.commentVoteLike : ""}`}
            onClick={() => handleVote("like")}
            aria-pressed={voteState === "like"}
            aria-label="좋아요"
            disabled={isSelf}
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
            disabled={isSelf}
          >
            <Icon name={voteState === "dislike" ? "thumb-down-fill" : "thumb-down-line"} />
            <span className={styles.commentVoteCount}>{dislikeCount}</span>
          </button>
        </div>
      )}

      {replyOpen && (
        <CommentForm
          targetType={comment.targetType}
          targetId={comment.targetId}
          parentId={comment.id}
          placeholder={`${comment.authorNickname ?? "작성자"}님께 답글을 작성하세요.`}
          compact
          onSuccess={(created: CreatedComment) => {
            // 낙관적 즉시 추가: 서버 재요청 없이 로컬 state에 append
            setLocalReplies((prev) => [...prev, created]);
            setRepliesVisible(true);
            setReplyOpen(false);
          }}
          onCancel={() => setReplyOpen(false)}
        />
      )}

      {localReplies.length > 0 && (
        <>
          {!repliesVisible && (
            <button
              type="button"
              className={styles.replyToggleBtn}
              onClick={() => setRepliesVisible(true)}
            >
              <Icon name="arrow-down-s-line" />
              {`답글 ${localReplies.length}개`}
            </button>
          )}
          {repliesVisible && (
            <>
              <ul className={styles.replyList}>
                {localReplies.map((reply) => (
                  <ReplyItem
                    key={reply.id}
                    reply={reply}
                    parentCommentId={comment.id}
                    onReplyCreated={(created) => setLocalReplies((prev) => [...prev, created])}
                    mentionNickname={reply.authorNickname}
                  />
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

      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="댓글을 삭제하시겠습니까?"
        description="삭제된 댓글은 복구할 수 없습니다."
      />
      <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} targetType="comment" targetId={comment.id} />
    </article>
  );
}

/**
 * 본문 맨 앞 @닉네임 토큰만 primary 색·볼드로 강조 렌더한다.
 * 일반 텍스트 안의 @ 기호는 건드리지 않는다.
 */
function renderContentWithMention(content: string | null) {
  if (!content) return null;
  if (content.startsWith("@")) {
    const spaceIdx = content.indexOf(" ");
    if (spaceIdx > 0) {
      const mention = content.slice(0, spaceIdx);
      const rest = content.slice(spaceIdx + 1);
      return (
        <>
          <span className={styles.mention}>{mention}</span>{" "}{rest}
        </>
      );
    }
  }
  return content;
}

function ReplyItem({
  reply,
  parentCommentId,
  onReplyCreated,
  mentionNickname,
}: {
  reply: Omit<ApiComment, "replies">;
  /** 대댓글을 달 때 parentId로 사용할 최상위 댓글 id */
  parentCommentId: string;
  /** 새 답글이 등록됐을 때 부모 localReplies에 append하는 콜백 */
  onReplyCreated: (created: CreatedComment) => void;
  /** 멘션 대상 닉네임. null이면 멘션 prefix 없이 답글 작성 */
  mentionNickname: string | null;
}) {
  const { user } = useAuth();
  const { requireAuth } = useGating();
  const { toast } = useToast();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState(reply.content ?? "");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [localContent, setLocalContent] = useState(reply.content);
  const [localStatus, setLocalStatus] = useState(reply.status);

  const [voteState, setVoteState] = useState<"like" | "dislike" | null>(reply.myReaction);
  const [myReactionId, setMyReactionId] = useState<string | null>(reply.myReactionId);
  const [likeCount, setLikeCount] = useState(reply.likeCount);
  const [dislikeCount, setDislikeCount] = useState(reply.dislikeCount);

  const [replyOpen, setReplyOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = user !== null && user.id === reply.authorId;
  const isSelf = isOwner;
  const isDeleted = localStatus === "deleted";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function openEdit() {
    setEditValue(localContent ?? "");
    setMenuOpen(false);
    setReplyOpen(false);
    setEditOpen(true);
  }

  function openReply() {
    setEditOpen(false);
    setMenuOpen(false);
    setReplyOpen(true);
  }

  async function handleSaveEdit() {
    if (!editValue.trim()) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/v1/comments/${reply.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editValue.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        toast({ tone: "danger", title: data.error?.message ?? "수정에 실패했습니다." });
        return;
      }
      setLocalContent(editValue.trim());
      setEditOpen(false);
    } catch {
      toast({ tone: "danger", title: "수정에 실패했습니다." });
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/v1/comments/${reply.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        toast({ tone: "danger", title: data.error?.message ?? "삭제에 실패했습니다." });
        return;
      }
      setLocalStatus("deleted");
      setMenuOpen(false);
      setDeleteOpen(false);
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "삭제에 실패했습니다." });
    }
  }

  async function handleVote(v: "like" | "dislike") {
    if (!requireAuth("vote")) return;
    if (isSelf) return;

    const prevVote = voteState;
    const prevId = myReactionId;
    const prevLike = likeCount;
    const prevDislike = dislikeCount;
    const isCancel = voteState === v;

    if (isCancel) {
      setVoteState(null);
      setMyReactionId(null);
      if (v === "like") setLikeCount((c) => c - 1);
      else setDislikeCount((c) => c - 1);
    } else {
      if (voteState === "like") setLikeCount((c) => c - 1);
      else if (voteState === "dislike") setDislikeCount((c) => c - 1);
      setVoteState(v);
      if (v === "like") setLikeCount((c) => c + 1);
      else setDislikeCount((c) => c + 1);
    }

    try {
      if (isCancel && prevId) {
        const res = await fetch(`/api/v1/reactions/${prevId}`, { method: "DELETE", credentials: "include" });
        if (!res.ok) throw new Error("delete failed");
        setMyReactionId(null);
      } else {
        if (prevId) {
          await fetch(`/api/v1/reactions/${prevId}`, { method: "DELETE", credentials: "include" });
        }
        const res = await fetch("/api/v1/reactions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType: "comment", targetId: reply.id, reactionType: v }),
        });
        if (!res.ok) throw new Error("post failed");
        const data = (await res.json()) as { id: string };
        setMyReactionId(data.id);
      }
    } catch {
      setVoteState(prevVote);
      setMyReactionId(prevId);
      setLikeCount(prevLike);
      setDislikeCount(prevDislike);
      toast({ tone: "danger", title: "반응 처리에 실패했습니다." });
    }
  }

  const editRemaining = MAX_LENGTH - editValue.length;

  return (
    <li className={styles.replyItem}>
      <div className={styles.replyItemMeta}>
        <Avatar
          name={reply.authorNickname ?? "?"}
          src={!isDeleted && reply.authorAvatarUrl ? reply.authorAvatarUrl : undefined}
          size="sm"
        />
        <div className={styles.commentAuthorInfo}>
          {isDeleted ? (
            <span>삭제된 답글</span>
          ) : (
            <strong><AuthorName name={reply.authorNickname ?? "익명"} authorId={reply.authorId} authorAvatarUrl={reply.authorAvatarUrl} /></strong>
          )}
          <span>{new Date(reply.createdAt).toLocaleDateString("ko-KR")}</span>
        </div>
        {!isDeleted && (
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
                {isOwner && (
                  <>
                    <button type="button" role="menuitem" onClick={openEdit}>
                      <Icon name="edit-2-line" />수정
                    </button>
                    <hr className={styles.menuDivider} />
                    <button
                      type="button"
                      role="menuitem"
                      aria-label="댓글 삭제"
                      onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                    >
                      <Icon name="delete-bin-line" />삭제
                    </button>
                    <hr className={styles.menuDivider} />
                  </>
                )}
                <button type="button" role="menuitem" onClick={openReply}>
                  <Icon name="reply-line" />답글
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
        )}
      </div>

      {isDeleted ? (
        <p className={styles.commentDeleted}>삭제된 댓글입니다.</p>
      ) : editOpen ? (
        <div className={styles.inlineForm}>
          <div className={styles.commentInputBox}>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              maxLength={MAX_LENGTH}
              rows={3}
              autoFocus
              disabled={editSubmitting}
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
              disabled={editSubmitting}
            >
              취소
            </button>
            <button
              type="button"
              className={styles.inlineFormSubmit}
              onClick={handleSaveEdit}
              disabled={editSubmitting || editValue.trim().length === 0}
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.replyItemText}>{renderContentWithMention(localContent)}</p>
      )}

      {!isDeleted && (
        <div className={styles.commentVote}>
          <button
            type="button"
            className={`${styles.commentVoteBtn} ${voteState === "like" ? styles.commentVoteLike : ""}`}
            onClick={() => handleVote("like")}
            aria-pressed={voteState === "like"}
            aria-label="좋아요"
            disabled={isSelf}
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
            disabled={isSelf}
          >
            <Icon name={voteState === "dislike" ? "thumb-down-fill" : "thumb-down-line"} />
            <span className={styles.commentVoteCount}>{dislikeCount}</span>
          </button>
        </div>
      )}

      {replyOpen && (
        <CommentForm
          targetType={reply.targetType}
          targetId={reply.targetId}
          parentId={parentCommentId}
          mentionPrefix={mentionNickname ? `@${mentionNickname} ` : undefined}
          placeholder={`${mentionNickname ?? "작성자"}님께 답글을 작성하세요.`}
          compact
          onSuccess={(created: CreatedComment) => {
            onReplyCreated(created);
            setReplyOpen(false);
          }}
          onCancel={() => setReplyOpen(false)}
        />
      )}

      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="답글을 삭제하시겠습니까?"
        description="삭제된 답글은 복구할 수 없습니다."
      />
      <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} targetType="comment" targetId={reply.id} />
    </li>
  );
}

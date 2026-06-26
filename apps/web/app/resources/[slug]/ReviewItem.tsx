"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthorName, Avatar, Icon } from "@/components/ui";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { useAuth } from "@/hooks/useAuth";
import { useGating } from "@/hooks/useGating";
import { useToast } from "@/components/ui/Toast/Toast";
import { ReviewForm } from "./ReviewForm";
import styles from "./resource-review.module.css";

const MAX_LENGTH = 1000;

export type ApiReview = {
  id: string;
  authorId: string;
  authorNickname: string | null;
  authorAvatarUrl: string | null;
  targetType: "resource";
  targetId: string;
  parentId: string | null;
  content: string | null;
  rating: number | null;
  status: "visible" | "deleted";
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  dislikeCount: number;
  myReaction: "like" | "dislike" | null;
  myReactionId: string | null;
  replies: Omit<ApiReview, "replies">[];
};

interface ReviewItemProps {
  review: ApiReview;
  /** 최상위 후기 삭제 시 재집계값 콜백 */
  onDeleted?: (avgRating: number, ratingCount: number) => void;
}

export function ReviewItem({ review, onDeleted }: ReviewItemProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { requireAuth } = useGating();
  const { toast } = useToast();

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState(review.content ?? "");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [repliesVisible, setRepliesVisible] = useState(false);

  const [localContent, setLocalContent] = useState(review.content);
  const [localStatus, setLocalStatus] = useState(review.status);
  const [deleted, setDeleted] = useState(false);

  const [voteState, setVoteState] = useState<"like" | "dislike" | null>(review.myReaction);
  const [myReactionId, setMyReactionId] = useState<string | null>(review.myReactionId);
  const [likeCount, setLikeCount] = useState(review.likeCount);
  const [dislikeCount, setDislikeCount] = useState(review.dislikeCount);

  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = user !== null && user.id === review.authorId;
  const isSelf = isOwner;
  const isDeleted = deleted || localStatus === "deleted";
  const isTopLevel = review.parentId === null;

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
      const res = await fetch(`/api/v1/comments/${review.id}`, {
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
      // 최상위 후기는 reviews 전용 endpoint (avgRating 재집계)
      // 대댓글은 표준 comments endpoint
      const endpoint = isTopLevel
        ? `/api/v1/resources/${review.targetId}/reviews/${review.id}`
        : `/api/v1/comments/${review.id}`;

      const res = await fetch(endpoint, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        toast({ tone: "danger", title: data.error?.message ?? "삭제에 실패했습니다." });
        return;
      }
      setLocalStatus("deleted");
      setDeleted(false);
      setMenuOpen(false);
      setDeleteOpen(false);

      if (isTopLevel && onDeleted) {
        const data = (await res.json().catch(() => ({}))) as { avgRating?: number; ratingCount?: number };
        onDeleted(data.avgRating ?? 0, data.ratingCount ?? 0);
      }
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
          body: JSON.stringify({ targetType: "comment", targetId: review.id, reactionType: v }),
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

  if (isDeleted && review.replies.length === 0) {
    return (
      <article className={styles.commentItem}>
        <p className={styles.commentDeleted}>삭제된 후기입니다.</p>
      </article>
    );
  }

  return (
    <article className={styles.commentItem}>
      <div className={styles.commentMeta}>
        <Avatar
          name={review.authorNickname ?? "?"}
          src={!isDeleted && review.authorAvatarUrl ? review.authorAvatarUrl : undefined}
          size="sm"
        />
        <div className={styles.commentAuthorInfo}>
          {isDeleted ? (
            <strong>삭제된 후기</strong>
          ) : (
            <strong><AuthorName name={review.authorNickname ?? "익명"} authorId={review.authorId} authorAvatarUrl={review.authorAvatarUrl} /></strong>
          )}
          <span>{new Date(review.createdAt).toLocaleDateString("ko-KR")}</span>
        </div>
        {/* 최상위 후기에만 별점 표시 - commentMeta 오른쪽 끝 정렬 (채워진별+빈별 5개 고정) */}
        {!isDeleted && isTopLevel && review.rating !== null && (
          <div className={styles.reviewRatingRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Icon
                key={n}
                name={n <= review.rating! ? "star-fill" : "star-line"}
                className={n <= review.rating! ? styles.starOn : styles.starOff}
              />
            ))}
            <span className={styles.reviewRatingScore}>{review.rating}점</span>
          </div>
        )}
        {!isDeleted && isOwner && (
          <div className={styles.commentMenuWrapper} ref={menuRef}>
            <button
              type="button"
              className={styles.commentMenuButton}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="후기 메뉴"
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
                  onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                >
                  <Icon name="delete-bin-line" />삭제
                </button>
                {isTopLevel && (
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
              aria-label="후기 메뉴"
              aria-expanded={menuOpen}
            >
              <Icon name="more-2-fill" />
            </button>
            {menuOpen && (
              <div className={styles.commentMenuDropdown} role="menu">
                {isTopLevel && (
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
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon name="alarm-warning-line" />신고
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isDeleted ? (
        <p className={styles.commentDeleted}>삭제된 후기입니다.</p>
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
        <ReviewForm
          resourceId={review.targetId}
          parentId={review.id}
          placeholder={`${review.authorNickname ?? "작성자"}님께 답글을 작성하세요.`}
          compact
          onSuccess={() => { setReplyOpen(false); router.refresh(); }}
          onCancel={() => setReplyOpen(false)}
        />
      )}

      {review.replies.length > 0 && (
        <>
          {!repliesVisible && (
            <button
              type="button"
              className={styles.replyToggleBtn}
              onClick={() => setRepliesVisible(true)}
            >
              <Icon name="arrow-down-s-line" />
              {`답글 ${review.replies.length}개`}
            </button>
          )}
          {repliesVisible && (
            <>
              <ul className={styles.replyList}>
                {review.replies.map((reply) => (
                  <ReplyReviewItem key={reply.id} reply={reply} />
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
        title="후기를 삭제하시겠습니까?"
        description="삭제된 후기는 복구할 수 없습니다."
      />
    </article>
  );
}

function ReplyReviewItem({ reply }: { reply: Omit<ApiReview, "replies"> }) {
  const { user } = useAuth();
  const { requireAuth } = useGating();
  const { toast } = useToast();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
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
                    <button type="button" role="menuitem" onClick={() => { setEditValue(localContent ?? ""); setMenuOpen(false); setEditOpen(true); }}>
                      <Icon name="edit-2-line" />수정
                    </button>
                    <hr className={styles.menuDivider} />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                    >
                      <Icon name="delete-bin-line" />삭제
                    </button>
                    <hr className={styles.menuDivider} />
                  </>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItemDanger}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon name="alarm-warning-line" />신고
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isDeleted ? (
        <p className={styles.commentDeleted}>삭제된 답글입니다.</p>
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
        <p className={styles.replyItemText}>{localContent}</p>
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

      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="답글을 삭제하시겠습니까?"
        description="삭제된 답글은 복구할 수 없습니다."
      />
    </li>
  );
}

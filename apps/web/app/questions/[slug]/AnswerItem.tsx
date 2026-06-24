"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthorName, Icon } from "@/components/ui";
import { useToast } from "@/components/ui/Toast/Toast";
import { ReportModal } from "../../vibe-coding/[slug]/ReportModal";
import styles from "../questions.module.css";

const MAX_LENGTH = 2000;

export type AnswerComment = {
  author: string;
  date: string;
  text: string;
};

/** API AnswerResponse와 호환되는 타입 */
export type Answer = {
  id: string;
  questionId: string;
  author: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  } | null;
  /** contentJson: { type: "doc", html?: string, ... } */
  contentJson: Record<string, unknown>;
  /** 서버 렌더 HTML (contentHtml) */
  contentHtml?: string;
  status: "published" | "hidden" | "deleted";
  createdAt: string;
  updatedAt: string;
  /** UI 전용 — 추천 수 초기값 */
  votes?: number;
  /** 질문자가 채택한 답변 여부 */
  accepted?: boolean;
  comments?: AnswerComment[];
};

type Props = {
  answer: Answer;
  /** 현재 사용자가 이 질문의 작성자인지 — true일 때만 채택 버튼 노출 */
  canAccept: boolean;
  /** 이 질문에 이미 채택된 답변이 있는지 — 있으면 다른 답변의 채택 버튼을 숨긴다 */
  hasAccepted: boolean;
  /** 현재 로그인 사용자 ID — 일치 시 수정/삭제 메뉴 노출 */
  currentUserId?: string | null;
  /** 답변이 삭제됐을 때 부모에서 제거하기 위한 콜백 */
  onDeleted?: (answerId: string) => void;
  /** 답변 수정 성공 시 부모 state 갱신 콜백 */
  onUpdated?: (answerId: string, newContentJson: Record<string, unknown>, newContentHtml: string) => void;
};

export function AnswerItem({
  answer,
  canAccept,
  hasAccepted,
  currentUserId,
  onDeleted,
  onUpdated,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // 편집 중 텍스트 (textarea 기반 인라인 편집 유지)
  const [editValue, setEditValue] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [voteState, setVoteState] = useState<"up" | "down" | null>(null);
  const [likeCount, setLikeCount] = useState(answer.votes ?? 0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [accepted, setAccepted] = useState(Boolean(answer.accepted));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // ── 투표 (Epic 5 예약 — 로컬 state만, API 호출 없음) ──────────────────────────
  // TODO: Epic 5에서 활성화
  function handleVote(v: "up" | "down") {
    // TODO: Epic 5에서 reaction API 연결 예정. 현재는 aria-disabled로 UI 차단.
    const isCancel = voteState === v;
    const wasUp = voteState === "up";
    const wasDown = voteState === "down";
    setLikeCount((c) => {
      if (v === "up") return isCancel ? c - 1 : c + 1;
      return wasUp ? c - 1 : c;
    });
    setDislikeCount((c) => {
      if (v === "down") return isCancel ? c - 1 : c + 1;
      return wasDown ? c - 1 : c;
    });
    setVoteState(isCancel ? null : v);
  }

  function openEdit() {
    // 편집 시작: contentHtml 또는 contentJson.html을 편집 초기값으로 사용
    const htmlStr =
      answer.contentHtml ??
      (typeof answer.contentJson?.html === "string" ? answer.contentJson.html : "");
    setEditValue(htmlStr);
    setMenuOpen(false);
    setCommentOpen(false);
    setEditOpen(true);
  }

  // ── 답변 수정 저장 ──────────────────────────────────────────────────────────
  async function handleSaveEdit() {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const newContentJson = { type: "doc", html: editValue };
      const res = await fetch(`/api/v1/qna/answers/${answer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contentJson: newContentJson }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast({
          tone: "danger",
          title: "수정 실패",
          description: data?.error?.message ?? "잠시 후 다시 시도해 주세요.",
        });
        return;
      }

      const updated = (await res.json()) as { contentJson: Record<string, unknown>; contentHtml: string };
      setEditOpen(false);
      toast({ tone: "success", title: "답변이 수정되었습니다." });
      onUpdated?.(answer.id, updated.contentJson, updated.contentHtml ?? editValue);
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "네트워크 오류가 발생했습니다." });
    } finally {
      setIsSaving(false);
    }
  }

  // ── 답변 삭제 확인 → soft-delete ──────────────────────────────────────────
  async function handleDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/qna/answers/${answer.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok || res.status === 204) {
        setDeleteOpen(false);
        toast({ tone: "success", title: "답변이 삭제되었습니다." });
        onDeleted?.(answer.id);
        router.refresh();
      } else {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast({
          tone: "danger",
          title: "삭제 실패",
          description: data?.error?.message ?? "잠시 후 다시 시도해 주세요.",
        });
        setDeleteOpen(false);
      }
    } catch {
      toast({ tone: "danger", title: "네트워크 오류가 발생했습니다." });
      setDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  /** 작성자 닉네임 표시용 */
  const nickname = answer.author?.nickname ?? "익명";
  const initial = nickname.slice(0, 1);

  const editNearLimit = MAX_LENGTH - editValue.length <= 200;

  /** 현재 사용자가 이 답변의 작성자인지 */
  const isCurrentUser = Boolean(
    currentUserId && answer.author?.id && currentUserId === answer.author.id,
  );

  /** 본문 HTML — contentHtml(서버 렌더) 우선, 없으면 contentJson.html 추출 */
  const bodyHtml =
    answer.contentHtml ??
    (typeof answer.contentJson?.html === "string" ? answer.contentJson.html : "") ??
    "";

  return (
    <article
      className={`${styles.answerItem} ${accepted ? styles.answerAccepted : ""}`}
      aria-label={accepted ? "채택된 답변" : "답변"}
    >
      {accepted && (
        <div className={styles.acceptedBanner}>
          <Icon name="checkbox-circle-fill" />
          채택된 답변
        </div>
      )}

      <div className={styles.answerMain}>
        <div className={styles.answerHead}>
          <div className={styles.answerAvatar} aria-hidden="true">
            {initial}
          </div>
          <div className={styles.answerAuthorInfo}>
            <strong>
              {/* AuthorName: 닉네임 링크 + 등급 뱃지 */}
              <AuthorName name={nickname} />
            </strong>
            <span>
              {new Date(answer.createdAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })}
            </span>
          </div>

          <div className={styles.answerHeadActions}>
            <div className={styles.answerMenuWrapper} ref={menuRef}>
              <button
                type="button"
                className={styles.answerMenuButton}
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="답변 메뉴"
                aria-expanded={menuOpen}
              >
                <Icon name="more-2-fill" />
              </button>
              {menuOpen && (
                <div className={styles.answerMenuDropdown} role="menu">
                  {/* 수정/삭제: 작성자 본인만 노출 */}
                  {isCurrentUser && (
                    <>
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
          </div>
        </div>

        {editOpen ? (
          <div className={styles.inlineForm}>
            <div className={styles.answerInputBox}>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                maxLength={MAX_LENGTH}
                rows={5}
                autoFocus
              />
              <div className={styles.answerCharCount} aria-live="polite">
                <span className={editNearLimit ? styles.answerCharNearLimit : undefined}>
                  {editValue.length}
                </span>
                <span className={styles.answerCharMax}> / {MAX_LENGTH}</span>
              </div>
            </div>
            <div className={styles.inlineFormActions}>
              <button
                type="button"
                className={styles.inlineFormCancel}
                onClick={() => setEditOpen(false)}
                disabled={isSaving}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.inlineFormSubmit}
                onClick={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={styles.answerBody}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        )}

        <div className={styles.answerToolbar}>
          <div className={styles.answerToolbarLeft}>
            {/* 채택하기 — 질문 작성자에게만, 아직 채택된 답변이 없을 때만 노출 */}
            {!accepted && canAccept && !hasAccepted && (
              <button type="button" className={styles.acceptBtn} onClick={() => setAccepted(true)}>
                <Icon name="checkbox-circle-line" />
                채택하기
              </button>
            )}
            <button
              type="button"
              className={styles.answerCommentToggle}
              onClick={() => setCommentOpen((prev) => !prev)}
              aria-expanded={commentOpen}
            >
              <Icon name="chat-1-line" />
              댓글 달기
            </button>
            {answer.comments && answer.comments.length > 0 && (
              <button
                type="button"
                className={styles.answerCommentToggle}
                onClick={() => setCommentsVisible((prev) => !prev)}
                aria-expanded={commentsVisible}
              >
                <Icon name={commentsVisible ? "arrow-up-s-line" : "arrow-down-s-line"} />
                {`댓글 ${answer.comments.length}개`}
              </button>
            )}
          </div>

          {/* 추천/비추천 — Epic 5 예약 슬롯. aria-disabled로 비활성화. */}
          {/* TODO: Epic 5에서 활성화 */}
          <div className={styles.answerVote} role="group" aria-label="답변 평가">
            <button
              type="button"
              className={`${styles.answerVoteBtn} ${voteState === "up" ? styles.answerVoteUp : ""}`}
              onClick={() => handleVote("up")}
              aria-pressed={voteState === "up"}
              aria-disabled="true"
            >
              <Icon name={voteState === "up" ? "thumb-up-fill" : "thumb-up-line"} />
              추천
              <span className={styles.answerVoteCount}>{likeCount}</span>
            </button>
            <button
              type="button"
              className={`${styles.answerVoteBtn} ${voteState === "down" ? styles.answerVoteDown : ""}`}
              onClick={() => handleVote("down")}
              aria-pressed={voteState === "down"}
              aria-disabled="true"
            >
              <Icon name={voteState === "down" ? "thumb-down-fill" : "thumb-down-line"} />
              비추천
              <span className={styles.answerVoteCount}>{dislikeCount}</span>
            </button>
          </div>
        </div>

        {commentsVisible && answer.comments && answer.comments.length > 0 && (
          <ul className={styles.answerCommentList}>
            {answer.comments.map((c) => (
              <li key={`${c.author}-${c.date}`} className={styles.answerCommentItem}>
                <AuthorName name={c.author} className={styles.answerCommentAuthor} />
                <span className={styles.answerCommentText}>{c.text}</span>
                <span className={styles.answerCommentDate}>{c.date}</span>
              </li>
            ))}
          </ul>
        )}

        {commentOpen && (
          <div className={styles.answerCommentForm}>
            <input
              type="text"
              value={commentValue}
              onChange={(e) => setCommentValue(e.target.value)}
              placeholder="이 답변에 댓글을 남겨보세요."
              aria-label="답변 댓글 작성"
            />
            <button
              type="button"
              disabled={commentValue.trim().length === 0}
              onClick={() => { setCommentValue(""); setCommentOpen(false); }}
            >
              등록
            </button>
          </div>
        )}
      </div>

      {/* ── 삭제 확인 모달 ── */}
      {deleteOpen && (
        <div
          className={styles.deleteModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="answer-delete-title"
        >
          <div className={styles.deleteModalDialog}>
            <h2 id="answer-delete-title" className={styles.deleteModalTitle}>
              답변을 삭제하시겠습니까?
            </h2>
            <p className={styles.deleteModalDesc}>
              삭제된 답변은 복구할 수 없습니다.
            </p>
            <div className={styles.deleteModalActions}>
              <button
                type="button"
                className={styles.deleteModalCancel}
                onClick={() => setDeleteOpen(false)}
                disabled={isDeleting}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.deleteModalOk}
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="answer"
        targetId={answer.id}
      />
    </article>
  );
}

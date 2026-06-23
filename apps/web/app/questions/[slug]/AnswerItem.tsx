"use client";

import { useState, useRef, useEffect } from "react";
import { AuthorName, Icon } from "@/components/ui";
import { ReportModal } from "../../vibe-coding/[slug]/ReportModal";
import styles from "../questions.module.css";

const MAX_LENGTH = 2000;

export type AnswerComment = {
  author: string;
  date: string;
  text: string;
};

export type Answer = {
  id: string;
  author: string;
  /** 작성자 레벨 라벨 (예: 마스터, 고수) — 색 단독 전달 금지에 따라 텍스트로 표기 */
  level?: string;
  date: string;
  body: string[];
  votes: number;
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
};

export function AnswerItem({ answer, canAccept, hasAccepted }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState(answer.body.join("\n\n"));
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [voteState, setVoteState] = useState<"up" | "down" | null>(null);
  // 추천/비추천 개수를 각각 표시한다. 초기 추천 수는 데이터의 votes 값을 사용.
  const [likeCount, setLikeCount] = useState(answer.votes);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [accepted, setAccepted] = useState(Boolean(answer.accepted));
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

  function handleVote(v: "up" | "down") {
    const isCancel = voteState === v;
    const wasUp = voteState === "up";
    const wasDown = voteState === "down";
    setLikeCount((c) => {
      if (v === "up") return isCancel ? c - 1 : c + 1;
      return wasUp ? c - 1 : c; // 비추천을 누르면 기존 추천 취소
    });
    setDislikeCount((c) => {
      if (v === "down") return isCancel ? c - 1 : c + 1;
      return wasDown ? c - 1 : c; // 추천을 누르면 기존 비추천 취소
    });
    setVoteState(isCancel ? null : v);
  }

  function openEdit() {
    setEditValue(answer.body.join("\n\n"));
    setMenuOpen(false);
    setCommentOpen(false);
    setEditOpen(true);
  }

  const initial = answer.author.slice(0, 1);
  const editNearLimit = MAX_LENGTH - editValue.length <= 200;

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
                {/* AuthorName 이 닉네임 링크 + 등급 뱃지를 함께 렌더한다.
                    답변의 실제 레벨(answer.level)이 있으면 그 등급을 라벨과 함께 표시. */}
                <AuthorName
                  name={answer.author}
                  rank={answer.level}
                  showLabel={Boolean(answer.level)}
                  badgeSize={18}
                />
              </strong>
              <span>{answer.date}</span>
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
                <button type="button" className={styles.inlineFormCancel} onClick={() => setEditOpen(false)}>
                  취소
                </button>
                <button type="button" className={styles.inlineFormSubmit} onClick={() => setEditOpen(false)}>
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.answerBody}>
              {answer.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          )}

          <div className={styles.answerToolbar}>
            <div className={styles.answerToolbarLeft}>
              {/* 채택하기 — 질문 작성자에게만, 아직 채택된 답변이 없을 때만 노출.
                  이미 채택된 답변은 상단 배너로 표시되므로 버튼을 두지 않는다. */}
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

            {/* 추천/비추천 — 다수 사용자의 답변 평가 (숫자 동반) */}
            <div className={styles.answerVote} role="group" aria-label="답변 평가">
              <button
                type="button"
                className={`${styles.answerVoteBtn} ${voteState === "up" ? styles.answerVoteUp : ""}`}
                onClick={() => handleVote("up")}
                aria-pressed={voteState === "up"}
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

      <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />
    </article>
  );
}

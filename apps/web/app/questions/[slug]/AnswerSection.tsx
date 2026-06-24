"use client";

/**
 * 답변 섹션 클라이언트 컴포넌트 — Story 3.6
 *
 * SSR page.tsx에서 초기 answers 배열을 주입받아 클라이언트 state로 관리한다.
 * - 답변 추가 성공 시 router.refresh() (page.tsx가 SSR 재실행)
 * - 답변 삭제 시 낙관적으로 해당 항목 제거
 * - 답변 수정 시 해당 항목 contentHtml 갱신
 *
 * AnswerItem: 수정/삭제 API 연결, 좋아요 슬롯(aria-disabled, Epic 5 예약)
 * AnswerForm: 작성 API 연결, 비회원 로그인 유도
 *
 * ⚠️ SSR 500 방지: 이 파일은 "use client" 전용. page.tsx 상수 import 금지.
 */

import { useState } from "react";
import { Icon } from "@/components/ui";
import { AnswerItem, type Answer } from "./AnswerItem";
import { AnswerForm } from "./AnswerForm";
import styles from "../questions.module.css";

interface AnswerSectionProps {
  questionId: string;
  initialAnswers: Answer[];
  /** 현재 로그인 사용자 ID (SSR에서 주입, null=비로그인) */
  currentUserId: string | null;
  /** 현재 사용자가 이 질문의 작성자인지 */
  isAsker: boolean;
  /** 이미 채택된 답변 ID (null=없음) */
  helpfulAnswerId: string | null;
}

export function AnswerSection({
  questionId,
  initialAnswers,
  currentUserId,
  isAsker,
  helpfulAnswerId,
}: AnswerSectionProps) {
  const [answers, setAnswers] = useState<Answer[]>(initialAnswers);

  /** 답변 삭제 후 목록에서 제거 */
  function handleDeleted(answerId: string) {
    setAnswers((prev) => prev.filter((a) => a.id !== answerId));
  }

  /** 답변 수정 후 해당 항목 content 갱신 */
  function handleUpdated(
    answerId: string,
    newContentJson: Record<string, unknown>,
    newContentHtml: string,
  ) {
    setAnswers((prev) =>
      prev.map((a) =>
        a.id === answerId
          ? { ...a, contentJson: newContentJson, contentHtml: newContentHtml }
          : a,
      ),
    );
  }

  const answerCount = answers.length;
  const hasAccepted = answers.some((a) => a.id === helpfulAnswerId || a.accepted);

  return (
    <>
      {/* ── 답변 목록 ── */}
      <section className={styles.answerSection} aria-labelledby="answer-title">
        <div className={styles.answerSectionHead}>
          <h2 id="answer-title">
            답변 <strong>{answerCount}</strong>
          </h2>
          {answerCount > 1 && (
            <div className={styles.answerSort} role="group" aria-label="답변 정렬">
              <button type="button" aria-pressed="true">추천순</button>
              <button type="button" aria-pressed="false">최신순</button>
            </div>
          )}
        </div>

        {answerCount === 0 ? (
          <div className={styles.answerEmpty}>
            <Icon name="chat-smile-2-line" />
            <p>아직 답변이 없습니다.</p>
            <span>첫 번째 답변을 남겨 질문자에게 도움을 줘보세요.</span>
          </div>
        ) : (
          <div className={styles.answerList}>
            {answers.map((answer) => (
              <AnswerItem
                key={answer.id}
                answer={answer}
                canAccept={isAsker}
                hasAccepted={hasAccepted}
                currentUserId={currentUserId}
                onDeleted={handleDeleted}
                onUpdated={handleUpdated}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── 답변 작성 ── */}
      <section className={styles.answerWriteSection} aria-labelledby="answer-write-title">
        <h2 id="answer-write-title" className={styles.answerWriteTitle}>
          <Icon name="quill-pen-line" />
          답변 작성하기
        </h2>
        <AnswerForm questionId={questionId} />
      </section>
    </>
  );
}

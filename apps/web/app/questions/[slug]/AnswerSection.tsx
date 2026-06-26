"use client";

/**
 * 답변 섹션 클라이언트 컴포넌트 — Story 3.6 + Story 3.7
 *
 * SSR page.tsx에서 초기 answers 배열과 helpfulAnswerId를 주입받아 클라이언트 state로 관리한다.
 * - 답변 추가 성공 시 router.refresh() (page.tsx가 SSR 재실행)
 * - 답변 삭제 시 낙관적으로 해당 항목 제거
 * - 답변 수정 시 해당 항목 contentHtml 갱신
 * - 도움된 답변 지정/해제: 낙관적 업데이트 + PATCH API + 실패 시 롤백 (Story 3.7)
 *
 * AnswerItem: 수정/삭제 API 연결, 좋아요 슬롯(aria-disabled, Epic 5 예약), 도움된 답변 토글
 * AnswerForm: 작성 API 연결, 비회원 로그인 유도
 *
 * ⚠️ SSR 500 방지: 이 파일은 "use client" 전용. page.tsx 상수 import 금지.
 */

import { useState } from "react";
import { Icon } from "@/components/ui";
import { useToast } from "@/components/ui/Toast/Toast";
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
  /** 초기 도움된 답변 ID (SSR에서 주입, null=없음) */
  helpfulAnswerId: string | null;
}

export function AnswerSection({
  questionId,
  initialAnswers,
  currentUserId,
  isAsker,
  helpfulAnswerId: initialHelpfulAnswerId,
}: AnswerSectionProps) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Answer[]>(initialAnswers);
  /** 도움된 답변 ID — 낙관적 업데이트의 단일 진실 공급원 */
  const [helpfulAnswerId, setHelpfulAnswerId] = useState<string | null>(
    initialHelpfulAnswerId,
  );

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

  /**
   * 도움된 답변 지정/해제 — Story 3.7
   *
   * 낙관적 업데이트: setHelpfulAnswerId 즉시 갱신 → PATCH API 호출 → 실패 시 롤백.
   * answerId=null 이면 해제.
   */
  async function handleMarkHelpful(answerId: string | null) {
    const prevId = helpfulAnswerId;
    // 낙관적 업데이트
    setHelpfulAnswerId(answerId);
    try {
      const res = await fetch(
        `/api/v1/qna/questions/${questionId}/helpful-answer`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ answerId }),
        },
      );
      if (!res.ok) {
        // 서버 오류 → 롤백
        setHelpfulAnswerId(prevId);
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast({
          tone: "danger",
          title: "요청에 실패했습니다.",
          description: data?.error?.message ?? "다시 시도해 주세요.",
        });
        return;
      }
      toast({
        tone: "success",
        title: answerId ? "도움된 답변을 표시했어요." : "도움된 답변을 해제했어요.",
      });
    } catch {
      // 네트워크 오류 → 롤백
      setHelpfulAnswerId(prevId);
      toast({
        tone: "danger",
        title: "요청에 실패했습니다.",
        description: "다시 시도해 주세요.",
      });
    }
  }

  const answerCount = answers.length;

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
                isHelpful={helpfulAnswerId === answer.id}
                canMarkHelpful={isAsker}
                onMarkHelpful={handleMarkHelpful}
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
        <AnswerForm
          questionId={questionId}
          onSuccess={(answer) => setAnswers((prev) => [...prev, answer])}
        />
      </section>
    </>
  );
}

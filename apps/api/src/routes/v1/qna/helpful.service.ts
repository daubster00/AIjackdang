/**
 * Q&A 도움된 답변 서비스 — Story 3.7
 *
 * setHelpfulAnswer: 질문자가 도움된 답변을 지정하거나 해제한다.
 *
 * - helpful_answer_id 와 is_resolved 는 독립 — 도움된 답변 지정이 자동 해결이 아님.
 * - 포인트·등급·마감 연산 없음.
 * - 저장 대상: schema.questions (questions.helpful_answer_id 갱신).
 *   schema.posts / schema.comments 절대 사용 금지.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq, and, isNull } from "drizzle-orm";

// ── 입출력 타입 ──────────────────────────────────────────────────────────────

export interface SetHelpfulAnswerParams {
  questionId: string;
  userId: string;
  /** 지정할 답변 ID. null 이면 도움된 답변 해제. */
  answerId: string | null;
}

export type SetHelpfulAnswerResult =
  | { id: string; helpfulAnswerId: string | null; error?: never }
  | { error: "QUESTION_NOT_FOUND" | "FORBIDDEN" | "ANSWER_NOT_FOUND"; id?: never };

// ── setHelpfulAnswer ──────────────────────────────────────────────────────────

/**
 * 도움된 답변 지정/해제.
 *
 * 1. 질문 존재 + 작성자 본인 확인.
 * 2. answerId 가 있으면 해당 답변이 이 질문 소속 + status='published' 인지 확인.
 * 3. questions.helpful_answer_id = answerId (null 허용) + updated_at 갱신.
 * 4. { id, helpfulAnswerId } 반환.
 *
 * 동일 답변 재지정(answerId === 현재 helpful_answer_id)도 null 로 토글 가능.
 * 명세(AC #4): 동일 답변 재클릭 → answerId=null 전달 → 해제.
 * 서비스는 answerId 값 그대로 저장하므로 토글 판단은 라우트 또는 클라이언트가 수행한다.
 */
export async function setHelpfulAnswer({
  questionId,
  userId,
  answerId,
}: SetHelpfulAnswerParams): Promise<SetHelpfulAnswerResult> {
  const db = getDb();

  // ── 질문 존재 확인 + 작성자 검증 ───────────────────────────────────────────
  const [question] = await db
    .select({
      id: schema.questions.id,
      userId: schema.questions.userId,
      status: schema.questions.status,
    })
    .from(schema.questions)
    .where(
      and(
        eq(schema.questions.id, questionId),
        isNull(schema.questions.deletedAt),
      ),
    )
    .limit(1);

  if (!question || question.status === "deleted") {
    return { error: "QUESTION_NOT_FOUND" };
  }

  // 질문 작성자 본인만 도움된 답변을 지정/해제할 수 있다 (AC #6).
  if (question.userId !== userId) {
    return { error: "FORBIDDEN" };
  }

  // ── answerId 유효성 확인 (null 이면 해제이므로 검증 불필요) ─────────────────
  if (answerId !== null) {
    const [answer] = await db
      .select({
        id: schema.answers.id,
        questionId: schema.answers.questionId,
        status: schema.answers.status,
      })
      .from(schema.answers)
      .where(
        and(
          eq(schema.answers.id, answerId),
          isNull(schema.answers.deletedAt),
        ),
      )
      .limit(1);

    // 답변이 없거나, 이 질문 소속이 아니거나, published 가 아니면 400 대상
    if (
      !answer ||
      answer.questionId !== questionId ||
      answer.status !== "published"
    ) {
      return { error: "ANSWER_NOT_FOUND" };
    }
  }

  // ── questions.helpful_answer_id 갱신 ────────────────────────────────────────
  await db
    .update(schema.questions)
    .set({
      helpfulAnswerId: answerId,
      updatedAt: new Date(),
    })
    .where(eq(schema.questions.id, questionId));

  return { id: questionId, helpfulAnswerId: answerId };
}

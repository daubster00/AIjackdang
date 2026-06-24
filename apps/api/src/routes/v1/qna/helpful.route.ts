import type { FastifyInstance } from "fastify";

/**
 * Story 3.7 — 도움된 답변 지정/해제 (질문자 전용).
 * PATCH /api/v1/qna/questions/:questionId/helpful-answer (setHelpfulAnswerSchema).
 * 스텁: Story 3.7 담당 에이전트가 채운다.
 * helpful_answer_id 와 is_resolved 는 독립 — 포인트/등급/마감 연산 없음.
 */
export async function registerQnaHelpfulRoutes(_app: FastifyInstance): Promise<void> {
  // TODO(Story 3.7): 도움된 답변 토글 구현
}

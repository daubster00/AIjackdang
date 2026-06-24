import type { FastifyInstance } from "fastify";

/**
 * Story 3.6 — 답변 CRUD.
 * POST /api/v1/qna/questions/:questionId/answers · PATCH/DELETE /qna/answers/:id.
 * 스텁: Story 3.6 담당 에이전트가 채운다. content_json(Tiptap JSON, lite preset).
 * 답변 좋아요·신고는 슬롯만(Epic 5 소유) — reaction/report 테이블 건드리지 않음.
 */
export async function registerQnaAnswerRoutes(_app: FastifyInstance): Promise<void> {
  // TODO(Story 3.6): 답변 작성·수정·삭제 구현
}

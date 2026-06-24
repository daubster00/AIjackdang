import type { FastifyInstance } from "fastify";

/**
 * Story 3.3 — POST /api/v1/qna/questions 작성(+임시저장), 3.8 — PATCH 수정,
 * 3.5 — PATCH /qna/questions/:id/resolve · DELETE /qna/questions/:id.
 * 스텁: 각 스토리 담당 에이전트가 이 파일에 자기 핸들러를 추가한다.
 * slug 는 slugify(title)+generateUniqueSlug(@ai-jakdang/utilities)로 생성.
 */
export async function registerQnaWriteRoutes(_app: FastifyInstance): Promise<void> {
  // TODO(Story 3.3/3.5/3.8): 작성·수정·해결·삭제 구현
}

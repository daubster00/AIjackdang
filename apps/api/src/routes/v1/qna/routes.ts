import type { FastifyInstance } from "fastify";

/**
 * /api/v1/qna 라우트 집계자 (Epic 3 묻고답하기).
 *
 * 병렬 개발을 위해 concern별 모듈 파일로 분리한다. 각 스토리는 자기 모듈
 * 파일(`*.route.ts` + 필요 시 `*.service.ts`)만 채운다. 집계자(import/등록)는
 * 이미 모든 concern 을 미리 등록해 두었으므로 스토리 작업 중에는 이 파일을
 * 수정하지 않는다 → add/add 머지 충돌 0.
 *
 *  - list.route.ts    : GET /qna/questions 목록 (Story 3.2)
 *  - write.route.ts   : POST/PATCH /qna/questions 작성·수정·해결·삭제 (Story 3.3·3.5·3.8)
 *  - detail.route.ts  : GET /qna/questions/:slug 상세 + 조회수 (Story 3.5)
 *  - answer.route.ts  : 답변 CRUD (Story 3.6)
 *  - helpful.route.ts : 도움된 답변 지정/해제 (Story 3.7)
 *
 * 답변 좋아요·신고는 Epic 5 소유(슬롯만). reaction/report 테이블 건드리지 않는다.
 */

// ── [STORY-IMPORTS] ──
import { registerQnaListRoutes } from "./list.route.js"; // Story 3.2
import { registerQnaWriteRoutes } from "./write.route.js"; // Story 3.3·3.8
import { registerQnaDetailRoutes } from "./detail.route.js"; // Story 3.5
import { registerQnaAnswerRoutes } from "./answer.route.js"; // Story 3.6
import { registerQnaHelpfulRoutes } from "./helpful.route.js"; // Story 3.7

export async function qnaRoutes(app: FastifyInstance): Promise<void> {
  // ── [STORY-REGISTRATIONS] ──
  await registerQnaListRoutes(app); // Story 3.2
  await registerQnaWriteRoutes(app); // Story 3.3·3.8
  await registerQnaDetailRoutes(app); // Story 3.5
  await registerQnaAnswerRoutes(app); // Story 3.6
  await registerQnaHelpfulRoutes(app); // Story 3.7
}

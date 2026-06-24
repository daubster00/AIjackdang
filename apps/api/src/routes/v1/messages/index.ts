/**
 * /api/v1/messages 라우트 등록 — Story 7.4
 *
 * 등록된 라우트:
 * - POST  /                             쪽지 발송 (rate limit: 10/hr, 인증 필수)
 * - GET   /conversations                대화 목록 조회 (인증 필수)
 * - GET   /conversations/:userId        스레드 조회 (인증 필수)
 * - POST  /conversations/:userId/read-all  일괄 읽음 처리 (인증 필수)
 *
 * ⚠️ 이 함수를 apps/api/src/routes/v1/index.ts에 등록 필요:
 *    import { messagesRoutes } from "./messages/index.js";
 *    await app.register(messagesRoutes, { prefix: "/messages" });
 */

export { messagesRoutes } from "./routes.js";

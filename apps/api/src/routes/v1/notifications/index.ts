/**
 * /api/v1/notifications 라우트 등록 — Story 7.1 + Story 7.2
 *
 * 등록된 라우트:
 * - GET  /sse            : SSE 커넥션 (Story 7.1)
 * - GET  /unread-count   : 미읽음 개수 조회 (Story 7.2)
 * - GET  /               : 알림 목록 조회 (Story 7.2)
 * - PATCH /read-all      : 전체 읽음 처리 (Story 7.2)
 * - PATCH /:id/read      : 단건 읽음 처리 (Story 7.2)
 *
 * 향후 확장 (Story 7.x):
 * - GET  /settings       : 알림 설정 조회
 * - PATCH /settings      : 알림 설정 수정
 */

import type { FastifyInstance } from "fastify";
import { registerSseRoute } from "./sse.js";
import { registerNotificationRoutes } from "./routes.js";

export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  // SSE 라우트 (Story 7.1)
  await registerSseRoute(app);

  // CRUD 라우트 (Story 7.2)
  await registerNotificationRoutes(app);
}

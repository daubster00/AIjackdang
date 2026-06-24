/**
 * /api/v1/inquiries 라우트 등록 진입점 — Story 7.5
 *
 * 메인 오케스트레이터가 v1/index.ts 에 아래를 추가해야 한다:
 *
 * ```ts
 * import { inquiriesRoutes } from "./inquiries/index.js";
 * // ...
 * await app.register(inquiriesRoutes, { prefix: "/inquiries" });
 * ```
 */

export { inquiriesRoutes } from "./routes.js";

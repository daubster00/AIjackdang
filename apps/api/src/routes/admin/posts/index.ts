/**
 * 게시글 관리 API 등록 진입점 (Story 9.6).
 *
 * 오케스트레이터 stub. Story 9.6 에이전트가 GET 목록 + PATCH flags/hide/restore/seo ·
 * DELETE(soft, super_admin) · POST bulk 라우트를 이 폴더에 구현하고 이 함수에서 등록한다.
 * DELETE·벌크삭제에만 requireSuperAdmin 적용.
 * routes/admin/index.ts 등록은 이미 연결돼 있다.
 */

import type { FastifyInstance } from "fastify";

export async function registerAdminPostsRoutes(_app: FastifyInstance): Promise<void> {
  // Story 9.6 에이전트가 구현한다.
}

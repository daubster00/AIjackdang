/**
 * 운영자 계정 관리 API 등록 진입점 (Story 9.4).
 *
 * 오케스트레이터 stub. Story 9.4 에이전트가 GET 목록 + PATCH approve/reject/
 * suspend/activate/role 라우트를 이 파일(또는 같은 폴더 모듈)에 구현하고
 * 이 함수에서 등록한다. requireSuperAdmin preHandler를 전체에 적용한다.
 * routes/admin/index.ts 등록은 이미 연결돼 있다.
 */

import type { FastifyInstance } from "fastify";

export async function registerAdminMembersRoutes(_app: FastifyInstance): Promise<void> {
  // Story 9.4 에이전트가 구현한다.
}

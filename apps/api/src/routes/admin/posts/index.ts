/**
 * 게시글 관리 API 등록 진입점 (Story 9.6).
 *
 * GET    /api/v1/admin/posts                — 목록 조회
 * PATCH  /api/v1/admin/posts/:id/flags      — 플래그 토글
 * PATCH  /api/v1/admin/posts/:id/hide       — 숨김
 * PATCH  /api/v1/admin/posts/:id/restore    — 복구
 * DELETE /api/v1/admin/posts/:id            — 소프트 삭제 (super_admin)
 * PATCH  /api/v1/admin/posts/:id/seo        — SEO 메타
 * POST   /api/v1/admin/posts/bulk           — 벌크 액션
 */

import type { FastifyInstance } from "fastify";
import { requireSuperA
import type { FastifyInstance } from "fastify";
import { env } from "@ai-jakdang/config";
import { registerDevLoginRoute } from "../../auth/dev-login.js";
import { usersRoutes } from "./users.js";
import { registerSignUpRoute } from "./auth/sign-up.js";
import { registerVerifyEmailRoute } from "./auth/verify-email.js";
import { registerForgotPasswordRoute } from "./auth/forgot-password.js";
import { registerResetPasswordRoute } from "./auth/reset-password.js";
import { postsRoutes } from "./posts/routes.js";
import { tagsRoutes } from "./tags/routes.js";
import { resourcesRoutes } from "./resources/routes.js";
import { qnaRoutes } from "./qna/routes.js";
import { registerMeResourcesRoutes } from "./me/resources.route.js";
import { reactionsRoutes } from "./reactions.js";
import { commentsRoutes } from "./comments.js";
import { bookmarksRoutes } from "./bookmarks.js";
import { reportsRoutes } from "./reports.js";
import { relatedRoutes } from "./related.js";
import { blocksRoutes } from "./blocks.js";
import { followsRoutes } from "./follows.js";
import { gamificationRoutes } from "./gamification/gamification.routes.js";
import { notificationsRoutes } from "./notifications/index.js";
import { messagesRoutes } from "./messages/index.js";
import { inquiriesRoutes } from "./inquiries/index.js";
import { searchRoutes } from "./search.js";
import { tagContentRoutes } from "./tagContent.js";
import { registerHomeQuestionsRoutes } from "./questions/index.js";
import { registerNoticesRoutes } from "./notices/index.js";
import { sitemapRoutes } from "./sitemap/routes.js";

/**
 * /api/v1 라우트.
 *
 * Better Auth 인스턴스 핸들러는 별도 마운트(app.ts에서 처리).
 * 여기서는 직접 구현 라우트 + 개발 유틸 라우트를 등록한다.
 */
export async function v1Routes(app: FastifyInstance) {
  // ── 개발 전용: dev-login (production 미노출) ───────────────────────────────
  if (env.NODE_ENV !== "production" && env.AUTH_DEV_BYPASS) {
    await registerDevLoginRoute(app);
  }

  // ── 이메일 회원가입 (Story 1.3) ───────────────────────────────────────────
  // Fastify 특정 경로(/auth/sign-up)가 와일드카드(/auth/*)보다 우선 매칭된다.
  await registerSignUpRoute(app);

  // ── 이메일 인증 보조 라우트 (Story 1.3) ──────────────────────────────────
  // Better Auth가 /verify-email 을 처리하지만 추가 보조 엔드포인트 등록
  await registerVerifyEmailRoute(app);

  // ── 비밀번호 재설정 (Story 1.6) ──────────────────────────────────────────
  // 커스텀 라우트: POST /auth/forgot-password · POST /auth/reset-password
  // user-auth.ts(Better Auth) 를 수정하지 않고 완전히 독립 구현한다.
  await registerForgotPasswordRoute(app);
  await registerResetPasswordRoute(app);

  // ── 사용자 라우트 (Story 1.8 /users/me · 1.10 /users/profile/:nickname) ──────
  await usersRoutes(app);

  // ── 게시글 라우트 (Story 2.3 GET /posts · Story 2.7 POST /posts) ───────────────
  await postsRoutes(app);

  // ── 태그 라우트 (Story 2.7 GET /tags?q=) ────────────────────────────────────────
  await tagsRoutes(app);

  // ── 실전자료 라우트 (Epic 4: 목록/상세/등록/업로드/다운로드/평점/수정삭제) ──────
  await resourcesRoutes(app);

  // ── 마이페이지 내 자료 라우트 (Story 4.9 GET /me/resources) ──────────────────
  await registerMeResourcesRoutes(app);

  // ── 반응(좋아요) 라우트 (Story 5.2) ──────────────────────────────────────────
  await reactionsRoutes(app);

  // ── 댓글 라우트 (Story 5.4 CRUD + 5.5 대댓글) ────────────────────────────────
  await commentsRoutes(app);

  // ── 북마크 라우트 (Story 5.7) ─────────────────────────────────────────────
  await bookmarksRoutes(app);

  // ── 신고 라우트 (Story 5.8) ───────────────────────────────────────────────
  await reportsRoutes(app);

  // ── 관련글 라우트 (Story 5.10) ────────────────────────────────────────────
  await relatedRoutes(app);

  // ── 차단 라우트 (Story 5.11) ──────────────────────────────────────────────
  await blocksRoutes(app);

  // ── 팔로우 라우트 (Story 5.12) ────────────────────────────────────────────
  await followsRoutes(app);

  // ── 묻고답하기(Q&A) 라우트 (Epic 3: 목록/작성/상세/답변/도움된답변) ──────────
  await qnaRoutes(app);

  // ── 게이미피케이션 라우트 (Story 6.3: 등급 조회; 6.4/6.5에서 확장) ──────────
  // GET /api/v1/gamification/me          — 내 등급 (인증 필요)
  // GET /api/v1/gamification/user/:userId/grade — 공개 등급 조회
  await gamificationRoutes(app);

  // ── 알림 라우트 (Story 7.1: SSE 커넥션; 7.2에서 CRUD 확장) ─────────────────
  // GET /api/v1/notifications/sse — SSE 연결 (인증 필요)
  await app.register(notificationsRoutes, { prefix: "/notifications" });

  // ── 쪽지(DM) 라우트 (Story 7.4: 발송/대화목록/스레드/읽음) ─────────────────
  await app.register(messagesRoutes, { prefix: "/messages" });

  // ── 1:1 문의 라우트 (Story 7.5: 목록/작성/상세스레드) ──────────────────────
  await app.register(inquiriesRoutes, { prefix: "/inquiries" });

  // ── 통합 검색 라우트 (Story 8.1: GET /search) ────────────────────────────────
  await app.register(searchRoutes, { prefix: "/search" });

  // ── 태그 콘텐츠 라우트 (Story 8.3: GET /tags/popular · /tags/:tag/content) ──
  await tagContentRoutes(app);

  // ── 홈 페이지 전용 질문 라우트 (Story 8.5: GET /questions) ──────────────────
  await registerHomeQuestionsRoutes(app);

  // ── 홈 페이지 전용 핀 공지 라우트 (Story 8.5: GET /notices/pinned) ───────────
  await registerNoticesRoutes(app);

  // ── 사이트맵 데이터 라우트 (Story 8.7: GET /sitemap/*) ───────────────────────
  await sitemapRoutes(app);
}

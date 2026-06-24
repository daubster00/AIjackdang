/**
 * requireAuthHook — Fastify preHandler 훅 (Story 1.7, AC #5).
 *
 * 세션 없는 요청이 쓰기·반응·다운로드·신고 라우트에 도달하면 401을 반환한다.
 * 클라이언트의 UX 게이팅(useGating)은 편의 수단이며, 최종 통제는 이 API 게이트다
 * (project-context §보안: "인증 권위는 API 서버").
 *
 * 사용법:
 * ```ts
 * import { requireAuthHook } from "@/plugins/require-auth.js";
 *
 * fastify.post("/api/v1/posts", { preHandler: [requireAuthHook] }, handler);
 * ```
 *
 * 세션 확인 방법:
 * - Better Auth 세션 쿠키 prefix = "aj_session" (ADR-0002).
 * - 쿠키명: "aj_session.session_token" (httpOnly).
 * - Edge 미들웨어처럼 쿠키 존재 여부만 체크하지 않고,
 *   Better Auth의 /api/v1/auth/get-session을 내부 호출해 유효성을 검증한다.
 *   단, 이는 별도 HTTP 왕복이므로 현재는 쿠키 존재 여부로 빠른 거부 후
 *   실제 핸들러에서 Better Auth session 객체를 확인하는 패턴으로 구현한다.
 *
 * 현재 등록 대상 라우트:
 * - 현재 apps/api에 존재하는 행동 라우트가 없으므로 플러그인만 정의.
 *   각 기능 스토리(Epic 2~9)에서 라우트 등록 시 이 훅을 추가한다.
 *
 * Story 9.12 추가:
 * - checkSuspendedHook: requireAuthHook 이후에 실행하여 users.status='suspended' 확인.
 *   preHandler: [requireAuthHook, checkSuspendedHook] 순서로 사용.
 *   또는 requireAuthAndNotSuspended 로 두 훅을 합친 배열을 임포트해 사용.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { userAuth } from "../auth/user-auth.js";
import { getDb } from "@ai-jakdang/database";
import { users } from "@ai-jakdang/database/schema";
import { eq } from "drizzle-orm";

/**
 * 세션 없는 요청을 401로 거부하는 preHandler 훅.
 *
 * Better Auth의 api.getSession()을 사용해 세션 유효성을 검증한다.
 * 세션이 없거나 만료된 경우 401 UNAUTHORIZED를 반환한다.
 */
export async function requireAuthHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    // Better Auth의 세션 검증: 요청 쿠키를 기반으로 세션 조회
    const session = await userAuth.api.getSession({
      headers: request.headers as unknown as Headers,
    });

    if (!session?.user) {
      await reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "로그인이 필요합니다.",
        },
      });
      return;
    }

    // 세션 정보를 request에 저장해 핸들러에서 사용할 수 있도록 한다
    // (request.user 패턴 — 각 스토리에서 타입 선언 추가 가능)
    (request as FastifyRequest & { user: typeof session.user }).user = session.user;
  } catch {
    await reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
      },
    });
  }
}

/**
 * 제재 회원 API 접근 차단 훅 (Story 9.12, AC #3).
 *
 * requireAuthHook 이후에 실행하며, users.status='suspended' 이고
 * suspendedUntil > NOW() (또는 suspendedUntil=null → 영구정지) 인 경우
 * 403 "이용이 제한된 계정입니다." 를 반환한다.
 *
 * 사용법 (두 훅을 항상 세트로 사용):
 * ```ts
 * import { requireAuthAndNotSuspended } from "@/plugins/require-auth.js";
 * fastify.post("/...", { preHandler: requireAuthAndNotSuspended }, handler);
 * ```
 */
export async function checkSuspendedHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const authUser = (request as FastifyRequest & { user?: { id: string } }).user;
    if (!authUser?.id) {
      // requireAuthHook 에서 이미 처리됨 — 이 경우는 도달하지 않아야 함
      return;
    }

    const db = getDb();
    const [row] = await db
      .select({
        status: users.status,
        suspendedUntil: users.suspendedUntil,
      })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!row) return; // 탈퇴 등 예외 상황 — 후속 핸들러에서 처리

    const now = new Date();
    const isSuspended =
      row.status === "suspended" &&
      (row.suspendedUntil === null || row.suspendedUntil > now);

    if (isSuspended) {
      await reply.status(403).send({
        error: {
          code: "ACCOUNT_SUSPENDED",
          message: "이용이 제한된 계정입니다.",
        },
      });
    }
  } catch {
    // DB 오류는 무시하고 통과 — 보안보다 가용성 우선 (경계값)
  }
}

/**
 * requireAuthHook + checkSuspendedHook 의 합성 배열.
 * preHandler에 바로 전개해 사용할 수 있다.
 *
 * ```ts
 * { preHandler: requireAuthAndNotSuspended }
 * ```
 */
export const requireAuthAndNotSuspended = [requireAuthHook, checkSuspendedHook] as const;

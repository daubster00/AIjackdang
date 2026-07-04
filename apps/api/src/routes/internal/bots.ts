/**
 * 내부 봇 자동 운영 트리거 라우트 — 스케줄 배선.
 *
 * apps/worker의 봇 프로세서(write/comment/refill-topics)가 이 엔드포인트들을 POST해
 * apps/api 경계 내부의 파이프라인을 실행한다. worker는 apps/api를 직접 import할 수
 * 없으므로(프로세스 경계) 커리큘럼 예약 게시(Story 13.6)와 동일한 HTTP 브리지 패턴을 쓴다.
 *
 * 보안:
 *  - x-internal-key 헤더가 INTERNAL_API_KEY env와 일치해야 실행.
 *  - INTERNAL_API_KEY env 미설정(빈 문자열 포함)이면 통과(dev 편의).
 *  - 이 라우트들은 공개 인터넷에 노출되지 않도록 인프라 레벨(Docker 네트워크·방화벽)에서
 *    내부 트래픽만 허용해야 한다.
 *
 * 게이트(킬 스위치·글/댓글 상한·비용 상한·관찰 모드)는 worker 프로세서가 호출 전에
 * checkBotGates로 확인한다. 여기서는 파이프라인만 실행한다.
 */

import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@ai-jakdang/database";
import { runPostPipeline } from "../../services/bot/post-pipeline.js";
import { runCommentPipeline } from "../../services/bot/comment-pipeline.js";
import { selectCommentTargetPost } from "../../services/bot/comment-target.js";
import { refillTopicsIfNeeded } from "../../services/bot/topic.js";

/**
 * x-internal-key 헤더를 검증한다.
 * INTERNAL_API_KEY 미설정 시 dev 편의로 통과. 불일치 시 403 응답 후 false.
 */
function assertInternalKey(request: FastifyRequest, reply: FastifyReply): boolean {
  const internalKey = process.env.INTERNAL_API_KEY;
  const requestKey = request.headers["x-internal-key"];
  if (internalKey && requestKey !== internalKey) {
    reply.code(403).send({ error: "Forbidden: invalid internal key" });
    return false;
  }
  return true;
}

export async function internalBotRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ── 글쓰기 트리거 ────────────────────────────────────────────────────────────
  r.post(
    "/internal/bots/write",
    {
      schema: {
        body: z.object({
          personaId: z.string().uuid(),
          board: z.string().min(1),
        }),
        response: {
          200: z.object({
            status: z.string(),
            postId: z.string().optional(),
            reason: z.string().optional(),
          }),
          403: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!assertInternalKey(request, reply)) return;
      const { personaId, board } = request.body;
      const result = await runPostPipeline({ personaId, board });
      return { status: result.status, postId: result.postId, reason: result.reason };
    },
  );

  // ── 댓글 트리거 ──────────────────────────────────────────────────────────────
  r.post(
    "/internal/bots/comment",
    {
      schema: {
        body: z.object({
          personaId: z.string().uuid(),
          targetBoard: z.string().min(1),
        }),
        response: {
          200: z.object({
            outcome: z.string(),
            commentId: z.string().optional(),
          }),
          403: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!assertInternalKey(request, reply)) return;
      const { personaId, targetBoard } = request.body;

      // 대상 게시글 선택 (실행 시점 결정)
      const targetPostId = await selectCommentTargetPost(personaId, targetBoard);
      if (!targetPostId) {
        // 댓글 달 적합한 게시글 없음 — 정상 skip
        return { outcome: "skipped" };
      }

      const result = await runCommentPipeline({ targetPostId, targetBoard });
      return { outcome: result.outcome, commentId: result.commentId };
    },
  );

  // ── 주제 풀 자동 보충 트리거 ──────────────────────────────────────────────────
  r.post(
    "/internal/bots/refill-topics",
    {
      schema: {
        response: {
          200: z.object({
            personas: z.number(),
            refilled: z.number(),
          }),
          403: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!assertInternalKey(request, reply)) return;
      const db = getDb();

      // 활성 페르소나 전체 순회 — refillTopicsIfNeeded 내부에서 auto-refill 설정·임계치 확인
      const personas = await db
        .select({ id: schema.botPersonas.id })
        .from(schema.botPersonas)
        .where(eq(schema.botPersonas.isActive, true));

      let refilled = 0;
      for (const p of personas) {
        try {
          refilled += await refillTopicsIfNeeded(db, p.id);
        } catch (err) {
          // 개별 페르소나 실패는 전체를 막지 않는다
          console.error(
            `[internal/refill-topics] persona=${p.id} 보충 실패 (무시):`,
            (err as Error).message,
          );
        }
      }

      return { personas: personas.length, refilled };
    },
  );
}

/**
 * /api/v1/inquiries 라우트 — Story 7.5
 *
 * GET    /inquiries         : 내 문의 목록 (인증 필수, 오프셋 페이지네이션)
 * POST   /inquiries         : 문의 작성 (인증 필수, 24h/5건 rate limit)
 * GET    /inquiries/:id     : 문의 상세+스레드 (인증 필수, 소유자만)
 *
 * ⚠️ v1/index.ts 수정 금지 — 메인 오케스트레이터가 등록 처리.
 *    이 파일은 inquiriesRoutes 함수만 export한다.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import {
  paginationQuerySchema,
  createInquirySchema,
  inquiryListItemSchema,
  inquirySchema,
  inquiryReplySchema,
  errorResponseSchema,
  paginationMetaSchema,
} from "@ai-jakdang/contracts";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { getInquiries, createInquiry, getInquiryThread } from "./service.js";

type RequestWithUser = FastifyRequest & { user: { id: string } };

export async function inquiriesRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /inquiries ───────────────────────────────────────────────────────────
  typed.get(
    "/",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "내 문의 목록 조회 (오프셋 페이지네이션)",
        tags: ["inquiries"],
        querystring: paginationQuerySchema,
        response: {
          200: z.object({
            items: z.array(inquiryListItemSchema),
            meta: paginationMetaSchema,
          }),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { page, pageSize } = request.query;

      const result = await getInquiries(user.id, { page, pageSize });
      return reply.send(result);
    },
  );

  // ── POST /inquiries ──────────────────────────────────────────────────────────
  typed.post(
    "/",
    {
      preHandler: [requireAuthHook],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 24 * 60 * 60 * 1000, // 24h in ms
          keyGenerator: (request: FastifyRequest) =>
            (request as RequestWithUser).user?.id ?? request.ip,
          errorResponseBuilder: (_request: FastifyRequest, context: { ttl: number }) => ({
            error: {
              code: "INQUIRY_RATE_LIMIT_EXCEEDED",
              message: `하루 최대 5건의 문의를 접수할 수 있습니다. ${Math.ceil(context.ttl / 1000)}초 후 다시 시도하세요.`,
            },
          }),
        },
      },
      schema: {
        description: "문의 작성 (24h/5건 rate limit)",
        tags: ["inquiries"],
        body: createInquirySchema,
        response: {
          201: z.object({
            id: z.string().uuid(),
            title: z.string(),
            status: z.enum(["pending", "in_progress", "resolved"]),
            createdAt: z.string().datetime({ offset: true }),
            updatedAt: z.string().datetime({ offset: true }),
          }),
          401: errorResponseSchema,
          422: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { title, body } = request.body;

      const row = await createInquiry(user.id, { title, body });
      return reply.code(201).send(row);
    },
  );

  // ── GET /inquiries/:id ───────────────────────────────────────────────────────
  typed.get(
    "/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "문의 상세+스레드 조회 (소유자 전용)",
        tags: ["inquiries"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({
            inquiry: inquirySchema,
            replies: z.array(inquiryReplySchema),
          }),
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { id } = request.params;

      const thread = await getInquiryThread(user.id, id);

      if (!thread) {
        return reply.code(404).send({
          error: {
            code: "NOT_FOUND",
            message: "문의를 찾을 수 없습니다.",
          },
        });
      }

      return reply.send(thread);
    },
  );
}

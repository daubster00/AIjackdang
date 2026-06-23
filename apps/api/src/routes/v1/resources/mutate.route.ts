/**
 * 실전자료 수정·삭제 라우트 — Story 4.8
 *
 * PATCH  /api/v1/resources/:id          — 수정 (인증 필수, 소유자만)
 * DELETE /api/v1/resources/:id          — 삭제 (인증 필수, 소유자만, soft-delete)
 * GET    /api/v1/me/resources           — 본인 자료 목록 (인증 필수, 마이페이지 탭용)
 *
 * routes.ts 집계자에 import 1줄 + register 1줄 추가 (Story 4.8 주석).
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { updateResourceSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import {
  updateResource,
  deleteResource,
  MutateServiceError,
} from "./mutate.service.js";

/** PATCH /api/v1/resources/:id 응답 스키마 */
const updateResourceResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  resourceType: z.string(),
  status: z.string(),
});

export async function registerResourceMutateRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── PATCH /resources/:id — 수정 ───────────────────────────────────────────
  typed.patch(
    "/resources/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "실전자료 수정. 인증 필수. 소유자만 가능(비소유자 403). " +
          "변경할 필드만 포함. 파일 교체 시 deleteFileIds로 기존 파일 soft-mark.",
        tags: ["resources"],
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          /** updateResourceSchema의 필드들 + 삭제할 파일 ID 목록 */
          resource: updateResourceSchema.optional(),
          /** 교체/삭제할 기존 파일 ID 목록 */
          deleteFileIds: z.array(z.string().uuid()).optional(),
        }),
        response: {
          200: updateResourceResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: resourceId } = request.params;
      const userId = (request as typeof request & { user: { id: string } }).user.id;
      const { resource: input = {}, deleteFileIds } = request.body;

      try {
        const result = await updateResource(resourceId, userId, input, deleteFileIds);
        return reply.code(200).send(result);
      } catch (err) {
        if (err instanceof MutateServiceError) {
          return reply.code(err.statusCode).send({
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  );

  // ── DELETE /resources/:id — 삭제 ─────────────────────────────────────────
  typed.delete(
    "/resources/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "실전자료 soft-delete. 인증 필수. 소유자만 가능(비소유자 403). " +
          "status=deleted + deleted_at 설정. 목록·상세에서 제외.",
        tags: ["resources"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          204: z.null(),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id: resourceId } = request.params;
      const userId = (request as typeof request & { user: { id: string } }).user.id;

      try {
        await deleteResource(resourceId, userId);
        return reply.code(204).send(null);
      } catch (err) {
        if (err instanceof MutateServiceError) {
          return reply.code(err.statusCode).send({
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  );
  // 참고: GET /me/resources 는 Story 4.9 me/resources.route.ts 가 단독 소유(중복 등록 방지).
}

/**
 * GET /api/v1/me/resources — 마이페이지 내 자료 목록 (Story 4.9)
 *
 * 인증 필수. 본인이 등록한 자료만 반환 (소유권 필수).
 * 상태: draft + published + hidden 포함, deleted 제외.
 * 응답: paginatedResponseSchema(myResourceCardSchema)
 */

import {
  myResourceCardSchema,
  listMyResourcesQuerySchema,
  paginatedResponseSchema,
  errorResponseSchema,
} from "@ai-jakdang/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { listMyResources } from "./resources.service.js";

/** request.user 타입 보조 */
type RequestWithUser = { user?: { id: string } };

function getSessionUserId(request: FastifyRequest): string {
  const u = (request as FastifyRequest & RequestWithUser).user;
  return u?.id ?? "";
}

export async function registerMeResourcesRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /me/resources — 내 자료 목록 (인증 필수) ────────────────────────────
  typed.get(
    "/me/resources",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "마이페이지 내 자료 목록. 인증된 사용자 본인이 등록한 자료를 반환한다. draft/published/hidden 포함, deleted 제외.",
        tags: ["me"],
        querystring: listMyResourcesQuerySchema,
        response: {
          200: paginatedResponseSchema(myResourceCardSchema),
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getSessionUserId(request);
      const result = await listMyResources(userId, request.query);
      return reply.code(200).send(result);
    },
  );
}

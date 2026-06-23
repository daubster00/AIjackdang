/**
 * 실전자료 다운로드 라우트 — Story 4.6
 *
 * POST /api/v1/resources/:id/download
 *   - 대표 파일(is_primary=true) presigned URL 반환 + download_count +1
 *   - 인증 필수(requireAuthHook → 401)
 *   - rate limit: 회원 1인 기준 분당 30건
 *
 * GET /api/v1/resources/:id/files/:fileId/download
 *   - 비대표 파일 presigned URL 반환 (download_count 미집계)
 *   - 인증 필수(requireAuthHook → 401)
 *   - rate limit: 회원 1인 기준 분당 30건
 *
 * 성공: 200 { url, expiresAt, fileName }
 * 실패:
 * - 401 UNAUTHORIZED: 미인증
 * - 404 RESOURCE_NOT_FOUND: 자료 없음
 * - 404 FILE_NOT_FOUND: 파일 없음
 * - 409 RESOURCE_SCAN_PENDING: 검사 중
 * - 403 RESOURCE_INFECTED: 감염 파일
 * - 503 RESOURCE_SCAN_ERROR: 검사 오류
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { downloadResponseSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import type { FastifyRequest } from "fastify";
import {
  downloadResource,
  downloadFile,
  DownloadBlockedError,
  ResourceNotFoundError,
  FileNotFoundError,
} from "./download.service.js";

/** rate limit key generator: 회원 기준으로 사용자 ID 우선, 없으면 IP */
function downloadKeyGenerator(request: FastifyRequest): string {
  const user = (request as FastifyRequest & { user?: { id: string } }).user;
  return user ? `download:user:${user.id}` : `download:ip:${request.ip}`;
}

export async function registerResourceDownloadRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── POST /resources/:id/download — 대표 파일 다운로드 ──────────────────────
  typed.post(
    "/resources/:id/download",
    {
      preHandler: [requireAuthHook],
      config: {
        // rate limit: 회원 1인 기준 분당 30건 (동일 파일 반복 다운로드 방지)
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: downloadKeyGenerator,
        },
      },
      schema: {
        description:
          "대표 파일 presigned 다운로드 URL 반환 + download_count +1. 인증 필수.",
        tags: ["resources"],
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: downloadResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const user = (request as FastifyRequest & { user: { id: string } }).user;

      try {
        const result = await downloadResource(id, user.id);
        return reply.code(200).send(result);
      } catch (err) {
        if (err instanceof ResourceNotFoundError) {
          return reply.code(404).send({
            error: { code: "RESOURCE_NOT_FOUND", message: err.message },
          });
        }
        if (err instanceof FileNotFoundError) {
          return reply.code(404).send({
            error: { code: "FILE_NOT_FOUND", message: err.message },
          });
        }
        if (err instanceof DownloadBlockedError) {
          return reply.code(err.statusCode).send({
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  );

  // ── GET /resources/:id/files/:fileId/download — 비대표 파일 다운로드 ────────
  typed.get(
    "/resources/:id/files/:fileId/download",
    {
      preHandler: [requireAuthHook],
      config: {
        // rate limit: 회원 1인 기준 분당 30건
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: downloadKeyGenerator,
        },
      },
      schema: {
        description:
          "비대표 파일 presigned 다운로드 URL 반환. download_count 미집계. 인증 필수.",
        tags: ["resources"],
        params: z.object({
          id: z.string().uuid(),
          fileId: z.string().uuid(),
        }),
        response: {
          200: downloadResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id, fileId } = request.params;
      const user = (request as FastifyRequest & { user: { id: string } }).user;

      try {
        const result = await downloadFile(id, fileId, user.id);
        return reply.code(200).send(result);
      } catch (err) {
        if (err instanceof FileNotFoundError) {
          return reply.code(404).send({
            error: { code: "FILE_NOT_FOUND", message: err.message },
          });
        }
        if (err instanceof DownloadBlockedError) {
          return reply.code(err.statusCode).send({
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  );
}

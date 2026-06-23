/**
 * 실전자료 등록 라우트 — Story 4.4
 *
 * POST /api/v1/resources          — 등록 (status=published)
 * POST /api/v1/resources/draft    — 임시저장 (status=draft)
 *
 * 인증 필수(401 if 미인증).
 * body: createResourceSchema (copyrightAgreed=true 강제).
 * 응답: 201 { id, slug, resourceType, status, pageType }
 *
 * 파일 업로드는 등록 성공 후 POST /api/v1/resources/:id/files (Story 4.5) 로 처리한다.
 * 이 라우트는 메타 + 본문 JSON 등록만 담당.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createResourceSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { createResource, getResourcePageType } from "./write.service.js";
import { userAuth } from "../../../auth/user-auth.js";

/** 등록 성공 응답 스키마 */
const createResourceResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  resourceType: z.string(),
  status: z.enum(["published", "draft"]),
  /** 성공 후 이동 URL 세그먼트: /resources/{pageType}/{slug} */
  pageType: z.string(),
});

export async function registerResourceWriteRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── POST /resources — 실전자료 등록(published) ───────────────────────────────
  typed.post(
    "/resources",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "실전자료 등록. 인증 필수. copyrightAgreed=true 필수. 성공 시 201 + { id, slug, resourceType, status, pageType } 반환.",
        tags: ["resources"],
        body: createResourceSchema,
        response: {
          201: createResourceResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // requireAuthHook 이 user를 request에 주입
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      const userId = session?.user?.id;
      if (!userId) {
        return reply.status(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      const result = await createResource({
        input: { ...request.body, status: "published" },
        userId,
      });

      return reply.status(201).send({
        ...result,
        pageType: getResourcePageType(result.resourceType),
      });
    },
  );

  // ── POST /resources/draft — 임시저장 ─────────────────────────────────────────
  // 임시저장: copyrightAgreed 검증을 완화해야 하므로 별도 스키마 사용
  const draftResourceSchema = createResourceSchema
    .omit({ copyrightAgreed: true })
    .extend({
      copyrightAgreed: z.boolean().optional(),
    })
    .partial({
      summary: true,
      descriptionJson: true,
      usageJson: true,
      difficulty: true,
      resourceType: true,
    });

  typed.post(
    "/resources/draft",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "실전자료 임시저장. 인증 필수. 필수 필드 일부 선택화. 성공 시 201 + { id, slug, resourceType, status } 반환.",
        tags: ["resources"],
        body: draftResourceSchema,
        response: {
          201: createResourceResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      const userId = session?.user?.id;
      if (!userId) {
        return reply.status(401).send({
          error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
        });
      }

      // draft 저장 시 누락 필드 기본값 처리
      const draftInput = {
        title: request.body.title ?? "임시저장",
        summary: request.body.summary ?? "",
        resourceType: request.body.resourceType ?? "prompt",
        environment: request.body.environment ?? [],
        difficulty: request.body.difficulty ?? "beginner",
        descriptionJson: request.body.descriptionJson ?? { type: "doc", content: [] },
        usageJson: request.body.usageJson ?? { type: "doc", content: [] },
        cautionJson: request.body.cautionJson,
        version: request.body.version,
        referenceLinks: request.body.referenceLinks,
        // draft 임시저장이므로 copyrightAgreed는 false 허용 — 실제 등록 시 true 강제
        copyrightAgreed: true as const, // DB 저장용 (draft 단계에서는 형식적 값)
        tags: request.body.tags ?? [],
        status: "draft" as const,
      };

      const result = await createResource({
        input: draftInput,
        userId,
      });

      return reply.status(201).send({
        ...result,
        pageType: getResourcePageType(result.resourceType),
      });
    },
  );
}

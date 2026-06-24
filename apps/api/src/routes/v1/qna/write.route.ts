/**
 * Story 3.3 — POST /api/v1/qna/questions 작성(+임시저장),
 *              GET  /api/v1/qna/questions/draft 본인 최신 draft 조회.
 *
 * Story 3.8 — PATCH 수정, Story 3.5 — PATCH resolve · DELETE (별도 에이전트 담당).
 * 이 파일엔 Story 3.3 핸들러만 추가한다.
 *
 * 인증 필수: requireAuthHook → 미인증 시 401.
 * questions 테이블에 INSERT (posts 테이블 절대 사용 금지).
 * slug: slugify(title)+generateUniqueSlug (questions.slug 대상 중복 체크).
 * 태그: taggable(target_type='question') INSERT.
 * 응답 201: { id, slug, status }.
 */

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createQuestionSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { userAuth } from "../../../auth/user-auth.js";
import { createQuestion, getDraftQuestion } from "./write.service.js";

/** POST /qna/questions 성공 응답 */
const createQuestionResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  status: z.enum(["published", "draft"]),
});

/** POST /qna/questions body에 status 추가 */
const createQuestionWithStatusSchema = createQuestionSchema.extend({
  /** 'published'(기본) 또는 'draft'(임시저장) */
  status: z.enum(["published", "draft"]).default("published"),
});

/** GET /qna/questions/draft 응답 */
const draftQuestionResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  contentJson: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()),
  slug: z.string(),
});

export async function registerQnaWriteRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // ── GET /qna/questions/draft — 본인 최신 draft 질문 조회 ─────────────────────
  // NOTE: 이 라우트를 :slug 파라미터 라우트보다 먼저 등록해야 "draft" 가 슬러그로 매칭되지 않는다.
  typed.get(
    "/qna/questions/draft",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "본인의 최신 임시저장 질문 1건 반환. 없으면 204 No Content. 인증 필수.",
        tags: ["qna"],
        response: {
          200: draftQuestionResponseSchema,
          204: z.null(),
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
        return reply
          .status(401)
          .send({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } });
      }

      const draft = await getDraftQuestion(userId);

      if (!draft) {
        return reply.status(204).send(null);
      }

      return reply.status(200).send(draft);
    },
  );

  // ── POST /qna/questions — 질문 작성 또는 임시저장 ───────────────────────────
  typed.post(
    "/qna/questions",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "질문 작성(status='published') 또는 임시저장(status='draft'). 인증 필수. 성공 시 201 + { id, slug, status } 반환.",
        tags: ["qna"],
        body: createQuestionWithStatusSchema,
        response: {
          201: createQuestionResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // requireAuthHook 이 통과했어도 userId 를 확실히 확보
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      const userId = session?.user?.id;
      if (!userId) {
        return reply
          .status(401)
          .send({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } });
      }

      const { title, contentJson, tags, status } = request.body;

      const result = await createQuestion({
        title,
        contentJson,
        tags,
        status,
        userId,
      });

      return reply.status(201).send(result);
    },
  );
}

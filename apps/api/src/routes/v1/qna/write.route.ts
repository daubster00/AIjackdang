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
import { createQuestionSchema, updateQuestionSchema, errorResponseSchema } from "@ai-jakdang/contracts";
import { requireAuthHook } from "../../../plugins/require-auth.js";
import { userAuth } from "../../../auth/user-auth.js";
import { getDb, schema } from "@ai-jakdang/database";
import { eq, and, isNull } from "drizzle-orm";
import { createQuestion, getDraftQuestion, updateQuestion } from "./write.service.js";

/** POST /qna/questions 성공 응답 */
const createQuestionResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  status: z.enum(["published", "draft"]),
});

/** PATCH /qna/questions/:id 성공 응답 */
const updateQuestionResponseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  updatedAt: z.string(),
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

  // ── PATCH /qna/questions/:id — 질문 수정 (Story 3.8) ────────────────────────
  typed.patch(
    "/qna/questions/:id",
    {
      preHandler: [requireAuthHook],
      schema: {
        description:
          "질문 제목·본문·태그를 수정한다. 인증 필수(401). 작성자 본인만 가능(403). slug는 불변(NFR-8). 성공 시 200 + { id, slug, updatedAt }.",
        tags: ["qna"],
        params: z.object({ id: z.string().uuid() }),
        body: updateQuestionSchema,
        response: {
          200: updateQuestionResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // ── 인증 필수 ────────────────────────────────────────────────────────────
      const session = await userAuth.api.getSession({
        headers: request.headers as unknown as Headers,
      });
      const userId = session?.user?.id;
      if (!userId) {
        return reply
          .status(401)
          .send({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } });
      }

      const { id } = request.params;
      const db = getDb();

      // ── 질문 존재 확인 ───────────────────────────────────────────────────────
      const [question] = await db
        .select({
          id: schema.questions.id,
          userId: schema.questions.userId,
          status: schema.questions.status,
          deletedAt: schema.questions.deletedAt,
        })
        .from(schema.questions)
        .where(
          and(
            eq(schema.questions.id, id),
            isNull(schema.questions.deletedAt),
          ),
        )
        .limit(1);

      if (!question || question.status === "deleted") {
        return reply.status(404).send({
          error: { code: "QUESTION_NOT_FOUND", message: "질문을 찾을 수 없습니다." },
        });
      }

      // ── 작성자 본인 확인 (403) ───────────────────────────────────────────────
      if (question.userId !== userId) {
        return reply.status(403).send({
          error: { code: "FORBIDDEN", message: "질문 작성자만 수정할 수 있습니다." },
        });
      }

      const { title, contentJson, tags } = request.body;

      const result = await updateQuestion({
        questionId: id,
        title,
        contentJson,
        tags,
      });

      return reply.status(200).send(result);
    },
  );
}

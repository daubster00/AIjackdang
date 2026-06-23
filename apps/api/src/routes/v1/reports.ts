/**
 * /api/v1/reports 라우트 — Story 5.8
 *
 * POST /api/v1/reports    신고 제출 (인증 필수)
 *   - reasonCode: spam | abuse | privacy | misinformation | other
 *   - other이면 detail 필수(서버 검증)
 *   - 동일 (reporter_id, target_type, target_id) 재신고 → 409 ALREADY_REPORTED
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { requireAuthHook } from "../../plugins/require-auth.js";

type RequestWithUser = FastifyRequest & { user: { id: string } };

const reportTargetTypeSchema = z.enum(["post", "question", "answer", "resource", "comment"]);
const reportReasonCodeSchema = z.enum(["spam", "abuse", "privacy", "misinformation", "other"]);

const createReportBodySchema = z
  .object({
    targetType: reportTargetTypeSchema,
    targetId: z.string().uuid(),
    reasonCode: reportReasonCodeSchema,
    detail: z.string().max(500).optional(),
  })
  .refine((d) => d.reasonCode !== "other" || (d.detail && d.detail.trim().length > 0), {
    message: "기타 사유 선택 시 상세 내용을 입력해주세요.",
    path: ["detail"],
  });

export async function reportsRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/reports",
    {
      preHandler: [requireAuthHook],
      schema: {
        description: "신고 제출",
        tags: ["reports"],
        body: createReportBodySchema,
        response: {
          201: z.object({ id: z.string().uuid(), status: z.literal("pending") }),
          409: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
        },
      },
    },
    async (request, reply) => {
      const { user } = request as RequestWithUser;
      const { targetType, targetId, reasonCode, detail } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: schema.reports.id })
        .from(schema.reports)
        .where(
          and(
            eq(schema.reports.reporterId, user.id),
            eq(schema.reports.targetType, targetType as "post" | "question" | "answer" | "resource" | "comment"),
            eq(schema.reports.targetId, targetId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({
          error: { code: "ALREADY_REPORTED", message: "이미 신고한 콘텐츠입니다." },
        });
      }

      const [row] = await db
        .insert(schema.reports)
        .values({
          reporterId: user.id,
          targetType: targetType as "post" | "question" | "answer" | "resource" | "comment",
          targetId,
          reasonCode,
          detail: detail ?? null,
          status: "pending",
        })
        .returning({ id: schema.reports.id });

      return reply.code(201).send({ id: row.id, status: "pending" });
    },
  );
}

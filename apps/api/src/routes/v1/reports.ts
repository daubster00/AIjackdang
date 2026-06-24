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
import { eq, and, count } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { requireAuthHook } from "../../plugins/require-auth.js";
import { getSiteSetting } from "../../lib/siteSettings.js";
import { deriveReportAction } from "@ai-jakdang/core";
import { posts, questions, answers, comments, resources } from "@ai-jakdang/database/schema";

type RequestWithUser = FastifyRequest & { user: { id: string } };

// ── 자동 숨김 대상 테이블 매핑 ────────────────────────────────────────────────
// message 타입은 hidden 상태를 지원하지 않으므로 제외

const AUTO_HIDE_TABLE_MAP = {
  post: posts,
  question: questions,
  answer: answers,
  comment: comments,
  resource: resources,
} as const;

type AutoHideTargetType = keyof typeof AUTO_HIDE_TABLE_MAP;

const reportTargetTypeSchema = z.enum([
  "post",
  "question",
  "answer",
  "resource",
  "comment",
  "message",
]);
type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;
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
            eq(schema.reports.targetType, targetType as ReportTargetType),
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
          targetType: targetType as ReportTargetType,
          targetId,
          reasonCode,
          detail: detail ?? null,
          status: "pending",
        })
        .returning({ id: schema.reports.id });

      // ── 자동 숨김 처리 (Story 9.11, AC #1) ─────────────────────────────────
      // auto_hide_enabled=true + auto_hide_threshold 설정 시에만 동작한다.
      // 기본값 false이므로 대부분의 경우 아래 블록은 실행되지 않는다.
      try {
        const autoHideEnabled = await getSiteSetting<boolean>("auto_hide_enabled");
        const autoHideThreshold = await getSiteSetting<number | null>("auto_hide_threshold");

        if (autoHideEnabled === true && autoHideThreshold !== null && autoHideThreshold > 0) {
          // 해당 대상에 대한 누적 신고 수 집계
          const [{ value: reportCount }] = await db
            .select({ value: count() })
            .from(schema.reports)
            .where(
              and(
                eq(schema.reports.targetType, targetType as ReportTargetType),
                eq(schema.reports.targetId, targetId),
              ),
            );

          const action = deriveReportAction(Number(reportCount), autoHideThreshold);

          if (action === "auto_hide" && targetType in AUTO_HIDE_TABLE_MAP) {
            const now = new Date();
            const table = AUTO_HIDE_TABLE_MAP[targetType as AutoHideTargetType];

            // 트랜잭션: 대상 status='hidden' + 이번 신고 auto_hidden=true 마킹
            await db.transaction(async (tx) => {
              // 대상 콘텐츠 숨김
              await tx
                .update(table)
                .set({ status: "hidden" as never, updatedAt: now } as never)
                .where(eq((table as typeof posts).id, targetId));

              // 방금 삽입된 신고에 auto_hidden=true 마킹
              await tx
                .update(schema.reports)
                .set({ autoHidden: true })
                .where(eq(schema.reports.id, row.id));
            });
          }
        }
      } catch (err) {
        // 자동 숨김 실패는 신고 접수 자체를 막지 않는다
        console.error("[reports] 자동 숨김 처리 실패 (무시):", (err as Error).message);
      }

      return reply.code(201).send({ id: row.id, status: "pending" });
    },
  );
}

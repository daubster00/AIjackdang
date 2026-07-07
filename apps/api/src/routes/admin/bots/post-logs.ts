/**
 * 봇 글 작성 로그 API — 운영 패널 "글 작성 로그" 섹션.
 *
 * GET /api/v1/admin/bots/post-logs          — 글 작성 시도 목록 (댓글 제외, 페이지네이션)
 * GET /api/v1/admin/bots/post-logs/:jobId   — 상세 (검수 시도 타임라인·실사용 모델·비용·최종 이벤트)
 *
 * 모든 라우트: requireSuperAdmin 전용.
 *
 * 데이터 소스 (신규 테이블 없음 — 기존 3테이블 join 재구성):
 *  - bot_generation_jobs: 작업 스파인 (상태·재생성 횟수·마지막 검열 결과·비용)
 *  - bot_activity_log: 시도별 이벤트 — 'regenerated' payload {attempt, censorResult}가 반려 사유.
 *    주의: post.published 이벤트만 refId=postId(payload.jobId), 나머지는 refId=jobId.
 *  - ai_usage_log: 호출 단위 (purpose별 실사용 모델·토큰·비용) — job_id로 join.
 *
 * 경로 주의: 기존 GET /admin/bots/:id 와 겹치지만 find-my-way는 static 세그먼트
 * ("post-logs")를 파라미터(:id)보다 우선 매칭하므로 안전하다.
 */

import type { FastifyInstance } from "fastify";
import { and, asc, count, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@ai-jakdang/database";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import { adminBotPostLogsQuerySchema } from "@ai-jakdang/contracts";
import type {
  BotPostLogAttempt,
  BotPostLogCensorItem,
  BotPostLogDetail,
  BotPostLogItem,
} from "@ai-jakdang/contracts";

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

/** 댓글·대댓글 잡은 "글 작성 로그"에서 제외한다. */
const EXCLUDED_JOB_KINDS = ["comment", "reply"] as const;

/** censorResult jsonb를 방어적으로 파싱해 {overall, items}로 정규화한다. */
export function parseCensorPayload(raw: unknown): {
  overall: "pass" | "fail" | "ambiguous" | null;
  items: BotPostLogCensorItem[];
} {
  if (!raw || typeof raw !== "object") return { overall: null, items: [] };
  const c = raw as Record<string, unknown>;
  const overall =
    c.overall === "pass" || c.overall === "fail" || c.overall === "ambiguous"
      ? c.overall
      : null;
  const items: BotPostLogCensorItem[] = Array.isArray(c.items)
    ? c.items.flatMap((it) => {
        if (!it || typeof it !== "object") return [];
        const item = it as Record<string, unknown>;
        const result =
          item.result === "pass" || item.result === "fail" || item.result === "ambiguous"
            ? item.result
            : null;
        if (typeof item.key !== "string" || result === null) return [];
        return [{ key: item.key, result, reason: typeof item.reason === "string" ? item.reason : "" }];
      })
    : [];
  return { overall, items };
}

/** posts.title → draft_content->>'title' → topic title_seed 우선순위로 표시 제목 결정. */
function resolveTitle(row: {
  postTitle: string | null;
  draftTitle: string | null;
  topicTitleSeed: string | null;
}): string | null {
  return row.postTitle ?? row.draftTitle ?? row.topicTitleSeed ?? null;
}

// ── 라우트 등록 ───────────────────────────────────────────────────────────────

export async function registerAdminBotPostLogsRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ── GET /api/v1/admin/bots/post-logs ─────────────────────────────────────────
  app.get(
    "/admin/bots/post-logs",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = adminBotPostLogsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "잘못된 쿼리 파라미터입니다.",
            details: parsed.error.flatten(),
          },
        });
      }

      const { personaId, status, page, pageSize } = parsed.data;
      const db = getDb();

      try {
        const conditions = [
          notInArray(schema.botGenerationJobs.jobKind, [...EXCLUDED_JOB_KINDS]),
        ];
        if (personaId) conditions.push(eq(schema.botGenerationJobs.personaId, personaId));
        if (status) conditions.push(eq(schema.botGenerationJobs.status, status));
        const whereClause = and(...conditions);

        const [countRow] = await db
          .select({ total: count() })
          .from(schema.botGenerationJobs)
          .where(whereClause);
        const totalItems = Number(countRow?.total ?? 0);

        const rows = await db
          .select({
            id: schema.botGenerationJobs.id,
            personaId: schema.botGenerationJobs.personaId,
            jobKind: schema.botGenerationJobs.jobKind,
            board: schema.botGenerationJobs.targetBoard,
            status: schema.botGenerationJobs.status,
            regenCount: schema.botGenerationJobs.regenCount,
            publishedPostId: schema.botGenerationJobs.publishedPostId,
            createdAt: schema.botGenerationJobs.createdAt,
            updatedAt: schema.botGenerationJobs.updatedAt,
            personaNickname: schema.botPersonas.nickname,
            topicTitleSeed: schema.botTopics.titleSeed,
            postTitle: schema.posts.title,
            // 전체 tiptap 문서 전송 회피 — SQL에서 top-level title만 추출
            draftTitle: sql<string | null>`${schema.botGenerationJobs.draftContent} ->> 'title'`,
          })
          .from(schema.botGenerationJobs)
          .leftJoin(
            schema.botPersonas,
            eq(schema.botGenerationJobs.personaId, schema.botPersonas.id),
          )
          .leftJoin(
            schema.botTopics,
            eq(schema.botGenerationJobs.topicId, schema.botTopics.id),
          )
          .leftJoin(
            schema.posts,
            eq(schema.botGenerationJobs.publishedPostId, schema.posts.id),
          )
          .where(whereClause)
          .orderBy(desc(schema.botGenerationJobs.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize);

        // 페이지 잡들의 실사용 생성 모델 배치 조회 (N+1 회피, job별 최신 1건)
        const jobIds = rows.map((r) => r.id);
        const genModelMap = new Map<string, string>();
        if (jobIds.length > 0) {
          const usageRows = await db
            .select({
              jobId: schema.aiUsageLog.jobId,
              model: schema.aiUsageLog.model,
            })
            .from(schema.aiUsageLog)
            .where(
              and(
                inArray(schema.aiUsageLog.jobId, jobIds),
                eq(schema.aiUsageLog.purpose, "generation"),
              ),
            )
            .orderBy(desc(schema.aiUsageLog.createdAt));
          for (const u of usageRows) {
            if (u.jobId && !genModelMap.has(u.jobId)) genModelMap.set(u.jobId, u.model);
          }
        }

        const items: BotPostLogItem[] = rows.map((r) => ({
          id: r.id,
          personaId: r.personaId,
          personaNickname: r.personaNickname ?? null,
          jobKind: r.jobKind,
          board: r.board ?? null,
          title: resolveTitle(r),
          status: r.status,
          genModel: genModelMap.get(r.id) ?? null,
          regenCount: r.regenCount,
          publishedPostId: r.publishedPostId ?? null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));

        return reply.send({
          items,
          meta: {
            page,
            pageSize,
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize),
          },
        });
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
        });
      }
    },
  );

  // ── GET /api/v1/admin/bots/post-logs/:jobId ──────────────────────────────────
  app.get(
    "/admin/bots/post-logs/:jobId",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 jobId입니다." },
        });
      }
      const db = getDb();

      try {
        const [row] = await db
          .select({
            id: schema.botGenerationJobs.id,
            personaId: schema.botGenerationJobs.personaId,
            jobKind: schema.botGenerationJobs.jobKind,
            board: schema.botGenerationJobs.targetBoard,
            status: schema.botGenerationJobs.status,
            regenCount: schema.botGenerationJobs.regenCount,
            publishedPostId: schema.botGenerationJobs.publishedPostId,
            censorResult: schema.botGenerationJobs.censorResult,
            createdAt: schema.botGenerationJobs.createdAt,
            updatedAt: schema.botGenerationJobs.updatedAt,
            personaNickname: schema.botPersonas.nickname,
            topicTitleSeed: schema.botTopics.titleSeed,
            postTitle: schema.posts.title,
            draftTitle: sql<string | null>`${schema.botGenerationJobs.draftContent} ->> 'title'`,
          })
          .from(schema.botGenerationJobs)
          .leftJoin(
            schema.botPersonas,
            eq(schema.botGenerationJobs.personaId, schema.botPersonas.id),
          )
          .leftJoin(
            schema.botTopics,
            eq(schema.botGenerationJobs.topicId, schema.botTopics.id),
          )
          .leftJoin(
            schema.posts,
            eq(schema.botGenerationJobs.publishedPostId, schema.posts.id),
          )
          .where(eq(schema.botGenerationJobs.id, jobId));

        if (!row) {
          return reply.status(404).send({
            error: { code: "NOT_FOUND", message: "해당 작업을 찾을 수 없습니다." },
          });
        }

        // 실사용 모델·비용 (ai_usage_log, 시간순)
        const usageRows = await db
          .select({
            purpose: schema.aiUsageLog.purpose,
            model: schema.aiUsageLog.model,
            costUsd: schema.aiUsageLog.costUsd,
          })
          .from(schema.aiUsageLog)
          .where(eq(schema.aiUsageLog.jobId, jobId))
          .orderBy(asc(schema.aiUsageLog.createdAt));

        const genModels: string[] = [];
        const censorModels: string[] = [];
        const usageCost = { generation: 0, censor: 0, image: 0, total: 0 };
        for (const u of usageRows) {
          const cost = Number(u.costUsd) || 0; // drizzle numeric → string
          usageCost.total += cost;
          if (u.purpose === "generation") {
            usageCost.generation += cost;
            if (!genModels.includes(u.model)) genModels.push(u.model);
          } else if (u.purpose === "censor") {
            usageCost.censor += cost;
            if (!censorModels.includes(u.model)) censorModels.push(u.model);
          } else if (u.purpose === "image") {
            usageCost.image += cost;
          }
        }

        // 활동 이벤트 — refId=jobId(대부분) + payload.jobId(post.published) 모두 커버
        const events = await db
          .select()
          .from(schema.botActivityLog)
          .where(
            or(
              eq(schema.botActivityLog.refId, jobId),
              sql`${schema.botActivityLog.payload} ->> 'jobId' = ${jobId}`,
            ),
          )
          .orderBy(asc(schema.botActivityLog.createdAt));

        // 검수 시도 타임라인: regenerated 이벤트 = 반려된 시도
        const attempts: BotPostLogAttempt[] = events
          .filter((e) => e.eventType === "regenerated")
          .map((e, i) => {
            const payload = (e.payload ?? {}) as Record<string, unknown>;
            const parsed = parseCensorPayload(payload.censorResult);
            return {
              attempt: typeof payload.attempt === "number" ? payload.attempt : i + 1,
              createdAt: e.createdAt.toISOString(),
              overall: parsed.overall,
              items: parsed.items,
            };
          });

        // 최종 이벤트 (held/blocked/discarded/post.published 중 마지막)
        const terminalTypes = new Set(["held", "blocked", "discarded", "post.published"]);
        const terminal = [...events].reverse().find((e) => terminalTypes.has(e.eventType));
        const finalEvent = terminal
          ? {
              eventType: terminal.eventType,
              reason:
                typeof (terminal.payload as Record<string, unknown> | null)?.reason === "string"
                  ? ((terminal.payload as Record<string, unknown>).reason as string)
                  : null,
              createdAt: terminal.createdAt.toISOString(),
            }
          : null;

        const detail: BotPostLogDetail = {
          id: row.id,
          personaId: row.personaId,
          personaNickname: row.personaNickname ?? null,
          jobKind: row.jobKind,
          board: row.board ?? null,
          title: resolveTitle(row),
          status: row.status,
          genModel: genModels.length > 0 ? genModels[genModels.length - 1]! : null,
          regenCount: row.regenCount,
          publishedPostId: row.publishedPostId ?? null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          topicTitleSeed: row.topicTitleSeed ?? null,
          censorModel: censorModels.length > 0 ? censorModels[censorModels.length - 1]! : null,
          genModels,
          censorModels,
          usageCost,
          attempts,
          lastCensorResult: row.censorResult ?? null,
          finalEvent,
        };

        return reply.send(detail);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
        });
      }
    },
  );
}

/**
 * 봇 보류 큐 목록 조회 + 통과/폐기 액션 API — Story 11.17 Task 3·4
 *
 * GET   /api/v1/admin/bots/hold-queue               — 보류 항목 목록 (미결정 위주)
 * PATCH /api/v1/admin/bots/hold-queue/:id/approve   — 보류 항목 통과 (게시 처리)
 * PATCH /api/v1/admin/bots/hold-queue/:id/discard   — 보류 항목 폐기
 *
 * 모든 라우트: requireSuperAdmin 전용 (ARCHITECTURE §10).
 *
 * 트랜잭션 경계 주의 (approve):
 *   createXxxAsBot() 호출은 내부에서 도메인 서비스를 거치므로 외부 트랜잭션에 포함하면
 *   중첩 트랜잭션이 된다. 호출 성공 후 bot_hold_queue + bot_activity_log만 트랜잭션으로 묶는다.
 *
 * 텔레그램 푸시 (Story 11.18):
 *   sendReportPush() 는 TELEGRAM_BOT_TOKEN 미설정 시 no-op stub. throw 금지.
 *
 * [Source: _bmad-output/implementation-artifacts/11-17-daily-report-api-hold-queue-actions.md]
 * [Source: docs/seeding-bot/ARCHITECTURE.md#10-관리자-대시보드]
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@ai-jakdang/database";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import { tiptapJsonToHtml } from "../../../lib/tiptap-renderer.js";
import {
  adminBotHoldQueueQuerySchema,
} from "@ai-jakdang/contracts";
import type { BotDailyReport } from "@ai-jakdang/contracts";
import {
  createPostAsBot,
  createCommentAsBot,
  createReplyAsBot,
  createQuestionAsBot,
  createResourceAsBot,
} from "../../../services/bot/write.js";
import type {
  CreatePostAsBotInput,
  CreateCommentAsBotInput,
  CreateReplyAsBotInput,
  CreateQuestionAsBotInput,
  CreateResourceAsBotInput,
} from "../../../services/bot/write.js";

// ── 텔레그램 푸시 stub (Story 11.18 구현 예정) ────────────────────────────────

/**
 * 일일 리포트 텔레그램 푸시 stub.
 *
 * TELEGRAM_BOT_TOKEN(또는 bot_settings.bot_push_channel) 미설정 시 no-op + 로그만.
 * Story 11.18에서 실제 전송 로직으로 교체된다. throw 금지.
 *
 * [Source: Story 11.17 ★ 텔레그램 제외 원칙]
 */
export async function sendReportPush(report: BotDailyReport): Promise<void> {
  const hasTelegramEnv = !!(
    process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_PUSH_CHANNEL
  );
  if (!hasTelegramEnv) {
    console.info(
      "[bot-report] TELEGRAM 채널 미설정 — 텔레그램 푸시 skip (Story 11.18 구현 예정)",
    );
    return;
  }
  // Story 11.18에서 실제 전송 구현
  console.info(
    "[bot-report] 텔레그램 푸시 stub (미구현 — Story 11.18 예정):",
    { date: report.date, status: report.status },
  );
}

// ── draft_content 파싱 스키마 ─────────────────────────────────────────────────

/** post 잡 초안 구조 (11.9 글 생성 파이프라인이 저장하는 형태) */
const postDraftSchema = z.object({
  board: z.string().min(1),
  title: z.string().min(1),
  contentJson: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()).optional(),
  creativeSpec: z.unknown().optional(),
  recruitPost: z.unknown().optional(),
});

/** comment / reply 잡 초안 구조 */
const commentDraftSchema = z.object({
  targetType: z.enum(["post", "question", "answer", "resource", "comment"]),
  targetId: z.string().min(1),
  content: z.string().min(1),
  parentId: z.string().optional(),
});

/** question 잡 초안 구조 */
const questionDraftSchema = z.object({
  title: z.string().min(1),
  contentJson: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()).optional(),
  status: z.enum(["published", "draft"]).optional(),
});

/** resource 잡 초안 구조 */
const resourceDraftSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  resourceType: z.enum([
    "prompt",
    "claude-code-skill",
    "mcp",
    "rules-config",
    "template-checklist",
  ]),
  environment: z.array(z.string()),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  descriptionJson: z.record(z.string(), z.unknown()),
  usageJson: z.record(z.string(), z.unknown()),
  cautionJson: z.record(z.string(), z.unknown()).optional(),
  version: z.string().optional(),
  referenceLinks: z
    .array(z.object({ label: z.string(), url: z.string() }))
    .optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["published", "draft"]).optional(),
});

// ── Tiptap 본문 텍스트 추출 (미리보기용) ──────────────────────────────────────

type TiptapNode = { type?: string; text?: string; content?: TiptapNode[] };

function extractTiptapText(node: TiptapNode): string {
  if (!node || typeof node !== "object") return "";
  const parts: string[] = [];
  if (node.type === "text" && typeof node.text === "string") parts.push(node.text);
  if (Array.isArray(node.content)) {
    for (const child of node.content) parts.push(extractTiptapText(child));
  }
  return parts.join(" ");
}

/**
 * draftContent가 봉투(envelope) 형태가 아니라 Tiptap 본문 문서 그대로인지 판별.
 * (봇 파이프라인은 held 시 draft_content에 Tiptap 문서만 저장한다 — post-pipeline.ts)
 */
function isBareTiptapDoc(v: unknown): v is TiptapNode {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  if ("board" in d || "title" in d || "contentJson" in d || "descriptionJson" in d) {
    return false; // 이미 봉투 형태
  }
  return d.type === "doc" || Array.isArray(d.content);
}

// ── 초안 미리보기 추출 ────────────────────────────────────────────────────────

function extractDraftPreview(draftContent: unknown): string | null {
  if (!draftContent || typeof draftContent !== "object") return null;
  const d = draftContent as Record<string, unknown>;
  if (typeof d.title === "string") return d.title.slice(0, 200);
  if (typeof d.content === "string") return d.content.slice(0, 200);
  if (typeof d.text === "string") return d.text.slice(0, 200); // 댓글 초안 { text }
  // Tiptap 본문 문서 그대로 저장된 경우 — 본문 텍스트에서 추출
  if (isBareTiptapDoc(draftContent)) {
    const text = extractTiptapText(draftContent).trim();
    return text ? text.slice(0, 200) : null;
  }
  return null;
}

// ── 상세 조회용: 제목·본문 HTML 해석 ──────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 평문 텍스트(줄바꿈 구분)를 문단 HTML로 감싼다 — 댓글/대댓글 초안용. */
function plainTextToHtml(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

/** Tiptap 문서(또는 봉투)에서 제목을 유도 — 첫 문단 텍스트 앞부분(최대 45자). */
function deriveTitleFromDoc(draftContent: unknown): string | null {
  let node: unknown = draftContent;
  if (draftContent && typeof draftContent === "object") {
    const d = draftContent as Record<string, unknown>;
    if (d.contentJson && typeof d.contentJson === "object") node = d.contentJson;
  }
  if (!node || typeof node !== "object") return null;
  const text = extractTiptapText(node as TiptapNode).trim();
  if (!text) return null;
  const firstLine = text.split(/\s{2,}|\n+/)[0]?.trim() ?? text;
  const t = firstLine.replace(/^[#>\-*\s]+/, "").trim();
  if (!t) return null;
  return t.length > 45 ? `${t.slice(0, 45)}…` : t;
}

/**
 * 초안 제목 해석(상세 화면용) — 항상 비어있지 않은 제목을 보장한다.
 * 봉투 title → 주제 씨앗 → 본문 유도 → 최후 문구.
 */
function resolveDraftTitle(
  draftContent: unknown,
  titleSeed: string | null,
): string {
  if (draftContent && typeof draftContent === "object") {
    const d = draftContent as Record<string, unknown>;
    if (typeof d.title === "string" && d.title.trim()) return d.title.trim();
  }
  return (
    titleSeed?.trim() ||
    deriveTitleFromDoc(draftContent) ||
    "제목 없는 글"
  );
}

/**
 * 초안 본문을 렌더 가능한 HTML로 변환한다(이미지·유튜브 영상 포함).
 * - 댓글/대댓글: { content | text } 평문 → 문단 HTML
 * - 봉투(envelope): contentJson(post/question) 또는 descriptionJson(resource) Tiptap → HTML
 * - bare Tiptap 문서: 그대로 HTML 변환
 */
function resolveDraftBodyHtml(draftContent: unknown): string {
  if (!draftContent || typeof draftContent !== "object") return "";
  const d = draftContent as Record<string, unknown>;

  // 댓글/대댓글 초안 — 평문
  if (typeof d.content === "string") return plainTextToHtml(d.content);
  if (typeof d.text === "string") return plainTextToHtml(d.text);

  // 봉투 형태 — Tiptap 본문 필드 우선
  if (d.contentJson && typeof d.contentJson === "object") {
    return tiptapJsonToHtml(d.contentJson);
  }
  if (d.descriptionJson && typeof d.descriptionJson === "object") {
    return tiptapJsonToHtml(d.descriptionJson);
  }

  // bare Tiptap 본문 문서 그대로 저장된 경우
  if (isBareTiptapDoc(draftContent)) {
    return tiptapJsonToHtml(draftContent);
  }
  return "";
}

/** censor_result(jsonb)에서 통과하지 못한 항목만 추려 반환. */
function extractCensorFindings(
  censorResult: unknown,
): { key: string; result: string; reason: string | null }[] {
  if (!censorResult || typeof censorResult !== "object") return [];
  const items = (censorResult as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  return items
    .filter(
      (it): it is Record<string, unknown> =>
        !!it && typeof it === "object" && (it as Record<string, unknown>).result !== "pass",
    )
    .map((it) => ({
      key: String(it.key ?? ""),
      result: String(it.result ?? ""),
      reason: typeof it.reason === "string" ? it.reason : null,
    }));
}

/**
 * draftContent를 job_kind별 봉투(envelope) 형태로 정규화한다.
 *
 * 봇 파이프라인은 held 시 draft_content에 Tiptap 본문 문서만 저장하므로,
 * 통과(approve) 시 postDraftSchema 등 봉투 스키마와 형태가 맞지 않아 항상 검증 실패한다.
 * 이미 봉투 형태면 그대로 반환하고, Tiptap 본문 문서면 잡 메타(게시판·제목 씨앗)로 감싼다.
 *
 * @param board     - bot_generation_jobs.targetBoard (post/resource 게시판 슬러그)
 * @param titleSeed - 연결된 bot_topics.titleSeed (제목 씨앗, 없으면 대체 문구)
 */
function normalizeDraftToEnvelope(
  jobKind: string,
  draftContent: unknown,
  ctx: { board: string | null; titleSeed: string | null; targetPostId: string | null },
): unknown {
  // ── 댓글·대댓글: 파이프라인은 draft_content에 { text } 만 저장 ─────────────────
  if (jobKind === "comment" || jobKind === "reply") {
    const d =
      draftContent && typeof draftContent === "object"
        ? (draftContent as Record<string, unknown>)
        : {};
    if (typeof d.content === "string") return draftContent; // 이미 봉투 형태
    if (typeof d.text === "string" && ctx.targetPostId) {
      return { targetType: "post", targetId: ctx.targetPostId, content: d.text };
    }
    return draftContent; // 형태 불명 — 원본 유지(하위 파싱에서 422 처리)
  }

  // ── 본문 문서(doc)·제목·게시판 추출 ────────────────────────────────────────
  // 신형 봉투 { board?, title, contentJson } 와 구형 bare Tiptap 문서를 모두 지원한다.
  let doc: Record<string, unknown>;
  let envTitle: string | null = null;
  let envBoard: string | null = null;
  if (
    draftContent &&
    typeof draftContent === "object" &&
    typeof (draftContent as Record<string, unknown>).contentJson === "object" &&
    (draftContent as Record<string, unknown>).contentJson !== null
  ) {
    const d = draftContent as Record<string, unknown>;
    doc = d.contentJson as Record<string, unknown>;
    if (typeof d.title === "string" && d.title.trim()) envTitle = d.title.trim();
    if (typeof d.board === "string" && d.board.trim()) envBoard = d.board.trim();
    // post 봉투가 이미 완전하면(게시판·제목 존재) 그대로 통과시킨다.
    if (jobKind === "post" && envBoard && envTitle) return draftContent;
  } else if (isBareTiptapDoc(draftContent)) {
    doc = draftContent as Record<string, unknown>;
  } else {
    return draftContent; // 형태 불명 — 원본 유지(하위 파싱에서 422 처리)
  }

  // 제목은 항상 비어있지 않게 보장: 봉투 제목 → 주제 씨앗 → 본문 유도 → 최후 문구.
  const title =
    envTitle ||
    ctx.titleSeed?.trim() ||
    deriveTitleFromDoc(doc) ||
    "제목 없는 글";

  if (jobKind === "question") {
    return { title, contentJson: doc, tags: [], status: "published" };
  }
  if (jobKind === "resource") {
    const board = envBoard ?? ctx.board ?? "";
    const rawType = board.startsWith("resource:")
      ? board.slice("resource:".length)
      : "prompt";
    const resourceType = [
      "prompt",
      "claude-code-skill",
      "mcp",
      "rules-config",
      "template-checklist",
    ].includes(rawType)
      ? rawType
      : "prompt";
    return {
      title,
      summary: title,
      resourceType,
      environment: [],
      difficulty: "beginner",
      descriptionJson: doc,
      usageJson: { type: "doc", content: [] },
      tags: [],
      status: "published",
    };
  }
  // post (기본)
  return {
    board: envBoard ?? ctx.board ?? "",
    title,
    contentJson: doc,
    tags: [],
    status: "published",
  };
}

// ── 라우트 등록 ───────────────────────────────────────────────────────────────

export async function registerAdminBotHoldQueueActionRoutes(
  app: FastifyInstance,
): Promise<void> {
  // ── GET /api/v1/admin/bots/hold-queue ───────────────────────────────────────
  //    보류 큐 목록 (페이지네이션 + reason/decided 필터)
  app.get(
    "/admin/bots/hold-queue",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = adminBotHoldQueueQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "잘못된 쿼리 파라미터입니다.",
            details: parsed.error.flatten(),
          },
        });
      }

      const { reason, decided, page, pageSize } = parsed.data;
      const db = getDb();

      try {
        // where 조건 구성
        const conditions = [];
        if (reason !== undefined) {
          conditions.push(eq(schema.botHoldQueue.reason, reason));
        }
        if (decided !== undefined) {
          conditions.push(eq(schema.botHoldQueue.decided, decided));
        }
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // 총 개수
        const [countResult] = await db
          .select({ total: count() })
          .from(schema.botHoldQueue)
          .where(whereClause);
        const totalItems = Number(countResult?.total ?? 0);

        // 목록 (joined)
        const offset = (page - 1) * pageSize;
        const rows = await db
          .select({
            id: schema.botHoldQueue.id,
            jobId: schema.botHoldQueue.jobId,
            reason: schema.botHoldQueue.reason,
            decided: schema.botHoldQueue.decided,
            decision: schema.botHoldQueue.decision,
            decidedAt: schema.botHoldQueue.decidedAt,
            decidedBy: schema.botHoldQueue.decidedBy,
            draftContent: schema.botGenerationJobs.draftContent,
            personaNickname: schema.botPersonas.nickname,
            createdAt: schema.botHoldQueue.createdAt,
          })
          .from(schema.botHoldQueue)
          .innerJoin(
            schema.botGenerationJobs,
            eq(schema.botHoldQueue.jobId, schema.botGenerationJobs.id),
          )
          .innerJoin(
            schema.botPersonas,
            eq(schema.botGenerationJobs.personaId, schema.botPersonas.id),
          )
          .where(whereClause)
          .orderBy(desc(schema.botHoldQueue.createdAt))
          .limit(pageSize)
          .offset(offset);

        const items = rows.map((r) => ({
          id: r.id,
          jobId: r.jobId,
          reason: r.reason,
          decided: r.decided,
          decision: r.decision ?? null,
          decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
          decidedBy: r.decidedBy ?? null,
          draftPreview: extractDraftPreview(r.draftContent),
          personaNickname: r.personaNickname ?? null,
          createdAt: r.createdAt.toISOString(),
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
        request.log.error(err, "[bot-hold-queue] 목록 조회 실패");
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
        });
      }
    },
  );

  // ── GET /api/v1/admin/bots/hold-queue/:id ───────────────────────────────────
  //    보류 항목 상세: 제목 + 전체 본문 HTML(이미지·영상 포함) + 검수 결과.
  //    관리자가 통과/폐기 판단 전 봇이 쓴 글 전문을 확인하기 위한 용도.
  app.get(
    "/admin/bots/hold-queue/:id",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const db = getDb();

      try {
        const [row] = await db
          .select({
            id: schema.botHoldQueue.id,
            jobId: schema.botHoldQueue.jobId,
            reason: schema.botHoldQueue.reason,
            decided: schema.botHoldQueue.decided,
            decision: schema.botHoldQueue.decision,
            createdAt: schema.botHoldQueue.createdAt,
            jobKind: schema.botGenerationJobs.jobKind,
            targetBoard: schema.botGenerationJobs.targetBoard,
            draftContent: schema.botGenerationJobs.draftContent,
            censorResult: schema.botGenerationJobs.censorResult,
            regenCount: schema.botGenerationJobs.regenCount,
            topicTitleSeed: schema.botTopics.titleSeed,
            personaNickname: schema.botPersonas.nickname,
          })
          .from(schema.botHoldQueue)
          .innerJoin(
            schema.botGenerationJobs,
            eq(schema.botHoldQueue.jobId, schema.botGenerationJobs.id),
          )
          .innerJoin(
            schema.botPersonas,
            eq(schema.botGenerationJobs.personaId, schema.botPersonas.id),
          )
          .leftJoin(
            schema.botTopics,
            eq(schema.botGenerationJobs.topicId, schema.botTopics.id),
          )
          .where(eq(schema.botHoldQueue.id, id))
          .limit(1);

        if (!row) {
          return reply.status(404).send({
            error: { code: "NOT_FOUND", message: "해당 보류 항목을 찾을 수 없습니다." },
          });
        }

        // 검수 모델: ai_usage_log에서 purpose='censor' 최신 모델 (호출 실패 시 없음)
        const usageRows = await db
          .select({
            purpose: schema.aiUsageLog.purpose,
            provider: schema.aiUsageLog.provider,
            model: schema.aiUsageLog.model,
          })
          .from(schema.aiUsageLog)
          .where(eq(schema.aiUsageLog.jobId, row.jobId))
          .orderBy(asc(schema.aiUsageLog.createdAt));

        let censorModel: string | null = null;
        let genModel: string | null = null;
        for (const u of usageRows) {
          if (u.purpose === "censor") censorModel = `${u.provider}/${u.model}`;
          if (u.purpose === "generation") genModel = `${u.provider}/${u.model}`;
        }

        return reply.send({
          id: row.id,
          jobId: row.jobId,
          reason: row.reason,
          decided: row.decided,
          decision: row.decision ?? null,
          jobKind: row.jobKind,
          board: row.targetBoard ?? null,
          personaNickname: row.personaNickname ?? null,
          regenCount: row.regenCount ?? 0,
          createdAt: row.createdAt.toISOString(),
          title: resolveDraftTitle(row.draftContent, row.topicTitleSeed),
          bodyHtml: resolveDraftBodyHtml(row.draftContent),
          genModel,
          censorModel,
          censorFindings: extractCensorFindings(row.censorResult),
        });
      } catch (err) {
        request.log.error(err, "[bot-hold-queue] 상세 조회 실패");
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
        });
      }
    },
  );

  // ── PATCH /api/v1/admin/bots/hold-queue/:id/approve ─────────────────────────
  //    보류 항목 통과: job_kind에 따라 5종 작성 함수 분기 → 게시 → hold_queue 업데이트
  app.patch(
    "/admin/bots/hold-queue/:id/approve",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const adminId = request.adminSession?.adminUserId;
      if (!adminId) {
        return reply.status(401).send({
          error: { code: "ADMIN_UNAUTHORIZED", message: "관리자 인증이 필요합니다." },
        });
      }

      const db = getDb();

      try {
        // ── 보류 항목 + 잡 + 페르소나 단건 조회 (결정 안 된 항목만) ─────────────
        const [holdWithJob] = await db
          .select({
            holdId: schema.botHoldQueue.id,
            holdJobId: schema.botHoldQueue.jobId,
            holdReason: schema.botHoldQueue.reason,
            jobKind: schema.botGenerationJobs.jobKind,
            draftContent: schema.botGenerationJobs.draftContent,
            targetBoard: schema.botGenerationJobs.targetBoard,
            targetPostId: schema.botGenerationJobs.targetPostId,
            topicTitleSeed: schema.botTopics.titleSeed,
            personaId: schema.botGenerationJobs.personaId,
            personaUserId: schema.botPersonas.userId,
            personaNickname: schema.botPersonas.nickname,
          })
          .from(schema.botHoldQueue)
          .innerJoin(
            schema.botGenerationJobs,
            eq(schema.botHoldQueue.jobId, schema.botGenerationJobs.id),
          )
          .innerJoin(
            schema.botPersonas,
            eq(schema.botGenerationJobs.personaId, schema.botPersonas.id),
          )
          .leftJoin(
            schema.botTopics,
            eq(schema.botGenerationJobs.topicId, schema.botTopics.id),
          )
          .where(
            and(
              eq(schema.botHoldQueue.id, id),
              eq(schema.botHoldQueue.decided, false),
            ),
          )
          .limit(1);

        if (!holdWithJob) {
          return reply.status(404).send({
            error: {
              code: "NOT_FOUND",
              message: "해당 보류 항목을 찾을 수 없거나 이미 결정되었습니다.",
            },
          });
        }

        const botUserId = holdWithJob.personaUserId;
        if (!botUserId) {
          return reply.status(422).send({
            error: {
              code: "INVALID_DRAFT_CONTENT",
              message: "봇 계정(userId)이 페르소나에 연결되어 있지 않습니다.",
            },
          });
        }

        // ── draft_content 역직렬화 (job_kind별 방어적 파싱) ─────────────────────
        // 봇 파이프라인은 held 시 draft_content에 Tiptap 본문 문서만 저장하므로,
        // 잡 메타(게시판·제목 씨앗)로 봉투(envelope) 형태로 정규화한 뒤 파싱한다.
        const jobKind = holdWithJob.jobKind;
        const draftContent = normalizeDraftToEnvelope(
          jobKind,
          holdWithJob.draftContent,
          {
            board: holdWithJob.targetBoard,
            titleSeed: holdWithJob.topicTitleSeed,
            targetPostId: holdWithJob.targetPostId,
          },
        );

        // ── job_kind별 작성 함수 분기 ───────────────────────────────────────────
        let writeResult: { status: "published" | "blocked"; refId?: string };

        if (jobKind === "post") {
          const parsedDraft = postDraftSchema.safeParse(draftContent);
          if (!parsedDraft.success) {
            return reply.status(422).send({
              error: {
                code: "INVALID_DRAFT_CONTENT",
                message: "post 초안 내용이 유효하지 않습니다.",
                details: parsedDraft.error.flatten(),
              },
            });
          }
          const input: CreatePostAsBotInput = {
            botUserId,
            personaId: holdWithJob.personaId,
            jobId: holdWithJob.holdJobId,
            postInput: {
              board: parsedDraft.data.board,
              title: parsedDraft.data.title,
              contentJson: parsedDraft.data.contentJson,
              tags: parsedDraft.data.tags ?? [],
              status: "published",
            },
          };
          writeResult = await createPostAsBot(input);
        } else if (jobKind === "comment") {
          const parsedDraft = commentDraftSchema.safeParse(draftContent);
          if (!parsedDraft.success) {
            return reply.status(422).send({
              error: {
                code: "INVALID_DRAFT_CONTENT",
                message: "comment 초안 내용이 유효하지 않습니다.",
                details: parsedDraft.error.flatten(),
              },
            });
          }
          const input: CreateCommentAsBotInput = {
            botUserId,
            personaId: holdWithJob.personaId,
            jobId: holdWithJob.holdJobId,
            targetType: parsedDraft.data.targetType,
            targetId: parsedDraft.data.targetId,
            content: parsedDraft.data.content,
          };
          writeResult = await createCommentAsBot(input);
        } else if (jobKind === "reply") {
          const parsedDraft = commentDraftSchema.safeParse(draftContent);
          if (!parsedDraft.success) {
            return reply.status(422).send({
              error: {
                code: "INVALID_DRAFT_CONTENT",
                message: "reply 초안 내용이 유효하지 않습니다.",
                details: parsedDraft.error.flatten(),
              },
            });
          }
          const parentId = parsedDraft.data.parentId;
          if (!parentId) {
            return reply.status(422).send({
              error: {
                code: "INVALID_DRAFT_CONTENT",
                message: "reply 잡에 parentId가 없습니다.",
              },
            });
          }
          const input: CreateReplyAsBotInput = {
            botUserId,
            personaId: holdWithJob.personaId,
            jobId: holdWithJob.holdJobId,
            targetType: parsedDraft.data.targetType,
            targetId: parsedDraft.data.targetId,
            content: parsedDraft.data.content,
            parentId,
          };
          writeResult = await createReplyAsBot(input);
        } else if (jobKind === "question") {
          const parsedDraft = questionDraftSchema.safeParse(draftContent);
          if (!parsedDraft.success) {
            return reply.status(422).send({
              error: {
                code: "INVALID_DRAFT_CONTENT",
                message: "question 초안 내용이 유효하지 않습니다.",
                details: parsedDraft.error.flatten(),
              },
            });
          }
          const input: CreateQuestionAsBotInput = {
            botUserId,
            personaId: holdWithJob.personaId,
            jobId: holdWithJob.holdJobId,
            questionInput: {
              title: parsedDraft.data.title,
              contentJson: parsedDraft.data.contentJson,
              tags: parsedDraft.data.tags,
              status: parsedDraft.data.status ?? "published",
            },
          };
          writeResult = await createQuestionAsBot(input);
        } else if (jobKind === "resource") {
          const parsedDraft = resourceDraftSchema.safeParse(draftContent);
          if (!parsedDraft.success) {
            return reply.status(422).send({
              error: {
                code: "INVALID_DRAFT_CONTENT",
                message: "resource 초안 내용이 유효하지 않습니다.",
                details: parsedDraft.error.flatten(),
              },
            });
          }
          const input: CreateResourceAsBotInput = {
            botUserId,
            personaId: holdWithJob.personaId,
            jobId: holdWithJob.holdJobId,
            resourceInput: {
              title: parsedDraft.data.title,
              summary: parsedDraft.data.summary,
              resourceType: parsedDraft.data.resourceType,
              environment: parsedDraft.data.environment,
              difficulty: parsedDraft.data.difficulty,
              descriptionJson: parsedDraft.data.descriptionJson,
              usageJson: parsedDraft.data.usageJson,
              cautionJson: parsedDraft.data.cautionJson,
              version: parsedDraft.data.version,
              referenceLinks: parsedDraft.data.referenceLinks,
              tags: parsedDraft.data.tags,
              status: parsedDraft.data.status ?? "published",
            },
          };
          writeResult = await createResourceAsBot(input);
        } else {
          return reply.status(422).send({
            error: {
              code: "INVALID_DRAFT_CONTENT",
              message: `지원하지 않는 job_kind: ${jobKind}`,
            },
          });
        }

        // ── ContentGuard 차단 시 — hold_queue decided=false 유지 ──────────────
        if (writeResult.status === "blocked") {
          return reply.status(422).send({
            error: {
              code: "CONTENT_BLOCKED",
              message:
                "콘텐츠 가드에 의해 차단되었습니다. 초안을 수정한 후 재판단하세요.",
            },
          });
        }

        // ── 게시 성공 — hold_queue 업데이트 + activity_log 추가 (트랜잭션) ──────
        // createXxxAsBot()는 이미 완료됐으므로 hold_queue + activity_log만 묶는다.
        const refId = writeResult.refId!;
        const isCommentKind = jobKind === "comment" || jobKind === "reply";
        const eventType = isCommentKind ? "comment.published" : "post.published";

        await db.transaction(async (tx) => {
          // bot_hold_queue 업데이트
          await tx
            .update(schema.botHoldQueue)
            .set({
              decided: true,
              decision: "approved",
              decidedAt: new Date(),
              decidedBy: adminId,
            })
            .where(eq(schema.botHoldQueue.id, id));

          // bot_activity_log — 관리자 승인 맥락 추가 기록
          await tx.insert(schema.botActivityLog).values({
            personaId: holdWithJob.personaId,
            eventType,
            refId,
            payload: {
              kind: jobKind,
              decidedBy: adminId,
              holdQueueId: id,
              adminApproval: true,
            },
          });
        });

        return reply.send({ status: "approved", refId });
      } catch (err) {
        request.log.error(err, "[bot-hold-queue] approve 처리 실패");
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
        });
      }
    },
  );

  // ── PATCH /api/v1/admin/bots/hold-queue/:id/discard ─────────────────────────
  //    보류 항목 폐기: 게시 없이 job.status='discarded' + hold_queue 결정 기록
  app.patch(
    "/admin/bots/hold-queue/:id/discard",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const adminId = request.adminSession?.adminUserId;
      if (!adminId) {
        return reply.status(401).send({
          error: { code: "ADMIN_UNAUTHORIZED", message: "관리자 인증이 필요합니다." },
        });
      }

      const db = getDb();

      try {
        // ── 보류 항목 + 잡 단건 조회 (결정 안 된 항목만) ─────────────────────────
        const [holdWithJob] = await db
          .select({
            holdId: schema.botHoldQueue.id,
            holdJobId: schema.botHoldQueue.jobId,
            holdReason: schema.botHoldQueue.reason,
            personaId: schema.botGenerationJobs.personaId,
          })
          .from(schema.botHoldQueue)
          .innerJoin(
            schema.botGenerationJobs,
            eq(schema.botHoldQueue.jobId, schema.botGenerationJobs.id),
          )
          .where(
            and(
              eq(schema.botHoldQueue.id, id),
              eq(schema.botHoldQueue.decided, false),
            ),
          )
          .limit(1);

        if (!holdWithJob) {
          return reply.status(404).send({
            error: {
              code: "NOT_FOUND",
              message: "해당 보류 항목을 찾을 수 없거나 이미 결정되었습니다.",
            },
          });
        }

        // ── 트랜잭션: job discarded + hold_queue 업데이트 + activity_log ─────────
        await db.transaction(async (tx) => {
          // bot_generation_jobs 폐기
          await tx
            .update(schema.botGenerationJobs)
            .set({ status: "discarded", updatedAt: new Date() })
            .where(eq(schema.botGenerationJobs.id, holdWithJob.holdJobId));

          // bot_hold_queue 업데이트
          await tx
            .update(schema.botHoldQueue)
            .set({
              decided: true,
              decision: "discarded",
              decidedAt: new Date(),
              decidedBy: adminId,
            })
            .where(eq(schema.botHoldQueue.id, id));

          // bot_activity_log — 폐기 결정 기록
          await tx.insert(schema.botActivityLog).values({
            personaId: holdWithJob.personaId,
            eventType: "discarded",
            refId: holdWithJob.holdJobId,
            payload: {
              decidedBy: adminId,
              holdReason: holdWithJob.holdReason,
              holdQueueId: id,
            },
          });
        });

        return reply.send({ status: "discarded" });
      } catch (err) {
        request.log.error(err, "[bot-hold-queue] discard 처리 실패");
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
        });
      }
    },
  );
}

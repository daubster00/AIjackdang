/**
 * 글 생성 파이프라인 — Story 11.9
 *
 * runPostPipeline: 주제 선정 → 그라운딩 → 글 생성 → 자기검열 → 분기 → 게시/보류/폐기.
 *
 * 단계:
 *  0) 공지사항 가드 (notices 게시판 즉시 skip)
 *  1) 주제 선정 (selectTopic)
 *  2) 생성 잡 레코드 생성 (bot_generation_jobs)
 *  3) 페르소나 조회 + 글 성격 결정
 *  4) 검색·그라운딩 (groundTopic, intensity 분기)
 *  5) 이미지 전략 결정 (decideImageStrategy + 관리자 override)
 *  6) 관리자 연재 컨텍스트 조회 (series_group)
 *  7~9) 생성 루프 (재생성 MAX_REGEN=3):
 *       → 생성 모델 callModel → Tiptap 변환 → 자기검열 → 분기
 *  10) 자동 보충 fire-and-forget
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md §7 글 생성 파이프라인]
 * [Source: docs/seeding-bot/PRD.md FR-SB-5.1~5.5]
 */

import { eq, and, inArray, count } from "drizzle-orm";
import { getDb, schema } from "@ai-jakdang/database";
import type { Database } from "@ai-jakdang/database";
import { callModel, getModelAssignment } from "@ai-jakdang/server-bot/ai";
import { groundTopic } from "@ai-jakdang/server-bot/search";
import type { FactGrounding } from "@ai-jakdang/server-bot/search";
import {
  decideImageStrategy,
  fetchBotImage,
  prependImageToTiptapDoc,
} from "@ai-jakdang/server-bot/image";
import type { PostKind } from "@ai-jakdang/server-bot/image";
import {
  buildPersonaSystemPrompt,
  buildPostUserPrompt,
  extractTextFromTiptap,
} from "@ai-jakdang/bot-core";
import type {
  BotPersonaForPrompt,
  FactSummary,
  SeriesContext,
} from "@ai-jakdang/bot-core";
import { uploadImage } from "../../services/storage/index.js";
import { runContentGuard } from "../../middleware/contentGuard.js";
import {
  createPostAsBot,
  createQuestionAsBot,
  createResourceAsBot,
} from "./write.js";
import { selectTopic, markTopicUsed, refillTopicsIfNeeded } from "./topic.js";
import { runSelfCensor } from "./censor.js";

// ── 공개 타입 ─────────────────────────────────────────────────────────────────

export interface RunPostPipelineInput {
  personaId: string;
  /** 대상 게시판 슬러그 */
  board: string;
  /** 외부 실시간 주제 (오케스트레이터에서 주입, 선택) */
  realtimeTopic?: string;
  /** 관리자 연재 그룹 강제 지정 (선택) */
  forceSeriesGroup?: string;
}

export type PostPipelineStatus =
  | "published"
  | "blocked"
  | "held"
  | "discarded"
  | "skipped"
  | "error";

export interface PostPipelineResult {
  status: PostPipelineStatus;
  jobId?: string;
  postId?: string;
  reason?: string;
}

// ── 내부 상수 ─────────────────────────────────────────────────────────────────

const MAX_REGEN = 3;

// ── 내부 헬퍼 타입 ────────────────────────────────────────────────────────────

type TiptapInternalNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapInternalNode[];
};

// ── logActivity ───────────────────────────────────────────────────────────────

async function logActivity(
  db: Database,
  personaId: string,
  eventType:
    | "post.published"
    | "comment.published"
    | "held"
    | "blocked"
    | "regenerated"
    | "skipped"
    | "cost"
    | "discarded"
    | "planned",
  refId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(schema.botActivityLog).values({
      personaId,
      eventType,
      refId: refId ?? undefined,
      payload,
    });
  } catch (err) {
    // best-effort: 로그 실패는 파이프라인을 막지 않는다
    console.error("[post-pipeline] logActivity 실패 (무시):", (err as Error).message);
  }
}

// ── parseResponseToTiptap ─────────────────────────────────────────────────────

/**
 * 모델 응답 텍스트를 Tiptap JSON으로 변환.
 * Tiptap JSON 직접 반환 감지 → 마크다운 파싱 → fallback(단순 paragraph) 순서.
 */
function parseResponseToTiptap(text: string): Record<string, unknown> {
  const trimmed = text.trim();

  // 1) Tiptap JSON 직접 반환 감지
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.type === "doc" && Array.isArray(parsed.content)) {
        return parsed;
      }
    } catch {
      // 파싱 실패 → 다음 단계로
    }
  }

  // 2) 마크다운 → Tiptap 변환
  const content = parseMarkdownLines(trimmed);
  return { type: "doc", content };
}

function parseMarkdownLines(markdown: string): TiptapInternalNode[] {
  const lines = markdown.split("\n");
  const nodes: TiptapInternalNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // 코드 블록
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      nodes.push({
        type: "codeBlock",
        attrs: lang ? { language: lang } : {},
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      i++;
      continue;
    }

    // 헤딩
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      nodes.push({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: h3Match[1] }] });
      i++;
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      nodes.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: h2Match[1] }] });
      i++;
      continue;
    }
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      nodes.push({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: h1Match[1] }] });
      i++;
      continue;
    }

    // 빈 줄 스킵
    if (!line.trim()) {
      i++;
      continue;
    }

    // 단락
    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: line.replace(/\*\*(.*?)\*\*/g, "$1") }],
    });
    i++;
  }

  if (nodes.length === 0) {
    return [{ type: "paragraph", content: [{ type: "text", text: markdown.trim() }] }];
  }

  return nodes;
}

// ── generateTitle ─────────────────────────────────────────────────────────────

function generateTitle(titleSeed: string, seriesContext?: SeriesContext): string {
  if (seriesContext) {
    return `${seriesContext.groupTitle} — 제${seriesContext.episodeIndex}편`;
  }
  return titleSeed;
}

// ── adaptGrounding ────────────────────────────────────────────────────────────

function adaptGrounding(groundingResult: FactGrounding | null): FactSummary {
  if (!groundingResult) {
    return { facts: [], sourceUrls: [], confidence: "low" };
  }
  return {
    facts: groundingResult.facts,
    sourceUrls: groundingResult.sourceUrls,
    confidence: groundingResult.confidence,
  };
}

// ── runPostPipeline ───────────────────────────────────────────────────────────

export async function runPostPipeline(
  input: RunPostPipelineInput,
): Promise<PostPipelineResult> {
  const { personaId, board } = input;
  const db = getDb();

  // ── Step 0: 공지사항 게시판 이중 차단 ────────────────────────────────────────
  if (board === "notices") {
    await logActivity(db, personaId, "skipped", null, {
      reason: "notices-board-forbidden",
    });
    return { status: "skipped", reason: "notices-board-forbidden" };
  }

  // ── Step 1: 주제 선정 ─────────────────────────────────────────────────────────
  const topicResult = await selectTopic(db, personaId, board, input.realtimeTopic);
  if (!topicResult) {
    await logActivity(db, personaId, "skipped", null, { reason: "no-topic" });
    return { status: "skipped", reason: "no-topic" };
  }

  // 주제 선점 (wasRealtime=false인 경우만)
  if (!topicResult.wasRealtime) {
    await markTopicUsed(db, topicResult.topic.id);
  }

  // ── Step 2: 생성 잡 레코드 생성 ───────────────────────────────────────────────
  // board 종류로 job_kind와 게시 함수를 분기 (#6 정합)
  const jobKind: "post" | "question" | "resource" =
    board === "qna"
      ? "question"
      : board.startsWith("resource:")
        ? "resource"
        : "post";

  const jobRows = await db
    .insert(schema.botGenerationJobs)
    .values({
      personaId,
      jobKind,
      targetBoard: board,
      topicId: topicResult.wasRealtime ? undefined : topicResult.topic.id,
      status: "pending",
      regenCount: 0,
    })
    .returning({ id: schema.botGenerationJobs.id });

  const jobId = jobRows[0]?.id;
  if (!jobId) {
    return { status: "error", reason: "failed-to-create-job" };
  }

  // ── Step 3: 페르소나 조회 ──────────────────────────────────────────────────────
  const personaRows = await db
    .select()
    .from(schema.botPersonas)
    .where(eq(schema.botPersonas.id, personaId))
    .limit(1);

  const persona = personaRows[0];
  if (!persona) {
    await db
      .update(schema.botGenerationJobs)
      .set({ status: "blocked" })
      .where(eq(schema.botGenerationJobs.id, jobId));
    await logActivity(db, personaId, "blocked", jobId, { reason: "persona-not-found" });
    return { status: "blocked", reason: "persona-not-found", jobId };
  }

  const isAdminPersona = persona.isAdminPersona;
  const internalPostKind: "info" | "chat" | "guide" = isAdminPersona
    ? "guide"
    : persona.infoRatio >= 50
      ? "info"
      : "chat";

  const personaForPrompt: BotPersonaForPrompt = {
    nickname: persona.nickname,
    personaPrompt: persona.personaPrompt,
    tone: persona.tone,
    intentionalFlaws: persona.intentionalFlaws,
    isAdminPersona: persona.isAdminPersona,
    infoRatio: persona.infoRatio,
  };

  // ── Step 4: 생성 모델 조회 (루프 전에 1회) ─────────────────────────────────────
  const genAssignment = await getModelAssignment(db, personaId, "generation");
  if (!genAssignment) {
    await db
      .update(schema.botGenerationJobs)
      .set({ status: "blocked" })
      .where(eq(schema.botGenerationJobs.id, jobId));
    await logActivity(db, personaId, "blocked", jobId, { reason: "no-generation-model" });
    return { status: "blocked", reason: "no-generation-model", jobId };
  }

  // ── Step 5: 검색·그라운딩 ─────────────────────────────────────────────────────
  const intensity: "full" | "light" | "none" =
    internalPostKind === "guide" || internalPostKind === "info"
      ? "full"
      : persona.infoRatio >= 30
        ? "light"
        : "none";

  // BotModelAssignmentRow(createdAt: Date)를 BotModelAssignment(createdAt: string)로 변환
  const genAssignmentForGrounding = {
    ...genAssignment,
    createdAt: genAssignment.createdAt.toISOString(),
    updatedAt: genAssignment.updatedAt.toISOString(),
  };

  let groundingCost = 0;
  const groundingResult = await groundTopic(
    topicResult.topic.titleSeed,
    intensity,
    {
      modelAssignment: genAssignmentForGrounding,
      callModel: (assignment, prompt) => callModel(assignment, prompt),
      onCostAccumulated: async (costUsd) => {
        groundingCost += costUsd;
      },
    },
  );
  const facts = adaptGrounding(groundingResult);

  // ── Step 6: 이미지 전략 결정 ──────────────────────────────────────────────────
  const imagePostKind: PostKind = jobKind === "question" ? "qna" : "post";
  const personaContext = {
    nickname: persona.nickname,
    is_admin_persona: isAdminPersona,
    info_ratio: persona.infoRatio,
  };
  // decideImageStrategy는 동기 함수 (isAdminPersona=true이면 이미 'ai' 반환)
  const baseStrategy = decideImageStrategy(personaContext, board, imagePostKind);
  const imageStrategy = isAdminPersona ? "ai" : baseStrategy;

  // ── Step 7: 관리자 연재 컨텍스트 조회 ────────────────────────────────────────
  let seriesContext: SeriesContext | undefined;
  const seriesGroup = topicResult.topic.seriesGroup ?? input.forceSeriesGroup;
  if (isAdminPersona && seriesGroup) {
    const [episodeCountRow] = await db
      .select({ c: count() })
      .from(schema.botTopics)
      .where(
        and(
          eq(schema.botTopics.seriesGroup, seriesGroup),
          inArray(schema.botTopics.status, ["used"]),
        ),
      );
    seriesContext = {
      groupTitle: seriesGroup,
      episodeIndex: (Number(episodeCountRow?.c ?? 0)) + 1,
    };
  }

  // ── Step 8~10: 생성 루프 ──────────────────────────────────────────────────────
  let regenCount = 0;
  let pipelineResult: PostPipelineResult | null = null;

  while (regenCount <= MAX_REGEN && pipelineResult === null) {
    // 상태: generating 업데이트
    await db
      .update(schema.botGenerationJobs)
      .set({ status: "generating", regenCount, updatedAt: new Date() })
      .where(eq(schema.botGenerationJobs.id, jobId));

    // 시스템·유저 프롬프트 조립
    const systemPrompt = buildPersonaSystemPrompt(personaForPrompt);
    const userPrompt = buildPostUserPrompt({
      titleSeed: topicResult.topic.titleSeed,
      facts,
      board,
      postKind: internalPostKind,
      seriesContext,
    });

    // 생성 모델 호출
    let genText: string;
    let genCostUsd = 0;
    try {
      const genResponse = await callModel(
        genAssignment,
        {
          system: systemPrompt,
          user: userPrompt,
          maxTokens: isAdminPersona ? 4000 : 1500,
        },
        { personaId, jobId },
      );
      genText = genResponse.text;
      genCostUsd = genResponse.costUsd;
    } catch (err) {
      console.error("[post-pipeline] 생성 모델 호출 실패:", (err as Error).message);
      regenCount++;
      if (regenCount > MAX_REGEN) {
        await db
          .update(schema.botGenerationJobs)
          .set({ status: "discarded", updatedAt: new Date() })
          .where(eq(schema.botGenerationJobs.id, jobId));
        await logActivity(db, personaId, "discarded", jobId, {
          reason: "generation-model-error",
        });
        pipelineResult = { status: "discarded", jobId };
      }
      continue;
    }

    // Tiptap JSON 변환 + 텍스트 추출
    const draftJson = parseResponseToTiptap(genText);
    const draftText = extractTextFromTiptap(draftJson);

    // 자기검열 (status: censoring 업데이트 + censor_result 저장)
    const censorOutput = await runSelfCensor({
      jobId,
      personaId,
      draft: draftText,
      titleSeed: topicResult.topic.titleSeed,
      persona: {
        personaName: persona.nickname,
        tone: persona.tone ?? "",
        infoRatio: persona.infoRatio,
        isAdminPersona: persona.isAdminPersona,
        personaId,
      },
      facts,
      board,
    });

    const { censorResult, costUsd: censorCostUsd } = censorOutput;

    await db
      .update(schema.botGenerationJobs)
      .set({
        status: "censoring",
        draftContent: draftJson,
        censorResult,
        updatedAt: new Date(),
      })
      .where(eq(schema.botGenerationJobs.id, jobId));

    // ── 분기 처리 ────────────────────────────────────────────────────────────

    if (censorResult.overall === "pass") {
      // 이미지 처리 (통과 시에만 비용 지출)
      let imageUrl: string | null = null;
      let imageCost = 0;
      if (imageStrategy !== "none") {
        const imageResult = await fetchBotImage({
          persona: personaContext,
          board,
          postKind: imagePostKind,
          keyword: topicResult.topic.titleSeed,
          jobId,
          uploadFn: uploadImage,
        });
        imageUrl = imageResult.imageUrl;

        // meme 전략: copyright_risk 보류 큐 적재
        if (imageResult.isMeme) {
          await db.insert(schema.botHoldQueue).values({
            jobId,
            reason: "copyright_risk",
            decided: false,
          });
          await db
            .update(schema.botGenerationJobs)
            .set({ status: "held", updatedAt: new Date() })
            .where(eq(schema.botGenerationJobs.id, jobId));
          await logActivity(db, personaId, "held", jobId, {
            reason: "meme-copyright-risk",
          });
          pipelineResult = { status: "held", jobId };
          break;
        }
      }

      // 비용 누적
      const totalCost = groundingCost + genCostUsd + censorCostUsd + imageCost;
      await db
        .update(schema.botGenerationJobs)
        .set({
          cost: {
            grounding: groundingCost,
            gen: genCostUsd,
            censor: censorCostUsd,
            image: imageCost,
            total: totalCost,
          },
        })
        .where(eq(schema.botGenerationJobs.id, jobId));

      // Tiptap에 이미지 삽입
      const finalContentJson = imageUrl
        ? prependImageToTiptapDoc(draftJson, imageUrl)
        : draftJson;

      // contentGuard 검사
      const guardResult = await runContentGuard(draftText);
      if (!guardResult.ok) {
        await db
          .update(schema.botGenerationJobs)
          .set({ status: "blocked", updatedAt: new Date() })
          .where(eq(schema.botGenerationJobs.id, jobId));
        await logActivity(db, personaId, "blocked", jobId, {
          reason: guardResult.code ?? "FORBIDDEN_CONTENT",
        });
        pipelineResult = { status: "blocked", jobId };
        break;
      }

      // 게시 함수 분기 (#6 정합)
      const title = generateTitle(topicResult.topic.titleSeed, seriesContext);
      const tags = topicResult.topic.titleSeed
        .split(/\s+/)
        .filter((w) => w.length > 1)
        .slice(0, 5);
      const common = {
        botUserId: persona.userId ?? personaId,
        personaId,
        jobId,
      };

      let writeResult: { status: "published" | "blocked"; refId?: string };

      if (jobKind === "question") {
        writeResult = await createQuestionAsBot({
          ...common,
          questionInput: {
            title,
            contentJson: finalContentJson,
            tags,
          },
        });
      } else if (jobKind === "resource") {
        const resourceType = board.slice("resource:".length) as
          | "prompt"
          | "claude-code-skill"
          | "mcp"
          | "rules-config"
          | "template-checklist";
        writeResult = await createResourceAsBot({
          ...common,
          resourceInput: {
            title,
            summary: facts.facts[0] ?? title,
            resourceType,
            environment: [],
            difficulty: "beginner",
            descriptionJson: finalContentJson,
            usageJson: { type: "doc", content: [] },
            tags,
          },
        });
      } else {
        writeResult = await createPostAsBot({
          ...common,
          postInput: {
            board,
            title,
            contentJson: finalContentJson,
            status: "published",
            tags,
          },
        });
      }

      pipelineResult = {
        status: writeResult.status as PostPipelineStatus,
        jobId,
        postId: writeResult.refId,
      };
    } else if (censorResult.overall === "ambiguous") {
      // HELD → bot_hold_queue INSERT
      await db.insert(schema.botHoldQueue).values({
        jobId,
        reason: "ambiguous",
        decided: false,
      });
      await db
        .update(schema.botGenerationJobs)
        .set({ status: "held", updatedAt: new Date() })
        .where(eq(schema.botGenerationJobs.id, jobId));
      await logActivity(db, personaId, "held", jobId, { censorResult });
      pipelineResult = { status: "held", jobId };
    } else {
      // FAIL → 재생성 시도
      regenCount++;
      await logActivity(db, personaId, "regenerated", jobId, {
        attempt: regenCount,
        censorResult,
      });
      if (regenCount > MAX_REGEN) {
        await db
          .update(schema.botGenerationJobs)
          .set({ status: "discarded", regenCount, updatedAt: new Date() })
          .where(eq(schema.botGenerationJobs.id, jobId));
        await logActivity(db, personaId, "discarded", jobId, {
          reason: "max-regen-exceeded",
          regenCount,
        });
        pipelineResult = { status: "discarded", jobId };
      }
      // else: while 루프 재진입
    }
  }

  // ── Step 11: 자동 보충 (fire-and-forget) ───────────────────────────────────
  void refillTopicsIfNeeded(db, personaId).catch((err: unknown) =>
    console.error(
      "[post-pipeline] 자동 보충 실패 (무시):",
      (err as Error).message,
    ),
  );

  return pipelineResult ?? { status: "error", jobId, reason: "unexpected-loop-exit" };
}

/**
 * 커리큘럼 스테이징 파이프라인 — Story 13.3
 *
 * 초안 생성(draftCurriculumChapter) · 준비완료 판정(checkAndPromoteChapter) ·
 * 게시 실행(publishChapter) 세 함수를 구현한다.
 *
 * 핵심 가드레일:
 *  1. 초안 생성 ≠ 게시: draftCurriculumChapter는 createPostAsBot을 절대 호출하지 않는다.
 *  2. 미완 안전장치: publishChapter는 pending 슬롯이 있으면 즉시 중단.
 *  3. draft_text_editable(사람 수정본) 우선: 게시 시 사람이 고친 내용을 우선 사용.
 *  4. allowDidacticTone: true 필수 — 누락 시 ai_tone·duplicate 오탐으로 루프 진입.
 *  5. bot_settings.guide_progress 의존 없음 — DB status가 유일한 진실 소스.
 *
 * [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md §2]
 * [Source: _bmad-output/implementation-artifacts/13-3-staging-pipeline-generate-vs-publish.md]
 */

import { eq, and, lt, inArray, asc, count } from "drizzle-orm";
import { getDb, schema } from "@ai-jakdang/database";
import { callModel, getModelAssignment } from "@ai-jakdang/server-bot/ai";
import {
  buildPersonaSystemPrompt,
  buildGuideChapterUserPrompt,
  extractTextFromTiptap,
} from "@ai-jakdang/bot-core";
import type {
  BotPersonaForPrompt,
  GuideChapterContext,
  FactSummary,
} from "@ai-jakdang/bot-core";
import { insertInlineImagesByMarker } from "@ai-jakdang/server-bot/image";
import type { GuideAssetManifest } from "@ai-jakdang/server-bot/image";
import { createPostAsBot } from "./write.js";
import { runSelfCensor } from "./censor.js";
import { runContentGuard } from "../../middleware/contentGuard.js";
import { parseResponseToTiptap } from "./_tiptap-parser.js";
import type { PublishChapterResult } from "@ai-jakdang/server-bot/curriculum-publish";

// ── 공개 타입 ─────────────────────────────────────────────────────────────────

export interface DraftChapterResult {
  status: "drafted" | "skipped" | "error";
  chapterId: string;
  reason?: string;
}

export interface ReadinessResult {
  ready: boolean;
  /** pending 상태 슬롯 수 (0이면 ready=true). */
  pendingCount: number;
  /** 슬롯 총 수. */
  totalCount: number;
}

// PublishChapterResult는 server-bot 공유 타입을 재수출 — worker(13.6)가 같은 경로로 import.
export type { PublishChapterResult };

// ── 내부 상수 ─────────────────────────────────────────────────────────────────

const MAX_REGEN = 2;

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/**
 * 발행된 draft 텍스트에서 연속성용 한 줄 요약을 만든다(앞 180자).
 * post-pipeline.ts의 동일 헬퍼와 동일 로직 — curriculum-staging 내부로 이관.
 */
function summarizeForContinuity(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 180 ? `${flat.slice(0, 180)}…` : flat;
}

// ── draftCurriculumChapter ────────────────────────────────────────────────────

/**
 * 커리큘럼 챕터의 초안을 생성해 DB에 저장한다.
 *
 * - status=planned 또는 status=drafted 챕터만 처리.
 * - 이 함수는 createPostAsBot을 절대 호출하지 않는다(초안 생성 ≠ 게시).
 * - 슬롯 0개 챕터는 저장 직후 checkAndPromoteChapter를 호출해 즉시 ready로 승격.
 *
 * [Source: Story 13.3 AC #1, #5, #6]
 */
export async function draftCurriculumChapter(
  chapterId: string,
): Promise<DraftChapterResult> {
  const db = getDb();

  // Step A — 챕터 + 시리즈 로드
  const rows = await db
    .select({
      chapter: schema.botCurriculumChapters,
      series: schema.botCurriculumSeries,
    })
    .from(schema.botCurriculumChapters)
    .innerJoin(
      schema.botCurriculumSeries,
      eq(schema.botCurriculumChapters.seriesId, schema.botCurriculumSeries.id),
    )
    .where(
      and(
        eq(schema.botCurriculumChapters.id, chapterId),
        inArray(schema.botCurriculumChapters.status, ["planned", "drafted"]),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return {
      status: "skipped",
      chapterId,
      reason: "chapter-not-found-or-invalid-status",
    };
  }

  const { chapter, series } = row;

  // Step B — 이미지 슬롯 로드
  const slots = await db
    .select()
    .from(schema.botCurriculumImageSlots)
    .where(eq(schema.botCurriculumImageSlots.chapterId, chapterId))
    .orderBy(asc(schema.botCurriculumImageSlots.createdAt));

  // Step C — 이전 편 요약 구성 (AC #5 연속성)
  const prevRows = await db
    .select({
      orderIndex: schema.botCurriculumChapters.orderIndex,
      title: schema.botCurriculumChapters.title,
      continuitySummary: schema.botCurriculumChapters.continuitySummary,
      draftTextEditable: schema.botCurriculumChapters.draftTextEditable,
      draftContent: schema.botCurriculumChapters.draftContent,
    })
    .from(schema.botCurriculumChapters)
    .where(
      and(
        eq(schema.botCurriculumChapters.seriesId, chapter.seriesId),
        lt(schema.botCurriculumChapters.orderIndex, chapter.orderIndex),
        inArray(schema.botCurriculumChapters.status, ["published", "drafted"]),
      ),
    )
    .orderBy(asc(schema.botCurriculumChapters.orderIndex));

  const previousChapters = prevRows
    .filter((c) => c.draftContent !== null)
    .map((c) => {
      const rawText =
        c.continuitySummary ??
        c.draftTextEditable ??
        extractTextFromTiptap(c.draftContent as Record<string, unknown>);
      return {
        order: c.orderIndex,
        title: c.title,
        summary: summarizeForContinuity(rawText),
      };
    });

  // Step D — 관리자 페르소나 조회
  // series.board로 관리자 페르소나(is_admin_persona=true)를 찾는다.
  const personaRows = await db
    .select({ persona: schema.botPersonas })
    .from(schema.botPersonaBoards)
    .innerJoin(
      schema.botPersonas,
      eq(schema.botPersonaBoards.personaId, schema.botPersonas.id),
    )
    .where(
      and(
        eq(schema.botPersonaBoards.board, series.board),
        eq(schema.botPersonas.isAdminPersona, true),
      ),
    )
    .limit(1);

  const personaRow = personaRows[0];
  if (!personaRow) {
    return {
      status: "error",
      chapterId,
      reason: "no-admin-persona-for-board",
    };
  }

  const persona = personaRow.persona;

  // Step E — GuideChapterContext 조립
  const [totalCountRow] = await db
    .select({ c: count() })
    .from(schema.botCurriculumChapters)
    .where(eq(schema.botCurriculumChapters.seriesId, chapter.seriesId));
  const totalChapters = Number(totalCountRow?.c ?? 0);

  const ctx: GuideChapterContext = {
    seriesTitle: series.title,
    seriesIntro: series.intro,
    tool: series.tool,
    order: chapter.orderIndex,
    totalChapters,
    chapterTitle: chapter.title,
    goal: chapter.goal,
    outline: (chapter.outline as string[]) ?? [],
    imageSlots: slots.map((s) => ({ assetKey: s.assetKey, caption: s.caption })),
    previousChapters,
  };

  const personaForPrompt: BotPersonaForPrompt = {
    nickname: persona.nickname,
    personaPrompt: persona.personaPrompt,
    tone: persona.tone,
    intentionalFlaws: persona.intentionalFlaws,
    isAdminPersona: persona.isAdminPersona,
    infoRatio: persona.infoRatio,
  };

  // Step F — 프롬프트 생성 + 모델 할당 조회
  const genAssignment = await getModelAssignment(db, persona.id, "generation");
  if (!genAssignment) {
    return { status: "error", chapterId, reason: "no-generation-model" };
  }

  const systemPrompt = buildPersonaSystemPrompt(personaForPrompt);
  const emptyFacts: FactSummary = { facts: [], sourceUrls: [], confidence: "low" };
  const userPrompt = buildGuideChapterUserPrompt(ctx, emptyFacts);
  const tempJobId = crypto.randomUUID();

  // 생성 루프 (검열 fail 시 재시도 최대 MAX_REGEN 회)
  let regenCount = 0;
  while (regenCount <= MAX_REGEN) {
    let genText: string;
    try {
      const genResponse = await callModel(
        genAssignment,
        { system: systemPrompt, user: userPrompt, maxTokens: 4000 },
        { personaId: persona.id, jobId: tempJobId },
      );
      genText = genResponse.text;
    } catch (err) {
      console.error("[curriculum-staging] 생성 모델 호출 실패:", (err as Error).message);
      return { status: "error", chapterId, reason: "generation-model-error" };
    }

    // Step G — Tiptap 변환
    const draftJson = parseResponseToTiptap(genText);
    const draftText = extractTextFromTiptap(draftJson);

    // Step H — 자기검열 (AC #6: allowDidacticTone: true)
    const censorOutput = await runSelfCensor({
      jobId: tempJobId,
      personaId: persona.id,
      draft: draftText,
      titleSeed: chapter.title,
      persona: {
        personaName: persona.nickname,
        tone: persona.tone ?? "",
        infoRatio: persona.infoRatio,
        isAdminPersona: persona.isAdminPersona,
        personaId: persona.id,
      },
      facts: emptyFacts,
      board: series.board,
      allowObvious: true,
      allowDidacticTone: true,
    });

    const { censorResult } = censorOutput;

    if (censorResult.overall === "pass") {
      // Step I — 초안 저장
      const continuitySummary = summarizeForContinuity(draftText);

      await db
        .update(schema.botCurriculumChapters)
        .set({
          draftContent: draftJson,
          continuitySummary,
          status: "drafted",
          updatedAt: new Date(),
        })
        .where(eq(schema.botCurriculumChapters.id, chapterId));

      // Step J — 이미지 슬롯 0개 → 즉시 ready 승격 (AC #3 edge case)
      if (slots.length === 0) {
        await checkAndPromoteChapter(chapterId);
      }

      return { status: "drafted", chapterId };
    } else if (censorResult.overall === "ambiguous") {
      // ambiguous: 초안 저장 + bot_hold_queue 적재 후 drafted 상태 유지
      const continuitySummary = summarizeForContinuity(draftText);

      await db
        .update(schema.botCurriculumChapters)
        .set({
          draftContent: draftJson,
          continuitySummary,
          status: "drafted",
          updatedAt: new Date(),
        })
        .where(eq(schema.botCurriculumChapters.id, chapterId));

      await db.insert(schema.botHoldQueue).values({
        jobId: tempJobId,
        reason: "ambiguous",
        decided: false,
      });

      if (slots.length === 0) {
        await checkAndPromoteChapter(chapterId);
      }

      return { status: "drafted", chapterId };
    } else {
      // fail: 재생성 시도
      regenCount++;
      if (regenCount > MAX_REGEN) {
        return { status: "error", chapterId, reason: "max-regen-exceeded" };
      }
    }
  }

  return { status: "error", chapterId, reason: "unexpected-loop-exit" };
}

// ── checkAndPromoteChapter ────────────────────────────────────────────────────

/**
 * 챕터의 모든 이미지 슬롯이 ready인지 확인하고, 그렇다면 챕터 status를 ready로 승격한다.
 *
 * - 슬롯 0개 챕터는 drafted 직후 즉시 ready로 승격.
 * - 하나라도 pending이면 승격하지 않는다.
 * - status가 drafted가 아닌 챕터는 재처리 없이 현재 상태를 반환.
 *
 * [Source: Story 13.3 AC #3]
 */
export async function checkAndPromoteChapter(
  chapterId: string,
): Promise<ReadinessResult> {
  const db = getDb();

  // Step A — 챕터 상태 확인 (drafted가 아니면 재처리 불필요)
  const chapterRows = await db
    .select({ status: schema.botCurriculumChapters.status })
    .from(schema.botCurriculumChapters)
    .where(eq(schema.botCurriculumChapters.id, chapterId))
    .limit(1);

  const chapterStatus = chapterRows[0]?.status;
  if (chapterStatus !== "drafted") {
    // ready/published/planned/skipped: 현재 상태 기준으로 계산만 반환
    return {
      ready: chapterStatus === "ready" || chapterStatus === "published",
      pendingCount: 0,
      totalCount: 0,
    };
  }

  // Step B — 슬롯 전수 조회
  const slots = await db
    .select({ status: schema.botCurriculumImageSlots.status })
    .from(schema.botCurriculumImageSlots)
    .where(eq(schema.botCurriculumImageSlots.chapterId, chapterId));

  const totalCount = slots.length;
  const pendingCount = slots.filter((s) => s.status === "pending").length;
  // 슬롯 0개 OR pendingCount === 0 → ready
  const ready = totalCount === 0 || pendingCount === 0;

  // Step D — 승격 (ready=true인 경우에만)
  if (ready) {
    await db
      .update(schema.botCurriculumChapters)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(schema.botCurriculumChapters.id, chapterId));
  }

  return { ready, pendingCount, totalCount };
}

// ── publishChapter ────────────────────────────────────────────────────────────

/**
 * 게시 준비된 챕터(status=ready AND scheduled_at<=now)를 실제로 게시한다.
 *
 * 13.6 예약 스케줄러(apps/worker)가 호출. 반환 타입은
 * packages/server-bot/src/curriculum-publish.ts의 PublishChapterResult로
 * worker가 같은 경로에서 import한다.
 *
 * [Source: Story 13.3 AC #4]
 */
export async function publishChapter(
  chapterId: string,
): Promise<PublishChapterResult> {
  const db = getDb();

  // Step A — 챕터 + 시리즈 로드 (status=ready만 처리)
  const rows = await db
    .select({
      chapter: schema.botCurriculumChapters,
      series: schema.botCurriculumSeries,
    })
    .from(schema.botCurriculumChapters)
    .innerJoin(
      schema.botCurriculumSeries,
      eq(schema.botCurriculumChapters.seriesId, schema.botCurriculumSeries.id),
    )
    .where(
      and(
        eq(schema.botCurriculumChapters.id, chapterId),
        eq(schema.botCurriculumChapters.status, "ready"),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { status: "error", chapterId, reason: "chapter-not-ready" };
  }

  const { chapter, series } = row;

  // Step B — 이미지 슬롯 로드 + pending 안전장치 (미완 방지)
  const slots = await db
    .select()
    .from(schema.botCurriculumImageSlots)
    .where(eq(schema.botCurriculumImageSlots.chapterId, chapterId));

  const pendingSlots = slots.filter((s) => s.status === "pending");
  if (pendingSlots.length > 0) {
    // 이론상 불가하나 방어코드 — 반쪽짜리 글 게시 방지
    return { status: "error", chapterId, reason: "image-slot-still-pending" };
  }

  // Step C — 매니페스트 조립 (assetKey → 이미지 URL 매핑)
  const manifest: GuideAssetManifest = {};
  for (const slot of slots) {
    if (slot.imageUrl) {
      manifest[slot.assetKey] = {
        url: slot.imageUrl,
        caption: slot.caption ?? null,
        alt: slot.alt ?? null,
        sourceLabel: null,
        sourceUrl: slot.sourceUrl ?? null,
      };
    }
  }

  // Step D — 마커 치환 (draft_text_editable 우선 — AC #3 "사람 수정본 우선")
  const sourceContent: Record<string, unknown> | null = chapter.draftTextEditable
    ? (parseResponseToTiptap(chapter.draftTextEditable) as Record<string, unknown>)
    : (chapter.draftContent as Record<string, unknown> | null);

  if (!sourceContent) {
    return { status: "error", chapterId, reason: "no-draft-content" };
  }

  const { doc: finalContentJson } = insertInlineImagesByMarker(sourceContent, manifest);

  // Step E — 관리자 페르소나 조회
  const personaRows = await db
    .select({ persona: schema.botPersonas })
    .from(schema.botPersonaBoards)
    .innerJoin(
      schema.botPersonas,
      eq(schema.botPersonaBoards.personaId, schema.botPersonas.id),
    )
    .where(
      and(
        eq(schema.botPersonaBoards.board, series.board),
        eq(schema.botPersonas.isAdminPersona, true),
      ),
    )
    .limit(1);

  const personaRow = personaRows[0];
  if (!personaRow) {
    return { status: "error", chapterId, reason: "no-admin-persona-for-board" };
  }

  const persona = personaRow.persona;

  // Step F — contentGuard 검사
  const finalText = extractTextFromTiptap(finalContentJson);
  const guardResult = await runContentGuard(finalText);
  if (!guardResult.ok) {
    return { status: "blocked", chapterId, reason: "content-guard-blocked" };
  }

  // Step G — 게시 실행
  const tempJobId = crypto.randomUUID();
  const title = `${series.title} ${chapter.orderIndex}강. ${chapter.title}`;
  const tags = chapter.title.split(/\s+/).filter((w) => w.length > 1).slice(0, 5);

  const writeResult = await createPostAsBot({
    botUserId: persona.userId ?? persona.id,
    personaId: persona.id,
    jobId: tempJobId,
    postInput: {
      board: series.board,
      title,
      contentJson: finalContentJson,
      status: "published",
      tags,
    },
  });

  if (writeResult.status === "blocked") {
    return { status: "blocked", chapterId, reason: "create-post-blocked" };
  }

  // Step H — 챕터 상태 업데이트 (published + publishedPostId + continuitySummary)
  const continuitySummary = summarizeForContinuity(
    extractTextFromTiptap(finalContentJson),
  );

  await db
    .update(schema.botCurriculumChapters)
    .set({
      status: "published",
      publishedPostId: writeResult.refId ?? null,
      continuitySummary,
      updatedAt: new Date(),
    })
    .where(eq(schema.botCurriculumChapters.id, chapterId));

  return {
    status: "published",
    chapterId,
    postId: writeResult.refId,
    continuitySummary,
  };
}

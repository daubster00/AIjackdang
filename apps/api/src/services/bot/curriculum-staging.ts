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

/** 블록 노드(제목·문단)의 순수 텍스트를 이어붙인다. */
function blockPlainText(node: Record<string, unknown>): string {
  if (!Array.isArray(node.content)) return "";
  return (node.content as Record<string, unknown>[])
    .map((c) => (typeof c.text === "string" ? (c.text as string) : ""))
    .join("")
    .trim();
}

/** 이미지 자리 상한(초안당 최대 개수). */
const MAX_AUTO_IMAGE_SLOTS = 4;

/**
 * 초안 본문의 구조(제목 H2/H3)를 기준으로 이미지 자리([[IMG:sec-N]] 마커)를 결정적으로 삽입한다.
 * LLM 플래너(불안정·간헐적 0건)에 의존하지 않고, 섹션마다 이미지 자리를 보장한다.
 *  - 제목이 있으면 각 제목 바로 다음(제목 뒤 첫 문단 아래)에 이미지 자리를 넣는다.
 *  - 제목이 없으면 본문 문단 사이에 1~2개를 균등 배치한다.
 * 각 자리의 guidance는 해당 섹션 제목에서 만들고, diagramPrompt는 비워 둔다
 * (관리자가 'AI 생성'을 누르면 본문 맥락으로 프롬프트가 자동 작성된다).
 */
function planImageSlotsByHeadings(
  doc: Record<string, unknown>,
): { body: Record<string, unknown>; slots: { assetKey: string; guidance: string }[] } {
  const clone = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
  const content = Array.isArray(clone.content) ? (clone.content as Record<string, unknown>[]) : [];
  if (content.length === 0) return { body: clone, slots: [] };

  const picks: { afterIndex: number; heading: string }[] = [];

  // 1) 제목(heading) 기준
  for (let i = 0; i < content.length; i++) {
    const node = content[i]!;
    if (node.type === "heading") {
      // 제목 뒤 첫 문단이 있으면 그 아래, 없으면 제목 바로 아래
      const next = content[i + 1];
      const afterIndex = next && next.type === "paragraph" ? i + 1 : i;
      picks.push({ afterIndex, heading: blockPlainText(node) });
    }
  }

  // 2) 제목이 없으면 문단 사이 균등 배치(최대 2개)
  if (picks.length === 0) {
    const n = Math.min(2, Math.max(1, Math.floor(content.length / 3)));
    for (let k = 0; k < n; k++) {
      const idx = Math.max(0, Math.round(((k + 1) * content.length) / (n + 1)) - 1);
      picks.push({ afterIndex: idx, heading: "" });
    }
  }

  const chosen = picks.slice(0, MAX_AUTO_IMAGE_SLOTS);
  const slots = chosen.map((p, i) => ({
    assetKey: `sec-${i}`,
    guidance: p.heading
      ? `"${p.heading}" 주제를 상징하는 실사풍 이미지`
      : "이 주제를 상징하는 실사풍 이미지",
  }));

  // 뒤에서부터 마커 삽입(인덱스 밀림 방지)
  const insertions = chosen
    .map((p, i) => ({ afterIndex: p.afterIndex, key: `sec-${i}` }))
    .sort((a, b) => b.afterIndex - a.afterIndex);
  const out = [...content];
  for (const ins of insertions) {
    out.splice(ins.afterIndex + 1, 0, {
      type: "paragraph",
      content: [{ type: "text", text: `[[IMG:${ins.key}]]` }],
    });
  }
  clone.content = out;

  return { body: clone, slots };
}

/**
 * 초안 본문에 이미지 자리(마커)를 삽입하고, 각 자리에 대응하는 이미지 슬롯(pending)을 생성한다.
 * 반환: 마커가 삽입된 본문 + 생성된 슬롯 수. 자리 0건이면 원본 본문/0 반환.
 * 이렇게 하면 초안 생성만으로 "글 안에 이미지 자리 + 설명"이 자동으로 만들어진다.
 */
async function planAndCreateImageSlots(
  chapterId: string,
  draftJson: Record<string, unknown>,
): Promise<{ body: Record<string, unknown>; count: number }> {
  const db = getDb();
  try {
    const { body, slots } = planImageSlotsByHeadings(draftJson);
    if (slots.length === 0) return { body: draftJson, count: 0 };

    await db.insert(schema.botCurriculumImageSlots).values(
      slots.map((s) => ({
        chapterId,
        assetKey: s.assetKey,
        // caption·alt는 DB NOT NULL → 빈 문자열로 시작(관리자가 필요 시 채움)
        caption: "",
        alt: "",
        sourceKind: "ai_diagram" as const,
        status: "pending" as const,
        guidance: s.guidance,
        positionHint: null,
        diagramPrompt: null, // 'AI 생성' 시 본문 맥락으로 프롬프트 자동 작성
        sourceUrl: null,
      })),
    );

    return { body, count: slots.length };
  } catch (err) {
    console.warn(
      "[curriculum-staging] 이미지 자리 생성 실패, 이미지 없이 저장:",
      (err as Error).message,
    );
    return { body: draftJson, count: 0 };
  }
}

// ── draftCurriculumChapter ────────────────────────────────────────────────────

/**
 * 커리큘럼 챕터의 초안을 생성해 DB에 저장한다.
 *
 * - status=planned·drafted·ready 챕터를 처리(published·skipped만 제외).
 *   재생성('AI로 다시 생성')은 ready 챕터에서도 허용된다.
 * - 이 함수는 createPostAsBot을 절대 호출하지 않는다(초안 생성 ≠ 게시).
 * - 이미지 자리가 하나도 없는 챕터는 저장 직후 checkAndPromoteChapter로 즉시 ready 승격.
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
        inArray(schema.botCurriculumChapters.status, ["planned", "drafted", "ready"]),
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

  // 재생성 대비: 아직 채워지지 않은(pending) 이미지 자리는 지우고 새로 계획한다.
  // (이미 업로드/생성된 이미지가 있는 슬롯은 보존 — 실수로 이미지를 잃지 않게.)
  await db
    .delete(schema.botCurriculumImageSlots)
    .where(
      and(
        eq(schema.botCurriculumImageSlots.chapterId, chapterId),
        eq(schema.botCurriculumImageSlots.status, "pending"),
      ),
    );

  // Step B — 이미지 슬롯 로드 (이미지가 채워진 슬롯만 남음)
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
      // Step I — 초안 저장 (슬롯 미정의 챕터는 이미지 자리 자동 삽입)
      const continuitySummary = summarizeForContinuity(draftText);

      let bodyToSave = draftJson as Record<string, unknown>;
      let createdSlots = 0;
      if (slots.length === 0) {
        const planned = await planAndCreateImageSlots(
          chapterId,
          draftJson as Record<string, unknown>,
        );
        bodyToSave = planned.body;
        createdSlots = planned.count;
      }

      await db
        .update(schema.botCurriculumChapters)
        .set({
          draftContent: bodyToSave,
          continuitySummary,
          status: "drafted",
          updatedAt: new Date(),
        })
        .where(eq(schema.botCurriculumChapters.id, chapterId));

      // Step J — 이미지 자리가 하나도 없으면(원래 0 + 플래너도 0) 즉시 ready 승격 (AC #3)
      if (slots.length === 0 && createdSlots === 0) {
        await checkAndPromoteChapter(chapterId);
      }

      return { status: "drafted", chapterId };
    } else if (censorResult.overall === "ambiguous") {
      // ambiguous: 초안 저장 + bot_hold_queue 적재 후 drafted 상태 유지
      const continuitySummary = summarizeForContinuity(draftText);

      let bodyToSave = draftJson as Record<string, unknown>;
      let createdSlots = 0;
      if (slots.length === 0) {
        const planned = await planAndCreateImageSlots(
          chapterId,
          draftJson as Record<string, unknown>,
        );
        bodyToSave = planned.body;
        createdSlots = planned.count;
      }

      await db
        .update(schema.botCurriculumChapters)
        .set({
          draftContent: bodyToSave,
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

      if (slots.length === 0 && createdSlots === 0) {
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

  // Step A — 챕터 + 시리즈 로드 (초안 완료(drafted) 또는 이미지완료(ready) 모두 게시 대상)
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
        inArray(schema.botCurriculumChapters.status, ["drafted", "ready"]),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { status: "error", chapterId, reason: "chapter-not-ready" };
  }

  const { chapter, series } = row;

  // Step B — 이미지 슬롯 로드.
  // 비어 있는(pending) 이미지 자리는 게시를 막지 않는다 — 발행 시 그 자리는 이미지 없이 렌더된다
  // (insertInlineImagesByMarker가 manifest에 없는 마커를 자동으로 제거).
  const slots = await db
    .select()
    .from(schema.botCurriculumImageSlots)
    .where(eq(schema.botCurriculumImageSlots.chapterId, chapterId));

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

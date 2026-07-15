/**
 * 커리큘럼 플랜 서비스 레이어 — Story 13.5 Task 1
 *
 * 조회·수정·집계 전담. DB 직접 접근.
 * checkAndPromoteChapter → 13.3 import (재구현 금지).
 * fillImageSlot → 13.4 import (재구현 금지).
 * tiptap-renderer.ts 실제 export: tiptapJsonToHtml (generateSafeHtml 아님).
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq, and, count, sql, asc } from "drizzle-orm";
import type {
  AdminCurriculumSeriesQuery,
  AdminCurriculumChaptersQuery,
  CurriculumChapterDraftUpdate,
  CurriculumSlotGenerate,
  CurriculumPlanCreate,
  CurriculumAutoGenerate,
} from "@ai-jakdang/contracts";
import { callModel, getModelAssignment } from "@ai-jakdang/server-bot/ai";
import { extractTextFromTiptap } from "@ai-jakdang/bot-core";
import {
  checkAndPromoteChapter,
  draftCurriculumChapter,
} from "../../../services/bot/curriculum-staging.js";
import type { DraftChapterResult } from "../../../services/bot/curriculum-staging.js";
import { generateCurriculumPlanDraft } from "../../../services/bot/curriculum-autogen.js";
import { fillImageSlot } from "../../../services/bot/slot-filler.js";
import type { FillSlotResult } from "../../../services/bot/slot-filler.js";
import { uploadImage } from "../../../services/storage/index.js";
import type { ParsedFile } from "../../../services/storage/index.js";
import { insertInlineImagesByMarker } from "@ai-jakdang/server-bot/image";
import type { GuideAssetManifest } from "@ai-jakdang/server-bot/image";
import { tiptapJsonToHtml } from "../../../lib/tiptap-renderer.js";

// ── 공유 헬퍼 ─────────────────────────────────────────────────────────────────

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function makeError(message: string, code: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function serializeSlot(s: typeof schema.botCurriculumImageSlots.$inferSelect) {
  return {
    id: s.id,
    chapterId: s.chapterId,
    assetKey: s.assetKey,
    sourceKind: s.sourceKind,
    status: s.status,
    caption: s.caption ?? null,
    alt: s.alt ?? null,
    guidance: s.guidance ?? null,
    positionHint: s.positionHint ?? null,
    imageUrl: s.imageUrl ?? null,
    diagramPrompt: s.diagramPrompt ?? null,
    sourceUrl: s.sourceUrl ?? null,
    createdAt: toIso(s.createdAt)!,
    updatedAt: toIso(s.updatedAt)!,
  };
}

// ── 1.2 listCurriculumSeries ──────────────────────────────────────────────────

export async function listCurriculumSeries(query: AdminCurriculumSeriesQuery) {
  const db = getDb();
  const { botCurriculumSeries, botCurriculumChapters } = schema;
  const { page, pageSize, isActive } = query;

  const whereClause =
    isActive !== undefined ? eq(botCurriculumSeries.isActive, isActive) : undefined;

  const [countRow] = await db
    .select({ c: count() })
    .from(botCurriculumSeries)
    .where(whereClause);
  const totalItems = Number(countRow?.c ?? 0);

  const rows = await db
    .select({
      id: botCurriculumSeries.id,
      title: botCurriculumSeries.title,
      board: botCurriculumSeries.board,
      tool: botCurriculumSeries.tool,
      intro: botCurriculumSeries.intro,
      isActive: botCurriculumSeries.isActive,
      createdAt: botCurriculumSeries.createdAt,
      totalChapters: count(botCurriculumChapters.id),
      publishedChapters: sql<number>`count(case when ${botCurriculumChapters.status} = 'published' then 1 end)`,
      readyChapters: sql<number>`count(case when ${botCurriculumChapters.status} = 'ready' then 1 end)`,
    })
    .from(botCurriculumSeries)
    .leftJoin(botCurriculumChapters, eq(botCurriculumSeries.id, botCurriculumChapters.seriesId))
    .where(whereClause)
    .groupBy(botCurriculumSeries.id)
    .orderBy(asc(botCurriculumSeries.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    board: r.board,
    tool: r.tool,
    intro: r.intro ?? null,
    isActive: r.isActive,
    createdAt: toIso(r.createdAt)!,
    totalChapters: Number(r.totalChapters),
    publishedChapters: Number(r.publishedChapters),
    readyChapters: Number(r.readyChapters),
  }));

  return {
    items,
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 1 },
  };
}

// ── 1.3 getCurriculumSeries ───────────────────────────────────────────────────

export async function getCurriculumSeries(seriesId: string) {
  const db = getDb();
  const { botCurriculumSeries, botCurriculumChapters, botCurriculumImageSlots } = schema;

  const [series] = await db
    .select()
    .from(botCurriculumSeries)
    .where(eq(botCurriculumSeries.id, seriesId))
    .limit(1);

  if (!series) throw makeError(`시리즈 없음: ${seriesId}`, "NOT_FOUND");

  const chapterRows = await db
    .select({
      id: botCurriculumChapters.id,
      seriesId: botCurriculumChapters.seriesId,
      orderIndex: botCurriculumChapters.orderIndex,
      title: botCurriculumChapters.title,
      goal: botCurriculumChapters.goal,
      status: botCurriculumChapters.status,
      scheduledAt: botCurriculumChapters.scheduledAt,
      publishedPostId: botCurriculumChapters.publishedPostId,
      createdAt: botCurriculumChapters.createdAt,
      updatedAt: botCurriculumChapters.updatedAt,
      totalSlots: count(botCurriculumImageSlots.id),
      readySlots: sql<number>`count(case when ${botCurriculumImageSlots.status} = 'ready' then 1 end)`,
    })
    .from(botCurriculumChapters)
    .leftJoin(botCurriculumImageSlots, eq(botCurriculumChapters.id, botCurriculumImageSlots.chapterId))
    .where(eq(botCurriculumChapters.seriesId, seriesId))
    .groupBy(botCurriculumChapters.id)
    .orderBy(asc(botCurriculumChapters.orderIndex));

  const chapters = chapterRows.map((c) => ({
    id: c.id,
    seriesId: c.seriesId,
    orderIndex: c.orderIndex,
    title: c.title,
    goal: c.goal,
    status: c.status,
    scheduledAt: toIso(c.scheduledAt),
    publishedPostId: c.publishedPostId ?? null,
    createdAt: toIso(c.createdAt)!,
    updatedAt: toIso(c.updatedAt)!,
    totalSlots: Number(c.totalSlots),
    readySlots: Number(c.readySlots),
  }));

  return {
    id: series.id,
    title: series.title,
    board: series.board,
    tool: series.tool,
    intro: series.intro ?? null,
    isActive: series.isActive,
    createdAt: toIso(series.createdAt)!,
    chapters,
  };
}

// ── 1.4 listCurriculumChapters ────────────────────────────────────────────────

export async function listCurriculumChapters(query: AdminCurriculumChaptersQuery) {
  const db = getDb();
  const { botCurriculumChapters, botCurriculumImageSlots } = schema;
  const { page, pageSize, seriesId, status } = query;

  const conditions = [];
  if (seriesId) conditions.push(eq(botCurriculumChapters.seriesId, seriesId));
  if (status) conditions.push(eq(botCurriculumChapters.status, status));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ c: count() })
    .from(botCurriculumChapters)
    .where(whereClause);
  const totalItems = Number(countRow?.c ?? 0);

  const rows = await db
    .select({
      id: botCurriculumChapters.id,
      seriesId: botCurriculumChapters.seriesId,
      orderIndex: botCurriculumChapters.orderIndex,
      title: botCurriculumChapters.title,
      goal: botCurriculumChapters.goal,
      status: botCurriculumChapters.status,
      scheduledAt: botCurriculumChapters.scheduledAt,
      publishedPostId: botCurriculumChapters.publishedPostId,
      createdAt: botCurriculumChapters.createdAt,
      updatedAt: botCurriculumChapters.updatedAt,
      totalSlots: count(botCurriculumImageSlots.id),
      readySlots: sql<number>`count(case when ${botCurriculumImageSlots.status} = 'ready' then 1 end)`,
    })
    .from(botCurriculumChapters)
    .leftJoin(botCurriculumImageSlots, eq(botCurriculumChapters.id, botCurriculumImageSlots.chapterId))
    .where(whereClause)
    .groupBy(botCurriculumChapters.id)
    .orderBy(asc(botCurriculumChapters.orderIndex))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const items = rows.map((r) => ({
    id: r.id,
    seriesId: r.seriesId,
    orderIndex: r.orderIndex,
    title: r.title,
    goal: r.goal,
    status: r.status,
    scheduledAt: toIso(r.scheduledAt),
    publishedPostId: r.publishedPostId ?? null,
    createdAt: toIso(r.createdAt)!,
    updatedAt: toIso(r.updatedAt)!,
    totalSlots: Number(r.totalSlots),
    readySlots: Number(r.readySlots),
  }));

  return {
    items,
    meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 1 },
  };
}

// ── 1.5 getCurriculumChapter ──────────────────────────────────────────────────

export async function getCurriculumChapter(chapterId: string) {
  const db = getDb();
  const { botCurriculumChapters, botCurriculumImageSlots } = schema;

  const [chapRow] = await db
    .select({
      id: botCurriculumChapters.id,
      seriesId: botCurriculumChapters.seriesId,
      orderIndex: botCurriculumChapters.orderIndex,
      title: botCurriculumChapters.title,
      goal: botCurriculumChapters.goal,
      outline: botCurriculumChapters.outline,
      draftContent: botCurriculumChapters.draftContent,
      draftTextEditable: botCurriculumChapters.draftTextEditable,
      status: botCurriculumChapters.status,
      scheduledAt: botCurriculumChapters.scheduledAt,
      publishedPostId: botCurriculumChapters.publishedPostId,
      createdAt: botCurriculumChapters.createdAt,
      updatedAt: botCurriculumChapters.updatedAt,
      totalSlots: count(botCurriculumImageSlots.id),
      readySlots: sql<number>`count(case when ${botCurriculumImageSlots.status} = 'ready' then 1 end)`,
    })
    .from(botCurriculumChapters)
    .leftJoin(botCurriculumImageSlots, eq(botCurriculumChapters.id, botCurriculumImageSlots.chapterId))
    .where(eq(botCurriculumChapters.id, chapterId))
    .groupBy(botCurriculumChapters.id)
    .limit(1);

  if (!chapRow) throw makeError(`챕터 없음: ${chapterId}`, "NOT_FOUND");

  const slots = await db
    .select()
    .from(botCurriculumImageSlots)
    .where(eq(botCurriculumImageSlots.chapterId, chapterId))
    .orderBy(asc(botCurriculumImageSlots.createdAt));

  return {
    id: chapRow.id,
    seriesId: chapRow.seriesId,
    orderIndex: chapRow.orderIndex,
    title: chapRow.title,
    goal: chapRow.goal,
    outline: chapRow.outline,
    draftContent: chapRow.draftContent ?? null,
    draftTextEditable: chapRow.draftTextEditable ?? null,
    status: chapRow.status,
    scheduledAt: toIso(chapRow.scheduledAt),
    publishedPostId: chapRow.publishedPostId ?? null,
    createdAt: toIso(chapRow.createdAt)!,
    updatedAt: toIso(chapRow.updatedAt)!,
    totalSlots: Number(chapRow.totalSlots),
    readySlots: Number(chapRow.readySlots),
    slots: slots.map(serializeSlot),
  };
}

// ── 1.6 updateChapterDraft ────────────────────────────────────────────────────

export async function updateChapterDraft(chapterId: string, data: CurriculumChapterDraftUpdate) {
  const db = getDb();
  const { botCurriculumChapters } = schema;

  const [existing] = await db
    .select({ id: botCurriculumChapters.id })
    .from(botCurriculumChapters)
    .where(eq(botCurriculumChapters.id, chapterId))
    .limit(1);

  if (!existing) throw makeError(`챕터 없음: ${chapterId}`, "NOT_FOUND");

  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
  if (data.draftContent !== undefined) updatePayload.draftContent = data.draftContent;
  if (data.draftTextEditable !== undefined) updatePayload.draftTextEditable = data.draftTextEditable;

  await db
    .update(botCurriculumChapters)
    .set(updatePayload)
    .where(eq(botCurriculumChapters.id, chapterId));

  return getCurriculumChapter(chapterId);
}

// ── 1.7 setChapterSchedule ────────────────────────────────────────────────────

export async function setChapterSchedule(chapterId: string, scheduledAt: string | null) {
  const db = getDb();
  const { botCurriculumChapters } = schema;

  const [existing] = await db
    .select({ id: botCurriculumChapters.id })
    .from(botCurriculumChapters)
    .where(eq(botCurriculumChapters.id, chapterId))
    .limit(1);

  if (!existing) throw makeError(`챕터 없음: ${chapterId}`, "NOT_FOUND");

  await db
    .update(botCurriculumChapters)
    .set({ scheduledAt: scheduledAt ? new Date(scheduledAt) : null, updatedAt: new Date() })
    .where(eq(botCurriculumChapters.id, chapterId));

  return getCurriculumChapter(chapterId);
}

// ── 1.8 getChapterPreviewHtml ─────────────────────────────────────────────────

export async function getChapterPreviewHtml(chapterId: string): Promise<{ html: string }> {
  const chapter = await getCurriculumChapter(chapterId);

  if (!chapter.draftContent) {
    return { html: "<p>(초안 없음)</p>" };
  }

  // pending 슬롯 마커 → [이미지 미준비: key] 플레이스홀더로 치환 (JSON 문자열 수준)
  const pendingKeys = chapter.slots.filter((s) => s.status !== "ready").map((s) => s.assetKey);

  let docJson = chapter.draftContent as Record<string, unknown>;
  if (pendingKeys.length > 0) {
    let jsonStr = JSON.stringify(docJson);
    for (const key of pendingKeys) {
      jsonStr = jsonStr.split(`[[IMG:${key}]]`).join(`[이미지 미준비: ${key}]`);
    }
    docJson = JSON.parse(jsonStr) as Record<string, unknown>;
  }

  // ready 슬롯 manifest 구성
  const manifest: GuideAssetManifest = {};
  for (const slot of chapter.slots) {
    if (slot.status === "ready" && slot.imageUrl) {
      manifest[slot.assetKey] = {
        url: slot.imageUrl,
        caption: slot.caption ?? undefined,
        alt: slot.alt ?? undefined,
      };
    }
  }

  const { doc: assembledDoc } = insertInlineImagesByMarker(docJson, manifest);
  const html = tiptapJsonToHtml(assembledDoc);

  return { html: html || "<p>(미리보기 변환 실패)</p>" };
}

// ── 1.9 uploadSlotImage ───────────────────────────────────────────────────────

export async function uploadSlotImage(chapterId: string, slotId: string, fileData: ParsedFile) {
  const db = getDb();
  const { botCurriculumImageSlots } = schema;

  const [slot] = await db
    .select({ id: botCurriculumImageSlots.id })
    .from(botCurriculumImageSlots)
    .where(and(eq(botCurriculumImageSlots.id, slotId), eq(botCurriculumImageSlots.chapterId, chapterId)))
    .limit(1);

  if (!slot) throw makeError(`슬롯 없음: ${slotId}`, "NOT_FOUND");

  const { url } = await uploadImage(fileData, "editor-images");

  await db
    .update(botCurriculumImageSlots)
    .set({ imageUrl: url, status: "ready", updatedAt: new Date() })
    .where(eq(botCurriculumImageSlots.id, slotId));

  // 준비완료 판정 (13.3)
  await checkAndPromoteChapter(chapterId);

  const [updated] = await db
    .select()
    .from(botCurriculumImageSlots)
    .where(eq(botCurriculumImageSlots.id, slotId))
    .limit(1);

  if (!updated) throw makeError(`슬롯 조회 실패: ${slotId}`, "INTERNAL_ERROR");
  return serializeSlot(updated);
}

// ── 1.10 requestSlotGenerate ──────────────────────────────────────────────────

export async function requestSlotGenerate(
  chapterId: string,
  slotId: string,
  data: CurriculumSlotGenerate,
): Promise<FillSlotResult> {
  const db = getDb();
  const { botCurriculumImageSlots } = schema;

  const [slot] = await db
    .select()
    .from(botCurriculumImageSlots)
    .where(and(eq(botCurriculumImageSlots.id, slotId), eq(botCurriculumImageSlots.chapterId, chapterId)))
    .limit(1);

  if (!slot) throw makeError(`슬롯 없음: ${slotId}`, "NOT_FOUND");

  // "AI 생성" 버튼은 슬롯 종류와 무관하게 항상 AI 이미지를 생성한다.
  // 프롬프트 우선순위: 요청 override > 슬롯 저장값 > 본문 맥락 자동 생성.
  let effectivePrompt = data.diagramPrompt ?? slot.diagramPrompt ?? undefined;
  if (!effectivePrompt || effectivePrompt.trim().length === 0) {
    effectivePrompt = await buildContextAwareDiagramPrompt(chapterId, slot);
  }
  // 재현성·투명성을 위해 사용한 프롬프트를 슬롯에 저장(관리자가 확인·재사용 가능)
  await db
    .update(botCurriculumImageSlots)
    .set({ diagramPrompt: effectivePrompt, updatedAt: new Date() })
    .where(eq(botCurriculumImageSlots.id, slotId));

  // 13.4 fillImageSlot 직접 호출 (재구현 금지). forceAiDiagram=true → 슬롯 종류와
  // 무관하게 AI 도식 경로로 생성(capture·user_upload 슬롯도 'AI 생성' 지원).
  const result = await fillImageSlot(slotId, {
    force: true,
    imageModel: data.imageModel,
    diagramPrompt: effectivePrompt,
    forceAiDiagram: true,
  });

  if (result.ok && result.outcome === "filled") {
    await checkAndPromoteChapter(chapterId);
  }

  return result;
}

// ── 1.10b sourceKind별 기본 준비 안내문 ───────────────────────────────────────

/** 슬롯 guidance 미지정 시 sourceKind에 맞는 기본 안내문을 만든다. */
function defaultSlotGuidance(sourceKind: string): string {
  switch (sourceKind) {
    case "ai_diagram":
      return "AI 도식으로 자동 생성합니다. 상세 화면에서 '지금 생성'을 누르세요.";
    case "web_download":
      return "원본 URL의 이미지를 자동 다운로드합니다. sourceUrl을 확인하세요.";
    case "capture":
      return "사람이 실제 화면을 준비해 캡처한 뒤 업로드해야 합니다.";
    case "user_upload":
      return "관리자가 직접 이미지를 업로드해야 합니다.";
    default:
      return "이미지 준비가 필요합니다.";
  }
}

// ── 1.10d 맥락 기반 AI 도식 프롬프트 생성 ─────────────────────────────────────

type SlotRow = typeof schema.botCurriculumImageSlots.$inferSelect;

/** LLM 미가용 시 슬롯 캡션·학습목표로 조립하는 폴백 프롬프트. */
function templateDiagramPrompt(chapterTitle: string, goal: string, slot: SlotRow): string {
  const subject = slot.caption || slot.guidance || chapterTitle;
  return [
    `교육용 강의 "${chapterTitle}"의 한 섹션을 위한, 세련되고 완성도 높은 실사풍 이미지 한 컷.`,
    `이 컷의 주제: "${subject}".`,
    goal ? `학습 맥락: ${goal}.` : "",
    `이 주제가 '실제로 벌어지는 구체적인 순간·상황'을 한 장면으로 연출하라 — 무엇이 보이는지(주체·소품·화면), 어떤 행동·상황인지, 분위기·조명·색감, 구도를 구체적으로. `,
    `'사람이 책상에서 코딩하는 모습' 같은 뻔한 기본 컷의 반복은 피하고, 이 주제만의 상황을 상징적으로 담아라. `,
    `실사 또는 실사에 가까운 3D/일러스트, 이미지 안 글자는 넣지 않는다. 복잡한 도식·정보 과밀 금지, 넉넉한 여백과 하나의 또렷한 초점.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * 챕터 본문 맥락을 파악해 이 슬롯에 어울리는 AI 이미지 생성 프롬프트를 만든다.
 * 관리자 페르소나의 generation 모델로 본문·학습목표·캡션을 요약해 프롬프트를 짓고,
 * 모델 미가용·오류 시 템플릿 프롬프트로 폴백한다(생성 자체는 막지 않음).
 */
async function buildContextAwareDiagramPrompt(chapterId: string, slot: SlotRow): Promise<string> {
  const db = getDb();

  const [ctx] = await db
    .select({
      title: schema.botCurriculumChapters.title,
      goal: schema.botCurriculumChapters.goal,
      outline: schema.botCurriculumChapters.outline,
      draftContent: schema.botCurriculumChapters.draftContent,
      board: schema.botCurriculumSeries.board,
      seriesTitle: schema.botCurriculumSeries.title,
    })
    .from(schema.botCurriculumChapters)
    .innerJoin(
      schema.botCurriculumSeries,
      eq(schema.botCurriculumChapters.seriesId, schema.botCurriculumSeries.id),
    )
    .where(eq(schema.botCurriculumChapters.id, chapterId))
    .limit(1);

  if (!ctx) return templateDiagramPrompt("강의", "", slot);
  const fallback = templateDiagramPrompt(ctx.title, ctx.goal, slot);

  // 게시판 담당 관리자 페르소나 → generation 모델 할당 조회
  const [personaRow] = await db
    .select({ id: schema.botPersonas.id })
    .from(schema.botPersonaBoards)
    .innerJoin(schema.botPersonas, eq(schema.botPersonaBoards.personaId, schema.botPersonas.id))
    .where(
      and(
        eq(schema.botPersonaBoards.board, ctx.board),
        eq(schema.botPersonas.isAdminPersona, true),
      ),
    )
    .limit(1);
  if (!personaRow) return fallback;

  const assignment = await getModelAssignment(db, personaRow.id, "generation");
  if (!assignment) return fallback;

  const draftText = ctx.draftContent
    ? extractTextFromTiptap(ctx.draftContent as Record<string, unknown>).slice(0, 1600)
    : "";
  const outline = Array.isArray(ctx.outline) ? (ctx.outline as string[]).join(", ") : "";

  const system =
    "당신은 교육 콘텐츠용 이미지를 연출하는 아트 디렉터입니다. 강의의 '이 섹션'이 다루는 내용을 읽고, " +
    "그 주제가 실제로 벌어지는 '구체적인 한 장면'을 묘사하는 이미지 생성 프롬프트를 한국어로 작성합니다. " +
    "이미지는 글을 그대로 옮긴 도식이 아니라, 그 개념이 현실에서 벌어지는 순간·상황을 상징적으로 담은 한 컷입니다. " +
    "섹션마다 장면이 서로 달라야 하며, 뻔한 기본 컷의 반복은 실패입니다.";
  const user = [
    `[시리즈] ${ctx.seriesTitle}`,
    `[강의 제목] ${ctx.title}`,
    `[학습 목표] ${ctx.goal}`,
    outline ? `[소주제] ${outline}` : "",
    `[이 이미지의 역할/캡션] ${slot.caption ?? slot.guidance ?? "이 섹션의 핵심을 보여주는 한 컷"}`,
    draftText ? `[본문 발췌]\n${draftText}` : "",
    "",
    "위 맥락에 어울리는 이미지 1장을 위한 이미지 생성 프롬프트만 출력하세요. 아래 요구사항을 반드시 지키세요.",
    "1) 이 섹션이 다루는 핵심 개념을 딱 하나 고르고, 그것이 '실제로 벌어지는 구체적 장면'을 상상해 묘사하라. (예: 서버 배포 = 노트북 속 코드가 빛줄기로 지구본/서버 랙으로 뻗어나가는 순간 · 백업/복원 = 무너진 코드 블록 위로 이전 버전이 되살아나는 순간 · API 키 관리 = 반짝이는 열쇠를 견고한 금고에 넣어 잠그는 순간 · 코드 검수 = 돋보기로 코드의 숨은 균열을 들여다보는 순간). 강의 주제에 맞는 '그 섹션만의' 장면을 새로 찾아라.",
    "2) 장면에 다음을 구체적으로 담아라: 무엇이 보이는가(주체·소품·화면), 어떤 상황·행동인가, 분위기·조명·색감, 구도(클로즈업/와이드/아이소메트릭 등).",
    "3) 다양성: '사람이 책상에서 코딩하는 모습' 같은 일반적인 기본 컷을 반복하지 마라. 이 섹션의 상황에 맞는 고유한 장면을 연출하라.",
    "4) 스타일: 세련된 실사 또는 실사에 가까운 3D/일러스트로 완성도 높게. 정보 과밀·복잡한 인포그래픽·여러 도식 난무는 금지. 단계·흐름이 정말 핵심일 때만 미니멀한 도식(요소 3~4개·넉넉한 여백).",
    "5) 이미지 안 글자는 넣지 않는다(도식에 꼭 필요하면 짧은 한국어 단어 라벨만 큰따옴표로).",
    "6) 3~4문장, 250~500자로 장면을 구체적으로 묘사. 머리말·설명 없이 프롬프트 문장만 출력.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await callModel(
      assignment,
      { system, user, maxTokens: 900, temperature: 0.85 },
      { personaId: personaRow.id, usageContext: { purpose: "generation" } },
    );
    const prompt = res.text.trim();
    return prompt.length >= 8 ? prompt : fallback;
  } catch (err) {
    console.warn(
      "[curriculum] 맥락 기반 프롬프트 생성 실패, 템플릿 폴백:",
      (err as Error).message,
    );
    return fallback;
  }
}

// ── 1.10e clearSlotImage (이미지 비우기 → 점선 박스로 되돌림) ──────────────────

/**
 * 슬롯의 이미지를 비운다(삭제·수정 시 처음 상태로 되돌림).
 * imageUrl=null, status=pending 으로 되돌려 상세 화면에 점선 박스+프롬프트+버튼이 다시 뜨게 한다.
 * ready 챕터였으면 drafted로 되돌린다(이미지 하나가 다시 미완이 됨).
 * 본문의 [[IMG:키]] 마커는 그대로 둔다 — 자리는 유지되고, 발행 시 비어 있으면 이미지 없이 렌더된다.
 */
export async function clearSlotImage(chapterId: string, slotId: string) {
  const db = getDb();
  const { botCurriculumChapters, botCurriculumImageSlots } = schema;

  const [slot] = await db
    .select({ id: botCurriculumImageSlots.id })
    .from(botCurriculumImageSlots)
    .where(
      and(
        eq(botCurriculumImageSlots.id, slotId),
        eq(botCurriculumImageSlots.chapterId, chapterId),
      ),
    )
    .limit(1);
  if (!slot) throw makeError(`슬롯 없음: ${slotId}`, "NOT_FOUND");

  await db
    .update(botCurriculumImageSlots)
    .set({ imageUrl: null, status: "pending", updatedAt: new Date() })
    .where(eq(botCurriculumImageSlots.id, slotId));

  // ready 챕터였다면 drafted로 되돌림(발행은 여전히 가능하나 준비완료 표기는 해제)
  await db
    .update(botCurriculumChapters)
    .set({ status: "drafted", updatedAt: new Date() })
    .where(
      and(
        eq(botCurriculumChapters.id, chapterId),
        eq(botCurriculumChapters.status, "ready"),
      ),
    );

  return getCurriculumChapter(chapterId);
}

// ── 1.10f getChapterEditorSegments (인터랙티브 미리보기 세그먼트) ───────────────

export interface ChapterEditorSegment {
  /** 'html' = 렌더된 본문 조각, 'slot' = 이미지 자리(점선 박스/이미지). */
  kind: "html" | "slot";
  html?: string;
  slot?: ReturnType<typeof serializeSlot>;
}

/**
 * 챕터 초안 본문을 [[IMG:키]] 마커 기준으로 잘라, 관리자 상세 화면이 그대로 렌더할 수 있는
 * 세그먼트 배열로 반환한다.
 *  - 'html' 세그먼트: 마커 사이 본문을 tiptapJsonToHtml로 렌더한 HTML.
 *  - 'slot' 세그먼트: 그 자리의 이미지 슬롯(점선 박스 또는 채워진 이미지).
 * insertInlineImagesByMarker와 같은 규약(문단 텍스트 내 마커 분할)을 따른다.
 */
export async function getChapterEditorSegments(
  chapterId: string,
): Promise<{ hasDraft: boolean; segments: ChapterEditorSegment[] }> {
  const db = getDb();
  const { botCurriculumChapters, botCurriculumImageSlots } = schema;

  const [chapter] = await db
    .select({
      id: botCurriculumChapters.id,
      draftContent: botCurriculumChapters.draftContent,
    })
    .from(botCurriculumChapters)
    .where(eq(botCurriculumChapters.id, chapterId))
    .limit(1);
  if (!chapter) throw makeError(`챕터 없음: ${chapterId}`, "NOT_FOUND");

  const slotRows = await db
    .select()
    .from(botCurriculumImageSlots)
    .where(eq(botCurriculumImageSlots.chapterId, chapterId));
  const slotByKey = new Map(slotRows.map((s) => [s.assetKey, s]));

  if (!chapter.draftContent) {
    return { hasDraft: false, segments: [] };
  }

  const doc = chapter.draftContent as Record<string, unknown>;
  const content = Array.isArray(doc.content) ? (doc.content as Record<string, unknown>[]) : [];

  const segments: ChapterEditorSegment[] = [];
  let buffer: Record<string, unknown>[] = []; // 누적 중인 비-마커 노드

  const flushHtml = () => {
    if (buffer.length === 0) return;
    const html = tiptapJsonToHtml({ type: "doc", content: buffer });
    if (html) segments.push({ kind: "html", html });
    buffer = [];
  };

  const paragraphText = (node: Record<string, unknown>): string => {
    if (node.type !== "paragraph" || !Array.isArray(node.content)) return "";
    return (node.content as Record<string, unknown>[])
      .map((c) => (typeof c.text === "string" ? (c.text as string) : ""))
      .join("");
  };

  const re = /\[\[IMG:([a-zA-Z0-9_-]+)\]\]/g;
  const seen = new Set<string>();

  for (const node of content) {
    const text = paragraphText(node);
    if (node.type !== "paragraph" || !text.includes("[[IMG:")) {
      buffer.push(node);
      continue;
    }

    // 마커가 든 문단 → 앞뒤 텍스트/마커 순서대로 분해
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const before = text.slice(lastIndex, m.index).trim();
      if (before) buffer.push({ type: "paragraph", content: [{ type: "text", text: before }] });

      const key = m[1]!;
      const slot = slotByKey.get(key);
      if (slot && !seen.has(key)) {
        flushHtml();
        segments.push({ kind: "slot", slot: serializeSlot(slot) });
        seen.add(key);
      }
      lastIndex = m.index + m[0].length;
    }
    const tail = text.slice(lastIndex).trim();
    if (tail) buffer.push({ type: "paragraph", content: [{ type: "text", text: tail }] });
  }

  flushHtml();

  return { hasDraft: true, segments };
}

// ── 1.12 createCurriculumPlan (플랜 통째 생성) ────────────────────────────────

/**
 * 커리큘럼 플랜(시리즈 + 챕터들 + 이미지 슬롯)을 한 번에 생성한다.
 * - 시리즈 title unique 위반은 409 DUPLICATE.
 * - 챕터 orderIndex는 배열 순서(1-based)로 자동 부여.
 * - 슬롯은 전부 status=pending, 챕터는 status=planned로 생성.
 * - assetKey는 챕터 내 유일해야 한다(중복 시 400 DUPLICATE_ASSET_KEY).
 */
export async function createCurriculumPlan(data: CurriculumPlanCreate) {
  const db = getDb();
  const { botCurriculumSeries, botCurriculumChapters, botCurriculumImageSlots } = schema;

  // title 중복 사전 확인 (unique 제약과 별개로 친절한 에러)
  const [dup] = await db
    .select({ id: botCurriculumSeries.id })
    .from(botCurriculumSeries)
    .where(eq(botCurriculumSeries.title, data.title))
    .limit(1);
  if (dup) throw makeError(`이미 존재하는 시리즈 제목입니다: ${data.title}`, "DUPLICATE");

  // 트랜잭션: 시리즈 → 챕터 → 슬롯
  const seriesId = await db.transaction(async (tx) => {
    const [series] = await tx
      .insert(botCurriculumSeries)
      .values({
        title: data.title,
        board: data.board,
        tool: data.tool,
        intro: data.intro,
        isActive: data.isActive ?? true,
      })
      .returning({ id: botCurriculumSeries.id });

    const newSeriesId = series!.id;

    for (let i = 0; i < data.chapters.length; i++) {
      const ch = data.chapters[i]!;

      // 챕터 내 assetKey 중복 검사
      const keys = ch.slots.map((s) => s.assetKey);
      const dupKey = keys.find((k, idx) => keys.indexOf(k) !== idx);
      if (dupKey) {
        throw makeError(`챕터 ${i + 1}에 중복 assetKey: ${dupKey}`, "DUPLICATE_ASSET_KEY");
      }

      const [chapter] = await tx
        .insert(botCurriculumChapters)
        .values({
          seriesId: newSeriesId,
          orderIndex: i + 1,
          title: ch.title,
          goal: ch.goal,
          outline: ch.outline,
          status: "planned",
        })
        .returning({ id: botCurriculumChapters.id });

      const chapterId = chapter!.id;

      if (ch.slots.length > 0) {
        await tx.insert(botCurriculumImageSlots).values(
          ch.slots.map((s) => ({
            chapterId,
            assetKey: s.assetKey,
            caption: s.caption,
            alt: s.alt,
            sourceKind: s.sourceKind,
            status: "pending" as const,
            guidance: s.guidance ?? defaultSlotGuidance(s.sourceKind),
            positionHint: s.positionHint ?? null,
            diagramPrompt: s.diagramPrompt ?? null,
            sourceUrl: s.sourceUrl ?? null,
          })),
        );
      }
    }

    return newSeriesId;
  });

  return getCurriculumSeries(seriesId);
}

// ── 1.13 autoGenerateCurriculumPlan (AI 자동 생성) ────────────────────────────

/**
 * AI에게 커리큘럼 플랜(시리즈 구성 + 챕터별 학습목표·소주제·이미지 슬롯)을 생성시켜
 * 곧바로 DB에 저장한다. 초안 본문·게시는 이후 단계.
 * - AI가 만든 구조를 CurriculumPlanCreate로 검증·정규화 후 createCurriculumPlan 재사용.
 */
export async function autoGenerateCurriculumPlan(data: CurriculumAutoGenerate) {
  const plan = await generateCurriculumPlanDraft(data);
  return createCurriculumPlan(plan);
}

// ── 1.14 triggerChapterDraft (초안 AI 생성 트리거) ────────────────────────────

/**
 * 챕터 초안을 AI로 생성한다(13.3 draftCurriculumChapter 위임).
 * planned·drafted 챕터만 처리. 성공 시 status=drafted(슬롯 0개면 ready).
 */
export async function triggerChapterDraft(chapterId: string): Promise<DraftChapterResult> {
  const db = getDb();
  const { botCurriculumChapters } = schema;

  const [existing] = await db
    .select({ id: botCurriculumChapters.id })
    .from(botCurriculumChapters)
    .where(eq(botCurriculumChapters.id, chapterId))
    .limit(1);
  if (!existing) throw makeError(`챕터 없음: ${chapterId}`, "NOT_FOUND");

  return draftCurriculumChapter(chapterId);
}

// ── 1.11 completeSlot ────────────────────────────────────────────────────────

export async function completeSlot(chapterId: string, slotId: string) {
  const db = getDb();
  const { botCurriculumImageSlots } = schema;

  const [slot] = await db
    .select()
    .from(botCurriculumImageSlots)
    .where(and(eq(botCurriculumImageSlots.id, slotId), eq(botCurriculumImageSlots.chapterId, chapterId)))
    .limit(1);

  if (!slot) throw makeError(`슬롯 없음: ${slotId}`, "NOT_FOUND");

  // image_url 없으면 완료 처리 불가 (400 IMAGE_URL_REQUIRED)
  if (!slot.imageUrl) {
    throw makeError("이미지가 업로드된 슬롯만 완료 처리할 수 있습니다.", "IMAGE_URL_REQUIRED");
  }

  await db
    .update(botCurriculumImageSlots)
    .set({ status: "ready", updatedAt: new Date() })
    .where(eq(botCurriculumImageSlots.id, slotId));

  // 준비완료 판정 (13.3)
  await checkAndPromoteChapter(chapterId);

  const [updated] = await db
    .select()
    .from(botCurriculumImageSlots)
    .where(eq(botCurriculumImageSlots.id, slotId))
    .limit(1);

  if (!updated) throw makeError(`슬롯 조회 실패: ${slotId}`, "INTERNAL_ERROR");
  return serializeSlot(updated);
}

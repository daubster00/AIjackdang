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
} from "@ai-jakdang/contracts";
import { checkAndPromoteChapter } from "../../../services/bot/curriculum-staging.js";
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

  // capture·user_upload는 자동 생성 불가 (400 INVALID_SOURCE_KIND)
  if (slot.sourceKind !== "ai_diagram" && slot.sourceKind !== "web_download") {
    throw makeError(
      `source_kind '${slot.sourceKind}'는 자동 생성을 지원하지 않습니다. ai_diagram·web_download만 허용됩니다.`,
      "INVALID_SOURCE_KIND",
    );
  }

  // 13.4 fillImageSlot 직접 호출 (재구현 금지)
  const result = await fillImageSlot(slotId, {
    force: data.force,
    imageModel: data.imageModel,
    diagramPrompt: data.diagramPrompt,
  });

  if (result.ok && result.outcome === "filled") {
    await checkAndPromoteChapter(chapterId);
  }

  return result;
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

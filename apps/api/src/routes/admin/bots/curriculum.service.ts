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

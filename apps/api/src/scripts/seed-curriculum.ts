/**
 * 커리큘럼 초기 시드 스크립트 (멱등).
 *
 * apps/api/src/services/bot/curriculum.ts 의 GUIDE_SERIES(두 시리즈×5강) 데이터를
 * bot_curriculum_series · bot_curriculum_chapters · bot_curriculum_image_slots 3개 테이블에
 * ON CONFLICT DO NOTHING 으로 멱등 삽입한다.
 *
 * 추가로:
 *  - bot_settings.guide_asset_manifest 이 존재하면 각 슬롯의 image_url 이식 + status='ready'.
 *  - bot_settings.guide_progress 이 존재하면 발행 편 status='published', continuitySummary 이식.
 *
 * 실행:
 *   DATABASE_URL="..." pnpm --filter @ai-jakdang/api exec tsx src/scripts/seed-curriculum.ts
 *
 * [Source: _bmad-output/implementation-artifacts/13-1-curriculum-db-schema-seed.md]
 */

import { getDb, closeDb } from "@ai-jakdang/database";
import {
  botCurriculumSeries,
  botCurriculumChapters,
  botCurriculumImageSlots,
} from "@ai-jakdang/database/schema";
import { eq, and } from "drizzle-orm";
import { GUIDE_SERIES } from "../services/bot/curriculum.js";
import type { GuideImageSlot } from "../services/bot/curriculum.js";

// bot_settings 조회는 Redis 없이 DB 직접(스크립트 환경).
import { botSettings } from "@ai-jakdang/database/schema";

// ── 상수 ──────────────────────────────────────────────────────────────────────

const GUIDE_PROGRESS_KEY = "guide_progress";
const GUIDE_ASSET_MANIFEST_KEY = "guide_asset_manifest";

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface GuideSeriesProgress {
  published: number[];
  summaries: Record<string, string>;
}
type GuideProgressMap = Record<string, GuideSeriesProgress>;

interface GuideAssetManifestEntry {
  url: string;
  caption?: string;
  alt?: string;
  sourceLabel?: string;
  sourceUrl?: string;
}
type GuideAssetManifest = Record<string, GuideAssetManifestEntry>;

// ── guidance 자동 생성 헬퍼 ──────────────────────────────────────────────────

/**
 * source_kind 별 guidance(관리자용 상세 준비 안내) 문자열을 자동 생성한다.
 * [Source: 13-1-curriculum-db-schema-seed.md Dev Notes — guidance 자동 생성 규칙]
 */
function buildGuidance(slot: GuideImageSlot, sourceKind: string): string {
  switch (sourceKind) {
    case "ai_diagram":
      return `AI 도식 생성. 아래 프롬프트로 Gemini genImage 호출.\n프롬프트: ${slot.diagramPrompt ?? ""}`;
    case "web_download":
      return `공식문서 이미지 다운로드.\n출처: ${slot.sourceLabel ?? ""}(${slot.sourcePageUrl ?? ""})\n원본 URL: ${slot.sourceUrl ?? ""}`;
    case "capture":
      return "실제 화면 캡처 필요. 사람이 앱/브라우저 세팅 후 Playwright 또는 PowerShell로 캡처.";
    case "user_upload":
    default:
      return "관리자가 직접 제작 후 업로드 버튼으로 첨부.";
  }
}

/**
 * curriculum.ts GuideImageSlot.kind + sourceUrl 조합을 source_kind enum 값으로 매핑한다.
 * [Source: 13-1-curriculum-db-schema-seed.md Dev Notes — source_kind 매핑 규칙]
 */
function resolveSourceKind(slot: GuideImageSlot): "ai_diagram" | "web_download" | "capture" | "user_upload" {
  if (slot.kind === "diagram") return "ai_diagram";
  // kind === "screenshot"
  if (slot.sourceUrl) return "web_download";
  return "capture";
}

// ── bot_settings 직접 조회 (Redis 없음) ──────────────────────────────────────

async function getRawBotSetting<T>(key: string): Promise<T | null> {
  const db = getDb();
  const [row] = await db
    .select({ value: botSettings.value })
    .from(botSettings)
    .where(eq(botSettings.key, key))
    .limit(1);
  return (row?.value ?? null) as T | null;
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = getDb();

  console.info("[seed-curriculum] 커리큘럼 시드 시작");
  console.info(`[seed-curriculum] GUIDE_SERIES 시리즈 수: ${GUIDE_SERIES.length}`);

  let seriesInserted = 0;
  let chaptersInserted = 0;
  let slotsInserted = 0;

  // ── 1. bot_settings 에서 매니페스트·진척 조회 ─────────────────────────────

  const manifest = await getRawBotSetting<GuideAssetManifest>(GUIDE_ASSET_MANIFEST_KEY);
  const progressMap = await getRawBotSetting<GuideProgressMap>(GUIDE_PROGRESS_KEY);

  if (manifest) {
    console.info(`[seed-curriculum] guide_asset_manifest 존재 — 키 수: ${Object.keys(manifest).length}`);
  } else {
    console.info("[seed-curriculum] guide_asset_manifest 없음 — image_url=null, status=pending 유지");
  }

  if (progressMap) {
    console.info(`[seed-curriculum] guide_progress 존재 — 시리즈 수: ${Object.keys(progressMap).length}`);
  } else {
    console.info("[seed-curriculum] guide_progress 없음 — 모든 챕터 status=planned 유지");
  }

  // ── 2. 시리즈·챕터·슬롯 삽입 ─────────────────────────────────────────────

  for (const series of GUIDE_SERIES) {
    // 2-1. 시리즈 삽입 (ON CONFLICT title DO NOTHING)
    const insertedSeries = await db
      .insert(botCurriculumSeries)
      .values({
        title: series.title,
        board: series.board,
        tool: series.tool,
        intro: series.intro,
        isActive: true,
      })
      .onConflictDoNothing({ target: botCurriculumSeries.title })
      .returning({ id: botCurriculumSeries.id });

    // 삽입됐으면 반환, 아니면 기존 row를 조회
    let seriesId: string;
    if (insertedSeries.length > 0) {
      seriesId = insertedSeries[0]!.id;
      seriesInserted++;
      console.info(`  [series] 삽입: "${series.title}" (id=${seriesId})`);
    } else {
      const existing = await db
        .select({ id: botCurriculumSeries.id })
        .from(botCurriculumSeries)
        .where(eq(botCurriculumSeries.title, series.title))
        .limit(1);
      seriesId = existing[0]!.id;
      console.info(`  [series] 기존: "${series.title}" (id=${seriesId})`);
    }

    const seriesProgress = progressMap?.[series.title];

    // 2-2. 챕터 삽입
    for (const chapter of series.chapters) {
      const chapterStatus =
        seriesProgress?.published.includes(chapter.order) ? "published" : "planned";
      const continuitySummary =
        seriesProgress?.summaries?.[String(chapter.order)] ?? null;

      const insertedChapter = await db
        .insert(botCurriculumChapters)
        .values({
          seriesId,
          orderIndex: chapter.order,
          title: chapter.title,
          goal: chapter.goal,
          outline: chapter.outline,
          status: chapterStatus as "planned" | "published",
          continuitySummary,
        })
        .onConflictDoNothing({
          target: [botCurriculumChapters.seriesId, botCurriculumChapters.orderIndex],
        })
        .returning({ id: botCurriculumChapters.id });

      let chapterId: string;
      if (insertedChapter.length > 0) {
        chapterId = insertedChapter[0]!.id;
        chaptersInserted++;
        console.info(`    [chapter] 삽입: ${chapter.order}강 "${chapter.title}" status=${chapterStatus}`);
      } else {
        // 기존 챕터 ID 조회
        const existing = await db
          .select({ id: botCurriculumChapters.id })
          .from(botCurriculumChapters)
          .where(
            and(
              eq(botCurriculumChapters.seriesId, seriesId),
              eq(botCurriculumChapters.orderIndex, chapter.order),
            ),
          )
          .limit(1);
        chapterId = existing[0]!.id;
        console.info(`    [chapter] 기존: ${chapter.order}강 "${chapter.title}"`);
      }

      // 2-3. 이미지 슬롯 삽입
      for (const slot of chapter.imageSlots) {
        const sourceKind = resolveSourceKind(slot);
        const guidance = buildGuidance(slot, sourceKind);

        // 매니페스트에서 image_url 조회
        const manifestEntry = manifest?.[slot.assetKey];
        const imageUrl = manifestEntry?.url ?? null;
        const slotStatus: "pending" | "ready" = imageUrl ? "ready" : "pending";

        const insertedSlot = await db
          .insert(botCurriculumImageSlots)
          .values({
            chapterId,
            assetKey: slot.assetKey,
            caption: slot.caption,
            alt: slot.alt,
            guidance,
            sourceKind,
            status: slotStatus,
            imageUrl,
            diagramPrompt: slot.diagramPrompt ?? null,
            sourceUrl: slot.sourceUrl ?? null,
          })
          .onConflictDoNothing({
            target: [botCurriculumImageSlots.chapterId, botCurriculumImageSlots.assetKey],
          })
          .returning({ id: botCurriculumImageSlots.id });

        if (insertedSlot.length > 0) {
          slotsInserted++;
          console.info(
            `      [slot] 삽입: "${slot.assetKey}" sourceKind=${sourceKind} status=${slotStatus}`,
          );
        } else {
          console.info(`      [slot] 기존: "${slot.assetKey}"`);
        }
      }
    }
  }

  // ── 3. guide_progress 가 있으면 이미 발행된 챕터 continuitySummary 이식 ──
  // (ON CONFLICT DO NOTHING 으로 삽입된 경우 이미 처리됨.
  //  기존 row가 있어 삽입이 skip된 경우에도 UPDATE로 반영한다.)
  if (progressMap) {
    console.info("\n[seed-curriculum] guide_progress → continuitySummary 이식 (기존 row 포함)");
    for (const series of GUIDE_SERIES) {
      const seriesProgress = progressMap[series.title];
      if (!seriesProgress) continue;

      const seriesRow = await db
        .select({ id: botCurriculumSeries.id })
        .from(botCurriculumSeries)
        .where(eq(botCurriculumSeries.title, series.title))
        .limit(1);
      if (!seriesRow.length) continue;
      const seriesId = seriesRow[0]!.id;

      for (const chapter of series.chapters) {
        const summary = seriesProgress.summaries?.[String(chapter.order)];
        const isPublished = seriesProgress.published.includes(chapter.order);
        if (!summary && !isPublished) continue;

        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (summary) updateData.continuitySummary = summary;
        if (isPublished) updateData.status = "published";

        await db
          .update(botCurriculumChapters)
          .set(updateData)
          .where(
            and(
              eq(botCurriculumChapters.seriesId, seriesId),
              eq(botCurriculumChapters.orderIndex, chapter.order),
            ),
          );
      }
    }
  }

  // ── 4. guide_asset_manifest 가 있으면 슬롯 image_url 이식 ─────────────────
  if (manifest) {
    console.info("\n[seed-curriculum] guide_asset_manifest → image_url 이식 (기존 row 포함)");
    for (const [assetKey, entry] of Object.entries(manifest)) {
      if (!entry.url) continue;
      await db
        .update(botCurriculumImageSlots)
        .set({ imageUrl: entry.url, status: "ready", updatedAt: new Date() })
        .where(eq(botCurriculumImageSlots.assetKey, assetKey));
    }
  }

  // ── 5. 결과 요약 ─────────────────────────────────────────────────────────────

  console.info("\n[seed-curriculum] 완료");
  console.info(`  series   삽입: ${seriesInserted}건`);
  console.info(`  chapters 삽입: ${chaptersInserted}건`);
  console.info(`  slots    삽입: ${slotsInserted}건`);
}

main()
  .catch((err) => {
    console.error("[seed-curriculum] 오류:", err);
    process.exit(1);
  })
  .finally(() => {
    closeDb().catch(() => {});
  });

/**
 * 가이드 강의 시리즈 이미지 에셋 조달 스크립트 (1회성 준비).
 *
 * 커리큘럼(curriculum.ts)의 모든 이미지 슬롯을 순회하며:
 *  - kind:"screenshot" → sourceUrl(공식 도움말 실제 캡처)에서 다운로드
 *  - kind:"diagram"    → genImage(diagramPrompt)로 AI 도식 생성
 * 두 경우 모두 공개 버킷에 업로드(editor-images = 본문 이미지·워터마크 대상)하고,
 * assetKey → { url, caption, alt, sourceLabel, sourceUrl } 매니페스트를
 * bot_settings.guide_asset_manifest 에 저장한다.
 *
 * 봇 발행 파이프라인은 이 매니페스트를 읽어 본문 [[IMG:assetKey]] 마커를
 * 실제 이미지로 치환한다(로컬 PC 무관, 서버에서 재사용).
 *
 * 멱등: 이미 매니페스트에 있는 키는 이미지 재조달을 건너뛴다(캡션 등 메타데이터는 항상 갱신).
 *  - FORCE=1        → 전체 이미지 재조달
 *  - ONLY=key1,key2 → 지정한 키만 이미지 재조달(나머지는 메타데이터만 갱신)
 *
 * 실행:
 *   pnpm --filter @ai-jakdang/api tsx src/scripts/build-guide-assets.ts
 *   FORCE=1 pnpm --filter @ai-jakdang/api tsx src/scripts/build-guide-assets.ts
 *   ONLY=vibe-concept-nl-to-code,auto-schedule-filter pnpm --filter @ai-jakdang/api tsx src/scripts/build-guide-assets.ts
 */

import { closeDb } from "@ai-jakdang/database";
import { genImage } from "@ai-jakdang/server-bot/image";
import type { GuideAssetManifest, GuideAssetManifestEntry } from "@ai-jakdang/server-bot/image";
import { collectAssetKeys, GUIDE_CURRICULUM_VERSION } from "../services/bot/curriculum.js";
import type { GuideImageSlot } from "../services/bot/curriculum.js";
import { uploadImage } from "../services/storage/index.js";
import { getBotSetting, setBotSetting } from "../lib/botSettings.js";

const MANIFEST_KEY = "guide_asset_manifest";
const FORCE = process.env.FORCE === "1";
const ONLY = (process.env.ONLY ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** 외부 URL에서 이미지 바이트를 받아온다(타임아웃 30초). 실패 시 null. */
async function downloadImage(
  url: string,
): Promise<{ data: Buffer; mimetype: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (aijackdang-guide-asset-fetch)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.warn(`    ↳ 다운로드 실패 HTTP ${res.status}`);
      return null;
    }
    const ct = (res.headers.get("content-type") ?? "image/png").split(";")[0]!.trim();
    const mimetype = ct.startsWith("image/") ? ct : "image/png";
    const data = Buffer.from(await res.arrayBuffer());
    return { data, mimetype };
  } catch (err) {
    console.warn(`    ↳ 다운로드 오류: ${(err as Error).message}`);
    return null;
  }
}

/** 한 슬롯의 이미지 바이트를 조달한다(screenshot=다운로드 / diagram=AI 생성). */
async function procureBytes(
  slot: GuideImageSlot,
): Promise<{ data: Buffer; mimetype: string } | null> {
  if (slot.kind === "screenshot") {
    if (!slot.sourceUrl) {
      console.warn(`    ↳ screenshot인데 sourceUrl 없음`);
      return null;
    }
    return downloadImage(slot.sourceUrl);
  }
  // diagram — AI 이미지 생성(기본 구글 gemini). 키 미설정·오류 시 null.
  if (!slot.diagramPrompt) {
    console.warn(`    ↳ diagram인데 diagramPrompt 없음`);
    return null;
  }
  const result = await genImage({ prompt: slot.diagramPrompt });
  if (!result) {
    console.warn(`    ↳ AI 도식 생성 실패(GEMINI_API_KEY 미설정 또는 오류)`);
    return null;
  }
  return { data: result.data, mimetype: result.mimetype };
}

async function main(): Promise<void> {
  const slots = collectAssetKeys();
  console.info(
    `[build-guide-assets] 커리큘럼 v${GUIDE_CURRICULUM_VERSION} — 이미지 슬롯 ${slots.length}개 (FORCE=${FORCE})\n`,
  );

  const existing = (await getBotSetting<GuideAssetManifest>(MANIFEST_KEY)) ?? {};
  const manifest: GuideAssetManifest = { ...existing };

  let done = 0;
  let skipped = 0;
  let failed = 0;

  /** slot의 캡션·출처 메타데이터로 매니페스트 항목을 갱신(url 보존). */
  const refreshMeta = (url: string, slot: GuideImageSlot): GuideAssetManifestEntry => ({
    url,
    caption: slot.caption,
    alt: slot.alt,
    sourceLabel: slot.sourceLabel ?? null,
    sourceUrl: slot.sourcePageUrl ?? null,
  });

  for (const slot of slots) {
    const tag = `${slot.assetKey} (${slot.kind})`;
    const has = !!manifest[slot.assetKey]?.url;
    // 재조달 대상: FORCE(전체) / ONLY 지정 키 / 아직 url 없는 키.
    const inOnly = ONLY.includes(slot.assetKey);
    const shouldProcure = FORCE || inOnly || (!has && (ONLY.length === 0 || inOnly));

    if (!shouldProcure) {
      if (has) {
        // 이미지 재조달은 건너뛰되 캡션·출처는 최신 커리큘럼 값으로 갱신.
        manifest[slot.assetKey] = refreshMeta(manifest[slot.assetKey]!.url, slot);
        console.info(`[skip] ${tag} — 이미지 유지, 메타데이터 갱신`);
      } else {
        console.info(`[skip] ${tag} — ONLY 대상 아님, url 없음(생략)`);
      }
      skipped++;
      continue;
    }

    console.info(`[조달] ${tag} ...`);
    const bytes = await procureBytes(slot);
    if (!bytes) {
      failed++;
      continue;
    }

    try {
      const ext = bytes.mimetype.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
      const { url } = await uploadImage(
        { filename: `guide-${slot.assetKey}.${ext}`, mimetype: bytes.mimetype, data: bytes.data },
        "editor-images",
      );
      manifest[slot.assetKey] = refreshMeta(url, slot);
      console.info(`    ↳ 업로드 완료: ${url}`);
      done++;
    } catch (err) {
      console.error(`    ↳ 업로드 실패: ${(err as Error).message}`);
      failed++;
    }
  }

  await setBotSetting(MANIFEST_KEY, manifest);

  console.info(
    `\n[build-guide-assets] 완료 — 신규 ${done} · 건너뜀 ${skipped} · 실패 ${failed}` +
      ` · 매니페스트 총 ${Object.keys(manifest).length}개`,
  );
  if (failed > 0) {
    console.info(
      `[build-guide-assets] 실패한 슬롯은 매니페스트에 없으므로, 발행 시 해당 [[IMG]] 마커는 자동 생략됩니다.`,
    );
  }
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[build-guide-assets] 치명적 오류:", err);
    await closeDb();
    process.exit(1);
  });

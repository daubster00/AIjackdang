/**
 * 가이드 강의 시리즈 이미지 에셋 조달 스크립트 (Story 13.4 리팩터).
 *
 * bot_curriculum_image_slots(커리큘럼 이미지 슬롯) 테이블에서 pending(대기) 슬롯을 조회해
 * fillImageSlot(슬롯 이미지 조달 함수)으로 각 슬롯의 이미지를 조달한다.
 *
 *  - source_kind='ai_diagram'   → genImage(Gemini) → 버킷 업로드 → image_url 저장
 *  - source_kind='web_download' → fetch(source_url) → 버킷 업로드 → image_url 저장
 *  - source_kind='capture'      → source_url 있으면 Playwright 스크린샷, 없으면 실패 반환
 *  - source_kind='user_upload'  → 이 스크립트에서 처리 불가(관리자 /upload 엔드포인트 사용)
 *
 * 멱등: 이미 status='ready'(완료) 슬롯은 FORCE=1 없이는 건너뜀.
 *
 * 실행:
 *   # 모든 pending 슬롯 조달
 *   pnpm --filter @ai-jakdang/api tsx src/scripts/build-guide-assets.ts
 *   # ready 슬롯도 포함 강제 재조달
 *   FORCE=1 pnpm --filter @ai-jakdang/api tsx src/scripts/build-guide-assets.ts
 *   # 특정 asset_key만 조달
 *   ONLY=vibe-concept-nl-to-code,auto-schedule-filter pnpm --filter @ai-jakdang/api tsx src/scripts/build-guide-assets.ts
 */

import { closeDb, getDb, schema } from "@ai-jakdang/database";
import { eq, inArray, and } from "drizzle-orm";
import { fillImageSlot } from "../services/bot/slot-filler.js";

const FORCE = process.env.FORCE === "1";
const ONLY = (process.env.ONLY ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * 조달할 슬롯 목록을 DB에서 조회한다.
 *
 * - FORCE=true : status 무관 전체 슬롯 (단, ONLY 지정 시 해당 키만)
 * - FORCE=false: status='pending' 슬롯만 (단, ONLY 지정 시 해당 키만)
 */
async function getSlotsPending(opts: { force?: boolean; only?: string[] }) {
  const db = getDb();

  const statusCond = opts.force
    ? undefined
    : eq(schema.botCurriculumImageSlots.status, "pending");

  const onlyCond =
    opts.only && opts.only.length > 0
      ? inArray(schema.botCurriculumImageSlots.assetKey, opts.only)
      : undefined;

  const where = and(statusCond, onlyCond);

  const base = db.select().from(schema.botCurriculumImageSlots);
  return where ? base.where(where) : base;
}

async function main(): Promise<void> {
  const slots = await getSlotsPending({ force: FORCE, only: ONLY });
  console.info(
    `[build-guide-assets] 이미지 슬롯 ${slots.length}개 (FORCE=${FORCE}, ONLY=${ONLY.join(",") || "(전체)"})\n`,
  );

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const slot of slots) {
    const tag = `${slot.assetKey} (${slot.sourceKind})`;
    console.info(`[조달] ${tag} ...`);

    const result = await fillImageSlot(slot.id, { force: FORCE });

    if (result.outcome === "filled") {
      console.info(`    ↳ 완료: ${result.imageUrl}`);
      done++;
    } else if (result.outcome === "skipped") {
      console.info(`    ↳ 건너뜀: 이미 ready (${result.imageUrl})`);
      skipped++;
    } else {
      console.warn(`    ↳ 실패: ${result.reason}`);
      failed++;
    }
  }

  console.info(
    `\n[build-guide-assets] 완료 — 신규 ${done} · 건너뜀 ${skipped} · 실패 ${failed}`,
  );
  if (failed > 0) {
    console.info(
      `[build-guide-assets] 실패한 슬롯은 image_url이 비어 있으므로, ` +
        `발행 시 해당 [[IMG]] 마커는 자동 생략됩니다.`,
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

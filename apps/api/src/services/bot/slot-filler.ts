/**
 * 이미지 슬롯 조달 서비스 (Story 13.4 AC #1, #2).
 *
 * bot_curriculum_image_slots(커리큘럼 이미지 슬롯) 테이블의 source_kind(출처 종류)에 따라
 * 세 경로 중 하나로 이미지를 조달하고 버킷에 업로드한다.
 *
 * - 🟢 ai_diagram   : genImage(Gemini) → uploadImage('editor-images') → DB 저장
 * - 🟢 web_download : fetch(source_url) → uploadImage('editor-images') → DB 저장
 * - 🟡 capture      : source_url 있으면 Playwright 스크린샷, 없으면 수동 안내 반환
 * - 🔵 user_upload  : 13.5 /upload 엔드포인트 전담(이 함수는 실패 반환)
 *
 * 워터마크: uploadImage('editor-images') 경로에서 watermarkImage()가 자동 합성.
 * 이 파일에서 워터마크 코드 신규 작성 없음.
 *
 * [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#3]
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import { genImage, DEFAULT_IMAGE_MODEL } from "@ai-jakdang/server-bot/image";
import { uploadImage } from "../storage/index.js";

// ── 공개 인터페이스 ────────────────────────────────────────────────────────────

/** fillImageSlot 옵션. */
export interface FillSlotOptions {
  /** 이미 ready(완료) 슬롯도 강제 재조달. 기본 false. */
  force?: boolean;
  /**
   * 🟢 ai_diagram 전용: 관리자 지정 이미지 모델.
   * 미지정 시 DEFAULT_IMAGE_MODEL(구글 gemini-3.1-flash-image).
   */
  imageModel?: { provider: string; model: string };
  /**
   * 🟢 ai_diagram 전용: 이번 요청에서만 사용할 프롬프트 override.
   * 미지정 시 슬롯의 diagram_prompt(AI 도식 생성 프롬프트) 사용.
   */
  diagramPrompt?: string;
  /** 비용 기록용 job_id (선택). bot_generation_jobs.cost jsonb에 기록된다. */
  jobId?: string;
}

/** fillImageSlot 반환 타입. */
export interface FillSlotResult {
  ok: boolean;
  /** 업로드된 버킷 URL(이미지 조달·저장 완료). 실패·skip 시 null. */
  imageUrl: string | null;
  /**
   * - `'filled'`  : 이미지 조달·저장 완료
   * - `'skipped'` : 이미 ready + force 미설정
   * - `'failed'`  : 조달 실패(게시 파이프라인은 계속)
   */
  outcome: "filled" | "skipped" | "failed";
  /** 실패·skip 사유 (선택). */
  reason?: string;
}

// ── 슬롯 행 타입 ──────────────────────────────────────────────────────────────

type SlotRow = typeof schema.botCurriculumImageSlots.$inferSelect;

// ── DB 업데이트 헬퍼 ──────────────────────────────────────────────────────────

async function markSlotReady(slotId: string, imageUrl: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.botCurriculumImageSlots)
    .set({ imageUrl, status: "ready", updatedAt: new Date() })
    .where(eq(schema.botCurriculumImageSlots.id, slotId));
}

// ── 내부 조달 함수 ────────────────────────────────────────────────────────────

/**
 * 🟢 ai_diagram: genImage(Gemini/OpenAI) → uploadImage → DB 저장.
 * diagram_prompt(AI 도식 생성 프롬프트)가 없으면 실패 반환.
 * genImage 실패(크레딧 소진·키 미설정) 시 null 반환 → 실패 처리(파이프라인은 계속).
 */
async function fillAiDiagram(slot: SlotRow, opts?: FillSlotOptions): Promise<FillSlotResult> {
  const prompt = opts?.diagramPrompt ?? slot.diagramPrompt;
  if (!prompt) {
    return { ok: false, imageUrl: null, outcome: "failed", reason: "diagram_prompt 없음" };
  }

  const result = await genImage({
    prompt,
    imageModel: opts?.imageModel ?? DEFAULT_IMAGE_MODEL,
    jobId: opts?.jobId,
  });
  if (!result) {
    return { ok: false, imageUrl: null, outcome: "failed", reason: "genImage 실패" };
  }

  const ext = result.mimetype.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const { url } = await uploadImage(
    { filename: `slot-ai-${slot.assetKey}.${ext}`, mimetype: result.mimetype, data: result.data },
    "editor-images",
  );

  await markSlotReady(slot.id, url);
  return { ok: true, imageUrl: url, outcome: "filled" };
}

/**
 * 🟢 web_download: fetch(source_url) → uploadImage → DB 저장.
 * source_url(원본 다운로드 URL) 없으면 실패.
 * HTTP 비OK·fetch 예외 → 실패 반환(게시 파이프라인 차단 금지).
 * Content-Type이 image/* 비prefix 시 'image/png' 기본값 사용.
 */
async function fillWebDownload(slot: SlotRow): Promise<FillSlotResult> {
  if (!slot.sourceUrl) {
    return { ok: false, imageUrl: null, outcome: "failed", reason: "source_url 없음" };
  }

  let data: Buffer;
  let mimetype: string;

  try {
    const res = await fetch(slot.sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (aijackdang-guide-asset-fetch)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return {
        ok: false,
        imageUrl: null,
        outcome: "failed",
        reason: `HTTP ${res.status}`,
      };
    }
    const ct = (res.headers.get("content-type") ?? "image/png").split(";")[0]?.trim() ?? "image/png";
    mimetype = ct.startsWith("image/") ? ct : "image/png";
    data = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    return { ok: false, imageUrl: null, outcome: "failed", reason: String(err) };
  }

  const ext = mimetype.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const { url } = await uploadImage(
    { filename: `slot-web-${slot.assetKey}.${ext}`, mimetype, data },
    "editor-images",
  );

  await markSlotReady(slot.id, url);
  return { ok: true, imageUrl: url, outcome: "filled" };
}

/**
 * 🟡 capture: source_url 있으면 Playwright headless 스크린샷 → uploadImage → DB 저장.
 * source_url 없으면(로컬 데스크톱·터미널) 수동 캡처 안내를 반환한다.
 * Playwright 예외(타임아웃·로그인 벽 등) → try/catch → 실패 반환.
 */
async function fillCapture(slot: SlotRow): Promise<FillSlotResult> {
  if (!slot.sourceUrl) {
    return {
      ok: false,
      imageUrl: null,
      outcome: "failed",
      reason:
        "로컬 캡처는 capture-slot.ts CLI로 수동 실행 후 /upload 엔드포인트로 제출하세요",
    };
  }

  // playwright는 무겁고 배포 환경에 없을 수 있으므로 capture 실제 실행 시에만 지연 로드한다.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(slot.sourceUrl, { waitUntil: "networkidle", timeout: 30_000 });
    const screenshot = await page.screenshot({ fullPage: false });

    const { url } = await uploadImage(
      { filename: `slot-cap-${slot.assetKey}.png`, mimetype: "image/png", data: screenshot },
      "editor-images",
    );

    await markSlotReady(slot.id, url);
    return { ok: true, imageUrl: url, outcome: "filled" };
  } catch (err) {
    return { ok: false, imageUrl: null, outcome: "failed", reason: String(err) };
  } finally {
    await browser.close();
  }
}

// ── 공개 진입점 ───────────────────────────────────────────────────────────────

/**
 * 슬롯 이미지를 조달하고 버킷에 업로드한다.
 *
 * 이미 status='ready'(완료)인 슬롯은 opts.force=true 없이는 건너뜀.
 * 실패 시 슬롯 상태 변경 없음(봇 게시 파이프라인 차단 금지).
 */
export async function fillImageSlot(
  slotId: string,
  opts?: FillSlotOptions,
): Promise<FillSlotResult> {
  const db = getDb();
  const [slot] = await db
    .select()
    .from(schema.botCurriculumImageSlots)
    .where(eq(schema.botCurriculumImageSlots.id, slotId))
    .limit(1);

  if (!slot) {
    return { ok: false, imageUrl: null, outcome: "failed", reason: "슬롯 없음" };
  }

  // 이미 ready 이면 force=true 없이는 건너뜀
  if (slot.status === "ready" && !opts?.force) {
    return { ok: true, imageUrl: slot.imageUrl, outcome: "skipped" };
  }

  try {
    switch (slot.sourceKind) {
      case "ai_diagram":
        return await fillAiDiagram(slot, opts);
      case "web_download":
        return await fillWebDownload(slot);
      case "capture":
        return await fillCapture(slot);
      case "user_upload":
        return {
          ok: false,
          imageUrl: null,
          outcome: "failed",
          reason: "직접 업로드는 /slots/:id/upload 엔드포인트 사용",
        };
    }
  } catch (err) {
    return { ok: false, imageUrl: null, outcome: "failed", reason: String(err) };
  }
}

/*
 * ── capture-slot.ts CLI 안내 ────────────────────────────────────────────────
 *
 * 로컬 데스크톱 캡처(source_url 없는 capture 슬롯) 흐름:
 *
 * 1. 관리자가 캡처 대상(터미널 출력·데스크톱 앱)을 준비(앱 설치·로그인·화면 정돈).
 * 2. 아래 스크립트 실행:
 *    pnpm --filter @ai-jakdang/api tsx src/scripts/capture-slot.ts --slot-id <id>
 *    → PowerShell System.Windows.Forms.Screen 기반 캡처 → 결과 PNG 저장.
 *    *(로컬 환경 전용, 배포 서버 실행 불가)*
 * 3. 관리자 화면 🔵 업로드 버튼 또는 curl로
 *    POST /api/v1/admin/bots/curriculum/slots/:id/upload 에 PNG 제출.
 * 4. 슬롯 status='ready' 승격.
 *
 * TODO: capture-slot.ts 스크립트 구현 (PowerShell Add-Type 기반, 운영 시 사용자 가이드 참조).
 */

/**
 * AI 이미지 생성 어댑터 (Story 11.8 AC #2).
 *
 * 프로바이더별 이미지 생성 엔드포인트를 직접 fetch로 호출한다.
 * 관리자에서 봇에 할당한 이미지 모델(provider+model)을 그대로 라우팅한다.
 * imageModel 미지정 시 **구글 Gemini 3.1 Flash Image**를 기본값으로 쓴다
 * (OpenAI gpt-image-2는 조직 인증이 필요해, 인증 전까지 구글을 기본으로).
 *
 * 지원 프로바이더:
 *   - google : Gemini 이미지 모델(gemini-*-image). generateContent → inlineData(base64). **API 키만 필요(조직 인증 불필요)**.
 *   - openai : gpt-image-2 / gpt-image-1 / dall-e-3. images/generations.
 *              ⚠️ gpt-image-2/1은 base64 반환·response_format 미지원. dall-e-3만 URL 반환.
 *              ⚠️ gpt-image-*는 OpenAI 조직 인증 필요할 수 있음(미인증 시 403 → null).
 *
 * 어느 경로든 최종적으로 **이미지 바이트(Buffer)+mimetype**을 돌려준다(URL 아님).
 * 키 미설정·오류 시 null 반환 — 봇 글 게시는 계속된다(이미지 실패로 게시 차단 금지).
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md#4-AI-추상화-레이어]
 */

import { env } from "@ai-jakdang/config";
import { getDb, schema } from "@ai-jakdang/database";
import { sql, eq } from "drizzle-orm";
import { isCreditExhaustion } from "../ai/errors";
import { notifyCreditExhausted } from "../alert/credit-alert";

/** imageModel 미지정 시 기본 이미지 생성 모델(구글 최신·조직인증 불필요). */
export const DEFAULT_IMAGE_MODEL = {
  provider: "google",
  model: "gemini-3.1-flash-image",
} as const;

/** 이미지 1장당 추정 비용(USD). 응답에 비용이 없어 상수로 적산(내부 회계용). */
const IMAGE_FALLBACK_COST_USD: Record<string, number> = {
  google: 0.04, // gemini-3.1-flash-image 대략치
  openai: 0.12, // gpt-image-2 high 대략치
};

/** genImage 입력 파라미터. */
export interface GenImageParams {
  /** 이미지 생성 프롬프트. */
  prompt: string;
  /** bot_generation_jobs.id — 비용 누적 기록 대상 (선택). */
  jobId?: string;
  /**
   * 사용할 이미지 모델(관리자 할당값). 미지정 시 DEFAULT_IMAGE_MODEL(구글).
   */
  imageModel?: { provider: string; model: string };
}

/** genImage 반환 타입. */
export interface GenImageResult {
  /** 생성된 이미지 바이트. */
  data: Buffer;
  /** 이미지 MIME 타입. */
  mimetype: string;
  /** 이미지 생성 비용 (USD). */
  costUsd: number;
}

/**
 * bot_generation_jobs.cost jsonb 필드에 이미지 생성 비용을 병합 기록한다.
 * 실패해도 조용히 무시 (비용 기록 실패가 이미지 반환을 막으면 안 됨).
 */
async function recordCost(
  jobId: string,
  provider: string,
  model: string,
  costUsd: number,
): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(schema.botGenerationJobs)
      .set({
        cost: sql`COALESCE(${schema.botGenerationJobs.cost}, '{}'::jsonb) || ${JSON.stringify({
          imageGen: { provider, model, costUsd },
        })}::jsonb`,
      })
      .where(eq(schema.botGenerationJobs.id, jobId));
  } catch {
    // bot_generation_jobs 테이블 미존재 또는 DB 오류 → graceful skip
  }
}

// ── Google Gemini 이미지 생성 ───────────────────────────────────────────────────

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiImagePart {
  inlineData?: { mimeType?: string; data?: string };
  text?: string;
}
interface GeminiImageResponse {
  candidates?: Array<{ content?: { parts?: GeminiImagePart[] } }>;
}

/**
 * Gemini 이미지 모델(gemini-*-image)로 이미지를 생성한다.
 * generateContent 응답의 inlineData(base64)를 Buffer로 디코드해 반환.
 * GEMINI_API_KEY 미설정·오류·이미지 파트 없음 시 null.
 */
async function genImageGoogle(
  model: string,
  prompt: string,
): Promise<{ data: Buffer; mimetype: string } | null> {
  const key = env.GEMINI_API_KEY;
  if (!key) return null;

  try {
    const url = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        // 이미지 모델은 TEXT+IMAGE 모달리티를 요구한다(이미지 파트를 inlineData로 반환).
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      // 크레딧/쿼터 소진이면 텔레그램 알림(이미지 실패는 여전히 null 반환 — 게시는 계속).
      const body = await res.text().catch(() => "");
      if (isCreditExhaustion(res.status, body)) {
        notifyCreditExhausted({ provider: "google", model, purpose: "image", detail: body });
      }
      return null;
    }

    const json = (await res.json()) as GeminiImageResponse;
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p.inlineData?.data);
    const b64 = imgPart?.inlineData?.data;
    if (!b64) return null;

    return {
      data: Buffer.from(b64, "base64"),
      mimetype: imgPart?.inlineData?.mimeType ?? "image/png",
    };
  } catch {
    return null;
  }
}

// ── OpenAI 이미지 생성 ──────────────────────────────────────────────────────────

interface OpenAIImageResponse {
  data: Array<{ b64_json?: string; url?: string }>;
}

/**
 * OpenAI images/generations로 이미지를 생성한다.
 * gpt-image-2/1: base64(b64_json) 반환·response_format 미지원·quality low/medium/high.
 * dall-e-3: URL 반환·response_format 지원·quality standard/hd.
 * 미지원·오류 시 null.
 */
async function genImageOpenAI(
  model: string,
  prompt: string,
): Promise<{ data: Buffer; mimetype: string } | null> {
  const key = env.OPENAI_API_KEY;
  if (!key) return null;

  const isGptImage = model.startsWith("gpt-image");
  const body: Record<string, unknown> = {
    model,
    prompt,
    size: "1024x1024",
    n: 1,
  };
  if (isGptImage) {
    body["quality"] = "high"; // gpt-image 계열: low/medium/high/auto
    // response_format 넣지 말 것 — gpt-image는 미지원(400). 항상 b64_json 반환.
  } else {
    body["quality"] = "standard"; // dall-e-3
    body["response_format"] = "b64_json"; // dall-e-3도 b64로 받아 업로드 단순화
  }

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      // 크레딧/쿼터 소진이면 텔레그램 알림(이미지 실패는 여전히 null 반환 — 게시는 계속).
      const body = await res.text().catch(() => "");
      if (isCreditExhaustion(res.status, body)) {
        notifyCreditExhausted({ provider: "openai", model, purpose: "image", detail: body });
      }
      return null;
    }

    const json = (await res.json()) as OpenAIImageResponse;
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return null;

    return { data: Buffer.from(b64, "base64"), mimetype: "image/png" };
  } catch {
    return null;
  }
}

// ── 공개 진입점 ─────────────────────────────────────────────────────────────────

/**
 * 이미지를 생성한다(프로바이더 라우팅). 실패 시 null(글 게시는 계속).
 *
 * imageModel 미지정 시 DEFAULT_IMAGE_MODEL(구글 gemini-3.1-flash-image).
 * jobId가 있으면 bot_generation_jobs.cost jsonb에 imageGen 비용을 병합 기록한다.
 */
export async function genImage(
  params: GenImageParams,
): Promise<GenImageResult | null> {
  const { prompt, jobId } = params;
  const provider = params.imageModel?.provider ?? DEFAULT_IMAGE_MODEL.provider;
  const model = params.imageModel?.model ?? DEFAULT_IMAGE_MODEL.model;

  let out: { data: Buffer; mimetype: string } | null = null;
  if (provider === "openai") {
    out = await genImageOpenAI(model, prompt);
  } else {
    // google (기본) — 그 외 프로바이더도 구글로 폴백(anthropic은 이미지 미지원).
    out = await genImageGoogle(model, prompt);
  }
  if (!out) return null;

  const costUsd = IMAGE_FALLBACK_COST_USD[provider] ?? 0.04;
  if (jobId) {
    await recordCost(jobId, provider, model, costUsd);
  }

  return { data: out.data, mimetype: out.mimetype, costUsd };
}

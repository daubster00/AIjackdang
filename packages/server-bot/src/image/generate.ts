/**
 * AI 이미지 생성 어댑터 (Story 11.8 AC #2).
 *
 * OpenAI DALL-E 3 엔드포인트를 직접 fetch로 호출한다.
 * Story 11.6 AiProvider 인터페이스 완성 후 getProvider('openai')로 교체 예정.
 * OPENAI_API_KEY 미설정 시 null 반환 — 봇 글 게시 차단 금지.
 *
 * 비용 상수: 2025-06 기준 DALL-E 3 Standard 1024×1024 = $0.040/이미지.
 * OpenAI API 응답에 비용이 포함되지 않으므로 상수 사용.
 * 모델명/가격 변동 시 DALLE3_STANDARD_1024_COST_USD 업데이트 필요.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md#4-AI-추상화-레이어]
 */

import { env } from "@ai-jakdang/config";
import { getDb, schema } from "@ai-jakdang/database";
import { sql, eq } from "drizzle-orm";

/**
 * 2025-06 기준 DALL-E 3 Standard 품질 1024×1024 단가 (USD).
 * 실제 OpenAI 응답에 비용이 없으므로 이 상수를 사용한다.
 * 향후 DB 설정으로 이동 가능하도록 주석 명시.
 */
const DALLE3_STANDARD_1024_COST_USD = 0.04;

/** genImage 입력 파라미터. */
export interface GenImageParams {
  /** 이미지 생성 프롬프트. */
  prompt: string;
  /** bot_generation_jobs.id — 비용 누적 기록 대상 (선택). */
  jobId?: string;
}

/** genImage 반환 타입. */
export interface GenImageResult {
  /** OpenAI가 반환한 임시 URL (만료 전에 다운로드 필요). */
  url: string;
  /** 이미지 생성 비용 (USD). */
  costUsd: number;
}

/** OpenAI 이미지 생성 API 응답 타입 (필요한 필드만). */
interface OpenAIImageResponse {
  data: Array<{ url?: string }>;
}

/**
 * bot_generation_jobs.cost jsonb 필드에 이미지 생성 비용을 병합 기록한다.
 * 실패해도 조용히 무시 (비용 기록 실패가 이미지 반환을 막으면 안 됨).
 */
async function recordCost(jobId: string, costUsd: number): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(schema.botGenerationJobs)
      .set({
        cost: sql`COALESCE(${schema.botGenerationJobs.cost}, '{}'::jsonb) || ${JSON.stringify({
          imageGen: { provider: "openai", model: "dall-e-3", costUsd },
        })}::jsonb`,
      })
      .where(eq(schema.botGenerationJobs.id, jobId));
  } catch {
    // bot_generation_jobs 테이블 미존재 또는 DB 오류 → graceful skip
  }
}

/**
 * OpenAI DALL-E 3로 이미지를 생성한다.
 * OPENAI_API_KEY 미설정 또는 에러 시 null 반환.
 *
 * jobId가 있으면 bot_generation_jobs.cost jsonb에 imageGen 비용을 병합 기록한다.
 * 비용 기록 실패는 이미지 생성 결과에 영향을 주지 않는다.
 */
export async function genImage(
  params: GenImageParams,
): Promise<GenImageResult | null> {
  const key = env.OPENAI_API_KEY;
  if (!key) return null;

  const { prompt, jobId } = params;

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
        response_format: "url",
      }),
      // 이미지 생성은 응답이 느릴 수 있어 60초 허용
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as OpenAIImageResponse;
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) return null;

    const costUsd = DALLE3_STANDARD_1024_COST_USD;

    if (jobId) {
      await recordCost(jobId, costUsd);
    }

    return { url: imageUrl, costUsd };
  } catch {
    return null;
  }
}

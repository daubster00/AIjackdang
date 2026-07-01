/**
 * AI 추상화 레이어 — 공개 API (Story 11.6).
 *
 * ARCHITECTURE §4에 따라 생성 모델에 도구 권한 없음 — system+user 텍스트만 전달.
 * 세 어댑터(OpenAI·Anthropic·Google Gemini) 모두 REST fetch 직접 호출.
 * 모델명은 DB bot_model_assignments.model에서 읽어 전달 — 하드코딩 금지.
 *
 * 공개 export:
 *  - AiProvider, AiTextRequest, AiTextResponse, AiImageRequest, AiImageResponse (인터페이스)
 *  - estimateCostUsd(provider, model, inputTokens, outputTokens): number
 *  - getProvider(provider): AiProvider
 *  - callModel(assignment, prompt, opts?): Promise<AiTextResponse>
 *  - getModelAssignment(db, personaId, purpose): Promise<BotModelAssignmentRow | null>
 *  - checkDailyCostLimit(): Promise<void>
 *  - BotCostLimitExceededError
 */

import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@ai-jakdang/database";
import {
  aiUsageLog,
  botActivityLog,
  botModelAssignments,
  botSettings,
  type BotModelAssignmentRow,
} from "@ai-jakdang/database/schema";
import type { BotProvider, BotPurpose } from "@ai-jakdang/contracts";

import type { AiProvider, AiTextRequest, AiTextResponse, AiImageRequest, AiImageResponse } from "./types";
import type { Database } from "@ai-jakdang/database";
import { estimateCostUsd } from "./pricing";
import { openAiAdapter } from "./adapters/openai";
import { anthropicAdapter } from "./adapters/anthropic";
import { geminiAdapter } from "./adapters/gemini";

// ── 타입·인터페이스 재수출 ────────────────────────────────────────────────────

export type { AiProvider, AiTextRequest, AiTextResponse, AiImageRequest, AiImageResponse };
export { estimateCostUsd };
export type { BotModelAssignmentRow };

// ── recordAiUsage: AI 호출 단위 사용 로그 (Story 11.19) ──────────────────────

/**
 * AI 호출 1건의 사용 정보 — ai_usage_log INSERT 엔트리.
 * callModel() 성공 후, 또는 이미지/검색요약/번역 어댑터에서 직접 호출한다.
 */
export interface AiUsageEntry {
  /** AI 사용 기능 구분: 'seeding-bot' 등 (비봇 기능 확장 대비 generic). */
  feature: string;
  /** openai | anthropic | google 등 모델 제공자. */
  provider: string;
  /** 실제 모델명 (예: gpt-4o-mini, claude-haiku-4-5). */
  model: string;
  /** 호출 용도: 'generation' | 'censor' | 'image' | 'search_summary' | 'translation' 등. */
  purpose: string;
  /** 봇 페르소나 UUID (있을 때만). */
  personaId?: string | null;
  /** bot_generation_jobs UUID (있을 때만). */
  jobId?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  /** 이 호출 비용 (달러). */
  costUsd: number;
}

/**
 * ai_usage_log 테이블에 AI 호출 1건을 기록한다.
 *
 * best-effort: 내부 try/catch로 실패 시 console.error만 남기고 throw 금지.
 * 이 함수 실패가 글 생성 등 본 기능을 막으면 안 된다.
 */
export async function recordAiUsage(entry: AiUsageEntry): Promise<void> {
  try {
    const db = getDb();
    await db.insert(aiUsageLog).values({
      feature: entry.feature,
      provider: entry.provider,
      model: entry.model,
      purpose: entry.purpose,
      personaId: entry.personaId ?? null,
      jobId: entry.jobId ?? null,
      inputTokens: entry.inputTokens ?? 0,
      outputTokens: entry.outputTokens ?? 0,
      costUsd: String(entry.costUsd),
    });
  } catch (err: unknown) {
    console.error("[ai/recordAiUsage] AI 사용 로그 기록 실패:", (err as Error).message);
  }
}

// ── getProvider: 프로바이더 팩토리 ────────────────────────────────────────────

/**
 * 지연 초기화 싱글톤 패턴으로 어댑터를 반환한다.
 * 지원하지 않는 프로바이더 문자열이면 에러를 throw한다.
 */
export function getProvider(provider: BotProvider): AiProvider {
  switch (provider) {
    case "openai":
      return openAiAdapter;
    case "anthropic":
      return anthropicAdapter;
    case "google":
      return geminiAdapter;
    default: {
      // exhaustive check — 새 프로바이더 추가 시 컴파일 오류로 알림
      const _exhaustive: never = provider;
      throw new Error(`지원하지 않는 AI 프로바이더: ${String(_exhaustive)}`);
    }
  }
}

// ── callModel: 모델 라우팅 + best-effort 비용 로그 ───────────────────────────

/** callModel에 전달하는 모델 할당 정보 (BotModelAssignmentRow와 호환). */
export interface CallModelAssignment {
  provider: string;
  model: string;
  id?: string;
}

/**
 * 봇 모델 할당(assignment.provider + assignment.model)에 따라 AI 호출을 라우팅한다.
 *
 * 호출 후 bot_activity_log에 cost 이벤트 + ai_usage_log에 호출 단위 기록을 남긴다 (best-effort).
 * bot_generation_jobs.cost 갱신은 호출자(파이프라인, Story 11.9/11.10)의 책임이다.
 *
 * @param opts.personaId      - 제공 시 cost 이벤트 기록. 미제공 시 기록 생략.
 * @param opts.jobId          - bot_activity_log.ref_id에 기록될 잡 UUID.
 * @param opts.usageContext   - AI 사용 로그 추가 컨텍스트 (Story 11.19).
 *   feature: 'seeding-bot'(기본). purpose: 'generation'(기본), 'censor', 'image', 등.
 */
export async function callModel(
  assignment: CallModelAssignment,
  prompt: { system: string; user: string; maxTokens?: number; temperature?: number },
  opts?: {
    personaId?: string;
    jobId?: string;
    /** AI 사용 로그 추가 컨텍스트 (Story 11.19) */
    usageContext?: { feature?: string; purpose?: string };
  },
): Promise<AiTextResponse> {
  const provider = getProvider(assignment.provider as BotProvider);
  const req: AiTextRequest = {
    system: prompt.system,
    user: prompt.user,
    model: assignment.model,
    maxTokens: prompt.maxTokens,
    temperature: prompt.temperature,
  };

  const response = await provider.generateText(req);

  // best-effort 비용 로그 — 실패해도 AI 호출 결과는 반환 (ARCHITECTURE §11 fail-safe)
  if (opts?.personaId) {
    await recordCostEvent({
      personaId: opts.personaId,
      jobId: opts.jobId,
      provider: assignment.provider,
      model: assignment.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costUsd: response.costUsd,
    }).catch((err: unknown) => {
      console.error("[ai/callModel] cost 로그 기록 실패:", (err as Error).message);
    });
  }

  // best-effort AI 사용 로그 (Story 11.19) — 항상 기록(personaId 없어도)
  recordAiUsage({
    feature: opts?.usageContext?.feature ?? "seeding-bot",
    provider: assignment.provider,
    model: assignment.model,
    purpose: opts?.usageContext?.purpose ?? "generation",
    personaId: opts?.personaId ?? null,
    jobId: opts?.jobId ?? null,
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    costUsd: response.costUsd,
  }).catch((err: unknown) => {
    console.error("[ai/callModel] AI 사용 로그 기록 실패:", (err as Error).message);
  });

  return response;
}

// ── getModelAssignment: (persona_id, purpose) 키로 모델 할당 조회 ─────────────

/**
 * bot_model_assignments 에서 (persona_id, purpose) unique 키로 1건 조회한다.
 *
 * 할당이 없거나 is_active=false이면 null 반환.
 * 호출자는 null 반환 시 잡을 blocked/skipped 처리해야 한다 (모델 미할당 페르소나 방어).
 *
 * @param db        - Drizzle DB 인스턴스 (테스트 주입 허용)
 * @param personaId - 페르소나 UUID
 * @param purpose   - 용도 ('generation' | 'censor' | 'image')
 */
export async function getModelAssignment(
  db: Database,
  personaId: string,
  purpose: BotPurpose,
): Promise<BotModelAssignmentRow | null> {
  const rows = await db
    .select()
    .from(botModelAssignments)
    .where(
      and(
        eq(botModelAssignments.personaId, personaId),
        eq(botModelAssignments.purpose, purpose),
        eq(botModelAssignments.isActive, true),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

// ── checkDailyCostLimit: 일일 비용 상한 확인 ─────────────────────────────────

/**
 * 일일 누적 비용이 bot_settings.bot_daily_cost_limit_usd 상한에 도달하면 throw한다.
 *
 * 파이프라인은 AI 호출 전에 이 함수를 반드시 호출해야 한다(Story 11.9·11.10 규약).
 * DB 장애로 함수 자체가 실패하면 제한 없이 통과시킨다 (비용 초과보다 사이트 다운 방지 우선).
 *
 * ```ts
 * try {
 *   await checkDailyCostLimit();
 * } catch (err) {
 *   if (err instanceof BotCostLimitExceededError) {
 *     // 잡 blocked 처리 + 로그
 *     return;
 *   }
 *   throw err; // DB 오류는 재throw → BullMQ retry
 * }
 * ```
 */
export async function checkDailyCostLimit(): Promise<void> {
  let limitUsd: number | null;
  try {
    limitUsd = await getBotSetting<number>("bot_daily_cost_limit_usd");
  } catch {
    // DB 장애 — fail-safe: 제한 없이 통과 (ARCHITECTURE §11)
    return;
  }

  if (limitUsd == null) return; // 설정 미존재 시 제한 없음

  const db = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let rows: { payload: unknown }[];
  try {
    rows = await db
      .select({ payload: botActivityLog.payload })
      .from(botActivityLog)
      .where(
        and(
          eq(botActivityLog.eventType, "cost"),
          gte(botActivityLog.createdAt, todayStart),
        ),
      );
  } catch {
    // DB 장애 — fail-safe: 제한 없이 통과
    return;
  }

  const totalCostUsd = rows.reduce((sum, r) => {
    const p = r.payload as { costUsd?: number } | null;
    return sum + (p?.costUsd ?? 0);
  }, 0);

  if (totalCostUsd >= limitUsd) {
    throw new BotCostLimitExceededError(
      `일일 비용 상한 $${limitUsd} 도달 (현재 $${totalCostUsd.toFixed(4)}). 신규 생성 잡 중단.`,
    );
  }
}

/** checkDailyCostLimit이 한도 초과 시 throw하는 에러 클래스. */
export class BotCostLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BotCostLimitExceededError";
  }
}

// ── 내부 헬퍼 (미공개) ────────────────────────────────────────────────────────

/**
 * bot_settings 테이블에서 단일 키 값을 조회한다 (DB 직접 조회, 캐시 없음).
 * server-bot 패키지는 ioredis 의존성 없으므로 Redis 캐시를 사용하지 않는다.
 * 고빈도 호출 경로에서 캐시가 필요하면 bot_settings 서빙을 apps/api/lib/botSettings.ts로 위임할 것.
 */
async function getBotSetting<T = unknown>(key: string): Promise<T | null> {
  const db = getDb();
  const [row] = await db
    .select({ value: botSettings.value })
    .from(botSettings)
    .where(eq(botSettings.key, key))
    .limit(1);

  return (row?.value ?? null) as T | null;
}

/** bot_activity_log에 cost 이벤트를 기록한다. */
async function recordCostEvent(p: {
  personaId: string;
  jobId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}): Promise<void> {
  const db = getDb();
  await db.insert(botActivityLog).values({
    personaId: p.personaId,
    eventType: "cost",
    refId: p.jobId ?? null,
    payload: {
      provider: p.provider,
      model: p.model,
      inputTokens: p.inputTokens,
      outputTokens: p.outputTokens,
      costUsd: p.costUsd,
    },
  });
}

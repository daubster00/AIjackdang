/**
 * 봇 게이트 헬퍼 — Story 11.12
 *
 * 모든 봇 잡(job) processor가 처리 시작 전 반드시 호출해야 하는 공통 게이트.
 * 킬 스위치 → 일일 상한 → 비용 상한 → 관찰 모드 순서로 단계별 판단한다.
 *
 * 공개 임포트 경로: `@ai-jakdang/server-bot/gates`
 *
 * ─── 사용 계약 (11.13/11.11 생성 예정 프로세서에도 동일 적용) ────────────────
 *
 * ```typescript
 * // apps/worker/src/processors/bot/write.processor.ts  (11.13 생성 예정)
 * const gate = await checkBotGates('write');
 * if (!gate.allowed) {
 *   await logBotSkip(job.data.personaId ?? null, gate.reason, 'write');
 *   return; // BullMQ completed (실패 아님 — throw하면 재시도 큐 오염)
 * }
 * // ... 생성 파이프라인 (11.9) ...
 * if (gate.observationMode) {
 *   await holdForObservation(generationJobId, draftContent, 'observation_mode');
 *   return;
 * }
 * await createPostAsBot(...);
 *
 * // apps/worker/src/processors/bot/daily-plan.processor.ts  (11.11 생성 예정)
 * // 계획 잡은 킬 스위치만 확인 (글 수·비용 상한 불필요)
 * const gate = await checkBotGates('plan');
 * if (!gate.allowed) {
 *   await logBotSkip(null, gate.reason, 'plan');
 *   return;
 * }
 * ```
 *
 * ─── BullMQ 재시도 주의 ────────────────────────────────────────────────────
 * 게이트 차단 시 throw가 아닌 `return`으로 정상 완료 처리해야 한다.
 * throw하면 BullMQ가 실패로 기록하고 재시도(retry)를 시도하며,
 * 킬 스위치가 켜진 동안 재시도가 반복되어 큐 오염이 발생한다.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md#11-보안·실패-모드]
 * [Source: docs/seeding-bot/PRD.md#NFR-SB-3]
 */

import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@ai-jakdang/database";
import { botActivityLog } from "@ai-jakdang/database/schema";
import type { Database } from "@ai-jakdang/database";

import { getBotSetting } from "./botSettings.js";

// ── 타입 ─────────────────────────────────────────────────────────────────────

/**
 * 게이트 결과(GateResult).
 *
 * `allowed: true`면 잡 처리를 계속한다. `observationMode`가 true이면 게시 직전 보류 큐로 분기.
 * `allowed: false`면 processor는 즉시 skip + `logBotSkip` 호출 후 `return`.
 */
export type GateResult =
  | { allowed: true; observationMode: boolean }
  | { allowed: false; reason: string };

// ── KST 자정 계산 ─────────────────────────────────────────────────────────────

/**
 * 오늘 KST(Asia/Seoul, UTC+9) 자정을 UTC Date로 반환한다.
 *
 * 서비스는 한국 사용자 대상이며 일일 계획(11.11 toKSTDateKey)도 KST를 기준으로 하므로
 * 상한·비용·계획의 "하루" 경계를 KST로 통일한다. (UTC 혼용 금지)
 *
 * 계산 방식:
 * 1. 현재 UTC 에 +9h 더해 KST 연/월/일(UTC 관점) 추출
 * 2. Date.UTC(year, month, day) - 9h = KST 자정의 UTC instant
 *
 * 예시:
 * - now(UTC) = 2026-06-30T14:00:00Z → KST = 2026-06-30T23:00:00+09:00
 * - KST 자정 = 2026-06-30T00:00:00+09:00 = 2026-06-29T15:00:00Z
 */
export function getKstDayStart(): Date {
  const now = new Date();
  const kstOffsetMs = 9 * 60 * 60 * 1000; // KST = UTC+9
  const kstMs = now.getTime() + kstOffsetMs;
  const kstDate = new Date(kstMs);
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth(); // 0-indexed
  const day = kstDate.getUTCDate();
  // KST 자정 UTC = Date.UTC(year, month, day) - 9h
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - kstOffsetMs);
}

// ── 일일 카운트 ───────────────────────────────────────────────────────────────

/**
 * 오늘(KST 기준) 특정 이벤트 타입의 발행 건수를 bot_activity_log에서 집계한다.
 *
 * @param eventType - 'post.published' | 'comment.published'
 * @param db        - Drizzle DB 인스턴스 (미전달 시 getDb() 사용, 테스트 주입 허용)
 * @returns 오늘 KST 발행 건수. 예외 시 0 반환(과소 집계 방향 — 안전 기본값).
 *
 * 안전 기본값 근거: 집계 실패 시 0 반환 → 상한 미초과 처리.
 * "거짓 통과"가 "거짓 차단"보다 덜 해롭다(잡이 불필요하게 스킵되는 것을 방지).
 */
export async function getDailyPublishedCount(
  eventType: "post.published" | "comment.published",
  db?: Database,
): Promise<number> {
  try {
    const database = db ?? getDb();
    const kstDayStart = getKstDayStart();

    const rows = await database
      .select({ cnt: count() })
      .from(botActivityLog)
      .where(
        and(
          eq(botActivityLog.eventType, eventType),
          gte(botActivityLog.createdAt, kstDayStart),
        ),
      );

    return Number(rows[0]?.cnt ?? 0);
  } catch {
    return 0; // 안전 기본값: 과소 집계 (상한 미초과로 처리)
  }
}

// ── 비용 상한 확인 ──────────────────────────────────────────────────────────────

/**
 * 일일 AI 비용 상한(bot_daily_cost_limit_usd) 초과 여부를 반환한다.
 *
 * ─── Story 11.6 관계 ────────────────────────────────────────────────────────
 * Story 11.6의 checkDailyCostLimit()은 동일 로직이지만 UTC 자정 기준이며 throw 방식이다.
 * 이 함수는 KST 자정 기준 + boolean 반환으로 구현해 게이트 패턴과 일관성을 맞춘다.
 * 추후 11.6 ai/index.ts 를 이 함수로 교체해 비용 로직을 일원화한다(현재는 수정 금지).
 *
 * ─── 안전 기본값 (AC: #7) ────────────────────────────────────────────────────
 * DB 장애 시 `false` 반환 (fail-safe, 통과).
 * DB 장애로 비용을 집계하지 못하는 경우 "미검출"하는 것이 이상적이지 않으나,
 * 게이트 자체 장애로 인해 모든 잡이 차단되는 것이 더 나쁜 운영 사고이므로
 * warn 로그만 남기고 통과한다. (ARCHITECTURE §11 fail-safe 원칙)
 *
 * @param db - Drizzle DB 인스턴스 (미전달 시 getDb() 사용, 테스트 주입 허용)
 */
export async function isCostLimitReached(db?: Database): Promise<boolean> {
  try {
    const limitUsd = await getBotSetting<number>("bot_daily_cost_limit_usd");
    if (limitUsd == null) return false; // 상한 미설정 = 제한 없음

    const database = db ?? getDb();
    const kstDayStart = getKstDayStart();

    const rows = await database
      .select({ payload: botActivityLog.payload })
      .from(botActivityLog)
      .where(
        and(
          eq(botActivityLog.eventType, "cost"),
          gte(botActivityLog.createdAt, kstDayStart),
        ),
      );

    const totalCostUsd = rows.reduce((sum, r) => {
      const p = r.payload as { costUsd?: number } | null;
      return sum + (p?.costUsd ?? 0);
    }, 0);

    return totalCostUsd >= limitUsd;
  } catch (err) {
    console.warn("[bot-gates] 비용 상한 조회 실패 (fail-safe: false):", (err as Error).message);
    return false;
  }
}

// ── 스킵 로그 ─────────────────────────────────────────────────────────────────

/**
 * 게이트 차단으로 잡을 건너뛸 때 bot_activity_log에 기록한다.
 *
 * 이 함수의 실패는 원래 잡 처리 결과에 영향을 주어선 안 된다 (ARCHITECTURE §11).
 * personaId가 null인 경우 DB NOT NULL 제약으로 INSERT가 불가능하므로 콘솔 로그만 남긴다.
 *
 * @param personaId - bot_personas.id (계획 잡 등 페르소나 없는 경우 null)
 * @param reason    - 차단 사유 (gate.reason 값 그대로)
 * @param jobKind   - 잡 종류 ('write' | 'comment' | 'plan' | 'report' 등)
 */
export async function logBotSkip(
  personaId: string | null,
  reason: string,
  jobKind: string,
): Promise<void> {
  if (personaId === null) {
    // personaId NOT NULL 제약 → DB INSERT 불가, 콘솔에만 기록
    console.info(
      `[bot-gates] 잡 스킵 (personaId=null): reason=${reason}, jobKind=${jobKind}`,
    );
    return;
  }

  try {
    const db = getDb();
    await db.insert(botActivityLog).values({
      personaId,
      eventType: "skipped",
      refId: null,
      payload: { reason, jobKind },
    });
  } catch (err) {
    // 로깅 실패가 잡 크래시를 유발하면 안 됨 (ARCHITECTURE §11 fail-safe)
    console.error("[bot-gates] logBotSkip 기록 실패 (무시):", (err as Error).message);
  }
}

// ── 메인 게이트 ───────────────────────────────────────────────────────────────

/**
 * 봇 잡 처리 전 공통 게이트를 순서대로 확인한다.
 *
 * 판단 순서 (단락 평가 short-circuit):
 * 1. bot_master_enabled(킬 스위치) — false/null/오류 → 즉시 차단
 * 2. 글 수 상한 (jobKind='write' 전용) — bot_daily_post_limit 초과 시 차단
 * 3. 댓글 수 상한 (jobKind='comment' 전용) — bot_daily_comment_limit 초과 시 차단
 * 4. 비용 상한 — bot_daily_cost_limit_usd 초과 시 차단
 * 5. 관찰 모드(bot_observation_mode) 확인
 *
 * jobKind='plan' | 'report' 잡:
 *   킬 스위치만 확인 후 통과 (글 수·비용 상한 불필요 — Story 11.12 Task 2.3)
 *
 * DB 쿼리 최적화:
 *   - 킬 스위치 판정 후 단락 평가 (off이면 나머지 쿼리 불필요)
 *   - 이후 단계는 Promise.all 병렬 처리로 지연 최소화
 *
 * 안전 기본값 (AC: #7):
 *   bot_settings 테이블 미존재·오류 시 getBotSetting이 null 반환 → 킬 스위치 off 처리
 *   → { allowed: false, reason: 'master_disabled' }
 *
 * @param jobKind - 잡 종류 ('write' | 'comment' | 'plan' | 'report' | string)
 */
export async function checkBotGates(jobKind: string): Promise<GateResult> {
  // ── Step 1: 킬 스위치 (단락 평가 — off이면 나머지 DB 쿼리 불필요) ────────────
  let masterEnabled: boolean | null;
  try {
    masterEnabled = await getBotSetting<boolean>("bot_master_enabled");
  } catch {
    // getBotSetting 내부에서 이미 try/catch하므로 여기까지 오면 예상 밖 오류
    masterEnabled = null;
  }

  // null = 테이블 없음 / 키 없음 / DB 오류 → 안전 기본값: 비가동 (AC: #7)
  if (!masterEnabled) {
    return { allowed: false, reason: "master_disabled" };
  }

  // ── 계획·리포트 잡: 킬 스위치만 확인 후 통과 ──────────────────────────────────
  // 계획 생성은 글 수·비용 상한에 걸릴 필요 없음 (Story 11.12 Task 2.3)
  if (jobKind === "plan" || jobKind === "report") {
    const obsMode = await getBotSetting<boolean>("bot_observation_mode").catch(() => null);
    return { allowed: true, observationMode: obsMode ?? false };
  }

  // ── curriculum-publish 잡: 킬 스위치 + 비용 상한만 확인 ─────────────────────
  // 커리큘럼은 관리자가 사전 승인한 콘텐츠 → 글/댓글 수 상한·관찰 모드 미적용.
  // 비용 상한은 여전히 적용(과금 폭주 방지). (Story 13.6 AC: #5)
  if (jobKind === "curriculum-publish") {
    const costReached = await isCostLimitReached().catch(() => false);
    if (costReached) {
      return { allowed: false, reason: "daily_cost_limit_reached" };
    }
    return { allowed: true, observationMode: false };
  }

  // ── Step 2~5: write/comment 잡 — 병렬 조회 (지연 최소화) ─────────────────────
  const [
    postCount,
    commentCount,
    postLimit,
    commentLimit,
    costReached,
    observationMode,
  ] = await Promise.all([
    // write 전용: 오늘 post.published 건수
    jobKind === "write" ? getDailyPublishedCount("post.published") : Promise.resolve(0),
    // comment 전용: 오늘 comment.published 건수
    jobKind === "comment" ? getDailyPublishedCount("comment.published") : Promise.resolve(0),
    // 글 수 상한 설정값 (기본 10)
    getBotSetting<number>("bot_daily_post_limit").catch(() => null),
    // 댓글 수 상한 설정값 (기본 40)
    getBotSetting<number>("bot_daily_comment_limit").catch(() => null),
    // 비용 상한 초과 여부
    isCostLimitReached(),
    // 관찰 모드 여부
    getBotSetting<boolean>("bot_observation_mode").catch(() => null),
  ]);

  // ── Step 2: 글 수 상한 (write 전용) ─────────────────────────────────────────
  if (jobKind === "write") {
    const limit = postLimit ?? 10; // 기본값 10 [Source: 11-5 seed 기본값]
    if (postCount >= limit) {
      return { allowed: false, reason: "daily_post_limit_exceeded" };
    }
  }

  // ── Step 3: 댓글 수 상한 (comment 전용) ─────────────────────────────────────
  if (jobKind === "comment") {
    const limit = commentLimit ?? 40; // 기본값 40 [Source: 11-5 seed 기본값]
    if (commentCount >= limit) {
      return { allowed: false, reason: "daily_comment_limit_exceeded" };
    }
  }

  // ── Step 4: 비용 상한 ────────────────────────────────────────────────────────
  if (costReached) {
    return { allowed: false, reason: "daily_cost_limit_reached" };
  }

  // ── Step 5: 관찰 모드 ────────────────────────────────────────────────────────
  // allowed: true이되 observationMode: true이면 게시 직전 holdForObservation으로 분기
  return { allowed: true, observationMode: observationMode ?? false };
}

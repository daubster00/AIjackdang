/**
 * AI 사용량·비용 집계 API — Story 11.19
 *
 * GET /api/v1/admin/ai-usage?range=today|7d|30d|month
 *  - requireSuperAdmin 전용
 *  - ai_usage_log 테이블 기반 집계 (KST 날짜 경계)
 *  - totals · byProvider · byModel · byPurpose · byFeature · daily · todayVsLimit 반환
 *
 * buildAiUsageReport: 순수 집계 함수 (DB 주입 가능 → 단위 테스트 지원).
 *
 * [Source: _bmad-output/implementation-artifacts/11-19-ai-usage-cost-tracking.md]
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, type Database } from "@ai-jakdang/database";
import { aiUsageLog, botSettings } from "@ai-jakdang/database/schema";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import type { AiUsageReport } from "@ai-jakdang/contracts";
import { getKstDayBounds } from "./report.js";

// ── 범위 파라미터 스키마 ──────────────────────────────────────────────────────

const rangeSchema = z.enum(["today", "7d", "30d", "month"]).default("7d");
type UsageRange = z.infer<typeof rangeSchema>;

// ── KST 범위 계산 유틸 ────────────────────────────────────────────────────────

/**
 * range 값 → UTC 시작 시각 반환.
 * 종료는 항상 now (실시간 집계).
 */
function getRangeStart(range: UsageRange, now: Date = new Date()): Date {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  switch (range) {
    case "today": {
      const today = kstNow.toISOString().slice(0, 10);
      return getKstDayBounds(today).start;
    }
    case "7d": {
      const d = new Date(kstNow);
      d.setDate(d.getDate() - 6); // 오늘 포함 7일
      return getKstDayBounds(d.toISOString().slice(0, 10)).start;
    }
    case "30d": {
      const d = new Date(kstNow);
      d.setDate(d.getDate() - 29); // 오늘 포함 30일
      return getKstDayBounds(d.toISOString().slice(0, 10)).start;
    }
    case "month": {
      const monthStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, "0")}-01`;
      return getKstDayBounds(monthStr).start;
    }
  }
}

/**
 * UTC Date → KST 날짜 문자열 (YYYY-MM-DD).
 * 일별 집계 그룹핑에 사용.
 */
function toKstDateStr(utcDate: Date): string {
  const kst = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// ── 집계 헬퍼 ─────────────────────────────────────────────────────────────────

type RawRow = {
  provider: string;
  model: string;
  purpose: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string; // drizzle numeric → string
  createdAt: Date;
};

type GroupEntry = {
  costUsd: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
};

/** 그룹 맵을 정렬된 배열로 변환 (비용 내림차순). */
function groupMapToArray(
  map: Map<string, GroupEntry>,
): Array<{ key: string; costUsd: number; callCount: number; inputTokens: number; outputTokens: number }> {
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.costUsd - a.costUsd);
}

/** 행 배열로부터 그룹별 집계 맵 생성. */
function buildGroupMap(rows: RawRow[], keyFn: (r: RawRow) => string): Map<string, GroupEntry> {
  const map = new Map<string, GroupEntry>();
  for (const row of rows) {
    const key = keyFn(row);
    const entry = map.get(key) ?? { costUsd: 0, callCount: 0, inputTokens: 0, outputTokens: 0 };
    entry.costUsd += Number(row.costUsd ?? 0);
    entry.callCount++;
    entry.inputTokens += row.inputTokens ?? 0;
    entry.outputTokens += row.outputTokens ?? 0;
    map.set(key, entry);
  }
  return map;
}

// ── buildAiUsageReport: 순수 집계 함수 ───────────────────────────────────────

/**
 * AI 사용량 집계 리포트를 생성한다.
 *
 * DB는 의존성 주입으로 받아 단위 테스트에서 mock 대체 가능.
 * range 파라미터로 집계 기간을 지정한다 (KST 날짜 경계 기준).
 *
 * 성능 고려: 집계는 in-memory(admin 전용 저빈도 호출). 대용량 시 SQL GROUP BY로 교체 가능.
 *
 * @param range - 'today' | '7d' | '30d' | 'month'
 * @param db    - Drizzle DB 인스턴스 (미전달 시 getDb() 사용)
 */
export async function buildAiUsageReport(
  range: UsageRange,
  db: Database = getDb(),
): Promise<AiUsageReport> {
  const now = new Date();
  const start = getRangeStart(range, now);

  // ── 1. 범위 내 ai_usage_log 전체 조회 ──────────────────────────────────────
  const rows = (await db
    .select({
      provider: aiUsageLog.provider,
      model: aiUsageLog.model,
      purpose: aiUsageLog.purpose,
      feature: aiUsageLog.feature,
      inputTokens: aiUsageLog.inputTokens,
      outputTokens: aiUsageLog.outputTokens,
      costUsd: aiUsageLog.costUsd,
      createdAt: aiUsageLog.createdAt,
    })
    .from(aiUsageLog)
    .where(and(gte(aiUsageLog.createdAt, start), lte(aiUsageLog.createdAt, now)))) as RawRow[];

  // ── 2. totals 집계 ──────────────────────────────────────────────────────────
  const totals = rows.reduce(
    (acc, r) => {
      acc.costUsd += Number(r.costUsd ?? 0);
      acc.callCount++;
      acc.inputTokens += r.inputTokens ?? 0;
      acc.outputTokens += r.outputTokens ?? 0;
      return acc;
    },
    { costUsd: 0, callCount: 0, inputTokens: 0, outputTokens: 0 },
  );

  // ── 3. 그룹별 집계 ──────────────────────────────────────────────────────────
  const byProvider = groupMapToArray(buildGroupMap(rows, (r) => r.provider));
  const byModel    = groupMapToArray(buildGroupMap(rows, (r) => r.model));
  const byPurpose  = groupMapToArray(buildGroupMap(rows, (r) => r.purpose));
  const byFeature  = groupMapToArray(buildGroupMap(rows, (r) => r.feature));

  // ── 4. 일별 집계 (KST 날짜 그룹) ───────────────────────────────────────────
  const dailyMap = new Map<string, { costUsd: number; callCount: number }>();
  for (const row of rows) {
    const dateStr = toKstDateStr(row.createdAt);
    const entry = dailyMap.get(dateStr) ?? { costUsd: 0, callCount: 0 };
    entry.costUsd += Number(row.costUsd ?? 0);
    entry.callCount++;
    dailyMap.set(dateStr, entry);
  }
  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // ── 5. 오늘 비용 + 일일 상한 ────────────────────────────────────────────────
  let todayCostUsd: number;
  if (range === "today") {
    // 이미 오늘 데이터만 포함
    todayCostUsd = totals.costUsd;
  } else {
    // 오늘 KST 시작부터 현재까지 별도 집계
    const todayStart = getRangeStart("today", now);
    const todayRows = (await db
      .select({ costUsd: aiUsageLog.costUsd })
      .from(aiUsageLog)
      .where(and(gte(aiUsageLog.createdAt, todayStart), lte(aiUsageLog.createdAt, now)))) as {
      costUsd: string;
    }[];
    todayCostUsd = todayRows.reduce((sum, r) => sum + Number(r.costUsd ?? 0), 0);
  }

  const limitRow = await db
    .select({ value: botSettings.value })
    .from(botSettings)
    .where(eq(botSettings.key, "bot_daily_cost_limit_usd"))
    .limit(1);
  const dailyLimitUsd = (limitRow[0]?.value as number) ?? 0;

  return {
    range,
    totals,
    byProvider,
    byModel,
    byPurpose,
    byFeature,
    daily,
    todayVsLimit: {
      todayCostUsd,
      dailyLimitUsd,
    },
  };
}

// ── registerAiUsageRoutes: Fastify 라우트 등록 ────────────────────────────────

/**
 * AI 사용량 집계 라우트를 등록한다.
 * apps/api/src/routes/admin/bots/index.ts 에서 await registerAiUsageRoutes(app) 로 호출.
 *
 * GET /admin/ai-usage?range=today|7d|30d|month
 *  - requireSuperAdmin: 슈퍼관리자 전용
 *  - range 생략 시 기본값 '7d'
 */
export async function registerAiUsageRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/admin/ai-usage",
    { preHandler: [requireSuperAdmin] },
    async (request, reply) => {
      const parsed = z.object({ range: rangeSchema }).safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: "VALIDATION_ERROR", message: "잘못된 range 파라미터입니다.", details: parsed.error.flatten() },
        });
      }
      try {
        const report = await buildAiUsageReport(parsed.data.range);
        return reply.send(report);
      } catch (err) {
        request.log.error(err);
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "AI 사용량 집계 중 오류가 발생했습니다." },
        });
      }
    },
  );
}

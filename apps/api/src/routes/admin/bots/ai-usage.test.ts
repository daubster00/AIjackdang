/**
 * buildAiUsageReport 단위 테스트 — Story 11.19 Task 3.2, Task 7.5
 *
 * 더미 ai_usage_log 행으로:
 * ① totals: 4행 합산
 * ② byProvider: 제공자별 집계 + 비용 내림차순 정렬
 * ③ byModel: 모델별 집계
 * ④ byPurpose: 용도별 집계
 * ⑤ daily: KST 날짜별 일별 집계 + 오름차순 정렬
 * ⑥ range='today' 시 todayCostUsd = totals.costUsd
 * ⑦ todayVsLimit.dailyLimitUsd: bot_settings 에서 읽음
 * ⑧ range 필드가 응답에 포함됨
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildAiUsageReport } from "./ai-usage.js";
import type { Database } from "@ai-jakdang/database";

// ── 픽스처 ────────────────────────────────────────────────────────────────────

/** KST 2026-06-29 10:00 = UTC 2026-06-29 01:00 */
const DAY1 = new Date("2026-06-29T01:00:00.000Z");
/** KST 2026-06-30 06:00 = UTC 2026-06-30 06:00 (정오 이전이라 같은 KST 날짜) */
const DAY2 = new Date("2026-06-30T06:00:00.000Z");

const DUMMY_ROWS = [
  { provider: "openai",    model: "gpt-4o-mini",       purpose: "generation",    feature: "seeding-bot", inputTokens: 100, outputTokens: 50,  costUsd: "0.001500", createdAt: DAY1 },
  { provider: "openai",    model: "gpt-4o-mini",       purpose: "censor",        feature: "seeding-bot", inputTokens: 80,  outputTokens: 20,  costUsd: "0.000500", createdAt: DAY1 },
  { provider: "anthropic", model: "claude-haiku-4-5",  purpose: "generation",    feature: "seeding-bot", inputTokens: 200, outputTokens: 100, costUsd: "0.003000", createdAt: DAY2 },
  { provider: "google",    model: "gemini-1.5-flash",  purpose: "search_summary",feature: "seeding-bot", inputTokens: 50,  outputTokens: 30,  costUsd: "0.000200", createdAt: DAY2 },
];

/** bot_settings 더미 (daily limit = 5.0) */
const BOT_SETTINGS_ROWS = [{ value: 5.0 }];

// ── Mock 유틸: thenable 쿼리 체인 ─────────────────────────────────────────────

/**
 * 드리즐 select 쿼리 체인을 흉내낸다.
 * await chain       → data 반환
 * await chain.limit(n) → data 반환
 * chain.where(...) → 새 thenable chain (data 유지)
 */
function makeChain<T>(data: T[]) {
  const chain = {
    then<U>(
      onFulfilled: (value: T[]) => U | PromiseLike<U>,
      onRejected?: (reason: unknown) => U | PromiseLike<U>,
    ): Promise<U> {
      return Promise.resolve(data).then(onFulfilled, onRejected);
    },
    where: vi.fn().mockImplementation(() => makeChain(data)),
    limit: vi.fn().mockImplementation(() => makeChain(data)),
  };
  return chain;
}

// ── DB mock 헬퍼 ──────────────────────────────────────────────────────────────

/**
 * buildAiUsageReport 에 주입할 DB mock.
 * select.from() 호출 횟수에 따라 반환 데이터를 결정한다:
 *  - range='today'  : 1st=DUMMY_ROWS, 2nd=BOT_SETTINGS (today 별도 쿼리 없음)
 *  - range≠'today'  : 1st=DUMMY_ROWS (범위), 2nd=today_rows, 3rd=BOT_SETTINGS
 */
function createMockDb(range: "today" | "7d" | "30d" | "month") {
  const today_rows = DUMMY_ROWS.filter((r) => r.createdAt.getTime() >= DAY2.getTime());

  let fromCallCount = 0;

  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation(() => {
        fromCallCount++;
        if (range === "today") {
          // 1st call = 범위 쿼리(DUMMY_ROWS), 2nd call = botSettings
          if (fromCallCount === 1) return makeChain(DUMMY_ROWS);
          return makeChain(BOT_SETTINGS_ROWS);
        } else {
          // 1st = 범위 쿼리, 2nd = today 별도 쿼리, 3rd = botSettings
          if (fromCallCount === 1) return makeChain(DUMMY_ROWS);
          if (fromCallCount === 2) return makeChain(today_rows);
          return makeChain(BOT_SETTINGS_ROWS);
        }
      }),
    }),
  } as unknown as Database;

  return db;
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("buildAiUsageReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("① totals: 4행 합산이 정확하다", async () => {
    const db = createMockDb("7d");
    const report = await buildAiUsageReport("7d", db);

    expect(report.totals.callCount).toBe(4);
    expect(report.totals.inputTokens).toBe(430);   // 100+80+200+50
    expect(report.totals.outputTokens).toBe(200);  // 50+20+100+30
    // costUsd: 0.0015 + 0.0005 + 0.003 + 0.0002 = 0.0052
    expect(report.totals.costUsd).toBeCloseTo(0.0052, 6);
  });

  it("② byProvider: openai·anthropic·google 3종 + 비용 내림차순 정렬", async () => {
    const db = createMockDb("7d");
    const report = await buildAiUsageReport("7d", db);

    expect(report.byProvider.length).toBe(3);

    const openai = report.byProvider.find((p) => p.key === "openai");
    expect(openai?.callCount).toBe(2);
    expect(openai?.costUsd).toBeCloseTo(0.002, 6); // 0.0015 + 0.0005

    const anthropic = report.byProvider.find((p) => p.key === "anthropic");
    expect(anthropic?.callCount).toBe(1);
    expect(anthropic?.costUsd).toBeCloseTo(0.003, 6);

    const google = report.byProvider.find((p) => p.key === "google");
    expect(google?.callCount).toBe(1);
    expect(google?.costUsd).toBeCloseTo(0.0002, 6);

    // 비용 내림차순 정렬
    expect(report.byProvider[0]!.key).toBe("anthropic"); // 0.003
    expect(report.byProvider[1]!.key).toBe("openai");    // 0.002
    expect(report.byProvider[2]!.key).toBe("google");    // 0.0002
  });

  it("③ byModel: 3개 모델 집계", async () => {
    const db = createMockDb("7d");
    const report = await buildAiUsageReport("7d", db);

    expect(report.byModel.length).toBe(3);
    const gpt = report.byModel.find((m) => m.key === "gpt-4o-mini");
    expect(gpt?.callCount).toBe(2);
    expect(gpt?.inputTokens).toBe(180); // 100+80
  });

  it("④ byPurpose: generation·censor·search_summary 3종 집계", async () => {
    const db = createMockDb("7d");
    const report = await buildAiUsageReport("7d", db);

    expect(report.byPurpose.length).toBe(3);
    const gen = report.byPurpose.find((p) => p.key === "generation");
    expect(gen?.callCount).toBe(2);
  });

  it("⑤ daily: 두 KST 날짜로 구분·오름차순 정렬", async () => {
    const db = createMockDb("7d");
    const report = await buildAiUsageReport("7d", db);

    expect(report.daily.length).toBe(2);
    // DAY1 = UTC 01:00 → KST 10:00 → 2026-06-29
    const day1 = report.daily.find((d) => d.date === "2026-06-29");
    expect(day1?.callCount).toBe(2);
    // DAY2 = UTC 06:00 → KST 15:00 → 2026-06-30
    const day2 = report.daily.find((d) => d.date === "2026-06-30");
    expect(day2?.callCount).toBe(2);
    // ASC 정렬
    expect(report.daily[0]!.date).toBe("2026-06-29");
  });

  it("⑥ range='today': todayCostUsd = totals.costUsd (별도 쿼리 없음)", async () => {
    const db = createMockDb("today");
    const report = await buildAiUsageReport("today", db);

    // range='today'일 때 todayCostUsd는 totals.costUsd와 동일
    expect(report.todayVsLimit.todayCostUsd).toBeCloseTo(report.totals.costUsd, 6);
  });

  it("⑦ todayVsLimit.dailyLimitUsd: bot_settings 에서 읽는다", async () => {
    const db = createMockDb("7d");
    const report = await buildAiUsageReport("7d", db);

    expect(report.todayVsLimit.dailyLimitUsd).toBe(5.0);
  });

  it("⑧ range 필드가 응답에 포함된다", async () => {
    const db = createMockDb("30d");
    const report = await buildAiUsageReport("30d", db);
    expect(report.range).toBe("30d");
  });
});

/**
 * botProcessor 디스패처 단위 테스트 — Story 11.13
 *
 * 테스트 항목:
 * 1. 정상 분기: bot.daily-plan → dailyPlanProcessor 호출
 * 2. 정상 분기: bot.write → botWriteProcessor 호출
 * 3. 정상 분기: bot.comment → commentProcessor 호출
 * 4. 정상 분기: bot.daily-report → botDailyReportProcessor 호출
 * 5. 정상 분기: bot.refill-topics → botRefillTopicsProcessor 호출
 * 6. 알 수 없는 job.name → throw 없이 console.warn만 출력, resolved
 *
 * 격리 설계 근거 (주석):
 *   - 한 processor가 throw해도 BullMQ Worker가 내부적으로 catch → failed 이벤트 발행.
 *     Dispatcher가 re-throw하지 않아도 BullMQ가 재시도/실패 처리를 담당한다.
 *     (BullMQ Worker 내부 동작 — 별도 단위 테스트 불필요, 통합 테스트로 검증 가능)
 *
 * [Source: Story 11.13 Task 8]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

// ── vi.hoisted: mock 팩토리보다 먼저 실행되는 변수 선언 ────────────────────────
const mocks = vi.hoisted(() => ({
  dailyPlanProcessor: vi.fn().mockResolvedValue(undefined),
  botWriteProcessor: vi.fn().mockResolvedValue(undefined),
  commentProcessor: vi.fn().mockResolvedValue(undefined),
  botDailyReportProcessor: vi.fn().mockResolvedValue(undefined),
  botRefillTopicsProcessor: vi.fn().mockResolvedValue(undefined),
}));

// ── 모든 processor 모듈을 mock으로 교체 (gates/DB 호출 차단) ──────────────────
vi.mock("./dailyPlan.processor.js", () => ({
  dailyPlanProcessor: mocks.dailyPlanProcessor,
}));
vi.mock("./write.processor.js", () => ({
  botWriteProcessor: mocks.botWriteProcessor,
}));
vi.mock("./comment.processor.js", () => ({
  commentProcessor: mocks.commentProcessor,
}));
vi.mock("./daily-report.processor.js", () => ({
  botDailyReportProcessor: mocks.botDailyReportProcessor,
}));
vi.mock("./refill-topics.processor.js", () => ({
  botRefillTopicsProcessor: mocks.botRefillTopicsProcessor,
}));

// ── 모듈 임포트 (mock 설정 이후) ─────────────────────────────────────────────
import { botProcessor } from "./index.js";

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeJob(name: string, id = "test-job-1"): Job {
  return {
    id,
    name,
    data: {},
  } as unknown as Job;
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("botProcessor 디스패처", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 정상 분기 ──────────────────────────────────────────────────────────────

  it("bot.daily-plan → dailyPlanProcessor를 1회 호출한다", async () => {
    const job = makeJob("bot.daily-plan");
    await botProcessor(job);
    expect(mocks.dailyPlanProcessor).toHaveBeenCalledOnce();
    expect(mocks.dailyPlanProcessor).toHaveBeenCalledWith(job);
  });

  it("bot.write → botWriteProcessor를 1회 호출한다", async () => {
    const job = makeJob("bot.write");
    await botProcessor(job);
    expect(mocks.botWriteProcessor).toHaveBeenCalledOnce();
    expect(mocks.botWriteProcessor).toHaveBeenCalledWith(job);
  });

  it("bot.comment → commentProcessor를 1회 호출한다", async () => {
    const job = makeJob("bot.comment");
    await botProcessor(job);
    expect(mocks.commentProcessor).toHaveBeenCalledOnce();
    expect(mocks.commentProcessor).toHaveBeenCalledWith(job);
  });

  it("bot.daily-report → botDailyReportProcessor를 1회 호출한다", async () => {
    const job = makeJob("bot.daily-report");
    await botProcessor(job);
    expect(mocks.botDailyReportProcessor).toHaveBeenCalledOnce();
    expect(mocks.botDailyReportProcessor).toHaveBeenCalledWith(job);
  });

  it("bot.refill-topics → botRefillTopicsProcessor를 1회 호출한다", async () => {
    const job = makeJob("bot.refill-topics");
    await botProcessor(job);
    expect(mocks.botRefillTopicsProcessor).toHaveBeenCalledOnce();
    expect(mocks.botRefillTopicsProcessor).toHaveBeenCalledWith(job);
  });

  // ── 알 수 없는 잡 이름 ──────────────────────────────────────────────────────

  it("알 수 없는 job.name → throw 없이 console.warn만 출력하고 undefined로 resolve된다", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const job = makeJob("unknown.job", "unknown-id");

    // throw 없이 정상 완료
    await expect(botProcessor(job)).resolves.toBeUndefined();

    // warn이 1회 호출되고 job.name 포함
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain("unknown.job");

    // 다른 processor는 호출되지 않음
    expect(mocks.dailyPlanProcessor).not.toHaveBeenCalled();
    expect(mocks.botWriteProcessor).not.toHaveBeenCalled();
    expect(mocks.commentProcessor).not.toHaveBeenCalled();
    expect(mocks.botDailyReportProcessor).not.toHaveBeenCalled();
    expect(mocks.botRefillTopicsProcessor).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("알 수 없는 job.name이 2개 연속 수신돼도 두 번 모두 warn만 출력하고 throw하지 않는다", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(botProcessor(makeJob("bad.job.a"))).resolves.toBeUndefined();
    await expect(botProcessor(makeJob("bad.job.b"))).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });
});

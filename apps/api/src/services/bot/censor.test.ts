/**
 * 자기검열 서비스 vitest 단위 테스트 — Story 11.9
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SelfCensorInput } from "./censor.js";

// ── 모듈 모킹 ──────────────────────────────────────────────────────────────────

const { mockCallModel, mockGetModelAssignment, mockGetDb } = vi.hoisted(() => ({
  mockCallModel: vi.fn(),
  mockGetModelAssignment: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock("@ai-jakdang/server-bot/ai", () => ({
  callModel: mockCallModel,
  getModelAssignment: mockGetModelAssignment,
}));

vi.mock("@ai-jakdang/database", () => ({
  getDb: mockGetDb,
  schema: {},
}));

const passAllJson = JSON.stringify({
  items: [
    { key: "factuality", result: "pass", reason: "" },
    { key: "ai_tone", result: "pass", reason: "" },
    { key: "persona", result: "pass", reason: "" },
    { key: "safety", result: "pass", reason: "" },
    { key: "duplicate", result: "pass", reason: "" },
    { key: "context", result: "pass", reason: "" },
  ],
});

vi.mock("@ai-jakdang/bot-core", () => ({
  buildCensorSystemPrompt: vi.fn().mockReturnValue("mock system prompt"),
  buildCensorUserPrompt: vi.fn().mockReturnValue("mock user prompt"),
  parseCensorResult: vi.fn((text: string) => {
    // 실제 parseCensorResult 동작 모방 (간단 버전)
    try {
      const parsed = JSON.parse(text) as {
        items?: Array<{ key: string; result: string; reason: string }>;
      };
      const items = parsed.items ?? [];
      const overall = items.some((i) => i.result === "fail")
        ? "fail"
        : items.some((i) => i.result === "ambiguous")
          ? "ambiguous"
          : "pass";
      return { items, overall };
    } catch {
      return {
        items: [
          { key: "factuality", result: "ambiguous", reason: "파싱 실패" },
          { key: "ai_tone", result: "ambiguous", reason: "파싱 실패" },
          { key: "persona", result: "ambiguous", reason: "파싱 실패" },
          { key: "safety", result: "ambiguous", reason: "파싱 실패" },
          { key: "duplicate", result: "ambiguous", reason: "파싱 실패" },
          { key: "context", result: "ambiguous", reason: "파싱 실패" },
        ],
        overall: "ambiguous",
      };
    }
  }),
  isTooSimilar: vi.fn().mockReturnValue(false),
}));

// 테스트 대상 import
import { runSelfCensor } from "./censor.js";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

const mockAssignment = {
  id: "assign-censor-1",
  provider: "anthropic",
  model: "claude-haiku-4-5",
  purpose: "censor",
  isActive: true,
};

const baseInput: SelfCensorInput = {
  jobId: "job-uuid-1",
  personaId: "persona-uuid-1",
  draft: "테스트 초안 텍스트입니다.",
  titleSeed: "Claude Code 활용",
  persona: {
    personaName: "test_user",
    tone: "친근한 말투",
    infoRatio: 60,
    isAdminPersona: false,
    personaId: "persona-uuid-1",
  },
  facts: { facts: ["사실 1", "사실 2"], sourceUrls: [], confidence: "medium" },
  board: "talk",
};

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("runSelfCensor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // getDb가 모킹된 DB를 반환하도록 설정
    mockGetDb.mockReturnValue({});
    // 검열관 모델 할당 기본 반환
    mockGetModelAssignment.mockResolvedValue(mockAssignment);
    // callModel 기본 반환
    mockCallModel.mockResolvedValue({
      text: passAllJson,
      usage: { inputTokens: 200, outputTokens: 100 },
      costUsd: 0.002,
    });
  });

  it("infoRatio=80 → strictness=strict로 buildCensorSystemPrompt 호출", async () => {
    const { buildCensorSystemPrompt } = await import("@ai-jakdang/bot-core");
    const input: SelfCensorInput = {
      ...baseInput,
      persona: { ...baseInput.persona, infoRatio: 80 },
    };

    await runSelfCensor(input);

    expect(buildCensorSystemPrompt).toHaveBeenCalledWith("strict");
  });

  it("infoRatio=50, isAdminPersona=false → strictness=normal", async () => {
    const { buildCensorSystemPrompt } = await import("@ai-jakdang/bot-core");
    const input: SelfCensorInput = {
      ...baseInput,
      persona: { ...baseInput.persona, infoRatio: 50, isAdminPersona: false },
    };

    await runSelfCensor(input);

    expect(buildCensorSystemPrompt).toHaveBeenCalledWith("normal");
  });

  it("infoRatio=20, isAdminPersona=false → strictness=loose", async () => {
    const { buildCensorSystemPrompt } = await import("@ai-jakdang/bot-core");
    const input: SelfCensorInput = {
      ...baseInput,
      persona: { ...baseInput.persona, infoRatio: 20, isAdminPersona: false },
    };

    await runSelfCensor(input);

    expect(buildCensorSystemPrompt).toHaveBeenCalledWith("loose");
  });

  it("isAdminPersona=true → strictness=strict 강제", async () => {
    const { buildCensorSystemPrompt } = await import("@ai-jakdang/bot-core");
    const input: SelfCensorInput = {
      ...baseInput,
      persona: { ...baseInput.persona, infoRatio: 10, isAdminPersona: true },
    };

    await runSelfCensor(input);

    expect(buildCensorSystemPrompt).toHaveBeenCalledWith("strict");
  });

  it("중복 1차 탐지 → callModel 미호출, overall=fail 반환", async () => {
    const { isTooSimilar } = await import("@ai-jakdang/bot-core");
    vi.mocked(isTooSimilar).mockReturnValueOnce(true);

    const input: SelfCensorInput = {
      ...baseInput,
      existingPostTexts: ["기존 글 텍스트"],
    };

    const output = await runSelfCensor(input);

    expect(mockCallModel).not.toHaveBeenCalled();
    expect(output.censorResult.overall).toBe("fail");
    expect(output.costUsd).toBe(0);
  });

  it("callModel 정상 응답 → parseCensorResult 호출, CensorResult 반환", async () => {
    const { parseCensorResult } = await import("@ai-jakdang/bot-core");
    const output = await runSelfCensor(baseInput);

    expect(mockCallModel).toHaveBeenCalledOnce();
    expect(parseCensorResult).toHaveBeenCalledWith(passAllJson);
    expect(output.censorResult.overall).toBe("pass");
  });

  it("검열관 모델 호출 비용이 costUsd에 포함된다", async () => {
    mockCallModel.mockResolvedValueOnce({
      text: passAllJson,
      usage: { inputTokens: 200, outputTokens: 100 },
      costUsd: 0.005,
    });

    const output = await runSelfCensor(baseInput);

    expect(output.costUsd).toBe(0.005);
  });

  it("검열관 모델 미할당 → ambiguous 폴백, callModel 미호출", async () => {
    mockGetModelAssignment.mockResolvedValueOnce(null);

    const output = await runSelfCensor(baseInput);

    expect(mockCallModel).not.toHaveBeenCalled();
    expect(output.censorResult.overall).toBe("ambiguous");
    expect(output.costUsd).toBe(0);
  });

  it("callModel 예외 → ambiguous 폴백", async () => {
    mockCallModel.mockRejectedValueOnce(new Error("AI 서비스 오류"));

    const output = await runSelfCensor(baseInput);

    expect(output.censorResult.overall).toBe("ambiguous");
  });
});

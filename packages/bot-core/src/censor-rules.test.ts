/**
 * censor-rules vitest 단위 테스트 — Story 11.9
 */

import { describe, it, expect } from "vitest";
import {
  buildCensorSystemPrompt,
  buildCensorUserPrompt,
  parseCensorResult,
} from "./censor-rules.js";
import type { CensorUserPromptOptions, FactSummary } from "./context-types.js";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

const mockFacts: FactSummary = {
  facts: ["사실 1", "사실 2"],
  sourceUrls: [],
  confidence: "medium",
};

const mockCensorOptions: CensorUserPromptOptions = {
  draft: "이 글은 테스트용 초안입니다. AI가 생성한 내용이 아닌 척합니다.",
  personaName: "ai_dev_kim",
  tone: "친근하고 가끔 유머 있는",
  titleSeed: "Claude Code 활용법",
  facts: mockFacts,
  board: "talk",
};

// ── buildCensorSystemPrompt ────────────────────────────────────────────────────

describe("buildCensorSystemPrompt", () => {
  it("strict: 관리자 전용·근거 기반 사실성 규칙이 포함된다", () => {
    const prompt = buildCensorSystemPrompt("strict");
    expect(prompt).toContain("strict");
    expect(prompt).toContain("지어낸 수치");
  });

  it("normal: 보통 검열 내용이 포함된다", () => {
    const prompt = buildCensorSystemPrompt("normal");
    expect(prompt).toContain("normal");
    expect(prompt).toContain("명백한 거짓 사실만 fail");
  });

  it("loose: 잡담 면제 규칙이 포함된다", () => {
    const prompt = buildCensorSystemPrompt("loose");
    expect(prompt).toContain("loose");
    expect(prompt).toContain("사실성은 사실상 면제");
  });

  it("공통: 6항목 판정 지시가 포함된다", () => {
    for (const strictness of ["strict", "normal", "loose"] as const) {
      const prompt = buildCensorSystemPrompt(strictness);
      expect(prompt).toContain("factuality");
      expect(prompt).toContain("ai_tone");
      expect(prompt).toContain("safety");
      expect(prompt).toContain("duplicate");
      expect(prompt).toContain("context");
    }
  });

  it("공통: JSON 형식 지시가 포함된다", () => {
    const prompt = buildCensorSystemPrompt("normal");
    expect(prompt).toContain('"items"');
    expect(prompt).toContain('"result"');
  });
});

// ── buildCensorUserPrompt ──────────────────────────────────────────────────────

describe("buildCensorUserPrompt", () => {
  it("캐릭터 이름과 게시판이 포함된다", () => {
    const prompt = buildCensorUserPrompt(mockCensorOptions);
    expect(prompt).toContain("ai_dev_kim");
    expect(prompt).toContain("talk");
  });

  it("원래 주제가 포함된다", () => {
    const prompt = buildCensorUserPrompt(mockCensorOptions);
    expect(prompt).toContain("Claude Code 활용법");
  });

  it("초안 텍스트가 포함된다", () => {
    const prompt = buildCensorUserPrompt(mockCensorOptions);
    expect(prompt).toContain("이 글은 테스트용 초안입니다");
  });

  it("facts가 있으면 참고 사실 요약이 포함된다", () => {
    const prompt = buildCensorUserPrompt(mockCensorOptions);
    expect(prompt).toContain("참고 사실 요약");
    expect(prompt).toContain("사실 1");
  });

  it("facts가 빈 배열이면 참고 사실 요약 섹션이 없다", () => {
    const prompt = buildCensorUserPrompt({
      ...mockCensorOptions,
      facts: { facts: [], sourceUrls: [], confidence: "low" },
    });
    expect(prompt).not.toContain("참고 사실 요약");
  });
});

// ── parseCensorResult ─────────────────────────────────────────────────────────

describe("parseCensorResult", () => {
  it("유효 JSON → CensorResult 변환 (전부 pass → overall=pass)", () => {
    const json = JSON.stringify({
      items: [
        { key: "factuality", result: "pass", reason: "사실 확인됨" },
        { key: "ai_tone", result: "pass", reason: "자연스러움" },
        { key: "persona", result: "pass", reason: "일관성 유지" },
        { key: "safety", result: "pass", reason: "안전" },
        { key: "duplicate", result: "pass", reason: "고유함" },
        { key: "context", result: "pass", reason: "적합" },
      ],
    });
    const result = parseCensorResult(json);
    expect(result.overall).toBe("pass");
    expect(result.items).toHaveLength(6);
    expect(result.items[0].key).toBe("factuality");
    expect(result.items[0].result).toBe("pass");
  });

  it("fail 항목이 하나라도 있으면 overall=fail", () => {
    const json = JSON.stringify({
      items: [
        { key: "factuality", result: "fail", reason: "허위 사실 포함" },
        { key: "ai_tone", result: "pass", reason: "" },
        { key: "persona", result: "pass", reason: "" },
        { key: "safety", result: "pass", reason: "" },
        { key: "duplicate", result: "pass", reason: "" },
        { key: "context", result: "pass", reason: "" },
      ],
    });
    const result = parseCensorResult(json);
    expect(result.overall).toBe("fail");
  });

  it("ambiguous 항목이 있고 fail이 없으면 overall=ambiguous", () => {
    const json = JSON.stringify({
      items: [
        { key: "factuality", result: "ambiguous", reason: "불확실한 수치" },
        { key: "ai_tone", result: "pass", reason: "" },
        { key: "persona", result: "pass", reason: "" },
        { key: "safety", result: "pass", reason: "" },
        { key: "duplicate", result: "pass", reason: "" },
        { key: "context", result: "pass", reason: "" },
      ],
    });
    const result = parseCensorResult(json);
    expect(result.overall).toBe("ambiguous");
  });

  it("깨진 JSON → overall=ambiguous (fail-safe)", () => {
    const result = parseCensorResult("이건 JSON이 아닙니다 {broken");
    expect(result.overall).toBe("ambiguous");
  });

  it("items가 배열이 아닌 JSON → overall=ambiguous", () => {
    const result = parseCensorResult('{ "items": "잘못된 형식" }');
    expect(result.overall).toBe("ambiguous");
  });

  it("빈 응답 → overall=ambiguous", () => {
    const result = parseCensorResult("");
    expect(result.overall).toBe("ambiguous");
  });

  it("알 수 없는 result 값 → ambiguous로 정규화", () => {
    const json = JSON.stringify({
      items: [
        { key: "factuality", result: "unknown_value", reason: "알수없음" },
        { key: "ai_tone", result: "pass", reason: "" },
        { key: "persona", result: "pass", reason: "" },
        { key: "safety", result: "pass", reason: "" },
        { key: "duplicate", result: "pass", reason: "" },
        { key: "context", result: "pass", reason: "" },
      ],
    });
    const result = parseCensorResult(json);
    // unknown_value → ambiguous로 정규화 → overall=ambiguous
    expect(result.items[0].result).toBe("ambiguous");
    expect(result.overall).toBe("ambiguous");
  });

  it("응답에 JSON 앞뒤로 설명 텍스트가 있어도 파싱된다", () => {
    const response = `다음은 판정 결과입니다:\n${JSON.stringify({
      items: [
        { key: "factuality", result: "pass", reason: "" },
        { key: "ai_tone", result: "pass", reason: "" },
        { key: "persona", result: "pass", reason: "" },
        { key: "safety", result: "pass", reason: "" },
        { key: "duplicate", result: "pass", reason: "" },
        { key: "context", result: "pass", reason: "" },
      ],
    })}\n판정 완료.`;
    const result = parseCensorResult(response);
    expect(result.overall).toBe("pass");
  });
});

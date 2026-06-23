import { describe, expect, it } from "vitest";
import { isBlank, normalizeWhitespace, slugify, truncate } from "./string";

describe("normalizeWhitespace", () => {
  it("앞뒤 공백을 제거하고 연속 공백을 하나로 줄인다", () => {
    expect(normalizeWhitespace("  AI   작당  ")).toBe("AI 작당");
  });
});

describe("slugify", () => {
  it("한글을 유지하고 공백을 하이픈으로 바꾼다", () => {
    expect(slugify("Claude Code 작업 흐름")).toBe("claude-code-작업-흐름");
  });

  it("허용되지 않는 기호를 제거한다", () => {
    expect(slugify("MCP! @설정#")).toBe("mcp-설정");
  });
});

describe("truncate", () => {
  it("길이를 넘으면 말줄임표를 붙인다", () => {
    expect(truncate("실전자료 다운로드", 5)).toBe("실전자료…");
  });

  it("길이 이내면 그대로 둔다", () => {
    expect(truncate("짧은 글", 10)).toBe("짧은 글");
  });
});

describe("isBlank", () => {
  it("null·공백 문자열을 빈 값으로 판단한다", () => {
    expect(isBlank("   ")).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank("내용")).toBe(false);
  });
});

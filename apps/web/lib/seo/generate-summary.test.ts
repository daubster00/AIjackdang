/**
 * generateSummary 단위 테스트
 * AC#8: 5개 케이스 (a~e)
 */

import { describe, it, expect } from "vitest";
import { generateSummary } from "./generate-summary";

// ── 테스트 픽스처 헬퍼 ───────────────────────────────────────────────────────

function textNode(text: string) {
  return { type: "text", text };
}

function paragraph(...texts: string[]) {
  return {
    type: "paragraph",
    content: texts.map(textNode),
  };
}

function doc(...nodes: object[]) {
  return { type: "doc", content: nodes };
}

// ── 테스트 케이스 ────────────────────────────────────────────────────────────

describe("generateSummary", () => {
  // (a) 일반 단락 → 텍스트 추출 (공백 정규화 포함)
  it("(a) 일반 단락에서 텍스트를 추출한다", () => {
    const content = doc(
      paragraph("안녕하세요."),
      paragraph("이것은 테스트 문장입니다.")
    );
    const result = generateSummary(content);
    expect(result).toBe("안녕하세요. 이것은 테스트 문장입니다.");
  });

  // (b) 200자 초과 → 200자 truncate + "..."
  it("(b) 200자를 초과하는 텍스트는 200자로 잘리고 '...'이 붙는다", () => {
    const longText = "가".repeat(250);
    const content = doc(paragraph(longText));
    const result = generateSummary(content);
    expect(result).toBe("가".repeat(200) + "...");
    expect(result.length).toBe(203); // 200자 + "..." 3자
  });

  // (c) 빈 JSON {} → ""
  it("(c) 빈 JSON 객체는 빈 문자열을 반환한다", () => {
    expect(generateSummary({})).toBe("");
  });

  // (d) 이미지 노드만 → ""
  it("(d) 이미지 노드만 있는 경우 빈 문자열을 반환한다", () => {
    const content = doc(
      { type: "paragraph", content: [{ type: "image", attrs: { src: "https://example.com/img.png" } }] }
    );
    const result = generateSummary(content);
    // 이미지는 공백으로 대체되지만 trim 후 빈 문자열
    expect(result).toBe("");
  });

  // (e) 코드블록만 → ""
  it("(e) 코드블록만 있는 경우 빈 문자열을 반환한다", () => {
    const content = doc({
      type: "codeBlock",
      content: [textNode("const x = 1;")],
    });
    const result = generateSummary(content);
    expect(result).toBe("");
  });
});

/**
 * tiptapDocToMarkdown 단위 테스트.
 *
 * 이미지 플래너가 본문을 평문(공백 뭉치기)이 아니라 "구조 보존" 마크다운으로
 * 넘겨야 재파싱 시 빈 문단(줄 간격)이 유지된다는 회귀 방지 테스트.
 */

import { describe, it, expect } from "vitest";
import { extractTextFromTiptap, tiptapDocToMarkdown } from "./tiptap-text.js";

describe("tiptapDocToMarkdown", () => {
  it("문단 사이를 빈 줄(\\n\\n)로 구분해 구조를 보존한다", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "소제목" }] },
        { type: "paragraph", content: [{ type: "text", text: "첫 문단." }] },
        { type: "paragraph" }, // 빈 문단(간격)
        { type: "paragraph", content: [{ type: "text", text: "둘째 문단." }] },
      ],
    };

    const md = tiptapDocToMarkdown(doc);

    expect(md).toBe("## 소제목\n\n첫 문단.\n\n둘째 문단.");
    // 블록 사이에 빈 줄이 반드시 존재해야 한다(간격 복원의 전제).
    expect(md).toContain("\n\n");
  });

  it("평문 추출(extractTextFromTiptap)과 달리 문단 경계가 살아있다", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A" }] },
        { type: "paragraph", content: [{ type: "text", text: "B" }] },
      ],
    };

    // 옛 경로: 공백 하나로 뭉쳐 경계가 사라진다.
    expect(extractTextFromTiptap(doc)).toBe("A B");
    // 새 경로: 빈 줄로 경계를 유지한다.
    expect(tiptapDocToMarkdown(doc)).toBe("A\n\nB");
  });

  it("코드블록·목록 구조를 유지한다", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const a = 1;" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "항목1" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "항목2" }] }] },
          ],
        },
      ],
    };

    const md = tiptapDocToMarkdown(doc);
    expect(md).toContain("```ts\nconst a = 1;\n```");
    expect(md).toContain("- 항목1\n- 항목2");
  });
});

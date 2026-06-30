/**
 * Tiptap JSON ↔ 평문 텍스트 변환 헬퍼.
 *
 * - textToTiptapJson: 평문 텍스트(줄바꿈 포함) → Tiptap JSONContent
 * - tiptapJsonToText: Tiptap JSONContent → 평문 텍스트 (서식 제거, 줄바꿈 보존)
 */

import type { JSONContent } from "@tiptap/react";

/**
 * 평문 텍스트를 Tiptap JSONContent 형식으로 변환한다.
 * 줄바꿈(\n)은 별도 paragraph 노드로 분리된다.
 *
 * @example
 * textToTiptapJson("안녕하세요\n반갑습니다")
 * // → { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "안녕하세요" }] }, { type: "paragraph", content: [{ type: "text", text: "반갑습니다" }] }] }
 */
export function textToTiptapJson(text: string): JSONContent {
  if (!text || text.trim() === "") {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  const paragraphs: JSONContent[] = text.split("\n").map((line) => {
    if (!line) {
      return { type: "paragraph" };
    }
    return {
      type: "paragraph",
      content: [{ type: "text", text: line }],
    };
  });

  return { type: "doc", content: paragraphs };
}

/**
 * Tiptap JSONContent에서 평문 텍스트를 재귀적으로 추출한다.
 * 단락/제목 등 블록 노드 사이에는 줄바꿈이 삽입된다.
 *
 * @example
 * tiptapJsonToText({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "안녕" }] }] })
 * // → "안녕"
 */
export function tiptapJsonToText(json: JSONContent): string {
  const BLOCK_TYPES = new Set([
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "listItem",
    "blockquote",
    "codeBlock",
  ]);

  function extract(node: JSONContent): string {
    if (node.type === "text") {
      return node.text ?? "";
    }
    if (node.type === "hardBreak") {
      return "\n";
    }
    if (node.content && node.content.length > 0) {
      const children = node.content.map(extract).join("");
      if (BLOCK_TYPES.has(node.type ?? "")) {
        return children + "\n";
      }
      return children;
    }
    return "";
  }

  return extract(json).trim();
}

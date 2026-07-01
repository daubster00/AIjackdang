/**
 * Tiptap JSON 텍스트 추출 — 순수 함수 (Epic 11 bot-core).
 *
 * contentGuard.ts의 동일 로직을 worker/server-bot/api가 공유하도록 bot-core로 이관.
 * apps/api/src/middleware/contentGuard.ts 직접 import 금지(경계 위반) — 이 함수를 쓴다.
 */

export type TiptapNode = {
  type?: string;
  text?: string;
  content?: TiptapNode[];
};

/** Tiptap JSON 노드 트리에서 text 노드 값을 재귀로 추출해 공백으로 이어붙인다. */
export function extractTextFromTiptap(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as TiptapNode;
  const parts: string[] = [];
  if (n.type === "text" && typeof n.text === "string") {
    parts.push(n.text);
  }
  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      parts.push(extractTextFromTiptap(child));
    }
  }
  return parts.join(" ").trim();
}

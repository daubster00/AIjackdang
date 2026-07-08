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

/** 한 블록(문단·헤딩·리스트 항목) 안의 인라인 텍스트를 공백 없이 이어붙인다. */
function inlineText(node: TiptapNode): string {
  if (!node || typeof node !== "object") return "";
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content.map(inlineText).join("");
}

/**
 * Tiptap JSON 문서를 "구조 보존" 마크다운으로 직렬화한다.
 *
 * extractTextFromTiptap()은 모든 텍스트를 공백 하나로 뭉쳐 문단·빈 줄 구분을
 * 없애므로(이미지 플래너가 이걸 쓰면 재파싱 시 빈 문단이 사라져 줄 간격이
 * 붕괴한다), 블록 경계를 빈 줄(\n\n)로 유지하는 별도 직렬화기를 제공한다.
 *
 * - heading → "## " / "### " 접두
 * - codeBlock → ```lang 펜스
 * - blockquote → "> " 접두
 * - bulletList/orderedList → "- " / "1. " 항목
 * - 그 외(문단 포함) → 인라인 텍스트
 * - 블록 사이는 항상 빈 줄 하나(\n\n)로 구분 → parseMarkdownLines가
 *   블록마다 빈 문단(간격)을 복원한다.
 */
export function tiptapDocToMarkdown(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const root = doc as TiptapNode;
  const blocks = Array.isArray(root.content) ? root.content : [];
  const out: string[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as TiptapNode & { attrs?: { level?: number; language?: string } };

    switch (b.type) {
      case "heading": {
        const level = Math.min(Math.max(Number(b.attrs?.level) || 2, 1), 3);
        const text = inlineText(b).trim();
        if (text) out.push(`${"#".repeat(level)} ${text}`);
        break;
      }
      case "codeBlock": {
        const lang = b.attrs?.language ?? "";
        const code = inlineText(b);
        out.push(`\`\`\`${lang}\n${code}\n\`\`\``);
        break;
      }
      case "blockquote": {
        const inner = Array.isArray(b.content)
          ? b.content.map((c) => inlineText(c).trim()).filter(Boolean).join("\n")
          : inlineText(b).trim();
        if (inner) out.push(inner.split("\n").map((l) => `> ${l}`).join("\n"));
        break;
      }
      case "bulletList":
      case "orderedList": {
        const items = Array.isArray(b.content) ? b.content : [];
        const lines = items.map((item, i) => {
          const t = inlineText(item).trim();
          return b.type === "orderedList" ? `${i + 1}. ${t}` : `- ${t}`;
        });
        if (lines.some(Boolean)) out.push(lines.join("\n"));
        break;
      }
      default: {
        // 문단 등: 빈 문단은 건너뛴다(블록 사이 \n\n 구분이 간격을 만든다).
        const text = inlineText(b).trim();
        if (text) out.push(text);
        break;
      }
    }
  }

  return out.join("\n\n");
}

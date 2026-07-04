/**
 * Tiptap 파서 헬퍼 — Story 13.3 공유 추출
 *
 * parseResponseToTiptap · parseMarkdownLines를 post-pipeline.ts에서 추출해
 * curriculum-staging.ts에서도 재사용할 수 있도록 공유 모듈로 분리한다.
 *
 * [Source: apps/api/src/services/bot/post-pipeline.ts]
 * [Source: docs/seeding-bot/ARCHITECTURE.md §7 글 생성 파이프라인]
 */

export type TiptapInternalNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapInternalNode[];
};

/**
 * 모델 응답 텍스트를 Tiptap JSON으로 변환.
 * Tiptap JSON 직접 반환 감지 → 마크다운 파싱 → fallback(단순 paragraph) 순서.
 */
export function parseResponseToTiptap(text: string): Record<string, unknown> {
  const trimmed = text.trim();

  // 1) Tiptap JSON 직접 반환 감지
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.type === "doc" && Array.isArray(parsed.content)) {
        return parsed;
      }
    } catch {
      // 파싱 실패 → 다음 단계로
    }
  }

  // 2) 마크다운 → Tiptap 변환
  const content = parseMarkdownLines(trimmed);
  return { type: "doc", content };
}

export function parseMarkdownLines(markdown: string): TiptapInternalNode[] {
  const lines = markdown.split("\n");
  const nodes: TiptapInternalNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // 코드 블록
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      nodes.push({
        type: "codeBlock",
        attrs: lang ? { language: lang } : {},
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      i++;
      continue;
    }

    // 헤딩
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      nodes.push({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: h3Match[1] }] });
      i++;
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      nodes.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: h2Match[1] }] });
      i++;
      continue;
    }
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      nodes.push({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: h1Match[1] }] });
      i++;
      continue;
    }

    // 빈 줄 → 빈 문단(문단 사이 간격). 표준 편집기와 동일하게 "빈 줄 = 간격".
    // 맨 앞 빈 줄은 무시하고, 연속 빈 줄은 하나로 축약한다.
    if (!line.trim()) {
      const last = nodes[nodes.length - 1];
      const lastIsEmptyParagraph =
        !!last &&
        last.type === "paragraph" &&
        (!last.content || last.content.length === 0);
      if (nodes.length > 0 && !lastIsEmptyParagraph) {
        nodes.push({ type: "paragraph" });
      }
      i++;
      continue;
    }

    // 단락
    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: line.replace(/\*\*(.*?)\*\*/g, "$1") }],
    });
    i++;
  }

  if (nodes.length === 0) {
    return [{ type: "paragraph", content: [{ type: "text", text: markdown.trim() }] }];
  }

  return nodes;
}

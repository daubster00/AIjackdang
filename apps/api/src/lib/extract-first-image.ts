/**
 * Tiptap JSON 본문에서 첫 번째 이미지 URL을 추출한다.
 *
 * Tiptap doc 노드를 재귀적으로 탐색하여
 * type === "image" 인 첫 번째 노드의 attrs.src 를 반환한다.
 * 이미지가 없으면 null 반환.
 *
 * 용도: post/resource 저장 시 thumbnail_url 자동 세팅.
 * 크롭·리사이징은 웹 표시 시 CSS object-fit:cover 로 처리하며
 * sharp 등 네이티브 이미지 라이브러리를 설치하지 않는다.
 */

/** Tiptap 노드의 최소 타입 정의 */
interface TiptapNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

/**
 * Tiptap JSON doc 에서 첫 번째 이미지 URL 을 재귀 탐색으로 추출한다.
 *
 * @param contentJson - Tiptap doc 루트 객체 (Record<string, unknown> 또는 TiptapNode)
 * @returns 첫 번째 이미지 src URL, 없으면 null
 */
export function extractFirstImageUrl(contentJson: unknown): string | null {
  if (!contentJson || typeof contentJson !== "object") return null;
  return walkNode(contentJson as TiptapNode);
}

function walkNode(node: TiptapNode): string | null {
  // 현재 노드가 이미지인지 확인
  if (node.type === "image") {
    const src = node.attrs?.src;
    if (typeof src === "string" && src.trim().length > 0) {
      return src.trim();
    }
  }

  // 자식 노드 재귀 탐색
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const result = walkNode(child);
      if (result !== null) return result;
    }
  }

  return null;
}

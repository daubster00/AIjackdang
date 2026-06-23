/**
 * Tiptap JSON → 평문 요약 추출기
 *
 * Tiptap 문서 JSON을 재귀적으로 순회하여 텍스트 노드만 수집하고,
 * 공백 정규화 후 지정된 최대 길이로 잘라 반환한다.
 *
 * 지원 노드:
 *   - 텍스트 기여: `text`, `paragraph`, `heading`, `blockquote`, `listItem`, `tableCell` 등
 *   - 공백 1개로 대체: `image`, `hardBreak`
 *   - 텍스트 기여 없음(무시): `codeBlock`, `horizontalRule`
 */

/** Tiptap 노드 타입 최소 인터페이스 */
interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
}

/** 텍스트를 추출하지 않는 노드 유형 */
const IGNORED_TYPES = new Set(["codeBlock", "horizontalRule", "code"]);

/** 공백 1개로 대체되는 노드 유형 */
const SPACE_TYPES = new Set(["image", "hardBreak"]);

/**
 * TiptapNode 를 재귀 순회하여 평문 텍스트를 추출한다.
 * @internal
 */
function extractText(node: TiptapNode): string {
  if (!node || typeof node !== "object") return "";

  const nodeType = node.type ?? "";

  // 무시 노드: 텍스트 기여 없음
  if (IGNORED_TYPES.has(nodeType)) return "";

  // 공백 대체 노드
  if (SPACE_TYPES.has(nodeType)) return " ";

  // 텍스트 노드: 직접 반환
  if (nodeType === "text" && typeof node.text === "string") {
    return node.text;
  }

  // 자식 노드 재귀 순회
  if (Array.isArray(node.content)) {
    return node.content.map(extractText).join("");
  }

  return "";
}

/**
 * Tiptap JSON 에서 텍스트를 추출하여 maxLen 자 이내로 반환한다.
 *
 * @param contentJson - Tiptap 문서 JSON (`{ type: "doc", content: [...] }`)
 * @param maxLen      - 최대 문자 수 (기본값: 200)
 * @returns 정제된 요약 문자열. 텍스트가 없으면 `""`.
 */
export function generateSummary(
  contentJson: unknown,
  maxLen: number = 200
): string {
  if (!contentJson || typeof contentJson !== "object") return "";

  const doc = contentJson as TiptapNode;

  // doc 루트 또는 content 배열이 없으면 빈 문자열
  if (!Array.isArray(doc.content) || doc.content.length === 0) return "";

  const raw = doc.content.map(extractText).join(" ");

  // 공백 정규화
  const text = raw.replace(/\s+/g, " ").trim();

  if (!text) return "";

  // maxLen 초과 시 잘라서 "..." 추가
  if (text.length > maxLen) {
    return `${text.slice(0, maxLen)}...`;
  }

  return text;
}

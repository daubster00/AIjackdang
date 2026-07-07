/**
 * Tiptap JSON → 안전 HTML 변환기 — Story 2.6 (AC #1, #3).
 *
 * @tiptap/html generateHTML 을 사용하여 Tiptap JSON 을 HTML 로 변환한 뒤,
 * sanitizeHtml() 로 XSS 차단 화이트리스트를 적용한다.
 *
 * 코드블록 특수문자(<, >, &)는 ProseMirror schema 가 이스케이프하므로
 * sanitize-html 의 disableOutputEncoding 기본값(false) 으로 보존된다.
 */

import { generateHTML } from "@tiptap/html";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { TextAlign } from "@tiptap/extension-text-align";
import { Youtube } from "@tiptap/extension-youtube";
import { Extension, Node, mergeAttributes } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { sanitizeHtml } from "./sanitize.js";

/**
 * FontSize 서버 사이드 렌더 확장.
 * 클라이언트의 apps/web/features/editor/extensions/FontSize.ts 와 동일한 renderHTML 로직.
 * generateHTML 이 font-size 를 span[style] 로 출력하기 위해 필요하다.
 */
const FontSizeRenderer = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            // 서버 렌더(generateHTML)에서는 parseHTML 이 호출되지 않지만 타입 정합을 위해 유지.
            // API tsconfig 에는 DOM lib 가 없으므로 HTMLElement 대신 구조적 타입을 쓴다.
            parseHTML: (element: { style?: { fontSize?: string } }) =>
              element.style?.fontSize?.replace(/['"]+/g, "") || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes["fontSize"]) return {};
              return { style: `font-size: ${attributes["fontSize"]}` };
            },
          },
        },
      },
    ];
  },
});

/**
 * Caption 서버 사이드 렌더 노드.
 * 클라이언트의 apps/web/features/editor/extensions/Caption.ts 와 동일한 renderHTML 로직.
 * generateHTML 이 "caption" 노드를 <p class="caption"> 로 출력하기 위해 필요하다.
 */
const CaptionRenderer = Node.create({
  name: "caption",
  group: "block",
  content: "inline*",
  // 확장 레벨 priority 는 주지 않는다(클라이언트 Caption.ts 와 동일). 파스 우선순위는 규칙 레벨로.
  parseHTML() {
    return [
      { tag: "p.caption", priority: 60 },
      { tag: "figcaption", priority: 60 },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { class: "caption" }), 0];
  },
});

/**
 * FULL_ALLOWED_NODES 에 대응하는 Tiptap 확장 목록.
 * StarterKit 은 paragraph·text·hardBreak·bold·italic·heading·bulletList·orderedList·
 * listItem·blockquote·codeBlock·code·link·strike·underline·horizontalRule 을 포함한다.
 * Image·Highlight·TextStyle·Color 는 StarterKit 에 없으므로 별도 등록한다.
 */
const EXTENSIONS = [
  StarterKit,
  Image,
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Color,
  // 폰트 크기 — font-size 인라인 스타일 렌더 (옛 글 호환용)
  FontSizeRenderer,
  // 캡션 — <p class="caption"> 시맨틱 문단 렌더
  CaptionRenderer,
  // 좌/가운데/우 정렬 — text-align style 로 렌더
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  // 동영상 — YouTube iframe 으로 렌더 (sanitize 에서 youtube 도메인만 허용)
  Youtube.configure({ nocookie: true }),
];

/**
 * Tiptap JSON 콘텐츠를 안전한 HTML 문자열로 변환한다.
 *
 * 1. `generateHTML` 으로 Tiptap JSON → 원시 HTML 변환.
 * 2. `sanitizeHtml` 로 XSS 차단 화이트리스트 적용.
 *
 * @param contentJson - Tiptap JSON (DB 의 content_json 컬럼 값)
 * @returns 새니타이즈된 HTML 문자열. 변환 실패 시 빈 문자열.
 */
export function tiptapJsonToHtml(contentJson: unknown): string {
  try {
    const doc = contentJson as JSONContent;

    // doc 타입이 없거나 빈 객체면 빈 문자열 반환
    if (!doc || typeof doc !== "object") {
      return "";
    }

    const rawHtml = generateHTML(doc, EXTENSIONS);
    return sanitizeHtml(rawHtml);
  } catch (err) {
    // 변환 실패 시 조용히 빈 문자열 반환 (서버 장애 전파 방지)
    console.warn("[tiptap-renderer] JSON→HTML 변환 실패:", (err as Error).message);
    return "";
  }
}

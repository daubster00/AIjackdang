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
  // 좌/가운데/우 정렬 — text-align style 로 렌더 (이미지 포함 — CSS 에서 margin 으로 변환)
  TextAlign.configure({ types: ["heading", "paragraph", "image"] }),
  // 동영상 — YouTube iframe 으로 렌더 (sanitize 에서 youtube 도메인만 허용)
  Youtube.configure({ nocookie: true }),
];

// ── 봇 콘텐츠 구조 정규화 ───────────────────────────────────────────────────────
//
// 봇 이미지 마커 삽입 파이프라인이 남기는 두 가지 구조 결함을 렌더 직전에 정리한다.
// (실제 사고글: "GPT-5.6 3단계 모델별 프롬프트 설계법" — 소제목 아래 큰 공백 + 이미지마다
//  직전 문단 꼬리가 통째로 복제된 문단이 붙어 레이아웃이 깨져 보였다.)
//
//  ① 헤딩(h1~h4)에 바로 붙은 빈 문단 → 헤딩 자체 여백과 겹쳐 과도한 공백. 제거.
//  ② 이미지 바로 뒤의 문단이 이미지 alt 텍스트이거나 직전 문단 꼬리의 복제 → 제거.
//
// 읽기 경로에서만 정리하므로 DB 마이그레이션 없이 기존 글까지 즉시 반영된다.
// 사람 작성 글은 ②의 "복제" 조건에 걸리지 않으므로 안전하다(일반 빈 줄 간격은 보존).

/** 노드에서 순수 텍스트만 추출(inline text 연결). */
function extractNodeText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map((c) => extractNodeText(c)).join("");
  }
  return "";
}

/** 공백 제거 + 소문자화(관대한 텍스트 일치 비교용). */
function normalizeText(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/** 텍스트가 비어 있는 문단인가. */
function isEmptyParagraph(node: JSONContent | undefined): boolean {
  return !!node && node.type === "paragraph" && normalizeText(extractNodeText(node)) === "";
}

/**
 * 봇 콘텐츠 구조 결함(헤딩 인접 빈 문단·이미지 뒤 중복 문단)을 정리한 새 doc 을 반환한다.
 * 최상위 content 배열만 순회하며, 유지할 노드를 새 배열로 재구성한다(원본 불변).
 */
function normalizeBotContentDoc(doc: JSONContent): JSONContent {
  if (!Array.isArray(doc.content)) return doc;
  const src = doc.content;
  const out: JSONContent[] = [];

  for (let i = 0; i < src.length; i++) {
    const node = src[i];
    const prev = out[out.length - 1];
    const next = src[i + 1];

    // ① 헤딩에 바로 인접한(앞·뒤) 빈 문단 제거 + 연속 빈 문단 축약.
    if (isEmptyParagraph(node)) {
      if (prev?.type === "heading") continue;
      if (next?.type === "heading") continue;
      if (isEmptyParagraph(prev)) continue;
      out.push(node);
      continue;
    }

    // ② 이미지 바로 뒤의 중복 문단 제거.
    if (node.type === "paragraph" && prev?.type === "image") {
      const pText = normalizeText(extractNodeText(node));
      const altText = normalizeText(
        typeof prev.attrs?.["alt"] === "string" ? (prev.attrs["alt"] as string) : "",
      );
      // 이미지 앞에 유지된 본문 문단(prev 는 image, 그 앞이 본문).
      const beforeImg = out[out.length - 2];
      const beforeText = beforeImg ? normalizeText(extractNodeText(beforeImg)) : "";
      const isDuplicate =
        pText.length >= 6 &&
        ((altText.length > 0 && pText === altText) ||
          (beforeText.length > 0 && beforeText.endsWith(pText)));
      if (isDuplicate) continue;
      out.push(node);
      continue;
    }

    out.push(node);
  }

  return { ...doc, content: out };
}

/**
 * Tiptap JSON 콘텐츠를 안전한 HTML 문자열로 변환한다.
 *
 * 1. `normalizeBotContentDoc` 으로 봇 콘텐츠 구조 결함 정리.
 * 2. `generateHTML` 으로 Tiptap JSON → 원시 HTML 변환.
 * 3. `sanitizeHtml` 로 XSS 차단 화이트리스트 적용.
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

    const normalized = normalizeBotContentDoc(doc);
    const rawHtml = generateHTML(normalized, EXTENSIONS);
    return sanitizeHtml(rawHtml);
  } catch (err) {
    // 변환 실패 시 조용히 빈 문자열 반환 (서버 장애 전파 방지)
    console.warn("[tiptap-renderer] JSON→HTML 변환 실패:", (err as Error).message);
    return "";
  }
}

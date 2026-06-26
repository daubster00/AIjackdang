/**
 * HTML 새니타이저 — Story 2.6 (AR-8 XSS 차단).
 *
 * 단일 소스 원칙:
 *   FULL_ALLOWED_NODES (packages/contracts/src/editor.ts) 가 유일한 화이트리스트 소스.
 *   buildSanitizeOptions() 는 해당 상수를 받아 sanitize-html IOptions 를 반환한다.
 *   서버 새니타이저와 클라이언트 에디터 확장 목록이 항상 동기화된다.
 */

import _sanitizeHtml from "sanitize-html";
import { FULL_ALLOWED_NODES } from "@ai-jakdang/contracts";
import type { AllowedNode } from "@ai-jakdang/contracts";

// ── Tiptap/ProseMirror 노드명 → HTML 태그명 매핑 ───────────────────────────────
/**
 * Tiptap 노드·마크 이름을 HTML 태그명으로 변환한다.
 * 목록에 없는 노드는 null 을 반환하여 허용 태그에서 제외한다.
 */
function tiptapNodeToHtmlTag(type: string): string | null {
  // text 노드는 별도 태그 없음
  if (type === "text" || type === "doc") return null;

  const map: Record<string, string> = {
    // 블록 노드
    paragraph: "p",
    hardBreak: "br",
    heading: "h1", // h1~h6 — 별도로 h2·h3 도 허용 태그에 추가
    bulletList: "ul",
    orderedList: "ol",
    listItem: "li",
    blockquote: "blockquote",
    codeBlock: "pre",
    horizontalRule: "hr",
    // 인라인 노드·마크
    bold: "strong",
    italic: "em",
    underline: "u",
    strike: "s",
    code: "code",
    link: "a",
    image: "img",
    // 색상·형광펜 (span 으로 렌더됨)
    textStyle: "span",
    color: "span",
    highlight: "mark",
  };
  return map[type] ?? null;
}

// ── 코드블록 내 허용 클래스 패턴 ───────────────────────────────────────────────
/** sanitize-html 의 allowedClasses 는 glob 패턴을 지원하지 않으므로 정규식으로 처리한다. */
const CODE_CLASS_PATTERN = /^language-[\w-]+$/;

// ── buildSanitizeOptions ───────────────────────────────────────────────────────

/**
 * AllowedNode[] 배열로부터 sanitize-html IOptions 를 생성한다.
 *
 * - `allowedTags`: 노드 타입에서 HTML 태그로 변환한 목록 + 기본 태그(p, br, pre, code)
 * - `allowedAttributes`: 노드의 attrs 를 태그별로 매핑
 * - `allowedClasses`: code 태그에 language-* 패턴 허용 (정규식 사용)
 * - `exclusiveFilter`: javascript: href 를 가진 <a> 제거
 * - `disallowedTagsMode`: 허용되지 않은 태그는 내용 포함 완전 제거
 */
export function buildSanitizeOptions(
  nodes: AllowedNode[],
): _sanitizeHtml.IOptions {
  // 1) 허용 태그 수집
  const tagSet = new Set<string>(["p", "br", "pre", "code"]);

  for (const node of nodes) {
    const tag = tiptapNodeToHtmlTag(node.type);
    if (tag) tagSet.add(tag);
  }

  // heading 은 h2·h3 만 허용 (H1 은 페이지 SEO 제목 전용, H4↓ 미지원)
  const hasHeading = nodes.some((n) => n.type === "heading");
  if (hasHeading) {
    tagSet.delete("h1"); // tiptapNodeToHtmlTag 에서 h1 추가됐을 수 있으므로 삭제
    tagSet.add("h2");
    tagSet.add("h3");
  }

  // 2) 허용 속성 수집
  const attrMap: Record<string, string[]> = {
    // 기본값 — 노드에서 덮어쓸 수 있음
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title"],
    code: ["class"],
  };

  for (const node of nodes) {
    if (!node.attrs || node.attrs.length === 0) continue;
    const tag = tiptapNodeToHtmlTag(node.type);
    if (!tag) continue;

    // 기존 목록과 병합 (중복 제거)
    const existing = attrMap[tag] ?? [];
    const merged = Array.from(new Set([...existing, ...node.attrs]));
    attrMap[tag] = merged;
  }

  // span(textStyle/color/fontSize) 에 style 허용 (tiptap 이 인라인 색상·폰트크기를 style 로 출력)
  const hasTextStyle = nodes.some(
    (n) => n.type === "textStyle" || n.type === "color",
  );
  if (hasTextStyle) {
    attrMap["span"] = ["style"];
  }

  // textAlign: tiptap 이 문단·제목 정렬을 style="text-align:..." 로 출력하므로
  // 해당 태그에 style 속성 + text-align 값(left/center/right/justify)만 허용한다.
  const hasTextAlign = nodes.some((n) => n.attrs?.includes("textAlign"));
  const allowedStyles: _sanitizeHtml.IOptions["allowedStyles"] = {};
  if (hasTextAlign) {
    for (const tag of ["p", "h2", "h3"]) {
      attrMap[tag] = Array.from(new Set([...(attrMap[tag] ?? []), "style"]));
      allowedStyles[tag] = { "text-align": [/^(left|center|right|justify)$/] };
    }
  }

  // fontSize: TextStyle 확장이 font-size 를 span style 로 출력한다.
  // 허용 크기: 10px ~ 40px (정수 픽셀값만 허용)
  if (hasTextStyle) {
    allowedStyles["span"] = {
      // 색상: #hex / rgb(...) / rgba(...)
      color: [/^(#[0-9a-fA-F]{3,8}|rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)|rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*[\d.]+\))$/],
      // 글자크기: 10px~40px 정수
      "font-size": [/^([1-3]\d|40)px$/],
    };
  }

  // youtube: 동영상은 iframe(+wrapper div) 으로 렌더된다.
  // src 호스트는 allowedIframeHostnames 로 youtube 도메인만 허용해 XSS 를 막는다.
  const hasYoutube = nodes.some((n) => n.type === "youtube");
  if (hasYoutube) {
    tagSet.add("iframe");
    tagSet.add("div");
    attrMap["iframe"] = [
      "src",
      "width",
      "height",
      "allow",
      "allowfullscreen",
      "frameborder",
      "referrerpolicy",
      "title",
    ];
    attrMap["div"] = Array.from(
      new Set([...(attrMap["div"] ?? []), "data-youtube-video"]),
    );
  }

  return {
    allowedTags: Array.from(tagSet),
    allowedAttributes: attrMap,
    ...((hasTextAlign || hasTextStyle) ? { allowedStyles } : {}),
    ...(hasYoutube
      ? {
          allowedIframeHostnames: [
            "www.youtube.com",
            "youtube.com",
            "www.youtube-nocookie.com",
          ],
        }
      : {}),
    // code 태그 내 class="language-xxx" 만 허용 (정규식)
    allowedClasses: {
      code: [CODE_CLASS_PATTERN],
    },
    // javascript: href 를 가진 링크 제거 (data:·vbscript: 도 차단)
    exclusiveFilter(frame) {
      if (frame.tag === "a") {
        const href = frame.attribs?.["href"] ?? "";
        const lower = href.toLowerCase().trim();
        return (
          lower.startsWith("javascript:") ||
          lower.startsWith("vbscript:") ||
          lower.startsWith("data:")
        );
      }
      // iframe: allowedIframeHostnames 가 youtube 외 src 를 제거하면 src 없는 빈
      // iframe 만 남는다. youtube src 가 없는 iframe 은 통째로 제거한다.
      if (frame.tag === "iframe") {
        const src = (frame.attribs?.["src"] ?? "").toLowerCase();
        const isYoutube =
          src.includes("youtube.com/") || src.includes("youtube-nocookie.com/");
        return !isYoutube;
      }
      return false;
    },
    // 허용되지 않은 태그를 내용까지 완전히 제거 (escape 아닌 제거)
    disallowedTagsMode: "discard",
    // 특수문자 출력 인코딩 유지 (기본값 false — 변경 금지)
    // false = &lt; 등이 그대로 출력되어 코드블록 내 특수문자 보존
  };
}

// ── sanitizeHtml wrapper ───────────────────────────────────────────────────────

/**
 * HTML 문자열을 FULL_ALLOWED_NODES 화이트리스트로 새니타이즈하여 반환한다.
 *
 * 이 함수가 서버 측 유일한 XSS 방어선(AR-8).
 */
export function sanitizeHtml(html: string): string {
  return _sanitizeHtml(html, buildSanitizeOptions(FULL_ALLOWED_NODES));
}

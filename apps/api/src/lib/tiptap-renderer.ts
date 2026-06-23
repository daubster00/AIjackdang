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
import type { JSONContent } from "@tiptap/core";
import { sanitizeHtml } from "./sanitize.js";

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

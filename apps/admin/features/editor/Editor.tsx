"use client";

import type { JSONContent } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { TextAlign } from "@tiptap/extension-text-align";
import { Youtube } from "@tiptap/extension-youtube";
import { EditorToolbar } from "./EditorToolbar";
import { FontSize } from "./extensions/FontSize";
import styles from "./Editor.module.css";

type EditorPreset = "full" | "lite";

export type EditorProps = {
  /** 에디터 preset. full=풀 에디터, lite=경량 에디터 */
  preset: EditorPreset;
  /** 초기 Tiptap JSON 콘텐츠 */
  value?: JSONContent;
  /** 내용이 바뀔 때 Tiptap JSON으로 콜백 */
  onChange?: (json: JSONContent) => void;
  /** 빈 상태 안내 문구 */
  placeholder?: string;
};

/**
 * preset에 따라 로드할 Tiptap 익스텐션 목록을 반환한다.
 *
 * full: StarterKit(H2·H3, list, blockquote, codeBlock, link 포함)
 *       + Image, Color, TextStyle, Highlight(multicolor), FontSize, TextAlign, Youtube
 *
 * lite: StarterKit(heading·bold·italic·strike·underline·horizontalRule 비활성)
 *       + Image
 */
function buildExtensions(preset: EditorPreset) {
  if (preset === "full") {
    return [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer",
          },
        },
        codeBlock: {},
      }),
      Image.configure({
        HTMLAttributes: { class: "editor-image" },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        HTMLAttributes: { class: "editor-youtube" },
      }),
    ];
  }

  // lite preset
  return [
    StarterKit.configure({
      heading: false,
      bold: false,
      italic: false,
      strike: false,
      horizontalRule: false,
      blockquote: false,
      link: {
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      },
      codeBlock: {},
    }),
    Image.configure({
      HTMLAttributes: { class: "editor-image" },
    }),
  ];
}

/**
 * 어드민 Tiptap 에디터 컴포넌트.
 *
 * - `preset="full"`: 게시글 본문 작성용. H2/H3, 목록, 링크, 이미지, 코드블록,
 *   인용, 제한 색상·형광펜, 폰트 크기, 정렬, YouTube 지원.
 * - `preset="lite"`: 짧은 입력용. 링크·이미지·코드블록만 지원.
 *
 * @see apps/admin/features/editor/EditorToolbar.tsx — 툴바 UI
 * @see apps/admin/features/editor/helpers.ts — textToTiptapJson / tiptapJsonToText
 */
export function Editor({
  preset,
  value,
  onChange,
  placeholder = "내용을 입력하세요.",
}: EditorProps) {
  const editor = useEditor(
    {
      extensions: buildExtensions(preset),
      content: value,
      onUpdate: ({ editor: ed }) => {
        onChange?.(ed.getJSON());
      },
      editorProps: {
        attributes: {
          "data-placeholder": placeholder,
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": placeholder,
        },
      },
      // Next.js SSR hydration 불일치 방지
      immediatelyRender: false,
    },
    [],
  );

  return (
    <div className={styles.editorContainer}>
      <EditorToolbar editor={editor} preset={preset} />
      <div className={styles.editorContent}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

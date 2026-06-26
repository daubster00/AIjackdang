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

type EditorProps = {
  /** 에디터 preset. full=글쓰기 풀 에디터, lite=답변·댓글 경량 에디터 */
  preset: EditorPreset;
  /** 초기 Tiptap JSON 콘텐츠 */
  value?: JSONContent;
  /** 내용이 바뀔 때 Tiptap JSON 으로 콜백 */
  onChange?: (json: JSONContent) => void;
  /** 빈 상태 안내 문구 */
  placeholder?: string;
};

/**
 * preset에 따라 로드할 Tiptap 익스텐션 목록을 반환한다.
 *
 * full 익스텐션:
 *   StarterKit(heading H2·H3, bullet/ordered list, blockquote, codeBlock, link 포함)
 *   + Image, Color, TextStyle, Highlight(multicolor)
 *
 * lite 익스텐션:
 *   StarterKit(heading·bold·italic·strike·underline·horizontalRule 비활성)
 *   + Image
 *   — Color/TextStyle/Highlight 제외
 *
 * lowlight 코드 하이라이팅: Story 2.6에서 추가 예정. 현재는 CodeBlock 기본 스타일만.
 */
function buildExtensions(preset: EditorPreset) {
  if (preset === "full") {
    return [
      StarterKit.configure({
        // Heading: H2, H3만 허용 (FULL_ALLOWED_NODES 정책)
        heading: { levels: [2, 3] },
        // StarterKit v3에는 Link가 이미 포함됨
        link: {
          openOnClick: false,
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer",
          },
        },
        // 코드블록: lowlight는 2.6에서 추가
        codeBlock: {},
        // 기타 StarterKit 기본값 유지 (bold, italic, bulletList, orderedList, blockquote 등)
      }),
      // 이미지: alt 필수 강제는 EditorToolbar 레벨에서 처리
      Image.configure({
        HTMLAttributes: {
          class: "editor-image",
        },
      }),
      // 색상 관련 (제한 팔레트 — EditorToolbar 에서 노출 제어)
      TextStyle,
      Color,
      // Highlight: 형광펜 버튼은 제거됐으나(요청), 기존에 저장된 형광펜 콘텐츠를
      // 그대로 렌더하기 위해 확장 자체는 유지한다.
      Highlight.configure({ multicolor: true }),
      // 폰트 크기 — TextStyle 을 확장해 font-size 인라인 스타일 적용
      FontSize,
      // 좌/가운데/우 정렬 — 문단·제목에 text-align 속성 부여
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      // 동영상 삽입 (YouTube)
      Youtube.configure({
        controls: true,
        nocookie: true,
        HTMLAttributes: { class: "editor-youtube" },
      }),
    ];
  }

  // lite preset — 가볍게: 제목·굵게·기울임·취소선·밑줄·수평선 비활성
  return [
    StarterKit.configure({
      heading: false,
      bold: false,
      italic: false,
      strike: false,
      underline: false,
      horizontalRule: false,
      blockquote: false,
      // Link는 lite에서도 허용
      link: {
        openOnClick: false,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      },
      // 코드블록 허용
      codeBlock: {},
    }),
    // 이미지 허용 (alt 강제는 EditorToolbar 에서)
    Image.configure({
      HTMLAttributes: {
        class: "editor-image",
      },
    }),
  ];
}

/**
 * 공용 Tiptap 에디터 컴포넌트.
 *
 * - `preset="full"`: 게시글 본문 작성용. 풀 서식(H2/H3, 목록, 링크, 이미지,
 *   코드블록, 인용, 제한 색상·형광펜) 지원.
 * - `preset="lite"`: 답변·댓글 등 짧은 입력용. 링크·이미지·코드블록만 지원.
 *
 * 허용 노드 화이트리스트는 packages/contracts/src/editor.ts 의
 * FULL_ALLOWED_NODES / LITE_ALLOWED_NODES 를 단일 소스로 공유한다.
 *
 * @see apps/web/features/editor/EditorToolbar.tsx — 툴바 UI
 * @see packages/contracts/src/editor.ts — 서버·클라이언트 공유 화이트리스트
 */
export function Editor({ preset, value, onChange, placeholder = "내용을 입력하세요." }: EditorProps) {
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
      // Next.js 환경에서 hydration 불일치 방지를 위해 클라이언트에서만 즉시 렌더
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

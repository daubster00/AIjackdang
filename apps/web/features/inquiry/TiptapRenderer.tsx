"use client";

/**
 * Tiptap JSON → 안전 HTML 렌더러 (Story 7.5).
 *
 * useEditor(editable:false)를 사용해 Tiptap 자체 직렬화로 렌더링.
 * 외부 HTML 없이 Tiptap JSON → ProseMirror DOM이므로 XSS 위험 없음.
 * (Tiptap은 content 를 HTML 문자열이 아닌 ProseMirror 노드로 처리한다)
 */

import type { JSONContent } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";

interface TiptapRendererProps {
  content: unknown;
  className?: string;
}

export function TiptapRenderer({ content, className }: TiptapRendererProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image,
    ],
    content: content as JSONContent,
    editable: false,
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * FontSize Tiptap 확장 — TextStyle을 기반으로 인라인 font-size를 적용한다.
 *
 * 사용법:
 *   editor.chain().focus().setFontSize("18px").run()
 *   editor.chain().focus().unsetFontSize().run()
 *
 * 렌더: <span style="font-size: 18px;">텍스트</span>
 */

import { Extension } from "@tiptap/core";
import type { CommandProps, RawCommands } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      /** 선택 텍스트에 폰트 크기를 적용한다 (예: "18px") */
      setFontSize: (fontSize: string) => ReturnType;
      /** 선택 텍스트의 폰트 크기를 해제한다 */
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: Element) =>
              (element as HTMLElement).style.fontSize?.replace(/['"]+/g, "") || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes["fontSize"]) return {};
              return { style: `font-size: ${attributes["fontSize"]}` };
            },
          },
        },
      },
    ];
  },

  addCommands(): Partial<RawCommands> {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: CommandProps) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }: CommandProps) =>
          chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

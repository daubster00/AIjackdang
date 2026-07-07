/**
 * Caption Tiptap 확장 — 이미지 설명·인용 출처 같은 "캡션" 문단을 위한 시맨틱 노드.
 *
 * 렌더: <p class="caption">텍스트</p>
 *   - 검색엔진에 "본문보다 낮은 비중의 부가 설명"임을 알리는 의미 있는 마크업.
 *   - 인라인 font-size 스팬(옛 방식)과 달리, 문단 단위 시맨틱을 유지한다.
 *
 * 사용법:
 *   editor.chain().focus().setCaption().run()   // 현재 블록을 캡션으로
 *   editor.chain().focus().setParagraph().run() // 다시 본문으로
 *
 * 새니타이즈: apps/api sanitize.ts 가 p 태그에 class="caption" 을 허용한다.
 * (웹 에디터 apps/web/features/editor/extensions/Caption.ts 와 동일)
 */

import { Node, mergeAttributes } from "@tiptap/core";
import type { RawCommands, CommandProps } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    caption: {
      /** 현재 블록을 캡션(<p class="caption">) 으로 변환한다 */
      setCaption: () => ReturnType;
    };
  }
}

export const Caption = Node.create({
  name: "caption",
  group: "block",
  content: "inline*",
  // ⚠️ 확장(Node) 레벨 priority 금지 — caption 이 문서 기본 블록이 되어 빈 에디터가
  //    caption 으로 채워지고 TrailingNode 와 충돌해 클릭 즉시 페이지가 멈춘다.
  //    파스 우선순위는 아래 규칙(rule) 레벨 priority 로만 준다.

  parseHTML() {
    return [
      { tag: "p.caption", priority: 60 },
      { tag: "figcaption", priority: 60 },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { class: "caption" }), 0];
  },

  addCommands(): Partial<RawCommands> {
    return {
      setCaption:
        () =>
        ({ commands }: CommandProps) =>
          commands.setNode(this.name),
    };
  },
});

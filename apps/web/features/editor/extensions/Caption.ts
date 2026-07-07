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
 * 새니타이즈: sanitize.ts 가 p 태그에 class="caption" 을 허용한다(allowedClasses).
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
  // ⚠️ 확장(Node) 레벨 priority 는 절대 올리지 말 것.
  //    priority 를 높이면 스키마 노드 순서가 바뀌어 caption 이 문서 "기본 블록"이 되고,
  //    빈 에디터가 caption 으로 채워진다. 그러면 TrailingNode(빈 문단 유지 플러그인)가
  //    끝없이 문단을 덧붙이려다 메인스레드가 멈춘다(클릭 즉시 페이지 프리즈).
  //    parseHTML 우선순위는 "노드"가 아니라 "파스 규칙(rule)" 레벨 priority 로만 준다.

  parseHTML() {
    // 저장된 HTML 을 다시 편집기로 불러올 때(<p class="caption"> / <figcaption>) 캡션으로 복원.
    // 규칙 priority 60(기본 50 보다 높게) 으로 paragraph 의 `p` 규칙보다 먼저 매칭시킨다.
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

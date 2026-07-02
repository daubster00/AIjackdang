/**
 * TrailingNode Tiptap 확장 — 문서 맨 끝에 항상 빈 문단(paragraph)을 유지한다.
 *
 * 왜 필요한가:
 *   이미지·동영상·코드블록처럼 텍스트를 넣을 수 없는 블록 노드가 문서의
 *   마지막에 오면, 그 아래에는 커서를 놓을 자리가 없어 "이미지 밑에 글을 못 쓰는"
 *   문제가 생긴다. 이 확장은 마지막 노드가 문단이 아닐 때 자동으로 빈 문단을
 *   덧붙여, 이미지 바로 아래 빈 공간을 클릭하면 커서가 그 문단에 놓이게 한다.
 */

import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

type TrailingNodeOptions = {
  /** 문서 끝에 유지할 노드 타입 이름 */
  node: string;
  /** 이 타입들이 마지막이면 빈 문단을 추가하지 않는다(이미 텍스트 입력 가능) */
  notAfter: string[];
};

/** 노드가 주어진 타입 목록 중 하나인지 판별한다. */
function nodeEqualsType(node: ProseMirrorNode | null, types: string[]): boolean {
  return node != null && types.includes(node.type.name);
}

export const TrailingNode = Extension.create<TrailingNodeOptions>({
  name: "trailingNode",

  addOptions() {
    return {
      node: "paragraph",
      notAfter: ["paragraph"],
    };
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey(this.name);
    const nodeName = this.options.node;
    const notAfter = this.options.notAfter;

    return [
      new Plugin<boolean>({
        key: pluginKey,
        appendTransaction: (_transactions, _oldState, state) => {
          const shouldInsert = pluginKey.getState(state);
          if (!shouldInsert) return null;

          const endPosition = state.doc.content.size;
          const type = state.schema.nodes[nodeName];
          if (!type) return null;

          return state.tr.insert(endPosition, type.create());
        },
        state: {
          init: (_config, state) =>
            !nodeEqualsType(state.doc.lastChild, notAfter),
          apply: (tr, value) => {
            if (!tr.docChanged) return value;
            return !nodeEqualsType(tr.doc.lastChild, notAfter);
          },
        },
      }),
    ];
  },
});

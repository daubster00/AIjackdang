/**
 * tiptap 삽입 헬퍼 단위 테스트 — 이미지·유튜브 노드 prepend.
 * 순수 함수만 검증(외부 의존 없음).
 */

import { describe, it, expect } from "vitest";
import {
  prependImageToTiptapDoc,
  prependYoutubeToTiptapDoc,
  insertInlineImagesByMarker,
  type GuideAssetManifest,
} from "./tiptap.js";

const baseDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "본문" }] }],
};

describe("prependImageToTiptapDoc", () => {
  it("이미지 노드를 맨 앞에 삽입한다", () => {
    const out = prependImageToTiptapDoc(baseDoc, "https://x/y.png", "alt텍스트");
    const content = out.content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({
      type: "image",
      attrs: { src: "https://x/y.png", alt: "alt텍스트", title: null },
    });
    // 기존 본문은 뒤에 유지
    expect(content[1]).toEqual(baseDoc.content[0]);
  });
});

describe("prependYoutubeToTiptapDoc", () => {
  it("youtube 노드를 맨 앞에 삽입한다(src=watch URL)", () => {
    const url = "https://www.youtube.com/watch?v=abc123";
    const out = prependYoutubeToTiptapDoc(baseDoc, url);
    const content = out.content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({ type: "youtube", attrs: { src: url, start: 0 } });
  });

  it("채널·출처URL이 있으면 출처 캡션 문단을 붙인다", () => {
    const url = "https://www.youtube.com/watch?v=abc123";
    const out = prependYoutubeToTiptapDoc(baseDoc, url, {
      channel: "OpenAI",
      sourceUrl: url,
    });
    const content = out.content as Array<Record<string, unknown>>;
    expect(content[0]).toMatchObject({ type: "youtube" });
    const caption = content[1] as {
      type: string;
      content: Array<{ text: string }>;
    };
    expect(caption.type).toBe("paragraph");
    expect(caption.content[0]!.text).toContain("영상 출처:");
    expect(caption.content[0]!.text).toContain("OpenAI");
    // 본문은 캡션 뒤에 유지
    expect(content[2]).toEqual(baseDoc.content[0]);
  });

  it("출처 정보가 없으면 캡션 없이 영상 노드만 삽입한다", () => {
    const url = "https://youtu.be/abc123";
    const out = prependYoutubeToTiptapDoc(baseDoc, url);
    const content = out.content as Array<Record<string, unknown>>;
    expect(content).toHaveLength(2); // youtube + 기존 본문
    expect(content[1]).toEqual(baseDoc.content[0]);
  });
});

describe("insertInlineImagesByMarker", () => {
  const manifest: GuideAssetManifest = {
    "make-first-scenario": {
      url: "https://cdn/x/first.png",
      caption: "Make 첫 시나리오 화면",
      alt: "Make 시나리오 편집기",
      sourceLabel: "Make 공식 도움말",
      sourceUrl: "https://help.make.com/create-your-first-scenario",
    },
    "vibe-concept": { url: "https://cdn/x/concept.png", caption: "개념 도식" },
  };

  const docWithMarkers = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "설명 문단 1" }] },
      { type: "paragraph", content: [{ type: "text", text: "[[IMG:make-first-scenario]]" }] },
      { type: "paragraph", content: [{ type: "text", text: "설명 문단 2" }] },
    ],
  };

  it("단독 마커 문단을 이미지 노드+캡션으로 치환한다", () => {
    const { doc, usedKeys } = insertInlineImagesByMarker(docWithMarkers, manifest);
    const content = doc.content as Array<Record<string, unknown>>;
    // 문단1, 이미지, 캡션, 문단2
    expect(content[0]).toMatchObject({ type: "paragraph" });
    expect(content[1]).toMatchObject({
      type: "image",
      attrs: { src: "https://cdn/x/first.png" },
    });
    const caption = content[2] as { type: string; content: Array<{ text: string }> };
    expect(caption.type).toBe("paragraph");
    expect(caption.content[0]!.text).toContain("Make 첫 시나리오 화면");
    expect(caption.content[0]!.text).toContain("출처: Make 공식 도움말");
    expect(content[3]).toMatchObject({ type: "paragraph" });
    expect(usedKeys).toEqual(["make-first-scenario"]);
  });

  it("manifest에 없는 키의 마커 문단은 제거한다(원시 마커 노출 방지)", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "[[IMG:missing-key]]" }] },
        { type: "paragraph", content: [{ type: "text", text: "본문" }] },
      ],
    };
    const { doc: out, usedKeys } = insertInlineImagesByMarker(doc, manifest);
    const content = out.content as Array<Record<string, unknown>>;
    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ type: "paragraph" });
    expect(usedKeys).toEqual([]);
  });

  it("문단 끝에 붙은 마커도 앞 텍스트를 보존하고 이미지를 삽입한다", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "설명입니다. [[IMG:vibe-concept]]" }] },
      ],
    };
    const { doc: out, usedKeys } = insertInlineImagesByMarker(doc, manifest);
    const content = out.content as Array<Record<string, unknown>>;
    // 앞 텍스트 문단 → 이미지 → 캡션
    expect(content[0]).toMatchObject({ type: "paragraph" });
    expect((content[0] as any).content[0].text).toBe("설명입니다.");
    expect(content[1]).toMatchObject({ type: "image" });
    expect(usedKeys).toEqual(["vibe-concept"]);
  });

  it("문단 중간 마커는 앞·뒤 텍스트로 분할하고 사이에 이미지를 넣는다", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "앞 [[IMG:vibe-concept]] 뒤" }] },
      ],
    };
    const { doc: out } = insertInlineImagesByMarker(doc, manifest);
    const content = out.content as Array<Record<string, unknown>>;
    expect((content[0] as any).content[0].text).toBe("앞");
    expect(content[1]).toMatchObject({ type: "image" });
    // 마지막 노드는 "뒤" 문단
    const last = content[content.length - 1] as any;
    expect(last.content[0].text).toBe("뒤");
    // 어떤 노드에도 원시 마커가 남지 않음
    expect(JSON.stringify(out)).not.toContain("[[IMG:");
  });

  it("같은 assetKey 마커가 여러 번 나와도 이미지는 한 번만 삽입한다", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "[[IMG:vibe-concept]]" }] },
        { type: "paragraph", content: [{ type: "text", text: "중간" }] },
        { type: "paragraph", content: [{ type: "text", text: "[[IMG:vibe-concept]]" }] },
      ],
    };
    const { doc: out, usedKeys } = insertInlineImagesByMarker(doc, manifest);
    const content = out.content as Array<Record<string, unknown>>;
    const imgs = content.filter((n) => (n as any).type === "image");
    expect(imgs).toHaveLength(1);
    expect(usedKeys).toEqual(["vibe-concept"]);
  });

  it("캡션만 있고 출처가 없으면 캡션에 출처 문구를 넣지 않는다", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "[[IMG:vibe-concept]]" }] },
      ],
    };
    const { doc: out } = insertInlineImagesByMarker(doc, manifest);
    const content = out.content as Array<Record<string, unknown>>;
    expect(content[0]).toMatchObject({ type: "image" });
    const caption = content[1] as { content: Array<{ text: string }> };
    expect(caption.content[0]!.text).toBe("개념 도식");
  });
});

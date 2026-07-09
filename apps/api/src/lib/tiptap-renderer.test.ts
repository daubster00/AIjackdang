/**
 * tiptapJsonToHtml 봇 콘텐츠 구조 정규화 단위 테스트.
 *
 * 정규화는 "이미지 뒤 본문 복제 문단" 하나만 제거한다.
 *  - 이미지 바로 뒤의 중복 문단(직전 문단 꼬리·alt 복제) → 제거
 *  - 빈 문단(빈 줄)은 어떤 위치에서도 보존(사용자의 의도된 간격 장치)
 *  - 사람 작성 글의 정상 캡션은 보존
 */

import { describe, expect, it } from "vitest";
import { tiptapJsonToHtml } from "./tiptap-renderer.js";

function p(text = ""): Record<string, unknown> {
  return text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };
}
function h(level: number, text: string): Record<string, unknown> {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}
function img(src: string, alt: string): Record<string, unknown> {
  return { type: "image", attrs: { src, alt } };
}
function doc(content: Record<string, unknown>[]): Record<string, unknown> {
  return { type: "doc", content };
}

describe("tiptapJsonToHtml — 봇 콘텐츠 구조 정규화", () => {
  it("이미지 뒤에 붙은 alt 복제 문단을 제거한다", () => {
    const dupText = "검증 강도를 다르게 지정해야 할 때 바로 복사해 사용할 수 있습니다.";
    const html = tiptapJsonToHtml(
      doc([
        p(`같은 업무라도 모델 등급에 따라 ${dupText}`),
        img("https://cdn.example.com/a.jpg", dupText),
        p(dupText),
        p("이어지는 내용."),
      ]),
    );
    // 이미지는 유지, 단독 중복 문단(<p>dupText</p>)은 제거됨
    expect(html).toContain("<img");
    expect(html).not.toContain(`<p>${dupText}</p>`);
    // 본문 꼬리(정상 문단)와 이어지는 내용은 보존
    expect(html).toContain("이어지는 내용.");
  });

  it("이미지 뒤 문단이 alt·직전 문단과 다르면 보존한다(정상 캡션)", () => {
    const html = tiptapJsonToHtml(
      doc([
        p("이 그림은 3단계 구조를 보여줍니다."),
        img("https://cdn.example.com/b.jpg", "3단계 구조 다이어그램"),
        p("출처: 내부 자료"),
      ]),
    );
    expect(html).toContain("출처: 내부 자료");
  });

  it("소제목 뒤/앞의 빈 줄을 절대 제거하지 않는다(의도된 간격 보존)", () => {
    const html = tiptapJsonToHtml(
      doc([p("앞 문단"), p(""), h(2, "다음 절"), p(""), p("본문")]),
    );
    // 헤딩 앞·뒤 빈 문단이 그대로 남는다
    expect(html).toContain("<p></p><h2>다음 절</h2>");
    expect(html).toContain("<h2>다음 절</h2><p></p>");
  });

  it("문단 사이 일반 빈 줄과 연속 빈 줄을 모두 보존한다", () => {
    const html = tiptapJsonToHtml(doc([p("첫 문단"), p(""), p(""), p("둘째 문단")]));
    // 연속 빈 줄도 축약하지 않고 2개 그대로
    expect((html.match(/<p><\/p>/g) ?? []).length).toBe(2);
  });

  it("잘못된 입력은 빈 문자열을 반환한다", () => {
    expect(tiptapJsonToHtml(null)).toBe("");
    expect(tiptapJsonToHtml("문자열")).toBe("");
  });
});

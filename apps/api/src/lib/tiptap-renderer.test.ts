/**
 * tiptapJsonToHtml 봇 콘텐츠 구조 정규화 단위 테스트.
 *
 * 실제 사고글("GPT-5.6 3단계 모델별 프롬프트 설계법")의 저장 구조를 재현한다:
 *  - 소제목(heading) 바로 뒤/앞의 빈 문단 → 제거
 *  - 이미지 바로 뒤의 중복 문단(직전 문단 꼬리·alt 복제) → 제거
 *  - 사람 작성 글의 정상 캡션/빈 줄은 보존
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
  it("소제목 바로 뒤의 빈 문단을 제거한다", () => {
    const html = tiptapJsonToHtml(doc([h(2, "도입"), p(""), p("본문입니다.")]));
    expect(html).not.toContain("<p></p>");
    expect(html).toContain("<h2>도입</h2>");
    expect(html).toContain("본문입니다.");
    // 헤딩 바로 뒤에 본문이 오도록 빈 문단이 사라짐
    expect(html.indexOf("도입")).toBeLessThan(html.indexOf("본문입니다."));
  });

  it("소제목 바로 앞의 빈 문단도 제거한다", () => {
    const html = tiptapJsonToHtml(doc([p("앞 문단"), p(""), h(2, "다음 절")]));
    expect(html).not.toContain("<p></p>");
    expect(html).toContain("<h2>다음 절</h2>");
  });

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

  it("헤딩과 무관한 일반 빈 줄(문단 사이)은 보존한다", () => {
    const html = tiptapJsonToHtml(doc([p("첫 문단"), p(""), p("둘째 문단")]));
    expect(html).toContain("<p></p>");
  });

  it("잘못된 입력은 빈 문자열을 반환한다", () => {
    expect(tiptapJsonToHtml(null)).toBe("");
    expect(tiptapJsonToHtml("문자열")).toBe("");
  });
});

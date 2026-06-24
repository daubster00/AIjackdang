/**
 * qna.ts 단위 테스트 — Story 3.9 AC #4
 *
 * buildQAPageJsonLd 의 세 가지 분기를 검증한다:
 *   1. 답변 0개 → acceptedAnswer·suggestedAnswer 키 없음
 *   2. helpfulAnswerId 있음 → acceptedAnswer 포함
 *   3. 일반 답변만 → suggestedAnswer 배열 포함
 *   4. JSON 직렬화 유효성
 *   5. stripHtml 태그 제거
 */

import { describe, it, expect } from "vitest";
import { buildQAPageJsonLd, stripHtml } from "./qna";
import type { QAPageInput, AnswerInput } from "./qna";

// ── 픽스처 ────────────────────────────────────────────────────────────────────

const mockQuestion: QAPageInput = {
  title: "Claude Code에서 worktree를 어떻게 쓰나요?",
  text: "Claude Code에서 병렬 개발을 위해 worktree를 활용하는 방법이 궁금합니다.",
  dateCreated: "2026-06-18T10:00:00Z",
  author: { name: "작당입문러" },
  helpfulAnswerId: null,
};

const answer1: AnswerInput = {
  id: "a1",
  text: "git worktree add 명령어로 새 브랜치 디렉터리를 만들 수 있습니다.",
  dateCreated: "2026-06-18T11:00:00Z",
  author: { name: "리뷰메이트" },
};

const answer2: AnswerInput = {
  id: "a2",
  text: "각 worktree는 독립된 작업 환경을 가집니다.",
  dateCreated: "2026-06-18T12:00:00Z",
  author: { name: "프론트라인" },
};

// ── buildQAPageJsonLd: 답변 0개 ───────────────────────────────────────────────

describe("buildQAPageJsonLd — 답변 0개", () => {
  const result = buildQAPageJsonLd(mockQuestion, []);

  it("@context가 'https://schema.org'이다", () => {
    expect(result["@context"]).toBe("https://schema.org");
  });

  it("@type이 'QAPage'이다", () => {
    expect(result["@type"]).toBe("QAPage");
  });

  it("mainEntity.@type이 'Question'이다", () => {
    expect((result.mainEntity as Record<string, unknown>)["@type"]).toBe("Question");
  });

  it("mainEntity.answerCount가 0이다", () => {
    expect((result.mainEntity as Record<string, unknown>).answerCount).toBe(0);
  });

  it("mainEntity.name이 질문 제목과 일치한다", () => {
    expect((result.mainEntity as Record<string, unknown>).name).toBe(mockQuestion.title);
  });

  it("mainEntity.text가 질문 본문 요약과 일치한다", () => {
    expect((result.mainEntity as Record<string, unknown>).text).toBe(mockQuestion.text);
  });

  it("mainEntity에 acceptedAnswer 키가 없다", () => {
    expect(result.mainEntity).not.toHaveProperty("acceptedAnswer");
  });

  it("mainEntity에 suggestedAnswer 키가 없다", () => {
    expect(result.mainEntity).not.toHaveProperty("suggestedAnswer");
  });

  it("JSON 직렬화·역직렬화 후에도 동일하다", () => {
    const parsed = JSON.parse(JSON.stringify(result)) as typeof result;
    expect(parsed["@type"]).toBe("QAPage");
    expect(parsed.mainEntity).not.toHaveProperty("acceptedAnswer");
  });
});

// ── buildQAPageJsonLd: helpfulAnswerId 있음 ───────────────────────────────────

describe("buildQAPageJsonLd — helpfulAnswerId 있음", () => {
  const questionWithHelpful: QAPageInput = { ...mockQuestion, helpfulAnswerId: "a1" };
  const result = buildQAPageJsonLd(questionWithHelpful, [answer1, answer2]);
  const entity = result.mainEntity as Record<string, unknown>;

  it("answerCount가 총 답변 수(2)와 일치한다", () => {
    expect(entity.answerCount).toBe(2);
  });

  it("acceptedAnswer가 포함된다", () => {
    expect(entity).toHaveProperty("acceptedAnswer");
  });

  it("acceptedAnswer.@type이 'Answer'이다", () => {
    const accepted = entity.acceptedAnswer as Record<string, unknown>;
    expect(accepted["@type"]).toBe("Answer");
  });

  it("acceptedAnswer.text가 a1 답변 텍스트와 일치한다", () => {
    const accepted = entity.acceptedAnswer as Record<string, unknown>;
    expect(accepted.text).toBe(answer1.text);
  });

  it("acceptedAnswer.author.name이 a1 작성자와 일치한다", () => {
    const accepted = entity.acceptedAnswer as Record<string, unknown>;
    const author = accepted.author as Record<string, unknown>;
    expect(author.name).toBe(answer1.author.name);
  });

  it("suggestedAnswer 배열에 a1이 포함되지 않는다 (acceptedAnswer로 빠짐)", () => {
    const suggested = entity.suggestedAnswer as Array<Record<string, unknown>>;
    expect(Array.isArray(suggested)).toBe(true);
    expect(suggested.some((s) => s.text === answer1.text)).toBe(false);
  });

  it("suggestedAnswer 배열에 a2가 포함된다", () => {
    const suggested = entity.suggestedAnswer as Array<Record<string, unknown>>;
    expect(suggested.some((s) => s.text === answer2.text)).toBe(true);
  });
});

// ── buildQAPageJsonLd: 일반 답변만 (helpfulAnswerId=null) ─────────────────────

describe("buildQAPageJsonLd — 일반 답변만", () => {
  const result = buildQAPageJsonLd(mockQuestion, [answer1, answer2]);
  const entity = result.mainEntity as Record<string, unknown>;

  it("acceptedAnswer 키가 없다 (helpfulAnswerId=null)", () => {
    expect(entity).not.toHaveProperty("acceptedAnswer");
  });

  it("suggestedAnswer 배열에 모든 답변이 포함된다", () => {
    const suggested = entity.suggestedAnswer as Array<Record<string, unknown>>;
    expect(Array.isArray(suggested)).toBe(true);
    expect(suggested).toHaveLength(2);
  });

  it("suggestedAnswer 항목의 @type이 'Answer'이다", () => {
    const suggested = entity.suggestedAnswer as Array<Record<string, unknown>>;
    expect(suggested[0]["@type"]).toBe("Answer");
    expect(suggested[1]["@type"]).toBe("Answer");
  });

  it("JSON 직렬화 후 suggestedAnswer 길이가 유지된다", () => {
    const parsed = JSON.parse(JSON.stringify(result)) as typeof result;
    const parsedEntity = parsed.mainEntity as Record<string, unknown>;
    const suggested = parsedEntity.suggestedAnswer as unknown[];
    expect(suggested).toHaveLength(2);
  });
});

// ── buildQAPageJsonLd: helpfulAnswerId가 있지만 답변 1개뿐 (나머지 suggestedAnswer 없음) ──

describe("buildQAPageJsonLd — helpfulAnswerId 있고 다른 답변 없음", () => {
  const questionWithHelpful: QAPageInput = { ...mockQuestion, helpfulAnswerId: "a1" };
  const result = buildQAPageJsonLd(questionWithHelpful, [answer1]);
  const entity = result.mainEntity as Record<string, unknown>;

  it("acceptedAnswer가 포함된다", () => {
    expect(entity).toHaveProperty("acceptedAnswer");
  });

  it("suggestedAnswer 키가 없다 (나머지 답변 없음)", () => {
    expect(entity).not.toHaveProperty("suggestedAnswer");
  });
});

// ── stripHtml ─────────────────────────────────────────────────────────────────

describe("stripHtml", () => {
  it("HTML 태그를 제거한다", () => {
    expect(stripHtml("<p>안녕하세요</p>")).toBe("안녕하세요");
  });

  it("중첩 태그도 제거한다", () => {
    expect(stripHtml("<p><strong>굵은</strong> 텍스트</p>")).toBe("굵은 텍스트");
  });

  it("150자를 초과하는 텍스트는 150자로 자른다", () => {
    const html = `<p>${"가".repeat(200)}</p>`;
    const result = stripHtml(html);
    expect(result.length).toBe(150);
  });

  it("빈 문자열은 빈 문자열을 반환한다", () => {
    expect(stripHtml("")).toBe("");
  });

  it("maxLen 파라미터가 적용된다", () => {
    const result = stripHtml("<p>짧은 텍스트</p>", 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

import { describe, expect, it } from "vitest";
import { deriveQuestionStatus } from "./qna";

describe("deriveQuestionStatus", () => {
  it("답변이 없으면 답변대기", () => {
    expect(deriveQuestionStatus({ answerCount: 0, acceptedAnswerId: null })).toBe("waiting");
  });

  it("답변이 있으면 답변있음", () => {
    expect(deriveQuestionStatus({ answerCount: 3, acceptedAnswerId: null })).toBe("answered");
  });

  it("채택된 답변이 있으면 해결됨", () => {
    expect(deriveQuestionStatus({ answerCount: 3, acceptedAnswerId: "a1" })).toBe("resolved");
  });
});

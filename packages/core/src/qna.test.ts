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

  it("삭제된 답변을 제외하면 answerCount=0 → 답변대기", () => {
    // 호출자가 삭제(deleted/hidden) 답변을 제외한 뒤 answerCount=0으로 전달한 경우.
    // 원래 답변이 있었더라도 공개 답변이 없으면 'waiting' 이어야 한다.
    expect(deriveQuestionStatus({ answerCount: 0, acceptedAnswerId: null })).toBe("waiting");
  });
});

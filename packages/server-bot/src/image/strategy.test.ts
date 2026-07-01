/**
 * decideImageStrategy 단위 테스트 (Story 11.8 Task 4.4).
 *
 * 외부 API·DB 의존 없이 순수 함수만 검증한다.
 */

import { describe, it, expect } from "vitest";
import { decideImageStrategy } from "./strategy.js";
import type { PersonaContext, PostKind } from "./strategy.js";

// ── 기본 픽스처 ───────────────────────────────────────────────────────────────

const BASE_PERSONA: PersonaContext = {
  nickname: "testuser",
  is_admin_persona: false,
  info_ratio: 50,
};

function p(overrides: Partial<PersonaContext>): PersonaContext {
  return { ...BASE_PERSONA, ...overrides };
}

// ── 규칙 1: ai-creation 게시판 ────────────────────────────────────────────────

describe("규칙 1: board === 'ai-creation'", () => {
  it("ai-creation → 'ai' (postKind=post)", () => {
    expect(decideImageStrategy(BASE_PERSONA, "ai-creation", "post")).toBe("ai");
  });

  it("ai-creation → 'ai' (info_ratio=0, 잡담형이어도 무조건 ai)", () => {
    expect(decideImageStrategy(p({ info_ratio: 0 }), "ai-creation", "post")).toBe("ai");
  });

  it("ai-creation → 'ai' (postKind=qna 이어도 무조건 ai)", () => {
    expect(decideImageStrategy(BASE_PERSONA, "ai-creation", "qna")).toBe("ai");
  });
});

// ── 규칙 2: is_admin_persona ──────────────────────────────────────────────────

describe("규칙 2: is_admin_persona === true", () => {
  it("is_admin_persona=true → 'ai'", () => {
    expect(
      decideImageStrategy(p({ is_admin_persona: true }), "general", "post"),
    ).toBe("ai");
  });

  it("is_admin_persona=true, info_ratio=5 → 'ai' (규칙 4보다 우선)", () => {
    expect(
      decideImageStrategy(
        p({ is_admin_persona: true, info_ratio: 5 }),
        "talk",
        "post",
      ),
    ).toBe("ai");
  });
});

// ── 규칙 3: postKind ──────────────────────────────────────────────────────────

describe("규칙 3: postKind가 qna·comment·reply", () => {
  const highInfoPers = p({ info_ratio: 80 });

  it("postKind=qna → 'none'", () => {
    expect(decideImageStrategy(highInfoPers, "general", "qna")).toBe("none");
  });

  it("postKind=comment → 'none'", () => {
    expect(decideImageStrategy(highInfoPers, "general", "comment")).toBe("none");
  });

  it("postKind=reply → 'none'", () => {
    expect(decideImageStrategy(highInfoPers, "general", "reply")).toBe("none");
  });
});

// ── 규칙 4: info_ratio < 20 ───────────────────────────────────────────────────

describe("규칙 4: info_ratio < 20 → 'none'", () => {
  it("info_ratio=0 → 'none'", () => {
    expect(decideImageStrategy(p({ info_ratio: 0 }), "general", "post")).toBe("none");
  });

  it("info_ratio=10 → 'none'", () => {
    expect(decideImageStrategy(p({ info_ratio: 10 }), "general", "post")).toBe("none");
  });

  it("info_ratio=19 → 'none' (경계값)", () => {
    expect(decideImageStrategy(p({ info_ratio: 19 }), "general", "post")).toBe("none");
  });

  it("info_ratio=20 → 'none'이 아닐 수 있음 (규칙 4 미적용)", () => {
    // info_ratio=20은 규칙 4 미적용 → 규칙 7(>=40) 미적용 → 기본값 none
    expect(decideImageStrategy(p({ info_ratio: 20 }), "general", "post")).toBe("none");
  });
});

// ── 규칙 5: nickname === '냉장고털이' ──────────────────────────────────────────

describe("규칙 5: nickname === '냉장고털이' → 'meme'", () => {
  it("nickname=냉장고털이, info_ratio=30 → 'meme' (규칙 4 미적용 구간)", () => {
    expect(
      decideImageStrategy(
        p({ nickname: "냉장고털이", info_ratio: 30 }),
        "talk",
        "post",
      ),
    ).toBe("meme");
  });

  it("nickname=냉장고털이, info_ratio=80, 일반 게시판 → 'meme' (규칙 7보다 우선)", () => {
    expect(
      decideImageStrategy(
        p({ nickname: "냉장고털이", info_ratio: 80 }),
        "automation-cases",
        "post",
      ),
    ).toBe("meme");
  });
});

// ── 규칙 7: info_ratio >= 40 ─────────────────────────────────────────────────

describe("규칙 7: info_ratio >= 40 → 'stock'", () => {
  it("info_ratio=40 → 'stock' (경계값)", () => {
    expect(decideImageStrategy(p({ info_ratio: 40 }), "automation-cases", "post")).toBe("stock");
  });

  it("info_ratio=80, 일반 게시판 → 'stock'", () => {
    expect(decideImageStrategy(p({ info_ratio: 80 }), "automation-cases", "post")).toBe("stock");
  });

  it("info_ratio=100 → 'stock'", () => {
    expect(decideImageStrategy(p({ info_ratio: 100 }), "general", "post")).toBe("stock");
  });
});

// ── 규칙 8: 기본값 ────────────────────────────────────────────────────────────

describe("규칙 8: 기본값 → 'none'", () => {
  it("info_ratio=25 (20이상 40미만), 일반 게시판 → 'none'", () => {
    expect(decideImageStrategy(p({ info_ratio: 25 }), "general", "post")).toBe("none");
  });

  it("info_ratio=39 (경계값) → 'none'", () => {
    expect(decideImageStrategy(p({ info_ratio: 39 }), "general", "post")).toBe("none");
  });
});

// ── 우선순위 교차 검증 ────────────────────────────────────────────────────────

describe("우선순위 교차 검증", () => {
  it("ai-creation 게시판 + is_admin_persona=false + info_ratio=0 → 'ai' (규칙 1 우선)", () => {
    expect(
      decideImageStrategy(p({ info_ratio: 0 }), "ai-creation", "post"),
    ).toBe("ai");
  });

  it("is_admin_persona=true + postKind=qna → 'ai' (규칙 2가 규칙 3보다 우선)", () => {
    // 이 케이스에서 규칙 2가 먼저 매치되어 'ai' 반환
    expect(
      decideImageStrategy(p({ is_admin_persona: true }), "general", "qna"),
    ).toBe("ai");
  });

  it("postKind가 'post'이면 postKind 규칙 미적용 → 다음 규칙으로 진행", () => {
    const postKind: PostKind = "post";
    // info_ratio=80, board=일반 → 규칙 7 적용 → 'stock'
    expect(decideImageStrategy(p({ info_ratio: 80 }), "general", postKind)).toBe("stock");
  });
});

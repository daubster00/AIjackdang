/**
 * prompt-builder vitest 단위 테스트 — Story 11.9
 */

import { describe, it, expect } from "vitest";
import {
  buildPersonaSystemPrompt,
  buildPostUserPrompt,
  buildTopicRefillPrompt,
} from "./prompt-builder.js";
import type { BotPersonaForPrompt, FactSummary } from "./context-types.js";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

const mockPersona: BotPersonaForPrompt = {
  nickname: "ai_dev_kim",
  personaPrompt: "당신은 AI 개발자 커뮤니티의 시니어 개발자입니다.",
  tone: "친근하고 가끔 유머 있는 말투",
  intentionalFlaws: "가끔 오타를 낸다",
  isAdminPersona: false,
  infoRatio: 60,
};

const mockFacts: FactSummary = {
  facts: ["Claude 3.5 Sonnet이 코드 작성에 최적화되어 있다", "AI 에이전트 시장이 빠르게 성장 중이다"],
  sourceUrls: ["https://anthropic.com"],
  confidence: "high",
};

const emptyFacts: FactSummary = { facts: [], sourceUrls: [], confidence: "low" };

// ── buildPersonaSystemPrompt ──────────────────────────────────────────────────

describe("buildPersonaSystemPrompt", () => {
  it("시스템 프롬프트에 이모지 금지 문구가 포함된다", () => {
    const prompt = buildPersonaSystemPrompt(mockPersona);
    expect(prompt).toContain("이모지 사용 절대 금지");
  });

  it("persona_prompt 텍스트가 시스템 프롬프트 첫 블록에 포함된다", () => {
    const prompt = buildPersonaSystemPrompt(mockPersona);
    expect(prompt).toContain("당신은 AI 개발자 커뮤니티의 시니어 개발자입니다.");
  });

  it("상투어(안녕하세요, 결론적으로) 금지 규칙이 포함된다", () => {
    const prompt = buildPersonaSystemPrompt(mockPersona);
    expect(prompt).toContain("안녕하세요");
    expect(prompt).toContain("결론적으로");
  });

  it("자기 언급 금지 규칙이 포함된다", () => {
    const prompt = buildPersonaSystemPrompt(mockPersona);
    expect(prompt).toContain("저는 AI이지만");
  });

  it("personaPrompt가 null이면 AI 티 제거 규칙만 포함된다", () => {
    const persona: BotPersonaForPrompt = { ...mockPersona, personaPrompt: null };
    const prompt = buildPersonaSystemPrompt(persona);
    expect(prompt).toContain("이모지 사용 절대 금지");
    expect(prompt).not.toContain("AI 개발자 커뮤니티의 시니어 개발자");
  });

  it("intentionalFlaws가 있으면 버릇 섹션이 포함된다", () => {
    const prompt = buildPersonaSystemPrompt(mockPersona);
    expect(prompt).toContain("가끔 오타를 낸다");
  });
});

// ── buildPostUserPrompt ────────────────────────────────────────────────────────

describe("buildPostUserPrompt", () => {
  it("titleSeed가 프롬프트에 포함된다", () => {
    const prompt = buildPostUserPrompt({
      titleSeed: "Claude Code 실전 활용법",
      facts: mockFacts,
      board: "talk",
      postKind: "info",
    });
    expect(prompt).toContain("Claude Code 실전 활용법");
  });

  it("facts가 있으면 search_summary 블록으로 삽입된다", () => {
    const prompt = buildPostUserPrompt({
      titleSeed: "테스트 주제",
      facts: mockFacts,
      board: "talk",
      postKind: "info",
    });
    expect(prompt).toContain("<search_summary>");
    expect(prompt).toContain("Claude 3.5 Sonnet");
    expect(prompt).toContain("</search_summary>");
  });

  it("facts가 빈 배열이면 search_summary 블록이 없다", () => {
    const prompt = buildPostUserPrompt({
      titleSeed: "테스트",
      facts: emptyFacts,
      board: "talk",
      postKind: "chat",
    });
    expect(prompt).not.toContain("<search_summary>");
  });

  it("guide 모드에서 목차 지시와 1500자 요건이 포함된다", () => {
    const prompt = buildPostUserPrompt({
      titleSeed: "AI 에이전트 심층 분석",
      facts: mockFacts,
      board: "resource",
      postKind: "guide",
    });
    expect(prompt).toContain("목차");
    expect(prompt).toContain("1500자");
    expect(prompt).toContain("코드블록");
  });

  it("guide 모드 + seriesContext에서 시리즈 정보가 포함된다", () => {
    const prompt = buildPostUserPrompt({
      titleSeed: "시리즈 주제",
      facts: mockFacts,
      board: "resource",
      postKind: "guide",
      seriesContext: { groupTitle: "AI 입문 시리즈", episodeIndex: 3 },
    });
    expect(prompt).toContain("AI 입문 시리즈");
    expect(prompt).toContain("3편");
  });

  it("guide 모드 + episodeIndex=2이상 + tableOfContents에서 이전 편 요약 지시 포함", () => {
    const prompt = buildPostUserPrompt({
      titleSeed: "2편 주제",
      facts: mockFacts,
      board: "resource",
      postKind: "guide",
      seriesContext: {
        groupTitle: "바이브코딩 시리즈",
        episodeIndex: 2,
        tableOfContents: ["1편: 입문", "2편: 실전"],
      },
    });
    expect(prompt).toContain("이전 편");
  });

  it("마크다운 형식 출력 지시가 포함된다", () => {
    const prompt = buildPostUserPrompt({
      titleSeed: "테스트",
      facts: emptyFacts,
      board: "talk",
      postKind: "chat",
    });
    expect(prompt).toContain("마크다운");
  });
});

// ── buildPostUserPrompt (큐레이션/퍼오기) ──────────────────────────────────────

describe("buildPostUserPrompt — 큐레이션 소개글", () => {
  it("youtube 큐레이션이면 영상 소개 지침으로 전환되고 제목·채널이 포함된다", () => {
    const prompt = buildPostUserPrompt({
      titleSeed: "AI 단편영화",
      facts: emptyFacts,
      board: "ai-creation",
      postKind: "chat",
      curation: { kind: "youtube", title: "The Frost — AI film", channel: "Waymark" },
    });
    expect(prompt).toContain("유튜브 AI 영상");
    expect(prompt).toContain("The Frost — AI film");
    expect(prompt).toContain("Waymark");
    // 영상은 자동 첨부되므로 "아래 영상"류 표현·링크 금지 지침이 있어야 한다
    expect(prompt).toContain("자동으로 첨부");
  });

  it("meme 큐레이션이면 이미지 소개 지침으로 전환된다", () => {
    const prompt = buildPostUserPrompt({
      titleSeed: "AI 밈",
      facts: emptyFacts,
      board: "ai-creation",
      postKind: "chat",
      curation: { kind: "meme" },
    });
    expect(prompt).toContain("AI 밈/이미지");
    expect(prompt).toContain("자동으로 첨부");
  });

  it("curation 미지정이면 기존 일반 글 프롬프트(주제 포함)를 유지한다", () => {
    const prompt = buildPostUserPrompt({
      titleSeed: "일반 주제",
      facts: emptyFacts,
      board: "talk",
      postKind: "chat",
    });
    expect(prompt).toContain("주제: 일반 주제");
    expect(prompt).not.toContain("자동으로 첨부");
  });
});

// ── buildTopicRefillPrompt ────────────────────────────────────────────────────

describe("buildTopicRefillPrompt", () => {
  it("페르소나 닉네임과 게시판 정보가 포함된다", () => {
    const prompt = buildTopicRefillPrompt(mockPersona, "talk", []);
    expect(prompt).toContain("ai_dev_kim");
    expect(prompt).toContain("talk");
  });

  it("기존 주제 목록이 중복 방지용으로 포함된다", () => {
    const prompt = buildTopicRefillPrompt(mockPersona, "talk", ["기존 주제 A", "기존 주제 B"]);
    expect(prompt).toContain("기존 주제 A");
    expect(prompt).toContain("기존 주제 B");
  });

  it("기존 주제가 없으면 중복 방지 섹션이 없다", () => {
    const prompt = buildTopicRefillPrompt(mockPersona, "talk", []);
    expect(prompt).not.toContain("기존 주제 (중복 생성 금지)");
  });

  it("JSON 배열 형식으로 반환하도록 지시한다", () => {
    const prompt = buildTopicRefillPrompt(mockPersona, "talk", []);
    expect(prompt).toContain('["주제1", "주제2"');
  });
});

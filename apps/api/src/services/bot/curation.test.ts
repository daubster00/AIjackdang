/**
 * curation 단위 테스트 — 큐레이션 모드 결정·검색어 선택(순수 로직).
 */

import { describe, it, expect } from "vitest";
import {
  decideCurationMode,
  curationVideoQuery,
  curationMemeQuery,
} from "./curation.js";

describe("decideCurationMode", () => {
  it("ai-creation이 아니면 항상 null(큐레이션 미적용)", () => {
    for (let i = 0; i < 50; i++) {
      expect(decideCurationMode("talk", false)).toBeNull();
      expect(decideCurationMode("qna", false)).toBeNull();
    }
  });

  it("관리자 페르소나는 ai-creation이어도 null(가이드/AI 생성 유지)", () => {
    for (let i = 0; i < 50; i++) {
      expect(decideCurationMode("ai-creation", true)).toBeNull();
    }
  });

  it("ai-creation 비관리자는 youtube/meme/ai 중 하나를 반환", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const mode = decideCurationMode("ai-creation", false);
      expect(mode).not.toBeNull();
      expect(["youtube", "meme", "ai"]).toContain(mode);
      if (mode) seen.add(mode);
    }
    // 퍼오기 위주 가중치라 youtube·meme는 충분히 자주 나와야 한다
    expect(seen.has("youtube")).toBe(true);
    expect(seen.has("meme")).toBe(true);
  });
});

describe("curation 검색어", () => {
  it("영상 검색어는 비어있지 않은 문자열", () => {
    expect(curationVideoQuery().length).toBeGreaterThan(0);
  });

  it("밈 검색어는 페르소나별 풀에서 선택되며 비어있지 않다", () => {
    expect(curationMemeQuery("냉장고털이").length).toBeGreaterThan(0);
    expect(curationMemeQuery("기타닉네임").length).toBeGreaterThan(0);
  });
});

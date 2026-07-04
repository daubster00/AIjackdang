/**
 * curation 단위 테스트 — 큐레이션 모드 결정·검색어 선택·저작권 위험 판정(순수 로직).
 *
 * Story 13.8: decideCurationMode가 curationConfig(설정 기반 판단)로 확장됨.
 */

import { describe, it, expect } from "vitest";
import {
  decideCurationMode,
  curationVideoQuery,
  curationMemeQuery,
  checkCurationCopyrightRisk,
} from "./curation.js";

describe("decideCurationMode", () => {
  it("curationConfig가 없으면(미주입) 어떤 게시판이든 항상 null", () => {
    for (let i = 0; i < 50; i++) {
      expect(decideCurationMode("ai-creation", false)).toBeNull();
      expect(decideCurationMode("talk", false)).toBeNull();
      expect(decideCurationMode("qna", false)).toBeNull();
    }
  });

  it("curationConfig.enabled=false이면 null", () => {
    for (let i = 0; i < 50; i++) {
      expect(decideCurationMode("ai-creation", false, { enabled: false })).toBeNull();
      expect(decideCurationMode("talk", false, { enabled: false })).toBeNull();
    }
  });

  it("curationConfig=null이면 null", () => {
    for (let i = 0; i < 50; i++) {
      expect(decideCurationMode("ai-creation", false, null)).toBeNull();
      expect(decideCurationMode("talk", false, null)).toBeNull();
    }
  });

  it("관리자 페르소나는 curationConfig.enabled=true여도 null(가이드/AI 생성 유지)", () => {
    for (let i = 0; i < 50; i++) {
      expect(decideCurationMode("ai-creation", true, { enabled: true })).toBeNull();
      expect(decideCurationMode("talk", true, { enabled: true })).toBeNull();
    }
  });

  it("curationConfig.enabled=true이면 youtube/meme/ai 중 하나 반환 (ai-creation)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const mode = decideCurationMode("ai-creation", false, { enabled: true });
      expect(mode).not.toBeNull();
      expect(["youtube", "meme", "ai"]).toContain(mode);
      if (mode) seen.add(mode);
    }
    // 퍼오기 위주 기본 가중치라 youtube·meme는 충분히 자주 나와야 한다
    expect(seen.has("youtube")).toBe(true);
    expect(seen.has("meme")).toBe(true);
  });

  it("curationConfig.enabled=true이면 youtube/meme/ai 중 하나 반환 (talk — 범위 확장)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const mode = decideCurationMode("talk", false, { enabled: true });
      expect(mode).not.toBeNull();
      expect(["youtube", "meme", "ai"]).toContain(mode);
      if (mode) seen.add(mode);
    }
    expect(seen.has("youtube")).toBe(true);
    expect(seen.has("meme")).toBe(true);
  });

  it("커스텀 weights가 반영된다", () => {
    const seen = new Set<string>();
    // youtube=100이면 항상 youtube
    for (let i = 0; i < 30; i++) {
      const mode = decideCurationMode("talk", false, {
        enabled: true,
        weights: { youtube: 100, meme: 0, ai: 0 },
      });
      if (mode) seen.add(mode);
    }
    expect(seen.size).toBe(1);
    expect(seen.has("youtube")).toBe(true);
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

describe("checkCurationCopyrightRisk", () => {
  it("유료 스톡 사이트 URL은 true", () => {
    expect(checkCurationCopyrightRisk("https://www.shutterstock.com/image-photo/123")).toBe(true);
    expect(checkCurationCopyrightRisk("https://www.gettyimages.com/detail/photo/test")).toBe(true);
    expect(checkCurationCopyrightRisk("https://www.istockphoto.com/photo/test")).toBe(true);
    expect(checkCurationCopyrightRisk("https://www.alamy.com/some-image.html")).toBe(true);
    expect(checkCurationCopyrightRisk("https://stock.adobe.com/images/test")).toBe(true);
  });

  it("일반 웹 이미지 URL은 false", () => {
    expect(checkCurationCopyrightRisk("https://example.com/image.jpg")).toBe(false);
    expect(checkCurationCopyrightRisk("https://unsplash.com/photos/test")).toBe(false);
    expect(checkCurationCopyrightRisk("https://images.unsplash.com/photo-test")).toBe(false);
  });

  it("잘못된 URL은 false", () => {
    expect(checkCurationCopyrightRisk("not-a-url")).toBe(false);
    expect(checkCurationCopyrightRisk("")).toBe(false);
  });
});

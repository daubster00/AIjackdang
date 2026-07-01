/**
 * duplicate-check vitest 단위 테스트 — Story 11.9
 */

import { describe, it, expect } from "vitest";
import { jaccardSimilarity, isTooSimilar } from "./duplicate-check.js";

// ── jaccardSimilarity ─────────────────────────────────────────────────────────

describe("jaccardSimilarity", () => {
  it("동일 문자열 → 1.0", () => {
    expect(jaccardSimilarity("안녕 세상 테스트", "안녕 세상 테스트")).toBe(1.0);
  });

  it("완전히 다른 문자열 → 0.0", () => {
    expect(jaccardSimilarity("사과 바나나 체리", "강아지 고양이 금붕어")).toBe(0.0);
  });

  it("두 빈 문자열 → 1.0 (동등 취급)", () => {
    expect(jaccardSimilarity("", "")).toBe(1.0);
  });

  it("한쪽만 빈 문자열 → 0.0", () => {
    expect(jaccardSimilarity("안녕하세요", "")).toBe(0.0);
    expect(jaccardSimilarity("", "안녕하세요")).toBe(0.0);
  });

  it("부분 겹침 → 0~1 사이 값", () => {
    // {aa, bb, cc, dd, ee, ff} vs {aa, bb, cc, dd, ee, gg}
    // 교집합=5, 합집합=7, 자카드=5/7≈0.714
    const score = jaccardSimilarity("aa bb cc dd ee ff", "aa bb cc dd ee gg");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
    expect(score).toBeCloseTo(5 / 7, 5);
  });

  it("대소문자 구분 없이 처리된다", () => {
    expect(jaccardSimilarity("Hello World", "hello world")).toBe(1.0);
  });

  it("1글자 단어는 토큰에서 제외된다", () => {
    // '나 는 가 요' → 1글자 단어 제외 → 빈 집합
    const score = jaccardSimilarity("나는가요", "나는 가요");
    // 두 집합 모두 2글자+ 토큰: {'나는가요'} vs {'나는', '가요'} = 교집합 0
    expect(score).toBe(0.0);
  });
});

// ── isTooSimilar ──────────────────────────────────────────────────────────────

describe("isTooSimilar", () => {
  it("60% 이상 겹치면 true", () => {
    // {aa, bb, cc, dd, ee, ff} vs {aa, bb, cc, dd, ee, gg} = 5/7 ≈ 0.714 >= 0.6
    expect(isTooSimilar("aa bb cc dd ee ff", ["aa bb cc dd ee gg"])).toBe(true);
  });

  it("60% 미만이면 false", () => {
    expect(isTooSimilar("사과 바나나 체리 망고", ["강아지 고양이 금붕어 새"])).toBe(false);
  });

  it("기존 글이 없으면 false", () => {
    expect(isTooSimilar("아무 텍스트나", [])).toBe(false);
  });

  it("기존 글 중 하나라도 임계값 초과면 true", () => {
    // {aa, bb, cc, dd, ee} vs {aa, bb, cc, dd, ee, ff, gg} = 5/7 ≈ 0.714 >= 0.6
    expect(
      isTooSimilar("aa bb cc dd ee", ["강아지 고양이", "aa bb cc dd ee ff gg"]),
    ).toBe(true);
  });

  it("커스텀 임계값 0.9 — 완전 동일이면 true", () => {
    expect(isTooSimilar("같은 텍스트입니다", ["같은 텍스트입니다"], 0.9)).toBe(true);
  });

  it("커스텀 임계값 0.9 — 부분 겹침이면 false", () => {
    // 5/7 ≈ 0.714 < 0.9
    expect(isTooSimilar("aa bb cc dd ee ff", ["aa bb cc dd ee gg"], 0.9)).toBe(false);
  });

  it("완전히 다른 글은 낮은 임계값(0.1)에서도 false", () => {
    expect(isTooSimilar("사과 바나나", ["강아지 고양이"], 0.1)).toBe(false);
  });
});

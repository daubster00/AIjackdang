import { describe, it, expect } from "vitest";
import { generateNickname, generateNicknameWithFallback } from "./nickname";

describe("generateNickname", () => {
  it("생성된 닉네임이 문자열이다", () => {
    const nickname = generateNickname();
    expect(typeof nickname).toBe("string");
  });

  it("닉네임이 비어있지 않다", () => {
    const nickname = generateNickname();
    expect(nickname.length).toBeGreaterThan(0);
  });

  it("닉네임이 3자리 숫자로 끝난다", () => {
    for (let i = 0; i < 20; i++) {
      const nickname = generateNickname();
      expect(nickname).toMatch(/\d{3}$/);
    }
  });

  it("3자리 숫자 범위가 000~999이다", () => {
    for (let i = 0; i < 50; i++) {
      const nickname = generateNickname();
      const numPart = nickname.slice(-3);
      const num = parseInt(numPart, 10);
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThanOrEqual(999);
    }
  });

  it("동일한 닉네임이 연속으로 생성되지 않는다 (확률적 테스트)", () => {
    const nicknames = new Set<string>();
    for (let i = 0; i < 10; i++) {
      nicknames.add(generateNickname());
    }
    // 10개 중 최소 3개는 달라야 함 (매우 낮은 확률로 실패 가능)
    expect(nicknames.size).toBeGreaterThan(2);
  });
});

describe("generateNicknameWithFallback", () => {
  it("attempt <= 10 이면 3자리 숫자로 끝난다", () => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const nickname = generateNicknameWithFallback(attempt);
      expect(nickname).toMatch(/\d{3}$/);
    }
  });

  it("attempt > 10 이면 6자리 숫자로 끝난다", () => {
    for (let attempt = 11; attempt <= 15; attempt++) {
      const nickname = generateNicknameWithFallback(attempt);
      expect(nickname).toMatch(/\d{6}$/);
    }
  });

  it("attempt > 10 fallback의 6자리 숫자가 000000~999999 범위이다", () => {
    for (let i = 0; i < 20; i++) {
      const nickname = generateNicknameWithFallback(11);
      const numPart = nickname.slice(-6);
      const num = parseInt(numPart, 10);
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThanOrEqual(999_999);
    }
  });

  it("attempt가 달라도 항상 문자열을 반환한다", () => {
    [1, 5, 10, 11, 20, 100].forEach((attempt) => {
      const nickname = generateNicknameWithFallback(attempt);
      expect(typeof nickname).toBe("string");
      expect(nickname.length).toBeGreaterThan(0);
    });
  });

  it("닉네임 형식: 형용사+명사+숫자 패턴 (한글 + 숫자 접미)", () => {
    const nickname = generateNicknameWithFallback(1);
    // 전체가 한글 + 숫자로 구성되어야 함
    expect(nickname).toMatch(/^[가-힣]+\d+$/);
  });
});

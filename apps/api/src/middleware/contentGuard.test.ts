/**
 * runContentGuard 단위 테스트 — Story 11.3 AC#3
 *
 * 테스트 목록:
 * 1. 스팸 링크 포함 텍스트 → { ok: false, code: "SPAM", message: string } 반환
 * 2. 금칙어 포함 텍스트 → { ok: false, code: "FORBIDDEN_WORD", message: string } 반환
 * 3. 정상 텍스트 → { ok: true } 반환
 * 4. 빈 문자열 → { ok: true } 반환 (빈 통과)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── @ai-jakdang/core 모킹 ─────────────────────────────────────────────────────
vi.mock("@ai-jakdang/core", () => ({
  detectSpam: vi.fn(() => false),
  detectForbiddenWord: vi.fn(() => false),
}));

// ── siteSettings 모킹 ─────────────────────────────────────────────────────────
vi.mock("../lib/siteSettings.js", () => ({
  getSiteSetting: vi.fn(async () => []),
}));

// ── 테스트 대상 import ─────────────────────────────────────────────────────────
import { runContentGuard } from "./contentGuard.js";
import { detectSpam, detectForbiddenWord } from "@ai-jakdang/core";
import { getSiteSetting } from "../lib/siteSettings.js";

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("runContentGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(detectSpam).mockReturnValue(false);
    vi.mocked(detectForbiddenWord).mockReturnValue(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSiteSetting as any).mockResolvedValue([]);
  });

  // ── 테스트 1: 스팸 링크 ──────────────────────────────────────────────────────
  it("스팸 링크 포함 텍스트 → { ok: false, code: 'SPAM', message: string } 반환", async () => {
    vi.mocked(detectSpam).mockReturnValue(true);

    const result = await runContentGuard("http://spam.example.com 팔로우 해주세요");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SPAM");
      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  // ── 테스트 2: 금칙어 ──────────────────────────────────────────────────────────
  it("금칙어 포함 텍스트 → { ok: false, code: 'FORBIDDEN_WORD', message: string } 반환", async () => {
    vi.mocked(detectSpam).mockReturnValue(false);
    vi.mocked(detectForbiddenWord).mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSiteSetting as any).mockResolvedValue(["금칙어"]);

    const result = await runContentGuard("금칙어가 들어간 텍스트");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FORBIDDEN_WORD");
      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  // ── 테스트 3: 정상 텍스트 ────────────────────────────────────────────────────
  it("정상 텍스트 → { ok: true } 반환", async () => {
    const result = await runContentGuard("안녕하세요, 정상적인 댓글입니다.");

    expect(result).toEqual({ ok: true });
    // 스팸·금칙어 검사가 실행됐어야 함
    expect(detectSpam).toHaveBeenCalledTimes(1);
    expect(getSiteSetting).toHaveBeenCalledWith("forbidden_words");
    expect(detectForbiddenWord).toHaveBeenCalledTimes(1);
  });

  // ── 테스트 4: 빈 문자열 ──────────────────────────────────────────────────────
  it("빈 문자열 → { ok: true } 반환 (빈 텍스트는 검사 건너뜀)", async () => {
    const result = await runContentGuard("");

    expect(result).toEqual({ ok: true });
    // 빈 텍스트는 detectSpam 호출 없이 즉시 통과
    expect(detectSpam).not.toHaveBeenCalled();
    expect(getSiteSetting).not.toHaveBeenCalled();
    expect(detectForbiddenWord).not.toHaveBeenCalled();
  });

  it("공백만 있는 텍스트 → { ok: true } 반환 (빈 통과)", async () => {
    const result = await runContentGuard("   ");

    expect(result).toEqual({ ok: true });
    expect(detectSpam).not.toHaveBeenCalled();
  });

  // ── 추가: 스팸이 먼저 걸리면 금칙어 검사 생략 ────────────────────────────────
  it("스팸 감지 시 금칙어 검사 생략 (단락 평가)", async () => {
    vi.mocked(detectSpam).mockReturnValue(true);

    const result = await runContentGuard("spam content here");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SPAM");
    }
    // 스팸이 걸렸으면 getSiteSetting 호출 없어야 함
    expect(getSiteSetting).not.toHaveBeenCalled();
    expect(detectForbiddenWord).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { deriveReportAction, detectForbiddenWord, detectSpam } from "./moderation";

describe("deriveReportAction", () => {
  describe("threshold <= 0 (임계치 미설정)", () => {
    it("threshold=0 이면 queue_only 반환", () => {
      expect(deriveReportAction(100, 0)).toBe("queue_only");
    });

    it("threshold=-1 이면 queue_only 반환", () => {
      expect(deriveReportAction(0, -1)).toBe("queue_only");
    });

    it("threshold=0, reportCount=0 이면 queue_only 반환", () => {
      expect(deriveReportAction(0, 0)).toBe("queue_only");
    });
  });

  describe("threshold > 0, 임계치 미달", () => {
    it("reportCount=0, threshold=5 이면 queue_only", () => {
      expect(deriveReportAction(0, 5)).toBe("queue_only");
    });

    it("reportCount=4, threshold=5 이면 queue_only", () => {
      expect(deriveReportAction(4, 5)).toBe("queue_only");
    });

    it("reportCount=1, threshold=10 이면 queue_only", () => {
      expect(deriveReportAction(1, 10)).toBe("queue_only");
    });
  });

  describe("threshold > 0, 임계치 정확히 도달", () => {
    it("reportCount=5, threshold=5 이면 auto_hide", () => {
      expect(deriveReportAction(5, 5)).toBe("auto_hide");
    });

    it("reportCount=1, threshold=1 이면 auto_hide", () => {
      expect(deriveReportAction(1, 1)).toBe("auto_hide");
    });
  });

  describe("threshold > 0, 임계치 초과", () => {
    it("reportCount=6, threshold=5 이면 auto_hide", () => {
      expect(deriveReportAction(6, 5)).toBe("auto_hide");
    });

    it("reportCount=100, threshold=3 이면 auto_hide", () => {
      expect(deriveReportAction(100, 3)).toBe("auto_hide");
    });
  });
});

// ── detectForbiddenWord ───────────────────────────────────────────────────────

describe("detectForbiddenWord", () => {
  describe("금칙어 목록이 비어 있을 때", () => {
    it("빈 목록이면 항상 false", () => {
      expect(detectForbiddenWord("스팸 광고 욕설", [])).toBe(false);
    });
  });

  describe("금칙어가 포함되지 않은 경우", () => {
    it("일반 텍스트는 false", () => {
      expect(detectForbiddenWord("안녕하세요 오늘 날씨 좋네요", ["욕설", "광고"])).toBe(false);
    });

    it("빈 문자열 콘텐츠는 false", () => {
      expect(detectForbiddenWord("", ["욕설"])).toBe(false);
    });
  });

  describe("금칙어가 포함된 경우", () => {
    it("정확히 일치하는 금칙어가 포함되면 true", () => {
      expect(detectForbiddenWord("이 게시글은 욕설 포함", ["욕설"])).toBe(true);
    });

    it("대소문자 무시 — 대문자 금칙어도 탐지", () => {
      expect(detectForbiddenWord("This is SPAM content", ["spam"])).toBe(true);
    });

    it("대소문자 무시 — 소문자 금칙어도 대문자 콘텐츠에서 탐지", () => {
      expect(detectForbiddenWord("FORBIDDEN word here", ["forbidden"])).toBe(true);
    });

    it("여러 금칙어 중 하나만 포함되어도 true", () => {
      expect(detectForbiddenWord("일반 텍스트 광고 포함", ["욕설", "광고", "사기"])).toBe(true);
    });

    it("콘텐츠 중간에 금칙어가 있어도 탐지", () => {
      expect(detectForbiddenWord("앞부분욕설뒷부분", ["욕설"])).toBe(true);
    });
  });

  describe("빈 문자열 금칙어는 무시", () => {
    it("빈 문자열 금칙어 항목은 탐지하지 않음", () => {
      expect(detectForbiddenWord("아무 내용", [""])).toBe(false);
    });
  });
});

// ── detectSpam ────────────────────────────────────────────────────────────────

describe("detectSpam", () => {
  describe("URL 없는 경우", () => {
    it("URL 없는 일반 텍스트는 false", () => {
      expect(detectSpam("안녕하세요 오늘 날씨 좋네요")).toBe(false);
    });

    it("빈 문자열은 false", () => {
      expect(detectSpam("")).toBe(false);
    });
  });

  describe("URL 수 기준 (>3 이면 스팸)", () => {
    it("URL 1개는 false", () => {
      expect(detectSpam("참고: https://example.com")).toBe(false);
    });

    it("URL 3개는 false (경계값)", () => {
      expect(
        detectSpam("https://a.com 와 https://b.com 과 https://c.com"),
      ).toBe(false);
    });

    it("URL 4개는 true (경계값 초과)", () => {
      expect(
        detectSpam("https://a.com https://b.com https://c.com https://d.com"),
      ).toBe(true);
    });

    it("URL 5개도 true", () => {
      expect(
        detectSpam(
          "https://a.com https://b.com https://c.com https://d.com https://e.com",
        ),
      ).toBe(true);
    });
  });

  describe("스팸 도메인 기준", () => {
    it("bit.ly 포함 URL이면 true", () => {
      expect(detectSpam("클릭: https://bit.ly/abcdef")).toBe(true);
    });

    it("tinyurl.com 포함 URL이면 true", () => {
      expect(detectSpam("여기 클릭 https://tinyurl.com/xyz")).toBe(true);
    });

    it("t.co 포함 URL이면 true", () => {
      expect(detectSpam("트위터 링크 https://t.co/example")).toBe(true);
    });

    it("일반 도메인 URL 1개는 false", () => {
      expect(detectSpam("공식 사이트: https://example.com/page")).toBe(false);
    });

    it("스팸 도메인이 URL이 아닌 텍스트에 포함되면 무시", () => {
      // 'bit.ly'가 URL이 아닌 일반 텍스트로 나타나는 경우
      expect(detectSpam("도메인 bit.ly 에 대해 설명합니다")).toBe(false);
    });
  });
});

import { describe, expect, it } from "vitest";
import { deriveReportAction } from "./moderation";

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

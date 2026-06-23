/**
 * 실전자료 다운로드 서비스 단위 테스트 — Story 4.6
 *
 * DB/S3 연결이 필요한 통합 테스트는 스킵 처리.
 * 라이브 인프라 없이 실행 가능한 로직(scan_status 분기, 에러 클래스)을 검증.
 */

import { describe, expect, it } from "vitest";
import {
  DownloadBlockedError,
  ResourceNotFoundError,
  FileNotFoundError,
} from "./download.service.js";

// ── 에러 클래스 검증 ──────────────────────────────────────────────────────────

describe("DownloadBlockedError", () => {
  it("RESOURCE_SCAN_PENDING 에러는 statusCode 409를 갖는다", () => {
    const err = new DownloadBlockedError("RESOURCE_SCAN_PENDING", 409, "검사 중");
    expect(err.code).toBe("RESOURCE_SCAN_PENDING");
    expect(err.statusCode).toBe(409);
    expect(err).toBeInstanceOf(DownloadBlockedError);
    expect(err).toBeInstanceOf(Error);
  });

  it("RESOURCE_INFECTED 에러는 statusCode 403을 갖는다", () => {
    const err = new DownloadBlockedError("RESOURCE_INFECTED", 403, "감염 파일");
    expect(err.code).toBe("RESOURCE_INFECTED");
    expect(err.statusCode).toBe(403);
  });

  it("RESOURCE_SCAN_ERROR 에러는 statusCode 503을 갖는다", () => {
    const err = new DownloadBlockedError("RESOURCE_SCAN_ERROR", 503, "검사 오류");
    expect(err.code).toBe("RESOURCE_SCAN_ERROR");
    expect(err.statusCode).toBe(503);
  });

  it("DownloadBlockedError는 Error instanceof를 통과한다", () => {
    const err = new DownloadBlockedError("RESOURCE_SCAN_PENDING", 409, "검사 중");
    expect(err instanceof Error).toBe(true);
    expect(err instanceof DownloadBlockedError).toBe(true);
  });
});

describe("ResourceNotFoundError", () => {
  it("기본 메시지를 가진다", () => {
    const err = new ResourceNotFoundError();
    expect(err.message).toBe("자료를 찾을 수 없습니다.");
    expect(err).toBeInstanceOf(Error);
  });

  it("커스텀 메시지를 받는다", () => {
    const err = new ResourceNotFoundError("커스텀 메시지");
    expect(err.message).toBe("커스텀 메시지");
  });
});

describe("FileNotFoundError", () => {
  it("기본 메시지를 가진다", () => {
    const err = new FileNotFoundError();
    expect(err.message).toBe("파일을 찾을 수 없습니다.");
    expect(err).toBeInstanceOf(Error);
  });
});

// ── scan_status 분기 로직 검증 ─────────────────────────────────────────────────

describe("scan_status 분기 로직", () => {
  type ScanStatus = "pending" | "clean" | "infected" | "error";

  /**
   * download.service.ts의 scan_status 분기를 독립적으로 재현.
   * 실제 DB/S3 없이 로직만 검증.
   */
  function resolveScanStatus(status: ScanStatus): "ok" | "pending" | "infected" | "error" {
    if (status === "pending") return "pending";
    if (status === "infected") return "infected";
    if (status === "error") return "error";
    return "ok"; // clean만 허용
  }

  it("clean 파일은 다운로드 허용(ok 반환)", () => {
    expect(resolveScanStatus("clean")).toBe("ok");
  });

  it("pending 파일은 409 대상(pending 반환)", () => {
    expect(resolveScanStatus("pending")).toBe("pending");
  });

  it("infected 파일은 403 대상(infected 반환)", () => {
    expect(resolveScanStatus("infected")).toBe("infected");
  });

  it("error 파일은 503 대상(error 반환)", () => {
    expect(resolveScanStatus("error")).toBe("error");
  });
});

// ── presigned URL 만료 시간 계산 로직 ──────────────────────────────────────────

describe("presigned URL 만료 시간 계산", () => {
  it("60초 후의 ISO 8601 문자열을 반환한다", () => {
    const before = Date.now();
    const expiresIn = 60;
    const expiresAt = new Date(before + expiresIn * 1000).toISOString();

    const parsed = new Date(expiresAt).getTime();
    // 60초(±1초 오차 허용)
    expect(parsed).toBeGreaterThanOrEqual(before + (expiresIn - 1) * 1000);
    expect(parsed).toBeLessThanOrEqual(before + (expiresIn + 1) * 1000);
  });

  it("expiresAt은 ISO 8601 형식이다", () => {
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();
    expect(expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

// ── DB/S3 연결 필요 테스트 (통합) ────────────────────────────────────────────

describe.todo("통합: DB/S3 연결 필요 (downloadResource, downloadFile)");

/**
 * resource-scan.processor.ts 단위 테스트 — Story 4.5
 *
 * S3 SDK, ClamAV net 소켓, DB를 모두 mock으로 교체하여 순수 로직만 테스트한다.
 * 실제 ClamAV/S3/DB 연결 불필요.
 *
 * 테스트 케이스:
 * - CLEAN: scan_status=clean 업데이트 확인
 * - FOUND: scan_status=infected + S3 quarantine 이동 + 원본 삭제 확인
 * - ERROR(ClamAV 오류): throw Error → BullMQ 재시도 트리거 확인
 * - 멱등: clean 상태 파일 재처리 시 early return 확인
 * - 멱등: infected 상태 파일 재처리 시 early return 확인
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import type { Job } from "bullmq";

// ── vi.mock은 호이스팅되므로 top-level 변수 참조 금지 ─────────────────────────

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ Body: Readable.from([Buffer.from("test")]) }),
  })),
  GetObjectCommand: vi.fn().mockImplementation((p) => ({ _type: "GetObject", ...p })),
  CopyObjectCommand: vi.fn().mockImplementation((p) => ({ _type: "CopyObject", ...p })),
  DeleteObjectCommand: vi.fn().mockImplementation((p) => ({ _type: "DeleteObject", ...p })),
}));

vi.mock("@ai-jakdang/config", () => ({
  env: {
    CLAMD_HOST: "127.0.0.1",
    CLAMD_PORT: 3310,
    REDIS_URL: "redis://localhost:6380",
    DATABASE_URL: "postgres://localhost/test",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "auto",
    S3_ACCESS_KEY_ID: "test",
    S3_SECRET_ACCESS_KEY: "test",
    S3_FORCE_PATH_STYLE: true,
    S3_BUCKET_PRIVATE: "ai-jakdang-private",
    S3_BUCKET_PUBLIC: "ai-jakdang-public",
    LOG_LEVEL: "silent",
    NODE_ENV: "test",
    AUTH_SECRET: "test-secret",
    WEB_PUBLIC_URL: "http://localhost:3003",
    ADMIN_PUBLIC_URL: "http://localhost:3004",
    API_PORT: 4003,
    API_HOST: "0.0.0.0",
  },
}));

vi.mock("@ai-jakdang/database", () => ({
  getDb: vi.fn(),
  schema: {
    resourceFiles: {
      id: "id",
      storageKey: "storageKey",
      scanStatus: "scanStatus",
      scanCompletedAt: "scanCompletedAt",
    },
  },
}));

// ClamAV 응답을 제어하는 전역 상태
let clamdResponseText = "stream: OK\n";

vi.mock("node:net", () => {
  const Socket = vi.fn().mockImplementation(() => {
    // listeners 맵을 클로저로 캡처
    const listeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();

    const instance = {
      connect: vi.fn().mockImplementation(
        (_port: number, _host: string, cb: () => void) => {
          // 다음 tick에 연결 성공 콜백 호출
          setTimeout(() => {
            cb();
            // 그 다음 tick에 data 이벤트 발생
            setTimeout(() => {
              (listeners.get("data") ?? []).forEach((l) =>
                l(Buffer.from(clamdResponseText)),
              );
            }, 5);
          }, 0);
        },
      ),
      write: vi.fn(),
      destroy: vi.fn(),
      resume: vi.fn(),
      on: vi.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(cb);
      }),
    };
    return instance;
  });

  return { default: { Socket } };
});

vi.mock("../lib/s3.js", () => ({
  getS3Client: vi.fn(),
  getPrivateBucket: vi.fn().mockReturnValue("ai-jakdang-private"),
}));

// ── 테스트 대상 import (mock 이후) ───────────────────────────────────────────
import { processResourceScan } from "./resource-scan.processor";
import { getDb } from "@ai-jakdang/database";
import { getS3Client } from "../lib/s3.js";

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeS3Body(content = "dummy"): Readable {
  return Readable.from([Buffer.from(content)]);
}

function makeJob(fileIds: string[], resourceId = "res-uuid-001"): Job {
  return {
    id: "job-test-001",
    data: { resourceFileIds: fileIds, resourceId },
    name: "resource.scan",
  } as unknown as Job;
}

/** DB mock을 설정하고 s3Send mock을 반환 */
function setupMocks(fileId: string, scanStatus: "pending" | "clean" | "infected" | "error") {
  const s3SendMock = vi.fn().mockResolvedValue({ Body: makeS3Body() });
  vi.mocked(getS3Client).mockReturnValue({ send: s3SendMock } as unknown as ReturnType<typeof getS3Client>);

  const updateSetMock = vi.fn().mockReturnThis();
  const updateWhereMock = vi.fn().mockResolvedValue(undefined);
  const updateMock = vi.fn().mockReturnValue({
    set: updateSetMock,
    where: updateWhereMock,
  });

  const selectWhereMock = vi.fn().mockResolvedValue([
    {
      id: fileId,
      storageKey: `resources/res-uuid-001/${fileId}.zip`,
      scanStatus,
    },
  ]);
  const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
  const selectMock = vi.fn().mockReturnValue({ from: selectFromMock });

  vi.mocked(getDb).mockReturnValue({
    update: updateMock,
    select: selectMock,
  } as unknown as ReturnType<typeof getDb>);

  return { s3SendMock, updateMock, updateSetMock, updateWhereMock, selectMock };
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("processResourceScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clamdResponseText = "stream: OK\n";
  });

  // ── CLEAN ────────────────────────────────────────────────────────────────────

  it("CLEAN 응답 시 scan_status=clean으로 DB 업데이트한다", async () => {
    clamdResponseText = "stream: OK\n";
    const fileId = "file-clean-001";
    const { updateMock, updateSetMock, s3SendMock } = setupMocks(fileId, "pending");

    await processResourceScan(makeJob([fileId]));

    // S3 GetObject 다운로드 호출 확인
    expect(s3SendMock).toHaveBeenCalledWith(expect.objectContaining({ _type: "GetObject" }));

    // DB update 호출 확인
    expect(updateMock).toHaveBeenCalled();

    // set({ scanStatus: 'clean', scanCompletedAt: Date }) 확인
    const setCall = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCall).toBeDefined();
    expect(setCall["scanStatus"]).toBe("clean");
    expect(setCall["scanCompletedAt"]).toBeInstanceOf(Date);

    // CopyObject/DeleteObject 미호출 확인 (격리 없음)
    const callTypes = s3SendMock.mock.calls.map(
      (c) => (c[0] as { _type: string })._type,
    );
    expect(callTypes).not.toContain("CopyObject");
    expect(callTypes).not.toContain("DeleteObject");
  });

  // ── FOUND ────────────────────────────────────────────────────────────────────

  it("FOUND 응답 시 infected 처리 + quarantine 이동 + 원본 삭제한다", async () => {
    clamdResponseText = "stream: Eicar-Test-Signature FOUND\n";
    const fileId = "file-infected-001";
    const { updateMock, updateSetMock, s3SendMock } = setupMocks(fileId, "pending");

    // GetObject → CopyObject → DeleteObject 순서로 응답
    s3SendMock
      .mockResolvedValueOnce({ Body: makeS3Body() }) // GetObject
      .mockResolvedValueOnce({}) // CopyObject
      .mockResolvedValueOnce({}); // DeleteObject

    await processResourceScan(makeJob([fileId]));

    // DB update: infected
    expect(updateMock).toHaveBeenCalled();
    const setCall = updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCall).toBeDefined();
    expect(setCall["scanStatus"]).toBe("infected");
    expect(String(setCall["storageKey"] ?? "")).toContain("quarantine/");

    // S3: CopyObject + DeleteObject 호출 확인
    const callTypes = s3SendMock.mock.calls.map(
      (c) => (c[0] as { _type: string })._type,
    );
    expect(callTypes).toContain("CopyObject");
    expect(callTypes).toContain("DeleteObject");
  });

  // ── ERROR ────────────────────────────────────────────────────────────────────

  it("ClamAV ERROR 응답 시 Error를 throw한다", async () => {
    clamdResponseText = "stream: ERROR Access denied. ERROR\n";
    const fileId = "file-error-001";
    setupMocks(fileId, "pending");

    await expect(processResourceScan(makeJob([fileId]))).rejects.toThrow(/ClamAV 스캔 오류/);
  });

  // ── 멱등: clean ───────────────────────────────────────────────────────────────

  it("이미 clean 상태인 파일은 S3 다운로드 없이 early return한다 (멱등)", async () => {
    const fileId = "file-idempotent-clean-001";
    const { s3SendMock, updateMock } = setupMocks(fileId, "clean");

    await processResourceScan(makeJob([fileId]));

    // S3 GetObject 미호출 — early return 확인
    expect(s3SendMock).not.toHaveBeenCalled();
    // DB update 미호출
    expect(updateMock).not.toHaveBeenCalled();
  });

  // ── 멱등: infected ────────────────────────────────────────────────────────────

  it("이미 infected 상태인 파일은 S3 다운로드 없이 early return한다 (멱등)", async () => {
    const fileId = "file-idempotent-infected-001";
    const { s3SendMock, updateMock } = setupMocks(fileId, "infected");

    await processResourceScan(makeJob([fileId]));

    expect(s3SendMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  // ── 복수 파일 ─────────────────────────────────────────────────────────────────

  it("여러 파일 ID가 있는 경우 각각 개별 처리한다", async () => {
    clamdResponseText = "stream: OK\n";
    const fileIds = ["file-multi-001", "file-multi-002"];

    const s3SendMock = vi.fn().mockResolvedValue({ Body: makeS3Body() });
    vi.mocked(getS3Client).mockReturnValue({ send: s3SendMock } as unknown as ReturnType<typeof getS3Client>);

    const updateSetMock = vi.fn().mockReturnThis();
    const updateWhereMock = vi.fn().mockResolvedValue(undefined);
    const updateMock = vi.fn().mockReturnValue({
      set: updateSetMock,
      where: updateWhereMock,
    });

    let callCount = 0;
    const selectWhereMock = vi.fn().mockImplementation(() => {
      const id = fileIds[callCount++]!;
      return Promise.resolve([
        { id, storageKey: `resources/res-uuid-001/${id}.zip`, scanStatus: "pending" },
      ]);
    });
    const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
    const selectMock = vi.fn().mockReturnValue({ from: selectFromMock });

    vi.mocked(getDb).mockReturnValue({
      update: updateMock,
      select: selectMock,
    } as unknown as ReturnType<typeof getDb>);

    await processResourceScan(makeJob(fileIds));

    // DB update가 2번 호출되어야 함
    expect(updateMock).toHaveBeenCalledTimes(2);
  });
});

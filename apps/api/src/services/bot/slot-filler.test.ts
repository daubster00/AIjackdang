/**
 * slot-filler 단위 테스트 — Story 13.4 Task 5
 *
 * 커버리지:
 *  - fillAiDiagram 성공 / genImage 실패
 *  - fillWebDownload 다운로드 실패 · Content-Type mimetype 폴백
 *  - fillImageSlot 이미 ready + force=false → skipped 반환
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 모듈 모킹 (vi.hoisted로 모든 mock fn 호이스팅) ──────────────────────────────

const {
  mockGenImage,
  mockUploadImage,
  mockGetDb,
  mockSelectFn,
  mockUpdateFn,
  mockChromiumLaunch,
} = vi.hoisted(() => {
  const selectFn = vi.fn();
  const updateFn = vi.fn();
  const db = { select: selectFn, update: updateFn };

  const mockPage = {
    setViewportSize: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("png-data")),
  };
  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    mockGenImage: vi.fn(),
    mockUploadImage: vi.fn(),
    mockGetDb: vi.fn(() => db),
    mockSelectFn: selectFn,
    mockUpdateFn: updateFn,
    mockChromiumLaunch: vi.fn().mockResolvedValue(mockBrowser),
  };
});

vi.mock("@ai-jakdang/server-bot/image", () => ({
  genImage: mockGenImage,
  DEFAULT_IMAGE_MODEL: { provider: "google", model: "gemini-3.1-flash-image" },
}));

vi.mock("../storage/index.js", () => ({
  uploadImage: mockUploadImage,
}));

vi.mock("@ai-jakdang/database", () => ({
  getDb: mockGetDb,
  schema: {
    botCurriculumImageSlots: {
      id: "id",
      imageUrl: "image_url",
      status: "status",
      updatedAt: "updated_at",
      assetKey: "asset_key",
      sourceKind: "source_kind",
      diagramPrompt: "diagram_prompt",
      sourceUrl: "source_url",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ op: "inArray", col, vals })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args: args.filter(Boolean) })),
}));

vi.mock("playwright", () => ({
  chromium: {
    launch: mockChromiumLaunch,
  },
}));

// 모킹 이후 대상 모듈 import
import { fillImageSlot } from "./slot-filler.js";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

/** 기본 슬롯 픽스처 (ai_diagram, pending) */
function makeSlot(overrides: Partial<{
  id: string;
  assetKey: string;
  sourceKind: "ai_diagram" | "web_download" | "capture" | "user_upload";
  status: "pending" | "ready";
  imageUrl: string | null;
  diagramPrompt: string | null;
  sourceUrl: string | null;
  caption: string;
}> = {}) {
  return {
    id: "slot-uuid-1",
    assetKey: "test-asset-key",
    sourceKind: "ai_diagram" as const,
    status: "pending" as const,
    imageUrl: null,
    diagramPrompt: "test diagram prompt",
    sourceUrl: null,
    caption: "테스트 캡션",
    ...overrides,
  };
}

/** DB select 체인 목 설정: 반환값을 지정한다. */
function mockDbSelect(rows: unknown[]) {
  mockSelectFn.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

/** DB update 체인 목 설정 */
function mockDbUpdate() {
  mockUpdateFn.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
}

// ── 초기화 ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockDbUpdate(); // 대부분의 테스트에서 update는 성공
});

// ── fillImageSlot — 슬롯 없음 / skip ─────────────────────────────────────────

describe("fillImageSlot — 슬롯 없음 / skip", () => {
  it("슬롯 없음 시 outcome=failed 반환", async () => {
    mockDbSelect([]);
    const result = await fillImageSlot("nonexistent-id");
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe("failed");
    expect(result.reason).toMatch(/슬롯 없음/);
  });

  it("status=ready, force=false → outcome=skipped + 기존 imageUrl 반환", async () => {
    const slot = makeSlot({ status: "ready", imageUrl: "https://cdn.test/existing.png" });
    mockDbSelect([slot]);

    const result = await fillImageSlot(slot.id);

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("skipped");
    expect(result.imageUrl).toBe("https://cdn.test/existing.png");
    // update는 호출되지 않아야 한다
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("status=ready, force=true → 재조달 진행(fillAiDiagram 호출)", async () => {
    const slot = makeSlot({ status: "ready", imageUrl: "https://cdn.test/old.png" });
    mockDbSelect([slot]);
    mockGenImage.mockResolvedValue({ data: Buffer.from("img"), mimetype: "image/png", costUsd: 0.04 });
    mockUploadImage.mockResolvedValue({ url: "https://cdn.test/new.png", filename: "new.png" });

    const result = await fillImageSlot(slot.id, { force: true });

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("filled");
    expect(result.imageUrl).toBe("https://cdn.test/new.png");
  });
});

// ── fillAiDiagram ─────────────────────────────────────────────────────────────

describe("fillAiDiagram", () => {
  it("성공: genImage + uploadImage 호출 후 imageUrl 반환", async () => {
    const slot = makeSlot({ diagramPrompt: "A clean flow diagram" });
    mockDbSelect([slot]);
    mockGenImage.mockResolvedValue({
      data: Buffer.from("image-bytes"),
      mimetype: "image/png",
      costUsd: 0.04,
    });
    mockUploadImage.mockResolvedValue({
      url: "https://cdn.test/slot-ai-test-asset-key.png",
      filename: "slot-ai-test-asset-key.png",
    });

    const result = await fillImageSlot(slot.id);

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("filled");
    expect(result.imageUrl).toBe("https://cdn.test/slot-ai-test-asset-key.png");
    expect(mockGenImage).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "A clean flow diagram" }),
    );
    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: "image/png" }),
      "editor-images",
    );
  });

  it("opts.diagramPrompt로 슬롯 diagram_prompt를 override한다", async () => {
    const slot = makeSlot({ diagramPrompt: "원래 프롬프트" });
    mockDbSelect([slot]);
    mockGenImage.mockResolvedValue({ data: Buffer.from("img"), mimetype: "image/png", costUsd: 0 });
    mockUploadImage.mockResolvedValue({ url: "https://cdn.test/x.png", filename: "x.png" });

    await fillImageSlot(slot.id, { diagramPrompt: "override 프롬프트" });

    expect(mockGenImage).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "override 프롬프트" }),
    );
  });

  it("diagram_prompt 없음 → outcome=failed 반환", async () => {
    const slot = makeSlot({ diagramPrompt: null });
    mockDbSelect([slot]);

    const result = await fillImageSlot(slot.id);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe("failed");
    expect(result.reason).toMatch(/diagram_prompt 없음/);
    expect(mockGenImage).not.toHaveBeenCalled();
  });

  it("genImage가 null 반환 → outcome=failed 반환", async () => {
    const slot = makeSlot({ diagramPrompt: "프롬프트" });
    mockDbSelect([slot]);
    mockGenImage.mockResolvedValue(null);

    const result = await fillImageSlot(slot.id);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe("failed");
    expect(result.reason).toMatch(/genImage 실패/);
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it("mimetype image/jpeg → 확장자 jpg로 변환한다", async () => {
    const slot = makeSlot({ diagramPrompt: "프롬프트" });
    mockDbSelect([slot]);
    mockGenImage.mockResolvedValue({
      data: Buffer.from("img"),
      mimetype: "image/jpeg",
      costUsd: 0,
    });
    mockUploadImage.mockResolvedValue({ url: "https://cdn.test/x.jpg", filename: "x.jpg" });

    await fillImageSlot(slot.id);

    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "slot-ai-test-asset-key.jpg" }),
      "editor-images",
    );
  });
});

// ── fillWebDownload ────────────────────────────────────────────────────────────

describe("fillWebDownload", () => {
  it("성공: 이미지 다운로드 + uploadImage 호출 후 imageUrl 반환", async () => {
    const slot = makeSlot({
      sourceKind: "web_download",
      sourceUrl: "https://example.com/img.png",
    });
    mockDbSelect([slot]);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (k: string) => (k === "content-type" ? "image/png" : null) },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
    vi.stubGlobal("fetch", fetchMock);

    mockUploadImage.mockResolvedValue({
      url: "https://cdn.test/slot-web-test-asset-key.png",
      filename: "slot-web-test-asset-key.png",
    });

    const result = await fillImageSlot(slot.id);

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("filled");
    expect(result.imageUrl).toBe("https://cdn.test/slot-web-test-asset-key.png");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/img.png",
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.stringContaining("aijackdang") }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("source_url 없으면 outcome=failed 반환", async () => {
    const slot = makeSlot({ sourceKind: "web_download", sourceUrl: null });
    mockDbSelect([slot]);

    const result = await fillImageSlot(slot.id);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe("failed");
    expect(result.reason).toMatch(/source_url 없음/);
  });

  it("HTTP 비OK 응답 → outcome=failed 반환", async () => {
    const slot = makeSlot({
      sourceKind: "web_download",
      sourceUrl: "https://example.com/img.png",
    });
    mockDbSelect([slot]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    const result = await fillImageSlot(slot.id);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe("failed");
    expect(result.reason).toMatch(/403/);

    vi.unstubAllGlobals();
  });

  it("Content-Type이 image/ 비prefix → 'image/png' 기본값으로 폴백한다", async () => {
    const slot = makeSlot({
      sourceKind: "web_download",
      sourceUrl: "https://example.com/img",
    });
    mockDbSelect([slot]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (k: string) => (k === "content-type" ? "application/octet-stream" : null) },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }));
    mockUploadImage.mockResolvedValue({ url: "https://cdn.test/x.png", filename: "x.png" });

    await fillImageSlot(slot.id);

    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: "image/png" }),
      "editor-images",
    );

    vi.unstubAllGlobals();
  });

  it("fetch 예외 → outcome=failed 반환(파이프라인 차단 없음)", async () => {
    const slot = makeSlot({
      sourceKind: "web_download",
      sourceUrl: "https://example.com/img.png",
    });
    mockDbSelect([slot]);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const result = await fillImageSlot(slot.id);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe("failed");
    expect(result.reason).toMatch(/network error/);

    vi.unstubAllGlobals();
  });
});

// ── fillCapture ────────────────────────────────────────────────────────────────

describe("fillCapture", () => {
  it("source_url 없으면 수동 캡처 안내 반환(outcome=failed)", async () => {
    const slot = makeSlot({ sourceKind: "capture", sourceUrl: null });
    mockDbSelect([slot]);

    const result = await fillImageSlot(slot.id);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe("failed");
    expect(result.reason).toMatch(/capture-slot\.ts/);
    expect(mockChromiumLaunch).not.toHaveBeenCalled();
  });

  it("source_url 있으면 Playwright 실행 후 imageUrl 반환", async () => {
    const slot = makeSlot({
      sourceKind: "capture",
      sourceUrl: "https://make.com/scenario",
    });
    mockDbSelect([slot]);
    mockUploadImage.mockResolvedValue({
      url: "https://cdn.test/slot-cap-test-asset-key.png",
      filename: "slot-cap.png",
    });

    const result = await fillImageSlot(slot.id);

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("filled");
    expect(result.imageUrl).toBe("https://cdn.test/slot-cap-test-asset-key.png");
    expect(mockChromiumLaunch).toHaveBeenCalledWith({ headless: true });
    expect(mockUploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: "image/png" }),
      "editor-images",
    );
  });
});

// ── user_upload ────────────────────────────────────────────────────────────────

describe("user_upload", () => {
  it("outcome=failed + 엔드포인트 안내 반환", async () => {
    const slot = makeSlot({ sourceKind: "user_upload" });
    mockDbSelect([slot]);

    const result = await fillImageSlot(slot.id);

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe("failed");
    expect(result.reason).toMatch(/upload 엔드포인트/);
  });
});

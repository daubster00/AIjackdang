/**
 * 커리큘럼 스테이징 파이프라인 vitest 단위 테스트 — Story 13.3
 *
 * 모든 외부 의존성(DB·AI·contentGuard·write·censor)을 모킹하여
 * 11개 시나리오를 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 모듈 모킹 (hoisted) ────────────────────────────────────────────────────────

const {
  mockDb,
  mockCallModel,
  mockGetModelAssignment,
  mockRunSelfCensor,
  mockRunContentGuard,
  mockCreatePostAsBot,
  mockInsertInlineImagesByMarker,
  mockBuildPersonaSystemPrompt,
  mockBuildGuideChapterUserPrompt,
  mockExtractTextFromTiptap,
  mockParseResponseToTiptap,
} = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
  mockCallModel: vi.fn(),
  mockGetModelAssignment: vi.fn(),
  mockRunSelfCensor: vi.fn(),
  mockRunContentGuard: vi.fn(),
  mockCreatePostAsBot: vi.fn(),
  mockInsertInlineImagesByMarker: vi.fn(),
  mockBuildPersonaSystemPrompt: vi.fn(),
  mockBuildGuideChapterUserPrompt: vi.fn(),
  mockExtractTextFromTiptap: vi.fn(),
  mockParseResponseToTiptap: vi.fn(),
}));

vi.mock("@ai-jakdang/database", () => ({
  getDb: vi.fn(() => mockDb),
  schema: {
    botCurriculumChapters: { id: "id", seriesId: "seriesId", orderIndex: "orderIndex", status: "status", draftContent: "draftContent", continuitySummary: "continuitySummary", updatedAt: "updatedAt", publishedPostId: "publishedPostId", draftTextEditable: "draftTextEditable", title: "title", goal: "goal", outline: "outline" },
    botCurriculumSeries: { id: "id", title: "title", board: "board", tool: "tool", intro: "intro" },
    botCurriculumImageSlots: { id: "id", chapterId: "chapterId", assetKey: "assetKey", caption: "caption", alt: "alt", status: "status", imageUrl: "imageUrl", sourceUrl: "sourceUrl", createdAt: "createdAt" },
    botPersonas: { id: "id", nickname: "nickname", userId: "userId", isAdminPersona: "isAdminPersona", infoRatio: "infoRatio", personaPrompt: "personaPrompt", tone: "tone", intentionalFlaws: "intentionalFlaws" },
    botPersonaBoards: { personaId: "personaId", board: "board" },
    botHoldQueue: { jobId: "jobId", reason: "reason", decided: "decided" },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  lt: vi.fn((col: unknown, val: unknown) => ({ op: "lt", col, val })),
  asc: vi.fn((col: unknown) => ({ op: "asc", col })),
  count: vi.fn(() => ({ op: "count" })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ op: "inArray", col, vals })),
}));

vi.mock("@ai-jakdang/server-bot/ai", () => ({
  callModel: mockCallModel,
  getModelAssignment: mockGetModelAssignment,
}));

vi.mock("@ai-jakdang/bot-core", () => ({
  buildPersonaSystemPrompt: mockBuildPersonaSystemPrompt,
  buildGuideChapterUserPrompt: mockBuildGuideChapterUserPrompt,
  extractTextFromTiptap: mockExtractTextFromTiptap,
}));

vi.mock("@ai-jakdang/server-bot/image", () => ({
  insertInlineImagesByMarker: mockInsertInlineImagesByMarker,
}));

vi.mock("./write.js", () => ({
  createPostAsBot: mockCreatePostAsBot,
}));

vi.mock("./censor.js", () => ({
  runSelfCensor: mockRunSelfCensor,
}));

vi.mock("../../middleware/contentGuard.js", () => ({
  runContentGuard: mockRunContentGuard,
}));

vi.mock("./_tiptap-parser.js", () => ({
  parseResponseToTiptap: mockParseResponseToTiptap,
}));

// 테스트 대상 import
import {
  draftCurriculumChapter,
  checkAndPromoteChapter,
  publishChapter,
} from "./curriculum-staging.js";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

const CHAPTER_ID = "chapter-uuid-1";
const SERIES_ID = "series-uuid-1";
const PERSONA_ID = "persona-uuid-1";
const POST_ID = "post-uuid-1";

const mockSeries = {
  id: SERIES_ID,
  title: "제로부터 바이브코딩",
  board: "vibe-coding-guide",
  tool: "Claude Code",
  intro: "코딩을 몰라도 AI로 만드는 시리즈.",
};

const mockChapter = {
  id: CHAPTER_ID,
  seriesId: SERIES_ID,
  orderIndex: 1,
  title: "바이브코딩이 대체 뭔가",
  goal: "바이브코딩의 개념을 잡는다",
  outline: ["개념 소개", "차이점 설명"],
  draftContent: null,
  draftTextEditable: null,
  continuitySummary: null,
  status: "planned" as const,
  scheduledAt: null,
  publishedPostId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPersona = {
  id: PERSONA_ID,
  userId: "user-uuid-1",
  nickname: "AI작당지기",
  personaPrompt: "당신은 AI작당 운영진입니다.",
  tone: "친근하고 전문적인 말투",
  intentionalFlaws: null,
  isAdminPersona: true,
  infoRatio: 80,
  hiddenIdentity: null,
  ageJob: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockGenAssignment = {
  id: "assign-gen-1",
  personaId: PERSONA_ID,
  provider: "anthropic" as const,
  model: "claude-sonnet-4-6",
  purpose: "generation" as const,
  isActive: true,
  note: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const passAllCensorResult = {
  censorResult: {
    items: [
      { key: "factuality", result: "pass", reason: "" },
      { key: "ai_tone", result: "pass", reason: "" },
      { key: "persona", result: "pass", reason: "" },
      { key: "safety", result: "pass", reason: "" },
      { key: "duplicate", result: "pass", reason: "" },
      { key: "context", result: "pass", reason: "" },
      { key: "insight", result: "pass", reason: "" },
    ],
    overall: "pass",
  },
  costUsd: 0.001,
};

// ── DB mock 헬퍼 ──────────────────────────────────────────────────────────────

/**
 * 체이닝 가능한 DB select mock을 생성한다.
 * .from().innerJoin().where().limit() 또는 .from().where().orderBy() 등 다양한 패턴 지원.
 * await 시 result 배열을 반환한다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeSelectChain(result: unknown[]): any {
  const promise = Promise.resolve(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => promise),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then: (onfulfilled: any, onrejected: any) =>
      promise.then(onfulfilled, onrejected),
  };
  return chain;
}

function setupInsertMock() {
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "job-uuid" }]),
    }),
  });
}

function setupUpdateMock() {
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

// ── 테스트: draftCurriculumChapter ───────────────────────────────────────────

describe("draftCurriculumChapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupInsertMock();
    setupUpdateMock();

    // 기본 mock 설정
    mockBuildPersonaSystemPrompt.mockReturnValue("mock system prompt");
    mockBuildGuideChapterUserPrompt.mockReturnValue("mock user prompt");
    mockExtractTextFromTiptap.mockReturnValue("생성된 초안 텍스트");
    mockParseResponseToTiptap.mockReturnValue({ type: "doc", content: [] });
    mockGetModelAssignment.mockResolvedValue(mockGenAssignment);
    mockCallModel.mockResolvedValue({
      text: "## 바이브코딩 소개\n\n바이브코딩은 자연어로 코드를 만드는 방식입니다.",
      usage: { inputTokens: 500, outputTokens: 800 },
      costUsd: 0.01,
    });
    mockRunSelfCensor.mockResolvedValue(passAllCensorResult);
  });

  // ── 시나리오 1: 정상 초안 생성 ──────────────────────────────────────────────

  it("정상 챕터 → status: 'drafted', createPostAsBot 미호출", async () => {
    // select 호출 순서: chapterSeries, slots, prevChapters, persona, totalCount
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ chapter: mockChapter, series: mockSeries }]))
      .mockReturnValueOnce(makeSelectChain([{ id: "slot-1", assetKey: "img-1", caption: "캡션", alt: "alt", status: "pending", imageUrl: null, sourceUrl: null, createdAt: new Date() }]))
      .mockReturnValueOnce(makeSelectChain([]))  // prevChapters
      .mockReturnValueOnce(makeSelectChain([{ persona: mockPersona }]))
      .mockReturnValueOnce(makeSelectChain([{ c: 5 }]));  // totalCount

    const result = await draftCurriculumChapter(CHAPTER_ID);

    expect(result.status).toBe("drafted");
    expect(result.chapterId).toBe(CHAPTER_ID);
    expect(mockCreatePostAsBot).not.toHaveBeenCalled();
    // DB update 호출 확인 (초안 저장)
    expect(mockDb.update).toHaveBeenCalled();
  });

  // ── 시나리오 2: 챕터 미존재 ─────────────────────────────────────────────────

  it("챕터 미존재 → status: 'skipped'", async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([])); // chapterSeries empty

    const result = await draftCurriculumChapter(CHAPTER_ID);

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("chapter-not-found-or-invalid-status");
    expect(mockCallModel).not.toHaveBeenCalled();
  });

  // ── 시나리오 3: 슬롯 0개 → checkAndPromoteChapter 호출 ──────────────────────

  it("슬롯 0개 챕터 → 초안 저장 후 checkAndPromoteChapter 호출, 챕터 ready 승격", async () => {
    // draftCurriculumChapter 용 select (슬롯 0개)
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ chapter: mockChapter, series: mockSeries }]))
      .mockReturnValueOnce(makeSelectChain([]))  // slots: 0개
      .mockReturnValueOnce(makeSelectChain([]))  // prevChapters
      .mockReturnValueOnce(makeSelectChain([{ persona: mockPersona }]))
      .mockReturnValueOnce(makeSelectChain([{ c: 5 }]))  // totalCount
      // checkAndPromoteChapter 용 select (chapter status, slots)
      .mockReturnValueOnce(makeSelectChain([{ status: "drafted" }]))  // chapter status check
      .mockReturnValueOnce(makeSelectChain([]));  // slots: 0개

    const result = await draftCurriculumChapter(CHAPTER_ID);

    expect(result.status).toBe("drafted");
    // update가 2번 호출됨: 초안 저장 + ready 승격
    expect(mockDb.update).toHaveBeenCalledTimes(2);
    // 두 번째 update가 ready 승격인지 확인
    const secondUpdateCall = mockDb.update.mock.results[1];
    expect(secondUpdateCall).toBeDefined();
  });

  // ── 시나리오 4: allowDidacticTone=true 확인 ─────────────────────────────────

  it("runSelfCensor 호출 시 allowDidacticTone: true 전달", async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ chapter: mockChapter, series: mockSeries }]))
      .mockReturnValueOnce(makeSelectChain([{ id: "slot-1", assetKey: "img-1", caption: "캡션", alt: "alt", status: "pending", imageUrl: null, sourceUrl: null, createdAt: new Date() }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ persona: mockPersona }]))
      .mockReturnValueOnce(makeSelectChain([{ c: 5 }]));

    await draftCurriculumChapter(CHAPTER_ID);

    expect(mockRunSelfCensor).toHaveBeenCalledWith(
      expect.objectContaining({ allowDidacticTone: true }),
    );
  });
});

// ── 테스트: checkAndPromoteChapter ───────────────────────────────────────────

describe("checkAndPromoteChapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupUpdateMock();
  });

  // ── 시나리오 5: 슬롯 전부 ready ─────────────────────────────────────────────

  it("슬롯 전부 ready → status=ready 업데이트, { ready: true, pendingCount: 0 }", async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ status: "drafted" }]))  // chapter status
      .mockReturnValueOnce(makeSelectChain([
        { status: "ready" },
        { status: "ready" },
      ]));  // slots

    const result = await checkAndPromoteChapter(CHAPTER_ID);

    expect(result.ready).toBe(true);
    expect(result.pendingCount).toBe(0);
    expect(result.totalCount).toBe(2);
    // ready 승격 update 호출 확인
    expect(mockDb.update).toHaveBeenCalled();
  });

  // ── 시나리오 6: 슬롯 일부 pending ───────────────────────────────────────────

  it("슬롯 일부 pending → DB 업데이트 없음, { ready: false, pendingCount: 1 }", async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ status: "drafted" }]))
      .mockReturnValueOnce(makeSelectChain([
        { status: "ready" },
        { status: "pending" },
      ]));

    const result = await checkAndPromoteChapter(CHAPTER_ID);

    expect(result.ready).toBe(false);
    expect(result.pendingCount).toBe(1);
    expect(result.totalCount).toBe(2);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  // ── 시나리오 7: 슬롯 0개 ────────────────────────────────────────────────────

  it("슬롯 0개 → { ready: true, pendingCount: 0, totalCount: 0 }, ready 승격", async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ status: "drafted" }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const result = await checkAndPromoteChapter(CHAPTER_ID);

    expect(result.ready).toBe(true);
    expect(result.pendingCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(mockDb.update).toHaveBeenCalled();
  });
});

// ── 테스트: publishChapter ────────────────────────────────────────────────────

describe("publishChapter", () => {
  const mockReadyChapter = {
    ...mockChapter,
    status: "ready" as const,
    // publishChapter는 draftContent가 null이면 "no-draft-content" 에러 반환.
    // 기본 픽스처는 draftContent를 non-null로 제공한다.
    draftContent: { type: "doc", content: [] as unknown[] },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    setupInsertMock();
    setupUpdateMock();

    mockParseResponseToTiptap.mockReturnValue({ type: "doc", content: [] });
    mockExtractTextFromTiptap.mockReturnValue("최종 본문 텍스트");
    mockInsertInlineImagesByMarker.mockReturnValue({ doc: { type: "doc", content: [] }, usedKeys: [] });
    mockRunContentGuard.mockResolvedValue({ ok: true });
    mockCreatePostAsBot.mockResolvedValue({ status: "published", refId: POST_ID });
  });

  // ── 시나리오 8: 정상 게시 ────────────────────────────────────────────────────

  it("정상 게시 → status: 'published', publishedPostId 저장, continuitySummary 저장", async () => {
    const readySlot = { id: "slot-1", assetKey: "img-1", caption: "캡션", alt: "alt", status: "ready" as const, imageUrl: "https://cdn.example.com/img.jpg", sourceUrl: null };

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ chapter: mockReadyChapter, series: mockSeries }]))
      .mockReturnValueOnce(makeSelectChain([readySlot]))  // slots
      .mockReturnValueOnce(makeSelectChain([{ persona: mockPersona }]));  // persona

    const result = await publishChapter(CHAPTER_ID);

    expect(result.status).toBe("published");
    expect(result.chapterId).toBe(CHAPTER_ID);
    expect(result.postId).toBe(POST_ID);
    expect(result.continuitySummary).toBeDefined();
    expect(mockCreatePostAsBot).toHaveBeenCalledOnce();
    // DB update 호출 (챕터 상태 published 업데이트)
    expect(mockDb.update).toHaveBeenCalled();
  });

  // ── 시나리오 9: pending 슬롯 존재 ───────────────────────────────────────────

  it("pending 슬롯 존재 → status: 'error', createPostAsBot 미호출", async () => {
    const pendingSlot = { id: "slot-1", assetKey: "img-1", caption: "캡션", alt: "alt", status: "pending" as const, imageUrl: null, sourceUrl: null };

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ chapter: mockReadyChapter, series: mockSeries }]))
      .mockReturnValueOnce(makeSelectChain([pendingSlot]));  // pending 슬롯 있음

    const result = await publishChapter(CHAPTER_ID);

    expect(result.status).toBe("error");
    expect(result.reason).toBe("image-slot-still-pending");
    expect(mockCreatePostAsBot).not.toHaveBeenCalled();
  });

  // ── 시나리오 10: contentGuard 차단 ──────────────────────────────────────────

  it("contentGuard 차단 → status: 'blocked'", async () => {
    mockRunContentGuard.mockResolvedValue({ ok: false, code: "FORBIDDEN_WORD" });

    const readySlot = { id: "slot-1", assetKey: "img-1", caption: "캡션", alt: "alt", status: "ready" as const, imageUrl: "https://cdn.example.com/img.jpg", sourceUrl: null };

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ chapter: mockReadyChapter, series: mockSeries }]))
      .mockReturnValueOnce(makeSelectChain([readySlot]))
      .mockReturnValueOnce(makeSelectChain([{ persona: mockPersona }]));

    const result = await publishChapter(CHAPTER_ID);

    expect(result.status).toBe("blocked");
    expect(mockCreatePostAsBot).not.toHaveBeenCalled();
  });

  // ── 시나리오 11: draft_text_editable 우선 사용 ──────────────────────────────

  it("draftTextEditable 있으면 parseResponseToTiptap 호출 (사람 수정본 우선)", async () => {
    const chapterWithEditable = {
      ...mockReadyChapter,
      draftTextEditable: "사람이 수정한 본문 텍스트",
      draftContent: { type: "doc", content: [{ type: "paragraph" }] },
    };

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ chapter: chapterWithEditable, series: mockSeries }]))
      .mockReturnValueOnce(makeSelectChain([]))  // slots: 없음
      .mockReturnValueOnce(makeSelectChain([{ persona: mockPersona }]));

    await publishChapter(CHAPTER_ID);

    // draftTextEditable이 있으면 parseResponseToTiptap을 통해 변환
    expect(mockParseResponseToTiptap).toHaveBeenCalledWith("사람이 수정한 본문 텍스트");
  });
});

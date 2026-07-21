/**
 * 글 생성 파이프라인 vitest 통합 테스트 — Story 11.9
 *
 * 모든 외부 의존성(DB·AI·검색·이미지·contentGuard·write)을 모킹하여
 * 파이프라인의 각 분기(published/blocked/held/discarded/skipped)를 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 모듈 모킹 (hoisted) ────────────────────────────────────────────────────────

const {
  mockDb,
  mockCallModel,
  mockGetModelAssignment,
  mockGroundTopic,
  mockDiscoverTopic,
  mockDiscoverCommunityPost,
  mockDecideImageStrategy,
  mockFetchBotImage,
  mockSearchWebImage,
  mockUploadWebImage,
  mockPrependImageToTiptapDoc,
  mockPrependImageWithSourceToTiptapDoc,
  mockGuardBotContentWithMasking,
  mockCreatePostAsBot,
  mockCreateQuestionAsBot,
  mockCreateResourceAsBot,
  mockSelectTopic,
  mockMarkTopicUsed,
  mockRefillTopicsIfNeeded,
  mockGetDiscoveryQuery,
  mockIsSearchDrivenTopicsEnabled,
  mockGetRecentTopicTitles,
  mockRunSelfCensor,
} = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
  },
  mockCallModel: vi.fn(),
  mockGetModelAssignment: vi.fn(),
  mockGroundTopic: vi.fn(),
  mockDiscoverTopic: vi.fn(),
  mockDiscoverCommunityPost: vi.fn(),
  mockDecideImageStrategy: vi.fn(),
  mockFetchBotImage: vi.fn(),
  mockSearchWebImage: vi.fn(),
  mockUploadWebImage: vi.fn(),
  mockPrependImageToTiptapDoc: vi.fn(),
  mockPrependImageWithSourceToTiptapDoc: vi.fn(),
  mockGuardBotContentWithMasking: vi.fn(),
  mockCreatePostAsBot: vi.fn(),
  mockCreateQuestionAsBot: vi.fn(),
  mockCreateResourceAsBot: vi.fn(),
  mockSelectTopic: vi.fn(),
  mockMarkTopicUsed: vi.fn(),
  mockRefillTopicsIfNeeded: vi.fn(),
  mockGetDiscoveryQuery: vi.fn(),
  mockIsSearchDrivenTopicsEnabled: vi.fn(),
  mockGetRecentTopicTitles: vi.fn(),
  mockRunSelfCensor: vi.fn(),
}));

vi.mock("@ai-jakdang/database", () => ({
  getDb: vi.fn(() => mockDb),
  schema: {
    botGenerationJobs: {},
    botPersonas: {},
    botTopics: {},
    botHoldQueue: {},
    botActivityLog: {},
    botPersonaBoards: {
      personaId: {},
      board: {},
      curationEnabled: {},
      curationWeights: {},
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  asc: vi.fn((col: unknown) => ({ op: "asc", col })),
  count: vi.fn(() => ({ op: "count" })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ op: "inArray", col, vals })),
}));

vi.mock("@ai-jakdang/server-bot/ai", () => ({
  callModel: mockCallModel,
  getModelAssignment: mockGetModelAssignment,
}));

vi.mock("@ai-jakdang/server-bot/search", () => ({
  groundTopic: mockGroundTopic,
  discoverTopic: mockDiscoverTopic,
  discoverCommunityPost: mockDiscoverCommunityPost,
}));

vi.mock("@ai-jakdang/server-bot/image", () => ({
  decideImageStrategy: mockDecideImageStrategy,
  fetchBotImage: mockFetchBotImage,
  searchWebImage: mockSearchWebImage,
  uploadWebImage: mockUploadWebImage,
  prependImageToTiptapDoc: mockPrependImageToTiptapDoc,
  prependImageWithSourceToTiptapDoc: mockPrependImageWithSourceToTiptapDoc,
  genImage: vi.fn().mockResolvedValue(null),
}));

vi.mock("@ai-jakdang/bot-core", () => ({
  buildPersonaSystemPrompt: vi.fn().mockReturnValue("mock system prompt"),
  buildPostUserPrompt: vi.fn().mockReturnValue("mock user prompt"),
  extractTextFromTiptap: vi.fn().mockReturnValue("mock draft text"),
}));

vi.mock("../../services/storage/index.js", () => ({
  uploadImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/image.jpg", filename: "image.jpg" }),
}));

vi.mock("../../middleware/contentGuard.js", () => ({
  guardBotContentWithMasking: mockGuardBotContentWithMasking,
}));

vi.mock("./write.js", () => ({
  createPostAsBot: mockCreatePostAsBot,
  createQuestionAsBot: mockCreateQuestionAsBot,
  createResourceAsBot: mockCreateResourceAsBot,
}));

vi.mock("./topic.js", () => ({
  selectTopic: mockSelectTopic,
  markTopicUsed: mockMarkTopicUsed,
  refillTopicsIfNeeded: mockRefillTopicsIfNeeded,
  getDiscoveryQuery: mockGetDiscoveryQuery,
  isSearchDrivenTopicsEnabled: mockIsSearchDrivenTopicsEnabled,
  getRecentTopicTitles: mockGetRecentTopicTitles,
  recordPublishedTopic: vi.fn(),
}));

vi.mock("./censor.js", () => ({
  runSelfCensor: mockRunSelfCensor,
}));

// 테스트 대상 import
import { runPostPipeline } from "./post-pipeline.js";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

const PERSONA_ID = "persona-uuid-1";
const BOARD = "talk";
const JOB_ID = "job-uuid-1";
const POST_ID = "post-uuid-1";

const mockPersona = {
  id: PERSONA_ID,
  userId: "user-uuid-1",
  nickname: "test_bot",
  personaPrompt: "당신은 봇입니다.",
  tone: "친근한 말투",
  intentionalFlaws: null,
  isAdminPersona: false,
  infoRatio: 60,
  hiddenIdentity: null,
  ageJob: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTopic = {
  id: "topic-uuid-1",
  personaId: PERSONA_ID,
  board: BOARD,
  titleSeed: "Claude Code 활용법",
  topicKind: "fixed" as const,
  status: "unused" as const,
  usedAt: null,
  seriesGroup: null,
  createdAt: new Date(),
};

const mockGenAssignment = {
  id: "assign-gen-1",
  personaId: PERSONA_ID,
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  purpose: "generation",
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
    ],
    overall: "pass",
  },
  costUsd: 0.001,
};

// ── DB mock 설정 헬퍼 ─────────────────────────────────────────────────────────

function setupDbMocks() {
  // insert().values().returning()
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: JOB_ID }]),
    }),
  });

  // update().set().where()
  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });

  // select().from().where().limit()
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([mockPersona]),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  });
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("runPostPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    setupDbMocks();

    // 기본 mock 설정
    mockSelectTopic.mockResolvedValue({ topic: mockTopic, wasRealtime: false });
    mockMarkTopicUsed.mockResolvedValue(undefined);
    mockRefillTopicsIfNeeded.mockResolvedValue(0);
    // 발굴 기본 OFF (기존 시나리오는 고정 시드 경로 유지)
    mockGetDiscoveryQuery.mockReturnValue(null);
    mockIsSearchDrivenTopicsEnabled.mockResolvedValue(false);
    mockGetRecentTopicTitles.mockResolvedValue([]);
    mockDiscoverTopic.mockResolvedValue(null);
    // 커뮤니티 화제글 큐레이션 기본 OFF(발굴 실패=null → 봇 직접 작성 경로 유지)
    mockDiscoverCommunityPost.mockResolvedValue(null);
    mockGetModelAssignment.mockResolvedValue(mockGenAssignment);
    mockCallModel.mockResolvedValue({
      text: "생성된 글 텍스트입니다.",
      usage: { inputTokens: 500, outputTokens: 200 },
      costUsd: 0.005,
    });
    mockGroundTopic.mockResolvedValue({
      facts: ["사실 1", "사실 2"],
      sourceUrls: ["https://example.com"],
      rawSnippetCount: 3,
      confidence: "high",
      costUsd: 0.001,
    });
    mockDecideImageStrategy.mockReturnValue("none");
    mockFetchBotImage.mockResolvedValue({
      imageUrl: null,
      strategy: "none",
      source: null,
      isMeme: false,
    });
    mockPrependImageToTiptapDoc.mockImplementation(
      (doc: Record<string, unknown>) => doc,
    );
    mockGuardBotContentWithMasking.mockResolvedValue({ ok: true, title: "mock title" });
    mockRunSelfCensor.mockResolvedValue(passAllCensorResult);
    mockCreatePostAsBot.mockResolvedValue({ status: "published", refId: POST_ID });
    // 밈 미디어 우선(Step 2.6): 기본 빈손(null) → 기존 폴백 사다리 경로를 그대로 검증
    mockSearchWebImage.mockResolvedValue(null);
    mockUploadWebImage.mockResolvedValue(null);
  });

  // ── 시나리오 1: 정상 게시 (published) ─────────────────────────────────────

  it("검열 통과 → contentGuard 통과 → status: published, markTopicUsed 호출", async () => {
    const result = await runPostPipeline({ personaId: PERSONA_ID, board: BOARD });

    expect(result.status).toBe("published");
    expect(result.jobId).toBe(JOB_ID);
    expect(mockMarkTopicUsed).toHaveBeenCalledWith(
      expect.anything(),
      mockTopic.id,
    );
    expect(mockCreatePostAsBot).toHaveBeenCalledOnce();
  });

  // ── 시나리오 2: contentGuard 스팸 차단 (blocked) ───────────────────────────
  // 금칙어는 이제 마스킹(비차단). 스팸 링크만 하드 차단한다.

  it("검열 통과 → contentGuard 스팸 차단 → status: blocked", async () => {
    mockGuardBotContentWithMasking.mockResolvedValueOnce({
      ok: false,
      code: "SPAM",
      message: "스팸으로 의심되는 내용입니다.",
      reason: "spam_pattern",
    });

    const result = await runPostPipeline({ personaId: PERSONA_ID, board: BOARD });

    expect(result.status).toBe("blocked");
    expect(result.jobId).toBe(JOB_ID);
    expect(mockCreatePostAsBot).not.toHaveBeenCalled();
  });

  // ── 시나리오 3: 검열 ambiguous → held ─────────────────────────────────────

  it("검열 ambiguous → status: held, bot_hold_queue INSERT", async () => {
    mockRunSelfCensor.mockResolvedValueOnce({
      censorResult: {
        items: [{ key: "factuality", result: "ambiguous", reason: "불확실" }],
        overall: "ambiguous",
      },
      costUsd: 0.001,
    });

    const result = await runPostPipeline({ personaId: PERSONA_ID, board: BOARD });

    expect(result.status).toBe("held");
    expect(result.jobId).toBe(JOB_ID);
    // bot_hold_queue INSERT 호출 확인
    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({}),
    );
  });

  // ── 시나리오 4: 검열 fail 3회 → discarded ─────────────────────────────────

  it("검열 fail 3회 초과 → status: discarded", async () => {
    mockRunSelfCensor.mockResolvedValue({
      censorResult: {
        items: [{ key: "ai_tone", result: "fail", reason: "AI 티 명확" }],
        overall: "fail",
      },
      costUsd: 0.001,
    });

    const result = await runPostPipeline({ personaId: PERSONA_ID, board: BOARD });

    expect(result.status).toBe("discarded");
    expect(result.jobId).toBe(JOB_ID);
    // 4회 callModel 호출 (1 초기 + 3 재생성)
    expect(mockCallModel).toHaveBeenCalledTimes(4);
  });

  // ── 시나리오 5: 검열 fail 1회 → pass → published ──────────────────────────

  it("검열 fail 1회 후 pass → status: published, regen 1회", async () => {
    mockRunSelfCensor
      .mockResolvedValueOnce({
        censorResult: { items: [], overall: "fail" },
        costUsd: 0.001,
      })
      .mockResolvedValueOnce(passAllCensorResult);

    const result = await runPostPipeline({ personaId: PERSONA_ID, board: BOARD });

    expect(result.status).toBe("published");
    expect(mockCallModel).toHaveBeenCalledTimes(2); // 2회 생성 모델 호출
  });

  // ── 시나리오 6: 주제 없음 → skipped ──────────────────────────────────────

  it("주제 없음 → status: skipped", async () => {
    mockSelectTopic.mockResolvedValueOnce(null);

    const result = await runPostPipeline({ personaId: PERSONA_ID, board: BOARD });

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("no-topic");
    expect(mockCallModel).not.toHaveBeenCalled();
  });

  // ── 시나리오 7: notices 게시판 → skipped ─────────────────────────────────

  it("board='notices' → 공지사항 가드로 즉시 skipped", async () => {
    const result = await runPostPipeline({
      personaId: PERSONA_ID,
      board: "notices",
    });

    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("notices-board-forbidden");
    expect(mockSelectTopic).not.toHaveBeenCalled();
  });

  // ── 시나리오 8: 관리자 페르소나 + series_group → AI 이미지 강제 ────────────

  it("is_admin_persona=true → imageStrategy='ai' 강제, intensity='full' 강제", async () => {
    const adminPersona = { ...mockPersona, isAdminPersona: true };

    // select().from().where().limit() → 관리자 페르소나 반환
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([adminPersona]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const adminTopic = { ...mockTopic, seriesGroup: "AI 개발 시리즈" };
    mockSelectTopic.mockResolvedValueOnce({ topic: adminTopic, wasRealtime: false });

    // count() 쿼리도 있음
    // select 호출 순서:
    //   1) 페르소나 조회 (Step 1): .where().limit()
    //   2) 큐레이션 설정 조회 (Step 2.5, 13.8): .where().limit() → 관리자라 curation null
    //   3) 연재 에피소드 수 집계 (Step 7): await ...where() (limit 없음) → where()가 Promise
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([adminPersona]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ c: 0 }]),
        }),
      });

    await runPostPipeline({ personaId: PERSONA_ID, board: BOARD });

    // groundTopic이 full intensity로 호출됨 확인
    expect(mockGroundTopic).toHaveBeenCalledWith(
      adminTopic.titleSeed,
      "full",
      expect.anything(),
    );
  });

  // ── 시나리오 9: 자동 보충 임계 이하 → refillTopicsIfNeeded 호출 ───────────

  it("파이프라인 종료 후 refillTopicsIfNeeded가 fire-and-forget으로 호출된다", async () => {
    await runPostPipeline({ personaId: PERSONA_ID, board: BOARD });

    expect(mockRefillTopicsIfNeeded).toHaveBeenCalledWith(
      expect.anything(),
      PERSONA_ID,
    );
  });

  // ── Q&A 게시판 → createQuestionAsBot 경유 ─────────────────────────────────

  it("board='qna' → createQuestionAsBot 호출", async () => {
    const qnaTopic = { ...mockTopic, board: "qna" };
    mockSelectTopic.mockResolvedValueOnce({ topic: qnaTopic, wasRealtime: false });
    mockCreateQuestionAsBot.mockResolvedValueOnce({
      status: "published",
      refId: "question-uuid-1",
    });

    const result = await runPostPipeline({ personaId: PERSONA_ID, board: "qna" });

    expect(mockCreateQuestionAsBot).toHaveBeenCalledOnce();
    expect(mockCreatePostAsBot).not.toHaveBeenCalled();
    expect(result.status).toBe("published");
  });

  // ── wasRealtime=true → markTopicUsed 미호출 ──────────────────────────────

  it("wasRealtime=true → markTopicUsed를 호출하지 않는다", async () => {
    const realtimeTopic = { ...mockTopic, id: "realtime-fake", topicKind: "realtime" as const };
    mockSelectTopic.mockResolvedValueOnce({ topic: realtimeTopic, wasRealtime: true });

    await runPostPipeline({
      personaId: PERSONA_ID,
      board: BOARD,
      realtimeTopic: "실시간 주제 텍스트",
    });

    expect(mockMarkTopicUsed).not.toHaveBeenCalled();
  });

  // ── 시나리오 12: 밈 큐레이션 미디어 우선 (Step 2.6) ────────────────────────

  it("밈 큐레이션(미디어 우선): 밈을 먼저 찾으면 주제 풀 없이 발행 + 찾아둔 밈 첨부", async () => {
    // 1번째 select=페르소나, 2번째 select=게시판 큐레이션 설정(밈 100%로 고정해 랜덤 제거)
    const personaChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockPersona]),
        }),
      }),
    };
    const curationChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { curationEnabled: true, curationWeights: { youtube: 0, meme: 100, ai: 0 } },
          ]),
        }),
      }),
    };
    mockDb.select
      .mockReturnValueOnce(personaChain)
      .mockReturnValueOnce(curationChain);

    const meme = {
      url: "https://img.example.com/meme.jpg",
      sourcePageUrl: "https://community.example.com/post/1",
      sourceLabel: "community.example.com",
      alt: "AI가 만든 웃긴 밈",
    };
    mockSearchWebImage.mockResolvedValue(meme);
    mockUploadWebImage.mockResolvedValue({
      imageUrl: "https://cdn.example.com/meme-uploaded.jpg",
      source: { label: meme.sourceLabel, url: meme.sourcePageUrl },
    });
    mockSelectTopic.mockResolvedValue(null); // 주제 풀 완전 고갈 상황

    // 밈 큐레이션은 ai-creation 같은 큐레이션 보드에서 동작한다.
    // (talk 보드는 이제 유튜브/밈이 아니라 '커뮤니티 화제글 큐레이션'으로 분기하므로 여기선 쓰지 않는다.)
    const result = await runPostPipeline({ personaId: PERSONA_ID, board: "ai-creation" });

    expect(result.status).toBe("published");
    expect(mockSelectTopic).not.toHaveBeenCalled(); // 풀 의존 없음
    expect(mockDiscoverTopic).not.toHaveBeenCalled(); // 소재 확보 시 발굴 생략
    expect(mockUploadWebImage).toHaveBeenCalledWith(meme, expect.anything());
    expect(mockFetchBotImage).not.toHaveBeenCalled(); // 게시 시점 재검색 없음
    expect(mockPrependImageWithSourceToTiptapDoc).toHaveBeenCalledWith(
      expect.anything(),
      "https://cdn.example.com/meme-uploaded.jpg",
      expect.objectContaining({ sourceUrl: meme.sourcePageUrl }),
    );
  });

  // ── 시나리오 13: 작당 수다방 커뮤니티 화제글 큐레이션 (Step 2.8) ──────────────
  it("작당 수다방: 커뮤니티 화제글을 발굴하면 주제 풀·발굴 없이 발행한다", async () => {
    const personaChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockPersona]),
        }),
      }),
    };
    // talk 보드 curation 설정 행(enabled:true) — 명시적 off가 아니면 기본 동작.
    const curationChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ curationEnabled: true, curationWeights: null }]),
        }),
      }),
    };
    mockDb.select.mockReturnValueOnce(personaChain).mockReturnValueOnce(curationChain);

    // 커뮤니티 화제글 큐레이션은 검색주도 토픽 게이트를 함께 본다.
    mockIsSearchDrivenTopicsEnabled.mockResolvedValue(true);
    mockDiscoverCommunityPost.mockResolvedValue({
      site: "디시인사이드",
      originalTitle: "알바 10번 짤려본 사람이 쓴 직장내 폐급 특징",
      sourceUrl: "https://gall.dcinside.com/board/view/?id=dcbest&no=447146",
      titleSeed: "요즘 디시에서 화제인 직장 폐급 특징 글",
      angle: "직장인 공감 화제글",
      grounding: { facts: ["디시인사이드에서 화제인 글"], sourceUrls: ["https://gall.dcinside.com/board/view/?id=dcbest&no=447146"], rawSnippetCount: 1, confidence: "medium", costUsd: 0 },
    });
    mockSelectTopic.mockResolvedValue(null); // 주제 풀 고갈이어도 큐레이션으로 발행

    const result = await runPostPipeline({ personaId: PERSONA_ID, board: "talk" });

    expect(result.status).toBe("published");
    expect(mockDiscoverCommunityPost).toHaveBeenCalled();
    expect(mockDiscoverTopic).not.toHaveBeenCalled(); // 커뮤니티 소재 확보 시 일반 발굴 생략
    expect(mockSelectTopic).not.toHaveBeenCalled(); // 주제 풀 의존 없음
    expect(mockCreatePostAsBot).toHaveBeenCalledWith(
      expect.objectContaining({
        postInput: expect.objectContaining({ board: "talk" }),
      }),
    );
  });
});

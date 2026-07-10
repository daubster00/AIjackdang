/**
 * 글 생성 파이프라인 — Story 11.9
 *
 * runPostPipeline: 주제 선정 → 그라운딩 → 글 생성 → 자기검열 → 분기 → 게시/보류/폐기.
 *
 * 단계:
 *  0) 공지사항 가드 (notices 게시판 즉시 skip)
 *  1) 페르소나 조회
 *  2) 생성 모델 조회
 *  2.5) AI 창작마당 큐레이션(퍼오기) 결정
 *  2.6) 밈 미디어 우선 — 밈 이미지를 먼저 검색해 소재로 확보 (meme 모드)
 *  3) 검색 주도 주제 발굴 (discoverTopic) — 큐레이션 소재 확보 시 생략
 *  4) 주제 확정 (큐레이션 영상/밈 → 발굴 → 고정 시드 → 실시간 폴백)
 *  5) 생성 잡 레코드 생성 (bot_generation_jobs)
 *  6) 검색·그라운딩 (groundTopic, intensity 분기)
 *  6b) 이미지 전략 결정 (decideImageStrategy + 관리자 override)
 *  7) 관리자 연재 컨텍스트 조회 (series_group)
 *  8~10) 생성 루프 (재생성 MAX_REGEN=3):
 *        → 생성 모델 callModel → Tiptap 변환 → 자기검열 → 분기
 *  11) 자동 보충 fire-and-forget
 *
 * 커리큘럼 강의 경로(Story 13.3 이전의 Step 2.6)는 이 파이프라인에서 분리됐다.
 * 커리큘럼 챕터의 초안 생성 · 준비완료 판정 · 게시 실행은
 * apps/api/src/services/bot/curriculum-staging.ts에서 담당한다.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md §7 글 생성 파이프라인]
 * [Source: docs/seeding-bot/PRD.md FR-SB-5.1~5.5]
 */

import { eq, and, inArray, count } from "drizzle-orm";
import { getDb, schema } from "@ai-jakdang/database";
import type { Database } from "@ai-jakdang/database";
import { callModel, getModelAssignment } from "@ai-jakdang/server-bot/ai";
import { groundTopic, discoverTopic, searchYoutubeVideo, discoverResource } from "@ai-jakdang/server-bot/search";
import type { FactGrounding, DiscoveredTopic, CuratedVideo, ResourceType, CuratedFileSource } from "@ai-jakdang/server-bot/search";
import {
  decideImageStrategy,
  fetchBotImage,
  searchWebImage,
  uploadWebImage,
  prependYoutubeToTiptapDoc,
  prependImageWithSourceToTiptapDoc,
  insertInlineImagesByMarker,
  genImage,
  planImagesForPost,
} from "@ai-jakdang/server-bot/image";
import type {
  PostKind,
  ImageStrategy,
  ImageStrategyOptions,
  GuideAssetManifest,
  PostImagePlan,
  WebImage,
} from "@ai-jakdang/server-bot/image";
import {
  buildPersonaSystemPrompt,
  buildPostUserPrompt,
  extractTextFromTiptap,
} from "@ai-jakdang/bot-core";
import type {
  BotPersonaForPrompt,
  CurationContext,
  FactSummary,
  ResourceCurationContext,
  RevisionContext,
  SeriesContext,
  TiptapNode,
} from "@ai-jakdang/bot-core";
import {
  decideCurationMode,
  curationVideoQuery,
  curationMemeQuery,
  checkCurationCopyrightRisk,
  type CurationMode,
  type BoardCurationConfig,
} from "./curation.js";
import { uploadImage } from "../../services/storage/index.js";
import { guardBotContentWithMasking } from "../../middleware/contentGuard.js";
import {
  createPostAsBot,
  createQuestionAsBot,
  createResourceAsBot,
} from "./write.js";
import {
  selectTopic,
  markTopicUsed,
  refillTopicsIfNeeded,
  getDiscoveryQuery,
  isSearchDrivenTopicsEnabled,
  getRecentTopicTitles,
  recordPublishedTopic,
} from "./topic.js";
import type { BotTopicRow } from "./topic.js";
import { runSelfCensor } from "./censor.js";
import { parseResponseToTiptap, parseMarkdownLines } from "./_tiptap-parser.js";

// ── 공개 타입 ─────────────────────────────────────────────────────────────────

export interface RunPostPipelineInput {
  personaId: string;
  /** 대상 게시판 슬러그 */
  board: string;
  /** 외부 실시간 주제 (오케스트레이터에서 주입, 선택) */
  realtimeTopic?: string;
  /** 관리자 연재 그룹 강제 지정 (선택) */
  forceSeriesGroup?: string;
}

export type PostPipelineStatus =
  | "published"
  | "blocked"
  | "held"
  | "discarded"
  | "skipped"
  | "error";

export interface PostPipelineResult {
  status: PostPipelineStatus;
  jobId?: string;
  postId?: string;
  reason?: string;
}

// ── 내부 상수 ─────────────────────────────────────────────────────────────────

const MAX_REGEN = 3;

// ── logActivity ───────────────────────────────────────────────────────────────

async function logActivity(
  db: Database,
  personaId: string,
  eventType:
    | "post.published"
    | "comment.published"
    | "held"
    | "blocked"
    | "regenerated"
    | "skipped"
    | "cost"
    | "discarded"
    | "planned",
  refId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(schema.botActivityLog).values({
      personaId,
      eventType,
      refId: refId ?? undefined,
      payload,
    });
  } catch (err) {
    // best-effort: 로그 실패는 파이프라인을 막지 않는다
    console.error("[post-pipeline] logActivity 실패 (무시):", (err as Error).message);
  }
}

// ── generateTitle ─────────────────────────────────────────────────────────────

/**
 * 본문 평문에서 제목을 유도 — titleSeed가 비어 있을 때의 최후 폴백.
 * 첫 비어있지 않은 줄의 첫 문장(최대 45자)을 제목으로 쓴다.
 */
function deriveTitleFromText(text: string): string {
  const firstLine = text
    .split(/\n+/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return "제목 없는 글";
  const sentence = firstLine.split(/(?<=[.!?。…])\s/)[0] ?? firstLine;
  const t = sentence.replace(/^[#>\-*\s]+/, "").trim();
  if (!t) return "제목 없는 글";
  return t.length > 45 ? `${t.slice(0, 45)}…` : t;
}

/**
 * 게시글 제목을 결정한다 — **항상 비어있지 않은 제목을 보장**한다.
 * 1) 시리즈(연재) 글이면 "그룹명 — 제N편".
 * 2) titleSeed(주제 씨앗)가 있으면 그대로.
 * 3) 둘 다 없으면 본문 평문(fallbackText)에서 유도.
 * (사용자 정책: 모든 봇 글은 제목이 무조건 존재해야 한다.)
 */
function generateTitle(
  titleSeed: string,
  seriesContext?: SeriesContext,
  fallbackText?: string,
): string {
  if (seriesContext) {
    return `${seriesContext.groupTitle} — 제${seriesContext.episodeIndex}편`;
  }
  const seed = titleSeed?.trim();
  // 운영자가 긴 설명형 주제를 강제 주입(realtimeTopic)하면 그게 그대로 제목·슬러그가 돼
  // 제목이 과도하게 길고 슬러그가 깨진다(특수문자·초장문). 60자 초과 시드는 제목으로 쓰지 않고
  // 본문 첫 문장에서 간결한 제목을 유도한다(유도 실패 시에만 시드를 잘라 폴백).
  if (seed && seed.length <= 60) return seed;
  if (seed) {
    return fallbackText ? deriveTitleFromText(fallbackText) : `${seed.slice(0, 45)}…`;
  }
  return fallbackText ? deriveTitleFromText(fallbackText) : "제목 없는 글";
}

// ── adaptGrounding ────────────────────────────────────────────────────────────

function adaptGrounding(groundingResult: FactGrounding | null): FactSummary {
  if (!groundingResult) {
    return { facts: [], sourceUrls: [], confidence: "low" };
  }
  return {
    facts: groundingResult.facts,
    sourceUrls: groundingResult.sourceUrls,
    confidence: groundingResult.confidence,
  };
}

// ── runPostPipeline ───────────────────────────────────────────────────────────

export async function runPostPipeline(
  input: RunPostPipelineInput,
): Promise<PostPipelineResult> {
  const { personaId, board } = input;
  const db = getDb();

  // ── Step 0: 공지사항 게시판 이중 차단 ────────────────────────────────────────
  if (board === "notices") {
    await logActivity(db, personaId, "skipped", null, {
      reason: "notices-board-forbidden",
    });
    return { status: "skipped", reason: "notices-board-forbidden" };
  }

  // ── Step 1: 페르소나 조회 (주제 발굴보다 먼저 필요) ────────────────────────────
  const personaRows = await db
    .select()
    .from(schema.botPersonas)
    .where(eq(schema.botPersonas.id, personaId))
    .limit(1);

  const persona = personaRows[0];
  if (!persona) {
    await logActivity(db, personaId, "skipped", null, { reason: "persona-not-found" });
    return { status: "skipped", reason: "persona-not-found" };
  }

  const isAdminPersona = persona.isAdminPersona;
  const internalPostKind: "info" | "chat" | "guide" = isAdminPersona
    ? "guide"
    : persona.infoRatio >= 50
      ? "info"
      : "chat";

  const personaForPrompt: BotPersonaForPrompt = {
    nickname: persona.nickname,
    personaPrompt: persona.personaPrompt,
    tone: persona.tone,
    intentionalFlaws: persona.intentionalFlaws,
    isAdminPersona: persona.isAdminPersona,
    infoRatio: persona.infoRatio,
  };

  // ── Step 2: 생성 모델 조회 (발굴·그라운딩·생성 공용) ───────────────────────────
  const genAssignment = await getModelAssignment(db, personaId, "generation");
  if (!genAssignment) {
    await logActivity(db, personaId, "skipped", null, { reason: "no-generation-model" });
    return { status: "skipped", reason: "no-generation-model" };
  }

  // BotModelAssignmentRow(createdAt: Date)를 BotModelAssignment(createdAt: string)로 변환
  const genAssignmentForGrounding = {
    ...genAssignment,
    createdAt: genAssignment.createdAt.toISOString(),
    updatedAt: genAssignment.updatedAt.toISOString(),
  };

  // 이미지 생성 모델 할당(active만 반환). 미지정 시 genImage가 기본값(구글 gemini-3.1-flash-image)으로 폴백.
  const imageAssignment = await getModelAssignment(db, personaId, "image");
  const imageModel = imageAssignment
    ? { provider: imageAssignment.provider, model: imageAssignment.model }
    : undefined;

  let groundingCost = 0;

  // ── Step 2.5: 큐레이션(퍼오기) 설정 조회 + 모드 결정 ─────────────────────────
  // bot_persona_boards에서 (personaId, board) 행의 curation_enabled·curation_weights 조회.
  // 설정 기반 판단으로 ai-creation 하드코딩을 제거하고 모든 게시판에 퍼오기 설정 가능.
  const isResourceBoard = board.startsWith("resource:");
  const boardCurationRows = await db
    .select({
      curationEnabled: schema.botPersonaBoards.curationEnabled,
      curationWeights: schema.botPersonaBoards.curationWeights,
    })
    .from(schema.botPersonaBoards)
    .where(
      and(
        eq(schema.botPersonaBoards.personaId, personaId),
        eq(schema.botPersonaBoards.board, board),
      ),
    )
    .limit(1);

  let curationRow = boardCurationRows[0] ?? null;

  // 자료 보드는 dailyPlan에서 "resource"(제네릭) → "resource:<유형>"으로 확장돼 도착할 수 있다.
  // 확장된 board 행이 없으면 제네릭 "resource" 행 설정도 폴백 조회한다
  // (관리자가 제네릭 자료·특정 유형 중 무엇으로 배정했든 퍼오기 설정이 존중되도록).
  if (!curationRow && isResourceBoard) {
    const genericRows = await db
      .select({
        curationEnabled: schema.botPersonaBoards.curationEnabled,
        curationWeights: schema.botPersonaBoards.curationWeights,
      })
      .from(schema.botPersonaBoards)
      .where(
        and(
          eq(schema.botPersonaBoards.personaId, personaId),
          eq(schema.botPersonaBoards.board, "resource"),
        ),
      )
      .limit(1);
    curationRow = genericRows[0] ?? null;
  }

  const boardCurationConfig: BoardCurationConfig | null = curationRow
    ? {
        enabled: curationRow.curationEnabled,
        weights: (curationRow.curationWeights as Partial<Record<CurationMode, number>> | null) ?? undefined,
      }
    : null;

  // 자료 보드에서 퍼오기를 켜면 유튜브/밈/AI가 아니라 "실물 자료 큐레이션"으로 간다.
  // 따라서 자료 보드는 decideCurationMode(유튜브/밈/AI)를 적용하지 않는다.
  // ⚠️ 실물 자료 큐레이션은 유튜브/밈 퍼오기와 성격이 다르다(신뢰받는 실제 자료를 출처와
  //    함께 소개). 운영자 봇(isAdminPersona)에게도 자연스러운 동작이므로 admin 차단을 두지
  //    않고, 관리자가 켠 curation_enabled 토글을 그대로 존중한다.
  //    (유튜브/밈 퍼오기의 admin 차단은 decideCurationMode에 그대로 유지된다.)
  const resourceCurationEnabled =
    isResourceBoard && (boardCurationConfig?.enabled ?? false);
  const curationMode = isResourceBoard
    ? null
    : decideCurationMode(board, isAdminPersona, boardCurationConfig);
  let curatedVideo: CuratedVideo | null = null;
  if (curationMode === "youtube") {
    curatedVideo = await searchYoutubeVideo(curationVideoQuery());
    if (curatedVideo) {
      await logActivity(db, personaId, "planned", null, {
        reason: "curation-youtube",
        videoUrl: curatedVideo.url,
        videoTitle: curatedVideo.title,
      });
    }
  }
  // 유튜브 영상을 못 구하면 밈 퍼오기로 폴백(빈손 skip 방지).
  const effectiveCuration: CurationMode | null =
    curationMode === "youtube" && !curatedVideo ? "meme" : curationMode;

  // ── Step 2.6: 밈 미디어 우선 — 밈 이미지를 먼저 찾고, 찾은 밈 자체를 글감으로 쓴다 ──
  // 유튜브 모드(영상=글감)와 같은 구조. 주제 풀·발굴 없이도 밈 소개글이 성립하므로
  // 발굴 제외 게시판(ai-creation 등)에서 주제 풀이 비어도 no-topic으로 죽지 않는다.
  // 유료 스톡 출처는 소재로 쓰지 않는다(저작권 위험 후보는 폐기 → 기존 폴백 사다리로 진행).
  let curatedMeme: WebImage | null = null;
  if (effectiveCuration === "meme") {
    curatedMeme = await searchWebImage(curationMemeQuery(persona.nickname));
    if (curatedMeme && checkCurationCopyrightRisk(curatedMeme.sourcePageUrl)) {
      curatedMeme = null;
    }
    if (curatedMeme) {
      await logActivity(db, personaId, "planned", null, {
        reason: "curation-meme",
        memeTitle: curatedMeme.alt,
        sourceUrl: curatedMeme.sourcePageUrl,
      });
    }
  }

  // ── Step 2.7: 실전자료 큐레이션 — 실물 자료 검색·소개 ────────────────────────
  // 자료 보드에서 퍼오기(실물 자료 큐레이션)를 켜면, 봇이 자료를 창작하는 대신
  // 실제로 널리 쓰이는 자료 하나를 검색해 "출처와 함께 소개"하는 글을 쓴다.
  // 발굴 실패(검색 무결과·유효 출처 없음) 시 resourceCuration=null → 기존 봇 직접 작성 경로로 폴백.
  let resourceCuration: ResourceCurationContext | null = null;
  let resourceCurationGrounding: FactGrounding | null = null;
  let resourceCurationTitleSeed = "";
  let resourceCurationFileSource: CuratedFileSource | null = null;
  if (resourceCurationEnabled && (await isSearchDrivenTopicsEnabled(db))) {
    const resourceType = board.slice("resource:".length) as ResourceType;
    try {
      const existingTitles = await getRecentTopicTitles(db, personaId, 20);
      const found = await discoverResource(resourceType, {
        modelAssignment: genAssignmentForGrounding,
        callModel: (assignment, prompt) => callModel(assignment, prompt),
        onCostAccumulated: async (costUsd) => {
          groundingCost += costUsd;
        },
        existingTitles,
      });
      if (found) {
        resourceCuration = {
          resourceType,
          name: found.name,
          sourceUrl: found.sourceUrl,
          sourceLabel: found.sourceLabel,
          whyPopular: found.whyPopular || undefined,
        };
        // grounding을 별도 보관해 Step 6에서 재검색 없이 재사용.
        resourceCurationGrounding = found.grounding;
        resourceCurationTitleSeed = found.titleSeed;
        // 발굴한 자료의 원본 파일 소스(GitHub 저장소 등) — 자료 작성 시 첨부에 사용.
        resourceCurationFileSource = found.fileSource;
        await logActivity(db, personaId, "planned", null, {
          reason: "resource-curation",
          resourceType,
          name: found.name,
          sourceUrl: found.sourceUrl,
          fileSource: found.fileSource?.label ?? null,
        });
      }
    } catch (err) {
      console.error(
        "[post-pipeline] 실전자료 큐레이션 발굴 실패 (봇 직접 작성으로 폴백):",
        (err as Error).message,
      );
      resourceCuration = null;
    }
  }

  // ── Step 3: 검색 주도 주제 발굴 ───────────────────────────────────────────────
  // "주제를 미리 정하지 않고" 최근 소식을 먼저 검색해 신선한 글감을 만든다.
  // 발굴 대상 게시판(getDiscoveryQuery)이면 정보형·잡담·질문 톤 모두 발굴한다.
  // (커리큘럼 경로가 파이프라인에서 분리됐으므로 guideSeries 조건은 더 이상 없다.)
  let discovered: DiscoveredTopic | null = null;
  const discoveryQuery = getDiscoveryQuery(persona.nickname, board);
  const wantsDiscovery = discoveryQuery !== null;

  // 페르소나 성격·게시판에 맞춘 글감 톤 지침.
  const discoveryStyleHint =
    internalPostKind === "guide"
      ? "정확하고 깊이 있는 가이드/정보 전달용 주제."
      : board === "ai-creation"
        ? "AI 창작(이미지·영상·음악) 쪽에서 요즘 화제인 결과물·모델·기법 소재. 직접 만들어 보여주거나 가볍게 소개하며 떠들기 좋은 것."
        : board === "qna"
          ? "초보자가 최근 소식·이슈에 대해 실제로 궁금해할 만한 '질문' 형태의 구체적 제목(물음표로 끝냄)."
          : internalPostKind === "info"
            ? "실무에 바로 쓸 만한 정보형 커뮤니티 글 주제."
            : "가볍고 캐주얼한 잡담·리액션 톤의 주제. 최근 화제나 밈처럼 편하게 떠들 만한 것.";

  // 큐레이션 소재(영상/밈)가 이미 확보됐으면 발굴 생략 — Step 4에서 어차피 큐레이션이 우선이라
  // 발굴 결과는 버려지므로 검색·모델 비용만 아낀다.
  // 운영자가 realtimeTopic을 명시 주입한 수동 트리거는 그 주제를 강제하므로 발굴을 건너뛴다
  // (발굴이 돌면 봇이 자기 주제를 뽑아 주입 주제를 덮어써 버린다).
  if (!input.realtimeTopic && !curatedVideo && !curatedMeme && !resourceCuration && wantsDiscovery && (await isSearchDrivenTopicsEnabled(db))) {
    try {
      const existingTitles = await getRecentTopicTitles(db, personaId, 20);
      discovered = await discoverTopic(discoveryQuery, board, {
        modelAssignment: genAssignmentForGrounding,
        callModel: (assignment, prompt) => callModel(assignment, prompt),
        onCostAccumulated: async (costUsd) => {
          groundingCost += costUsd;
        },
        existingTitles,
        styleHint: discoveryStyleHint,
      });
    } catch (err) {
      console.error("[post-pipeline] 주제 발굴 실패 (고정 시드로 폴백):", (err as Error).message);
      discovered = null;
    }
  }

  // ── Step 4: 주제 확정 (큐레이션 영상/밈 → 발굴 → 고정 시드 → 실시간 폴백) ────────
  let topicResult: { topic: BotTopicRow; wasRealtime: boolean };
  if (curatedVideo) {
    // 유튜브 큐레이션: 영상 자체가 소재이므로 시드 주제가 필요 없다(제목=영상 제목).
    const videoTopic: BotTopicRow = {
      id: `curated-${Date.now()}`,
      personaId,
      board,
      titleSeed: curatedVideo.title,
      topicKind: "realtime",
      status: "unused",
      usedAt: null,
      seriesGroup: null,
      postId: null,
      createdAt: new Date(),
    };
    topicResult = { topic: videoTopic, wasRealtime: true };
  } else if (curatedMeme) {
    // 밈 큐레이션(미디어 우선): 찾은 밈 자체가 소재이므로 시드 주제가 필요 없다(제목=검색 결과 제목).
    const memeTopic: BotTopicRow = {
      id: `curated-meme-${Date.now()}`,
      personaId,
      board,
      titleSeed: curatedMeme.alt ?? "요즘 화제인 AI 밈",
      topicKind: "realtime",
      status: "unused",
      usedAt: null,
      seriesGroup: null,
      postId: null,
      createdAt: new Date(),
    };
    topicResult = { topic: memeTopic, wasRealtime: true };
  } else if (resourceCuration) {
    // 실전자료 큐레이션: 발굴한 실제 자료가 소재이므로 시드 주제가 필요 없다(제목=발굴 제목).
    const resourceTopic: BotTopicRow = {
      id: `curated-resource-${Date.now()}`,
      personaId,
      board,
      titleSeed: resourceCurationTitleSeed || resourceCuration.name,
      topicKind: "realtime",
      status: "unused",
      usedAt: null,
      seriesGroup: null,
      postId: null,
      createdAt: new Date(),
    };
    topicResult = { topic: resourceTopic, wasRealtime: true };
  } else if (input.realtimeTopic) {
    // 운영자 강제 주제(수동 트리거): 발굴·주제풀보다 우선. 이 주제로 곧장 그라운딩·생성한다.
    const forcedTopic: BotTopicRow = {
      id: `forced-${Date.now()}`,
      personaId,
      board,
      titleSeed: input.realtimeTopic,
      topicKind: "realtime",
      status: "unused",
      usedAt: null,
      seriesGroup: null,
      postId: null,
      createdAt: new Date(),
    };
    topicResult = { topic: forcedTopic, wasRealtime: true };
    await logActivity(db, personaId, "planned", null, {
      reason: "forced-topic",
      titleSeed: input.realtimeTopic,
    });
  } else if (discovered) {
    const syntheticTopic: BotTopicRow = {
      id: `discovered-${Date.now()}`,
      personaId,
      board,
      titleSeed: discovered.titleSeed,
      topicKind: "realtime",
      status: "unused",
      usedAt: null,
      seriesGroup: null,
      postId: null,
      createdAt: new Date(),
    };
    topicResult = { topic: syntheticTopic, wasRealtime: true };
    await logActivity(db, personaId, "planned", null, {
      reason: "topic-discovered",
      titleSeed: discovered.titleSeed,
      angle: discovered.angle,
    });
  } else {
    const selected = await selectTopic(db, personaId, board, input.realtimeTopic);
    if (!selected) {
      await logActivity(db, personaId, "skipped", null, { reason: "no-topic" });
      return { status: "skipped", reason: "no-topic" };
    }
    topicResult = selected;
    // 주제 선점 (wasRealtime=false인 경우만)
    if (!selected.wasRealtime) {
      await markTopicUsed(db, selected.topic.id);
    }
  }

  // ── Step 5: 생성 잡 레코드 생성 ───────────────────────────────────────────────
  // board 종류로 job_kind와 게시 함수를 분기 (#6 정합)
  const jobKind: "post" | "question" | "resource" =
    board === "qna"
      ? "question"
      : board.startsWith("resource:")
        ? "resource"
        : "post";

  const jobRows = await db
    .insert(schema.botGenerationJobs)
    .values({
      personaId,
      jobKind,
      targetBoard: board,
      topicId: topicResult.wasRealtime ? undefined : topicResult.topic.id,
      status: "pending",
      regenCount: 0,
    })
    .returning({ id: schema.botGenerationJobs.id });

  const jobId = jobRows[0]?.id;
  if (!jobId) {
    return { status: "error", reason: "failed-to-create-job" };
  }

  // ── Step 6: 검색·그라운딩 (발굴했으면 그 근거 재사용, 아니면 새로 검색) ──────────
  let facts: FactSummary;
  if (resourceCuration && resourceCurationGrounding) {
    // 실전자료 큐레이션 발굴 단계에서 이미 검색·근거를 확보했으므로 재검색하지 않는다.
    facts = adaptGrounding(resourceCurationGrounding);
  } else if (discovered) {
    // 발굴 단계에서 이미 검색·근거를 확보했으므로 재검색하지 않는다.
    facts = adaptGrounding(discovered.grounding);
  } else {
    const intensity: "full" | "light" | "none" =
      internalPostKind === "guide" || internalPostKind === "info"
        ? "full"
        : persona.infoRatio >= 30
          ? "light"
          : "none";

    const groundingResult = await groundTopic(
      topicResult.topic.titleSeed,
      intensity,
      {
        modelAssignment: genAssignmentForGrounding,
        callModel: (assignment, prompt) => callModel(assignment, prompt),
        onCostAccumulated: async (costUsd) => {
          groundingCost += costUsd;
        },
      },
    );
    facts = adaptGrounding(groundingResult);
  }

  // ── Step 6b: 이미지 전략 결정 ─────────────────────────────────────────────────
  const imagePostKind: PostKind = jobKind === "question" ? "qna" : "post";
  const personaContext = {
    nickname: persona.nickname,
    is_admin_persona: isAdminPersona,
    info_ratio: persona.infoRatio,
  };
  // 발굴로 실제 소재(제품/기능)가 있으면 웹 검색 이미지(출처 표기)를 우선한다.
  const imageStrategyOptions: ImageStrategyOptions = { preferWeb: discovered !== null };
  // decideImageStrategy는 동기 함수 (isAdminPersona=true이면 이미 'ai' 반환)
  const baseStrategy = decideImageStrategy(
    personaContext,
    board,
    imagePostKind,
    imageStrategyOptions,
  );
  let imageStrategy: ImageStrategy = isAdminPersona ? "ai" : baseStrategy;

  // 큐레이션 모드 오버라이드: youtube=영상이 미디어라 이미지 없음 / meme=웹 밈 퍼오기 / ai=봇 직접 생성
  if (effectiveCuration === "youtube") {
    imageStrategy = "none";
  } else if (effectiveCuration === "meme") {
    imageStrategy = "web";
  } else if (effectiveCuration === "ai") {
    imageStrategy = "ai";
  }

  // 실전자료 큐레이션: 봇이 자료 내용을 이미지로 "지어내면" 안 되지만, 썸네일용으로
  // 헤더 이미지 1장은 필요하다(사용자 요구). 아래 이미지 처리에서 resourceCuration 전용
  // 분기(웹 이미지 우선 → 실패 시 AI 상징 이미지 폴백)로 딱 1장만 상단에 넣는다.
  // → 일반 플래너(다중 도식)로는 가지 않도록 imageStrategy 는 여기서 건드리지 않고
  //    이미지 처리 단계에서 resourceCuration 을 먼저 가로챈다.

  // 큐레이션 소개글 컨텍스트(프롬프트에 전달). ai 모드·비큐레이션은 undefined.
  const curationContext: CurationContext | undefined =
    effectiveCuration === "youtube"
      ? {
          kind: "youtube",
          title: curatedVideo?.title,
          channel: curatedVideo?.channel ?? undefined,
        }
      : effectiveCuration === "meme"
        ? {
            kind: "meme",
            title: curatedMeme?.alt ?? undefined,
            channel: curatedMeme?.sourceLabel ?? undefined,
          }
        : undefined;

  // ── Step 7: 관리자 연재 컨텍스트 조회 ────────────────────────────────────────
  let seriesContext: SeriesContext | undefined;
  const seriesGroup = topicResult.topic.seriesGroup ?? input.forceSeriesGroup;
  if (isAdminPersona && seriesGroup) {
    const [episodeCountRow] = await db
      .select({ c: count() })
      .from(schema.botTopics)
      .where(
        and(
          eq(schema.botTopics.seriesGroup, seriesGroup),
          inArray(schema.botTopics.status, ["used"]),
        ),
      );
    seriesContext = {
      groupTitle: seriesGroup,
      episodeIndex: (Number(episodeCountRow?.c ?? 0)) + 1,
    };
  }

  // ── Step 8~10: 생성 루프 ──────────────────────────────────────────────────────
  let regenCount = 0;
  let pipelineResult: PostPipelineResult | null = null;
  // 검열 반려 시 다음 회차에 실을 "부분 수정" 컨텍스트(직전 초안 + 걸린 항목).
  // 최초 생성은 undefined, 재생성부터 채워진다.
  let revision: RevisionContext | undefined;

  while (regenCount <= MAX_REGEN && pipelineResult === null) {
    // 상태: generating 업데이트
    await db
      .update(schema.botGenerationJobs)
      .set({ status: "generating", regenCount, updatedAt: new Date() })
      .where(eq(schema.botGenerationJobs.id, jobId));

    // 시스템·유저 프롬프트 조립
    const systemPrompt = buildPersonaSystemPrompt(personaForPrompt);
    const userPrompt = buildPostUserPrompt({
      titleSeed: topicResult.topic.titleSeed,
      facts,
      board,
      postKind: internalPostKind,
      seriesContext,
      curation: curationContext,
      resourceCuration: resourceCuration ?? undefined,
      revision,
    });

    // 생성 모델 호출
    let genText: string;
    let genCostUsd = 0;
    try {
      const genResponse = await callModel(
        genAssignment,
        {
          system: systemPrompt,
          user: userPrompt,
          maxTokens: isAdminPersona ? 4000 : 5500,
        },
        { personaId, jobId },
      );
      genText = genResponse.text;
      genCostUsd = genResponse.costUsd;
    } catch (err) {
      console.error("[post-pipeline] 생성 모델 호출 실패:", (err as Error).message);
      regenCount++;
      if (regenCount > MAX_REGEN) {
        await db
          .update(schema.botGenerationJobs)
          .set({ status: "discarded", updatedAt: new Date() })
          .where(eq(schema.botGenerationJobs.id, jobId));
        await logActivity(db, personaId, "discarded", jobId, {
          reason: "generation-model-error",
        });
        pipelineResult = { status: "discarded", jobId };
      }
      continue;
    }

    // Tiptap JSON 변환 + 텍스트 추출
    const draftJson = parseResponseToTiptap(genText);
    const draftText = extractTextFromTiptap(draftJson);

    // 자기검열 (status: censoring 업데이트 + censor_result 저장)
    const censorOutput = await runSelfCensor({
      jobId,
      personaId,
      draft: draftText,
      titleSeed: topicResult.topic.titleSeed,
      persona: {
        personaName: persona.nickname,
        tone: persona.tone ?? "",
        infoRatio: persona.infoRatio,
        isAdminPersona: persona.isAdminPersona,
        personaId,
      },
      facts,
      board,
      // 가이드 글(관리자 연재)·큐레이션 소개글은 insight(뻔함) 축 면제
      // (큐레이션은 "소재 소개"라 심층 인사이트를 요구하면 과도한 재생성이 발생).
      allowObvious:
        internalPostKind === "guide" ||
        (effectiveCuration !== null && effectiveCuration !== "ai") ||
        // 실전자료 큐레이션은 "실제 자료 소개"라 심층 인사이트(비범함)를 요구하면 과도한 재생성이 발생.
        resourceCuration !== null,
      // 일반 파이프라인에서는 didacticTone 비차단하지 않는다.
      // 커리큘럼 강의는 curriculum-staging.ts에서 allowDidacticTone: true로 전달.
      allowDidacticTone: false,
    });

    const { censorResult, costUsd: censorCostUsd } = censorOutput;

    // 제목을 이 시점에 확정한다(항상 비어있지 않음 — 사용자 정책).
    // 보류(held) 시 draft_content에 제목·게시판을 함께 저장해야, 통과할 때
    // 조인(주제)에 의존하지 않고 정확한 제목·게시판으로 게시된다.
    const postTitle = generateTitle(
      topicResult.topic.titleSeed,
      seriesContext,
      draftText,
    );

    await db
      .update(schema.botGenerationJobs)
      .set({
        status: "censoring",
        // 봉투(envelope) 형태로 저장: { board, title, contentJson }.
        // (구형은 Tiptap 문서만 저장했지만, 제목·게시판 유실을 막기 위해 봉투로 바꾼다.)
        draftContent: { board, title: postTitle, contentJson: draftJson },
        censorResult,
        updatedAt: new Date(),
      })
      .where(eq(schema.botGenerationJobs.id, jobId));

    // ── 분기 처리 ────────────────────────────────────────────────────────────

    // 검열 결과가 fail이 아니면(pass·ambiguous) 미디어(이미지·유튜브 영상)를 삽입한다.
    // 예전에는 미디어 삽입이 pass 분기 안에만 있어, ambiguous(보류)로 빠진 글은
    // 미디어 삽입 전 원본만 저장 → 관리자가 통과시켜도 이미지·영상이 통째로 유실됐다.
    // 이제 보류 글도 통과 글과 동일한 본문(finalContentJson)을 보관하므로 검수 후에도
    // 미디어가 살아있다. (fail은 재생성 루프라 비용 절약 위해 미디어 삽입을 건너뛴다.)
    if (censorResult.overall !== "fail") {
      // ── 이미지 처리 ────────────────────────────────────────────────────────────
      let imageCost = 0;
      let finalContentJson: Record<string, unknown>;

      if (curatedVideo) {
        // 모드 C-1: 유튜브 큐레이션 — 영상 노드를 맨 위에 삽입
        finalContentJson = prependYoutubeToTiptapDoc(draftJson, curatedVideo.url, {
          channel: curatedVideo.channel,
          sourceUrl: curatedVideo.pageUrl,
        });

      } else if (effectiveCuration === "meme" && curatedMeme) {
        // 모드 C-2a: 밈 퍼오기(미디어 우선) — Step 2.6에서 찾아 둔 밈을 그대로 첨부.
        // 출처는 검색 시점에 저작권 위험 검증을 통과했으므로 보류 없이 게시한다.
        const uploaded = await uploadWebImage(curatedMeme, uploadImage);
        if (uploaded) {
          finalContentJson = prependImageWithSourceToTiptapDoc(draftJson, uploaded.imageUrl, {
            sourceLabel: uploaded.source.label,
            sourceUrl: uploaded.source.url,
          });
        } else {
          // 다운로드·업로드 실패 → 이미지 없이 계속(게시 차단 금지)
          finalContentJson = draftJson;
        }

      } else if (effectiveCuration === "meme") {
        // 모드 C-2b: 밈 퍼오기(레거시) — 미디어 우선 검색이 빈손이라 발굴/주제 풀로 주제를
        // 확보한 경우. 게시 직전에 웹 이미지를 재검색 + 저작권 위험 판정.
        try {
          const memeQuery = curationMemeQuery(persona.nickname);
          const memeImgResult = await fetchBotImage({
            persona: personaContext,
            board,
            postKind: imagePostKind,
            keyword: memeQuery,
            webQuery: memeQuery,
            strategyOptions: { preferWeb: true },
            uploadFn: uploadImage,
            imageModel,
          });

          const sourceUrl = memeImgResult.source?.url;
          if (memeImgResult.imageUrl && sourceUrl && checkCurationCopyrightRisk(sourceUrl)) {
            // 저작권 위험 → 보류 큐 적재 + 파이프라인 중단
            await db.insert(schema.botHoldQueue).values({
              jobId,
              reason: "copyright_risk",
              decided: false,
            });
            await db
              .update(schema.botGenerationJobs)
              .set({ status: "held", updatedAt: new Date() })
              .where(eq(schema.botGenerationJobs.id, jobId));
            await logActivity(db, personaId, "held", jobId, {
              reason: "copyright_risk",
              sourceUrl,
            });
            pipelineResult = { status: "held", jobId };
            break;
          } else if (memeImgResult.imageUrl) {
            // 저작권 안전 → 이미지 + 출처 캡션 삽입
            finalContentJson = prependImageWithSourceToTiptapDoc(draftJson, memeImgResult.imageUrl, {
              sourceLabel: memeImgResult.source?.label ?? undefined,
              sourceUrl: memeImgResult.source?.url ?? undefined,
            });
            imageCost += 0; // 웹 이미지는 AI 비용 없음
          } else {
            // 이미지 없음 → 원본 본문 사용(게시 차단 금지)
            finalContentJson = draftJson;
          }
        } catch (memeErr) {
          // 밈 이미지 실패 → 이미지 없이 계속(게시 차단 금지)
          console.warn(
            "[post-pipeline] 밈 이미지 조달 실패 (이미지 없이 계속):",
            (memeErr as Error).message,
          );
          finalContentJson = draftJson;
        }

      } else if (resourceCuration) {
        // 모드 C-4: 실전자료 큐레이션 — 썸네일용 헤더 이미지 1장.
        // 자료 내용을 이미지로 지어내지 않도록, 실제 웹 이미지(출처 표기)를 우선하고
        // 못 구하면 주제를 상징하는 AI 이미지로 폴백한다. 둘 다 실패해도 게시는 유지.
        // 상단에 삽입하므로 extractFirstImageUrl 이 이 이미지를 썸네일로 잡는다.
        try {
          // (1) 웹 이미지 우선 — 자료 이름으로 관련 실제 이미지 검색.
          const webImg = await fetchBotImage({
            persona: personaContext,
            board,
            postKind: imagePostKind,
            keyword: resourceCuration.name,
            webQuery: resourceCuration.name,
            strategyOptions: { preferWeb: true },
            uploadFn: uploadImage,
            imageModel,
          });
          const webSourceUrl = webImg.source?.url;
          if (
            webImg.imageUrl &&
            !(webSourceUrl && checkCurationCopyrightRisk(webSourceUrl))
          ) {
            finalContentJson = prependImageWithSourceToTiptapDoc(draftJson, webImg.imageUrl, {
              sourceLabel: webImg.source?.label ?? undefined,
              sourceUrl: webImg.source?.url ?? undefined,
            });
          } else {
            // (2) AI 상징 이미지 폴백 — 실사·상징 스타일, 텍스트·로고 없음(자료를 지어내지 않음).
            const aiPrompt = `A clean, modern symbolic header illustration representing "${resourceCuration.name}", a widely-used ${resourceCuration.resourceType} resource for AI developers. Realistic yet conceptual, minimal, professional, soft studio lighting, no text, no logos, no UI screenshots.`;
            const gen = await genImage({ prompt: aiPrompt, imageModel });
            if (gen) {
              const ext = gen.mimetype.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
              const uploaded = await uploadImage(
                {
                  filename: `bot-resource-${topicResult.topic.id}.${ext}`,
                  mimetype: gen.mimetype,
                  data: gen.data,
                },
                "editor-images",
              );
              imageCost += gen.costUsd;
              finalContentJson = prependImageWithSourceToTiptapDoc(draftJson, uploaded.url, {});
            } else {
              finalContentJson = draftJson;
            }
          }
        } catch (rcImgErr) {
          console.warn(
            "[post-pipeline] 실전자료 헤더 이미지 실패 (이미지 없이 계속):",
            (rcImgErr as Error).message,
          );
          finalContentJson = draftJson;
        }

      } else if (imageStrategy === "meme") {
        // 모드 C-3: 밈 특화 페르소나(냉장고털이 등)의 일반 글.
        // 글 주제로 웹 이미지(밈)를 검색해 상단에 삽입한다. 사후 이미지 플래너는
        // 정보형/도식 전용이라 캐주얼 밈 글엔 빈 계획을 반환 → 여기서 별도 처리.
        // 큐레이션(의도적 퍼오기)과 달리 저작권 위험 시 보류하지 않고 이미지 없이 게시한다
        // (장식용 이미지라 글 자체는 살린다).
        try {
          const memeImgResult = await fetchBotImage({
            persona: personaContext,
            board,
            postKind: imagePostKind,
            keyword: topicResult.topic.titleSeed,
            webQuery: topicResult.topic.titleSeed,
            strategyOptions: { preferWeb: true },
            uploadFn: uploadImage,
            imageModel,
          });
          const sourceUrl = memeImgResult.source?.url;
          if (
            memeImgResult.imageUrl &&
            !(sourceUrl && checkCurationCopyrightRisk(sourceUrl))
          ) {
            finalContentJson = prependImageWithSourceToTiptapDoc(draftJson, memeImgResult.imageUrl, {
              sourceLabel: memeImgResult.source?.label ?? undefined,
              sourceUrl: memeImgResult.source?.url ?? undefined,
            });
          } else {
            // 이미지 없음 또는 저작권 위험 → 이미지 없이 게시(보류 안 함)
            finalContentJson = draftJson;
          }
        } catch (memeErr) {
          console.warn(
            "[post-pipeline] 밈 이미지 조달 실패 (이미지 없이 계속):",
            (memeErr as Error).message,
          );
          finalContentJson = draftJson;
        }

      } else if (imageStrategy !== "none") {
        // 모드 B: 일반 글 사후 이미지 플래너 (Story 13.7) — 비큐레이션 또는 ai 모드
        try {
          const plan: PostImagePlan = await planImagesForPost(
            draftJson,
            topicResult.topic.titleSeed,
            genAssignment,
            (assignment, prompt) => callModel(assignment, prompt),
            {
              maxImages: 3,
              preferDiagram: true,
              // AI 창작마당(전시글)만 창의·신비·비현실의 예술 이미지로 분기.
              // 그 외(가이드·정보·일반)는 실사·상징 우선 기본 모드.
              styleMode:
                board === "ai-creation" || effectiveCuration === "ai" ? "creative" : "default",
              markdownToTiptapFn: (md) => ({ type: "doc", content: parseMarkdownLines(md) }),
            },
          );
          imageCost += plan.plannerCostUsd;

          if (plan.items.length > 0) {
            const manifest: GuideAssetManifest = {};
            for (const item of plan.items) {
              try {
                if (item.kind === "ai_diagram" && item.diagramPrompt) {
                  // AI 도식 생성 — jobId 미전달로 비용을 파이프라인에서 직접 합산
                  const result = await genImage({
                    prompt: item.diagramPrompt,
                    imageModel,
                  });
                  if (result) {
                    const ext = result.mimetype.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
                    const uploaded = await uploadImage(
                      { filename: `bot-diagram-${item.key}.${ext}`, mimetype: result.mimetype, data: result.data },
                      "editor-images",
                    );
                    manifest[item.key] = {
                      url: uploaded.url,
                      // positionHint 는 "삽입 위치 매칭용 본문 문장"이지 캡션이 아니다.
                      // 보이는 caption 으로 쓰면 본문 문장이 이미지 뒤에 그대로 복제돼 레이아웃이 깨진다.
                      // 접근성·SEO용 alt(비가시)로만 쓰고, 캡션 문단은 실제 출처가 있을 때만 생성한다.
                      alt: item.positionHint ?? undefined,
                    };
                    imageCost += result.costUsd;
                  }
                } else if ((item.kind === "stock" || item.kind === "web") && item.searchQuery) {
                  const imgResult = await fetchBotImage({
                    persona: personaContext,
                    board,
                    postKind: imagePostKind,
                    keyword: item.searchQuery,
                    webQuery: item.searchQuery,
                    strategyOptions: { preferWeb: item.kind === "web" },
                    uploadFn: uploadImage,
                    imageModel,
                  });
                  if (imgResult.imageUrl) {
                    manifest[item.key] = {
                      url: imgResult.imageUrl,
                      // positionHint 는 매칭용 본문 문장 → 비가시 alt 로만. 캡션은 출처만 노출.
                      alt: item.positionHint ?? undefined,
                      sourceLabel: imgResult.source?.label ?? undefined,
                      sourceUrl: imgResult.source?.url ?? undefined,
                    };
                  }
                }
              } catch (itemErr) {
                console.warn(
                  "[post-pipeline] 이미지 생성 항목 실패 (건너뜀):",
                  item.key,
                  (itemErr as Error).message,
                );
              }
            }
            // 마커 자리에 이미지 인라인 삽입
            if (Object.keys(manifest).length > 0) {
              finalContentJson = insertInlineImagesByMarker(plan.bodyWithMarkers, manifest).doc;
            } else {
              // 이미지 생성이 모두 실패 → 원본 본문 사용
              finalContentJson = draftJson;
            }
          } else {
            // 플래너가 0개 결정 → 이미지 없이 게시
            finalContentJson = draftJson;
          }
        } catch (plannerErr) {
          // 플래너 자체 실패 → 이미지 없이 게시(게시 차단 금지)
          console.warn(
            "[post-pipeline] 이미지 플래너 실패 (이미지 없이 계속):",
            (plannerErr as Error).message,
          );
          finalContentJson = draftJson;
        }

      } else {
        // imageStrategy === "none": 이미지 없음(유튜브 큐레이션 오버라이드 또는 명시적 none)
        finalContentJson = draftJson;
      }

      // 비용 누적
      const totalCost = groundingCost + genCostUsd + censorCostUsd + imageCost;
      await db
        .update(schema.botGenerationJobs)
        .set({
          cost: {
            grounding: groundingCost,
            gen: genCostUsd,
            censor: censorCostUsd,
            image: imageCost,
            total: totalCost,
          },
        })
        .where(eq(schema.botGenerationJobs.id, jobId));

      // contentGuard: 스팸 링크는 차단, 금칙어는 마스킹(사용자 경로와 동일 정책).
      // finalContentJson·postTitle을 in-place로 가리고 마스킹된 제목을 받는다.
      const guardResult = await guardBotContentWithMasking({
        text: `${postTitle} ${draftText}`,
        doc: finalContentJson,
        title: postTitle,
      });
      if (!guardResult.ok) {
        await db
          .update(schema.botGenerationJobs)
          .set({ status: "blocked", updatedAt: new Date() })
          .where(eq(schema.botGenerationJobs.id, jobId));
        await logActivity(db, personaId, "blocked", jobId, {
          reason: guardResult.code ?? "FORBIDDEN_CONTENT",
        });
        pipelineResult = { status: "blocked", jobId };
        break;
      }

      // 금칙어 마스킹이 반영된 제목 사용(항상 비어있지 않음)
      const title = guardResult.title;

      // ── 검열 애매(ambiguous) → 보류 큐 적재 ──────────────────────────────────
      // 미디어(이미지·유튜브 영상)가 삽입된 finalContentJson을 draft_content 봉투에
      // 저장한다. 관리자가 보류 큐에서 통과시키면 이 본문이 그대로 게시되므로
      // 검수 후에도 이미지·영상이 살아있다(예전엔 미디어 삽입 전 원본만 저장돼 유실).
      if (censorResult.overall === "ambiguous") {
        await db
          .update(schema.botGenerationJobs)
          .set({
            draftContent: { board, title, contentJson: finalContentJson },
            status: "held",
            updatedAt: new Date(),
          })
          .where(eq(schema.botGenerationJobs.id, jobId));
        await db.insert(schema.botHoldQueue).values({
          jobId,
          reason: "ambiguous",
          decided: false,
        });
        await logActivity(db, personaId, "held", jobId, { censorResult });
        pipelineResult = { status: "held", jobId };
        break;
      }

      // ── 검열 통과(pass) → 게시 ───────────────────────────────────────────────
      // 게시 함수 분기 (#6 정합)
      const tags = topicResult.topic.titleSeed
        .split(/\s+/)
        .filter((w) => w.length > 1)
        .slice(0, 5);
      const common = {
        botUserId: persona.userId ?? personaId,
        personaId,
        jobId,
      };

      let writeResult: { status: "published" | "blocked"; refId?: string };

      if (jobKind === "question") {
        writeResult = await createQuestionAsBot({
          ...common,
          questionInput: {
            title,
            contentJson: finalContentJson,
            tags,
          },
        });
      } else if (jobKind === "resource") {
        const resourceType = board.slice("resource:".length) as
          | "prompt"
          | "claude-code-skill"
          | "mcp"
          | "rules-config"
          | "template-checklist";
        // 요약: 검색 사실 조각(facts[0])이 아니라 실제 본문 도입부에서 뽑는다.
        // (자료설명 본문 = descriptionJson. 첫 문단이 "이 자료가 무엇인지" 도입이다.)
        const bodyText = extractTextFromTiptap(
          finalContentJson as unknown as TiptapNode,
        ).trim();
        const resourceSummary =
          (bodyText ? bodyText.slice(0, 150) : "") || facts.facts[0] || title;
        // 큐레이션이면 원본 출처를 참고링크로 명시(재호스팅 시 출처 표기 필수)하고,
        // 발굴한 원본 파일(GitHub 저장소 등)을 다운로드 가능하게 첨부한다.
        const curationReferenceLinks = resourceCuration
          ? [{ label: resourceCuration.sourceLabel, url: resourceCuration.sourceUrl }]
          : undefined;
        writeResult = await createResourceAsBot({
          ...common,
          resourceInput: {
            title,
            summary: resourceSummary,
            resourceType,
            environment: [],
            difficulty: "beginner",
            descriptionJson: finalContentJson,
            usageJson: { type: "doc", content: [] },
            tags,
            referenceLinks: curationReferenceLinks,
          },
          fileSource: resourceCurationFileSource,
        });
      } else {
        writeResult = await createPostAsBot({
          ...common,
          postInput: {
            board,
            title,
            contentJson: finalContentJson,
            status: "published",
            tags,
          },
        });
      }

      pipelineResult = {
        status: writeResult.status as PostPipelineStatus,
        jobId,
        postId: writeResult.refId,
      };

      // 발굴·실시간·큐레이션 주제(DB에 없는 임시 주제)로 게시에 성공했으면
      // 그 주제를 bot_topics에 기록한다 → 다음 발굴이 같은 주제를 피한다(중복 방지).
      // 게시글 영구삭제 시 이 기록도 함께 지워져(purgePost) 같은 주제를 다시 쓸 수 있다.
      if (
        writeResult.status === "published" &&
        writeResult.refId &&
        topicResult.wasRealtime
      ) {
        await recordPublishedTopic(db, {
          personaId,
          board,
          titleSeed: title,
          postId: writeResult.refId,
        });
      }
    } else {
      // FAIL → 부분 수정 재생성 시도.
      // 직전 초안 + 이번에 걸린 항목만 골라 다음 회차 프롬프트에 실어,
      // 통과한 부분은 살리고 지적된 부분만 고쳐 다시 쓰게 한다.
      const failedItems = censorResult.items
        .filter((it) => it.result === "fail")
        .map((it) => ({ key: it.key, reason: it.reason }));
      revision =
        failedItems.length > 0
          ? { previousDraft: draftText, failedItems }
          : undefined;

      regenCount++;
      await logActivity(db, personaId, "regenerated", jobId, {
        attempt: regenCount,
        censorResult,
        // 이번 회차에서 어떤 항목을 고치라고 지시했는지 로그에 남긴다.
        revisionTargets: failedItems.map((it) => it.key),
      });
      if (regenCount > MAX_REGEN) {
        await db
          .update(schema.botGenerationJobs)
          .set({ status: "discarded", regenCount, updatedAt: new Date() })
          .where(eq(schema.botGenerationJobs.id, jobId));
        await logActivity(db, personaId, "discarded", jobId, {
          reason: "max-regen-exceeded",
          regenCount,
        });
        pipelineResult = { status: "discarded", jobId };
      }
      // else: while 루프 재진입
    }
  }

  // ── Step 11: 자동 보충 (fire-and-forget) ───────────────────────────────────
  void refillTopicsIfNeeded(db, personaId).catch((err: unknown) =>
    console.error(
      "[post-pipeline] 자동 보충 실패 (무시):",
      (err as Error).message,
    ),
  );

  return pipelineResult ?? { status: "error", jobId, reason: "unexpected-loop-exit" };
}

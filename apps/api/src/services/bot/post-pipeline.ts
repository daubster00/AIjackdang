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
 *  3) 검색 주도 주제 발굴 (discoverTopic)
 *  4) 주제 확정 (큐레이션 영상 → 발굴 → 고정 시드 → 실시간 폴백)
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
import { groundTopic, discoverTopic, searchYoutubeVideo } from "@ai-jakdang/server-bot/search";
import type { FactGrounding, DiscoveredTopic, CuratedVideo } from "@ai-jakdang/server-bot/search";
import {
  decideImageStrategy,
  fetchBotImage,
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
  SeriesContext,
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
import { runContentGuard } from "../../middleware/contentGuard.js";
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

function generateTitle(titleSeed: string, seriesContext?: SeriesContext): string {
  if (seriesContext) {
    return `${seriesContext.groupTitle} — 제${seriesContext.episodeIndex}편`;
  }
  return titleSeed;
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

  const boardCurationConfig: BoardCurationConfig | null = boardCurationRows[0]
    ? {
        enabled: boardCurationRows[0].curationEnabled,
        weights: (boardCurationRows[0].curationWeights as Partial<Record<CurationMode, number>> | null) ?? undefined,
      }
    : null;

  const curationMode = decideCurationMode(board, isAdminPersona, boardCurationConfig);
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
      : board === "qna"
        ? "초보자가 최근 소식·이슈에 대해 실제로 궁금해할 만한 '질문' 형태의 구체적 제목(물음표로 끝냄)."
        : internalPostKind === "info"
          ? "실무에 바로 쓸 만한 정보형 커뮤니티 글 주제."
          : "가볍고 캐주얼한 잡담·리액션 톤의 주제. 최근 화제나 밈처럼 편하게 떠들 만한 것.";

  if (wantsDiscovery && (await isSearchDrivenTopicsEnabled(db))) {
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

  // ── Step 4: 주제 확정 (큐레이션 영상 → 발굴 → 고정 시드 → 실시간 폴백) ──────────
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
      createdAt: new Date(),
    };
    topicResult = { topic: videoTopic, wasRealtime: true };
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
  if (discovered) {
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

  // 큐레이션 소개글 컨텍스트(프롬프트에 전달). ai 모드·비큐레이션은 undefined.
  const curationContext: CurationContext | undefined =
    effectiveCuration === "youtube"
      ? {
          kind: "youtube",
          title: curatedVideo?.title,
          channel: curatedVideo?.channel ?? undefined,
        }
      : effectiveCuration === "meme"
        ? { kind: "meme" }
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
          maxTokens: isAdminPersona ? 4000 : 1500,
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
        (effectiveCuration !== null && effectiveCuration !== "ai"),
      // 일반 파이프라인에서는 didacticTone 비차단하지 않는다.
      // 커리큘럼 강의는 curriculum-staging.ts에서 allowDidacticTone: true로 전달.
      allowDidacticTone: false,
    });

    const { censorResult, costUsd: censorCostUsd } = censorOutput;

    await db
      .update(schema.botGenerationJobs)
      .set({
        status: "censoring",
        draftContent: draftJson,
        censorResult,
        updatedAt: new Date(),
      })
      .where(eq(schema.botGenerationJobs.id, jobId));

    // ── 분기 처리 ────────────────────────────────────────────────────────────

    if (censorResult.overall === "pass") {
      // ── 이미지 처리 ────────────────────────────────────────────────────────────
      let imageCost = 0;
      let finalContentJson: Record<string, unknown>;

      if (curatedVideo) {
        // 모드 C-1: 유튜브 큐레이션 — 영상 노드를 맨 위에 삽입
        finalContentJson = prependYoutubeToTiptapDoc(draftJson, curatedVideo.url, {
          channel: curatedVideo.channel,
          sourceUrl: curatedVideo.pageUrl,
        });

      } else if (effectiveCuration === "meme") {
        // 모드 C-2: 밈 퍼오기 — 웹 이미지 검색 + 저작권 위험 판정
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
                      caption: item.positionHint ?? undefined,
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
                      caption: item.positionHint ?? undefined,
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

      // contentGuard 검사
      const guardResult = await runContentGuard(draftText);
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

      // 게시 함수 분기 (#6 정합)
      const title = generateTitle(topicResult.topic.titleSeed, seriesContext);
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
        writeResult = await createResourceAsBot({
          ...common,
          resourceInput: {
            title,
            summary: facts.facts[0] ?? title,
            resourceType,
            environment: [],
            difficulty: "beginner",
            descriptionJson: finalContentJson,
            usageJson: { type: "doc", content: [] },
            tags,
          },
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
    } else if (censorResult.overall === "ambiguous") {
      // HELD → bot_hold_queue INSERT
      await db.insert(schema.botHoldQueue).values({
        jobId,
        reason: "ambiguous",
        decided: false,
      });
      await db
        .update(schema.botGenerationJobs)
        .set({ status: "held", updatedAt: new Date() })
        .where(eq(schema.botGenerationJobs.id, jobId));
      await logActivity(db, personaId, "held", jobId, { censorResult });
      pipelineResult = { status: "held", jobId };
    } else {
      // FAIL → 재생성 시도
      regenCount++;
      await logActivity(db, personaId, "regenerated", jobId, {
        attempt: regenCount,
        censorResult,
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

/**
 * 글 생성 파이프라인 — Story 11.9
 *
 * runPostPipeline: 주제 선정 → 그라운딩 → 글 생성 → 자기검열 → 분기 → 게시/보류/폐기.
 *
 * 단계:
 *  0) 공지사항 가드 (notices 게시판 즉시 skip)
 *  1) 주제 선정 (selectTopic)
 *  2) 생성 잡 레코드 생성 (bot_generation_jobs)
 *  3) 페르소나 조회 + 글 성격 결정
 *  4) 검색·그라운딩 (groundTopic, intensity 분기)
 *  5) 이미지 전략 결정 (decideImageStrategy + 관리자 override)
 *  6) 관리자 연재 컨텍스트 조회 (series_group)
 *  7~9) 생성 루프 (재생성 MAX_REGEN=3):
 *       → 생성 모델 callModel → Tiptap 변환 → 자기검열 → 분기
 *  10) 자동 보충 fire-and-forget
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
  prependImageToTiptapDoc,
  prependImageWithSourceToTiptapDoc,
  prependYoutubeToTiptapDoc,
  insertInlineImagesByMarker,
} from "@ai-jakdang/server-bot/image";
import type {
  PostKind,
  ImageStrategy,
  ImageStrategyOptions,
  GuideAssetManifest,
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
  GuideChapterContext,
  SeriesContext,
} from "@ai-jakdang/bot-core";
import {
  getGuideSeriesForBoard,
  type GuideChapter,
  type GuideSeries,
} from "./curriculum.js";
// botSettings는 @ai-jakdang/database/schema(서브패스)를 끌어오므로, 가이드 분기에서만
// 필요할 때 동적 import한다(단위 테스트의 database 목이 서브패스를 덮지 않아 정적 import 시
// 실제 스키마가 목 drizzle 위에서 로드돼 깨지는 것을 피함).
import {
  decideCurationMode,
  curationVideoQuery,
  curationMemeQuery,
  type CurationMode,
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

// 가이드 강의 시리즈 — bot_settings 키.
const GUIDE_PROGRESS_KEY = "guide_progress";
const GUIDE_ASSET_MANIFEST_KEY = "guide_asset_manifest";

/** 시리즈별 진척: 발행 완료 편 번호 + 편별 요약(연속성용). */
interface GuideSeriesProgress {
  published: number[];
  summaries: Record<string, string>;
}
type GuideProgressMap = Record<string, GuideSeriesProgress>;

/** 시리즈 진척에서 다음에 쓸 미발행 챕터를 고른다(없으면 null=완결). */
function pickNextChapter(
  series: GuideSeries,
  prog: GuideSeriesProgress,
): GuideChapter | null {
  return series.chapters.find((c) => !prog.published.includes(c.order)) ?? null;
}

/** 발행된 draft 텍스트에서 연속성용 한 줄 요약을 만든다(앞 180자). */
function summarizeForContinuity(draftText: string): string {
  const flat = draftText.replace(/\s+/g, " ").trim();
  return flat.length > 180 ? `${flat.slice(0, 180)}…` : flat;
}

// ── 내부 헬퍼 타입 ────────────────────────────────────────────────────────────

type TiptapInternalNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapInternalNode[];
};

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

// ── parseResponseToTiptap ─────────────────────────────────────────────────────

/**
 * 모델 응답 텍스트를 Tiptap JSON으로 변환.
 * Tiptap JSON 직접 반환 감지 → 마크다운 파싱 → fallback(단순 paragraph) 순서.
 */
function parseResponseToTiptap(text: string): Record<string, unknown> {
  const trimmed = text.trim();

  // 1) Tiptap JSON 직접 반환 감지
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.type === "doc" && Array.isArray(parsed.content)) {
        return parsed;
      }
    } catch {
      // 파싱 실패 → 다음 단계로
    }
  }

  // 2) 마크다운 → Tiptap 변환
  const content = parseMarkdownLines(trimmed);
  return { type: "doc", content };
}

function parseMarkdownLines(markdown: string): TiptapInternalNode[] {
  const lines = markdown.split("\n");
  const nodes: TiptapInternalNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // 코드 블록
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      nodes.push({
        type: "codeBlock",
        attrs: lang ? { language: lang } : {},
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      i++;
      continue;
    }

    // 헤딩
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      nodes.push({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: h3Match[1] }] });
      i++;
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      nodes.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: h2Match[1] }] });
      i++;
      continue;
    }
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      nodes.push({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: h1Match[1] }] });
      i++;
      continue;
    }

    // 빈 줄 → 빈 문단(문단 사이 간격). 표준 편집기와 동일하게 "빈 줄 = 간격".
    // 맨 앞 빈 줄은 무시하고, 연속 빈 줄은 하나로 축약한다.
    if (!line.trim()) {
      const last = nodes[nodes.length - 1];
      const lastIsEmptyParagraph =
        !!last &&
        last.type === "paragraph" &&
        (!last.content || last.content.length === 0);
      if (nodes.length > 0 && !lastIsEmptyParagraph) {
        nodes.push({ type: "paragraph" });
      }
      i++;
      continue;
    }

    // 단락
    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: line.replace(/\*\*(.*?)\*\*/g, "$1") }],
    });
    i++;
  }

  if (nodes.length === 0) {
    return [{ type: "paragraph", content: [{ type: "text", text: markdown.trim() }] }];
  }

  return nodes;
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

  // ── Step 2.6: 가이드 강의 시리즈(고정 커리큘럼) 감지 ───────────────────────────
  // 관리자 페르소나가 가이드 게시판(vibe-coding-guide·automation-guide)에 쓸 때는
  // 검색 발굴 대신 커리큘럼의 "다음 미발행 편"을 순서대로 쓰고, 본문 정해진 자리에
  // 이미지 마커([[IMG:key]])를 넣는다(파이프라인이 실제 이미지로 치환).
  const guideSeries: GuideSeries | undefined = isAdminPersona
    ? getGuideSeriesForBoard(board)
    : undefined;
  let guideChapter: GuideChapter | null = null;
  let guideChapterCtx: GuideChapterContext | undefined;
  let guideProgress: GuideProgressMap | undefined;
  if (guideSeries) {
    const { getBotSetting } = await import("../../lib/botSettings.js");
    guideProgress = (await getBotSetting<GuideProgressMap>(GUIDE_PROGRESS_KEY)) ?? {};
    const seriesProg = guideProgress[guideSeries.title] ?? { published: [], summaries: {} };
    guideChapter = pickNextChapter(guideSeries, seriesProg);
    if (!guideChapter) {
      await logActivity(db, personaId, "skipped", null, {
        reason: "guide-series-complete",
        series: guideSeries.title,
      });
      return { status: "skipped", reason: "guide-series-complete" };
    }
    const nextOrder = guideChapter.order;
    const previousChapters = guideSeries.chapters
      .filter((c) => c.order < nextOrder && seriesProg.summaries[String(c.order)])
      .map((c) => ({
        order: c.order,
        title: c.title,
        summary: seriesProg.summaries[String(c.order)]!,
      }));
    guideChapterCtx = {
      seriesTitle: guideSeries.title,
      seriesIntro: guideSeries.intro,
      tool: guideSeries.tool,
      order: guideChapter.order,
      totalChapters: guideSeries.chapters.length,
      chapterTitle: guideChapter.title,
      goal: guideChapter.goal,
      outline: guideChapter.outline,
      imageSlots: guideChapter.imageSlots.map((s) => ({
        assetKey: s.assetKey,
        caption: s.caption,
      })),
      previousChapters,
    };
  }

  // ── Step 2.5: AI 창작마당 큐레이션(퍼오기) 결정 ───────────────────────────────
  // ai-creation 비관리자 글은 "퍼오기 위주" — 유튜브 AI 영상 임베드 / AI 밈 퍼오기 / 봇 직접 생성.
  const curationMode = decideCurationMode(board, isAdminPersona);
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
  // (톤은 styleHint로 조정.) 실패 시 고정 시드(있으면)로 폴백.
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

  if (wantsDiscovery && !guideSeries && (await isSearchDrivenTopicsEnabled(db))) {
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
  if (guideChapter && guideSeries) {
    // 가이드 강의: 커리큘럼이 정한 편이 곧 주제(합성 토픽, 재검색·주제선점 없음).
    const guideTopic: BotTopicRow = {
      id: `guide-${Date.now()}`,
      personaId,
      board,
      titleSeed: guideChapter.title,
      topicKind: "fixed",
      status: "unused",
      usedAt: null,
      seriesGroup: guideSeries.title,
      createdAt: new Date(),
    };
    topicResult = { topic: guideTopic, wasRealtime: true };
    await logActivity(db, personaId, "planned", null, {
      reason: "guide-chapter",
      series: guideSeries.title,
      order: guideChapter.order,
      chapter: guideChapter.title,
    });
  } else if (curatedVideo) {
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
  if (guideChapter) {
    // 가이드 강의: 커리큘럼(저작 콘텐츠)이 근거이므로 별도 검색 그라운딩을 하지 않는다.
    facts = { facts: [], sourceUrls: [], confidence: "low" };
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
  let imageStrategyOptions: ImageStrategyOptions = { preferWeb: discovered !== null };
  // 웹/스톡 이미지 검색어: 발굴이 준 영어 키워드 우선, 없으면 주제 제목.
  let webImageQuery = discovered?.imageQuery || topicResult.topic.titleSeed;
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
    imageStrategyOptions = { preferWeb: true };
    webImageQuery = curationMemeQuery(persona.nickname);
  } else if (effectiveCuration === "ai") {
    imageStrategy = "ai";
  }

  // 가이드 강의: 마커 기반 인라인 이미지를 쓰므로 단일 상단 이미지(fetchBotImage)는 끈다.
  if (guideChapter) {
    imageStrategy = "none";
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
  if (isAdminPersona && seriesGroup && !guideChapter) {
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
      guideChapter: guideChapterCtx,
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
      // 커리큘럼 강의 편은 교육적 문체라 ai_tone·duplicate 오탐이 잦아 비차단 완화.
      allowDidacticTone: guideChapter !== null,
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
      // 이미지 처리 (통과 시에만 비용 지출)
      let imageUrl: string | null = null;
      let imageSource: { label: string; url?: string } | null = null;
      let imageAlt: string | null = null;
      let imageCost = 0;
      if (imageStrategy !== "none") {
        const imageResult = await fetchBotImage({
          persona: personaContext,
          board,
          postKind: imagePostKind,
          keyword: topicResult.topic.titleSeed,
          webQuery: webImageQuery,
          strategyOptions: imageStrategyOptions,
          jobId,
          uploadFn: uploadImage,
          imageModel,
        });
        imageUrl = imageResult.imageUrl;
        imageSource = imageResult.source;
        imageAlt = discovered?.imageQuery ?? topicResult.topic.titleSeed;
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

      // Tiptap에 미디어 삽입.
      // 유튜브 큐레이션이면 영상 노드를 맨 위에 삽입(출처=채널·원본URL).
      // 그 외에는 이미지 삽입(출처 있으면 출처 캡션까지).
      let finalContentJson: Record<string, unknown>;
      if (guideChapter) {
        // 가이드 강의: 본문 [[IMG:key]] 마커를 매니페스트의 실제 이미지로 인라인 치환.
        const { getBotSetting } = await import("../../lib/botSettings.js");
        const manifest =
          (await getBotSetting<GuideAssetManifest>(GUIDE_ASSET_MANIFEST_KEY)) ?? {};
        finalContentJson = insertInlineImagesByMarker(draftJson, manifest).doc;
      } else if (curatedVideo) {
        finalContentJson = prependYoutubeToTiptapDoc(draftJson, curatedVideo.url, {
          channel: curatedVideo.channel,
          sourceUrl: curatedVideo.pageUrl,
        });
      } else if (imageUrl) {
        finalContentJson = imageSource
          ? prependImageWithSourceToTiptapDoc(draftJson, imageUrl, {
              alt: imageAlt,
              sourceLabel: imageSource.label,
              sourceUrl: imageSource.url ?? null,
            })
          : prependImageToTiptapDoc(draftJson, imageUrl, imageAlt ?? undefined);
      } else {
        finalContentJson = draftJson;
      }

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
      const title =
        guideChapter && guideSeries
          ? `${guideSeries.title} ${guideChapter.order}강. ${guideChapter.title}`
          : generateTitle(topicResult.topic.titleSeed, seriesContext);
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

      // 가이드 강의 발행 성공 → 진척도 갱신(다음 편이 이어받고 중복하지 않도록 요약 저장).
      if (guideChapter && guideSeries && writeResult.status === "published") {
        const prog: GuideProgressMap = guideProgress ?? {};
        const sp = prog[guideSeries.title] ?? { published: [], summaries: {} };
        if (!sp.published.includes(guideChapter.order)) {
          sp.published.push(guideChapter.order);
        }
        sp.summaries[String(guideChapter.order)] = summarizeForContinuity(draftText);
        prog[guideSeries.title] = sp;
        const { setBotSetting } = await import("../../lib/botSettings.js");
        await setBotSetting(GUIDE_PROGRESS_KEY, prog);
      }
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

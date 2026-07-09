/**
 * 봇 주제 선정 서비스 — Story 11.9
 *
 * selectTopic: bot_topics에서 unused 주제를 선택 (cooling 제외, realtime 폴백).
 * markTopicUsed: 주제를 used 상태로 업데이트 (선점 처리).
 * refillTopicsIfNeeded: 자동 보충 — unused 주제 수가 임계 이하이면 AI로 신규 생성.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md §2.5 bot_topics, §7 글 생성 파이프라인]
 */

import { eq, and, asc, desc, count } from "drizzle-orm";
import { schema } from "@ai-jakdang/database";
import type { Database } from "@ai-jakdang/database";
import { callModel, getModelAssignment } from "@ai-jakdang/server-bot/ai";
import { buildTopicRefillPrompt } from "@ai-jakdang/bot-core";
import type { BotPersonaForPrompt } from "@ai-jakdang/bot-core";

// ── 공개 타입 ─────────────────────────────────────────────────────────────────

export type BotTopicRow = typeof schema.botTopics.$inferSelect;

export interface SelectTopicResult {
  topic: BotTopicRow;
  wasRealtime: boolean;
}

// ── 자동 보충 임계값 ──────────────────────────────────────────────────────────

const REFILL_THRESHOLD = 3;
const REFILL_COUNT = 5;

// ── 검색 주도 주제 발굴 설정 ─────────────────────────────────────────────────────

/** 페르소나 도메인별 검색어(영어=해외 AI 출처, 한국어=국내 보조). */
export interface PersonaDiscoveryQuery {
  en: string;
  ko: string;
}

/**
 * 닉네임별 발굴 검색어. 8개 페르소나 전원 등록(잡담·질문 캐릭터 포함).
 * 여기에 없는 페르소나는 발굴하지 않는다(현재 전원 등록됨).
 */
const DISCOVERY_QUERY_BY_NICKNAME: Record<string, PersonaDiscoveryQuery> = {
  dubu_2: {
    en: "n8n Make Zapier workflow automation new feature update release",
    ko: "n8n Make 자동화 새 기능 업데이트",
  },
  semo_k: {
    en: "Claude Code Cursor AI coding assistant new feature update changelog",
    ko: "AI 코딩 도구 클로드 커서 업데이트",
  },
  wolse99: {
    en: "AI side income monetization freelance tool new 2026",
    ko: "AI 부업 수익화 새 도구 소식",
  },
  latte2x: {
    en: "AI marketing content automation tool new feature launch",
    ko: "AI 마케팅 콘텐츠 자동화 새 기능",
  },
  rainy03: {
    en: "Midjourney Stable Diffusion AI image generation new model feature",
    ko: "AI 이미지 생성 미드저니 새 모델",
  },
  AI작당지기: {
    en: "OpenAI Anthropic Google AI major announcement release update",
    ko: "AI 주요 업데이트 출시 소식",
  },
  // ── 잡담·질문 캐릭터 (톤은 discoverTopic의 styleHint로 캐주얼하게 조정) ──
  냉장고털이: {
    en: "AI viral meme trending funny news this week",
    ko: "AI 밈 요즘 화제 유행",
  },
  감자세개: {
    en: "AI beginner easy tool popular trending new",
    ko: "AI 입문 초보 요즘 화제 궁금",
  },
};

/**
 * 발굴이 어울리지 않는 게시판.
 * - gigs(의뢰 모집): "해드립니다" 모집글이라 최신 소식 발굴과 무관.
 * talk·qna는 발굴 확장됨(캐주얼/질문 톤으로 최근 화제를 소재화).
 * ai-creation도 발굴 대상으로 확장됨 — 큐레이션(유튜브/밈 미디어 우선)이 소재를 못
 * 구하거나 ai 모드(봇 직접 생성)로 굴러가면 발굴이 소재를 만든다(주제 풀 의존 제거).
 */
const DISCOVERY_EXCLUDED_BOARDS = new Set(["gigs"]);

/**
 * 이 페르소나·게시판 조합에서 검색 주도 발굴을 쓸지 판단하고,
 * 쓸 수 있으면 검색어를 반환한다(못 쓰면 null → 고정 시드 폴백).
 */
export function getDiscoveryQuery(
  nickname: string,
  board: string,
): PersonaDiscoveryQuery | null {
  if (DISCOVERY_EXCLUDED_BOARDS.has(board)) return null;
  return DISCOVERY_QUERY_BY_NICKNAME[nickname] ?? null;
}

/**
 * 검색 주도 주제 발굴 전역 스위치.
 * bot_settings.bot_search_driven_topics 값. 키가 없으면 기본 ON(true)으로 간주.
 */
export async function isSearchDrivenTopicsEnabled(db: Database): Promise<boolean> {
  try {
    const [row] = await db
      .select({ value: schema.botSettings.value })
      .from(schema.botSettings)
      .where(eq(schema.botSettings.key, "bot_search_driven_topics"))
      .limit(1);
    if (!row) return true; // 키 미존재 → 기본 활성
    return row.value === true || row.value === "true";
  } catch {
    return true;
  }
}

// ── selectTopic ───────────────────────────────────────────────────────────────

/**
 * 주제 선정.
 *
 * 1) unused 상태 주제를 가장 오래된 것부터 선택
 * 2) 없으면 realtimeTopic이 있으면 임시 객체 반환 (wasRealtime=true, DB INSERT 없음)
 * 3) 둘 다 없으면 null 반환 → 파이프라인 skip
 *
 * cooling 상태 주제는 조회 대상에서 제외.
 * cooling 리셋은 별도 cron이 처리 (11.13).
 */
export async function selectTopic(
  db: Database,
  personaId: string,
  board: string,
  realtimeTopic?: string,
): Promise<SelectTopicResult | null> {
  // 1) unused 주제 조회 (cooling 제외)
  const rows = await db
    .select()
    .from(schema.botTopics)
    .where(
      and(
        eq(schema.botTopics.personaId, personaId),
        eq(schema.botTopics.board, board),
        eq(schema.botTopics.status, "unused"),
      ),
    )
    .orderBy(asc(schema.botTopics.createdAt))
    .limit(1);

  if (rows.length > 0 && rows[0]) {
    return { topic: rows[0], wasRealtime: false };
  }

  // 2) realtime 폴백 — DB INSERT 없이 임시 객체 반환
  if (realtimeTopic) {
    const fakeTopic: BotTopicRow = {
      id: `realtime-${Date.now()}`,
      personaId,
      board,
      titleSeed: realtimeTopic,
      topicKind: "realtime",
      status: "unused",
      usedAt: null,
      seriesGroup: null,
      postId: null,
      createdAt: new Date(),
    };
    return { topic: fakeTopic, wasRealtime: true };
  }

  // 3) 주제 없음
  return null;
}

/**
 * 이 페르소나가 이미 다룬 주제 제목 목록(중복 발굴 회피용).
 * bot_topics의 title_seed를 "최신순(created_at desc)"으로 최대 limit개 반환.
 * (예전엔 ORDER BY가 없어 임의 순서 20개만 잡혀, 최근 게시 주제가 누락될 수 있었다.)
 */
export async function getRecentTopicTitles(
  db: Database,
  personaId: string,
  limit = 40,
): Promise<string[]> {
  try {
    const rows = await db
      .select({ titleSeed: schema.botTopics.titleSeed })
      .from(schema.botTopics)
      .where(eq(schema.botTopics.personaId, personaId))
      .orderBy(desc(schema.botTopics.createdAt))
      .limit(limit);
    return rows.map((r) => r.titleSeed);
  } catch {
    return [];
  }
}

/**
 * 발굴·실시간 주제로 실제 게시된 글의 주제를 bot_topics에 기록한다(중복 방지 기록).
 *
 * 발굴/큐레이션 주제는 DB에 없는 임시(synthetic) 주제라, 게시해도 아무 기록이 안 남아
 * getRecentTopicTitles가 항상 빈 목록 → 발굴이 같은 주제를 또 고르는 문제가 있었다.
 * 게시 성공 시 이 함수로 제목을 남기고 postId로 게시글과 연결한다.
 * 게시글 영구삭제(purgePost) 시 이 행이 함께 삭제돼 같은 주제를 다시 쓸 수 있다.
 *
 * 실패해도 게시 흐름을 막지 않는다(조용히 무시).
 */
export async function recordPublishedTopic(
  db: Database,
  params: { personaId: string; board: string; titleSeed: string; postId: string },
): Promise<void> {
  try {
    const seed = params.titleSeed.trim();
    if (!seed) return;
    await db.insert(schema.botTopics).values({
      personaId: params.personaId,
      board: params.board,
      titleSeed: seed,
      topicKind: "realtime",
      status: "used",
      usedAt: new Date(),
      postId: params.postId,
    });
  } catch (err) {
    console.error("[topic] 게시 주제 기록 실패 (무시):", (err as Error).message);
  }
}

// ── markTopicUsed ─────────────────────────────────────────────────────────────

/**
 * 주제를 used 상태로 업데이트한다 (선점 처리).
 * wasRealtime=true인 경우 호출하지 않는다 (임시 주제는 DB에 없음).
 */
export async function markTopicUsed(db: Database, topicId: string): Promise<void> {
  await db
    .update(schema.botTopics)
    .set({ status: "used", usedAt: new Date() })
    .where(eq(schema.botTopics.id, topicId));
}

// ── refillTopicsIfNeeded ──────────────────────────────────────────────────────

/**
 * 자동 주제 보충.
 *
 * bot_settings.bot_auto_refill_topics ON + 미사용 주제 수 ≤ 임계(3)이면
 * AI가 캐릭터 컨셉에 맞는 새 주제를 생성해 topic_kind='auto'로 INSERT.
 *
 * fire-and-forget으로 호출 — 실패 시 조용히 0 반환.
 *
 * @returns 새로 생성된 주제 수 (0이면 보충 불필요하거나 실패)
 */
export async function refillTopicsIfNeeded(
  db: Database,
  personaId: string,
): Promise<number> {
  try {
    // 1) bot_auto_refill_topics 설정 확인
    const [settingRow] = await db
      .select({ value: schema.botSettings.value })
      .from(schema.botSettings)
      .where(eq(schema.botSettings.key, "bot_auto_refill_topics"))
      .limit(1);

    const autoRefillEnabled = settingRow?.value === true || settingRow?.value === "true";
    if (!autoRefillEnabled) return 0;

    // 2) 미사용 주제 수 조회
    const [countRow] = await db
      .select({ c: count() })
      .from(schema.botTopics)
      .where(
        and(
          eq(schema.botTopics.personaId, personaId),
          eq(schema.botTopics.status, "unused"),
        ),
      );

    const unusedCount = Number(countRow?.c ?? 0);
    if (unusedCount > REFILL_THRESHOLD) return 0;

    // 3) 페르소나 정보 조회
    const [personaRow] = await db
      .select()
      .from(schema.botPersonas)
      .where(eq(schema.botPersonas.id, personaId))
      .limit(1);

    if (!personaRow) return 0;

    // 4) 담당 게시판 조회
    const boardRows = await db
      .select({ board: schema.botPersonaBoards.board })
      .from(schema.botPersonaBoards)
      .where(eq(schema.botPersonaBoards.personaId, personaId));

    if (boardRows.length === 0) return 0;

    // 5) 기존 주제 title_seed 목록 조회 (중복 방지)
    const existingRows = await db
      .select({ titleSeed: schema.botTopics.titleSeed })
      .from(schema.botTopics)
      .where(eq(schema.botTopics.personaId, personaId));

    const existingTopics = existingRows.map((r) => r.titleSeed);

    // 6) 생성 모델 조회
    const genAssignment = await getModelAssignment(db, personaId, "generation");
    if (!genAssignment) return 0;

    const personaForPrompt: BotPersonaForPrompt = {
      nickname: personaRow.nickname,
      personaPrompt: personaRow.personaPrompt,
      tone: personaRow.tone,
      intentionalFlaws: personaRow.intentionalFlaws,
      isAdminPersona: personaRow.isAdminPersona,
      infoRatio: personaRow.infoRatio,
    };

    let totalInserted = 0;

    // 7) 게시판별 주제 생성
    for (const { board } of boardRows) {
      try {
        const prompt = buildTopicRefillPrompt(
          personaForPrompt,
          board,
          existingTopics,
          REFILL_COUNT,
        );

        const response = await callModel(genAssignment, {
          system: "JSON 배열만 반환하세요. 설명 없음.",
          user: prompt,
          maxTokens: 300,
        });

        // 8) JSON 배열 파싱
        const jsonMatch = response.text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) continue;

        const newTopics = JSON.parse(jsonMatch[0]) as unknown[];
        const topicStrings = newTopics.filter(
          (t): t is string => typeof t === "string" && t.trim().length > 0,
        );

        if (topicStrings.length === 0) continue;

        // 9) bot_topics INSERT (topic_kind='auto')
        await db.insert(schema.botTopics).values(
          topicStrings.map((titleSeed) => ({
            personaId,
            board,
            titleSeed,
            topicKind: "auto" as const,
            status: "unused" as const,
          })),
        );

        totalInserted += topicStrings.length;
        existingTopics.push(...topicStrings); // 다음 반복에서 중복 방지
      } catch (boardErr) {
        console.error(`[topic] 게시판 ${board} 자동 보충 실패 (무시):`, (boardErr as Error).message);
      }
    }

    // 10) 활동 로그 기록
    if (totalInserted > 0) {
      try {
        await db.insert(schema.botActivityLog).values({
          personaId,
          eventType: "skipped",
          refId: null,
          payload: { reason: "topics-refilled", count: totalInserted },
        });
      } catch {
        // 로그 실패는 무시
      }
    }

    return totalInserted;
  } catch (err) {
    console.error("[topic] 자동 보충 실패 (무시):", (err as Error).message);
    return 0;
  }
}


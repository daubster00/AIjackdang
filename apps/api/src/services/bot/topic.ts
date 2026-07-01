/**
 * 봇 주제 선정 서비스 — Story 11.9
 *
 * selectTopic: bot_topics에서 unused 주제를 선택 (cooling 제외, realtime 폴백).
 * markTopicUsed: 주제를 used 상태로 업데이트 (선점 처리).
 * refillTopicsIfNeeded: 자동 보충 — unused 주제 수가 임계 이하이면 AI로 신규 생성.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md §2.5 bot_topics, §7 글 생성 파이프라인]
 */

import { eq, and, asc, count } from "drizzle-orm";
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
      createdAt: new Date(),
    };
    return { topic: fakeTopic, wasRealtime: true };
  }

  // 3) 주제 없음
  return null;
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


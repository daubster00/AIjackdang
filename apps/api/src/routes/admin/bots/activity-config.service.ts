/**
 * 봇 활동 설정 서비스 레이어 (Story 11.15).
 *
 * - 활동 리듬 (bot_activity_rhythm) 조회·upsert
 * - 담당 게시판 (bot_persona_boards) 전체 교체
 * - 주제 풀 (bot_topics) CRUD
 * - bot_settings auto-refill 키 조회·수정
 * - 모델 할당 (bot_model_assignments) 조회·전체 교체
 */

import { getDb } from "@ai-jakdang/database";
import {
  botActivityRhythm,
  botPersonaBoards,
  botTopics,
  botModelAssignments,
  botSettings,
  botPersonas,
} from "@ai-jakdang/database/schema";
import { eq, and } from "drizzle-orm";
import type {
  BotRhythmUpdate,
  BotTopicCreate,
  BotModelAssignmentUpsert,
  BotActivityRhythm,
  BotTopic,
  BotModelAssignment,
  BotTopicStatus,
  BotTopicKind,
} from "@ai-jakdang/contracts";

// ── 복합 응답 타입 ────────────────────────────────────────────────────────────

export interface RhythmWithBoards {
  rhythm: BotActivityRhythm | null;
  boards: Array<{ board: string; weight: number }>;
}

// ── 페르소나 존재 확인 헬퍼 ───────────────────────────────────────────────────

async function assertPersonaExists(id: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ id: botPersonas.id })
    .from(botPersonas)
    .where(eq(botPersonas.id, id))
    .limit(1);
  if (!row) {
    throw Object.assign(new Error("봇을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }
}

// ── 활동 리듬 + 담당 게시판 조회 ──────────────────────────────────────────────

export async function getRhythm(personaId: string): Promise<RhythmWithBoards> {
  await assertPersonaExists(personaId);
  const db = getDb();

  const [rhythmRow] = await db
    .select()
    .from(botActivityRhythm)
    .where(eq(botActivityRhythm.personaId, personaId))
    .limit(1);

  const boardRows = await db
    .select({ board: botPersonaBoards.board, weight: botPersonaBoards.weight })
    .from(botPersonaBoards)
    .where(eq(botPersonaBoards.personaId, personaId));

  return {
    rhythm: rhythmRow
      ? {
          personaId: rhythmRow.personaId,
          postsPerWeek: rhythmRow.postsPerWeek,
          commentsPerWeek: rhythmRow.commentsPerWeek,
          activeHours: (rhythmRow.activeHours as BotActivityRhythm["activeHours"]) ?? null,
          activeDays: rhythmRow.activeDays ?? null,
        }
      : null,
    boards: boardRows,
  };
}

// ── 활동 리듬 upsert (select-then-update/insert 패턴 — 고유 제약 독립) ────────

export async function upsertRhythm(
  personaId: string,
  data: BotRhythmUpdate,
): Promise<BotActivityRhythm> {
  await assertPersonaExists(personaId);
  const db = getDb();

  const [existing] = await db
    .select({ id: botActivityRhythm.id })
    .from(botActivityRhythm)
    .where(eq(botActivityRhythm.personaId, personaId))
    .limit(1);

  if (existing) {
    await db
      .update(botActivityRhythm)
      .set({
        postsPerWeek: data.postsPerWeek,
        commentsPerWeek: data.commentsPerWeek,
        activeHours: data.activeHours as unknown,
        activeDays: data.activeDays as unknown,
        updatedAt: new Date(),
      })
      .where(eq(botActivityRhythm.personaId, personaId));
  } else {
    await db.insert(botActivityRhythm).values({
      personaId,
      postsPerWeek: data.postsPerWeek,
      commentsPerWeek: data.commentsPerWeek,
      activeHours: data.activeHours as unknown,
      activeDays: data.activeDays as unknown,
    });
  }

  const [updated] = await db
    .select()
    .from(botActivityRhythm)
    .where(eq(botActivityRhythm.personaId, personaId))
    .limit(1);

  return {
    personaId: updated!.personaId,
    postsPerWeek: updated!.postsPerWeek,
    commentsPerWeek: updated!.commentsPerWeek,
    activeHours: (updated!.activeHours as BotActivityRhythm["activeHours"]) ?? null,
    activeDays: updated!.activeDays ?? null,
  };
}

// ── 담당 게시판 전체 교체 (트랜잭션) ────────────────────────────────────────

export async function replaceBoards(
  personaId: string,
  boards: Array<{ board: string; weight: number }>,
): Promise<Array<{ board: string; weight: number }>> {
  await assertPersonaExists(personaId);
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.delete(botPersonaBoards).where(eq(botPersonaBoards.personaId, personaId));
    if (boards.length > 0) {
      await tx.insert(botPersonaBoards).values(
        boards.map((b) => ({ personaId, board: b.board, weight: b.weight })),
      );
    }
  });

  const rows = await db
    .select({ board: botPersonaBoards.board, weight: botPersonaBoards.weight })
    .from(botPersonaBoards)
    .where(eq(botPersonaBoards.personaId, personaId));

  return rows;
}

// ── 주제 풀 목록 조회 ─────────────────────────────────────────────────────────

export async function listTopics(
  personaId: string,
  filters: { status?: BotTopicStatus; board?: string },
): Promise<BotTopic[]> {
  await assertPersonaExists(personaId);
  const db = getDb();

  const conditions = [eq(botTopics.personaId, personaId)];
  if (filters.status) conditions.push(eq(botTopics.status, filters.status));
  if (filters.board) conditions.push(eq(botTopics.board, filters.board));

  const rows = await db
    .select()
    .from(botTopics)
    .where(and(...conditions));

  return rows.map((r) => ({
    id: r.id,
    personaId: r.personaId,
    board: r.board,
    titleSeed: r.titleSeed,
    topicKind: r.topicKind,
    status: r.status,
    usedAt: r.usedAt ? r.usedAt.toISOString() : null,
    seriesGroup: r.seriesGroup ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ── 주제 생성 ─────────────────────────────────────────────────────────────────

export async function createTopic(data: BotTopicCreate): Promise<BotTopic> {
  const db = getDb();

  const [row] = await db
    .insert(botTopics)
    .values({
      personaId: data.personaId,
      board: data.board,
      titleSeed: data.titleSeed,
      topicKind: data.topicKind,
      seriesGroup: data.seriesGroup ?? null,
    })
    .returning();

  return {
    id: row!.id,
    personaId: row!.personaId,
    board: row!.board,
    titleSeed: row!.titleSeed,
    topicKind: row!.topicKind,
    status: row!.status,
    usedAt: row!.usedAt ? row!.usedAt.toISOString() : null,
    seriesGroup: row!.seriesGroup ?? null,
    createdAt: row!.createdAt.toISOString(),
  };
}

// ── 주제 수정 ─────────────────────────────────────────────────────────────────

export async function updateTopic(
  personaId: string,
  topicId: string,
  data: { board?: string; titleSeed?: string; topicKind?: BotTopicKind; seriesGroup?: string },
): Promise<BotTopic> {
  const db = getDb();

  const [existing] = await db
    .select({ id: botTopics.id })
    .from(botTopics)
    .where(and(eq(botTopics.id, topicId), eq(botTopics.personaId, personaId)))
    .limit(1);

  if (!existing) {
    throw Object.assign(new Error("주제를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const updateSet: Record<string, unknown> = {};
  if (data.board !== undefined) updateSet.board = data.board;
  if (data.titleSeed !== undefined) updateSet.titleSeed = data.titleSeed;
  if (data.topicKind !== undefined) updateSet.topicKind = data.topicKind;
  if (data.seriesGroup !== undefined) updateSet.seriesGroup = data.seriesGroup;

  const [updated] = await db
    .update(botTopics)
    .set(updateSet)
    .where(eq(botTopics.id, topicId))
    .returning();

  return {
    id: updated!.id,
    personaId: updated!.personaId,
    board: updated!.board,
    titleSeed: updated!.titleSeed,
    topicKind: updated!.topicKind,
    status: updated!.status,
    usedAt: updated!.usedAt ? updated!.usedAt.toISOString() : null,
    seriesGroup: updated!.seriesGroup ?? null,
    createdAt: updated!.createdAt.toISOString(),
  };
}

// ── 주제 삭제 ─────────────────────────────────────────────────────────────────

export async function deleteTopic(personaId: string, topicId: string): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({ id: botTopics.id })
    .from(botTopics)
    .where(and(eq(botTopics.id, topicId), eq(botTopics.personaId, personaId)))
    .limit(1);

  if (!existing) {
    throw Object.assign(new Error("주제를 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  await db.delete(botTopics).where(eq(botTopics.id, topicId));
}

// ── 자동 보충 설정 조회 ───────────────────────────────────────────────────────

export async function getAutoRefill(): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ value: botSettings.value })
    .from(botSettings)
    .where(eq(botSettings.key, "bot_auto_refill_topics"))
    .limit(1);
  return (row?.value as boolean) ?? false;
}

// ── 자동 보충 설정 upsert (bot_settings key PK — onConflictDoUpdate 안전) ────

export async function setAutoRefill(value: boolean): Promise<boolean> {
  const db = getDb();
  await db
    .insert(botSettings)
    .values({ key: "bot_auto_refill_topics", value })
    .onConflictDoUpdate({
      target: botSettings.key,
      set: { value, updatedAt: new Date() },
    });
  return value;
}

// ── 모델 할당 목록 조회 ───────────────────────────────────────────────────────

export async function listModelAssignments(personaId: string): Promise<BotModelAssignment[]> {
  await assertPersonaExists(personaId);
  const db = getDb();

  const rows = await db
    .select()
    .from(botModelAssignments)
    .where(eq(botModelAssignments.personaId, personaId));

  return rows.map((r) => ({
    id: r.id,
    personaId: r.personaId,
    provider: r.provider,
    model: r.model,
    purpose: r.purpose,
    isActive: r.isActive,
    note: r.note ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

// ── 모델 할당 전체 교체 (트랜잭션 — persona 행만) ─────────────────────────────

export async function replaceModelAssignments(
  personaId: string,
  assignments: BotModelAssignmentUpsert[],
): Promise<BotModelAssignment[]> {
  await assertPersonaExists(personaId);
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.delete(botModelAssignments).where(eq(botModelAssignments.personaId, personaId));
    if (assignments.length > 0) {
      await tx.insert(botModelAssignments).values(
        assignments.map((a) => ({
          personaId, // URL param 강제 주입 — body의 personaId 무시
          provider: a.provider,
          model: a.model,
          purpose: a.purpose,
          isActive: a.isActive,
          note: a.note ?? null,
        })),
      );
    }
  });

  return listModelAssignments(personaId);
}

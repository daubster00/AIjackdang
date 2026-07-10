/**
 * 봇 페르소나 관리 서비스 레이어 (Story 11.14).
 *
 * listBots, getBot, updateBot, toggleBot
 */

import { getDb } from "@ai-jakdang/database";
import {
  botPersonas,
  botActivityLog,
  botModelAssignments,
  posts,
  comments,
} from "@ai-jakdang/database/schema";
import { eq, ilike, desc, asc, and, sql, max, inArray } from "drizzle-orm";
import type { BotPersonaUpdate } from "@ai-jakdang/contracts";
import type { SQL } from "drizzle-orm";

// ── 로컬 타입 ─────────────────────────────────────────────────────────────────
// TODO(11.14): 아래 타입들은 contracts/src/bot.ts에 AdminBotListQuery, AdminBotListItem,
//              AdminBotDetail이 정의되면 해당 import로 교체한다.
//              현재 contracts에는 adminBotPersonasQuerySchema/BotPersonaItem/BotPersonaDetail이
//              존재하지만, status(active|inactive|all) 필드와 postCount·commentCount 집계 필드가
//              없어 로컬 임시 정의로 처리한다.

export interface AdminBotListQuery {
  q?: string;
  status?: "active" | "inactive" | "all";
  page: number;
  pageSize: number;
}

export interface AdminBotListItem {
  id: string;
  nickname: string;
  isActive: boolean;
  isAdminPersona: boolean;
  lastActiveAt: string | null;
  postCount: number;
  commentCount: number;
  /** 글 생성(generation) 모델 provider — 미배정 시 null. */
  genProvider: string | null;
  /** 글 생성(generation) 모델명 — 미배정 시 null. */
  genModel: string | null;
}

export interface AdminBotDetail {
  id: string;
  userId: string | null;
  nickname: string;
  hiddenIdentity: string | null;
  ageJob: string | null;
  tone: string | null;
  personaPrompt: string | null;
  infoRatio: number;
  intentionalFlaws: string | null;
  isAdminPersona: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
  postCount: number;
  commentCount: number;
}

// ── 목록 조회 ─────────────────────────────────────────────────────────────────

export async function listBots(query: AdminBotListQuery): Promise<{
  items: AdminBotListItem[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const db = getDb();
  const { q, status, page, pageSize } = query;

  const conditions: SQL[] = [];
  if (q) conditions.push(ilike(botPersonas.nickname, `%${q}%`));
  if (status === "active") conditions.push(eq(botPersonas.isActive, true));
  else if (status === "inactive") conditions.push(eq(botPersonas.isActive, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // 총 개수
  const [countRow] = await db
    .select({ value: sql<number>`COUNT(*)::int` })
    .from(botPersonas)
    .where(where);

  const totalItems = Number(countRow?.value ?? 0);
  const offset = (page - 1) * pageSize;

  // 목록 + 집계 JOIN
  const rows = await db
    .select({
      id: botPersonas.id,
      nickname: botPersonas.nickname,
      isActive: botPersonas.isActive,
      isAdminPersona: botPersonas.isAdminPersona,
      lastActiveAt: max(botActivityLog.createdAt),
      // 활동 로그(post.published)만 세면 이후 삭제·비공개된 글까지 포함돼 게시판 실제 글 수와
      // 어긋난다. refId로 실제 posts/comments 행을 조인해 "게시판에 실제로 노출 중인 글"만 센다.
      postCount: sql<number>`COUNT(CASE WHEN ${botActivityLog.eventType} = 'post.published' AND ${posts.status} = 'published' AND ${posts.deletedAt} IS NULL THEN 1 END)::int`,
      commentCount: sql<number>`COUNT(CASE WHEN ${botActivityLog.eventType} = 'comment.published' AND ${comments.status} = 'visible' AND ${comments.deletedAt} IS NULL THEN 1 END)::int`,
    })
    .from(botPersonas)
    .leftJoin(botActivityLog, eq(botPersonas.id, botActivityLog.personaId))
    .leftJoin(posts, eq(botActivityLog.refId, posts.id))
    .leftJoin(comments, eq(botActivityLog.refId, comments.id))
    .where(where)
    .groupBy(botPersonas.id)
    .orderBy(desc(botPersonas.isActive), asc(botPersonas.nickname))
    .limit(pageSize)
    .offset(offset);

  // 글 생성(generation) 모델 배정을 별도 조회해 매핑 (집계 JOIN 행 증식 방지)
  const personaIds = rows.map((r) => r.id);
  const genModelByPersona = new Map<string, { provider: string; model: string }>();
  if (personaIds.length > 0) {
    const modelRows = await db
      .select({
        personaId: botModelAssignments.personaId,
        provider: botModelAssignments.provider,
        model: botModelAssignments.model,
      })
      .from(botModelAssignments)
      .where(
        and(
          inArray(botModelAssignments.personaId, personaIds),
          eq(botModelAssignments.purpose, "generation"),
        ),
      );
    for (const m of modelRows) {
      genModelByPersona.set(m.personaId, { provider: m.provider, model: m.model });
    }
  }

  const items: AdminBotListItem[] = rows.map((r) => {
    const gen = genModelByPersona.get(r.id);
    return {
      id: r.id,
      nickname: r.nickname,
      isActive: r.isActive,
      isAdminPersona: r.isAdminPersona,
      lastActiveAt: r.lastActiveAt ? r.lastActiveAt.toISOString() : null,
      postCount: Number(r.postCount) ?? 0,
      commentCount: Number(r.commentCount) ?? 0,
      genProvider: gen?.provider ?? null,
      genModel: gen?.model ?? null,
    };
  });

  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  };
}

// ── 단건 조회 (집계 포함) ──────────────────────────────────────────────────────

export async function getBot(id: string): Promise<AdminBotDetail> {
  const db = getDb();

  const rows = await db
    .select({
      id: botPersonas.id,
      userId: botPersonas.userId,
      nickname: botPersonas.nickname,
      hiddenIdentity: botPersonas.hiddenIdentity,
      ageJob: botPersonas.ageJob,
      tone: botPersonas.tone,
      personaPrompt: botPersonas.personaPrompt,
      infoRatio: botPersonas.infoRatio,
      intentionalFlaws: botPersonas.intentionalFlaws,
      isAdminPersona: botPersonas.isAdminPersona,
      isActive: botPersonas.isActive,
      createdAt: botPersonas.createdAt,
      updatedAt: botPersonas.updatedAt,
      lastActiveAt: max(botActivityLog.createdAt),
      // 목록과 동일하게 실제 posts/comments 행을 조인해 삭제·비공개 글은 제외한다.
      postCount: sql<number>`COUNT(CASE WHEN ${botActivityLog.eventType} = 'post.published' AND ${posts.status} = 'published' AND ${posts.deletedAt} IS NULL THEN 1 END)::int`,
      commentCount: sql<number>`COUNT(CASE WHEN ${botActivityLog.eventType} = 'comment.published' AND ${comments.status} = 'visible' AND ${comments.deletedAt} IS NULL THEN 1 END)::int`,
    })
    .from(botPersonas)
    .leftJoin(botActivityLog, eq(botPersonas.id, botActivityLog.personaId))
    .leftJoin(posts, eq(botActivityLog.refId, posts.id))
    .leftJoin(comments, eq(botActivityLog.refId, comments.id))
    .where(eq(botPersonas.id, id))
    .groupBy(botPersonas.id)
    .limit(1);

  const r = rows[0];
  if (!r) {
    throw Object.assign(new Error("봇을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  return {
    id: r.id,
    userId: r.userId ?? null,
    nickname: r.nickname,
    hiddenIdentity: r.hiddenIdentity ?? null,
    ageJob: r.ageJob ?? null,
    tone: r.tone ?? null,
    personaPrompt: r.personaPrompt ?? null,
    infoRatio: r.infoRatio,
    intentionalFlaws: r.intentionalFlaws ?? null,
    isAdminPersona: r.isAdminPersona,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lastActiveAt: r.lastActiveAt ? r.lastActiveAt.toISOString() : null,
    postCount: Number(r.postCount) ?? 0,
    commentCount: Number(r.commentCount) ?? 0,
  };
}

// ── 캐릭터 시트 수정 ──────────────────────────────────────────────────────────

export async function updateBot(id: string, data: BotPersonaUpdate): Promise<AdminBotDetail> {
  const db = getDb();

  // 존재 확인
  const [target] = await db
    .select({ id: botPersonas.id })
    .from(botPersonas)
    .where(eq(botPersonas.id, id))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("봇을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  // 캐릭터 시트 필드만 수정 (infoRatio 범위 검증은 Zod 스키마에서 처리)
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (data.nickname !== undefined) updateSet.nickname = data.nickname;
  if (data.hiddenIdentity !== undefined) updateSet.hiddenIdentity = data.hiddenIdentity;
  if (data.ageJob !== undefined) updateSet.ageJob = data.ageJob;
  if (data.tone !== undefined) updateSet.tone = data.tone;
  if (data.personaPrompt !== undefined) updateSet.personaPrompt = data.personaPrompt;
  if (data.infoRatio !== undefined) updateSet.infoRatio = data.infoRatio;
  if (data.intentionalFlaws !== undefined) updateSet.intentionalFlaws = data.intentionalFlaws;

  await db.update(botPersonas).set(updateSet).where(eq(botPersonas.id, id));

  return getBot(id);
}

// ── isActive 토글 ─────────────────────────────────────────────────────────────

export async function toggleBot(id: string): Promise<{ id: string; isActive: boolean; updatedAt: string }> {
  const db = getDb();

  const [target] = await db
    .select({ id: botPersonas.id, isActive: botPersonas.isActive })
    .from(botPersonas)
    .where(eq(botPersonas.id, id))
    .limit(1);

  if (!target) {
    throw Object.assign(new Error("봇을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const [updated] = await db
    .update(botPersonas)
    .set({ isActive: !target.isActive, updatedAt: new Date() })
    .where(eq(botPersonas.id, id))
    .returning({ id: botPersonas.id, isActive: botPersonas.isActive, updatedAt: botPersonas.updatedAt });

  return {
    id: updated.id,
    isActive: updated.isActive,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

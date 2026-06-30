/**
 * Q&A 관리 서비스 레이어 (Story 9.7).
 *
 * listQuestions, listAnswers, forceQnaStatus,
 * hideQuestion, deleteQuestion, hideAnswer, deleteAnswer
 *
 * 숨김/삭제 메커니즘:
 *   - 질문(questions): status 컬럼이 'hidden'/'deleted' 값을 직접 지원 (question_status enum).
 *     숨김 → status='hidden', 삭제 → status='deleted' + deletedAt 기록.
 *   - 답변(answers): status 컬럼이 'hidden'/'deleted' 값을 직접 지원 (answer_status enum).
 *     동일 패턴 적용.
 *
 * Q&A 상태(qnaStatus) 파생:
 *   - pending  = isResolved=false AND answerCount=0
 *   - answered = isResolved=false AND answerCount>0
 *   - resolved = isResolved=true
 *   PATCH /status 는 isResolved 플래그를 강제 조작한다.
 */

import { getDb } from "@ai-jakdang/database";
import { questions, answers, users } from "@ai-jakdang/database/schema";
import { eq, and, count, gte, lte, ilike, ne, sql } from "drizzle-orm";
import type {
  AdminQnaQuestionsQuery,
  AdminQnaAnswersQuery,
  QnaStatus,
} from "@ai-jakdang/contracts";

// ── 헬퍼: Q&A 상태 파생 ───────────────────────────────────────────────────────

function deriveQnaStatus(isResolved: boolean, answerCount: number): QnaStatus {
  if (isResolved) return "resolved";
  if (answerCount > 0) return "answered";
  return "pending";
}

// ── 질문 단건 조회 ────────────────────────────────────────────────────────────

export async function getQuestion(id: string) {
  const db = getDb();

  const [row] = await db
    .select({
      id: questions.id,
      title: questions.title,
      slug: questions.slug,
      status: questions.status,
      userId: questions.userId,
      authorNickname: users.nickname,
      authorAvatarUrl: users.avatarUrl,
      authorImage: users.image,
      authorDefaultAvatarIndex: users.defaultAvatarIndex,
      contentJson: questions.contentJson,
      viewCount: questions.viewCount,
      isResolved: questions.isResolved,
      helpfulAnswerId: questions.helpfulAnswerId,
      createdAt: questions.createdAt,
      updatedAt: questions.updatedAt,
      deletedAt: questions.deletedAt,
      answerCount: sql<number>`(SELECT COUNT(*)::int FROM answers WHERE question_id = ${questions.id} AND status != 'deleted')`,
      reportCount: sql<number>`(SELECT COUNT(*)::int FROM reports WHERE target_type = 'question' AND target_id = ${questions.id})`,
    })
    .from(questions)
    .leftJoin(users, eq(questions.userId, users.id))
    .where(eq(questions.id, id))
    .limit(1);

  if (!row) {
    throw Object.assign(new Error("질문을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  return {
    ...row,
    qnaStatus: deriveQnaStatus(row.isResolved, row.answerCount),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

// ── 질문 목록 ─────────────────────────────────────────────────────────────────

export async function listQuestions(query: AdminQnaQuestionsQuery) {
  const db = getDb();
  const { qnaStatus, contentStatus, hasReports, dateFrom, dateTo, q, page, pageSize } = query;

  const conditions = [];

  if (contentStatus) {
    conditions.push(eq(questions.status, contentStatus));
  }
  if (dateFrom) {
    conditions.push(gte(questions.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(questions.createdAt, toDate));
  }
  if (q) {
    conditions.push(ilike(questions.title, `%${q}%`));
  }
  if (hasReports === true) {
    conditions.push(
      sql`(SELECT COUNT(*) FROM reports WHERE target_type = 'question' AND target_id = ${questions.id}) > 0`,
    );
  }

  // qnaStatus 필터: isResolved + answerCount 기반 조건
  if (qnaStatus === "resolved") {
    conditions.push(eq(questions.isResolved, true));
  } else if (qnaStatus === "pending") {
    conditions.push(eq(questions.isResolved, false));
    conditions.push(
      sql`(SELECT COUNT(*) FROM answers WHERE question_id = ${questions.id} AND status != 'deleted') = 0`,
    );
  } else if (qnaStatus === "answered") {
    conditions.push(eq(questions.isResolved, false));
    conditions.push(
      sql`(SELECT COUNT(*) FROM answers WHERE question_id = ${questions.id} AND status != 'deleted') > 0`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(questions)
    .where(where);

  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: questions.id,
      title: questions.title,
      slug: questions.slug,
      status: questions.status,
      userId: questions.userId,
      authorNickname: users.nickname,
      authorAvatarUrl: users.avatarUrl,
      authorImage: users.image,
      authorDefaultAvatarIndex: users.defaultAvatarIndex,
      viewCount: questions.viewCount,
      isResolved: questions.isResolved,
      helpfulAnswerId: questions.helpfulAnswerId,
      createdAt: questions.createdAt,
      updatedAt: questions.updatedAt,
      deletedAt: questions.deletedAt,
      answerCount: sql<number>`(SELECT COUNT(*)::int FROM answers WHERE question_id = ${questions.id} AND status != 'deleted')`,
      reportCount: sql<number>`(SELECT COUNT(*)::int FROM reports WHERE target_type = 'question' AND target_id = ${questions.id})`,
    })
    .from(questions)
    .leftJoin(users, eq(questions.userId, users.id))
    .where(where)
    .orderBy(questions.createdAt)
    .limit(pageSize)
    .offset(offset);

  const items = rows.map((r) => ({
    ...r,
    qnaStatus: deriveQnaStatus(r.isResolved, r.answerCount),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
  }));

  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems: Number(totalItems),
      totalPages: Math.ceil(Number(totalItems) / pageSize),
    },
  };
}

// ── 답변 목록 ─────────────────────────────────────────────────────────────────

export async function listAnswers(query: AdminQnaAnswersQuery) {
  const db = getDb();
  const { questionId, contentStatus, hasReports, page, pageSize } = query;

  const conditions = [];

  if (questionId) {
    conditions.push(eq(answers.questionId, questionId));
  }
  if (contentStatus) {
    conditions.push(eq(answers.status, contentStatus));
  } else {
    // 기본: 삭제된 답변은 목록에서 제외 (소프트삭제 유지·목록 비노출 — M10)
    conditions.push(ne(answers.status, "deleted" as const));
  }
  if (hasReports === true) {
    conditions.push(
      sql`(SELECT COUNT(*) FROM reports WHERE target_type = 'answer' AND target_id = ${answers.id}) > 0`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(answers)
    .where(where);

  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: answers.id,
      questionId: answers.questionId,
      questionTitle: questions.title,
      status: answers.status,
      userId: answers.userId,
      authorNickname: users.nickname,
      authorAvatarUrl: users.avatarUrl,
      authorImage: users.image,
      authorDefaultAvatarIndex: users.defaultAvatarIndex,
      contentJson: answers.contentJson,
      createdAt: answers.createdAt,
      updatedAt: answers.updatedAt,
      deletedAt: answers.deletedAt,
      reportCount: sql<number>`(SELECT COUNT(*)::int FROM reports WHERE target_type = 'answer' AND target_id = ${answers.id})`,
    })
    .from(answers)
    .leftJoin(questions, eq(answers.questionId, questions.id))
    .leftJoin(users, eq(answers.userId, users.id))
    .where(where)
    .orderBy(answers.createdAt)
    .limit(pageSize)
    .offset(offset);

  const items = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
  }));

  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems: Number(totalItems),
      totalPages: Math.ceil(Number(totalItems) / pageSize),
    },
  };
}

// ── Q&A 상태 강제 변경 ────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/admin/qna/questions/:id/status
 * qnaStatus에 따라 isResolved 플래그를 강제 변경한다.
 * - 'resolved'  → isResolved=true
 * - 'pending'/'answered' → isResolved=false
 *   (answered vs pending 은 answerCount 에 의해 결정되므로 isResolved=false 만 설정)
 */
export async function forceQnaStatus(id: string, qnaStatus: QnaStatus) {
  const db = getDb();

  const [target] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("질문을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const isResolved = qnaStatus === "resolved";
  const now = new Date();

  const [updated] = await db
    .update(questions)
    .set({ isResolved, updatedAt: now })
    .where(eq(questions.id, id))
    .returning({ id: questions.id, status: questions.status, updatedAt: questions.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 질문 숨김 ─────────────────────────────────────────────────────────────────

export async function hideQuestion(id: string) {
  const db = getDb();

  const [target] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("질문을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(questions)
    .set({ status: "hidden", updatedAt: now })
    .where(eq(questions.id, id))
    .returning({ id: questions.id, status: questions.status, updatedAt: questions.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 질문 soft-delete (super_admin 전용) ───────────────────────────────────────

export async function deleteQuestion(id: string) {
  const db = getDb();

  const [target] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("질문을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(questions)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(eq(questions.id, id))
    .returning({ id: questions.id, status: questions.status, updatedAt: questions.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 답변 숨김 ─────────────────────────────────────────────────────────────────

export async function hideAnswer(id: string) {
  const db = getDb();

  const [target] = await db.select().from(answers).where(eq(answers.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("답변을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(answers)
    .set({ status: "hidden", updatedAt: now })
    .where(eq(answers.id, id))
    .returning({ id: answers.id, status: answers.status, updatedAt: answers.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 답변 soft-delete (super_admin 전용) ───────────────────────────────────────

export async function deleteAnswer(id: string) {
  const db = getDb();

  const [target] = await db.select().from(answers).where(eq(answers.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("답변을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(answers)
    .set({ status: "deleted", deletedAt: now, updatedAt: now })
    .where(eq(answers.id, id))
    .returning({ id: answers.id, status: answers.status, updatedAt: answers.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 질문 숨김 복구 (hidden → published) ──────────────────────────────────────

export async function unhideQuestion(id: string) {
  const db = getDb();

  const [target] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("질문을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(questions)
    .set({ status: "published", updatedAt: now })
    .where(eq(questions.id, id))
    .returning({ id: questions.id, status: questions.status, updatedAt: questions.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ── 답변 숨김 복구 (hidden → published) ──────────────────────────────────────

export async function unhideAnswer(id: string) {
  const db = getDb();

  const [target] = await db.select().from(answers).where(eq(answers.id, id)).limit(1);
  if (!target) {
    throw Object.assign(new Error("답변을 찾을 수 없습니다."), { code: "NOT_FOUND" });
  }

  const now = new Date();
  const [updated] = await db
    .update(answers)
    .set({ status: "published", updatedAt: now })
    .where(eq(answers.id, id))
    .returning({ id: answers.id, status: answers.status, updatedAt: answers.updatedAt });

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

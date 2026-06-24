/**
 * Q&A 답변 서비스 — Story 3.6
 *
 * createAnswer  : POST /api/v1/qna/questions/:questionId/answers
 * updateAnswer  : PATCH /api/v1/qna/answers/:id
 * deleteAnswer  : DELETE /api/v1/qna/answers/:id (soft-delete, AR-7)
 *
 * 저장 대상: schema.answers (schema.posts / schema.comments 절대 사용 금지).
 * content_json: Tiptap JSON 형식 저장. HTML 원본 저장 금지 (AR-8).
 * soft-delete: status='deleted' + deleted_at=now() (AR-7).
 * 유일 공개 답변 삭제 시 → 질문 derivedStatus 자동 '답변대기' 복귀
 *   (detail 서비스가 published 답변 수로 도출하므로 서버 추가 처리 불필요).
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { AnswerResponse } from "@ai-jakdang/contracts";
import { LITE_ALLOWED_NODES } from "@ai-jakdang/contracts";
import { eq, and, isNull } from "drizzle-orm";
import { tiptapJsonToHtml } from "../../../lib/tiptap-renderer.js";
import { buildSanitizeOptions } from "../../../lib/sanitize.js";
import _sanitizeHtml from "sanitize-html";
import { earnPoints, revokePoints, getTodayCount } from "../gamification/points.service.js";

// ── 답변 contentJson → 안전 HTML 변환 ───────────────────────────────────────

/**
 * 답변 content_json을 안전 HTML로 변환한다.
 *
 * LightEditor(contentEditable 기반)가 `{ type: "doc", html: "<innerHTML>" }` 형식으로
 * 저장하므로, html 필드가 있으면 LITE_ALLOWED_NODES 화이트리스트로 sanitize한다.
 * 표준 Tiptap JSON이면 tiptapJsonToHtml을 사용한다.
 */
function answerContentToHtml(contentJson: Record<string, unknown>): string {
  // LightEditor 래퍼 형식: { type: "doc", html: "<...>" }
  if (contentJson.type === "doc" && typeof contentJson.html === "string") {
    return _sanitizeHtml(contentJson.html, buildSanitizeOptions(LITE_ALLOWED_NODES));
  }
  // 표준 Tiptap JSON
  return tiptapJsonToHtml(contentJson);
}

// ── 입/출력 타입 ──────────────────────────────────────────────────────────────

export interface CreateAnswerParams {
  questionId: string;
  userId: string;
  contentJson: Record<string, unknown>;
}

export interface UpdateAnswerParams {
  answerId: string;
  userId: string;
  contentJson: Record<string, unknown>;
}

export interface DeleteAnswerParams {
  answerId: string;
  userId: string;
}

/** 답변 단건 응답 + contentHtml (서버 렌더) */
export type AnswerWithHtml = AnswerResponse & { contentHtml: string };

// ── createAnswer ──────────────────────────────────────────────────────────────

/**
 * 답변 등록.
 *
 * 1. questionId 유효성 확인 (published, not deleted).
 * 2. answers INSERT (status='published').
 * 3. 작성자 정보 LEFT JOIN 조회.
 * 4. AnswerWithHtml 반환.
 *
 * 등록 후 derivedStatus(answered) 변화는 클라이언트 재패치로 확인한다.
 * (detail.service.getQuestionBySlug가 published 답변 수를 실시간 계산)
 */
export async function createAnswer({
  questionId,
  userId,
  contentJson,
}: CreateAnswerParams): Promise<{ answer: AnswerWithHtml; error?: never } | { error: "QUESTION_NOT_FOUND"; answer?: never }> {
  const db = getDb();

  // ── 질문 존재 확인 ──────────────────────────────────────────────────────────
  const [question] = await db
    .select({ id: schema.questions.id, status: schema.questions.status })
    .from(schema.questions)
    .where(
      and(
        eq(schema.questions.id, questionId),
        isNull(schema.questions.deletedAt),
      ),
    )
    .limit(1);

  if (!question || question.status === "deleted") {
    return { error: "QUESTION_NOT_FOUND" };
  }

  // ── 답변 INSERT ────────────────────────────────────────────────────────────
  const [inserted] = await db
    .insert(schema.answers)
    .values({
      questionId,
      userId,
      contentJson,
      status: "published",
    })
    .returning({
      id: schema.answers.id,
      questionId: schema.answers.questionId,
      userId: schema.answers.userId,
      status: schema.answers.status,
      createdAt: schema.answers.createdAt,
      updatedAt: schema.answers.updatedAt,
    });

  if (!inserted) {
    throw new Error("답변 INSERT 실패");
  }

  // ── 포인트 적립 (실패해도 답변 저장은 유지) ───────────────────────────────
  try {
    const todayCount = await getTodayCount(db, { userId, reason: "answer.created" });
    await earnPoints(db, {
      userId,
      reason: "answer.created",
      sourceType: "answer",
      sourceId: inserted.id,
      todayCount,
    });
  } catch (err) {
    console.error("[points] 답변 적립 실패 (무시):", (err as Error).message);
  }

  // ── 작성자 조회 ────────────────────────────────────────────────────────────
  const [userRow] = await db
    .select({
      id: schema.users.id,
      nickname: schema.users.nickname,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const author = userRow
    ? {
        id: userRow.id,
        nickname: userRow.nickname,
        avatarUrl: userRow.avatarUrl ?? null,
      }
    : null;

  const contentHtml = answerContentToHtml(contentJson);

  return {
    answer: {
      id: inserted.id,
      questionId: inserted.questionId,
      author,
      contentJson,
      contentHtml,
      status: inserted.status,
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString(),
    },
  };
}

// ── updateAnswer ──────────────────────────────────────────────────────────────

export type UpdateAnswerResult =
  | { answer: AnswerWithHtml; error?: never }
  | { error: "ANSWER_NOT_FOUND" | "FORBIDDEN"; answer?: never };

/**
 * 답변 수정.
 * - 작성자 본인만 가능 (403).
 * - content_json + updated_at 갱신.
 */
export async function updateAnswer({
  answerId,
  userId,
  contentJson,
}: UpdateAnswerParams): Promise<UpdateAnswerResult> {
  const db = getDb();

  // ── 답변 존재 확인 ──────────────────────────────────────────────────────────
  const [existing] = await db
    .select({
      id: schema.answers.id,
      questionId: schema.answers.questionId,
      userId: schema.answers.userId,
      status: schema.answers.status,
    })
    .from(schema.answers)
    .where(
      and(
        eq(schema.answers.id, answerId),
        isNull(schema.answers.deletedAt),
      ),
    )
    .limit(1);

  if (!existing || existing.status === "deleted") {
    return { error: "ANSWER_NOT_FOUND" };
  }

  // ── 작성자 본인 확인 ──────────────────────────────────────────────────────
  if (existing.userId !== userId) {
    return { error: "FORBIDDEN" };
  }

  // ── content_json + updated_at 갱신 ────────────────────────────────────────
  const now = new Date();
  const [updated] = await db
    .update(schema.answers)
    .set({ contentJson, updatedAt: now })
    .where(eq(schema.answers.id, answerId))
    .returning({
      id: schema.answers.id,
      questionId: schema.answers.questionId,
      userId: schema.answers.userId,
      status: schema.answers.status,
      createdAt: schema.answers.createdAt,
      updatedAt: schema.answers.updatedAt,
    });

  if (!updated) {
    throw new Error("답변 UPDATE 실패");
  }

  // ── 작성자 조회 ────────────────────────────────────────────────────────────
  const [userRow] = await db
    .select({
      id: schema.users.id,
      nickname: schema.users.nickname,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const author = userRow
    ? {
        id: userRow.id,
        nickname: userRow.nickname,
        avatarUrl: userRow.avatarUrl ?? null,
      }
    : null;

  const contentHtml = answerContentToHtml(contentJson);

  return {
    answer: {
      id: updated.id,
      questionId: updated.questionId,
      author,
      contentJson,
      contentHtml,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  };
}

// ── deleteAnswer ──────────────────────────────────────────────────────────────

export type DeleteAnswerResult =
  | { ok: true; error?: never }
  | { error: "ANSWER_NOT_FOUND" | "FORBIDDEN"; ok?: never };

/**
 * 답변 소프트 삭제 (AR-7).
 * - 작성자 본인만 가능 (403).
 * - status='deleted' + deleted_at=now().
 * - 유일 공개 답변 삭제 후 질문 derivedStatus('답변대기' 복귀)는
 *   클라이언트 router.refresh() 또는 서버 재패치로 자동 반영된다
 *   (detail.service가 published 답변 수를 실시간 계산).
 */
export async function deleteAnswer({
  answerId,
  userId,
}: DeleteAnswerParams): Promise<DeleteAnswerResult> {
  const db = getDb();

  // ── 답변 존재 확인 ──────────────────────────────────────────────────────────
  const [existing] = await db
    .select({
      id: schema.answers.id,
      userId: schema.answers.userId,
      status: schema.answers.status,
    })
    .from(schema.answers)
    .where(
      and(
        eq(schema.answers.id, answerId),
        isNull(schema.answers.deletedAt),
      ),
    )
    .limit(1);

  if (!existing || existing.status === "deleted") {
    return { error: "ANSWER_NOT_FOUND" };
  }

  // ── 작성자 본인 확인 ──────────────────────────────────────────────────────
  if (existing.userId !== userId) {
    return { error: "FORBIDDEN" };
  }

  // ── soft-delete: status='deleted' + deleted_at=now() (AR-7) ──────────────
  await db.transaction(async (tx) => {
    await tx
      .update(schema.answers)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.answers.id, answerId));

    try {
      await revokePoints(tx, {
        userId,
        reason: "answer.created",
        sourceType: "answer",
        sourceId: answerId,
      });
    } catch (err) {
      console.error("[points] 답변 회수 실패 (무시):", (err as Error).message);
    }
  });

  return { ok: true };
}

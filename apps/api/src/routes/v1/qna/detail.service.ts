/**
 * Q&A 질문 상세 서비스 — Story 3.5
 *
 * getQuestionBySlug: slug로 published 질문 단건 조회.
 * - status=deleted / deleted_at IS NOT NULL → null (404 대상)
 * - status=published → 비회원 포함 전체 공개
 * - answers: published 상태 + deleted_at IS NULL 공개 답변만 포함
 * - tags: taggable 다형 참조 배치 조회
 * - contentHtml: tiptapJsonToHtml(contentJson) — 서버에서 변환 (AR-8)
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { QuestionDetailResponse, AnswerResponse } from "@ai-jakdang/contracts";
import { deriveQuestionStatus, getDefaultAvatarUrl } from "@ai-jakdang/core";
import { eq, and, isNull, desc, count, inArray } from "drizzle-orm";
import { tiptapJsonToHtml } from "../../../lib/tiptap-renderer.js";

/** 상세 응답 확장 타입 (HTML 변환본 포함) */
export type QuestionDetailExtended = QuestionDetailResponse & {
  contentHtml: string;
};

export interface GetQuestionBySlugParams {
  slug: string;
}

/**
 * slug로 Q&A 질문 상세 조회.
 *
 * @returns QuestionDetailExtended 또는 null (404 대상)
 */
export async function getQuestionBySlug({
  slug,
}: GetQuestionBySlugParams): Promise<QuestionDetailExtended | null> {
  const db = getDb();

  // ── 질문 + 작성자 LEFT JOIN ─────────────────────────────────────────────────
  const rows = await db
    .select({
      id: schema.questions.id,
      slug: schema.questions.slug,
      title: schema.questions.title,
      contentJson: schema.questions.contentJson,
      status: schema.questions.status,
      isResolved: schema.questions.isResolved,
      helpfulAnswerId: schema.questions.helpfulAnswerId,
      viewCount: schema.questions.viewCount,
      userId: schema.questions.userId,
      deletedAt: schema.questions.deletedAt,
      createdAt: schema.questions.createdAt,
      updatedAt: schema.questions.updatedAt,
      // 작성자 정보 (탈퇴 시 null)
      authorId: schema.users.id,
      authorNickname: schema.users.nickname,
      authorAvatarUrl: schema.users.avatarUrl,
      authorImage: schema.users.image,
      authorDefaultAvatarIndex: schema.users.defaultAvatarIndex,
    })
    .from(schema.questions)
    .leftJoin(schema.users, eq(schema.questions.userId, schema.users.id))
    .where(eq(schema.questions.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;

  const question = rows[0]!;

  // ── 상태 검증: deleted 이거나 deleted_at 있으면 404 ──────────────────────────
  if (question.status === "deleted" || question.deletedAt != null) return null;

  // ── 공개 답변 조회 (published + deleted_at IS NULL) ───────────────────────────
  const answerRows = await db
    .select({
      id: schema.answers.id,
      questionId: schema.answers.questionId,
      userId: schema.answers.userId,
      contentJson: schema.answers.contentJson,
      status: schema.answers.status,
      createdAt: schema.answers.createdAt,
      updatedAt: schema.answers.updatedAt,
      // 작성자 정보 (탈퇴 시 null)
      authorId: schema.users.id,
      authorNickname: schema.users.nickname,
      authorAvatarUrl: schema.users.avatarUrl,
      authorImage: schema.users.image,
      authorDefaultAvatarIndex: schema.users.defaultAvatarIndex,
    })
    .from(schema.answers)
    .leftJoin(schema.users, eq(schema.answers.userId, schema.users.id))
    .where(
      and(
        eq(schema.answers.questionId, question.id),
        eq(schema.answers.status, "published"),
        isNull(schema.answers.deletedAt),
      ),
    )
    .orderBy(desc(schema.answers.createdAt));

  // ── 공개 답변 수 ────────────────────────────────────────────────────────────
  const answerCount = answerRows.length;

  // ── 태그 조회 (taggable 다형 참조) ──────────────────────────────────────────
  const taggableRows = await db
    .select({
      tagName: schema.tags.name,
    })
    .from(schema.taggable)
    .innerJoin(schema.tags, eq(schema.taggable.tagId, schema.tags.id))
    .where(
      and(
        eq(schema.taggable.targetType, "question"),
        inArray(schema.taggable.targetId, [question.id]),
      ),
    );

  const tags = taggableRows.map((r) => r.tagName);

  // ── derivedStatus 도출 ──────────────────────────────────────────────────────
  const derivedStatus = deriveQuestionStatus({
    answerCount,
    acceptedAnswerId: question.isResolved ? "resolved" : null,
  });

  // ── 작성자 조립 ─────────────────────────────────────────────────────────────
  const author =
    question.authorId != null && question.authorNickname != null
      ? {
          id: question.authorId,
          nickname: question.authorNickname,
          avatarUrl: question.authorAvatarUrl || question.authorImage || getDefaultAvatarUrl(question.authorDefaultAvatarIndex ?? 0),
        }
      : null;

  // ── 답변 조립 ───────────────────────────────────────────────────────────────
  const answers: AnswerResponse[] = answerRows.map((a) => ({
    id: a.id,
    questionId: a.questionId,
    author:
      a.authorId != null && a.authorNickname != null
        ? {
            id: a.authorId,
            nickname: a.authorNickname,
            avatarUrl: a.authorAvatarUrl || a.authorImage || getDefaultAvatarUrl(a.authorDefaultAvatarIndex ?? 0),
          }
        : null,
    contentJson: a.contentJson as Record<string, unknown>,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  // ── Tiptap JSON → 안전 HTML 변환 (AR-8) ────────────────────────────────────
  const contentHtml = tiptapJsonToHtml(question.contentJson);

  return {
    id: question.id,
    author,
    title: question.title,
    slug: question.slug,
    contentJson: question.contentJson as Record<string, unknown>,
    status: question.status,
    derivedStatus,
    isResolved: question.isResolved,
    helpfulAnswerId: question.helpfulAnswerId ?? null,
    viewCount: question.viewCount,
    answerCount,
    tags,
    answers,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
    contentHtml,
  };
}

// ── 단건 답변 카운트 조회 유틸 ──────────────────────────────────────────────────

/** questionId로 공개 답변 수를 계산한다. */
export async function countPublicAnswers(questionId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ cnt: count() })
    .from(schema.answers)
    .where(
      and(
        eq(schema.answers.questionId, questionId),
        eq(schema.answers.status, "published"),
        isNull(schema.answers.deletedAt),
      ),
    );
  return row?.cnt ?? 0;
}

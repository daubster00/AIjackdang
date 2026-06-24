/**
 * Q&A 질문 목록 서비스 — Story 3.2
 *
 * DB 접근은 이 파일(service 레이어)에서만. route handler 에서 직접 쿼리 금지.
 *
 * 상태 필터 서버 처리:
 *   - waiting  → answer_count=0 AND is_resolved=false
 *   - answered → answer_count>0 AND is_resolved=false
 *   - resolved → is_resolved=true
 *   - popular  → 필터 없음, view_count DESC 상위
 *   - all      → 필터 없음
 *
 * N+1 방지: 답변 수는 단일 SQL 집계 서브쿼리, 작성자는 LEFT JOIN users,
 *           태그는 배치 inArray 쿼리.
 */

import { getDb, schema } from "@ai-jakdang/database";
import type { QuestionListItem } from "@ai-jakdang/contracts";
import { deriveQuestionStatus } from "@ai-jakdang/core";
import { eq, and, isNull, desc, count, inArray, sql } from "drizzle-orm";

export type QuestionStatusFilter = "all" | "waiting" | "answered" | "resolved" | "popular";
export type QuestionSortOption = "latest" | "popular";

export interface GetQuestionsParams {
  status?: QuestionStatusFilter;
  sort?: QuestionSortOption;
  page?: number;
  pageSize?: number;
}

export interface GetQuestionsResult {
  items: QuestionListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * 질문 목록을 상태 필터·정렬·페이지네이션 하여 반환한다.
 *
 * - status = 'published' AND deleted_at IS NULL 필터 필수
 * - 공개 답변 수(status='published' AND deleted_at IS NULL) 서브쿼리로 집계
 * - 작성자: LEFT JOIN users (author 객체로 반환, 탈퇴 시 null)
 * - 태그: taggable + tags 배치 inArray 쿼리 (N+1 방지)
 *
 * 응답 형태는 QuestionListItemResponse(questionListItemResponseSchema) 를 따른다:
 *   author: { id, nickname, avatarUrl } | null  (authorNickname 플랫 필드 아님)
 */
export async function getQuestions({
  status = "all",
  sort = "latest",
  page = 1,
  pageSize = 20,
}: GetQuestionsParams): Promise<GetQuestionsResult> {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  // ── 공개 답변 수 서브쿼리 ─────────────────────────────────────────────────────
  // 공개(published) + 삭제되지 않은 답변만 카운트 (deriveQuestionStatus 로직과 동일)
  const answerCountSq = db
    .select({
      questionId: schema.answers.questionId,
      cnt: count().as("cnt"),
    })
    .from(schema.answers)
    .where(
      and(
        eq(schema.answers.status, "published"),
        isNull(schema.answers.deletedAt),
      ),
    )
    .groupBy(schema.answers.questionId)
    .as("answer_counts");

  // ── 상태 필터 WHERE 조건 ──────────────────────────────────────────────────────
  // `popular` 은 정렬 기준으로만 사용, 별도 WHERE 없음
  const statusConditions: ReturnType<typeof eq>[] = [];

  if (status === "waiting") {
    statusConditions.push(
      sql`COALESCE(${answerCountSq.cnt}, 0) = 0` as unknown as ReturnType<typeof eq>,
      eq(schema.questions.isResolved, false),
    );
  } else if (status === "answered") {
    statusConditions.push(
      sql`COALESCE(${answerCountSq.cnt}, 0) > 0` as unknown as ReturnType<typeof eq>,
      eq(schema.questions.isResolved, false),
    );
  } else if (status === "resolved") {
    statusConditions.push(eq(schema.questions.isResolved, true));
  }
  // "all" / "popular" → 추가 WHERE 없음

  // ── 기본 WHERE (공개 + 삭제 안 됨) ───────────────────────────────────────────
  const baseWhere = and(
    eq(schema.questions.status, "published"),
    isNull(schema.questions.deletedAt),
    ...statusConditions,
  );

  // ── 정렬 컬럼 ────────────────────────────────────────────────────────────────
  const orderBy =
    sort === "popular" || status === "popular"
      ? desc(schema.questions.viewCount)
      : desc(schema.questions.createdAt);

  // ── 총 개수 쿼리 ──────────────────────────────────────────────────────────────
  const countQuery = db
    .select({ total: count() })
    .from(schema.questions)
    .leftJoin(answerCountSq, eq(schema.questions.id, answerCountSq.questionId))
    .where(baseWhere);

  const [countRow] = await countQuery;
  const totalItems = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // ── 질문 목록 쿼리 (LEFT JOIN answer_counts + users) ─────────────────────────
  const rows = await db
    .select({
      id: schema.questions.id,
      slug: schema.questions.slug,
      title: schema.questions.title,
      status: schema.questions.status,
      isResolved: schema.questions.isResolved,
      helpfulAnswerId: schema.questions.helpfulAnswerId,
      viewCount: schema.questions.viewCount,
      createdAt: schema.questions.createdAt,
      updatedAt: schema.questions.updatedAt,
      // 작성자 정보 (탈퇴 시 userId는 null로 SET)
      authorId: schema.users.id,
      authorNickname: schema.users.nickname,
      authorAvatarUrl: schema.users.avatarUrl,
      answerCount: sql<number>`COALESCE(${answerCountSq.cnt}, 0)`.as("answer_count"),
    })
    .from(schema.questions)
    .leftJoin(answerCountSq, eq(schema.questions.id, answerCountSq.questionId))
    .leftJoin(schema.users, eq(schema.questions.userId, schema.users.id))
    .where(baseWhere)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  if (rows.length === 0) {
    return {
      items: [],
      meta: { page, pageSize, totalItems, totalPages },
    };
  }

  // ── 태그 배치 쿼리 (N+1 방지) ─────────────────────────────────────────────────
  const questionIds = rows.map((r) => r.id);

  const taggableRows = await db
    .select({
      targetId: schema.taggable.targetId,
      tagName: schema.tags.name,
    })
    .from(schema.taggable)
    .innerJoin(schema.tags, eq(schema.taggable.tagId, schema.tags.id))
    .where(
      and(
        eq(schema.taggable.targetType, "question"),
        inArray(schema.taggable.targetId, questionIds),
      ),
    );

  // questionId → 태그명 배열 맵
  const tagMap = new Map<string, string[]>();
  for (const { targetId, tagName } of taggableRows) {
    const existing = tagMap.get(targetId) ?? [];
    existing.push(tagName);
    tagMap.set(targetId, existing);
  }

  // ── QuestionListItem 조립 ────────────────────────────────────────────────────
  // 응답 형태: questionListItemResponseSchema 준수
  // author: { id, nickname, avatarUrl } | null — 플랫 필드(authorNickname) 사용 안 함
  const items: QuestionListItem[] = rows.map((row) => {
    const answerCount = Number(row.answerCount);

    // deriveQuestionStatus: is_resolved=true → acceptedAnswerId 비null 로 매핑
    const derivedStatus = deriveQuestionStatus({
      answerCount,
      acceptedAnswerId: row.isResolved ? "resolved" : null,
    });

    // 작성자: userId null(탈퇴) 또는 LEFT JOIN miss → null
    const author =
      row.authorId != null && row.authorNickname != null
        ? {
            id: row.authorId,
            nickname: row.authorNickname,
            avatarUrl: row.authorAvatarUrl ?? null,
          }
        : null;

    return {
      id: row.id,
      author,
      title: row.title,
      slug: row.slug,
      status: row.status,
      derivedStatus,
      isResolved: row.isResolved,
      viewCount: row.viewCount,
      answerCount,
      tags: tagMap.get(row.id) ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  return {
    items,
    meta: { page, pageSize, totalItems, totalPages },
  };
}

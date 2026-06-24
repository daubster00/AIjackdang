/**
 * Q&A 질문 작성 서비스 — Story 3.3
 *
 * questions 테이블에 INSERT (posts 테이블 절대 사용 금지).
 * slug: slugify(title) + generateUniqueSlug (questions.slug 대상 중복 체크).
 * 태그: taggable 테이블에 target_type='question', target_id=question.id 로 연결.
 * 임시저장: status='draft' 로 저장.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq, desc, and } from "drizzle-orm";
import { slugify, generateUniqueSlug } from "@ai-jakdang/utilities";

export type QuestionStatus = "published" | "draft";

export interface CreateQuestionParams {
  title: string;
  contentJson: Record<string, unknown>;
  tags: string[];
  status: QuestionStatus;
  userId: string;
}

export interface CreateQuestionResult {
  id: string;
  slug: string;
  status: QuestionStatus;
}

/**
 * 질문을 작성하거나 임시저장한다.
 *
 * - db.transaction() 안에서:
 *   1) questions INSERT (status, is_resolved=false, user_id, slug, content_json)
 *   2) tags upsert + taggable INSERT (target_type='question')
 * - slug: slugify(title) → questions.slug 중복 체크 → 중복 시 -{nanoid6} suffix
 * - summary 컬럼 없음 — questions 테이블에 저장하지 않는다
 *
 * @returns { id, slug, status }
 */
export async function createQuestion({
  title,
  contentJson,
  tags,
  status,
  userId,
}: CreateQuestionParams): Promise<CreateQuestionResult> {
  const db = getDb();

  // ── slug 생성 ────────────────────────────────────────────────────────────────
  const baseSlug = slugify(title) || "question";

  const slug = await generateUniqueSlug(baseSlug, async (candidate: string) => {
    const rows = await db
      .select({ id: schema.questions.id })
      .from(schema.questions)
      .where(eq(schema.questions.slug, candidate))
      .limit(1);
    return rows.length > 0;
  });

  // ── 트랜잭션: questions INSERT + tags upsert + taggable INSERT ───────────────
  return await db.transaction(async (tx) => {
    // 1) questions INSERT
    const [question] = await tx
      .insert(schema.questions)
      .values({
        userId,
        title,
        slug,
        contentJson,
        status,
        isResolved: false,
      })
      .returning({
        id: schema.questions.id,
        slug: schema.questions.slug,
        status: schema.questions.status,
      });

    if (!question) {
      throw new Error("질문 INSERT 실패");
    }

    // 2) tags upsert + taggable INSERT (태그가 있을 때만)
    if (tags.length > 0) {
      const tagIds: string[] = [];

      for (const tagName of tags) {
        const tagSlug = slugify(tagName) || tagName.toLowerCase();

        // 기존 태그 조회
        const existing = await tx
          .select({ id: schema.tags.id })
          .from(schema.tags)
          .where(eq(schema.tags.slug, tagSlug))
          .limit(1);

        if (existing.length > 0 && existing[0]) {
          tagIds.push(existing[0].id);
        } else {
          // 새 태그 INSERT
          const [created] = await tx
            .insert(schema.tags)
            .values({ name: tagName, slug: tagSlug })
            .onConflictDoNothing()
            .returning({ id: schema.tags.id });

          if (created) {
            tagIds.push(created.id);
          } else {
            // onConflictDoNothing 로 인해 반환이 없을 경우 재조회
            const retry = await tx
              .select({ id: schema.tags.id })
              .from(schema.tags)
              .where(eq(schema.tags.slug, tagSlug))
              .limit(1);
            if (retry[0]) tagIds.push(retry[0].id);
          }
        }
      }

      // taggable INSERT 배치 (target_type='question')
      if (tagIds.length > 0) {
        await tx.insert(schema.taggable).values(
          tagIds.map((tagId) => ({
            targetType: "question" as const,
            targetId: question.id,
            tagId,
          })),
        );
      }
    }

    return {
      id: question.id,
      slug: question.slug,
      status: question.status as QuestionStatus,
    };
  });
}

// ── 임시저장 조회 ──────────────────────────────────────────────────────────────

export interface GetDraftQuestionResult {
  id: string;
  title: string;
  contentJson: Record<string, unknown>;
  tags: string[];
  slug: string;
}

/**
 * 본인의 최신 draft 질문 1건을 반환한다.
 * 없으면 null.
 */
export async function getDraftQuestion(
  userId: string,
): Promise<GetDraftQuestionResult | null> {
  const db = getDb();

  const rows = await db
    .select({
      id: schema.questions.id,
      title: schema.questions.title,
      contentJson: schema.questions.contentJson,
      slug: schema.questions.slug,
    })
    .from(schema.questions)
    .where(
      and(
        eq(schema.questions.userId, userId),
        eq(schema.questions.status, "draft"),
      ),
    )
    .orderBy(desc(schema.questions.updatedAt))
    .limit(1);

  if (rows.length === 0 || !rows[0]) {
    return null;
  }

  const row = rows[0];

  // 이 질문에 연결된 태그 조회
  const taggableRows = await db
    .select({ tagName: schema.tags.name })
    .from(schema.taggable)
    .innerJoin(schema.tags, eq(schema.taggable.tagId, schema.tags.id))
    .where(
      and(
        eq(schema.taggable.targetType, "question"),
        eq(schema.taggable.targetId, row.id),
      ),
    );

  return {
    id: row.id,
    title: row.title,
    contentJson: row.contentJson as Record<string, unknown>,
    tags: taggableRows.map((t) => t.tagName),
    slug: row.slug,
  };
}

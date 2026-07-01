/**
 * 댓글 생성 도메인 서비스 — Story 11.3
 *
 * createComment(input) 함수: POST /comments 핸들러에서 추출된 도메인 로직.
 * 봇 경로(Story 11.4)에서도 이 함수를 직접 호출한다.
 *
 * 불변식 보존:
 * 1. 빈/공백 내용 차단
 * 2. parentId 검증 + 2단계 대댓글 차단
 * 3. 댓글 INSERT + returning id
 * 4. 포인트 적립 (best-effort)
 * 5. 알림 큐 발행 (best-effort)
 *
 * ⚠️  이 파일은 사용자용 댓글 생성 서비스다.
 *    관리자용 댓글 목록/숨김/삭제 서비스는
 *    apps/api/src/routes/admin/comments/service.ts (Story 9.9).
 */

import { getDb, schema } from "@ai-jakdang/database";
import { eq } from "drizzle-orm";
import { getNotificationsQueue } from "../../../lib/queues.js";
import { earnPoints, getTodayCount } from "../gamification/points.service.js";

// ── 에러 클래스 ───────────────────────────────────────────────────────────────

/**
 * 댓글 서비스 도메인 에러.
 * 라우트 핸들러에서 catch 후 400 응답으로 변환한다.
 */
export class CommentServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CommentServiceError";
  }
}

// ── 입력 타입 ──────────────────────────────────────────────────────────────────

export interface CreateCommentServiceInput {
  userId: string;    // 작성자 user_id (봇의 경우 봇 계정 user_id)
  targetType: "post" | "question" | "answer" | "resource" | "comment";
  targetId: string;  // 댓글이 달릴 대상 엔티티 ID
  content: string;   // 댓글 본문 (plain text)
  parentId?: string; // 대댓글인 경우 부모 댓글 ID
}

// ── createComment ──────────────────────────────────────────────────────────────

/**
 * 댓글을 생성한다.
 *
 * 에러 규약:
 * - 도메인 불변식 위반 시 CommentServiceError throw → 라우트가 400 응답 변환
 * - DB 장애 등 시스템 에러는 throw 그대로 위임 → 500 핸들러 처리
 *
 * @returns 생성된 댓글 id와 parentCommentAuthorId(부모 댓글 작성자 ID;
 *          최상위 댓글이면 null). 라우트가 대댓글 알림 발행에 사용한다.
 */
export async function createComment(
  input: CreateCommentServiceInput,
): Promise<{ id: string; parentCommentAuthorId: string | null }> {
  const { userId, targetType, targetId, content, parentId } = input;
  const db = getDb();

  // ── 불변식 1: 빈/공백 내용 차단 ─────────────────────────────────────────────
  if (!content.trim()) {
    throw new CommentServiceError("VALIDATION_ERROR", "댓글 내용을 입력해주세요.");
  }

  // ── 불변식 2: parentId 검증 + 2단계 대댓글 차단 ─────────────────────────────
  let parentCommentAuthorId: string | null = null;
  if (parentId) {
    const parentRows = await db
      .select({
        id: schema.comments.id,
        parentId: schema.comments.parentId,
        authorId: schema.comments.authorId,
      })
      .from(schema.comments)
      .where(eq(schema.comments.id, parentId))
      .limit(1);

    const parent = parentRows[0];
    if (!parent) {
      throw new CommentServiceError("VALIDATION_ERROR", "부모 댓글을 찾을 수 없습니다.");
    }
    if (parent.parentId !== null) {
      throw new CommentServiceError(
        "NESTING_NOT_ALLOWED",
        "2단계 이상의 대댓글은 허용되지 않습니다.",
      );
    }
    parentCommentAuthorId = parent.authorId;
  }

  // ── 불변식 3: 댓글 INSERT + returning id ────────────────────────────────────
  const inserted = await db
    .insert(schema.comments)
    .values({
      authorId: userId,
      targetType,
      targetId,
      parentId: parentId ?? null,
      content: content.trim(),
    })
    .returning({ id: schema.comments.id });

  const row = inserted[0];
  if (!row) throw new Error("INSERT comment returned no row");

  // ── 불변식 4: 포인트 적립 (best-effort) ─────────────────────────────────────
  // 실패해도 댓글 저장 유지
  try {
    const todayCount = await getTodayCount(db, { userId, reason: "comment.created" });
    await earnPoints(db, {
      userId,
      reason: "comment.created",
      sourceType: "comment",
      sourceId: row.id,
      todayCount,
    });
  } catch (err) {
    console.error("[points] 댓글 적립 실패 (무시):", (err as Error).message);
  }

  // ── 불변식 5: 알림 큐 발행 (best-effort) ────────────────────────────────────
  // parentCommentAuthorId(부모 댓글 작성자 ID)는 conditional spread 패턴 보존
  try {
    await getNotificationsQueue().add("comment.created", {
      commentId: row.id,
      authorId: userId,
      targetType,
      targetId,
      ...(parentCommentAuthorId ? { parentCommentAuthorId } : {}),
    });
  } catch {
    console.error("[comments] notifications 큐 발행 실패");
  }

  return { id: row.id, parentCommentAuthorId };
}

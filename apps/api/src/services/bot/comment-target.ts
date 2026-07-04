/**
 * 봇 댓글 대상 게시글 선택 (자동 운영 배선용).
 *
 * daily-plan 계획 단계는 `personaId` + `targetBoard`만 확정하고, 실제 댓글을 달
 * 대상 게시글(`targetPostId`)은 실행 시점에 이 함수가 선택한다.
 *
 * 선택 규칙:
 *  1. 대상 게시판의 published(게시됨) 게시글, 삭제되지 않은 것.
 *  2. 봇 자신(페르소나 연결 계정)이 쓴 글 제외 — 자기 글 자문자답 방지.
 *  3. 봇 자신이 이미 댓글을 단 글 제외 — 같은 글 중복 댓글 방지.
 *  4. 후보 중 가장 최근 글 우선. 남은 후보가 없으면 null.
 *
 * apps/api 경계 내부 서비스 — worker는 /internal/bots/comment 라우트로 위임 호출한다.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { and, desc, eq, inArray, isNull, ne, type SQL } from "drizzle-orm";

/**
 * 페르소나가 댓글을 달 대상 게시글 ID를 선택한다.
 *
 * @param personaId  봇 페르소나 ID
 * @param targetBoard 대상 게시판 슬러그
 * @returns 대상 게시글 ID, 적합한 게시글이 없으면 null
 */
export async function selectCommentTargetPost(
  personaId: string,
  targetBoard: string,
): Promise<string | null> {
  const db = getDb();

  // ── 봇 계정 userId 조회 (자기 글·자기 댓글 제외용) ────────────────────────────
  const [persona] = await db
    .select({ userId: schema.botPersonas.userId })
    .from(schema.botPersonas)
    .where(eq(schema.botPersonas.id, personaId))
    .limit(1);
  const selfUserId = persona?.userId ?? null;

  // ── 최근 게시글 후보 조회 (published · 미삭제 · 자기 글 제외) ──────────────────
  const conditions: SQL[] = [
    eq(schema.posts.board, targetBoard),
    eq(schema.posts.status, "published"),
    isNull(schema.posts.deletedAt),
  ];
  if (selfUserId) conditions.push(ne(schema.posts.userId, selfUserId));

  const candidates = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(and(...conditions))
    .orderBy(desc(schema.posts.createdAt))
    .limit(30);

  if (candidates.length === 0) return null;
  const candidateIds = candidates.map((c) => c.id);

  // ── 봇이 이미 댓글 단 게시글 제외 ─────────────────────────────────────────────
  let commentedSet = new Set<string>();
  if (selfUserId) {
    const commented = await db
      .select({ targetId: schema.comments.targetId })
      .from(schema.comments)
      .where(
        and(
          eq(schema.comments.authorId, selfUserId),
          eq(schema.comments.targetType, "post"),
          inArray(schema.comments.targetId, candidateIds),
        ),
      );
    commentedSet = new Set(commented.map((c) => c.targetId));
  }

  // 아직 댓글 안 단 최신 후보 우선, 없으면 가장 최근 후보(재댓글 허용)
  const fresh = candidateIds.find((id) => !commentedSet.has(id));
  return fresh ?? candidateIds[0] ?? null;
}

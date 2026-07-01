/**
 * 누적 신고 에스컬레이션 유틸 — Story 12.4
 *
 * 신고 처리완료(resolved) 전이 시점에 호출되어:
 * 1. 해당 콘텐츠의 작성자 userId를 귀속한다 (resolveAuthorUserId)
 * 2. 작성자의 누적 처리완료 신고 수를 집계한다 (getResolvedReportCountForUser)
 * 3. 임계치 초과 + 자동경고 활성 + 멱등 조건 충족 시 자동 경고 발부 (evaluateAuthorEscalation)
 *
 * 상한: 경고(warning) 생성만. 자동 정지/영구정지 절대 금지.
 * 멱등: Math.floor(resolvedCount / threshold) > 기존 자동경고 수 일 때만 발부.
 */

import { getDb } from "@ai-jakdang/database";
import type { Database } from "@ai-jakdang/database";
import { userSanctions } from "@ai-jakdang/database/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { getRedisPublisher } from "./redis.js";
import { getSiteSetting } from "./siteSettings.js";
import { sanctionMember } from "../routes/admin/members/service.js";
import { publishNotification } from "./notifications.js";

/**
 * targetType + targetId → 작성자 userId 귀속.
 * 각 테이블의 user_id(또는 author_id)를 단건 조회한다.
 * 'user' 케이스는 targetId 자체가 userId이므로 그대로 반환한다.
 */
export async function resolveAuthorUserId(
  targetType: string,
  targetId: string,
  db: Database,
): Promise<string | null> {
  switch (targetType) {
    case "post": {
      const result = await db.execute(
        sql`SELECT user_id FROM posts WHERE id = ${targetId} LIMIT 1`,
      );
      return (result.rows[0] as { user_id?: string } | undefined)?.user_id ?? null;
    }
    case "question": {
      const result = await db.execute(
        sql`SELECT user_id FROM questions WHERE id = ${targetId} LIMIT 1`,
      );
      return (result.rows[0] as { user_id?: string } | undefined)?.user_id ?? null;
    }
    case "answer": {
      const result = await db.execute(
        sql`SELECT user_id FROM answers WHERE id = ${targetId} LIMIT 1`,
      );
      return (result.rows[0] as { user_id?: string } | undefined)?.user_id ?? null;
    }
    case "comment": {
      const result = await db.execute(
        sql`SELECT author_id FROM comments WHERE id = ${targetId} LIMIT 1`,
      );
      return (result.rows[0] as { author_id?: string } | undefined)?.author_id ?? null;
    }
    case "resource": {
      const result = await db.execute(
        sql`SELECT user_id FROM resources WHERE id = ${targetId} LIMIT 1`,
      );
      return (result.rows[0] as { user_id?: string } | undefined)?.user_id ?? null;
    }
    case "user": {
      // 12.5 회원 신고 경로: targetId 자체가 userId
      return targetId;
    }
    default:
      return null;
  }
}

/**
 * 특정 userId에 귀속된 처리완료(resolved) 신고 수를 집계한다.
 * 브리게이딩 방어: pending/reviewing 포함 안 함 — resolved만 카운트.
 */
export async function getResolvedReportCountForUser(
  userId: string,
  db: Database,
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) AS cnt
    FROM reports r
    WHERE r.status = 'resolved'
      AND (
        (r.target_type = 'post'     AND r.target_id IN (SELECT id FROM posts      WHERE user_id   = ${userId}))
        OR (r.target_type = 'question' AND r.target_id IN (SELECT id FROM questions  WHERE user_id   = ${userId}))
        OR (r.target_type = 'answer'   AND r.target_id IN (SELECT id FROM answers    WHERE user_id   = ${userId}))
        OR (r.target_type = 'resource' AND r.target_id IN (SELECT id FROM resources  WHERE user_id   = ${userId}))
        OR (r.target_type = 'comment'  AND r.target_id IN (SELECT id FROM comments   WHERE author_id = ${userId}))
        OR (r.target_type = 'user'     AND r.target_id = ${userId})
      )
  `);
  return Number((result.rows[0] as { cnt?: string | number } | undefined)?.cnt ?? 0);
}

/**
 * 누적 처리완료 신고 평가 — 조건 충족 시 자동 경고 1건 발부.
 *
 * 조건:
 * 1. report_auto_warning_enabled = true
 * 2. resolvedCount >= threshold
 * 3. Math.floor(resolvedCount / threshold) > 기존 자동경고 수 (멱등)
 *
 * 상한: 경고(warning)만. 자동 suspend/permaban 절대 금지.
 * 알림 실패는 경고 자체를 막지 않는다 (try/catch).
 */
export async function evaluateAuthorEscalation(
  authorUserId: string,
  adminId: string | null,
): Promise<{ warned: boolean }> {
  const enabled = await getSiteSetting<boolean>("report_auto_warning_enabled");
  if (!enabled) return { warned: false };

  const threshold = (await getSiteSetting<number>("report_escalation_threshold")) ?? 5;
  const db = getDb();

  const resolvedCount = await getResolvedReportCountForUser(authorUserId, db);
  if (resolvedCount < threshold) return { warned: false };

  // 멱등: floor(resolvedCount / threshold) > 기존 자동경고 수
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(userSanctions)
    .where(
      and(
        eq(userSanctions.userId, authorUserId),
        eq(userSanctions.type, "warning"),
        sql`${userSanctions.reason} ILIKE 'auto-warning:%'`,
      ),
    );
  const existingAutoWarningCount = Number(cnt ?? 0);
  const currentBucket = Math.floor(resolvedCount / threshold);
  if (currentBucket <= existingAutoWarningCount) return { warned: false };

  // 자동 경고 생성 (type='warning' → users.status 변경 없음)
  const reason = `auto-warning:신고 누적 ${resolvedCount}회`;
  await sanctionMember(authorUserId, "warning", reason, null, adminId);

  // 알림 발송 (실패해도 경고 자체는 성공)
  try {
    const redis = getRedisPublisher();
    await publishNotification(
      authorUserId,
      {
        type: "sanction.applied",
        title: "운영 조치 안내",
        body: `신고 누적 ${resolvedCount}회로 자동 경고가 발부되었습니다.`,
      },
      db,
      redis,
    );
  } catch (err) {
    console.error("[escalation] 알림 발송 실패 (무시):", (err as Error).message);
  }

  return { warned: true };
}

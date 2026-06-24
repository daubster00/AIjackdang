/**
 * badgeCheck.processor — Story 6.4
 *
 * BullMQ ranking 큐의 'gamification.badge-check' 잡 소비.
 *
 * 처리 흐름:
 * 1. userId 수신
 * 2. 집계 쿼리 (postCount, resourceCount, downloadCount, likeReceivedCount, answerCount, weeklyActiveCount)
 * 3. shouldAwardBadge(opts) 호출 — @ai-jakdang/core 순수 함수
 * 4. is_auto=true 뱃지만 필터 후 slug→id 매핑
 * 5. user_badges INSERT ON CONFLICT DO NOTHING (멱등)
 * 6. 신규 수여분 → notifications 큐에 badge.awarded enqueue
 *
 * 설계 원칙:
 * - admin-special(is_auto=false)은 자동 수여 대상 제외 (shouldAwardBadge가 항상 false 반환)
 * - first-post 등 단방향 뱃지: 삭제해도 회수 안 함 (이 파일에 회수 로직 없음)
 * - UNIQUE(user_id, badge_id) → ON CONFLICT DO NOTHING 으로 멱등 보장
 */

// ── [6.4] badgeCheck.processor START ─────────────────────────────────────────

import type { Job } from "bullmq";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import pg from "pg";
import type { BadgeCheckJobPayload } from "@ai-jakdang/contracts";
import { shouldAwardBadge } from "@ai-jakdang/core";

// ── DB 연결 (worker 전용 — apps/api getDb와 별도) ────────────────────────────
let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/ai_jakdang";
    _pool = new pg.Pool({ connectionString: url });
    _pool.on("error", (err) => {
      console.error("[badgeCheck.processor] DB pool 오류:", err.message);
    });
  }
  return _pool;
}

// ── notifications 큐 (best-effort) ──────────────────────────────────────────
let _notificationsQueue: Queue | null = null;

function getNotificationsQueue(): Queue {
  if (!_notificationsQueue) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    const connection = new Redis(url, { maxRetriesPerRequest: null });
    _notificationsQueue = new Queue("notifications", {
      connection,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return _notificationsQueue;
}

// ── 집계 쿼리 ─────────────────────────────────────────────────────────────────

interface BadgeAggregates {
  postCount: number;
  resourceCount: number;
  downloadCount: number;
  likeReceivedCount: number;
  answerCount: number;
  weeklyActiveCount: number;
}

/**
 * userId에 대한 뱃지 판단용 집계값을 조회한다.
 *
 * downloadCount: download_logs 테이블 미존재 → resources.download_count SUM으로 대체
 * likeReceivedCount: reactions 테이블에 target_user_id 없음 → points_ledger 'reaction.received' 행 수로 집계
 * weeklyActiveCount: 최근 28일 points_ledger의 ISO week 수로 단순화
 */
async function getAggregates(userId: string): Promise<BadgeAggregates> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // 1. postCount: posts WHERE user_id = userId AND status != 'deleted'
    const postRes = await client.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
         FROM posts
        WHERE user_id = $1
          AND status != 'deleted'`,
      [userId],
    );
    const postCount = parseInt(postRes.rows[0]?.count ?? "0", 10);

    // 2. resourceCount: resources WHERE user_id = userId AND status != 'deleted'
    const resourceRes = await client.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
         FROM resources
        WHERE user_id = $1
          AND status != 'deleted'`,
      [userId],
    );
    const resourceCount = parseInt(resourceRes.rows[0]?.count ?? "0", 10);

    // 3. downloadCount: download_logs 테이블 없음 → 해당 유저가 등록한 자료들의 download_count SUM
    const downloadRes = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(download_count), 0)::int AS total
         FROM resources
        WHERE user_id = $1
          AND status != 'deleted'`,
      [userId],
    );
    const downloadCount = parseInt(downloadRes.rows[0]?.total ?? "0", 10);

    // 4. likeReceivedCount: points_ledger에서 reason='reaction.received' delta>0 건수
    //    (reactions 테이블에 target_user_id 컬럼 없으므로 포인트 원장 기반 집계)
    const likeRes = await client.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
         FROM points_ledger
        WHERE user_id = $1
          AND reason = 'reaction.received'
          AND delta > 0`,
      [userId],
    );
    const likeReceivedCount = parseInt(likeRes.rows[0]?.count ?? "0", 10);

    // 5. answerCount: answers WHERE user_id = userId AND status != 'deleted'
    const answerRes = await client.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
         FROM answers
        WHERE user_id = $1
          AND status != 'deleted'`,
      [userId],
    );
    const answerCount = parseInt(answerRes.rows[0]?.count ?? "0", 10);

    // 6. weeklyActiveCount: 최근 28일 points_ledger에서 활동한 ISO week 수
    //    (4주 연속 활동 여부 단순화: 최근 28일 내 ISO주 개수가 4인지)
    const weekRes = await client.query<{ week_count: string }>(
      `SELECT COUNT(DISTINCT EXTRACT(WEEK FROM created_at))::int AS week_count
         FROM points_ledger
        WHERE user_id = $1
          AND delta > 0
          AND created_at >= NOW() - INTERVAL '28 days'`,
      [userId],
    );
    const weeklyActiveCount = parseInt(weekRes.rows[0]?.week_count ?? "0", 10);

    return {
      postCount,
      resourceCount,
      downloadCount,
      likeReceivedCount,
      answerCount,
      weeklyActiveCount,
    };
  } finally {
    client.release();
  }
}

// ── 프로세서 ─────────────────────────────────────────────────────────────────

/**
 * gamification.badge-check 잡 처리기.
 *
 * - 집계 → shouldAwardBadge → is_auto=true 뱃지만 insert ON CONFLICT DO NOTHING
 * - rowCount > 0인 신규 수여분만 badge.awarded 이벤트 발행
 * - admin-special 은 is_auto=false이므로 shouldAwardBadge에서 항상 제외됨
 */
export async function badgeCheckProcessor(job: Job<BadgeCheckJobPayload>): Promise<void> {
  const { userId } = job.data;

  console.info(`[badgeCheck.processor] badge-check 잡 처리 시작: userId=${userId}`);

  const pool = getPool();
  const client = await pool.connect();

  try {
    // ── 1. 집계 조회 ─────────────────────────────────────────────────────────
    const aggregates = await getAggregates(userId);

    console.info(`[badgeCheck.processor] 집계 완료:`, { userId, ...aggregates });

    // ── 2. shouldAwardBadge 호출 ─────────────────────────────────────────────
    const earnedSlugs = shouldAwardBadge(aggregates);

    if (earnedSlugs.length === 0) {
      console.info(`[badgeCheck.processor] 달성 뱃지 없음: userId=${userId}`);
      return;
    }

    console.info(`[badgeCheck.processor] 달성 뱃지:`, { userId, slugs: earnedSlugs });

    // ── 3. badges 테이블에서 slug→id 매핑 조회 (is_auto=true 만) ─────────────
    const slugList = earnedSlugs.map((_, i) => `$${i + 1}`).join(", ");
    const badgesRes = await client.query<{ id: string; slug: string; name: string }>(
      `SELECT id, slug, name
         FROM badges
        WHERE slug IN (${slugList})
          AND is_auto = true`,
      earnedSlugs,
    );

    if (badgesRes.rows.length === 0) {
      console.warn(`[badgeCheck.processor] 매핑 가능한 자동 뱃지 없음: userId=${userId}`);
      return;
    }

    // ── 4. user_badges INSERT ON CONFLICT DO NOTHING (멱등) ──────────────────
    const newlyAwarded: { badgeSlug: string; badgeName: string }[] = [];

    for (const badge of badgesRes.rows) {
      const insertRes = await client.query(
        `INSERT INTO user_badges (user_id, badge_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [userId, badge.id],
      );

      if (insertRes.rowCount && insertRes.rowCount > 0) {
        newlyAwarded.push({ badgeSlug: badge.slug, badgeName: badge.name });
        console.info(
          `[badgeCheck.processor] 뱃지 신규 수여: userId=${userId} slug=${badge.slug}`,
        );
      } else {
        console.info(
          `[badgeCheck.processor] 이미 보유한 뱃지 skip: userId=${userId} slug=${badge.slug}`,
        );
      }
    }

    // ── 5. 신규 수여분만 notifications 큐에 badge.awarded enqueue ─────────────
    if (newlyAwarded.length > 0) {
      try {
        const notifQueue = getNotificationsQueue();
        for (const { badgeSlug, badgeName } of newlyAwarded) {
          await notifQueue.add("badge.awarded", { userId, badgeSlug, badgeName });
          console.info(
            `[badgeCheck.processor] badge.awarded 이벤트 발행: userId=${userId} slug=${badgeSlug}`,
          );
        }
      } catch (err) {
        // notifications 큐 enqueue 실패는 로그만 (best-effort)
        console.error(
          `[badgeCheck.processor] notifications 큐 enqueue 실패:`,
          (err as Error).message,
        );
      }
    }

    console.info(
      `[badgeCheck.processor] 처리 완료: userId=${userId} 신규수여=${newlyAwarded.length}개`,
    );
  } finally {
    client.release();
  }
}

// ── [6.4] badgeCheck.processor END ───────────────────────────────────────────

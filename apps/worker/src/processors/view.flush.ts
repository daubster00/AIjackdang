/**
 * view.flush processor — Story 2.4 + Story 5.3
 *
 * BullMQ 반복 job(매 1분). Redis의 view:{targetType}:{id} 키를 스캔하여
 * 해당 테이블의 view_count에 누적 flush 후 키 삭제.
 *
 * 지원 타겟: post, question, resource (Story 5.3 추가)
 *
 * 키 패턴:
 *   incr key  : view:post:{id} / view:question:{id} / view:resource:{id}
 *   dedup key : view:post:{id}:{fp} (old, 4 segment) OR view:dedup:{type}:{id}:{fp} (new, 5 segment)
 *   → dedup 키는 SCAN 패턴에서 제외됨 (segment 수 또는 prefix로 구분)
 *
 * 멱등 처리: Lua 스크립트로 GET+DEL 원자 실행 → 재시도 시 중복 없음.
 * AR-16·AR-17: 직접 UPDATE 허용(worker flush 경로만).
 */

import type { Job } from "bullmq";
import { Redis } from "ioredis";
import { getDb, schema } from "@ai-jakdang/database";
import { eq, sql } from "drizzle-orm";

// Redis 연결 (view-flush 전용)
let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6380";
    _redis = new Redis(url, { maxRetriesPerRequest: null });
    _redis.on("error", (err) => {
      console.error("[view.flush] Redis 오류:", err.message);
    });
  }
  return _redis;
}

/**
 * Lua 스크립트: GET + DEL 원자 실행.
 * 반환: 값 (삭제 성공) or null (없음)
 */
const GET_DEL_SCRIPT = `
local val = redis.call("GET", KEYS[1])
if val then
  redis.call("DEL", KEYS[1])
  return val
end
return false
`;

type TargetType = "post" | "question" | "resource";

/**
 * `view:{targetType}:{uuid}` 패턴 키에서 targetType과 id를 추출한다.
 * - 3 segment: incr 키 → 처리 대상
 * - 4+ segment: dedup 키 (old pattern "view:post:{id}:{fp}") → 건너뜀
 * - "view:dedup:..." 키도 건너뜀
 */
function extractTarget(key: string): { targetType: TargetType; targetId: string } | null {
  if (key.startsWith("view:dedup:")) return null;
  const parts = key.split(":");
  // 정확히 3 segment만 incr 키 (view:{type}:{uuid})
  if (parts.length !== 3) return null;
  const targetType = parts[1] as TargetType;
  if (!["post", "question", "resource"].includes(targetType)) return null;
  return { targetType, targetId: parts[2]! };
}

async function flushTarget(
  redis: Redis,
  pattern: string,
  processed: Map<string, { targetType: TargetType; delta: number }>,
): Promise<void> {
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;

    for (const key of keys) {
      const extracted = extractTarget(key);
      if (!extracted) continue;

      const rawVal = (await redis.eval(GET_DEL_SCRIPT, 1, key)) as string | null;
      if (!rawVal) continue;

      const delta = parseInt(rawVal, 10);
      if (!Number.isFinite(delta) || delta <= 0) continue;

      const existing = processed.get(extracted.targetId);
      processed.set(extracted.targetId, {
        targetType: extracted.targetType,
        delta: (existing?.delta ?? 0) + delta,
      });
    }
  } while (cursor !== "0");
}

export async function viewFlushProcessor(_job: Job): Promise<void> {
  const redis = getRedis();
  const db = getDb();

  const processed = new Map<string, { targetType: TargetType; delta: number }>();

  await flushTarget(redis, "view:post:*", processed);
  await flushTarget(redis, "view:question:*", processed);
  await flushTarget(redis, "view:resource:*", processed);

  if (processed.size === 0) return;

  let totalCount = 0;
  for (const [targetId, { targetType, delta }] of processed) {
    try {
      if (targetType === "post") {
        await db
          .update(schema.posts)
          .set({ viewCount: sql`${schema.posts.viewCount} + ${delta}` })
          .where(eq(schema.posts.id, targetId));
      } else if (targetType === "question") {
        await db
          .update(schema.questions)
          .set({ viewCount: sql`${schema.questions.viewCount} + ${delta}` })
          .where(eq(schema.questions.id, targetId));
      } else if (targetType === "resource") {
        await db
          .update(schema.resources)
          .set({ viewCount: sql`${schema.resources.viewCount} + ${delta}` })
          .where(eq(schema.resources.id, targetId));
      }
      totalCount += delta;
    } catch (err) {
      console.error(
        `[view.flush] DB 업데이트 실패 ${targetType}=${targetId}:`,
        (err as Error).message,
      );
    }
  }

  console.info(
    `[view.flush] flush 완료: ${processed.size}개 콘텐츠, 총 ${totalCount}회`,
  );
}

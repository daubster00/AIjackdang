/**
 * view.flush processor — Story 2.4
 *
 * BullMQ 반복 job(매 1분). Redis의 view:post:{id} 키를 스캔하여
 * DB posts.view_count 에 누적 flush 후 키 삭제.
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
 * 값이 없거나 0이면 false 반환 → 업데이트 건너뜀.
 * 반환: value (삭제 성공) or null (없음)
 */
const GET_DEL_SCRIPT = `
local val = redis.call("GET", KEYS[1])
if val then
  redis.call("DEL", KEYS[1])
  return val
end
return false
`;

/**
 * view:post:{id} 패턴 키에서 postId를 추출한다.
 * dedup 키(view:post:{id}:{fp})는 건너뜀 — 콜론이 2개인 것만 처리.
 */
function extractPostId(key: string): string | null {
  // key 형식: "view:post:{uuid}" — 정확히 3 segment
  const parts = key.split(":");
  if (parts.length !== 3) return null; // dedup key는 4+ segment
  return parts[2] ?? null;
}

export async function viewFlushProcessor(_job: Job): Promise<void> {
  const redis = getRedis();
  const db = getDb();

  let cursor = "0";
  const processed = new Map<string, number>();

  do {
    // SCAN view:post:* — dedup 키(4 segment)도 함께 나오므로 extractPostId로 필터
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "view:post:*", "COUNT", 100);
    cursor = nextCursor;

    for (const key of keys) {
      const postId = extractPostId(key);
      if (!postId) continue; // dedup 키 건너뜀

      // 원자적 GET+DEL
      const rawVal = await redis.eval(GET_DEL_SCRIPT, 1, key) as string | null;
      if (!rawVal) continue;

      const delta = parseInt(rawVal, 10);
      if (!Number.isFinite(delta) || delta <= 0) continue;

      // 같은 postId가 여러 번 나올 수 있으므로 누산
      processed.set(postId, (processed.get(postId) ?? 0) + delta);
    }
  } while (cursor !== "0");

  if (processed.size === 0) {
    return;
  }

  // DB flush — 각 postId에 대해 view_count += delta
  for (const [postId, delta] of processed) {
    try {
      await db
        .update(schema.posts)
        .set({ viewCount: sql`${schema.posts.viewCount} + ${delta}` })
        .where(eq(schema.posts.id, postId));
    } catch (err) {
      console.error(`[view.flush] DB 업데이트 실패 postId=${postId}:`, (err as Error).message);
      // 개별 실패는 로깅만 — 다른 키 처리 계속
    }
  }

  console.info(
    `[view.flush] flush 완료: ${processed.size}개 게시글, 총 ${[...processed.values()].reduce((a, b) => a + b, 0)}회`,
  );
}

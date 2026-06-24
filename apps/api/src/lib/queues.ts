/**
 * BullMQ Queue 인스턴스 — Story 4.5
 *
 * API 서버에서 BullMQ job을 발행(produce)하기 위한 Queue 인스턴스.
 * Worker는 별도 프로세스(apps/worker)에서 소비한다.
 *
 * 큐명: 'file-scan' (AR-16)
 * job명: 'resource.scan' (AR-16)
 * Redis 연결: env.REDIS_URL
 */

import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "@ai-jakdang/config";
import type { ResourceScanJobPayload } from "@ai-jakdang/contracts";

/** BullMQ 큐 이름 상수 */
export const FILE_SCAN_QUEUE_NAME = "file-scan" as const;

/** BullMQ job 이름 상수 */
export const RESOURCE_SCAN_JOB_NAME = "resource.scan" as const;

let _redis: Redis | null = null;

function getQueueConnection(): Redis {
  if (!_redis) {
    _redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    _redis.on("error", (err) => {
      console.error("[queues] Redis 연결 오류:", err.message);
    });
  }
  return _redis;
}

let _fileScanQueue: Queue<ResourceScanJobPayload> | null = null;

/**
 * 파일 바이러스 스캔 큐 인스턴스를 반환한다(지연 초기화 싱글톤).
 * API가 파일 업로드 후 job을 발행할 때 사용한다.
 */
export function getFileScanQueue(): Queue<ResourceScanJobPayload> {
  if (!_fileScanQueue) {
    _fileScanQueue = new Queue<ResourceScanJobPayload>(FILE_SCAN_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return _fileScanQueue;
}

/** stats 큐 이름 (Story 5.2, AR-16) — worker QUEUE_NAMES.stats와 동일해야 함 */
export const STATS_QUEUE_NAME = "stats-aggregation" as const;

let _statsQueue: Queue | null = null;

/**
 * 통계 집계 큐 인스턴스를 반환한다(지연 초기화 싱글톤).
 * reaction.created 등 활동 이벤트를 발행한다. Epic 6 포인트 처리가 소비.
 */
export function getStatsQueue(): Queue {
  if (!_statsQueue) {
    _statsQueue = new Queue(STATS_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return _statsQueue;
}

/** notifications 큐 이름 (Story 5.4) — worker QUEUE_NAMES.notifications와 동일해야 함 */
export const NOTIFICATIONS_QUEUE_NAME = "notifications" as const;

let _notificationsQueue: Queue | null = null;

/**
 * 알림 큐 인스턴스를 반환한다(지연 초기화 싱글톤).
 * comment.created 등 이벤트를 발행한다. Epic 7 SSE·푸시 전송이 소비.
 */
export function getNotificationsQueue(): Queue {
  if (!_notificationsQueue) {
    _notificationsQueue = new Queue(NOTIFICATIONS_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return _notificationsQueue;
}

// ── [8.6] og-fetch 큐 ─────────────────────────────────────────────────────────
/** og-fetch 큐 이름 (Story 8.6) — worker QUEUE_NAMES.ogFetch와 동일해야 함 */
export const OG_FETCH_QUEUE_NAME = "og-fetch" as const;

/** BullMQ og.fetch 잡 이름 (Story 8.6) */
export const OG_FETCH_JOB_NAME = "og.fetch" as const;

let _ogFetchQueue: Queue | null = null;

/**
 * OG 메타 수집 큐 인스턴스를 반환한다(지연 초기화 싱글톤).
 * 게시글·질문 저장 후 외부 URL 목록과 함께 잡을 발행한다.
 */
export function getOgFetchQueue(): Queue {
  if (!_ogFetchQueue) {
    _ogFetchQueue = new Queue(OG_FETCH_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "fixed",
          delay: 5000,
        },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return _ogFetchQueue;
}
// ── [8.6] END ─────────────────────────────────────────────────────────────────

/** ranking 큐 이름 (Story 6.3) — worker QUEUE_NAMES.ranking와 동일해야 함 */
export const RANKING_QUEUE_NAME = "ranking" as const;

/** BullMQ job 이름 상수 (ranking 큐) */
export const GRADE_UP_JOB_NAME = "gamification.grade-up" as const;

// ── [6.4] ─────────────────────────────────────────────────────────────────────
/** BullMQ badge-check 잡 이름 (Story 6.4) */
export const BADGE_CHECK_JOB_NAME = "gamification.badge-check" as const;
// ── [6.4] END ─────────────────────────────────────────────────────────────────

// ── [6.4] ranking 큐는 grade-up / badge-check / (6.5) ranking.compute 잡을 공유한다.
// 여러 페이로드 타입을 단일 Queue 인스턴스에서 사용하므로 제네릭을 넓힌다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _rankingQueue: Queue<any> | null = null;

/**
 * 랭킹/등급 큐 인스턴스를 반환한다(지연 초기화 싱글톤).
 *
 * 현재 사용 잡:
 * - gamification.grade-up: 등급 변동 감지 후 알림 발행 (Story 6.3)
 * - gamification.badge-check: 뱃지 조건 재평가 (Story 6.4)
 *
 * 향후 확장:
 * - Story 6.5: ranking.compute 잡 추가
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRankingQueue(): Queue<any> {
  if (!_rankingQueue) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _rankingQueue = new Queue<any>(RANKING_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return _rankingQueue;
}

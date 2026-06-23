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

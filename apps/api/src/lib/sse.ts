/**
 * SSE 커넥션 맵 — Story 7.1
 *
 * 사용자 ID별 SSE 연결을 관리한다.
 * 다중 탭/기기 지원: userId → Set<FastifyReply>.
 *
 * 이 모듈은 단일 프로세스 범위 내 커넥션을 추적한다.
 * ECS 다중 인스턴스 팬아웃은 Redis Pub/Sub(redis-pubsub.ts)이 담당한다.
 */

import type { FastifyReply } from "fastify";

/**
 * userId 기준으로 SSE 커넥션을 보관한다.
 * Map<userId, Set<FastifyReply>>: 같은 유저의 다중 탭/기기 지원.
 */
export class SseConnectionMap {
  private readonly map = new Map<string, Set<FastifyReply>>();

  /** 커넥션 등록 */
  add(userId: string, reply: FastifyReply): void {
    if (!this.map.has(userId)) {
      this.map.set(userId, new Set());
    }
    this.map.get(userId)!.add(reply);
  }

  /** 커넥션 제거 */
  remove(userId: string, reply: FastifyReply): void {
    const set = this.map.get(userId);
    if (!set) return;
    set.delete(reply);
    if (set.size === 0) {
      this.map.delete(userId);
    }
  }

  /**
   * 특정 유저의 모든 SSE 커넥션에 이벤트를 전송한다.
   * @param userId 수신자 userId
   * @param event SSE 이벤트 문자열 (예: `event: notification\ndata: {...}\n\n`)
   */
  push(userId: string, event: string): void {
    const set = this.map.get(userId);
    if (!set || set.size === 0) return;
    for (const reply of set) {
      try {
        reply.raw.write(event);
      } catch {
        // 클라이언트가 이미 연결을 끊은 경우 조용히 무시
      }
    }
  }

  /** 현재 연결된 유저 수 (디버깅용) */
  get size(): number {
    return this.map.size;
  }

  /** 특정 유저의 커넥션 수 (디버깅용) */
  connectionCount(userId: string): number {
    return this.map.get(userId)?.size ?? 0;
  }
}

/** 프로세스 전역 싱글톤 SSE 커넥션 맵 */
export const sseConnectionMap = new SseConnectionMap();

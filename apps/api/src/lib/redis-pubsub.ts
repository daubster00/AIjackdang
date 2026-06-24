/**
 * Redis Pub/Sub 구독자 인스턴스 — Story 7.1
 *
 * BullMQ 및 publisher 용 ioredis 인스턴스와 반드시 별개 인스턴스를 사용한다.
 * ioredis subscriber 모드는 SUBSCRIBE/PSUBSCRIBE/UNSUBSCRIBE 명령만 허용하며
 * 다른 명령(PUBLISH, GET 등)을 혼용할 수 없다.
 *
 * 채널 패턴: `notification:{userId}`
 * 메시지 수신 시 → sseConnectionMap.push(userId, sseEvent) 호출.
 */

import { Redis } from "ioredis";
import { env } from "@ai-jakdang/config";
import { sseConnectionMap } from "./sse.js";

let _subscriber: Redis | null = null;

/**
 * Redis subscriber 전용 인스턴스를 반환한다 (지연 초기화 싱글톤).
 * 이 인스턴스는 SUBSCRIBE 전용이므로 다른 명령을 혼용하지 않는다.
 */
function getSubscriber(): Redis {
  if (!_subscriber) {
    _subscriber = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    _subscriber.on("error", (err) => {
      console.warn("[redis-pubsub] Redis subscriber 오류:", (err as Error).message);
    });

    // 메시지 수신 핸들러
    _subscriber.on("message", (channel: string, message: string) => {
      // channel = "notification:{userId}"
      const prefix = "notification:";
      if (!channel.startsWith(prefix)) return;
      const userId = channel.slice(prefix.length);
      if (!userId) return;

      // SSE 이벤트 형식으로 변환하여 해당 유저의 모든 커넥션에 push
      const sseEvent = `event: notification\ndata: ${message}\n\n`;
      sseConnectionMap.push(userId, sseEvent);
    });
  }
  return _subscriber;
}

/**
 * `notification:{userId}` 채널을 구독한다.
 * 다른 인스턴스가 해당 채널에 PUBLISH하면 onMessage 핸들러가 호출된다.
 */
export async function subscribeUserNotifications(userId: string): Promise<void> {
  const sub = getSubscriber();
  await sub.subscribe(`notification:${userId}`);
}

/**
 * `notification:{userId}` 채널 구독을 해제한다.
 * SSE 클라이언트가 연결을 끊을 때 호출한다.
 */
export async function unsubscribeUserNotifications(userId: string): Promise<void> {
  const sub = getSubscriber();
  await sub.unsubscribe(`notification:${userId}`);
}

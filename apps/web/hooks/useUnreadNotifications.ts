"use client";

/**
 * useUnreadNotifications — 헤더 미읽음 알림 배지 실시간화 훅 (Story 7.2)
 *
 * - 마운트 시 GET /api/v1/notifications/unread-count 조회
 * - SSE(EventSource)로 실시간 push 수신 → count +1
 * - SSE error/close 시 unread-count 재조회
 * - 언마운트 시 EventSource.close() 정리
 */

import { useCallback, useEffect, useState } from "react";

export interface UseUnreadNotificationsReturn {
  count: number;
  /** 외부에서 수동으로 감소 가능 (읽음 처리 후 호출) */
  decrement: (by?: number) => void;
  /** 배지를 0으로 초기화 (전체 읽음 처리 후 호출) */
  reset: () => void;
  /** 서버에서 최신 카운트를 다시 조회 */
  refresh: () => Promise<void>;
}

async function fetchUnreadCount(): Promise<number> {
  try {
    const res = await fetch("/api/v1/notifications/unread-count", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { count: number };
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

export function useUnreadNotifications(isLoggedIn: boolean): UseUnreadNotificationsReturn {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const cnt = await fetchUnreadCount();
    setCount(cnt);
  }, []);

  // 초기 로드 + SSE 연결
  useEffect(() => {
    if (!isLoggedIn) {
      setCount(0);
      return;
    }

    // 마운트 시 최초 조회
    void refresh();

    // SSE 실시간 구독
    const es = new EventSource("/api/v1/notifications/sse", {
      withCredentials: true,
    });

    // 새 알림 push → 배지 +1
    es.addEventListener("notification", () => {
      setCount((c) => c + 1);
    });

    // SSE 에러(재연결 전) → 최신 카운트 재조회
    es.addEventListener("error", () => {
      void fetchUnreadCount().then((cnt) => setCount(cnt));
    });

    return () => {
      es.close();
    };
  }, [isLoggedIn, refresh]);

  const decrement = useCallback((by = 1) => {
    setCount((c) => Math.max(0, c - by));
  }, []);

  const reset = useCallback(() => {
    setCount(0);
  }, []);

  return { count, decrement, reset, refresh };
}

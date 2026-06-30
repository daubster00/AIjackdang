"use client";

/**
 * NotificationCountContext — 미읽음 알림 카운트 전역 공유 컨텍스트
 *
 * SiteHeader 와 NotificationsPage 가 동일한 카운트 인스턴스를 공유하도록
 * Context Provider 로 단일화한다. 기존 useUnreadNotifications 훅은 독립
 * 인스턴스를 만들어 두 컴포넌트 간 동기화가 불가능했던 구조적 결함을 해소한다.
 *
 * - useAuth() 로 로그인 상태 감지 → 로그인 시 SSE 구독 + 초기 count 조회
 * - 알림 읽음 처리 시 decrement(), 전체 읽음 시 reset() 호출 → 즉시 반영
 * - SSE 에러(재연결 전) → unread-count API 재조회
 * - layout.tsx 최상단에 마운트되어 SiteHeader / NotificationsPage 모두 consume
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";

export interface NotificationCountContextValue {
  count: number;
  /** 읽음 처리 후 카운트 감소 */
  decrement: (by?: number) => void;
  /** 전체 읽음 처리 후 카운트 0으로 초기화 */
  reset: () => void;
  /** 서버에서 최신 카운트 재조회 */
  refresh: () => Promise<void>;
}

const NotificationCountContext = createContext<NotificationCountContextValue | null>(null);

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

export function NotificationCountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const cnt = await fetchUnreadCount();
    setCount(cnt);
  }, []);

  // 로그인 상태 변경 시 초기 count 조회 + SSE 구독
  useEffect(() => {
    if (!isLoggedIn) {
      setCount(0);
      return;
    }

    // 마운트 시 최초 조회
    void refresh();

    // SSE 실시간 구독 — 새 알림 수신 시 배지 +1
    const es = new EventSource("/api/v1/notifications/sse", {
      withCredentials: true,
    });

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

  const value = useMemo<NotificationCountContextValue>(
    () => ({ count, decrement, reset, refresh }),
    [count, decrement, reset, refresh],
  );

  return (
    <NotificationCountContext.Provider value={value}>
      {children}
    </NotificationCountContext.Provider>
  );
}

/** NotificationCountContext 를 consume 하는 훅. Provider 바깥에서 사용하면 에러. */
export function useNotificationCount(): NotificationCountContextValue {
  const ctx = useContext(NotificationCountContext);
  if (!ctx) {
    throw new Error(
      "useNotificationCount must be used within <NotificationCountProvider>",
    );
  }
  return ctx;
}

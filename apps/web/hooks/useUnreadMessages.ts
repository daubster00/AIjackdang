"use client";

/**
 * useUnreadMessages — 헤더 쪽지함 미읽음 배지 훅
 *
 * 대화 목록(GET /api/v1/messages/conversations)의 대화별 unreadCount 를 합산해
 * 헤더 쪽지 아이콘에 표시할 총 미읽음 개수를 제공한다.
 * (전용 unread-count 엔드포인트가 없어 대화 목록을 합산한다.)
 *
 * - 마운트 시 1회 조회
 * - 창이 다시 포커스될 때 재조회 (쪽지함을 읽고 돌아오면 갱신)
 */

import { useCallback, useEffect, useState } from "react";

interface Conversation {
  unreadCount: number;
}

async function fetchUnreadMessageCount(): Promise<number> {
  try {
    const res = await fetch("/api/v1/messages/conversations", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { items?: Conversation[] };
    return (data.items ?? []).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  } catch {
    return 0;
  }
}

export function useUnreadMessages(isLoggedIn: boolean): { count: number; refresh: () => Promise<void> } {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const cnt = await fetchUnreadMessageCount();
    setCount(cnt);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setCount(0);
      return;
    }

    void refresh();

    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isLoggedIn, refresh]);

  return { count, refresh };
}

"use client";

/**
 * NotificationAlert — 페이지 이동·새로고침 시 새 알림/쪽지 팝업
 *
 * - 경로 변경(usePathname) 또는 최초 마운트 시 미읽음 알림·쪽지 count를 조회한다.
 * - localStorage에 저장된 마지막으로 확인한 count보다 현재 count가 커졌을 때만
 *   toast(화면 정중앙 오버레이)를 띄운다.
 * - 팝업 후 localStorage를 갱신해 다음 이동에서 중복 팝업이 뜨지 않게 한다.
 * - 비로그인 상태에서는 아무 것도 하지 않는다.
 *
 * 판별 방식: unread-count API / conversations 합산 기반
 *   - 알림: GET /api/v1/notifications/unread-count → count 조회
 *   - 쪽지: GET /api/v1/messages/conversations → unreadCount 합산
 *   - localStorage key: aijakdang.lastSeenNotificationCount / aijakdang.lastSeenMessageCount
 *   - count 증가분 기준 → 같거나 줄었으면 팝업 없음, 커졌을 때만 팝업
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui";

const LS_NOTIF_COUNT = "aijakdang.lastSeenNotificationCount";
const LS_MSG_COUNT = "aijakdang.lastSeenMessageCount";

async function fetchUnreadNotifCount(): Promise<number> {
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

async function fetchUnreadMsgCount(): Promise<number> {
  try {
    const res = await fetch("/api/v1/messages/conversations", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { items?: { unreadCount: number }[] };
    return (data.items ?? []).reduce(
      (sum, c) => sum + (c.unreadCount ?? 0),
      0,
    );
  } catch {
    return 0;
  }
}

function readStoredCount(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return -1; // 아직 한 번도 저장 안 된 경우: 첫 방문 팝업 허용
    const n = parseInt(raw, 10);
    return isNaN(n) ? -1 : n;
  } catch {
    return -1;
  }
}

function writeStoredCount(key: string, count: number): void {
  try {
    localStorage.setItem(key, String(count));
  } catch {
    // localStorage 사용 불가 환경 무시
  }
}

export function NotificationAlert() {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const { toast } = useToast();
  // toast 참조를 ref에 보관해 effect deps 노이즈 제거
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if (!ready || !user) {
      return;
    }

    let cancelled = false;

    async function check() {
      const [notifCount, msgCount] = await Promise.all([
        fetchUnreadNotifCount(),
        fetchUnreadMsgCount(),
      ]);
      if (cancelled) return;

      const lastNotif = readStoredCount(LS_NOTIF_COUNT);
      const lastMsg = readStoredCount(LS_MSG_COUNT);

      // 알림: 이전에 본 count보다 새로 늘어난 미읽음이 있을 때만 팝업
      if (notifCount > 0 && notifCount > lastNotif) {
        toastRef.current({
          tone: "info",
          title: `읽지 않은 알림이 ${notifCount}개 있습니다`,
          description: "알림 페이지에서 확인해 보세요.",
          duration: 7000,
        });
      }
      writeStoredCount(LS_NOTIF_COUNT, notifCount);

      // 쪽지: 이전에 본 count보다 새로 늘어난 미읽음이 있을 때만 팝업
      if (msgCount > 0 && msgCount > lastMsg) {
        toastRef.current({
          tone: "info",
          title: `읽지 않은 쪽지가 ${msgCount}개 있습니다`,
          description: "쪽지함에서 확인해 보세요.",
          duration: 7000,
        });
      }
      writeStoredCount(LS_MSG_COUNT, msgCount);
    }

    void check();

    return () => {
      cancelled = true;
    };
    // pathname: 경로 변경마다 재실행 / user.id: 다른 사용자로 전환 시 재실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, ready, user?.id]);

  return null;
}

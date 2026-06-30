"use client";

/**
 * PageViewTracker — 라우트 변경 시마다 POST /api/v1/analytics/collect를 호출해
 * 방문 로그를 적재한다.
 *
 * - visitorId: localStorage "aj_visitor_id" (없으면 crypto.randomUUID 생성·저장)
 * - referrer: document.referrer (최초 진입 시의 외부 유입처)
 * - searchKeyword: 내부 검색 페이지(/search) URL의 q 파라미터
 * - navigator.sendBeacon 우선, 폴백 fetch(keepalive, credentials:"include")
 *
 * 체류시간(dwell_ms) 추적:
 * - 라우트 진입 시 Date.now() 를 기록.
 * - SPA 이동(pathname 변경) 시 이전 경로의 체류시간을 비콘으로 전송.
 * - pagehide / visibilitychange(hidden) 이벤트 시 현재 경로의 체류시간을 전송.
 *
 * 루트 레이아웃(layout.tsx)에 <PageViewTracker /> 한 줄 추가로 마운트한다.
 */

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const VISITOR_ID_KEY = "aj_visitor_id";
const COLLECT_URL    = "/api/v1/analytics/collect";

/** localStorage에서 visitorId를 읽거나, 없으면 생성·저장 후 반환 */
function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const newId = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, newId);
    return newId;
  } catch {
    // localStorage 접근 불가(시크릿 모드 등) → 임시 ID 반환 (비저장)
    return crypto.randomUUID();
  }
}

/** 현재 pathname이 내부 검색 경로면 q 파라미터 반환, 아니면 undefined */
function extractSearchKeyword(
  pathname: string,
  searchParams: URLSearchParams,
): string | undefined {
  if (pathname.startsWith("/search")) {
    const q = searchParams.get("q");
    return q && q.trim() !== "" ? q.trim() : undefined;
  }
  return undefined;
}

/**
 * 체류시간 비콘 전송.
 * dwellMs 가 0 이하이거나 비정상(1시간 초과)이면 무시.
 */
function sendDwellBeacon(path: string, startTime: number): void {
  const dwellMs = Date.now() - startTime;
  // 0ms 이하 또는 1시간 초과는 측정 오류로 무시
  if (dwellMs <= 0 || dwellMs > 3_600_000) return;

  const visitorId = getOrCreateVisitorId();
  const payload = JSON.stringify({ path, visitorId, dwellMs });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      COLLECT_URL,
      new Blob([payload], { type: "application/json" }),
    );
    if (sent) return;
  }

  // sendBeacon 실패 또는 미지원 시 fetch 폴백
  fetch(COLLECT_URL, {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    body:        payload,
    keepalive:   true,
    credentials: "include",
  }).catch(() => {});
}

export function PageViewTracker() {
  const pathname      = usePathname();
  const searchParams  = useSearchParams();

  // 이전 경로를 추적해 라우트 실제 변경 시에만 전송
  const prevKeyRef  = useRef<string>("");
  // 체류시간 추적: 마지막으로 진입한 경로와 진입 시각
  const prevPathRef  = useRef<string | null>(null);
  const entryTimeRef = useRef<number>(0);

  // ── 페이지뷰 + 체류시간 비콘(이전 경로 이탈) ────────────────────────────────
  useEffect(() => {
    const currentKey = `${pathname}?${searchParams.toString()}`;
    if (prevKeyRef.current === currentKey) return;

    // 이전 경로의 체류시간을 전송 (SPA 이동 시)
    if (prevPathRef.current !== null && entryTimeRef.current > 0) {
      sendDwellBeacon(prevPathRef.current, entryTimeRef.current);
    }

    // 새 경로 진입 기록
    prevKeyRef.current  = currentKey;
    prevPathRef.current = pathname;
    entryTimeRef.current = Date.now();

    const visitorId     = getOrCreateVisitorId();
    const referrer      = document.referrer || undefined;
    const searchKeyword = extractSearchKeyword(pathname, searchParams as unknown as URLSearchParams);

    const payload = JSON.stringify({
      path:     pathname,          // 쿼리스트링은 서버에서 제거
      referrer,
      searchKeyword,
      visitorId,
    });

    // sendBeacon 우선 (탭 닫혀도 전송 보장), 폴백 fetch
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon(COLLECT_URL, blob);
      if (sent) return;
    }

    // sendBeacon 실패 또는 미지원 시 fetch 폴백
    fetch(COLLECT_URL, {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      body:        payload,
      keepalive:   true,
      credentials: "include",
    }).catch(() => {
      // 전송 실패는 조용히 무시 (방문 추적 실패가 UX 영향 주면 안 됨)
    });
  }, [pathname, searchParams]);

  // ── 탭 닫힘 / 백그라운드 전환 시 현재 경로 체류시간 전송 ─────────────────────
  useEffect(() => {
    function handleExit() {
      if (prevPathRef.current !== null && entryTimeRef.current > 0) {
        sendDwellBeacon(prevPathRef.current, entryTimeRef.current);
        // 이중 전송 방지: 진입시각 리셋
        entryTimeRef.current = 0;
      }
    }

    function handleVisibility() {
      if (document.hidden) handleExit();
    }

    window.addEventListener("pagehide", handleExit);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pagehide", handleExit);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}

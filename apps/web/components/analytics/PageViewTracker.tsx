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

export function PageViewTracker() {
  const pathname      = usePathname();
  const searchParams  = useSearchParams();

  // 이전 경로를 추적해 라우트 실제 변경 시에만 전송
  const prevKeyRef = useRef<string>("");

  useEffect(() => {
    // 경로 + 쿼리스트링 조합으로 변경 감지 키 생성
    const currentKey = `${pathname}?${searchParams.toString()}`;
    if (prevKeyRef.current === currentKey) return;
    prevKeyRef.current = currentKey;

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

  return null;
}

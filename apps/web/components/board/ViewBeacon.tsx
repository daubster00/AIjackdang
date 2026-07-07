"use client";

import { useEffect, useRef } from "react";

export type ViewTargetType = "post" | "question" | "resource";

interface Props {
  targetType: ViewTargetType;
  /** 대상의 UUID (slug 아님) */
  targetId: string;
}

/**
 * 상세 페이지 마운트 시 조회수 집계 비콘을 1회 발화하는 클라이언트 컴포넌트.
 * 렌더링 없음(return null). 서버 컴포넌트 JSX에 직접 포함해 사용한다.
 *
 * 브라우저에서 직접 POST 하므로 API는 실제 클라이언트 IP를 알 수 있고
 * (Caddy X-Forwarded-For + Fastify trustProxy), 서버는 IP+userId 로 30분 중복 제거한다.
 * SSR fetch로 올리던 방식은 web 컨테이너 IP로 뭉쳐 IP 중복 제거가 불가능했다.
 *
 * 상대경로(/api/v1/views)로 호출 → Next rewrite가 API로 프록시(First-party 쿠키 유지).
 */
export function ViewBeacon({ targetType, targetId }: Props) {
  const sentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!targetId) return;
    const key = `${targetType}:${targetId}`;
    // StrictMode 이중 마운트/재렌더 중복 발화 방지 (서버도 30분 dedup)
    if (sentRef.current === key) return;
    sentRef.current = key;

    void fetch("/api/v1/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId }),
      credentials: "include",
      keepalive: true,
    }).catch(() => {
      // 조회수 집계 실패는 무시(fire-and-forget)
    });
  }, [targetType, targetId]);

  return null;
}

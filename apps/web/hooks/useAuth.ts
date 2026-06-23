"use client";

/**
 * 실제 인증 세션 훅.
 *
 * Better Auth GET /api/v1/auth/get-session 엔드포인트를 통해 현재 세션을 조회한다.
 * useMockAuth를 대체하며, SiteHeader와 마이페이지 등에서 사용한다.
 *
 * 설계 원칙 (project-context §보안):
 * - 인증 권위는 API 서버. 이 훅은 세션 상태를 읽기만 한다.
 * - SSR/하이드레이션 불일치 방지를 위해 초기 상태는 null, 마운트 후 조회.
 */

import { useCallback, useEffect, useState } from "react";
import type { SessionResponse } from "@ai-jakdang/contracts";
import { signOut } from "@/lib/auth-api";

export type AuthUser = SessionResponse["user"];

export interface UseAuthReturn {
  /** 현재 로그인된 사용자 정보. 비로그인이거나 로딩 중이면 null. */
  user: AuthUser | null;
  /** 세션 조회 완료 여부. false이면 아직 API 응답 대기 중. */
  ready: boolean;
  /** 로그아웃 함수. API 호출 후 상태 초기화. */
  logout: () => Promise<void>;
  /** 세션 강제 재조회 (로그인 성공 후 등에서 사용). */
  refresh: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/get-session", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as SessionResponse | null;
        setUser(data?.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    await fetchSession();
  }, [fetchSession]);

  return { user, ready, logout, refresh };
}

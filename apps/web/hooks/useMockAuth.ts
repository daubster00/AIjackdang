"use client";

// 목업 로그인 상태를 React 컴포넌트에서 쓰기 위한 훅.
// 헤더(로그인/로그아웃 표시)와 로그인 폼이 이 훅으로 같은 상태를 공유한다.

import { useCallback, useEffect, useState } from "react";
import {
  clearMockUser,
  MOCK_AUTH_EVENT,
  readMockUser,
  setMockUser,
  type MockUser,
} from "@/lib/mockAuth";

export function useMockAuth() {
  // 서버 렌더와 첫 클라이언트 렌더의 결과를 맞추기 위해 항상 null 로 시작하고,
  // 마운트 후 effect 에서 실제 저장값을 읽어 채운다(하이드레이션 불일치 방지).
  const [user, setUser] = useState<MockUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(readMockUser());
    setReady(true);

    function sync() {
      setUser(readMockUser());
    }
    // 같은 탭: 커스텀 이벤트 / 다른 탭: storage 이벤트
    window.addEventListener(MOCK_AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MOCK_AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const login = useCallback((next: MockUser) => setMockUser(next), []);
  const logout = useCallback(() => clearMockUser(), []);

  return { user, ready, login, logout };
}

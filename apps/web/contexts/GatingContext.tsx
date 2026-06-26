"use client";

/**
 * 행동 게이팅 전역 컨텍스트 (Story 1.7).
 *
 * GatingProvider: LoginGatingModal을 앱 루트에 마운트하고
 * requireAuth를 전역으로 제공한다.
 *
 * 설계 원칙 (project-context §UX 행동 게이팅):
 * - 읽기 개방, 행동(다운로드·작성·반응·쪽지·신고)은 로그인 필요.
 * - 비회원이 행동 진입점 클릭 시 차단 화면이 아니라 로그인 유도 모달 표시.
 * - 모달은 앱 루트에서 단 하나 렌더(중복 열림 없음).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoginGatingModal } from "@/components/ui/LoginGatingModal";

export interface GatingContextValue {
  /**
   * 인증이 필요한 행동 직전에 호출.
   * - 로그인 상태: true 반환 → 행동 진행.
   * - 비로그인 상태: 로그인 유도 모달을 열고 false 반환 → 행동 중단.
   *
   * @param action 시도한 행동 힌트 (redirectTo에 포함됨). 예: "like", "write", "report"
   */
  requireAuth: (action?: string) => boolean;
}

const GatingContext = createContext<GatingContextValue | null>(null);

export function GatingProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [intendedAction, setIntendedAction] = useState<string | undefined>(undefined);

  const openModal = useCallback((action?: string) => {
    setIntendedAction(action);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setIntendedAction(undefined);
  }, []);

  const requireAuth = useCallback(
    (action?: string): boolean => {
      // 세션 조회 중(ready=false)이면 낙관적으로 통과 — 실제 인증은 API 서버가 처리
      if (!ready) return true;
      if (user) return true;
      openModal(action);
      return false;
    },
    [user, ready, openModal],
  );

  const value = useMemo<GatingContextValue>(
    () => ({ requireAuth }),
    [requireAuth],
  );

  return (
    <GatingContext.Provider value={value}>
      {children}
      <LoginGatingModal
        open={modalOpen}
        onClose={closeModal}
        intendedAction={intendedAction}
      />
    </GatingContext.Provider>
  );
}

/** GatingContext 내부 접근. GatingProvider 바깥에서 사용하면 에러. */
export function useGatingContext(): GatingContextValue {
  const ctx = useContext(GatingContext);
  if (!ctx) {
    throw new Error("useGatingContext must be used within <GatingProvider>");
  }
  return ctx;
}

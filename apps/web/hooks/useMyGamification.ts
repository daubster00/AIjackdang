"use client";

/**
 * useMyGamification — 현재 사용자의 포인트·등급 조회 훅
 *
 * GET /api/v1/gamification/me 에서 총 포인트(totalPoints)와 등급(grade.level)을 읽어
 * 모바일 메뉴·헤더 등에서 "현재 포인트"와 등급 뱃지를 실제 값으로 표시하는 데 쓴다.
 *
 * - 로그인 상태일 때만 조회 (isLoggedIn=false 이면 null 유지)
 * - 마운트 시 1회 조회, 창 포커스 복귀 시 재조회
 */

import { useCallback, useEffect, useState } from "react";
import type { MeResponse } from "@ai-jakdang/contracts";

export interface MyGamification {
  /** 현재 총 포인트 */
  totalPoints: number;
  /** 등급 레벨 (1~5) */
  gradeLevel: number;
}

async function fetchMyGamification(): Promise<MyGamification | null> {
  try {
    const res = await fetch("/api/v1/gamification/me", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as MeResponse;
    return { totalPoints: data.totalPoints, gradeLevel: data.grade.level };
  } catch {
    return null;
  }
}

export function useMyGamification(isLoggedIn: boolean): MyGamification | null {
  const [data, setData] = useState<MyGamification | null>(null);

  const refresh = useCallback(async () => {
    setData(await fetchMyGamification());
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setData(null);
      return;
    }

    void refresh();

    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isLoggedIn, refresh]);

  return data;
}

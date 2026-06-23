"use client";

import { useEffect } from "react";
import { initAdminUI } from "@ai-jakdang/admin-design-system/js";

/**
 * 관리자 디자인 시스템의 공통 인터랙션을 클라이언트에서 1회 초기화한다.
 * (사이드바 접힘/모바일 메뉴, 커스텀 셀렉트, 모달/드로어, 토스트, 탭/세그먼트, 테이블 선택)
 * 시각/마크업은 서버 컴포넌트가 그리고, 이 컴포넌트는 동작만 연결한다.
 */
export function AdminInteractions() {
  useEffect(() => {
    initAdminUI();
  }, []);
  return null;
}

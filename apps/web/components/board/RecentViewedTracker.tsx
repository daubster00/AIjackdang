"use client";

import { useEffect } from "react";

export type RecentViewedItem = {
  /** 상세 페이지 경로 (예: "/automation/some-slug") */
  href: string;
  /** 게시판/카테고리 라벨 (예: "AI 자동화", "묻고답하기") */
  board: string;
  /** 글 제목 */
  title: string;
};

const STORAGE_KEY = "aijakdang.recentViewed";
const MAX_ITEMS = 8;

interface Props {
  href: string;
  board: string;
  title: string;
}

/**
 * 글 상세 페이지 마운트 시 localStorage에 열람 이력을 기록하는 클라이언트 컴포넌트.
 * 렌더링 없음(return null). 서버 컴포넌트에서 직접 JSX에 포함해 사용한다.
 *
 * 저장 키: "aijakdang.recentViewed"
 * 형식: [{href, board, title}], href 기준 중복 제거, 최신 순, 최대 8개
 */
export function RecentViewedTracker({ href, board, title }: Props) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const items: RecentViewedItem[] = raw ? (JSON.parse(raw) as RecentViewedItem[]) : [];

      // href 기준 중복 제거 후 맨 앞에 삽입, 최대 MAX_ITEMS 유지
      const filtered = items.filter((item) => item.href !== href);
      const updated = [{ href, board, title }, ...filtered].slice(0, MAX_ITEMS);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // localStorage 접근 불가 환경(개인정보 모드 등) 무시
    }
  }, [href, board, title]);

  return null;
}

import type { RankTier } from "@/lib/ranks";
import { RecentViewedPanel } from "./RecentViewedPanel";
import { RankingPanel } from "./RankingPanel";
import styles from "./BoardSidebar.module.css";

/** 최근 본 글 항목 (게시판별로 데이터 주입) */
export type RecentPost = {
  /** 상세 페이지로 이동할 전체 경로 (예: "/questions/some-slug") */
  href: string;
  /** 글이 속한 게시판/카테고리 라벨 */
  board: string;
  /** 글 제목 */
  title: string;
};

/** 작당 랭킹 항목 (게시판별로 데이터 주입) */
export type RankingUser = {
  /** 순위 숫자 */
  rank: number;
  /** 닉네임 */
  nickname: string;
  /** 사용자 등급 — 등급 키("master") 또는 한국어 라벨("마스터"). 뱃지 이미지/라벨은 lib/ranks 에서 결정 */
  tier: RankTier | string;
};

type BoardSidebarProps = {
  /**
   * "최근 본 글" 패널에 표시할 글 목록 (레거시 prop — 현재 미사용).
   * localStorage 기반 RecentViewedPanel로 교체됨. optional로 유지해 기존 호출부 호환성 보장.
   */
  recentPosts?: RecentPost[];
  /** "작당 랭킹" 패널에 표시할 사용자 목록 */
  rankings: RankingUser[];
  /** aside 접근성 라벨 (기본: "게시판 보조 정보") */
  ariaLabel?: string;
};

/**
 * 게시판 목록 우측 공통 사이드바.
 * "최근 본 글" + "작당 랭킹" 두 패널을 렌더하며,
 * 랭킹은 RankingPanel 이 직접 API 를 호출해 실 데이터를 표시한다.
 * `rankings` prop 은 하위 호환성을 위해 유지하지만 실제로는 사용하지 않는다.
 */
export function BoardSidebar({
  // rankings prop 은 기존 호출부 호환성을 위해 받되 무시한다 — RankingPanel 이 직접 API 를 호출한다
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rankings: _rankings,
  ariaLabel = "게시판 보조 정보",
}: BoardSidebarProps) {
  return (
    <aside className={styles.listSidebar} aria-label={ariaLabel}>
      {/* localStorage 기반 실제 열람 이력 — 클라이언트 컴포넌트 */}
      <RecentViewedPanel />

      {/* 실 API 기반 주간 랭킹 — 클라이언트 컴포넌트 */}
      <RankingPanel />
    </aside>
  );
}

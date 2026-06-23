import Link from "next/link";
import { Icon, RankBadge } from "@/components/ui";
import type { RankTier } from "@/lib/ranks";
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
  /** "최근 본 글" 패널에 표시할 글 목록 */
  recentPosts: RecentPost[];
  /** "작당 랭킹" 패널에 표시할 사용자 목록 */
  rankings: RankingUser[];
  /** aside 접근성 라벨 (기본: "게시판 보조 정보") */
  ariaLabel?: string;
};

/**
 * 게시판 목록 우측 공통 사이드바.
 * "최근 본 글" + "작당 랭킹" 두 패널을 렌더하며,
 * 각 게시판 페이지가 자기 데이터를 주입해 불러와 사용한다.
 */
export function BoardSidebar({
  recentPosts,
  rankings,
  ariaLabel = "게시판 보조 정보",
}: BoardSidebarProps) {
  return (
    <aside className={styles.listSidebar} aria-label={ariaLabel}>
      <section className={styles.sidePanel}>
        <div className={styles.sideHeader}>
          <Icon name="history-line" />
          <h2>최근 본 글</h2>
        </div>
        <ul className={styles.recentList}>
          {recentPosts.map((post) => (
            <li key={post.href}>
              <Link href={post.href} className={styles.recentItem}>
                <span className={styles.recentTag}>{post.board}</span>
                <span className={styles.recentTitle}>{post.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.sidePanel}>
        <div className={styles.sideHeader}>
          <Icon name="award-line" />
          <h2>작당 랭킹</h2>
        </div>
        <ol className={styles.userRankingList}>
          {rankings.map((user) => (
            <li key={user.nickname}>
              <span className={styles.rankNumber}>{user.rank}</span>
              <span className={styles.rankName}>{user.nickname}</span>
              <span className={styles.badgeSlot}>
                <RankBadge rank={user.tier} size={30} className={styles.badgeImage} />
              </span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

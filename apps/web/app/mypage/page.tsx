"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  EmptyState,
  Icon,
  RankBadge,
  Tag,
} from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { resolveAvatarUrl } from "@/lib/avatar";
import { RANK_LIST, resolveRank, rankTierFromGradeLevel } from "@/lib/ranks";
import type { RankTier } from "@/lib/ranks";
import { MyResourceList } from "./MyResourceList";
import styles from "./mypage.module.css";

/**
 * 마이페이지 (/mypage).
 * 헤더 프로필 드롭다운의 "마이페이지" 진입점.
 *
 * 실제 세션(useAuth)에서 유저 정보를 읽는다.
 * bio는 세션에 없으므로 GET /api/v1/users/me 로 보강한다.
 */

/** 마이페이지 프로필 뷰 타입 (실제 AuthUser + rank·bio 보조 필드) */
type ProfileView = {
  nickname: string;
  email: string;
  rank: RankTier;
  avatarUrl: string | null;
  /** 소셜 프로필 사진 (avatarUrl 없을 때 폴백) */
  image: string | null;
  defaultAvatarIndex: number;
  /** 가입일 ISO 문자열 */
  createdAt: string;
};

// ── [6.4] 뱃지 탭 타입 ───────────────────────────────────────────────────────
type TabKey = "posts" | "comments" | "bookmarks" | "likes" | "following" | "followers" | "resources" | "badges";

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "posts", label: "내가 쓴 글", icon: "article-line" },
  { key: "comments", label: "내 댓글", icon: "chat-1-line" },
  { key: "bookmarks", label: "북마크", icon: "bookmark-line" },
  { key: "likes", label: "좋아요한 글", icon: "heart-3-line" },
  // 팔로잉/팔로워 탭 (단일 /mypage 내 탭으로 확장 — 별도 라우트 없음)
  { key: "following", label: "팔로잉", icon: "user-follow-line" },
  { key: "followers", label: "팔로워", icon: "user-heart-line" },
  // 내 자료 탭 (Story 4.9 — 별도 라우트 없음, /mypage 탭 확장)
  { key: "resources", label: "내 자료", icon: "file-download-line" },
  // 뱃지 탭 (Story 6.4 — 별도 라우트 없음, /mypage 탭 확장)
  { key: "badges", label: "뱃지", icon: "award-line" },
];
// ── [6.4] END ─────────────────────────────────────────────────────────────────

/* ── "내가 쓴 글" 탭 전용 데이터 모델 ──
   다른 탭(댓글/북마크/좋아요)은 단순 활동 피드지만,
   "내가 쓴 글"은 게시판 필터·정렬·검색·수정/삭제까지 다루는 관리형이라
   별도 모델(MyPost)로 분리한다. */

/** 글이 속한 게시판 종류 (서브 필터 + 배지 + 작성/수정 경로 매핑 키) */
type BoardKey = "questions" | "vibe" | "automation" | "monetize" | "resources" | "lounge";

/** 게시판 메타: 라벨 / 배지 색 / 경로 prefix */
const BOARDS: Record<
  BoardKey,
  { label: string; tone: "info" | "success" | "warning" | "primary" | "neutral"; base: string }
> = {
  questions: { label: "묻고답하기", tone: "info", base: "/questions" },
  vibe: { label: "바이브 코딩", tone: "success", base: "/vibe-coding" },
  automation: { label: "AI 자동화", tone: "warning", base: "/automation" },
  monetize: { label: "AI 수익화", tone: "primary", base: "/monetize" },
  resources: { label: "실전자료", tone: "neutral", base: "/resources/mcp-skills" },
  lounge: { label: "작당 라운지", tone: "neutral", base: "/lounge" },
};

/** "내가 쓴 글" 정렬 옵션 */
const postSorts = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "comments", label: "댓글많은순" },
] as const;
type PostSortKey = (typeof postSorts)[number]["value"];

type MyPost = {
  id: string;
  board: BoardKey;
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  /** 정렬용 타임스탬프(YYYYMMDD). 화면에는 dateLabel 표시 */
  createdAt: number;
  dateLabel: string;
  likes: number;
  comments: number;
  views: number;
  /** 임시저장 여부 — true면 "임시저장" 배지 + 보기 대신 이어쓰기 동선 */
  draft?: boolean;
};

/** 계정 관리 사이드바 메뉴 */
const accountLinks = [
  { href: "/settings/profile", icon: "user-settings-line", label: "프로필 수정" },
  { href: "/settings/notifications", icon: "notification-3-line", label: "알림 설정" },
  { href: "/settings/security", icon: "lock-line", label: "비밀번호 변경" },
  { href: "/settings/blocks", icon: "user-forbid-line", label: "차단 목록" },
];

/** 상단 요약 통계 (작성 글 / 받은 좋아요 / 채택된 답변 / 북마크) — Epic 2~5 구현 후 집계 */
const stats = [
  { icon: "article-line", label: "작성한 글", value: "0" },
  { icon: "heart-3-line", label: "받은 좋아요", value: "0" },
  { icon: "checkbox-circle-line", label: "채택된 답변", value: "0" },
  { icon: "bookmark-line", label: "북마크", value: "0" },
] as const;

/** createdAt ISO 문자열을 "YYYY.MM.DD" 형식으로 포맷 */
function formatJoinDate(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}`;
  } catch {
    return "";
  }
}

// ── 레벨 → RankTier 정식 함수 사용 (Story 6.6) ───────────────────────────────

export default function MyPage() {
  const { user, ready, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("posts");

  // "내가 쓴 글" 탭 전용 컨트롤: 게시판 필터 / 정렬 / 검색
  const [postBoard, setPostBoard] = useState<"all" | BoardKey>("all");
  const [postSort, setPostSort] = useState<PostSortKey>("latest");
  const [postKeyword, setPostKeyword] = useState("");

  // bio·배너·외부링크: 세션에 없으므로 /api/v1/users/me 에서 별도 조회
  const [bio, setBio] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/v1/users/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          bio?: string | null;
          bannerUrl?: string | null;
          links?: { label: string; url: string }[] | null;
        } | null) => {
          if (data?.bio) setBio(data.bio);
          if (data?.bannerUrl) setBannerUrl(data.bannerUrl);
          if (Array.isArray(data?.links)) setLinks(data.links);
        },
      )
      .catch(() => { /* 로드 실패 시 무시 */ });
  }, [user]);

  // 로그인 사용자 프로필 뷰 구성 (세션 기반)
  // rank: 게이미피케이션 API 구현 전까지 기본값 "rookie" (새내기)
  const profile = useMemo<ProfileView | null>(
    () =>
      user
        ? {
            nickname: user.nickname,
            email: user.email,
            rank: "rookie" as RankTier,
            avatarUrl: user.avatarUrl,
            image: user.image,
            defaultAvatarIndex: user.defaultAvatarIndex,
            createdAt: user.createdAt,
          }
        : null,
    [user],
  );

  // 내가 쓴 글: Epic 2에서 실제 API 연동 전까지 빈 배열
  // useMemo로 안정적인 배열 참조 유지
  const myPosts = useMemo<MyPost[]>(() => [], []); // Epic 2에서 활성화

  // 내가 쓴 글에 실제로 존재하는 게시판만 필터 칩으로 노출
  const postBoardFilters = useMemo(() => {
    const present = new Set(myPosts.map((p) => p.board));
    return (["all", ...Object.keys(BOARDS)] as ("all" | BoardKey)[]).filter(
      (key) => key === "all" || present.has(key as BoardKey),
    );
  }, [myPosts]);

  // 필터 + 검색 + 정렬을 적용한 내가 쓴 글 목록
  const filteredPosts = useMemo(() => {
    const q = postKeyword.trim().toLowerCase();
    return myPosts
      .filter((p) => (postBoard === "all" ? true : p.board === postBoard))
      .filter((p) =>
        q ? p.title.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q)) : true,
      )
      .sort((a, b) => {
        if (postSort === "popular") return b.likes - a.likes;
        if (postSort === "comments") return b.comments - a.comments;
        return b.createdAt - a.createdAt;
      });
  }, [myPosts, postBoard, postSort, postKeyword]);

  // ── 게이미피케이션 API: 등급 + 뱃지 통합 조회 (Story 6.6) ─────────────────
  const [gradeData, setGradeData] = useState<{
    totalPoints: number;
    grade: { level: number; name: string };
    nextGrade: { level: number; name: string } | null;
    pointsToNext: number | null;
    badges: { badgeSlug: string; badgeName: string; iconUrl: string; grantedAt: string }[];
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/v1/gamification/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          totalPoints: number;
          grade: { level: number; name: string };
          nextGrade: { level: number; name: string } | null;
          pointsToNext: number | null;
          badges: { badgeSlug: string; badgeName: string; iconUrl: string; grantedAt: string }[];
        } | null) => {
          if (data) setGradeData(data);
        },
      )
      .catch(() => { /* 로드 실패 시 기본값 유지 */ });
  }, [user]);

  // 등급 진행도: API 응답 사용. 미조회 시 기존 로직(resolveRank) 폴백.
  const rankProgress = useMemo(() => {
    if (!profile) return null;

    if (gradeData) {
      // API 응답 기반 계산 — rankTierFromGradeLevel 정식 함수 사용 (Story 6.6)
      const tier: RankTier = rankTierFromGradeLevel(gradeData.grade.level);
      const info = resolveRank(tier);
      if (!info) return null;

      const nextTier = gradeData.nextGrade
        ? rankTierFromGradeLevel(gradeData.nextGrade.level)
        : null;
      const nextInfo = nextTier ? resolveRank(nextTier) : null;

      const totalPoints = gradeData.totalPoints;
      const remaining = gradeData.pointsToNext ?? 0;
      // 진행률: 현재 등급 내 위치 (totalPoints / (totalPoints + remaining))
      const pct =
        gradeData.pointsToNext === null
          ? 100
          : Math.min(100, Math.round((totalPoints / (totalPoints + remaining)) * 100));

      return {
        info,
        next: nextInfo ?? null,
        pct,
        remaining,
        points: totalPoints,
        // rank tier (프로필 헤더 RankBadge 업데이트용)
        tier,
      };
    }

    // API 미조회 폴백: 기존 로직 (rank='rookie' + 0포인트)
    const info = resolveRank(profile.rank);
    if (!info) return null;
    const next = RANK_LIST.find((r) => r.order === info.order + 1);
    const points = 0;
    const pct = 0;
    const remaining = next ? next.order * 1000 : 0;
    return { info, next, pct, remaining, points, tier: profile.rank as RankTier };
  }, [profile, gradeData]); // eslint-disable-line react-hooks/exhaustive-deps

  // 팔로잉/팔로워/북마크: 실API 조회
  const [followingList, setFollowingList] = useState<{ id: string; nickname: string; avatarUrl: string | null }[]>([]);
  const [followerList, setFollowerList] = useState<{ id: string; nickname: string; avatarUrl: string | null }[]>([]);
  const [bookmarkList, setBookmarkList] = useState<{ id: string; title: string; href: string; savedAt: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === "following") {
      void fetch(`/api/v1/users/${encodeURIComponent(user.nickname)}/following?pageSize=50`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { items: { id: string; nickname: string; avatarUrl: string | null }[] } | null) => {
          if (data) setFollowingList(data.items);
        })
        .catch(() => null);
    } else if (activeTab === "followers") {
      void fetch(`/api/v1/users/${encodeURIComponent(user.nickname)}/followers?pageSize=50`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { items: { id: string; nickname: string; avatarUrl: string | null }[] } | null) => {
          if (data) setFollowerList(data.items);
        })
        .catch(() => null);
    } else if (activeTab === "bookmarks") {
      void fetch("/api/v1/users/me/bookmarks?pageSize=50", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { items: { id: string; title: string; href: string; savedAt: string }[] } | null) => {
          if (data) setBookmarkList(data.items);
        })
        .catch(() => null);
    }
  }, [user, activeTab]);

  const followingCount = followingList.length;
  const followersCount = followerList.length;

  // ── [6.4/6.6] 뱃지 탭 상태 ─────────────────────────────────────────────────
  // Story 6.6: 통합 GET /me 응답의 badges 배열을 우선 사용.
  // gradeData 미로드 시 탭 진입 시점에 /my-badges 폴백 fetch.
  const [badgeList, setBadgeList] = useState<{ badgeSlug: string; badgeName: string; iconUrl: string; grantedAt: string }[]>([]);
  const [badgeLoaded, setBadgeLoaded] = useState(false);

  useEffect(() => {
    // 통합 API에서 이미 뱃지를 받았으면 별도 fetch 생략
    if (gradeData?.badges) {
      setBadgeList(gradeData.badges);
      setBadgeLoaded(true);
      return;
    }
    if (!user || activeTab !== "badges" || badgeLoaded) return;
    void fetch("/api/v1/gamification/my-badges", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items: { badgeSlug: string; badgeName: string; iconUrl: string; grantedAt: string }[] } | null) => {
        if (data) setBadgeList(data.items);
        setBadgeLoaded(true);
      })
      .catch(() => { setBadgeLoaded(true); });
  }, [user, activeTab, badgeLoaded, gradeData]);
  // ── [6.4/6.6] END ─────────────────────────────────────────────────────────────

  // 패널 카운트
  const panelCount =
    activeTab === "posts"
      ? filteredPosts.length
      : activeTab === "following"
        ? followingCount
        : activeTab === "followers"
          ? followersCount
          : activeTab === "bookmarks"
            ? bookmarkList.length
            : activeTab === "resources"
              ? 0 // MyResourceList 내부에서 집계
              : activeTab === "badges"
                ? badgeList.length
                : 0;

  const activeTabLabel = tabs.find((t) => t.key === activeTab)?.label ?? "";

  // 하이드레이션 불일치 방지: ready 전까지 렌더 보류
  void ready;

  if (!profile) {
    // 미들웨어가 비로그인 차단하므로 보통 이 분기는 실행 안 됨
    // 세션 조회 중이거나 엣지 케이스 대비 빈 UI
    return <main id="main" className={styles.page} />;
  }

  const avatarSrc = resolveAvatarUrl(profile);
  const joinDate = formatJoinDate(profile.createdAt);

  return (
    <main id="main" className={styles.page}>
      {/* ── 프로필 헤더 밴드 (배너 배경 + 정보) ── */}
      <section className={styles.profileBand} aria-label="내 프로필">
        {bannerUrl && (
          <>
            <img src={bannerUrl} alt="" className={styles.bandBanner} />
            <div className={styles.bandBannerOverlay} aria-hidden="true" />
          </>
        )}
        <div className={styles.profileBandInner}>
          <div className={styles.identity}>
            <Avatar name={profile.nickname} src={avatarSrc} size="lg" className={styles.avatar} />
            <div className={styles.identityText}>
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{profile.nickname}</h1>
                {/* rankProgress.tier: API 등급 레벨에서 매핑 (Story 6.3; 정식 통합은 Story 6.6) */}
                <RankBadge rank={rankProgress?.tier ?? profile.rank} size={22} showLabel className={styles.rankBadge} />
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaItem}>
                  <Icon name="mail-line" />
                  {profile.email}
                </span>
                {joinDate && (
                  <>
                    <span className={styles.metaDivider} aria-hidden="true">
                      ·
                    </span>
                    <span className={styles.metaItem}>
                      <Icon name="calendar-line" />
                      {joinDate} 가입
                    </span>
                  </>
                )}
                <span className={styles.metaDivider} aria-hidden="true">
                  ·
                </span>
                {/* 팔로잉/팔로워 카운트 헤더 요약 — Epic 5에서 활성화 */}
                <span className={styles.metaItem}>
                  <Icon name="user-follow-line" />
                  팔로잉 {followingCount}
                </span>
                <span className={styles.metaDivider} aria-hidden="true">
                  ·
                </span>
                <span className={styles.metaItem}>
                  <Icon name="user-heart-line" />
                  팔로워 {followersCount}
                </span>
              </div>
              {bio && <p className={styles.bio}>{bio}</p>}
              {links.length > 0 && (
                <ul className={styles.profileLinks}>
                  {links.map((link, i) => (
                    <li key={`${link.url}-${i}`}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className={styles.profileLink}
                      >
                        <Icon name="link" />
                        {link.label || link.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className={styles.bandActions}>
            <Link href="/settings/profile" className={styles.bandBtnPrimary}>
              <Icon name="edit-line" />
              프로필 수정
            </Link>
            <Link href="/settings/notifications" className={styles.bandBtnGhost}>
              <Icon name="settings-3-line" />
              설정
            </Link>
          </div>
        </div>
      </section>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {/* ── 요약 통계 — Epic 2~5 구현 후 집계 ── */}
          <section className={styles.statGrid} aria-label="활동 요약">
            {stats.map((stat) => (
              <div key={stat.label} className={styles.statCard}>
                <span className={styles.statIcon}>
                  <Icon name={stat.icon} />
                </span>
                <strong className={styles.statValue}>{stat.value}</strong>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </section>

          {/* ── 활동 탭 ── */}
          <div className={styles.tabBar} role="tablist" aria-label="내 활동">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`tab-${tab.key}`}
                aria-selected={activeTab === tab.key}
                aria-controls={`panel-${tab.key}`}
                className={styles.tab}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon name={tab.icon} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── 활동 목록 ── */}
          <section
            className={styles.panel}
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>{activeTabLabel}</h2>
              <span className={styles.panelCount}>총 {panelCount}개</span>
            </div>

            {/* ── [6.4] 뱃지 탭 — Story 6.4 ── */}
            {activeTab === "badges" ? (
              badgeList.length === 0 ? (
                <EmptyState
                  icon="award-line"
                  title="아직 획득한 뱃지가 없어요"
                  description="활동을 이어가면 뱃지가 자동으로 수여됩니다."
                />
              ) : (
                <ul className={styles.badgeGrid} aria-label="보유 뱃지 목록">
                  {badgeList.map((badge) => (
                    <li key={badge.badgeSlug} className={styles.badgeCard}>
                      {badge.iconUrl ? (
                        <img
                          src={badge.iconUrl}
                          alt={badge.badgeName}
                          className={styles.badgeIcon}
                          width={48}
                          height={48}
                        />
                      ) : (
                        <span className={styles.badgeIconFallback} aria-label={badge.badgeName}>
                          <Icon name="award-line" />
                        </span>
                      )}
                      <span className={styles.badgeName}>{badge.badgeName}</span>
                      <span className={styles.badgeDate}>
                        {new Date(badge.grantedAt).toLocaleDateString("ko-KR")}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : /* ── [6.4] END ── */ activeTab === "resources" ? (
              <MyResourceList />
            ) : activeTab === "following" ? (
              followingList.length === 0 ? (
                <EmptyState icon="user-follow-line" title="팔로잉하는 멤버가 없습니다" description="관심 있는 멤버의 프로필에서 팔로우해 보세요." />
              ) : (
                <ul className={styles.followList}>
                  {followingList.map((u) => (
                    <li key={u.id} className={styles.followItem}>
                      <a href={`/u/${encodeURIComponent(u.nickname)}`} className={styles.followItemLink}>
                        <Icon name="user-3-line" />
                        <span>{u.nickname}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )
            ) : activeTab === "followers" ? (
              followerList.length === 0 ? (
                <EmptyState icon="user-heart-line" title="팔로워가 없습니다" description="활동을 이어가면 팔로워가 생깁니다." />
              ) : (
                <ul className={styles.followList}>
                  {followerList.map((u) => (
                    <li key={u.id} className={styles.followItem}>
                      <a href={`/u/${encodeURIComponent(u.nickname)}`} className={styles.followItemLink}>
                        <Icon name="user-3-line" />
                        <span>{u.nickname}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )
            ) : activeTab === "bookmarks" ? (
              bookmarkList.length === 0 ? (
                <EmptyState icon="bookmark-line" title="저장한 글이 없습니다" description="마음에 드는 글을 북마크해 보세요." />
              ) : (
                <ul className={styles.bookmarkList}>
                  {bookmarkList.map((bm) => (
                    <li key={bm.id} className={styles.bookmarkItem}>
                      <a href={bm.href} className={styles.bookmarkLink}>{bm.title}</a>
                      <span className={styles.bookmarkDate}>{new Date(bm.savedAt).toLocaleDateString("ko-KR")}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : activeTab === "posts" ? (
              <>
                {/* 내가 쓴 글 전용 컨트롤: 게시판 필터 + 검색 + 정렬 */}
                <div className={styles.postControls}>
                  <div className={styles.boardChips} role="group" aria-label="게시판 필터">
                    {postBoardFilters.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={styles.chip}
                        aria-pressed={postBoard === key}
                        onClick={() => setPostBoard(key)}
                      >
                        {key === "all" ? "전체" : BOARDS[key].label}
                      </button>
                    ))}
                  </div>

                  <div className={styles.postControlsRight}>
                    <div className={styles.search}>
                      <Icon name="search-line" />
                      <input
                        type="search"
                        placeholder="내 글 검색"
                        aria-label="내 글 검색"
                        value={postKeyword}
                        onChange={(e) => setPostKeyword(e.target.value)}
                      />
                    </div>
                    <div className={styles.sortGroup} role="group" aria-label="정렬">
                      {postSorts.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          className={styles.sortBtn}
                          aria-pressed={postSort === s.value}
                          onClick={() => setPostSort(s.value)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredPosts.length === 0 ? (
                  <div className={styles.empty}>
                    <Icon name="quill-pen-line" />
                    <p>{postKeyword || postBoard !== "all" ? "조건에 맞는 글이 없어요." : "아직 작성한 글이 없어요."}</p>
                    {postKeyword || postBoard !== "all" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPostKeyword("");
                          setPostBoard("all");
                        }}
                      >
                        필터 초기화
                      </Button>
                    ) : (
                      <Link href="/questions/write">
                        <Button size="sm">글쓰기</Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <ul className={styles.activityList}>
                    {filteredPosts.map((post) => {
                      const board = BOARDS[post.board];
                      const isHashBase = board.base.startsWith("#");
                      const viewHref = isHashBase ? board.base : `${board.base}/${post.slug}`;
                      const editHref = isHashBase ? board.base : `${board.base}/write`;
                      return (
                        <li key={post.id} className={styles.activityItem}>
                          <div className={styles.activityTop}>
                            <Badge tone={board.tone} variant="soft" className={styles.boardBadge}>
                              {board.label}
                            </Badge>
                            {post.draft && (
                              <Badge tone="neutral" variant="outline" className={styles.draftBadge}>
                                임시저장
                              </Badge>
                            )}
                            <div className={styles.tagRow}>
                              {post.tags.map((t) => (
                                <Tag key={t} href={`/tags/${encodeURIComponent(t)}`}>
                                  #{t}
                                </Tag>
                              ))}
                            </div>

                            {/* 글 관리 메뉴 (수정/삭제) */}
                            <Dropdown
                              align="end"
                              trigger={
                                <button
                                  type="button"
                                  className={styles.kebab}
                                  aria-label={`${post.title} 관리`}
                                >
                                  <Icon name="more-2-fill" />
                                </button>
                              }
                            >
                              <DropdownItem href={editHref}>
                                <Icon name="edit-line" /> {post.draft ? "이어쓰기" : "수정"}
                              </DropdownItem>
                              <DropdownDivider />
                              <DropdownItem danger>
                                <Icon name="delete-bin-line" /> 삭제
                              </DropdownItem>
                            </Dropdown>
                          </div>

                          {post.draft ? (
                            <span className={styles.activityTitle}>{post.title}</span>
                          ) : (
                            <Link href={viewHref} className={styles.activityTitle}>
                              {post.title}
                            </Link>
                          )}

                          <p className={styles.activityExcerpt}>{post.excerpt}</p>

                          <div className={styles.activityFooter}>
                            <span className={styles.activityDate}>{post.dateLabel}</span>
                            <div className={styles.activityStats} aria-label="반응 정보">
                              <span>
                                <Icon name="eye-line" />
                                {post.views.toLocaleString()}
                              </span>
                              <span>
                                <Icon name="heart-3-line" />
                                {post.likes.toLocaleString()}
                              </span>
                              <span>
                                <Icon name="chat-1-line" />
                                {post.comments.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              /* 댓글/북마크/좋아요 탭 — Epic 2~4에서 활성화 */
              <EmptyState
                icon="inbox-line"
                title={`아직 ${activeTabLabel}이 없습니다`}
                description="활동을 시작하면 여기에 표시됩니다."
              />
            )}
          </section>
        </div>

        {/* ── 사이드바 ── */}
        <aside className={styles.sidebar} aria-label="등급 및 계정 관리">
          {rankProgress && (
            <section className={styles.sidePanel}>
              <div className={styles.sideHeader}>
                <Icon name="award-line" />
                <h2>내 등급</h2>
              </div>

              <div className={styles.rankShowcase}>
                {/* tier: API 응답 레벨에서 매핑 (Story 6.3; 정식 통합은 Story 6.6) */}
                <RankBadge rank={rankProgress.tier ?? profile.rank} size={56} />
                <div className={styles.rankShowcaseText}>
                  <strong>{rankProgress.info.label}</strong>
                  {/* 포인트 숫자: 소형 비강조 처리 (AC#3) — .rankShowcaseText span 이 font-size-sm 적용 */}
                  <span>{rankProgress.points.toLocaleString()} P</span>
                </div>
              </div>

              {rankProgress.next ? (
                <>
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-valuenow={rankProgress.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${rankProgress.next.label}까지 진행률 ${rankProgress.pct}%`}
                  >
                    <span
                      className={styles.progressFill}
                      style={{ width: `${rankProgress.pct}%` }}
                    />
                  </div>
                  <p className={styles.progressText}>
                    <strong>{rankProgress.next.label}</strong>까지{" "}
                    {rankProgress.remaining.toLocaleString()} P 남았어요
                  </p>
                </>
              ) : (
                <p className={styles.progressText}>최고 등급 달성 🎉</p>
              )}
            </section>
          )}

          <section className={styles.sidePanel}>
            <div className={styles.sideHeader}>
              <Icon name="settings-4-line" />
              <h2>계정 관리</h2>
            </div>
            <ul className={styles.accountList}>
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.accountItem}>
                    <Icon name={link.icon} />
                    <span>{link.label}</span>
                    <Icon name="arrow-right-s-line" className={styles.accountChevron} />
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className={`${styles.accountItem} ${styles.accountLogout}`}
                  onClick={() => { void logout(); }}
                >
                  <Icon name="logout-box-r-line" />
                  <span>로그아웃</span>
                </button>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  EmptyState,
  FollowButton,
  Icon,
  RankBadge,
  Tag,
} from "@/components/ui";
import { useMockAuth } from "@/hooks/useMockAuth";
import { RANK_LIST, resolveRank } from "@/lib/ranks";
import type { MockUser } from "@/lib/mockAuth";
import type { RankTier } from "@/lib/ranks";
import styles from "./mypage.module.css";

/**
 * 마이페이지 (/mypage).
 * 헤더 프로필 드롭다운의 "마이페이지" 진입점.
 *
 * 인증 백엔드가 붙기 전이라 로그인 상태는 목업(useMockAuth)에서 읽는다.
 * 로그인 사용자가 없을 때도 디자인을 확인할 수 있도록 데모 프로필로 폴백한다.
 */

/** 로그인 사용자가 없을 때 화면을 채우는 데모 프로필 */
const DEMO_USER: MockUser = {
  nickname: "작당탐험가",
  email: "explorer@aijakdang.com",
  rank: "practitioner",
};

/** 데모용 프로필 부가 정보 (실제로는 사용자 프로필 API에서 받아온다) */
const profileExtra = {
  joinDate: "2026.03.12",
  bio: "n8n·Claude Code로 사이드 프로젝트 만드는 중. 자동화 외주도 조금씩 받고 있어요.",
  /** 현재 누적 활동 점수 / 다음 등급까지 필요한 점수 (등급 진행도 계산용) */
  points: 1240,
  nextThreshold: 2000,
};

/** 상단 요약 통계 (작성 글 / 받은 좋아요 / 채택된 답변 / 북마크) */
const stats = [
  { icon: "article-line", label: "작성한 글", value: "48" },
  { icon: "heart-3-line", label: "받은 좋아요", value: "312" },
  { icon: "checkbox-circle-line", label: "채택된 답변", value: "17" },
  { icon: "bookmark-line", label: "북마크", value: "26" },
] as const;

type TabKey = "posts" | "comments" | "bookmarks" | "likes" | "following" | "followers";

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "posts", label: "내가 쓴 글", icon: "article-line" },
  { key: "comments", label: "내 댓글", icon: "chat-1-line" },
  { key: "bookmarks", label: "북마크", icon: "bookmark-line" },
  { key: "likes", label: "좋아요한 글", icon: "heart-3-line" },
  // 팔로잉/팔로워 탭 추가 (별도 라우트 없이 단일 /mypage 내 탭으로 확장)
  { key: "following", label: "팔로잉", icon: "user-follow-line" },
  { key: "followers", label: "팔로워", icon: "user-heart-line" },
];

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

/** 내가 쓴 글 목록 (목업) */
const myPosts: MyPost[] = [
  {
    id: "mp1",
    board: "questions",
    slug: "claude-code-php-misunderstanding",
    title: "Claude Code가 기존 PHP 구조를 계속 잘못 이해합니다",
    excerpt: "레거시 PHP 프로젝트를 수정하려는데 파일 구조를 매번 다르게 해석해서 엉뚱한 곳을 고칩니다.",
    tags: ["ClaudeCode", "PHP"],
    createdAt: 20260618,
    dateLabel: "2026.06.18",
    likes: 4,
    comments: 0,
    views: 82,
  },
  {
    id: "mp2",
    board: "vibe",
    slug: "prompt-structure-tips",
    title: "프롬프트를 어떻게 짜야 답변 품질이 올라가나요?",
    excerpt: "같은 질문을 해도 답변 품질 편차가 큽니다. 코딩 작업을 시킬 때 일반적인 원칙이 있을까요?",
    tags: ["프롬프트", "팁"],
    createdAt: 20260616,
    dateLabel: "2026.06.16",
    likes: 19,
    comments: 4,
    views: 263,
  },
  {
    id: "mp3",
    board: "monetize",
    slug: "automation-outsourcing-quote",
    title: "AI 자동화 외주 견적은 얼마가 적당할까요?",
    excerpt: "소규모 사업장 대상으로 n8n + GPT 자동화 외주를 시작하려는데 첫 견적 기준을 어떻게 잡을지 모르겠습니다.",
    tags: ["수익화", "외주"],
    createdAt: 20260614,
    dateLabel: "2026.06.14",
    likes: 37,
    comments: 5,
    views: 318,
  },
  {
    id: "mp4",
    board: "automation",
    slug: "n8n-slack-digest",
    title: "n8n으로 매일 아침 Slack 업무 다이제스트 만들기",
    excerpt: "여러 채널의 전날 메시지를 모아 GPT로 요약하고, 출근 시간에 맞춰 한 번에 던져주는 워크플로우입니다.",
    tags: ["n8n", "Slack", "자동화"],
    createdAt: 20260612,
    dateLabel: "2026.06.12",
    likes: 96,
    comments: 23,
    views: 1204,
  },
  {
    id: "mp5",
    board: "resources",
    slug: "mcp-skill-checklist",
    title: "MCP 서버 붙이기 전 점검 체크리스트",
    excerpt: "권한 범위, 토큰 만료, 레이트리밋, 로깅까지 — MCP를 실제 워크플로우에 붙이기 전에 확인하는 항목.",
    tags: ["MCP", "체크리스트"],
    createdAt: 20260610,
    dateLabel: "2026.06.10",
    likes: 27,
    comments: 5,
    views: 318,
  },
  {
    id: "mp6",
    board: "vibe",
    slug: "prompt-debugging-routine",
    title: "프롬프트 디버깅 루틴 (작성 중)",
    excerpt: "답변이 어긋날 때 원인을 좁혀가는 단계를 정리하는 중입니다.",
    tags: ["프롬프트", "디버깅"],
    createdAt: 20260609,
    dateLabel: "2026.06.09",
    likes: 0,
    comments: 0,
    views: 0,
    draft: true,
  },
];

/** 활동 목록 한 줄 (댓글/북마크/좋아요 탭에서 같은 형태로 표시) */
type ActivityItem = {
  href: string;
  board: string;
  title: string;
  excerpt?: string;
  date: string;
  likes: number;
  comments: number;
  views?: number;
  /** 좋아요/북마크 등 다른 사람 글일 때 작성자 표시용 */
  author?: string;
};

const activityData: Record<Exclude<TabKey, "posts" | "following" | "followers">, ActivityItem[]> = {
  comments: [
    {
      href: "/questions/n8n-gmail-auto-classify",
      board: "묻고답하기",
      title: "n8n으로 Gmail 문의를 자동 분류할 수 있을까요?",
      excerpt: "“IMAP 노드 + Function 노드 조합이면 라벨링까지 충분히 됩니다. AI 노드는 분기 판단에만 쓰세요.”",
      date: "2026.06.15",
      likes: 8,
      comments: 0,
    },
    {
      href: "/vibe-coding/which-ai-tool-for-beginner",
      board: "바이브 코딩",
      title: "비개발자인데 어떤 AI 코딩 툴부터 써야 할까요?",
      excerpt: "“처음엔 Cursor가 가장 부담 없어요. 익숙해지면 Claude Code로 넘어가는 흐름을 추천합니다.”",
      date: "2026.06.13",
      likes: 12,
      comments: 1,
    },
  ],
  bookmarks: [
    {
      href: "/resources/mcp-skills",
      board: "실전자료",
      title: "Claude Code MCP·Skills 모음 (계속 업데이트)",
      author: "리뷰메이트",
      date: "2026.06.11",
      likes: 142,
      comments: 23,
    },
    {
      href: "/questions/service-direction-review",
      board: "작당 라운지",
      title: "제가 만든 서비스 방향, 이대로 괜찮을까요?",
      author: "사이드프로젝트",
      date: "2026.06.12",
      likes: 6,
      comments: 0,
    },
  ],
  likes: [
    {
      href: "/questions/n8n-gmail-auto-classify",
      board: "묻고답하기",
      title: "n8n으로 Gmail 문의를 자동 분류할 수 있을까요?",
      author: "자동화카페",
      date: "2026.06.15",
      likes: 21,
      comments: 3,
    },
    {
      href: "/vibe-coding/prompt-structure-tips",
      board: "바이브 코딩",
      title: "프롬프트를 어떻게 짜야 답변 품질이 올라가나요?",
      author: "작당탐험가",
      date: "2026.06.16",
      likes: 19,
      comments: 4,
    },
  ],
};

/** 팔로잉/팔로워 사용자 한 행의 데이터 형태 */
type FollowUser = {
  nickname: string;
  rank: RankTier;
  bio?: string;
};

/** 팔로잉 목록 목업 (내가 팔로우하는 사람들) */
const followingData: FollowUser[] = [
  { nickname: "자동화카페", rank: "expert", bio: "소규모 사장님들의 업무 자동화를 돕습니다." },
  { nickname: "리뷰메이트", rank: "master", bio: "AI 도구 리뷰와 실전 Tips." },
  { nickname: "주말개발자", rank: "member", bio: "주말마다 바이브 코딩 중." },
];

/** 팔로워 목록 목업 (나를 팔로우하는 사람들) */
const followersData: FollowUser[] = [
  { nickname: "자동화카페", rank: "expert", bio: "소규모 사장님들의 업무 자동화를 돕습니다." },
  { nickname: "밤샘작곡가", rank: "rookie", bio: "AI로 로파이 앨범 만드는 중." },
  { nickname: "기록하는사람", rank: "member", bio: "매일 일기를 요약하는 봇 운영 중." },
  { nickname: "그림덕후", rank: "practitioner", bio: "AI 웹툰 그리는 주말 취미인." },
];

/** 계정 관리 사이드바 메뉴 */
const accountLinks = [
  { href: "/settings/profile", icon: "user-settings-line", label: "프로필 수정" },
  { href: "/settings/notifications", icon: "notification-3-line", label: "알림 설정" },
  { href: "/settings/security", icon: "lock-line", label: "비밀번호 변경" },
];

export default function MyPage() {
  const { user, ready, logout } = useMockAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("posts");

  // "내가 쓴 글" 탭 전용 컨트롤: 게시판 필터 / 정렬 / 검색
  const [postBoard, setPostBoard] = useState<"all" | BoardKey>("all");
  const [postSort, setPostSort] = useState<PostSortKey>("latest");
  const [postKeyword, setPostKeyword] = useState("");

  // 로그인 사용자가 있으면 사용, 없으면 데모 프로필로 폴백한다.
  const profile = user ?? DEMO_USER;
  const isDemo = !user;

  // 내가 쓴 글에 실제로 존재하는 게시판만 필터 칩으로 노출
  const postBoardFilters = useMemo(() => {
    const present = new Set(myPosts.map((p) => p.board));
    return (["all", ...Object.keys(BOARDS)] as ("all" | BoardKey)[]).filter(
      (key) => key === "all" || present.has(key as BoardKey),
    );
  }, []);

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
  }, [postBoard, postSort, postKeyword]);

  // 등급 진행도: 현재 등급 정보 + 다음 등급 + 진행률(%) 계산
  const rankProgress = useMemo(() => {
    const info = resolveRank(profile.rank);
    if (!info) return null;
    const next = RANK_LIST.find((r) => r.order === info.order + 1);
    const pct = Math.min(
      100,
      Math.round((profileExtra.points / profileExtra.nextThreshold) * 100),
    );
    const remaining = Math.max(0, profileExtra.nextThreshold - profileExtra.points);
    return { info, next, pct, remaining };
  }, [profile.rank]);

  // 댓글/북마크/좋아요 탭의 활동 목록 (내가 쓴 글은 filteredPosts 사용)
  const items =
    activeTab === "posts" || activeTab === "following" || activeTab === "followers"
      ? []
      : activityData[activeTab];
  const activeTabLabel = tabs.find((t) => t.key === activeTab)?.label ?? "";

  // 패널 카운트: 팔로잉/팔로워 탭은 각 목록 길이로 계산
  const panelCount =
    activeTab === "posts"
      ? filteredPosts.length
      : activeTab === "following"
        ? followingData.length
        : activeTab === "followers"
          ? followersData.length
          : items.length;

  // 하이드레이션 불일치 방지: 마운트 전에는 사용자 의존 텍스트를 데모 기준으로 그린다.
  // (useMockAuth 가 ready 가 되면 실제 사용자로 자연스럽게 교체됨)
  void ready;

  return (
    <main id="main" className={styles.page}>
      {/* ── 프로필 헤더 밴드 ── */}
      <section className={styles.profileBand} aria-label="내 프로필">
        <div className={styles.profileBandInner}>
          <div className={styles.identity}>
            <Avatar name={profile.nickname} size="lg" className={styles.avatar} />
            <div className={styles.identityText}>
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{profile.nickname}</h1>
                <RankBadge rank={profile.rank} size={22} showLabel className={styles.rankBadge} />
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaItem}>
                  <Icon name="mail-line" />
                  {profile.email}
                </span>
                <span className={styles.metaDivider} aria-hidden="true">
                  ·
                </span>
                <span className={styles.metaItem}>
                  <Icon name="calendar-line" />
                  {profileExtra.joinDate} 가입
                </span>
                <span className={styles.metaDivider} aria-hidden="true">
                  ·
                </span>
                {/* 팔로잉/팔로워 카운트 헤더 요약 */}
                <span className={styles.metaItem}>
                  <Icon name="user-follow-line" />
                  팔로잉 {followingData.length}
                </span>
                <span className={styles.metaDivider} aria-hidden="true">
                  ·
                </span>
                <span className={styles.metaItem}>
                  <Icon name="user-heart-line" />
                  팔로워 {followersData.length}
                </span>
              </div>
              <p className={styles.bio}>{profileExtra.bio}</p>
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
          {isDemo && (
            <p className={styles.demoNotice} role="status">
              <Icon name="information-line" />
              로그인하지 않아 <strong>데모 프로필</strong>로 표시 중입니다. 실제 정보는 로그인 후 표시됩니다.
            </p>
          )}

          {/* ── 요약 통계 ── */}
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

            {/* 팔로잉 탭 */}
            {activeTab === "following" ? (
              followingData.length === 0 ? (
                <EmptyState
                  icon="user-follow-line"
                  title="팔로잉하는 멤버가 없습니다"
                  description="관심 있는 멤버의 프로필에서 팔로우해 보세요."
                />
              ) : (
                <ul className={styles.followList}>
                  {followingData.map((fu) => (
                    <li key={fu.nickname} className={styles.followItem}>
                      <Avatar name={fu.nickname} size="md" className={styles.followAvatar} />
                      <div className={styles.followInfo}>
                        <div className={styles.followNameRow}>
                          <Link href={`/u/${encodeURIComponent(fu.nickname)}`} className={styles.followName}>
                            {fu.nickname}
                          </Link>
                          <RankBadge rank={fu.rank} size={18} showLabel />
                        </div>
                        {fu.bio && <p className={styles.followBio}>{fu.bio}</p>}
                      </div>
                      {/* FollowButton: 팔로잉 목록이므로 initialFollowing=true */}
                      <FollowButton
                        targetNickname={fu.nickname}
                        initialFollowing={true}
                        className={styles.followBtn}
                      />
                    </li>
                  ))}
                </ul>
              )
            ) : activeTab === "followers" ? (
              /* 팔로워 탭 */
              followersData.length === 0 ? (
                <EmptyState
                  icon="user-heart-line"
                  title="팔로워가 없습니다"
                  description="활동을 이어가면 팔로워가 생깁니다."
                />
              ) : (
                <ul className={styles.followList}>
                  {followersData.map((fu) => (
                    <li key={fu.nickname} className={styles.followItem}>
                      <Avatar name={fu.nickname} size="md" className={styles.followAvatar} />
                      <div className={styles.followInfo}>
                        <div className={styles.followNameRow}>
                          <Link href={`/u/${encodeURIComponent(fu.nickname)}`} className={styles.followName}>
                            {fu.nickname}
                          </Link>
                          <RankBadge rank={fu.rank} size={18} showLabel />
                        </div>
                        {fu.bio && <p className={styles.followBio}>{fu.bio}</p>}
                      </div>
                      {/* 팔로워 탭: 내가 맞팔하고 있는지 initialFollowing 으로 반영
                          목업상 팔로워 중 자동화카페만 맞팔 상태로 가정 */}
                      <FollowButton
                        targetNickname={fu.nickname}
                        initialFollowing={fu.nickname === "자동화카페"}
                        className={styles.followBtn}
                      />
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
            ) : items.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="inbox-line" />
                <p>아직 항목이 없습니다.</p>
              </div>
            ) : (
              <ul className={styles.activityList}>
                {items.map((item) => (
                  <li key={`${item.href}-${item.title}`} className={styles.activityItem}>
                    <div className={styles.activityTop}>
                      <Badge tone="neutral" variant="soft" className={styles.boardBadge}>
                        {item.board}
                      </Badge>
                      {item.author && (
                        <span className={styles.activityAuthor}>by {item.author}</span>
                      )}
                    </div>

                    <Link href={item.href} className={styles.activityTitle}>
                      {item.title}
                    </Link>

                    {item.excerpt && <p className={styles.activityExcerpt}>{item.excerpt}</p>}

                    <div className={styles.activityFooter}>
                      <span className={styles.activityDate}>{item.date}</span>
                      <div className={styles.activityStats} aria-label="반응 정보">
                        <span>
                          <Icon name="heart-3-line" />
                          {item.likes}
                        </span>
                        <span>
                          <Icon name="chat-1-line" />
                          {item.comments}
                        </span>
                        {typeof item.views === "number" && (
                          <span>
                            <Icon name="eye-line" />
                            {item.views}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
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
                <RankBadge rank={profile.rank} size={56} />
                <div className={styles.rankShowcaseText}>
                  <strong>{rankProgress.info.label}</strong>
                  <span>{profileExtra.points.toLocaleString()} P</span>
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
                <p className={styles.progressText}>최고 등급을 달성했습니다 🎉</p>
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
                  onClick={logout}
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

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
import { RANK_LIST, resolveRank } from "@/lib/ranks";
import type { RankTier } from "@/lib/ranks";
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

type TabKey = "posts" | "comments" | "bookmarks" | "likes" | "following" | "followers";

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "posts", label: "내가 쓴 글", icon: "article-line" },
  { key: "comments", label: "내 댓글", icon: "chat-1-line" },
  { key: "bookmarks", label: "북마크", icon: "bookmark-line" },
  { key: "likes", label: "좋아요한 글", icon: "heart-3-line" },
  // 팔로잉/팔로워 탭 (단일 /mypage 내 탭으로 확장 — 별도 라우트 없음)
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

/** 계정 관리 사이드바 메뉴 */
const accountLinks = [
  { href: "/settings/profile", icon: "user-settings-line", label: "프로필 수정" },
  { href: "/settings/notifications", icon: "notification-3-line", label: "알림 설정" },
  { href: "/settings/security", icon: "lock-line", label: "비밀번호 변경" },
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

export default function MyPage() {
  const { user, ready, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("posts");

  // "내가 쓴 글" 탭 전용 컨트롤: 게시판 필터 / 정렬 / 검색
  const [postBoard, setPostBoard] = useState<"all" | BoardKey>("all");
  const [postSort, setPostSort] = useState<PostSortKey>("latest");
  const [postKeyword, setPostKeyword] = useState("");

  // bio: 세션에 없으므로 /api/v1/users/me 에서 별도 조회 (Epic 2~5 이전까지 null)
  const [bio, setBio] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/v1/users/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { bio?: string | null } | null) => {
        if (data?.bio) setBio(data.bio);
      })
      .catch(() => { /* bio 로드 실패 시 무시 */ });
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

  // 등급 진행도: 현재 등급 정보 + 다음 등급 + 진행률(%) 계산
  // points: 게이미피케이션 API 구현 전까지 0
  const rankProgress = useMemo(() => {
    if (!profile) return null;
    const info = resolveRank(profile.rank);
    if (!info) return null;
    const next = RANK_LIST.find((r) => r.order === info.order + 1);
    const points = 0; // Epic 6 포인트 시스템 구현 전
    const pct = 0; // 포인트 없음
    const remaining = next ? next.order * 1000 : 0; // 플레이스홀더
    return { info, next, pct, remaining, points };
  }, [profile]);

  // 팔로잉/팔로워: Epic 5에서 활성화
  const followingCount = 0; // Epic 5에서 활성화
  const followersCount = 0; // Epic 5에서 활성화

  // 패널 카운트
  const panelCount =
    activeTab === "posts"
      ? filteredPosts.length
      : activeTab === "following" || activeTab === "followers"
        ? 0 // Epic 5에서 활성화
        : 0; // Epic 2~4에서 활성화

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
      {/* ── 프로필 헤더 밴드 ── */}
      <section className={styles.profileBand} aria-label="내 프로필">
        <div className={styles.profileBandInner}>
          <div className={styles.identity}>
            <Avatar name={profile.nickname} src={avatarSrc} size="lg" className={styles.avatar} />
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

            {/* 팔로잉 탭 — Epic 5에서 활성화 */}
            {activeTab === "following" ? (
              <EmptyState
                icon="user-follow-line"
                title="팔로잉하는 멤버가 없습니다"
                description="관심 있는 멤버의 프로필에서 팔로우해 보세요."
              />
            ) : activeTab === "followers" ? (
              /* 팔로워 탭 — Epic 5에서 활성화 */
              <EmptyState
                icon="user-heart-line"
                title="팔로워가 없습니다"
                description="활동을 이어가면 팔로워가 생깁니다."
              />
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
                <RankBadge rank={profile.rank} size={56} />
                <div className={styles.rankShowcaseText}>
                  <strong>{rankProgress.info.label}</strong>
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

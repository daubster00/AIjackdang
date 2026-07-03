// 공개 프로필 페이지 /u/[nickname].
// - 서버 컴포넌트: generateMetadata / generateStaticParams / notFound() 처리.
// - 비회원도 열람 가능 (로그인 불필요).
// - 팔로우 버튼 등 인터랙션은 클라이언트 컴포넌트(ProfileInteraction)로 분리.
// - JSON-LD ProfilePage 스크립트 삽입.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Avatar, Badge, EmptyState, Icon, RankBadge } from "@/components/ui";
import type { PublicProfile } from "@ai-jakdang/contracts";
import { BOARDS } from "@ai-jakdang/contracts";
import { rankTierFromGradeLevel } from "@/lib/ranks";
import type { RankTier } from "@/lib/ranks";
import { ProfileInteraction } from "./ProfileInteraction";
import { FeaturedPostsPanel } from "./FeaturedPostsPanel";
import { resolveAvatarUrl } from "@/lib/avatar";
import styles from "./profile.module.css";

/** API 내부 URL. SSR 서버 컴포넌트에서 절대 경로로 fetch. */
const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

/** 사용자 등급 API fetch (서버 컴포넌트 전용, 공개). */
async function fetchUserGrade(userId: string): Promise<{ level: number; name: string } | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/gamification/user/${encodeURIComponent(userId)}/grade`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { grade: { level: number; name: string } };
    return data.grade ?? null;
  } catch {
    return null;
  }
}

/** 공개 프로필 API fetch (서버 컴포넌트 전용). */
async function fetchPublicProfile(nickname: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/users/profile/${encodeURIComponent(nickname)}`,
      { cache: "no-store" },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as PublicProfile;
  } catch {
    return null;
  }
}

/** 피처드 글 데이터 fetch (서버 컴포넌트 전용, 공개). */
interface FeaturedPostItem {
  id: string;
  kind: "post" | "resource";
  board: string;
  boardLabel: string;
  slug: string;
  title: string;
  excerpt: string | null;
  createdAt: string;
  viewCount: number;
}

async function fetchFeaturedPosts(nickname: string): Promise<FeaturedPostItem[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/users/profile/${encodeURIComponent(nickname)}/featured-posts`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items: FeaturedPostItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// 완전 동적 렌더(SSR per-request) 강제.
// 이 페이지는 cookies() + no-store fetch(공개 프로필/등급/로그인 유저)를 사용한다.
// generateStaticParams 를 두면(빈 배열이라도) Next 가 이 라우트를 "정적 생성" 대상으로
// 오인 → 운영 빌드에서 첫 요청 시 정적 렌더를 시도하다 no-store fetch 를 만나
// "Page changed from static to dynamic at runtime" 예외로 500 을 낸다(로컬 dev 는
// 항상 동적이라 재현 안 됨). force-dynamic 으로 정적화 자체를 차단한다.
export const dynamic = "force-dynamic";

/** generateMetadata: 닉네임별 고유 메타 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ nickname: string }>;
}): Promise<Metadata> {
  const { nickname } = await params;
  const decoded = decodeURIComponent(nickname);
  const profile = await fetchPublicProfile(decoded);

  // 존재하지 않는 닉네임(탈퇴 포함): noindex
  if (!profile) {
    return {
      title: "존재하지 않는 회원",
      robots: { index: false, follow: false },
    };
  }

  const title = `${profile.nickname}의 프로필 | AI작당`;
  const description = profile.bio ?? `${profile.nickname} 님의 AI작당 공개 프로필`;
  const canonical = `https://aijakdang.com/u/${profile.nickname}`;
  const avatarUrl = resolveAvatarUrl(profile);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${profile.nickname}의 프로필`,
      description,
      images: avatarUrl ? [avatarUrl] : [],
    },
    robots: { index: true },
  };
}

/** 공개 프로필 페이지 (서버 컴포넌트) */
export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ nickname: string }>;
}) {
  const { nickname } = await params;
  const decoded = decodeURIComponent(nickname);
  const profile = await fetchPublicProfile(decoded);

  if (!profile) notFound();

  // 등급 정보 조회 (공개 API, 실패 시 기본값 사용)
  const gradeInfo = await fetchUserGrade(profile.id);
  const rankTier: RankTier = gradeInfo
    ? rankTierFromGradeLevel(gradeInfo.level)
    : "rookie";

  const cookieStore = await cookies();
  const cookie = cookieStore.toString();

  // 로그인 유저 정보 조회 (isOwner 판별 + 팔로우 상태)
  const [meRes, followStatusRes] = await Promise.all([
    fetch(`${API_BASE}/api/v1/users/me`, {
      headers: { cookie },
      cache: "no-store",
    }),
    fetch(
      `${API_BASE}/api/v1/users/${encodeURIComponent(decoded)}/follow-status`,
      { headers: { cookie }, cache: "no-store" },
    ),
  ]);

  const meUser = meRes.ok
    ? ((await meRes.json()) as { id: string; nickname?: string })
    : null;

  const followStatus = followStatusRes.ok
    ? ((await followStatusRes.json()) as {
        isFollowing: boolean;
        isBlocked: boolean;
        followersCount: number;
        followingCount: number;
      })
    : null;

  /** 현재 로그인 유저가 이 프로필의 주인인지 (서버 사이드 판별) */
  const isOwner = !!meUser && meUser.id === profile.id;

  // 피처드 글 목록 — featuredPostIds 가 있을 때만 API 호출
  const featuredPosts: FeaturedPostItem[] =
    (profile.featuredPostIds?.length ?? 0) > 0
      ? await fetchFeaturedPosts(decoded)
      : [];

  const avatarUrl = resolveAvatarUrl(profile);

  // ProfilePage JSON-LD 스키마 (schema.org)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateCreated: profile.createdAt,
    dateModified: profile.updatedAt ?? profile.createdAt,
    mainEntity: {
      "@type": "Person",
      name: profile.nickname,
      identifier: profile.nickname,
      image: avatarUrl,
      description: profile.bio ?? "",
      url: `https://aijakdang.com/u/${profile.nickname}`,
    },
  };

  return (
    <main id="main" className={styles.page}>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── 배너 + 프로필 헤더 ── */}
      <div className={styles.bannerArea}>
        {profile.bannerUrl ? (
          <img src={profile.bannerUrl} alt="" className={styles.bannerImage} />
        ) : (
          <div className={styles.bannerPlaceholder} aria-hidden="true" />
        )}
      </div>

      <div className={styles.headerWrap}>
        <div className={styles.headerInner}>
          <div className={styles.avatarArea}>
            <Avatar
              name={profile.nickname}
              src={avatarUrl}
              size="lg"
              className={styles.avatar}
            />
          </div>

          <div className={styles.identityArea}>
            <div className={styles.nameRow}>
              <h1 className={styles.name}>{profile.nickname}</h1>
              {/* RankBadge: lib/ranks + RankBadge 컴포넌트로만 표기(전역 규칙) */}
              {/* aria-label: AC#4, AC#8 — 색 단독 전달 금지, 등급명 명시 필수 */}
              <RankBadge
                rank={rankTier}
                size={22}
                showLabel
                ariaLabel={gradeInfo ? `등급: ${gradeInfo.name}` : undefined}
                className={styles.rankBadge}
              />
            </div>

            {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

            <p className={styles.joinDate}>
              <Icon name="calendar-line" />
              {new Date(profile.createdAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })} 가입
            </p>
          </div>

          <ProfileInteraction
            profileId={profile.id}
            targetNickname={profile.nickname}
            followers={followStatus?.followersCount ?? profile.followersCount}
            following={followStatus?.followingCount ?? profile.followingCount}
            initialFollowing={followStatus?.isFollowing ?? false}
            isBlocked={followStatus?.isBlocked ?? false}
          />
        </div>
      </div>

      {/* ── 본문: 작성 글 목록 + 오너 전용 노출 설정 패널 ── */}
      <div className={styles.contentWrap}>
        <div className={styles.contentLayout}>
          {/* ── 왼쪽: 피처드 글 목록 ── */}
          <section className={styles.mainContent} aria-label={`${profile.nickname} 님의 작성 글`}>
            <h2 className={styles.sectionTitle}>
              <Icon name="article-line" />
              작성 글
              <span className={styles.sectionCount}>{featuredPosts.length}</span>
            </h2>

            {featuredPosts.length > 0 ? (
              <ul className={styles.postList}>
                {featuredPosts.map((post) => (
                  <li key={post.id} className={styles.postItem}>
                    <div className={styles.postTop}>
                      <Badge variant="outline" className={styles.boardBadge}>
                        {post.boardLabel}
                      </Badge>
                    </div>
                    <Link
                      href={(() => {
                        const meta = BOARDS[post.board];
                        const base = meta ? meta.urlPath.split("?")[0] : `/${post.board}`;
                        return `${base}/${post.slug}`;
                      })()}
                      className={styles.postTitle}
                    >
                      {post.title}
                    </Link>
                    {post.excerpt && (
                      <p className={styles.postExcerpt}>{post.excerpt}</p>
                    )}
                    <div className={styles.postFooter}>
                      <span className={styles.postDate}>
                        {new Date(post.createdAt).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </span>
                      <span className={styles.postStats}>
                        <span>
                          <Icon name="eye-line" />
                          {post.viewCount.toLocaleString()}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon="quill-pen-line"
                title="아직 공개된 작성물이 없어요"
                description={
                  isOwner
                    ? "오른쪽 패널에서 소개할 글을 선택해 주세요."
                    : "이 멤버가 선택한 글이 공개되면 여기에 표시됩니다."
                }
              />
            )}
          </section>

          {/* ── 오른쪽: 오너 전용 노출 글 선택 패널 ── */}
          {isOwner && (
            <FeaturedPostsPanel initialFeaturedIds={profile.featuredPostIds ?? []} />
          )}
        </div>
      </div>
    </main>
  );
}

// 공개 프로필 페이지 /u/[nickname].
// - 서버 컴포넌트: generateMetadata / generateStaticParams / notFound() 처리.
// - 비회원도 열람 가능 (로그인 불필요).
// - 팔로우 버튼 등 인터랙션은 클라이언트 컴포넌트(ProfileInteraction)로 분리.
// - JSON-LD ProfilePage 스크립트 삽입.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar, EmptyState, Icon, RankBadge } from "@/components/ui";
import type { PublicProfile } from "@ai-jakdang/contracts";
import type { RankTier } from "@/lib/ranks";
import { ProfileInteraction } from "./ProfileInteraction";
import { resolveAvatarUrl } from "@/lib/avatar";
import styles from "./profile.module.css";

/** API 내부 URL. SSR 서버 컴포넌트에서 절대 경로로 fetch. */
const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

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

/** generateStaticParams: 완전 동적 렌더 — 빈 배열 유지 */
export function generateStaticParams() {
  return [];
}

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
  const avatarUrl =
    resolveAvatarUrl(profile);

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

  // 존재하지 않는 닉네임 또는 탈퇴 회원(API가 404로 응답) → Next.js 404
  // AC#5: 탈퇴 회원 별도 안내("탈퇴한 회원이에요")는 API가 프라이버시상 구분 정보를
  // 반환하지 않으므로(없음/탈퇴 모두 404) 구현 불가 — Completion Notes 편차 기재.
  if (!profile) {
    notFound();
  }

  const avatarUrl =
    resolveAvatarUrl(profile);

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
              <RankBadge
                rank={profile.rank as RankTier}
                size={22}
                showLabel
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

          {/* 팔로워/팔로잉 카운트 + 팔로우 버튼 (클라이언트 컴포넌트) */}
          {/* TODO: Epic 5 Story 5.12 — 팔로우/팔로워 실데이터 연결 */}
          <ProfileInteraction
            profileId={profile.id}
            targetNickname={profile.nickname}
            followers={profile.followersCount}
            following={profile.followingCount}
          />
        </div>
      </div>

      {/* ── 본문: 작성 글 목록 (Epic 3~4에서 집계 채워짐) ── */}
      <div className={styles.contentWrap}>
        <section aria-label={`${profile.nickname} 님의 작성 글`}>
          <h2 className={styles.sectionTitle}>
            <Icon name="article-line" />
            작성 글
            <span className={styles.sectionCount}>0</span>
          </h2>

          {/* 작성 글 목록: Epic 3~4에서 실데이터로 교체 */}
          <EmptyState
            icon="quill-pen-line"
            title="아직 공개된 작성물이 없어요"
            description="이 멤버가 작성한 글이 공개되면 여기에 표시됩니다."
          />
        </section>
      </div>
    </main>
  );
}

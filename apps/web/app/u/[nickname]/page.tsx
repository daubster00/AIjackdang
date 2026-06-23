// 공개 프로필 페이지 /u/[nickname].
// - 서버 컴포넌트: generateMetadata / generateStaticParams / notFound() 처리.
// - 비회원도 열람 가능 (로그인 불필요).
// - 팔로우 버튼 등 인터랙션은 클라이언트 컴포넌트(FollowButton, ProfileInteraction)로 분리.
// - JSON-LD ProfilePage 스크립트 삽입.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, EmptyState, Icon, RankBadge, Tag } from "@/components/ui";
import type { RankTier } from "@/lib/ranks";
import { ProfileInteraction } from "./ProfileInteraction";
import styles from "./profile.module.css";

/** 목업 프로필 데이터 (닉네임 → 상세 정보 맵) */
interface MockProfile {
  nickname: string;
  /** 한 줄 소개 */
  bio: string;
  /** 아바타 이미지 URL (null 이면 닉네임 첫 글자 기본 아바타) */
  avatarSrc: string | null;
  /** 배너 이미지 URL (null 이면 그라데이션 플레이스홀더) */
  bannerSrc: string | null;
  rank: RankTier;
  /** 가입일 */
  joinDate: string;
  /** 팔로워 수 */
  followers: number;
  /** 팔로잉 수 */
  following: number;
  /** 외부 링크 목록 { label, url } */
  links: { label: string; url: string }[];
  /** 공개 게시글 목록 */
  posts: {
    id: string;
    board: string;
    boardTone: "info" | "success" | "warning" | "primary" | "neutral";
    href: string;
    title: string;
    excerpt: string;
    tags: string[];
    date: string;
    likes: number;
    comments: number;
    views: number;
  }[];
}

/** 샘플 프로필 맵 (실서비스에서는 DB 조회로 대체) */
const MOCK_PROFILES: Record<string, MockProfile> = {
  작당탐험가: {
    nickname: "작당탐험가",
    bio: "n8n·Claude Code로 사이드 프로젝트 만드는 중. 자동화 외주도 조금씩 받고 있어요.",
    avatarSrc: null,
    bannerSrc: null,
    rank: "practitioner",
    joinDate: "2026.03.12",
    followers: 84,
    following: 37,
    links: [
      { label: "GitHub", url: "https://github.com/example" },
      { label: "블로그", url: "https://blog.example.com" },
    ],
    posts: [
      {
        id: "p1",
        board: "AI 자동화",
        boardTone: "warning",
        href: "/automation/n8n-slack-digest",
        title: "n8n으로 매일 아침 Slack 업무 다이제스트 만들기",
        excerpt: "여러 채널의 전날 메시지를 모아 GPT로 요약하고, 출근 시간에 맞춰 한 번에 던져주는 워크플로우입니다.",
        tags: ["n8n", "Slack", "자동화"],
        date: "2026.06.12",
        likes: 96,
        comments: 23,
        views: 1204,
      },
      {
        id: "p2",
        board: "묻고답하기",
        boardTone: "info",
        href: "/questions/claude-code-php-misunderstanding",
        title: "Claude Code가 기존 PHP 구조를 계속 잘못 이해합니다",
        excerpt: "레거시 PHP 프로젝트를 수정하려는데 파일 구조를 매번 다르게 해석해서 엉뚱한 곳을 고칩니다.",
        tags: ["ClaudeCode", "PHP"],
        date: "2026.06.18",
        likes: 4,
        comments: 0,
        views: 82,
      },
    ],
  },
  자동화카페: {
    nickname: "자동화카페",
    bio: "소규모 사장님들의 업무 자동화를 돕습니다. n8n 실전 사례 공유.",
    avatarSrc: null,
    bannerSrc: null,
    rank: "expert",
    joinDate: "2025.11.04",
    followers: 213,
    following: 58,
    links: [{ label: "사이트", url: "https://automationcafe.kr" }],
    posts: [
      {
        id: "p1",
        board: "AI 자동화",
        boardTone: "warning",
        href: "/automation/small-biz-n8n",
        title: "소규모 사업장에서 n8n 실전 도입기",
        excerpt: "예약·주문 문자 자동 발송부터 인스타그램 디엠 응대까지 도입한 흐름을 공유합니다.",
        tags: ["n8n", "소상공인", "자동화"],
        date: "2026.05.28",
        likes: 152,
        comments: 41,
        views: 2340,
      },
    ],
  },
  리뷰메이트: {
    nickname: "리뷰메이트",
    bio: "AI 도구 리뷰와 실전 Tips. Claude Code·Cursor·Windsurf 비교 테스트 중.",
    avatarSrc: null,
    bannerSrc: null,
    rank: "master",
    joinDate: "2025.09.20",
    followers: 512,
    following: 104,
    links: [
      { label: "YouTube", url: "https://youtube.com/@example" },
      { label: "뉴스레터", url: "https://newsletter.example.com" },
    ],
    posts: [
      {
        id: "p1",
        board: "실전자료",
        boardTone: "neutral",
        href: "/resources/mcp-skills",
        title: "Claude Code MCP·Skills 모음 (계속 업데이트)",
        excerpt: "Claude Code 에서 쓸 수 있는 MCP 서버와 Skills 를 정리합니다. 검증된 것만 올립니다.",
        tags: ["MCP", "ClaudeCode"],
        date: "2026.06.11",
        likes: 142,
        comments: 23,
        views: 3210,
      },
    ],
  },
};

/** generateStaticParams: 샘플 닉네임 미리 빌드 */
export function generateStaticParams() {
  return Object.keys(MOCK_PROFILES).map((nickname) => ({ nickname }));
}

/** generateMetadata: 닉네임별 고유 메타 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ nickname: string }>;
}): Promise<Metadata> {
  const { nickname } = await params;
  const decoded = decodeURIComponent(nickname);
  const profile = MOCK_PROFILES[decoded];

  // 존재하지 않는 닉네임: noindex
  if (!profile) {
    return {
      title: "존재하지 않는 회원",
      robots: { index: false },
    };
  }

  return {
    title: `${profile.nickname}의 프로필 | AI작당`,
    description: profile.bio || `${profile.nickname} 님의 AI작당 공개 프로필`,
    openGraph: {
      title: `${profile.nickname}의 프로필`,
      description: profile.bio,
    },
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
  const profile = MOCK_PROFILES[decoded];

  // 존재하지 않는 닉네임 → 404
  if (!profile) {
    notFound();
  }

  // ProfilePage JSON-LD 스키마
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${profile.nickname}의 프로필`,
    description: profile.bio,
    mainEntity: {
      "@type": "Person",
      name: profile.nickname,
      description: profile.bio,
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
        {profile.bannerSrc ? (
          <img src={profile.bannerSrc} alt="" className={styles.bannerImage} />
        ) : (
          <div className={styles.bannerPlaceholder} aria-hidden="true" />
        )}
      </div>

      <div className={styles.headerWrap}>
        <div className={styles.headerInner}>
          <div className={styles.avatarArea}>
            <Avatar
              name={profile.nickname}
              src={profile.avatarSrc ?? undefined}
              size="lg"
              className={styles.avatar}
            />
          </div>

          <div className={styles.identityArea}>
            <div className={styles.nameRow}>
              <h1 className={styles.name}>{profile.nickname}</h1>
              <RankBadge rank={profile.rank} size={22} showLabel className={styles.rankBadge} />
            </div>

            {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

            {/* 외부 링크 칩 */}
            {profile.links.length > 0 && (
              <div className={styles.linkRow} aria-label="외부 링크">
                {profile.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.linkChip}
                  >
                    <Icon name="link" />
                    {link.label}
                  </a>
                ))}
              </div>
            )}

            <p className={styles.joinDate}>
              <Icon name="calendar-line" />
              {profile.joinDate} 가입
            </p>
          </div>

          {/* 팔로워/팔로잉 카운트 + 팔로우 버튼 (클라이언트 컴포넌트) */}
          <ProfileInteraction
            targetNickname={profile.nickname}
            followers={profile.followers}
            following={profile.following}
          />
        </div>
      </div>

      {/* ── 본문: 작성 글 목록 ── */}
      <div className={styles.contentWrap}>
        <section aria-label={`${profile.nickname} 님의 작성 글`}>
          <h2 className={styles.sectionTitle}>
            <Icon name="article-line" />
            작성 글
            <span className={styles.sectionCount}>{profile.posts.length}</span>
          </h2>

          {profile.posts.length === 0 ? (
            <EmptyState
              icon="quill-pen-line"
              title="아직 작성한 글이 없습니다"
              description="이 멤버가 작성한 글이 공개되면 여기에 표시됩니다."
            />
          ) : (
            <ul className={styles.postList}>
              {profile.posts.map((post) => (
                <li key={post.id} className={styles.postItem}>
                  <div className={styles.postTop}>
                    <Badge tone={post.boardTone} variant="soft" className={styles.boardBadge}>
                      {post.board}
                    </Badge>
                    <div className={styles.postTagRow}>
                      {post.tags.map((tag) => (
                        <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                          #{tag}
                        </Tag>
                      ))}
                    </div>
                  </div>

                  <Link href={post.href} className={styles.postTitle}>
                    {post.title}
                  </Link>

                  <p className={styles.postExcerpt}>{post.excerpt}</p>

                  <div className={styles.postFooter}>
                    <span className={styles.postDate}>{post.date}</span>
                    <div className={styles.postStats} aria-label="반응 정보">
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
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

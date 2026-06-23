/**
 * 바이브 코딩 카테고리 랜딩 페이지 — Story 2.3 (API 연동)
 *
 * vibe-coding-guide 게시판의 게시글을 API에서 SSR로 불러온다.
 * 레이아웃·컴포넌트 구조는 Story 2.3 이전과 동일하게 유지한다.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { AuthorName, Avatar, Button, Icon, Tag, EmptyState } from "@/components/ui";
import { BoardHero, BoardSidebar, SearchAutocomplete } from "@/components/board";
import type { PaginatedPosts, PostCard } from "@ai-jakdang/contracts";
import styles from "./vibe-coding.module.css";

export const metadata: Metadata = {
  title: "바이브 코딩 가이드 | AI작당",
  description: "바이브 코딩 방법론 · 튜토리얼 · 실전 가이드",
};

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

async function fetchPosts(sort: string, page: number, cookie: string): Promise<PaginatedPosts> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/posts?board=vibe-coding-guide&sort=${sort}&page=${page}&pageSize=20`,
      { headers: { cookie }, next: { revalidate: 30 } },
    );
    if (res.ok) return (await res.json()) as PaginatedPosts;
  } catch {
    // API 연결 실패 시 빈 목록 반환
  }
  return { items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } };
}

interface PageProps {
  searchParams: Promise<{ sort?: string; page?: string }>;
}

export default async function VibeCodingPage({ searchParams }: PageProps) {
  const { sort = "latest", page: rawPage = "1" } = await searchParams;
  const page = Math.max(1, parseInt(rawPage, 10) || 1);

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const { items: posts, meta } = await fetchPosts(sort, page, cookie);

  const recentPosts = posts.slice(0, 4).map((post) => ({
    href: `/vibe-coding/${post.slug}`,
    board: "바이브코딩 가이드",
    title: post.title,
  }));

  const userRankings = [
    { rank: 1, nickname: "코드작당러", tier: "master" as const },
    { rank: 2, nickname: "자동화카페", tier: "expert" as const },
    { rank: 3, nickname: "프론트라인", tier: "practitioner" as const },
    { rank: 4, nickname: "리뷰메이트", tier: "member" as const },
  ];

  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="vibe-coding" currentSub="바이브코딩 가이드" />

      <section className={styles.guideToolbar} aria-label="가이드 검색 및 정렬">
        <div className={styles.sortGroup}>
          <SearchAutocomplete
            label="가이드 검색"
            placeholder="가이드 검색"
            popularTags={["바이브코딩", "ClaudeCode", "검증", "리팩터링", "디자인", "반응형"]}
          />
        </div>
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 {meta.totalItems}개</span>
          </div>
          <Link href="/vibe-coding/write">
            <Button
              className={styles.writeButton}
              leftIcon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              }
            >
              글쓰기
            </Button>
          </Link>
        </div>

        <div className={styles.mainCol}>
          {posts.length === 0 ? (
            <EmptyState
              icon="file-list-3-line"
              title="아직 글이 없어요"
              description="첫 글을 작성해 보세요."
              actions={
                <Link href="/vibe-coding/write">
                  <Button>글쓰기</Button>
                </Link>
              }
            />
          ) : (
            <section className={styles.postList} aria-label="바이브 코딩 게시글 목록">
              {posts.map((post) => (
                <PostItem key={post.id} post={post} basePath="/vibe-coding" />
              ))}
            </section>
          )}

          {meta.totalPages > 1 && (
            <nav className={styles.pagination} aria-label="페이지 이동">
              <button type="button" aria-label="이전 페이지" disabled={page <= 1}>
                <Icon name="arrow-left-s-line" />
              </button>
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={p === 1 ? "/vibe-coding" : `/vibe-coding?page=${p}`}>
                  <button type="button" aria-current={p === page ? "page" : undefined}>
                    {p}
                  </button>
                </Link>
              ))}
              <button type="button" aria-label="다음 페이지" disabled={page >= meta.totalPages}>
                <Icon name="arrow-right-s-line" />
              </button>
            </nav>
          )}
        </div>

        <BoardSidebar
          recentPosts={recentPosts}
          rankings={userRankings}
          ariaLabel="가이드 보조 정보"
        />
      </div>
    </main>
  );
}

function PostItem({ post, basePath }: { post: PostCard; basePath: string }) {
  const postHref = `${basePath}/${post.slug}`;
  const formattedDate = new Date(post.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <article className={styles.postItem}>
      <div className={styles.postBody}>
        <div className={styles.postTop}>
          <div className={styles.tagRow}>
            {post.tags.map((tag) => (
              <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>#{tag}</Tag>
            ))}
          </div>
        </div>

        <h3 className={styles.postHeading}>
          <Link href={postHref} className={styles.postTitle}>
            {post.title}
          </Link>
        </h3>

        {post.summary && <p className={styles.postExcerpt}>{post.summary}</p>}

        <div className={styles.postFooter}>
          <div className={styles.postAuthor}>
            <Avatar name={post.authorNickname ?? "익명"} size="sm" />
            <AuthorName name={post.authorNickname ?? "익명"} className={styles.authorName} />
            <span className={styles.footerDivider} aria-hidden="true">|</span>
            <span className={styles.postDate}>{formattedDate}</span>
          </div>
          <div className={styles.postStats} aria-label="게시글 정보">
            <span>
              <Icon name="eye-line" />
              {post.viewCount.toLocaleString()}
            </span>
            <span>
              <Icon name="chat-3-line" />
              {post.commentCount}
            </span>
            <span>
              <Icon name="heart-3-line" />
              {post.likeCount}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

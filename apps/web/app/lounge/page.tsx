/**
 * 작당 라운지 카테고리 랜딩 페이지 — Story 2.3 (API 연동)
 *
 * talk 게시판의 게시글을 API에서 SSR로 불러온다.
 * 레이아웃·컴포넌트 구조는 Story 2.3 이전과 동일하게 유지한다.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Avatar, AuthorName, Button, Icon, Tag, EmptyState } from "@/components/ui";
import { BoardHero, SearchAutocomplete } from "@/components/board";
import type { PaginatedPosts, PostCard } from "@ai-jakdang/contracts";
import styles from "./lounge.module.css";

export const metadata: Metadata = {
  title: "작당 라운지",
  description: "AI 작당 멤버들의 자유 대화 공간",
};

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

async function fetchPosts(sort: string, page: number, cookie: string): Promise<PaginatedPosts> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/posts?board=talk&sort=${sort}&page=${page}&pageSize=20`,
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

export default async function LoungePage({ searchParams }: PageProps) {
  const { sort = "latest", page: rawPage = "1" } = await searchParams;
  const page = Math.max(1, parseInt(rawPage, 10) || 1);

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const { items: posts, meta } = await fetchPosts(sort, page, cookie);

  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="lounge" currentSub="AI 창작마당" />

      <section className={styles.guideToolbar} aria-label="게시글 검색 및 정렬">
        <div className={styles.sortGroup}>
          <SearchAutocomplete
            label="라운지 검색"
            placeholder="라운지 검색"
            popularTags={["웹툰", "음악", "사이드프로젝트", "창작물", "자랑", "봇"]}
          />
        </div>
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 {meta.totalItems}개</span>
          </div>
          <Link href="/lounge/write">
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
                <Link href="/lounge/write">
                  <Button>글쓰기</Button>
                </Link>
              }
            />
          ) : (
            <section className={styles.galleryGrid} aria-label="작당 라운지 게시글 목록">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </section>
          )}

          {meta.totalPages > 1 && (
            <nav className={styles.pagination} aria-label="페이지 이동">
              <button type="button" aria-label="이전 페이지" disabled={page <= 1}>
                <Icon name="arrow-left-s-line" />
              </button>
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={p === 1 ? "/lounge" : `/lounge?page=${p}`}>
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
      </div>
    </main>
  );
}

function PostCard({ post }: { post: PostCard }) {
  const postHref = `/lounge/${post.slug}`;

  return (
    <article className={styles.card}>
      <div className={styles.cardBody}>
        <div className={styles.cardAuthor}>
          <Avatar name={post.authorNickname ?? "익명"} size="sm" />
          <AuthorName name={post.authorNickname ?? "익명"} className={styles.authorName} />
        </div>

        <h3 className={styles.cardHeading}>
          <Link href={postHref} className={styles.cardTitle}>
            {post.title}
          </Link>
        </h3>

        {post.tags.length > 0 && (
          <div className={styles.cardTagRow}>
            {post.tags.map((tag) => (
              <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>#{tag}</Tag>
            ))}
          </div>
        )}

        <div className={styles.cardStats} aria-label="게시글 정보">
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
    </article>
  );
}

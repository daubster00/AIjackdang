/**
 * AI 수익화 카테고리 랜딩 페이지 — Story 2.3 (API 연동)
 *
 * monetization-tips / monetization-cases 게시판의 게시글을 API에서 SSR로 불러온다.
 * 서브 게시판은 ?board=<slug> 쿼리 파람으로 전환하며, 기본값은 monetization-tips.
 * 레이아웃·컴포넌트 구조는 Story 2.3 이전과 동일하게 유지한다.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { AuthorName, Avatar, Button, Icon, Tag, EmptyState } from "@/components/ui";
import { AskButton, BoardHero, BoardSidebar, SearchAutocomplete } from "@/components/board";
import type { PaginatedPosts, PostCard } from "@ai-jakdang/contracts";
import { BOARDS } from "@ai-jakdang/contracts";
import { buildPageMeta } from "@/lib/seo/metadata";
import styles from "./monetize.module.css";

/** AI 수익화 서브 게시판 목록 (primary 먼저) */
const SUB_BOARDS = [
  { slug: "monetization-tips",  label: "외주·판매 팁" },
  { slug: "monetization-cases", label: "수익화 사례" },
] as const;

type SubBoardSlug = (typeof SUB_BOARDS)[number]["slug"];

function resolveSubBoard(boardParam: string | undefined) {
  return SUB_BOARDS.find((b) => b.slug === boardParam) ?? SUB_BOARDS[0];
}

/** 페이지네이션 href 빌더: primary 게시판이면 board 파람 생략 */
function pageHref(sectionPath: string, boardSlug: SubBoardSlug, p: number) {
  const isPrimary = boardSlug === SUB_BOARDS[0].slug;
  const boardPart = isPrimary ? "" : `board=${boardSlug}&`;
  if (p === 1 && isPrimary) return sectionPath;
  if (p === 1) return `${sectionPath}?${boardPart.slice(0, -1)}`; // remove trailing &
  return `${sectionPath}?${boardPart}page=${p}`;
}

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

async function fetchPosts(boardSlug: string, sort: string, page: number, cookie: string): Promise<PaginatedPosts> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/posts?board=${boardSlug}&sort=${sort}&page=${page}&pageSize=20`,
      { headers: { cookie }, next: { revalidate: 30 } },
    );
    if (res.ok) return (await res.json()) as PaginatedPosts;
  } catch {
    // API 연결 실패 시 빈 목록 반환
  }
  return { items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } };
}

interface PageProps {
  searchParams: Promise<{ sort?: string; page?: string; board?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { board, page: rawPage } = await searchParams;
  const selected = resolveSubBoard(board);
  const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);
  return buildPageMeta(BOARDS[selected.slug], { page });
}

export default async function MonetizePage({ searchParams }: PageProps) {
  const { sort = "latest", page: rawPage = "1", board } = await searchParams;
  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const selected = resolveSubBoard(board);

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const { items: posts, meta } = await fetchPosts(selected.slug, sort, page, cookie);

  const recentPosts = posts.slice(0, 4).map((post) => ({
    href: `/monetize/${post.slug}`,
    board: selected.label,
    title: post.title,
  }));

  const userRankings = [
    { rank: 1, nickname: "수익화연구소", tier: "master" as const },
    { rank: 2, nickname: "프리랜서노트", tier: "expert" as const },
    { rank: 3, nickname: "런칭메이커", tier: "practitioner" as const },
    { rank: 4, nickname: "리뷰메이트", tier: "member" as const },
  ];

  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="monetize" currentSub={selected.label} />

      <section className={styles.guideToolbar} aria-label="가이드 검색 및 정렬">
        <div className={styles.sortGroup}>
          <SearchAutocomplete
            label="가이드 검색"
            placeholder="가이드 검색"
            popularTags={["외주", "견적", "프롬프트", "판매", "계약", "서비스화"]}
          />
        </div>
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 {meta.totalItems}개</span>
          </div>
          <div className={styles.headerActions}>
            <AskButton tags={["monetization"]} />
            <Link href="/monetize/write">
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
        </div>

        <div className={styles.mainCol}>
          {posts.length === 0 ? (
            <EmptyState
              icon="file-list-3-line"
              title="아직 글이 없어요"
              description="첫 글을 작성해 보세요."
              actions={
                <Link href="/monetize/write">
                  <Button>글쓰기</Button>
                </Link>
              }
            />
          ) : (
            <section className={styles.postList} aria-label="AI 수익화 게시글 목록">
              {posts.map((post) => (
                <PostItem key={post.id} post={post} basePath="/monetize" />
              ))}
            </section>
          )}

          {meta.totalPages > 1 && (
            <nav className={styles.pagination} aria-label="페이지 이동">
              <button type="button" aria-label="이전 페이지" disabled={page <= 1}>
                <Icon name="arrow-left-s-line" />
              </button>
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={pageHref("/monetize", selected.slug, p)}>
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

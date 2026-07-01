// Story 8.9: ISR — 목록 페이지 60초 TTL 캐시 (AR-17)
export const revalidate = 60;

/**
 * AI 자동화 카테고리 랜딩 페이지 — Story 2.3 (API 연동)
 *
 * automation-guide / automation-cases / automation-tips 게시판의 게시글을 API에서 SSR로 불러온다.
 * 서브 게시판은 ?board=<slug> 쿼리 파람으로 전환하며, 기본값은 automation-guide.
 * 레이아웃·컴포넌트 구조는 Story 2.3 이전과 동일하게 유지한다.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { AuthorName, Button, Icon, Tag, EmptyState } from "@/components/ui";
import { AskButton, BoardHero, BoardSidebar, SearchAutocomplete } from "@/components/board";
import type { PaginatedPosts, PostCard } from "@ai-jakdang/contracts";
import { BOARDS } from "@ai-jakdang/contracts";
import { buildPageMeta } from "@/lib/seo/metadata";
import styles from "./automation.module.css";

/** AI 자동화 서브 게시판 목록 (primary 먼저) */
const SUB_BOARDS = [
  { slug: "automation-guide", label: "자동화 가이드" },
  { slug: "automation-cases", label: "자동화 사례" },
  { slug: "automation-tips",  label: "자동화 팁" },
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
      { headers: { cookie }, cache: "no-store" },
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

export default async function AutomationPage({ searchParams }: PageProps) {
  const { sort = "latest", page: rawPage = "1", board } = await searchParams;
  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const selected = resolveSubBoard(board);

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const { items: posts, meta } = await fetchPosts(selected.slug, sort, page, cookie);

  const recentPosts = posts.slice(0, 4).map((post) => ({
    href: `/automation/${post.slug}`,
    board: selected.label,
    title: post.title,
  }));

  const userRankings = [
    { rank: 1, nickname: "워크플로마스터", tier: "master" as const },
    { rank: 2, nickname: "자동화카페", tier: "expert" as const },
    { rank: 3, nickname: "데이터정리러", tier: "practitioner" as const },
    { rank: 4, nickname: "리뷰메이트", tier: "member" as const },
  ];

  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="automation" currentSub={selected.label} />

      <section className={styles.guideToolbar} aria-label="가이드 검색 및 정렬">
        <div className={styles.sortGroup}>
          <SearchAutocomplete
            label="가이드 검색"
            placeholder="가이드 검색"
            popularTags={["n8n", "Make", "Zapier", "트리거", "요약", "리포트"]}
          />
        </div>
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 {meta.totalItems}개</span>
          </div>
          <div className={styles.headerActions}>
            <AskButton tags={["automation"]} />
            <Link href="/automation/write">
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
                <Link href="/automation/write">
                  <Button>글쓰기</Button>
                </Link>
              }
            />
          ) : (
            <section className={styles.postList} aria-label="AI 자동화 게시글 목록">
              {posts.map((post) => (
                <PostItem key={post.id} post={post} basePath="/automation" />
              ))}
            </section>
          )}

          {meta.totalPages > 1 && (
            <nav className={styles.pagination} aria-label="페이지 이동">
              <button type="button" aria-label="이전 페이지" disabled={page <= 1}>
                <Icon name="arrow-left-s-line" />
              </button>
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={pageHref("/automation", selected.slug, p)}>
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
      <Link href={postHref} className={styles.postThumb} aria-hidden="true" tabIndex={-1}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.thumbnailUrl ?? "/empty_thumbnail.png"}
          alt=""
          className={styles.thumbImage}
        />
      </Link>
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
            <AuthorName name={post.authorNickname ?? "익명"} authorId={post.userId ?? undefined} avatarUrl={post.authorAvatarUrl} className={styles.authorName} />
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

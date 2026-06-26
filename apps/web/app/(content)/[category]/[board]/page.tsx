/**
 * 게시판 목록 서버 컴포넌트 — Story 2.3
 *
 * 경로: /[category]/[board] (예: /vibe-coding/vibe-coding-guide, /lounge/talk)
 * BOARDS 상수를 기준으로 board 슬러그를 조회한다. 없으면 notFound().
 * API GET /api/v1/posts?board=...&sort=...&page=... 로 게시글 목록을 SSR.
 * SEO: generateMetadata, CollectionPage + BreadcrumbList JSON-LD.
 *
 * AC #1, #2, #4, #5, #6, #7 구현.
 *
 * 라우팅 참고 (Story 2.10에서 해결 예정):
 *   BOARDS 상수의 urlPath는 /vibe-coding/guide, /automation/guide 등
 *   Next.js 앱 라우터의 폴더 경로는 /vibe-coding/(vibe-coding-guide), /automation/(automation-guide) 등
 *   이 동적 라우트([category]/[board])는 board 슬러그(예: vibe-coding-guide)를 직접 받는다.
 *   BOARDS.urlPath 와의 매핑은 Story 2.10 라우팅 확정 시 조정된다.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { BOARDS } from "@ai-jakdang/contracts";
import type { PostCard, PaginatedPosts } from "@ai-jakdang/contracts";
import { buildPageMeta, buildCollectionPageJsonLd, buildBreadcrumbJsonLd, buildBoardBreadcrumb } from "@/lib/seo";
import { AuthorName, Avatar, Icon, Tag, EmptyState } from "@/components/ui";
import { BoardHero, BoardSidebar, SearchAutocomplete } from "@/components/board";
import { resolveHeroKey } from "@/components/board";
import { SortTabs } from "./SortTabs";
import type { SortValue } from "./SortTabs";
import { BoardPagination } from "./BoardPagination";
import { WriteButton } from "./WriteButton";
import styles from "./board-list.module.css";

interface PageProps {
  params: Promise<{ category: string; board: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

/** 정렬 값 검증 — 유효하지 않으면 기본값 'latest' 반환 */
function resolveSort(raw?: string): SortValue {
  if (raw === "popular" || raw === "most-comments" || raw === "latest") return raw;
  return "latest";
}

/** 페이지 번호 검증 */
function resolvePage(raw?: string): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { board: boardSlug } = await params;
  const { page: rawPage } = await searchParams;

  const boardMeta = BOARDS[boardSlug];
  if (!boardMeta) return {};

  const page = resolvePage(rawPage);
  return buildPageMeta(boardMeta, { page });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BoardListPage({ params, searchParams }: PageProps) {
  const { category, board: boardSlug } = await params;
  const { sort: rawSort, page: rawPage } = await searchParams;

  // board 유효성 검사
  const boardMeta = BOARDS[boardSlug];
  if (!boardMeta) notFound();

  const sort = resolveSort(rawSort);
  const page = resolvePage(rawPage);

  // API 호출 — 서버 컴포넌트에서 쿠키 포워딩
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  let postsData: PaginatedPosts = {
    items: [],
    meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
  };

  try {
    const res = await fetch(
      `${API_URL}/api/v1/posts?board=${encodeURIComponent(boardSlug)}&sort=${sort}&page=${page}&pageSize=20`,
      {
        headers: { cookie },
        // 목록은 항상 최신: 글 작성 직후 목록으로 돌아왔을 때 새 글이 바로 보이도록 no-store.
        cache: "no-store",
      },
    );

    if (res.ok) {
      postsData = (await res.json()) as PaginatedPosts;
    }
  } catch {
    // API 연결 실패 시 빈 목록으로 렌더 (사용자에게 에러보다 빈 상태 노출)
  }

  const { items, meta } = postsData;

  // JSON-LD
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
  const boardUrl = `${SITE_URL}${boardMeta.urlPath}`;
  const collectionPageJsonLd = buildCollectionPageJsonLd(boardMeta, boardUrl);
  const breadcrumbItems = buildBoardBreadcrumb(boardMeta.category, boardMeta.label, boardUrl);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems);

  // 사이드바 최근 글 (현재 목록에서 상위 4개 재활용)
  const recentPosts = items.slice(0, 4).map((post) => ({
    href: `${boardMeta.urlPath}/${post.slug}`,
    board: boardMeta.label,
    title: post.title,
  }));

  // 사이드바 랭킹 — Epic 6 이전 임시 고정 데이터
  const userRankings = [
    { rank: 1, nickname: "코드작당러", tier: "master" as const },
    { rank: 2, nickname: "자동화카페", tier: "expert" as const },
    { rank: 3, nickname: "프론트라인", tier: "practitioner" as const },
    { rank: 4, nickname: "리뷰메이트", tier: "member" as const },
  ];

  // 글쓰기 경로 — board urlPath 기반
  const writePath = `${boardMeta.urlPath}/write`;

  // category는 동적 파라미터(string) — BOARDS.category("ai-automation" 등)를 히어로 키로 매핑.
  const heroMenu = resolveHeroKey(boardMeta.category ?? category);

  return (
    <main id="main" className={styles.page}>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* 히어로 — BoardHero가 <h1>을 포함하므로 별도 <h1> 없음 (SEO 1개 보장) */}
      <BoardHero menu={heroMenu} currentSub={boardMeta.label} />

      {/* 정렬 탭 + 검색 */}
      <section className={styles.guideToolbar} aria-label="게시글 검색 및 정렬">
        <SortTabs currentSort={sort} />
        <SearchAutocomplete
          label="게시글 검색"
          placeholder={`${boardMeta.label} 검색`}
          popularTags={[]}
        />
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 {meta.totalItems}개</span>
          </div>
          <WriteButton writePath={writePath} className={styles.writeButton} />
        </div>

        <div className={styles.mainCol}>
          {items.length === 0 ? (
            <EmptyState
              icon="file-list-3-line"
              title="아직 글이 없어요"
              description="첫 글을 작성해 보세요."
              actions={
                <WriteButton writePath={writePath} />
              }
            />
          ) : (
            <section className={styles.postList} aria-label={`${boardMeta.label} 게시글 목록`}>
              {items.map((post) => (
                <PostCard key={post.id} post={post} boardUrlPath={boardMeta.urlPath} />
              ))}
            </section>
          )}

          <BoardPagination page={meta.page} totalPages={meta.totalPages} />
        </div>

        <BoardSidebar
          recentPosts={recentPosts}
          rankings={userRankings}
          ariaLabel={`${boardMeta.label} 보조 정보`}
        />
      </div>
    </main>
  );
}

// ── PostCard 서버 컴포넌트 ─────────────────────────────────────────────────────

interface PostCardProps {
  post: PostCard;
  boardUrlPath: string;
}

function PostCard({ post, boardUrlPath }: PostCardProps) {
  const postHref = `${boardUrlPath}/${post.slug}`;
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
        {post.tags.length > 0 && (
          <div className={styles.tagRow}>
            {post.tags.map((tag) => (
              <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                #{tag}
              </Tag>
            ))}
          </div>
        )}

        <h3 className={styles.postHeading}>
          <Link href={postHref} className={styles.postTitle}>
            {post.title}
          </Link>
          {post.hasAttachment && (
            <span className={styles.attachIcon} aria-label="첨부파일 있음">
              <Icon name="attachment-line" />
            </span>
          )}
        </h3>

        {post.summary && (
          <p className={styles.postExcerpt}>{post.summary}</p>
        )}

        <div className={styles.postFooter}>
          <div className={styles.postAuthor}>
            <Avatar name={post.authorNickname ?? "익명"} src={post.authorAvatarUrl ?? undefined} size="sm" />
            <AuthorName
              name={post.authorNickname ?? "익명"}
              authorId={post.userId ?? undefined}
              className={styles.authorName}
            />
            <span className={styles.footerDivider} aria-hidden="true">|</span>
            <span className={styles.postDate}>{formattedDate}</span>
          </div>
          <div className={styles.postStats} aria-label="게시글 통계">
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

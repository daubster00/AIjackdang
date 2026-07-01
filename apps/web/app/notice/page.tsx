/**
 * 공지사항 목록 서버 컴포넌트 — Story 2.9
 *
 * 경로: /notice
 * 운영자 작성 전용 공지를 SSR로 렌더. [글쓰기] 버튼 미노출 (FR-15.1, AC #1).
 * 핀된 글은 최상단 + 핀 아이콘 표시 (is_pinned=true, AC #4).
 * 레이아웃은 일반 게시판 목록(BoardHero + 검색 + 2컬럼 + 사이드바)과 동일하게 맞춘다.
 * 공지사항은 "작당 라운지" 대메뉴의 하위 메뉴로 편입되어 lounge 히어로를 공유한다.
 * SEO: generateMetadata(buildPageMeta), CollectionPage + BreadcrumbList JSON-LD.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { BOARDS } from "@ai-jakdang/contracts";
import type { PostCard, PaginatedPosts } from "@ai-jakdang/contracts";
import {
  buildPageMeta,
  buildCollectionPageJsonLd,
  buildBreadcrumbJsonLd,
} from "@/lib/seo";
import { AuthorName, Icon, Tag, EmptyState } from "@/components/ui";
import { BoardHero, BoardSidebar, SearchAutocomplete } from "@/components/board";
import { BoardPagination } from "@/app/(content)/[category]/[board]/BoardPagination";
import type { SortValue } from "@/app/(content)/[category]/[board]/SortTabs";
import styles from "@/app/(content)/[category]/[board]/board-list.module.css";

interface PageProps {
  searchParams: Promise<{ sort?: string; page?: string }>;
}

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";

function resolveSort(raw?: string): SortValue {
  if (raw === "popular" || raw === "most-comments" || raw === "latest") return raw;
  return "latest";
}

function resolvePage(raw?: string): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { page: rawPage } = await searchParams;
  const page = resolvePage(rawPage);
  const noticeMeta = BOARDS["notice"];
  if (!noticeMeta) return {};
  return buildPageMeta(noticeMeta, { page });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function NoticeListPage({ searchParams }: PageProps) {
  const { sort: rawSort, page: rawPage } = await searchParams;
  const sort = resolveSort(rawSort);
  const page = resolvePage(rawPage);

  const noticeMeta = BOARDS["notice"]!;

  let postsData: PaginatedPosts = {
    items: [],
    meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
  };

  try {
    const res = await fetch(
      `${API_URL}/api/v1/posts?board=notice&sort=${sort}&page=${page}&pageSize=20`,
      { cache: "no-store" },
    );
    if (res.ok) {
      postsData = (await res.json()) as PaginatedPosts;
    }
  } catch {
    // API 미가동 시 빈 목록 fallback
  }

  const { items, meta } = postsData;

  // JSON-LD
  const boardUrl = `${SITE_URL}/notice`;
  const collectionPageJsonLd = buildCollectionPageJsonLd(noticeMeta, boardUrl);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "홈", url: SITE_URL },
    { name: "공지사항", url: boardUrl },
  ]);

  // 사이드바 최근 글 (현재 목록 상위 4개 재활용)
  const recentPosts = items.slice(0, 4).map((post) => ({
    href: `/notice/${post.slug}`,
    board: "공지사항",
    title: post.title,
  }));

  // 사이드바 랭킹 — Epic 6 이전 임시 고정 데이터 (다른 게시판과 동일)
  const userRankings = [
    { rank: 1, nickname: "코드작당러", tier: "master" as const },
    { rank: 2, nickname: "자동화카페", tier: "expert" as const },
    { rank: 3, nickname: "프론트라인", tier: "practitioner" as const },
    { rank: 4, nickname: "리뷰메이트", tier: "member" as const },
  ];

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

      {/* 히어로 — 공지사항은 작당 라운지 하위 메뉴이므로 lounge 히어로 공유 (BoardHero가 <h1> 포함) */}
      <BoardHero menu="lounge" currentSub="공지사항" />

      {/* 검색 — 정렬 탭(최신/인기/댓글많은)은 공지사항에서 노출하지 않는다 */}
      <section className={styles.guideToolbar} aria-label="공지 검색">
        <SearchAutocomplete
          label="공지 검색"
          placeholder="공지사항 검색"
          popularTags={[]}
        />
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 {meta.totalItems}개</span>
          </div>
          {/* 글쓰기 버튼 없음 — 운영자 전용 (FR-15.1, AC #1) */}
        </div>

        <div className={styles.mainCol}>
          {items.length === 0 ? (
            <EmptyState
              icon="notification-2-line"
              title="아직 공지가 없어요"
              description="운영자가 공지를 올리면 여기에 표시됩니다."
            />
          ) : (
            <section className={styles.postList} aria-label="공지사항 게시글 목록">
              {items.map((post) => (
                <NoticeCard key={post.id} post={post} />
              ))}
            </section>
          )}

          <BoardPagination page={meta.page} totalPages={meta.totalPages} />
        </div>

        <BoardSidebar
          recentPosts={recentPosts}
          rankings={userRankings}
          ariaLabel="공지사항 보조 정보"
        />
      </div>
    </main>
  );
}

// ── NoticeCard ─────────────────────────────────────────────────────────────────

interface NoticeCardProps {
  post: PostCard;
}

function NoticeCard({ post }: NoticeCardProps) {
  const postHref = `/notice/${post.slug}`;
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
          {post.isPinned && (
            <span className={styles.attachIcon} aria-label="상단 고정">
              <Icon name="pushpin-2-fill" />
            </span>
          )}
          <Link href={postHref} className={styles.postTitle}>
            {post.title}
          </Link>
        </h3>

        {post.summary && (
          <p className={styles.postExcerpt}>{post.summary}</p>
        )}

        <div className={styles.postFooter}>
          <div className={styles.postAuthor}>
            <AuthorName
              name={post.authorNickname ?? "운영자"}
              authorId={post.userId ?? undefined}
              avatarUrl={post.authorAvatarUrl}
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
          </div>
        </div>
      </div>
    </article>
  );
}

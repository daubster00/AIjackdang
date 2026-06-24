// Story 8.9: ISR — 목록 페이지 60초 TTL 캐시 (AR-17)
export const revalidate = 60;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorName, Avatar, Icon, Tag, EmptyState } from "@/components/ui";
import { SearchAutocomplete } from "@/components/board";
import type { TagContentResponse, TagContentItem } from "@ai-jakdang/contracts/tag";
import { shouldNoindex } from "@/lib/seo";
import styles from "./tags.module.css";

type Params = { tag: string };
type SearchParams = { type?: string; sort?: string; page?: string };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aijakdang.com";
const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

// ── 콘텐츠 유형별 링크 경로 결정 ────────────────────────────────────────────────

function itemHref(item: TagContentItem): string {
  if (item.type === "post") return `/${item.board}/${item.slug}`;
  if (item.type === "question") return `/questions/${item.slug}`;
  return `/resources/${item.slug}`;
}

function itemBoardLabel(item: TagContentItem): string {
  if (item.type === "post") return item.board;
  if (item.type === "question") return "묻고답하기";
  return "실전자료";
}

// ── API 호출 ──────────────────────────────────────────────────────────────────

async function fetchTagContent(
  tagName: string,
  searchParams: SearchParams,
): Promise<TagContentResponse | null> {
  const type = searchParams.type ?? "all";
  const sort = searchParams.sort ?? "latest";
  const page = searchParams.page ?? "1";

  const url = `${API_URL}/api/v1/tags/${encodeURIComponent(tagName)}/content?type=${type}&sort=${sort}&page=${page}&pageSize=20`;

  const res = await fetch(url, { cache: "no-store" });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`태그 콘텐츠 API 오류: ${res.status}`);
  }

  return res.json() as Promise<TagContentResponse>;
}

async function fetchPopularTags(): Promise<{ name: string; slug: string }[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/tags/popular?limit=8`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { items: { name: string; slug: string }[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { tag } = await params;
  const sp = await searchParams;
  const decoded = decodeURIComponent(tag);
  const canonical = `${SITE_URL}/tags/${tag}`;

  // 콘텐츠 0건 여부 파악 (noindex 판단)
  let totalItems = 1; // 기본 값: 있다고 가정
  try {
    const data = await fetchTagContent(decoded, sp);
    if (data === null) {
      // 태그 미존재 → noindex
      return {
        title: `#${decoded} 태그 글 모음 · AI작당`,
        description: `${decoded} 태그가 달린 AI작당 글·질문·자료 모음`,
        robots: { index: false, follow: true },
      };
    }
    totalItems = data.tag.totalCount;
  } catch {
    // API 오류 시 기본 메타 반환
  }

  const noindex = shouldNoindex({ path: `/tags/${tag}`, contentCount: totalItems });
  const ogTitle = `#${decoded} 태그 글 모음 · AI작당`;
  const ogDesc = `${decoded} 태그가 달린 AI작당 글·질문·자료 모음`;
  const ogImageUrl = `${SITE_URL}/og-default.png`;

  return {
    title: ogTitle,
    description: ogDesc,
    alternates: {
      canonical,
    },
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      url: canonical,
      type: "website",
      siteName: "AI작당",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDesc,
      images: [ogImageUrl],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

// ── 서버 컴포넌트 ──────────────────────────────────────────────────────────────

export default async function TagLandingPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { tag } = await params;
  const sp = await searchParams;
  const decoded = decodeURIComponent(tag);

  const currentType = sp.type ?? "all";
  const currentSort = sp.sort ?? "latest";
  const currentPage = parseInt(sp.page ?? "1", 10);

  const canonical = `${SITE_URL}/tags/${tag}`;

  // ── API 호출 ──────────────────────────────────────────────────────────────────
  const [tagData, popularTags] = await Promise.all([
    fetchTagContent(decoded, sp),
    fetchPopularTags(),
  ]);

  if (tagData === null) {
    notFound();
  }

  const { items, meta, tag: tagInfo } = tagData;

  // 현재 태그 제외한 관련 태그
  const relatedTags = popularTags.filter(
    (t) => t.name.toLowerCase() !== decoded.toLowerCase(),
  );

  // ── JSON-LD (콘텐츠 >= 3건인 경우만) ─────────────────────────────────────────
  const showJsonLd = tagInfo.totalCount >= 3;

  const collectionPageJsonLd = showJsonLd
    ? {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `#${decoded} 태그 글 모음`,
        url: canonical,
        hasPart: items.slice(0, 10).map((item) => ({
          "@type": "Article",
          name: item.title,
          url: `${SITE_URL}${itemHref(item)}`,
        })),
      }
    : null;

  const breadcrumbJsonLd = showJsonLd
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: "/" },
          { "@type": "ListItem", position: 2, name: "태그", item: "/tags" },
          { "@type": "ListItem", position: 3, name: `#${decoded}`, item: canonical },
        ],
      }
    : null;

  // ── 탭 링크 빌더 ──────────────────────────────────────────────────────────────
  function tabHref(typeValue: string) {
    return `/tags/${tag}?type=${typeValue}&sort=${currentSort}&page=1`;
  }

  // ── 정렬 링크 빌더 ────────────────────────────────────────────────────────────
  function sortHref(sortValue: string) {
    return `/tags/${tag}?type=${currentType}&sort=${sortValue}&page=1`;
  }

  // ── 페이지 링크 빌더 ──────────────────────────────────────────────────────────
  function pageHref(p: number) {
    return `/tags/${tag}?type=${currentType}&sort=${currentSort}&page=${p}`;
  }

  // 페이지 윈도우 계산
  const windowSize = 5;
  const half = Math.floor(windowSize / 2);
  let winStart = Math.max(1, currentPage - half);
  const winEnd = Math.min(meta.totalPages, winStart + windowSize - 1);
  winStart = Math.max(1, winEnd - windowSize + 1);
  const pageWindow: number[] = [];
  for (let i = winStart; i <= winEnd; i++) pageWindow.push(i);

  return (
    <main id="main" className={styles.page}>
      {/* JSON-LD */}
      {showJsonLd && collectionPageJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
        />
      )}
      {showJsonLd && breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}

      {/* 헤더 */}
      <section className={styles.header}>
        <nav className={styles.breadcrumb} aria-label="현재 위치">
          <Link href="/" aria-label="홈">
            <Icon name="home-5-line" />
          </Link>
          <Icon name="arrow-right-s-line" aria-hidden="true" />
          <span>태그</span>
          <Icon name="arrow-right-s-line" aria-hidden="true" />
          <span className={styles.current}>#{decoded}</span>
        </nav>

        <h1 className={styles.title}>#{decoded}</h1>
        <p className={styles.subtitle}>
          이 태그가 달린 글 <strong>{tagInfo.totalCount}</strong>개
        </p>

        <SearchAutocomplete label="태그 글 검색" placeholder={`#${decoded} 안에서 검색`} />
      </section>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {/* 유형 필터 탭 */}
          <div
            role="tablist"
            aria-label="콘텐츠 유형 필터"
            className={styles.tablist}
          >
            {(
              [
                { value: "all", label: "전체", count: tagInfo.totalCount },
                { value: "post", label: "게시글", count: tagInfo.postCount },
                { value: "question", label: "질문", count: tagInfo.questionCount },
                { value: "resource", label: "자료", count: tagInfo.resourceCount },
              ] as const
            ).map(({ value, label, count }) => (
              <Link
                key={value}
                href={tabHref(value)}
                role="tab"
                aria-selected={currentType === value}
                className={`${styles.tab}${currentType === value ? ` ${styles.tabActive}` : ""}`}
              >
                {label}
                {count > 0 && (
                  <span className={styles.tabBadge}>{count}</span>
                )}
              </Link>
            ))}
          </div>

          {/* 정렬 셀렉트 */}
          <div className={styles.sortBar} aria-label="정렬 기준">
            <Link
              href={sortHref("latest")}
              className={`${styles.sortBtn}${currentSort === "latest" ? ` ${styles.sortActive}` : ""}`}
              aria-current={currentSort === "latest" ? "true" : undefined}
            >
              최신순
            </Link>
            <Link
              href={sortHref("popular")}
              className={`${styles.sortBtn}${currentSort === "popular" ? ` ${styles.sortActive}` : ""}`}
              aria-current={currentSort === "popular" ? "true" : undefined}
            >
              인기순
            </Link>
          </div>

          {/* 글 목록 */}
          <section className={styles.postList} aria-label={`#${decoded} 글 목록`}>
            {items.length === 0 ? (
              <EmptyState
                icon="file-search-line"
                title="아직 콘텐츠가 없어요"
                description={`#${decoded} 태그가 달린 글·질문·자료가 없습니다.`}
              />
            ) : (
              items.map((item) => (
                <article key={item.id} className={styles.postItem}>
                  <div className={styles.postBody}>
                    <span className={styles.boardLabel}>{itemBoardLabel(item)}</span>
                    <h2 className={styles.postHeading}>
                      <Link href={itemHref(item)} className={styles.postTitle}>
                        {item.title}
                      </Link>
                    </h2>
                    {item.summary && (
                      <p className={styles.postExcerpt}>{item.summary}</p>
                    )}
                    <div className={styles.postFooter}>
                      <div className={styles.postAuthor}>
                        <Avatar name={item.authorNickname ?? "익명"} size="sm" />
                        <AuthorName
                          name={item.authorNickname ?? "익명"}
                          className={styles.authorName}
                        />
                        <span aria-hidden="true">|</span>
                        <span>
                          {new Date(item.createdAt).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className={styles.postStats} aria-label="게시글 정보">
                        <span>
                          <Icon name="eye-line" />
                          {item.viewCount.toLocaleString()}
                        </span>
                        <span>
                          <Icon name="chat-3-line" />
                          {item.commentCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          {/* 페이지네이션 (총 페이지 > 1인 경우만 렌더) */}
          {meta.totalPages > 1 && (
            <nav className={styles.pagination} aria-label="페이지 이동">
              <Link
                href={pageHref(1)}
                aria-label="처음 페이지"
                aria-disabled={currentPage <= 1}
                className={styles.pageBtn}
              >
                <Icon name="skip-left-line" />
              </Link>
              <Link
                href={pageHref(Math.max(1, currentPage - 1))}
                aria-label="이전 페이지"
                aria-disabled={currentPage <= 1}
                className={styles.pageBtn}
              >
                <Icon name="arrow-left-s-line" />
              </Link>

              {pageWindow.map((p) => (
                <Link
                  key={p}
                  href={pageHref(p)}
                  aria-current={p === currentPage ? "page" : undefined}
                  className={`${styles.pageBtn}${p === currentPage ? ` ${styles.pageBtnActive}` : ""}`}
                >
                  {p}
                </Link>
              ))}

              <Link
                href={pageHref(Math.min(meta.totalPages, currentPage + 1))}
                aria-label="다음 페이지"
                aria-disabled={currentPage >= meta.totalPages}
                className={styles.pageBtn}
              >
                <Icon name="arrow-right-s-line" />
              </Link>
              <Link
                href={pageHref(meta.totalPages)}
                aria-label="마지막 페이지"
                aria-disabled={currentPage >= meta.totalPages}
                className={styles.pageBtn}
              >
                <Icon name="skip-right-line" />
              </Link>
            </nav>
          )}
        </div>

        {/* 사이드바 */}
        <aside className={styles.sidebar} aria-label="관련 태그">
          <section className={styles.sidePanel}>
            <div className={styles.sideHeader}>
              <Icon name="price-tag-3-line" />
              <h2>관련 태그</h2>
            </div>
            <div className={styles.relatedTags}>
              {relatedTags.length === 0 ? (
                <p className={styles.noRelated}>관련 태그가 없습니다.</p>
              ) : (
                relatedTags.map((related) => (
                  <Tag key={related.name} href={`/tags/${encodeURIComponent(related.name)}`}>
                    #{related.name}
                  </Tag>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

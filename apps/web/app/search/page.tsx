import type { Metadata } from "next";
import Link from "next/link";
import { searchResponseSchema } from "@ai-jakdang/contracts";
import { shouldNoindex } from "@/lib/seo";
import { SearchResultItemCard } from "./_components/SearchResultItem";
import styles from "./search.module.css";

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4003";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const noindex = shouldNoindex({ path: "/search", searchQuery: query || undefined });

  return {
    title: query
      ? `"${query}" 검색 결과 · AI작당`
      : "검색 · AI작당",
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

const TABS = [
  { value: "all", label: "전체" },
  { value: "post", label: "게시글" },
  { value: "question", label: "묻고답하기" },
  { value: "resource", label: "실전자료" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, type, page } = await searchParams;
  const query = q?.trim() ?? "";
  const activeType = (type as TabValue) ?? "all";
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);

  if (!query) {
    return (
      <main className={styles.page}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>검색어를 입력해 주세요</h1>
        </div>
      </main>
    );
  }

  const apiUrl = `${API_URL}/api/v1/search?q=${encodeURIComponent(query)}&type=${activeType}&page=${currentPage}`;
  let data: ReturnType<typeof searchResponseSchema.parse> | null = null;
  let fetchError = false;

  try {
    const res = await fetch(apiUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Search API returned ${res.status}`);
    const json = await res.json();
    data = searchResponseSchema.parse(json);
  } catch {
    fetchError = true;
  }

  const baseSearchPath = `/search?q=${encodeURIComponent(query)}`;

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <mark>{query}</mark> 검색 결과
        </h1>
      </div>

      {/* 탭 */}
      <div role="tablist" aria-label="검색 유형 필터" className={styles.tabList}>
        {TABS.map((tab) => {
          const count = data
            ? tab.value === "all"
              ? data.meta.totalItems
              : data.byType[tab.value as keyof typeof data.byType]
            : 0;
          const isActive = activeType === tab.value;

          return (
            <Link
              key={tab.value}
              href={`${baseSearchPath}&type=${tab.value}&page=1`}
              role="tab"
              aria-selected={isActive}
              className={styles.tab}
            >
              {tab.label}
              <span className={styles.tabCount}>{count}</span>
            </Link>
          );
        })}
      </div>

      {/* 결과 영역 */}
      <div role="tabpanel">
        {fetchError ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>검색 결과를 불러오지 못했습니다</p>
            <p className={styles.emptyDesc}>잠시 후 다시 시도해 주세요.</p>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>&lsquo;{query}&rsquo;에 대한 검색 결과가 없습니다</p>
            <p className={styles.emptyDesc}>다른 검색어로 시도해 보거나 추천 태그를 확인해 보세요.</p>
            {data.suggestedTags && data.suggestedTags.length > 0 && (
              <>
                <p className={styles.suggestedLabel}>추천 태그</p>
                <div className={styles.suggestedTags}>
                  {data.suggestedTags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/tags/${encodeURIComponent(tag)}`}
                      className={styles.tagChip}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : data ? (
          <>
            <div className={styles.resultPanel}>
              {data.items.map((item) => (
                <SearchResultItemCard key={item.id} item={item} query={query} />
              ))}
            </div>

            {data.meta.totalPages > 1 && (
              <SearchPagination
                query={query}
                type={activeType}
                currentPage={currentPage}
                totalPages={data.meta.totalPages}
              />
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

function SearchPagination({
  query,
  type,
  currentPage,
  totalPages,
}: {
  query: string;
  type: string;
  currentPage: number;
  totalPages: number;
}) {
  const base = `/search?q=${encodeURIComponent(query)}&type=${type}`;

  const half = 2;
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const atStart = currentPage <= 1;
  const atEnd = currentPage >= totalPages;

  return (
    <nav className={styles.pagination} aria-label="페이지 이동">
      <Link
        href={`${base}&page=1`}
        aria-label="처음 페이지"
        className={`${styles.pageBtn}${atStart ? ` ${styles.pageBtnDisabled}` : ""}`}
        aria-disabled={atStart}
      >
        «
      </Link>
      <Link
        href={`${base}&page=${Math.max(1, currentPage - 1)}`}
        aria-label="이전 페이지"
        className={`${styles.pageBtn}${atStart ? ` ${styles.pageBtnDisabled}` : ""}`}
        aria-disabled={atStart}
      >
        ‹
      </Link>

      {pages.map((p) => (
        <Link
          key={p}
          href={`${base}&page=${p}`}
          className={styles.pageBtn}
          aria-current={p === currentPage ? "page" : undefined}
        >
          {p}
        </Link>
      ))}

      <Link
        href={`${base}&page=${Math.min(totalPages, currentPage + 1)}`}
        aria-label="다음 페이지"
        className={`${styles.pageBtn}${atEnd ? ` ${styles.pageBtnDisabled}` : ""}`}
        aria-disabled={atEnd}
      >
        ›
      </Link>
      <Link
        href={`${base}&page=${totalPages}`}
        aria-label="마지막 페이지"
        className={`${styles.pageBtn}${atEnd ? ` ${styles.pageBtnDisabled}` : ""}`}
        aria-disabled={atEnd}
      >
        »
      </Link>
    </nav>
  );
}

// Story 8.9: ISR — 목록 페이지 60초 TTL 캐시 (AR-17)
export const revalidate = 60;

import type { Metadata } from "next";
import Link from "next/link";
import { AuthorName, Avatar, Button, Icon, Select, Tag } from "@/components/ui";
import { AskButton, BoardHero, SearchAutocomplete } from "@/components/board";
import styles from "./talk.module.css";
import type { PostCard } from "@ai-jakdang/contracts";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
const TALK_DESC = "AI작당 작당 라운지 - AI 관련 잡담·수다 게시판";

export const metadata: Metadata = {
  title: "작당 수다방",
  description: TALK_DESC,
  openGraph: {
    title: "작당 수다방 | AI작당",
    description: TALK_DESC,
    url: `${SITE_URL}/lounge/talk`,
    type: "website",
    siteName: "AI작당",
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630, alt: "작당 수다방" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "작당 수다방 | AI작당",
    description: TALK_DESC,
    images: [`${SITE_URL}/og-default.png`],
  },
};

const sortOptions = [
  { value: "latest", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "views", label: "조회순" },
  { value: "comments", label: "댓글순" },
];

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

async function fetchTalkList(sp: Record<string, string>) {
  const params = new URLSearchParams({ board: "talk", pageSize: "20" });
  if (sp.sort) params.set("sort", sp.sort);
  if (sp.page) params.set("page", sp.page);
  if (sp.q) params.set("q", sp.q);
  try {
    const res = await fetch(`${API_BASE}/api/v1/posts?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return { items: [] as PostCard[], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } };
    return (await res.json()) as { items: PostCard[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } };
  } catch {
    return { items: [] as PostCard[], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } };
  }
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function LoungeTalkPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedParams = await searchParams;
  const sp: Record<string, string> = {};
  for (const [k, v] of Object.entries(resolvedParams)) {
    if (typeof v === "string") sp[k] = v;
    else if (Array.isArray(v) && v[0]) sp[k] = v[0];
  }

  const { items, meta } = await fetchTalkList(sp);
  const currentPage = meta.page;

  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="lounge" currentSub="작당 수다방" />

      <section className={styles.guideToolbar} aria-label="게시글 검색 및 정렬">
        <div className={styles.sortGroup}>
          <Select options={sortOptions} defaultValue={sp.sort ?? "latest"} />
        </div>
        <SearchAutocomplete
          label="수다방 검색"
          placeholder="수다방 검색"
          popularTags={["잡담", "AI비교", "AI앱추천", "이미지생성", "프롬프트", "팁"]}
        />
      </section>

      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 {meta.totalItems}개</span>
          </div>
          <div className={styles.headerActions}>
            <AskButton tags={["lounge-talk"]} />
            <Link href="/lounge/talk/write">
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
          <section className={styles.postList} aria-label="작당 수다방 게시글 목록">
            {items.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--color-text-sub)", padding: "48px 0" }}>
                아직 수다방 글이 없습니다. 첫 글을 남겨보세요!
              </p>
            ) : (
              items.map((post) => (
                <article key={post.id} className={styles.postItem}>
                  <div className={styles.postTop}>
                    <div className={styles.tagRow}>
                      {post.tags.map((tag) => (
                        <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                          #{tag}
                        </Tag>
                      ))}
                    </div>
                  </div>

                  <h3 className={styles.postHeading}>
                    <Link href={`/lounge/talk/${post.slug}`} className={styles.postTitle}>
                      {post.title}
                    </Link>
                  </h3>

                  {post.summary && <p className={styles.postExcerpt}>{post.summary}</p>}

                  <div className={styles.postFooter}>
                    <div className={styles.postAuthor}>
                      <Avatar name={post.authorNickname ?? "익명"} src={post.authorAvatarUrl ?? undefined} size="sm" />
                      <AuthorName name={post.authorNickname ?? "탈퇴 회원"} authorId={post.userId ?? undefined} className={styles.authorName} />
                      <span className={styles.footerDivider} aria-hidden="true">|</span>
                      <span className={styles.postDate}>
                        {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <div className={styles.postStats} aria-label="게시글 정보">
                      <span><Icon name="eye-line" />{post.viewCount}</span>
                      <span><Icon name="chat-3-line" />{post.commentCount}</span>
                      <span><Icon name="heart-3-line" />{post.likeCount}</span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          {meta.totalPages > 1 && (
            <nav className={styles.pagination} aria-label="페이지 이동">
              {currentPage > 1 && (
                <Link href={`/lounge/talk?${new URLSearchParams({ ...sp, page: String(currentPage - 1) }).toString()}`} aria-label="이전 페이지">
                  <Icon name="arrow-left-s-line" />
                </Link>
              )}
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/lounge/talk?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}
                  aria-current={p === currentPage ? "page" : undefined}
                >
                  {p}
                </Link>
              ))}
              {currentPage < meta.totalPages && (
                <Link href={`/lounge/talk?${new URLSearchParams({ ...sp, page: String(currentPage + 1) }).toString()}`} aria-label="다음 페이지">
                  <Icon name="arrow-right-s-line" />
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </main>
  );
}

// Story 8.9: ISR — 상세 페이지 300초 TTL 캐시 (AR-17)
export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BOARDS } from "@ai-jakdang/contracts";
import type { PostDetail } from "@ai-jakdang/contracts";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { AttachmentList, BoardHero, CodeBlockCopyButton, DeleteButton, RecentViewedTracker } from "@/components/board";
import {
  SITE_URL,
  buildPostMeta,
  buildPostUrl,
  buildPostBreadcrumb,
  buildBreadcrumbJsonLd,
  buildDiscussionJsonLd,
} from "@/lib/seo";
import { CreativeSpecPanel } from "./CreativeSpecPanel";
import { ReactionBar } from "./ReactionBar";
import { CommentForm } from "./CommentForm";
import { CommentItem, type ApiComment } from "./CommentItem";
import styles from "../lounge.module.css";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/api/v1/posts/${encodeURIComponent(decodeURIComponent(slug))}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const post = (await res.json()) as PostDetail;
    return buildPostMeta(post);
  } catch {
    return {};
  }
}

export default async function LoungeDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(`${API_URL}/api/v1/posts/${encodeURIComponent(decodeURIComponent(slug))}`, {
    headers: { cookie },
    cache: "no-store",
  });

  if (!res.ok) notFound();

  const post = (await res.json()) as PostDetail;

  const commentsRes = await fetch(
    `${API_URL}/api/v1/comments?targetType=post&targetId=${post.id}&pageSize=50`,
    { headers: { cookie }, cache: "no-store" },
  );
  const commentsData = commentsRes.ok
    ? ((await commentsRes.json()) as { items: ApiComment[] })
    : { items: [] };

  const boardMeta = BOARDS[post.board];
  const boardUrl = boardMeta ? `${SITE_URL}${boardMeta.urlPath}` : `${SITE_URL}/lounge`;
  // 상세 URL 은 쿼리스트링을 제거한 경로로 생성(하위게시판 breadcrumb URL 깨짐 방지).
  const postUrl = buildPostUrl(post.board, post.slug);
  const boardLabel = boardMeta?.label ?? "AI 창작마당";
  const boardCategory = boardMeta?.category ?? "lounge";
  const listUrl = boardMeta?.urlPath ?? "/lounge";
  const editUrl = `/${boardCategory}/${post.board}/${post.slug}/edit`;

  const breadcrumbItems = buildPostBreadcrumb(boardCategory, boardLabel, boardUrl, post.title, postUrl);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems);
  const structuredDataJsonLd = buildDiscussionJsonLd(post, boardMeta?.urlPath ?? "/lounge");

  const formattedDate = new Date(post.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // item 11: spec 존재 시 2열 레이아웃(detailWithSpec), 없으면 1열(detailLayout)
  const hasSpec = !!post.creativeSpec;
  const layoutClass = hasSpec ? styles.detailWithSpec : styles.detailLayout;

  return (
    <main id="main" className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredDataJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* 열람 이력 기록 — localStorage 기반 최근 본 글 */}
      <RecentViewedTracker
        href={`${listUrl}/${post.slug}`}
        board={boardLabel}
        title={post.title}
      />

      <BoardHero menu="lounge" currentSub={boardLabel} />

      <div className={layoutClass}>
        <article className={styles.postDetail}>
          <header className={styles.detailHeader}>
            <div className={styles.detailCategoryRow}>
              {post.tags.length > 0 && (
                <div className={styles.tagRow}>
                  {post.tags.map((tag) => (
                    <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                      #{tag}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
            <h1>{post.title}</h1>
            <div className={styles.detailMeta}>
              <AuthorName name={post.authorNickname ?? "익명"} authorId={post.authorId ?? undefined} />
              <span>{formattedDate}</span>
              <span>조회 {post.viewCount.toLocaleString()}</span>
              <span>댓글 {post.commentCount}</span>
              <span>좋아요 {post.likeCount}</span>
            </div>
          </header>

          <div className={styles.articleBody}>
            <CodeBlockCopyButton html={post.contentHtml} />
            {post.hasAttachment && <AttachmentList files={post.attachments ?? []} />}
          </div>

          <ReactionBar
            likes={post.likeCount}
            bookmarks={0}
            postId={post.id}
            targetType="post"
            authorId={post.authorId}
          />

          {/* item 12: 모바일에서 댓글 입력(CommentForm) 바로 위에 스펙 패널 표시.
              데스크톱에서는 CSS로 숨기고 오른쪽 aside만 보임. */}
          {hasSpec && (
            <div className={styles.specPanelMobile} aria-hidden="false">
              <CreativeSpecPanel spec={post.creativeSpec} />
            </div>
          )}

          <section className={styles.commentSection} aria-labelledby="comment-title">
            <h3 id="comment-title" className={styles.commentTitle}>
              댓글 {commentsData.items.length}
            </h3>
            <CommentForm targetType="post" targetId={post.id} />
            <ul className={styles.commentList}>
              {commentsData.items.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </ul>
          </section>

          <footer className={styles.detailFooter}>
            <Link href="/lounge" className={styles.listButton}>
              <Icon name="list-check" />
              목록으로
            </Link>
            {post.isOwner && (
              <div className={styles.ownerActions}>
                <Link href={editUrl} className={styles.editLink}>
                  <Icon name="edit-2-line" />
                  수정
                </Link>
                <DeleteButton
                  postId={post.id}
                  listUrl={listUrl}
                />
              </div>
            )}
          </footer>
        </article>

        {/* item 11: 데스크톱 우측 사이드 패널 (≥1025px).
            spec 없으면 CreativeSpecPanel이 null을 반환하므로 aside가 비어도 레이아웃 안전. */}
        {hasSpec && (
          <aside className={styles.specPanelDesktop} aria-label="창작 스펙">
            <CreativeSpecPanel spec={post.creativeSpec} />
          </aside>
        )}
      </div>
    </main>
  );
}

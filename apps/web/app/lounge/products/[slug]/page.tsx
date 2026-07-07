// Story 8.9: ISR — 상세 페이지 300초 TTL 캐시 (AR-17)
export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BOARDS } from "@ai-jakdang/contracts";
import type { PostDetail } from "@ai-jakdang/contracts";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { AttachmentList, BoardHero, CodeBlockCopyButton, RecentViewedTracker, ViewBeacon } from "@/components/board";
import {
  SITE_URL,
  buildPostMeta,
  buildPostUrl,
  buildPostBreadcrumb,
  buildBreadcrumbJsonLd,
  buildDiscussionJsonLd,
} from "@/lib/seo";
import styles from "../../lounge.module.css";
import { CommentForm } from "./CommentForm";
import { CommentItem, type ApiComment } from "./CommentItem";
import { ReactionBar } from "./ReactionBar";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

type Params = Promise<{ slug: string }>;

async function fetchPost(slug: string, cookie: string): Promise<PostDetail | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/posts/${encodeURIComponent(decodeURIComponent(slug))}`,
      { headers: { cookie }, cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as PostDetail;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug, "");
  if (!post) return { title: "내가 만든 AI 제품" };
  return buildPostMeta(post);
}

export default async function LoungeProductDetailPage({ params }: { params: Params }) {
  const { slug } = await params;

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const post = await fetchPost(slug, cookie);
  if (!post) notFound();

  const commentsRes = await fetch(
    `${API_URL}/api/v1/comments?targetType=post&targetId=${post.id}&pageSize=50`,
    { headers: { cookie }, cache: "no-store" },
  );
  const commentsData = commentsRes.ok
    ? ((await commentsRes.json()) as { items: ApiComment[] })
    : { items: [] };

  const formattedDate = new Date(post.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // SEO 구조화 데이터 (Discussion + BreadcrumbList)
  const boardMeta = BOARDS[post.board];
  const boardLabel = boardMeta?.label ?? "내가 만든 AI 제품";
  const boardCategory = boardMeta?.category ?? "ai-creation";
  const boardUrl = `${SITE_URL}${boardMeta?.urlPath ?? "/lounge/products"}`;
  const postUrl = buildPostUrl(post.board, post.slug);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    buildPostBreadcrumb(boardCategory, boardLabel, boardUrl, post.title, postUrl),
  );
  const structuredDataJsonLd = buildDiscussionJsonLd(post, boardMeta?.urlPath ?? "/lounge/products");

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
      <ViewBeacon targetType="post" targetId={post.id} />
      <RecentViewedTracker
        href={`/lounge/products/${post.slug}`}
        board="내가 만든 AI 제품"
        title={post.title}
      />
      <BoardHero menu="lounge" currentSub="내가 만든 AI 제품" />

      <div className={styles.detailLayout}>
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
            <Link href="/lounge/products" className={styles.listButton}>
              <Icon name="list-check" />
              목록으로
            </Link>
          </footer>
        </article>
      </div>
    </main>
  );
}

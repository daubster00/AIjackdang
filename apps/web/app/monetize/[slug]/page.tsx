import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BOARDS } from "@ai-jakdang/contracts";
import type { PostDetail } from "@ai-jakdang/contracts";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { BoardHero, AttachmentList, CodeBlockCopyButton, DeleteButton } from "@/components/board";
import {
  buildPostMeta,
  buildPostBreadcrumb,
  buildBreadcrumbJsonLd,
  buildDiscussionJsonLd,
} from "@/lib/seo";
import { ShareButton } from "./ShareButton";
import { ReactionBar } from "./ReactionBar";
import { CommentForm } from "./CommentForm";
import { CommentItem, type ApiComment } from "./CommentItem";
import styles from "../monetize.module.css";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/api/v1/posts/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    const post = (await res.json()) as PostDetail;
    return buildPostMeta(post);
  } catch {
    return {};
  }
}

export default async function MonetizeDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(`${API_URL}/api/v1/posts/${encodeURIComponent(slug)}`, {
    headers: { cookie },
    next: { revalidate: 60 },
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
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
  const boardUrl = boardMeta ? `${SITE_URL}${boardMeta.urlPath}` : `${SITE_URL}/monetize`;
  const postUrl = `${boardUrl}/${post.slug}`;
  const boardLabel = boardMeta?.label ?? "수익화 팁";
  const boardCategory = boardMeta?.category ?? "ai-monetization";
  const listUrl = boardMeta?.urlPath ?? "/monetize";
  const editUrl = `/${boardCategory}/${post.board}/${post.slug}/edit`;

  const breadcrumbItems = buildPostBreadcrumb(boardCategory, boardLabel, boardUrl, post.title, postUrl);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems);
  const structuredDataJsonLd = buildDiscussionJsonLd(post, boardMeta?.urlPath ?? "/monetize");

  const formattedDate = new Date(post.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

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

      <BoardHero menu="monetize" currentSub={boardLabel} />

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
              <AuthorName name={post.authorNickname ?? "익명"} />
              <span>{formattedDate}</span>
              <span>조회 {post.viewCount.toLocaleString()}</span>
              <span>댓글 {post.commentCount}</span>
              <span>좋아요 {post.likeCount}</span>
            </div>
          </header>

          <div className={styles.articleBody}>
            <CodeBlockCopyButton html={post.contentHtml} />
            {post.hasAttachment && <AttachmentList />}
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
            <Link href="/monetize" className={styles.listButton}>
              <Icon name="list-check" />
              목록으로
            </Link>
            <ShareButton url={postUrl} />
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
      </div>
    </main>
  );
}

// Story 8.9: ISR — 상세 페이지 300초 TTL 캐시 (AR-17)
export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { PostDetail } from "@ai-jakdang/contracts";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { AttachmentList, BoardHero, CodeBlockCopyButton } from "@/components/board";
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
  if (!post) return { title: "작당 수다방" };
  return {
    title: `${post.title} | 작당 수다방`,
    description: post.summary ?? post.title,
    openGraph: { title: post.title, description: post.summary ?? undefined },
  };
}

export default async function LoungeTalkDetailPage({ params }: { params: Params }) {
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

  return (
    <main id="main" className={styles.page}>
      <BoardHero menu="lounge" currentSub="작당 수다방" />

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
            <Link href="/lounge/talk" className={styles.listButton}>
              <Icon name="list-check" />
              목록으로
            </Link>
          </footer>
        </article>
      </div>
    </main>
  );
}

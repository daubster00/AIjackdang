import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BOARDS } from "@ai-jakdang/contracts";
import type { PostDetail } from "@ai-jakdang/contracts";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { BoardHero, AttachmentList, CodeBlockCopyButton, RecentViewedTracker } from "@/components/board";
import { resolveHeroKey } from "@/components/board";
import {
  buildPostMeta,
  buildPostBreadcrumb,
  buildBreadcrumbJsonLd,
  buildDiscussionJsonLd,
  buildArticleJsonLd,
} from "@/lib/seo";
import { DeleteButton } from "@/components/board";
import styles from "./detail.module.css";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

interface PageProps {
  params: Promise<{ category: string; board: string; slug: string }>;
}

// ── generateMetadata ──────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function GenericDetailPage({ params }: PageProps) {
  const { category, board: boardSlug, slug } = await params;

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(`${API_URL}/api/v1/posts/${encodeURIComponent(decodeURIComponent(slug))}`, {
    headers: { cookie },
    cache: "no-store",
  });

  if (!res.ok) notFound();

  const post = (await res.json()) as PostDetail;

  // Board metadata
  const boardMeta = BOARDS[post.board] ?? BOARDS[boardSlug];
  const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
  const boardUrl = boardMeta ? `${SITE_URL}${boardMeta.urlPath}` : `${SITE_URL}`;
  const postUrl = `${boardUrl}/${post.slug}`;
  const boardLabel = boardMeta?.label ?? post.board;
  const boardCategory = boardMeta?.category ?? category;

  // JSON-LD
  const isArticle = post.board === "notice" || !!boardMeta?.isSystemBoard;
  const structuredDataJsonLd = isArticle
    ? buildArticleJsonLd(post, boardMeta?.urlPath ?? "")
    : buildDiscussionJsonLd(post, boardMeta?.urlPath ?? "");

  const breadcrumbItems = buildPostBreadcrumb(
    boardCategory,
    boardLabel,
    boardUrl,
    post.title,
    postUrl,
  );
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems);

  // Hero menu key — use boardCategory mapped to BoardHeroKey
  const heroMenu = resolveHeroKey(boardCategory);

  // Format date
  const formattedDate = new Date(post.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // List URL to go back to
  const listUrl = boardMeta?.urlPath ?? `/${category}`;

  // Edit URL: /{category}/{board}/{slug}/edit
  const editUrl = `/${boardCategory}/${boardSlug}/${post.slug}/edit`;

  return (
    <main id="main" className={styles.page}>
      {/* JSON-LD */}
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
        href={`/${category}/${boardSlug}/${post.slug}`}
        board={boardLabel}
        title={post.title}
      />

      <BoardHero menu={heroMenu} currentSub={boardLabel} titleAs="h2" />

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

          {/* Participation slots (Epic 5에서 활성화) */}
          <div
            data-slot="reactions"
            aria-label="좋아요·북마크 (Epic 5에서 활성화)"
            aria-disabled="true"
            className={styles.participationSlot}
          >
            <span className={styles.slotHint}>좋아요·북마크 기능은 곧 활성화됩니다 (Epic 5)</span>
          </div>
          <div
            data-slot="comments"
            aria-label="댓글 (Epic 5에서 활성화)"
            aria-disabled="true"
            className={styles.participationSlot}
          >
            <span className={styles.slotHint}>댓글 기능은 곧 활성화됩니다 (Epic 5)</span>
          </div>
          <div
            data-slot="report"
            aria-label="신고 (Epic 5에서 활성화)"
            aria-disabled="true"
            className={styles.participationSlot}
          >
            <span className={styles.slotHint}>신고 기능은 곧 활성화됩니다 (Epic 5)</span>
          </div>

          <footer className={styles.detailFooter}>
            <div className={styles.footerLeft}>
              <Link href={listUrl} className={styles.listButton}>
                <Icon name="list-check" />
                목록으로
              </Link>
            </div>
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

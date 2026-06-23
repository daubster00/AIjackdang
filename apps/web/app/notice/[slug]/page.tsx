/**
 * 공지사항 상세 서버 컴포넌트 — Story 2.9
 *
 * 경로: /notice/[slug]
 * SSR + SEO: buildNoticeMeta (고유 title·canonical·Article JSON-LD·BreadcrumbList)
 * noindex 미적용 — 공개 색인 허용 (FR-15.3).
 * [글쓰기]/[수정]/[삭제] 미노출 (운영자 전용, Epic 9 소유).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { PostDetail } from "@ai-jakdang/contracts";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { AttachmentList, CodeBlockCopyButton } from "@/components/board";
import {
  buildNoticeMeta,
  buildBreadcrumbJsonLd,
  buildArticleJsonLd,
} from "@/lib/seo";
import { ShareButton } from "@/app/(content)/[category]/[board]/[slug]/ShareButton";
import styles from "./notice-detail.module.css";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/api/v1/posts/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    const post = (await res.json()) as PostDetail;
    return buildNoticeMeta(post);
  } catch {
    return {};
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function NoticeDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(`${API_URL}/api/v1/posts/${encodeURIComponent(slug)}`, {
    headers: { cookie },
    next: { revalidate: 60 },
  });

  if (!res.ok) notFound();

  const post = (await res.json()) as PostDetail;

  // Only show published notices (no draft viewing for non-owners; server enforces this)
  // Also verify it's actually a notice post
  if (post.board !== "notice") notFound();

  const boardUrl = `${SITE_URL}/notice`;
  const postUrl = `${boardUrl}/${post.slug}`;

  // JSON-LD: Article (isSystemBoard=true) + BreadcrumbList (홈 > 공지사항 > 글)
  const articleJsonLd = buildArticleJsonLd(post, "/notice");
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "홈", url: SITE_URL },
    { name: "공지사항", url: boardUrl },
    {
      name: post.title.length > 50 ? `${post.title.slice(0, 50)}...` : post.title,
      url: postUrl,
    },
  ]);

  const formattedDate = new Date(post.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <main id="main" className={styles.page}>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className={styles.detailLayout}>
        <article className={styles.postDetail}>
          <header className={styles.detailHeader}>
            {post.isPinned && (
              <div className={styles.pinnedBadge}>
                <Icon name="pushpin-2-fill" />
                <span>상단 고정</span>
              </div>
            )}

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
              <AuthorName name={post.authorNickname ?? "운영자"} />
              <span>{formattedDate}</span>
              <span>조회 {post.viewCount.toLocaleString()}</span>
            </div>
          </header>

          <div className={styles.articleBody}>
            <CodeBlockCopyButton html={post.contentHtml} />
            {post.hasAttachment && <AttachmentList />}
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

          {/* 수정/삭제 버튼 없음 — 운영자 전용 (Epic 9 소유) */}

          <footer className={styles.detailFooter}>
            <div className={styles.footerLeft}>
              <Link href="/notice" className={styles.listButton}>
                <Icon name="list-check" />
                목록으로
              </Link>
              <ShareButton url={postUrl} />
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}

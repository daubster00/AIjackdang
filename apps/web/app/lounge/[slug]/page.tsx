import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BOARDS } from "@ai-jakdang/contracts";
import type { PostDetail } from "@ai-jakdang/contracts";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { AttachmentList, BoardHero, CodeBlockCopyButton } from "@/components/board";
import {
  buildPostMeta,
  buildPostBreadcrumb,
  buildBreadcrumbJsonLd,
  buildDiscussionJsonLd,
} from "@/lib/seo";
import { ShareButton } from "./ShareButton";
import { CreativeSpecPanel } from "./CreativeSpecPanel";
import styles from "../lounge.module.css";

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

export default async function LoungeDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(`${API_URL}/api/v1/posts/${encodeURIComponent(slug)}`, {
    headers: { cookie },
    next: { revalidate: 60 },
  });

  if (!res.ok) notFound();

  const post = (await res.json()) as PostDetail;

  const boardMeta = BOARDS[post.board];
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
  const boardUrl = boardMeta ? `${SITE_URL}${boardMeta.urlPath}` : `${SITE_URL}/lounge`;
  const postUrl = `${boardUrl}/${post.slug}`;
  const boardLabel = boardMeta?.label ?? "AI 창작마당";
  const boardCategory = boardMeta?.category ?? "lounge";

  const breadcrumbItems = buildPostBreadcrumb(boardCategory, boardLabel, boardUrl, post.title, postUrl);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems);
  const structuredDataJsonLd = buildDiscussionJsonLd(post, boardMeta?.urlPath ?? "/lounge");

  const formattedDate = new Date(post.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // CreativeSpecPanel은 spec=undefined 시 null을 반환하므로 안전
  const layoutClass = styles.detailLayout;

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

          {/* Participation slots — Epic 5에서 활성화 */}
          <div
            data-slot="reactions"
            aria-label="좋아요·북마크 (Epic 5에서 활성화)"
            aria-disabled="true"
            style={{ opacity: 0.6, border: "1px dashed var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", margin: "var(--space-4) 0" }}
          >
            <span style={{ color: "var(--color-text-sub)", fontSize: "var(--font-size-sm)" }}>좋아요·북마크 기능은 곧 활성화됩니다 (Epic 5)</span>
          </div>
          <div
            data-slot="comments"
            aria-label="댓글 (Epic 5에서 활성화)"
            aria-disabled="true"
            style={{ opacity: 0.6, border: "1px dashed var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", margin: "var(--space-4) 0" }}
          >
            <span style={{ color: "var(--color-text-sub)", fontSize: "var(--font-size-sm)" }}>댓글 기능은 곧 활성화됩니다 (Epic 5)</span>
          </div>
          <div
            data-slot="report"
            aria-label="신고 (Epic 5에서 활성화)"
            aria-disabled="true"
            style={{ opacity: 0.6, border: "1px dashed var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", margin: "var(--space-4) 0" }}
          >
            <span style={{ color: "var(--color-text-sub)", fontSize: "var(--font-size-sm)" }}>신고 기능은 곧 활성화됩니다 (Epic 5)</span>
          </div>

          <footer className={styles.detailFooter}>
            <Link href="/lounge" className={styles.listButton}>
              <Icon name="list-check" />
              목록으로
            </Link>
            <ShareButton url={postUrl} />
            {post.isOwner && (
              <div className={styles.ownerActions}>
                <button type="button">
                  <Icon name="edit-2-line" />
                  수정
                </button>
                <button type="button">
                  <Icon name="delete-bin-line" />
                  삭제
                </button>
              </div>
            )}
          </footer>
        </article>

        {/* 창작 스펙 패널 — spec 없으면 CreativeSpecPanel이 null을 반환하므로 안전 */}
        <CreativeSpecPanel spec={undefined} />
      </div>
    </main>
  );
}

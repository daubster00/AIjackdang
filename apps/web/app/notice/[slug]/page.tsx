/**
 * 공지사항 상세 서버 컴포넌트 — Story 2.9
 *
 * 경로: /notice/[slug]
 * SSR + SEO: buildNoticeMeta (고유 title·canonical·Article JSON-LD·BreadcrumbList)
 * noindex 미적용 — 공개 색인 허용 (FR-15.3).
 * [글쓰기]/[수정]/[삭제] 미노출 (운영자 전용, Epic 9 소유).
 *
 * 레이아웃은 일반 게시글 상세(lounge)와 동일한 구성.
 * BoardHero / 댓글(CommentForm + CommentItem)을 lounge 공유 컴포넌트로 재사용.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { PostDetail } from "@ai-jakdang/contracts";
import { AuthorName, Icon, Tag } from "@/components/ui";
import { AttachmentList, BoardHero, CodeBlockCopyButton, RecentViewedTracker } from "@/components/board";
import {
  buildNoticeMeta,
  buildBreadcrumbJsonLd,
  buildArticleJsonLd,
} from "@/lib/seo";
import { CommentForm } from "@/app/lounge/[slug]/CommentForm";
import { CommentItem, type ApiComment } from "@/app/lounge/[slug]/CommentItem";
// 페이지 레이아웃·상세 구조는 lounge.module.css 공유
import styles from "@/app/lounge/lounge.module.css";
// 공지사항 전용 배지는 별도 모듈
import noticeStyles from "./notice-detail.module.css";

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
    const res = await fetch(`${API_URL}/api/v1/posts/${encodeURIComponent(decodeURIComponent(slug))}`, {
      cache: "no-store",
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

  const res = await fetch(`${API_URL}/api/v1/posts/${encodeURIComponent(decodeURIComponent(slug))}`, {
    headers: { cookie },
    cache: "no-store",
  });

  if (!res.ok) notFound();

  const post = (await res.json()) as PostDetail;

  // Only show published notices (no draft viewing for non-owners; server enforces this)
  // Also verify it's actually a notice post
  if (post.board !== "notice") notFound();

  // 댓글 목록 조회 (targetType="post", targetId=게시글 ID)
  const commentsRes = await fetch(
    `${API_URL}/api/v1/comments?targetType=post&targetId=${post.id}&pageSize=50`,
    { headers: { cookie }, cache: "no-store" },
  );
  const commentsData = commentsRes.ok
    ? ((await commentsRes.json()) as { items: ApiComment[] })
    : { items: [] };

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
      {/* 열람 이력 기록 — localStorage 기반 최근 본 글 */}
      <RecentViewedTracker
        href={`/notice/${post.slug}`}
        board="공지사항"
        title={post.title}
      />

      {/* 히어로: notice는 라운지 대메뉴 소속이므로 lounge 히어로 사용 */}
      <BoardHero menu="lounge" currentSub="공지사항" titleAs="h2" />

      <div className={styles.detailLayout}>
        <article className={styles.postDetail}>
          <header className={styles.detailHeader}>
            {/* 상단 고정 배지 (공지사항 전용) */}
            {post.isPinned && (
              <div className={noticeStyles.pinnedBadge}>
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
              <AuthorName name={post.authorNickname ?? "운영자"} authorId={post.authorId ?? undefined} />
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

          {/* 댓글 섹션 (lounge CommentForm + CommentItem 재사용) */}
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

          {/* 수정/삭제 버튼 없음 — 운영자 전용 (Epic 9 소유) */}

          <footer className={`${styles.detailFooter} ${noticeStyles.footerNoBorder}`}>
            <Link href="/notice" className={styles.listButton}>
              <Icon name="list-check" />
              목록으로
            </Link>
          </footer>
        </article>
      </div>
    </main>
  );
}

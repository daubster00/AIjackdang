/**
 * 게시글 수정 페이지 — Story 2.8
 *
 * 서버 컴포넌트:
 * 1. 쿠키 포함 API 호출로 게시글 상세 조회
 * 2. 비인증 → /login 리다이렉트
 * 3. isOwner=false → 목록 리다이렉트
 * 4. 클라이언트 컴포넌트 PostEditForm 에 post 데이터 전달
 *
 * 라우트: /{category}/{board}/{slug}/edit
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { BOARDS } from "@ai-jakdang/contracts";
import type { PostDetail } from "@ai-jakdang/contracts";
import { BoardHero } from "@/components/board";
import { resolveHeroKey } from "@/components/board";
import { PostEditForm } from "./PostEditForm";
import styles from "@/components/board/PostWriteForm.module.css";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

interface PageProps {
  params: Promise<{ category: string; board: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `글 수정 — ${slug}`,
  };
}

export default async function EditPostPage({ params }: PageProps) {
  const { category, board: boardSlug, slug } = await params;

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  // 비인증 → /login 리다이렉트
  if (!cookie) {
    redirect(`/login?redirectTo=/${category}/${boardSlug}/${slug}/edit`);
  }

  // 게시글 상세 조회 (쿠키 포함 — isOwner 판단)
  const res = await fetch(`${API_URL}/api/v1/posts/${encodeURIComponent(decodeURIComponent(slug))}`, {
    headers: { cookie },
    cache: "no-store",
  });

  if (!res.ok) {
    notFound();
  }

  const post = (await res.json()) as PostDetail;

  // 비소유자 → 목록으로 리다이렉트
  if (!post.isOwner) {
    const boardMeta = BOARDS[post.board] ?? BOARDS[boardSlug];
    redirect(boardMeta?.urlPath ?? `/${category}`);
  }

  const boardMeta = BOARDS[post.board] ?? BOARDS[boardSlug];
  const heroMenu = resolveHeroKey(boardMeta?.category ?? category);
  const boardLabel = boardMeta?.label ?? post.board;

  // 수정 완료 후 이동할 상세 페이지 경로
  const detailHref = boardMeta?.urlPath
    ? `${boardMeta.urlPath}/${post.slug}`
    : `/${category}/${boardSlug}/${post.slug}`;

  return (
    <main id="main" className={styles.page}>
      <BoardHero menu={heroMenu} currentSub={boardLabel} />
      <PostEditForm post={post} detailHref={detailHref} />
    </main>
  );
}

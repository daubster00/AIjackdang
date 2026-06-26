// Story 8.9: ISR — 상세 페이지 300초 TTL 캐시 (AR-17)
export const revalidate = 300;

// 작당 의뢰소 상세 페이지 (서버 컴포넌트 래퍼).
// Story 2.12: mock 데이터 → 실 API 연동.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardHero, RecentViewedTracker } from "@/components/board";
import { GigDetailClient } from "./GigDetailClient";
import type { PostDetail } from "@ai-jakdang/contracts";

// ── API 데이터 fetcher ──────────────────────────────────────
async function fetchGigDetail(slug: string): Promise<PostDetail | null> {
  const API_BASE = process.env.INTERNAL_API_URL ?? "http://localhost:4003";

  try {
    const res = await fetch(`${API_BASE}/api/v1/posts/${slug}`, {
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as PostDetail;
  } catch {
    return null;
  }
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchGigDetail(slug);
  if (!post) return { title: "작당 의뢰소" };
  return {
    title: `${post.title} | 작당 의뢰소`,
    description: post.summary ?? post.title,
    openGraph: {
      title: post.title,
      description: post.summary ?? undefined,
    },
  };
}

export default async function GigDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await fetchGigDetail(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      {/* 열람 이력 기록 — localStorage 기반 최근 본 글 */}
      <RecentViewedTracker
        href={`/lounge/gigs/${post.slug}`}
        board="작당 의뢰소"
        title={post.title}
      />
      {/* 히어로: 작당 라운지 대메뉴 공통 히어로 */}
      <BoardHero menu="lounge" currentSub="작당 의뢰소" />

      {/* 상세 내용은 클라이언트 컴포넌트로 분리 (모집상태 토글, 쪽지 버튼) */}
      <GigDetailClient post={post} />
    </>
  );
}

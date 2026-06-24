/**
 * 질문 수정 페이지 — Story 3.8
 *
 * SSR 서버 컴포넌트:
 * - 세션 없으면 /login?redirectTo 리다이렉트
 * - 작성자 아니면 /questions/{slug} 리다이렉트 (비작성자 접근 차단)
 * - GET /api/v1/qna/questions/{slug} 로 기존 데이터 로드 → prefill
 * - QuestionEditClient 에 initialTitle·initialContentJson·initialTags 주입
 *
 * ⚠️ SSR 500 방지: process.env 상수는 [slug]/constants.ts 에서만 정의.
 *   클라이언트 컴포넌트가 이 page 모듈을 import 하지 않도록 분리.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { BoardHero } from "@/components/board";
import formStyles from "@/components/board/PostWriteForm.module.css";
import { QuestionEditClient } from "./QuestionEditClient";
import { API_URL } from "../constants";

// ── 타입 ────────────────────────────────────────────────────────────────────────

interface QuestionForEdit {
  id: string;
  slug: string;
  title: string;
  contentJson: Record<string, unknown>;
  tags: string[];
  status: string;
  author: { id: string; nickname: string; avatarUrl: string | null } | null;
}

// ── 데이터 페칭 ─────────────────────────────────────────────────────────────────

async function fetchQuestionForEdit(
  slug: string,
  cookie?: string,
): Promise<QuestionForEdit | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/qna/questions/${encodeURIComponent(slug)}`,
      {
        headers: cookie ? { cookie } : {},
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    return res.json() as Promise<QuestionForEdit>;
  } catch {
    return null;
  }
}

// ── 서버 세션 조회 ───────────────────────────────────────────────────────────────

async function getServerSession(cookie?: string): Promise<{ userId: string } | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/get-session`, {
      headers: cookie ? { cookie } : {},
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: { id: string } } | null;
    if (!data?.user?.id) return null;
    return { userId: data.user.id };
  } catch {
    return null;
  }
}

// ── generateMetadata ────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `질문 수정 | 묻고답하기 - AI작당`,
    alternates: { canonical: `/questions/${slug}/edit` },
    robots: { index: false, follow: false },
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export default async function QuestionEditPage({ params }: PageProps) {
  const { slug } = await params;

  // 쿠키 포워딩
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  // 병렬 페칭
  const [question, session] = await Promise.all([
    fetchQuestionForEdit(slug, cookie),
    getServerSession(cookie),
  ]);

  // 질문 없으면 404
  if (!question) {
    notFound();
  }

  // 비회원 → 로그인 페이지
  if (!session?.userId) {
    redirect(`/login?redirectTo=${encodeURIComponent(`/questions/${slug}/edit`)}`);
  }

  // 작성자 아니면 질문 상세로 리다이렉트
  if (!question.author || question.author.id !== session.userId) {
    redirect(`/questions/${slug}`);
  }

  return (
    <main id="main" className={formStyles.page}>
      {/* 묻고답하기 대메뉴 공통 히어로 */}
      <BoardHero menu="questions" currentSub="묻고답하기" />

      {/* 질문 수정 폼 */}
      <QuestionEditClient
        questionId={question.id}
        questionSlug={question.slug}
        initialTitle={question.title}
        initialContentJson={question.contentJson}
        initialTags={question.tags}
      />
    </main>
  );
}

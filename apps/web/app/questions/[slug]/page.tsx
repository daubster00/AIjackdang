/**
 * 질문 상세 페이지 — Story 3.5
 *
 * SSR 서버 컴포넌트:
 * - generateMetadata: 질문 제목·요약·canonical (/questions/{slug})
 * - JSON-LD: BreadcrumbList (AI작당 > 묻고답하기 > 질문 제목)
 * - API 호출 → notFound() 처리
 * - 쿠키 포워딩으로 isAsker 판단
 * - contentHtml: dangerouslySetInnerHTML (API 서버에서 sanitize-html 처리됨, AR-8)
 * - 조회수: API GET 시 서버에서 trackView 호출 (fire-and-forget)
 * - 답변 영역: 읽기 전용 렌더 (작성/수정/삭제는 3.6 소유)
 *
 * ⚠️ SSR 500 방지: process.env 상수는 constants.ts에서만 정의하고 import한다.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { AuthorName, Avatar, Icon } from "@/components/ui";
import { BoardHero, AttachmentList } from "@/components/board";
import styles from "../questions.module.css";
import { QuestionActions } from "./QuestionActions";
import { QuestionDetailClient } from "./QuestionDetailClient";
import { AnswerSection } from "./AnswerSection";
import type { Answer } from "./AnswerItem";
import { API_URL, SITE_URL } from "./constants";
import type { AnswerResponse } from "@ai-jakdang/contracts";

// ── 타입 ────────────────────────────────────────────────────────────────────────

type QuestionDerivedStatus = "waiting" | "answered" | "resolved";

interface QuestionAuthor {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

interface QuestionDetail {
  id: string;
  author: QuestionAuthor | null;
  title: string;
  slug: string;
  contentJson: Record<string, unknown>;
  contentHtml: string;
  status: "draft" | "published" | "hidden" | "deleted";
  derivedStatus: QuestionDerivedStatus;
  isResolved: boolean;
  helpfulAnswerId: string | null;
  viewCount: number;
  answerCount: number;
  tags: string[];
  answers: AnswerResponse[];
  createdAt: string;
  updatedAt: string;
}

// ── 데이터 페칭 ─────────────────────────────────────────────────────────────────

async function fetchQuestion(
  slug: string,
  cookie?: string,
): Promise<QuestionDetail | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/qna/questions/${encodeURIComponent(slug)}`,
      {
        headers: cookie ? { cookie } : {},
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    return res.json() as Promise<QuestionDetail>;
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
  const question = await fetchQuestion(slug);

  if (!question) {
    return { robots: { index: false, follow: false } };
  }

  const canonicalUrl = `${SITE_URL}/questions/${question.slug}`;
  const description = question.title.slice(0, 160);

  return {
    title: `${question.title} — 묻고답하기 | AI작당`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${question.title} — 묻고답하기 | AI작당`,
      description,
      url: canonicalUrl,
      type: "article",
    },
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export default async function QuestionDetailPage({ params }: PageProps) {
  const { slug } = await params;

  // 쿠키 포워딩
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  // 병렬 페칭
  const [question, session] = await Promise.all([
    fetchQuestion(slug, cookie),
    getServerSession(cookie),
  ]);

  if (!question) {
    notFound();
  }

  // 질문 작성자 여부
  const isAsker = Boolean(
    session?.userId && question.author?.id && session.userId === question.author.id,
  );

  // 날짜 포맷
  const formattedDate = new Date(question.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // JSON-LD: BreadcrumbList
  const questionUrl = `${SITE_URL}/questions/${question.slug}`;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "AI작당", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "묻고답하기", item: `${SITE_URL}/questions` },
      { "@type": "ListItem", position: 3, name: question.title, item: questionUrl },
    ],
  };

  const answerCount = question.answerCount;

  return (
    <main id="main" className={styles.page}>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* 묻고답하기 대메뉴 공통 히어로 */}
      <BoardHero menu="questions" currentSub="묻고답하기" />

      <div className={styles.detailLayout}>
        <nav className={styles.breadcrumbBack} aria-label="현재 위치">
          <Link href="/questions">
            <Icon name="arrow-left-line" />
            묻고답하기 목록
          </Link>
        </nav>

        {/* ── 질문 본문 ── */}
        <article className={styles.questionDetail}>
          <header className={styles.detailHeader}>
            {/*
              QuestionDetailClient: detailTopRow(배지+태그) + 질문자 액션 버튼
              낙관적 상태를 위해 클라이언트 컴포넌트가 isResolved 상태를 소유한다.
            */}
            <QuestionDetailClient
              questionId={question.id}
              questionSlug={question.slug}
              initialDerivedStatus={question.derivedStatus}
              isResolved={question.isResolved}
              isAsker={isAsker}
              tags={question.tags}
            />

            <h1 className={styles.detailTitle}>{question.title}</h1>

            <div className={styles.detailMeta}>
              <span className={styles.detailAuthor}>
                <Avatar name={question.author?.nickname ?? "익명"} size="sm" />
                <AuthorName name={question.author?.nickname ?? "익명"} />
              </span>
              <span className={styles.metaDivider} aria-hidden="true">|</span>
              <span>{formattedDate}</span>
              <span className={styles.metaDivider} aria-hidden="true">|</span>
              <span>
                <Icon name="eye-line" />
                조회 {question.viewCount.toLocaleString()}
              </span>
              <span>
                <Icon name="chat-1-line" />
                답변 {answerCount}
              </span>
            </div>
          </header>

          {/* 본문 HTML — API 서버에서 sanitize-html 처리됨 (AR-8) */}
          <div
            className={styles.articleBody}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: question.contentHtml }}
          />

          <div className={styles.articleBody}>
            <AttachmentList />
          </div>

          <QuestionActions questionId={question.slug} />
        </article>

        {/* ── 답변 영역 + 작성 폼 (Story 3.6 소유) ── */}
        <AnswerSection
          questionId={question.id}
          initialAnswers={question.answers as Answer[]}
          currentUserId={session?.userId ?? null}
          isAsker={isAsker}
          helpfulAnswerId={question.helpfulAnswerId}
        />

        {/* ── 하단 동선 ── */}
        <footer className={styles.detailFooter}>
          <Link href="/questions" className={styles.listButton}>
            <Icon name="list-check" />
            목록으로
          </Link>
          {/* 질문자 액션(수정·삭제)은 QuestionDetailClient 내 QuestionOwnerActions가 렌더한다 */}
        </footer>
      </div>
    </main>
  );
}

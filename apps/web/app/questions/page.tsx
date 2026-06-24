/**
 * 묻고답하기 목록 페이지 — Story 3.2
 *
 * SSR 서버 컴포넌트. searchParams를 받아 API를 호출하고 질문 목록을 렌더한다.
 * 상태 필터·정렬·페이지는 URL 쿼리 파라미터로 관리한다.
 *
 * AC #1: SSR, <h1>묻고답하기, breadcrumb JSON-LD, CollectionPage JSON-LD, generateMetadata
 * AC #2: 상태 필터 칩 URL 반영 (FilterChips 클라이언트 컴포넌트)
 * AC #3: GET /api/v1/qna/questions 호출
 * AC #4: 빈 목록 EmptyState
 * AC #5: 페이지네이션 URL 기반 (QuestionsPagination)
 * AC #6: QuestionStatusBadge
 * AC #7: [질문하기] → /questions/write
 *
 * ⚠️ SSR 500 함정 방지:
 *   STATUS_FILTERS 상수는 FilterChips.tsx(클라이언트 컴포넌트) 안에만 선언.
 *   서버 컴포넌트가 클라이언트 컴포넌트 파일의 상수를 import 하면 런타임 500.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { Avatar, Button, EmptyState, Icon, Tag } from "@/components/ui";
import { AuthorName } from "@/components/ui";
import { BoardHero, BoardSidebar, SearchAutocomplete } from "@/components/board";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import { QuestionStatusBadge } from "@/components/qna/QuestionStatusBadge";
import { FilterChips } from "./FilterChips";
import { QuestionsPagination } from "./QuestionsPagination";
import type { PaginatedQuestions } from "@ai-jakdang/contracts";
import styles from "./questions.module.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aijakdang.com";
const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

// ── generateMetadata ──────────────────────────────────────────────────────────

const QUESTIONS_DESC = "AI작당 묻고답하기 — 질문과 답변을 모으는 통합 질문 공간";

export const metadata: Metadata = {
  title: "묻고답하기 | AI작당",
  description: QUESTIONS_DESC,
  alternates: {
    canonical: `${SITE_URL}/questions`,
  },
  openGraph: {
    title: "묻고답하기 | AI작당",
    description: QUESTIONS_DESC,
    url: `${SITE_URL}/questions`,
    siteName: "AI작당",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/og-default.png`,
        width: 1200,
        height: 630,
        alt: "AI작당 묻고답하기",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "묻고답하기 | AI작당",
    description: QUESTIONS_DESC,
    images: [`${SITE_URL}/og-default.png`],
  },
  robots: { index: true, follow: true },
};

// ── 파라미터 정규화 ───────────────────────────────────────────────────────────

type ValidStatus = "all" | "waiting" | "answered" | "resolved" | "popular";
type ValidSort = "latest" | "popular";

function resolveStatus(raw?: string): ValidStatus {
  const valid: ValidStatus[] = ["all", "waiting", "answered", "resolved", "popular"];
  if (raw && valid.includes(raw as ValidStatus)) return raw as ValidStatus;
  return "all";
}

function resolveSort(raw?: string): ValidSort {
  if (raw === "popular") return "popular";
  return "latest";
}

function resolvePage(raw?: string): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

// ── 날짜 포맷 ─────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

// ── 사이드바 더미 데이터 (Epic 6 이전 고정) ─────────────────────────────────

const userRankings = [
  { rank: 1, nickname: "자동화카페", tier: "master" as const },
  { rank: 2, nickname: "리뷰메이트", tier: "expert" as const },
  { rank: 3, nickname: "프론트라인", tier: "practitioner" as const },
  { rank: 4, nickname: "코드작당러", tier: "member" as const },
];

// ── Page ──────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{
    status?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function QuestionsPage({ searchParams }: PageProps) {
  const { status: rawStatus, sort: rawSort, page: rawPage } = await searchParams;

  const status = resolveStatus(rawStatus);
  const sort = resolveSort(rawSort);
  const page = resolvePage(rawPage);

  // ── API 호출 (SSR) ─────────────────────────────────────────────────────────
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  let questionsData: PaginatedQuestions = {
    items: [],
    meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
  };

  const qsParams = new URLSearchParams({
    status,
    sort,
    page: String(page),
    pageSize: "20",
  });

  try {
    const res = await fetch(`${API_URL}/api/v1/qna/questions?${qsParams.toString()}`, {
      headers: { cookie },
      cache: "no-store", // 질문 목록은 항상 최신 데이터
    });
    if (res.ok) {
      questionsData = (await res.json()) as PaginatedQuestions;
    }
  } catch {
    // API 연결 실패 시 빈 목록으로 렌더
  }

  const { items, meta } = questionsData;

  // ── JSON-LD ────────────────────────────────────────────────────────────────
  const questionsUrl = `${SITE_URL}/questions`;
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "AI작당", url: SITE_URL },
    { name: "묻고답하기", url: questionsUrl },
  ]);

  const collectionPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "묻고답하기",
    description: "AI작당 묻고답하기 — 질문과 답변을 모으는 통합 질문 공간",
    url: questionsUrl,
  };

  // ── 사이드바 최근 질문 ─────────────────────────────────────────────────────
  const recentPosts = items.slice(0, 4).map((q) => ({
    href: `/questions/${q.slug}`,
    board: "묻고답하기",
    title: q.title,
  }));

  return (
    <main id="main" className={styles.page}>
      {/* JSON-LD: BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* JSON-LD: CollectionPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
      />

      {/* 묻고답하기 대메뉴 공통 히어로 (대메뉴당 1개, 하위 페이지 공유) */}
      <BoardHero menu="questions" currentSub="묻고답하기" />

      {/* 접근성용 숨김 h1 — BoardHero 내부에 시각적 제목이 있으므로 SR 전용 */}
      <h1 className="sr-only">묻고답하기</h1>

      {/* 상태 필터 + 검색 툴바 */}
      <section className={styles.toolbar} aria-label="질문 상태 필터 및 검색">
        {/* FilterChips: 클라이언트 컴포넌트 — useSearchParams 사용 */}
        <Suspense
          fallback={
            <div className={styles.filterGroup} role="group" aria-label="상태 필터">
              {["전체", "답변대기", "답변있음", "해결됨", "인기질문"].map((label) => (
                <button key={label} type="button" className={styles.filterChip}>
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <FilterChips currentStatus={status} />
        </Suspense>

        <SearchAutocomplete
          label="질문 검색"
          placeholder="질문 검색"
          popularTags={["ClaudeCode", "n8n", "자동화", "Cursor", "수익화", "프롬프트"]}
        />
      </section>

      <div className={styles.listLayout}>
        {/* 목록 헤더: 통계 + 질문하기 버튼 */}
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 {meta.totalItems.toLocaleString()}개</span>
            {status !== "all" && status !== "popular" && (
              <>
                <span className={styles.statDivider} aria-hidden="true">
                  |
                </span>
                <span>
                  현재 필터:{" "}
                  {status === "waiting"
                    ? "답변대기"
                    : status === "answered"
                      ? "답변있음"
                      : "해결됨"}
                </span>
              </>
            )}
          </div>
          <Link href="/questions/write">
            <Button
              className={styles.askButton}
              leftIcon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              }
            >
              질문하기
            </Button>
          </Link>
        </div>

        <div className={styles.mainCol}>
          <section className={styles.questionList} aria-label="질문 목록">
            {items.length === 0 ? (
              /* 빈 목록 EmptyState (AC #4) */
              <EmptyState
                icon="question-answer-line"
                title="조건에 맞는 질문이 없어요."
                description={
                  status !== "all"
                    ? "다른 필터를 선택하거나 새 질문을 남겨보세요."
                    : "아직 질문이 없어요. 첫 번째 질문을 남겨보세요."
                }
                actions={
                  <Link href="/questions/write">
                    <Button>질문하기</Button>
                  </Link>
                }
              />
            ) : (
              items.map((q) => (
                <article key={q.slug} className={styles.questionItem}>
                  {/* 답변 수 강조 블록 — Q&A 목록에서 핵심 지표 */}
                  <div
                    className={`${styles.answerCount} ${q.answerCount > 0 ? styles.answerCountActive : ""}`}
                    aria-label={`답변 ${q.answerCount}개`}
                  >
                    <strong>{q.answerCount}</strong>
                    <span>답변</span>
                  </div>

                  <div className={styles.questionBody}>
                    <div className={styles.questionTop}>
                      {/* AC #6: QuestionStatusBadge — derivedStatus 기반 색상+텍스트 배지 */}
                      <QuestionStatusBadge
                        status={q.derivedStatus}
                        className={styles.statusBadge}
                      />
                      <div className={styles.tagRow}>
                        {q.tags.map((tag) => (
                          <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
                            #{tag}
                          </Tag>
                        ))}
                      </div>
                    </div>

                    <h3 className={styles.questionHeading}>
                      {/* 상세 링크: /questions/{slug} */}
                      <Link href={`/questions/${q.slug}`} className={styles.questionTitle}>
                        {q.title}
                      </Link>
                    </h3>

                    <div className={styles.questionFooter}>
                      <div className={styles.questionAuthor}>
                        <Avatar name={q.author?.nickname ?? "익명"} src={q.author?.avatarUrl ?? undefined} size="sm" />
                        {/* AuthorName: 클릭 시 쪽지/팔로우/계정 메뉴 (규약 준수) */}
                        <AuthorName
                          name={q.author?.nickname ?? "익명"}
                          className={styles.authorName}
                        />
                        <span className={styles.footerDivider} aria-hidden="true">
                          |
                        </span>
                        <span className={styles.questionDate}>{formatDate(q.createdAt)}</span>
                      </div>
                      <div className={styles.questionStats} aria-label="질문 정보">
                        <span>
                          <Icon name="eye-line" />
                          {q.viewCount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>

          {/* 페이지네이션 — AC #5 */}
          {meta.totalPages > 1 && (
            <Suspense fallback={null}>
              <QuestionsPagination page={meta.page} totalPages={meta.totalPages} />
            </Suspense>
          )}
        </div>

        <BoardSidebar
          recentPosts={recentPosts}
          rankings={userRankings}
          ariaLabel="질문 보조 정보"
        />
      </div>
    </main>
  );
}

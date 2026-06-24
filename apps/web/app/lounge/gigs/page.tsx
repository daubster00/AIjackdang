// 작당 의뢰소 목록 페이지 (서버 컴포넌트 — SSR + 비회원 색인 가능).
// Story 2.12: mock 데이터 → 실 API 연동.
// 필터(유형·분야·상태)는 URL 쿼리 파라미터 기반으로 클라이언트 컴포넌트(GigsFilter)에서 처리.

import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Avatar, AuthorName, Badge, Button, Icon } from "@/components/ui";
import { BoardHero } from "@/components/board";
import { GigsFilter } from "./GigsFilter";
import styles from "./gigs.module.css";
import type { PostCard, RecruitMeta } from "@ai-jakdang/contracts";
import { postKindToLabel, recruitStatusToLabel } from "./constants";

export const metadata: Metadata = {
  title: "작당 의뢰소 | 작당 라운지 — AI작당",
  description: "AI 외주·협업 의뢰와 구직 글을 분야·예산·상태 기준으로 찾아보세요.",
};

// ── API 데이터 fetcher ──────────────────────────────────────
async function fetchGigsList(searchParams: Record<string, string>) {
  const API_BASE = process.env.INTERNAL_API_URL ?? "http://localhost:4003";

  const params = new URLSearchParams({ board: "gigs", pageSize: "20" });
  if (searchParams.postKind) params.set("postKind", searchParams.postKind);
  if (searchParams.fields) params.set("fields", searchParams.fields);
  if (searchParams.recruitStatus) params.set("recruitStatus", searchParams.recruitStatus);
  if (searchParams.page) params.set("page", searchParams.page);

  try {
    const res = await fetch(`${API_BASE}/api/v1/posts?${params.toString()}`, {
      next: { revalidate: 30 }, // 30초 재검증 (SSR 캐시)
    });
    if (!res.ok) return { items: [] as PostCard[], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } };
    return (await res.json()) as { items: PostCard[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } };
  } catch {
    return { items: [] as PostCard[], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } };
  }
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function GigsPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedParams = await searchParams;

  // string[] → string 변환
  const sp: Record<string, string> = {};
  for (const [k, v] of Object.entries(resolvedParams)) {
    if (typeof v === "string") sp[k] = v;
    else if (Array.isArray(v) && v[0]) sp[k] = v[0];
  }

  const data = await fetchGigsList(sp);
  const { items, meta } = data;
  const currentPage = meta.page;

  return (
    <main id="main" className={styles.page}>
      {/* 히어로: 작당 라운지 대메뉴 공통 히어로 사용 */}
      <BoardHero menu="lounge" currentSub="작당 의뢰소" />

      {/* ── 필터 툴바: 클라이언트 컴포넌트 (URL 쿼리 기반) ── */}
      <Suspense>
        <GigsFilter />
      </Suspense>

      {/* ── 목록 레이아웃 ── */}
      <div className={styles.listLayout}>
        <div className={styles.listHeader}>
          <div className={styles.listStats}>
            <span>총 {meta.totalItems}개</span>
          </div>
          {/* 글쓰기 버튼: 비회원 게이팅은 GigWriteGate에서 처리 */}
          <Link href="/lounge/gigs/write">
            <Button
              className={styles.writeButton}
              leftIcon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              }
            >
              글쓰기
            </Button>
          </Link>
        </div>

        <div className={styles.mainCol}>
          <section className={styles.postList} aria-label="작당 의뢰소 게시글 목록">
            {items.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--color-text-sub)", padding: "48px 0" }}>
                조건에 맞는 의뢰·구직 글이 없습니다.
              </p>
            ) : (
              items.map((post) => (
                <GigCard key={post.id} post={post} />
              ))
            )}
          </section>

          {/* 페이지네이션 */}
          {meta.totalPages > 1 && (
            <nav className={styles.pagination} aria-label="페이지 이동">
              {currentPage > 1 && (
                <Link
                  href={`/lounge/gigs?${new URLSearchParams({ ...sp, page: String(currentPage - 1) }).toString()}`}
                  aria-label="이전 페이지"
                >
                  <Icon name="arrow-left-s-line" />
                </Link>
              )}
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/lounge/gigs?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}
                  aria-current={p === currentPage ? "page" : undefined}
                >
                  {p}
                </Link>
              ))}
              {currentPage < meta.totalPages && (
                <Link
                  href={`/lounge/gigs?${new URLSearchParams({ ...sp, page: String(currentPage + 1) }).toString()}`}
                  aria-label="다음 페이지"
                >
                  <Icon name="arrow-right-s-line" />
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </main>
  );
}

// ── 의뢰 카드 서브컴포넌트 ─────────────────────────────────
function GigCard({ post }: { post: PostCard }) {
  const meta = post.recruitMeta as RecruitMeta | null | undefined;
  const isClosed = meta?.recruitStatus === "closed";
  const typeLabel = meta?.postKind ? postKindToLabel(meta.postKind) : null;
  const statusLabel = meta?.recruitStatus ? recruitStatusToLabel(meta.recruitStatus) : null;

  return (
    <article
      className={`${styles.gigItem} ${isClosed ? styles.gigItemClosed : ""}`}
      aria-label={`${typeLabel ?? ""} - ${statusLabel ?? ""}`}
    >
      {/* 카드 본문(왼쪽): 배지 + 제목 + 분야 칩 */}
      <div className={styles.gigBody}>
        {/* 배지 행: 글유형 + 모집상태 */}
        {(typeLabel || statusLabel) && (
          <div className={styles.gigBadgeRow}>
            {typeLabel && (
              <Badge tone={meta?.postKind === "request" ? "info" : "success"} variant="soft">
                {typeLabel}
              </Badge>
            )}
            {statusLabel && (
              <Badge tone={isClosed ? "neutral" : "success"} variant={isClosed ? "outline" : "soft"}>
                {statusLabel}
              </Badge>
            )}
          </div>
        )}

        {/* 제목 */}
        <h3>
          <Link href={`/lounge/gigs/${post.slug}`} className={styles.gigTitle}>
            {post.title}
          </Link>
        </h3>

        {/* 분야 칩 */}
        {meta?.fields && meta.fields.length > 0 && (
          <div className={styles.fieldChips} aria-label="분야">
            {meta.fields.map((f) => (
              <span key={f} className={styles.fieldChip}>{f}</span>
            ))}
          </div>
        )}

        {/* 통계: 조회수 + 댓글 */}
        <div className={styles.gigStats} aria-label="통계">
          <span><Icon name="eye-line" />{post.viewCount}</span>
          <span><Icon name="chat-3-line" />{post.commentCount}</span>
        </div>
      </div>

      {/* 메타(오른쪽): 작성자·날짜·예산/기간 */}
      <div className={styles.gigMeta}>
        {/* 작성자 + 날짜 */}
        <div className={styles.gigMetaAuthor}>
          <Avatar name={post.authorNickname ?? "익명"} size="sm" />
          <div className={styles.gigMetaAuthorText}>
            <AuthorName name={post.authorNickname ?? "탈퇴 회원"} className={styles.authorName} />
            <span className={styles.gigMetaDate}>
              {new Date(post.createdAt).toLocaleDateString("ko-KR")}
            </span>
          </div>
        </div>

        {/* 예산/단가 (있을 때만) */}
        {meta?.budget && (
          <span className={styles.gigBudget}>
            예산/단가
            <span className={styles.gigBudgetAmount}>{meta.budget}</span>
          </span>
        )}
        {/* 기간 (있을 때만) */}
        {meta?.duration && (
          <span className={styles.gigBudget}>
            기간
            <span className={styles.gigBudgetAmount} style={{ fontSize: "var(--font-size-sm)" }}>
              {meta.duration}
            </span>
          </span>
        )}
      </div>
    </article>
  );
}

"use client";

/**
 * InquiryThread — 1:1 문의 상세 (Story 7.5)
 *
 * 디자인: 일반 게시판 상세(lounge/notice)와 동일한 레이아웃
 * - lounge.module.css 의 detailLayout / postDetail / detailHeader / articleBody 재사용
 * - 댓글 섹션 없음 (문의 특성상 댓글 비적용)
 * - 운영진 ↔ 회원 답변 교환은 commentSection 자리에 표시 (bubble 스타일 유지)
 * - 좋아요·공유·신고·북마크 바 없음
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Icon, Skeleton } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { TiptapRenderer } from "./TiptapRenderer";
// 게시판 상세 레이아웃 공유 (lounge/notice 와 동일한 구조)
import loungeStyles from "@/app/lounge/lounge.module.css";
// 문의 전용 스타일 (reply bubble, badge 등)
import styles from "./inquiry.module.css";

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface InquiryDetail {
  id: string;
  userId: string;
  title: string;
  body: unknown;
  status: "pending" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
}

interface InquiryReply {
  id: string;
  inquiryId: string;
  authorType: "user" | "admin";
  authorId: string;
  body: unknown;
  createdAt: string;
}

interface InquiryThreadData {
  inquiry: InquiryDetail;
  replies: InquiryReply[];
}

// ── 상태 매핑 ─────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<InquiryDetail["status"], BadgeTone> = {
  pending: "warning",
  in_progress: "info",
  resolved: "success",
};

const STATUS_LABEL: Record<InquiryDetail["status"], string> = {
  pending: "접수",
  in_progress: "처리중",
  resolved: "완료",
};

// ── 날짜 포맷 헬퍼 ───────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── 스켈레톤 ──────────────────────────────────────────────────────────────────

function ThreadSkeleton() {
  return (
    <div>
      <Skeleton height={24} width="60%" />
      <br />
      <Skeleton height={120} />
    </div>
  );
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

interface InquiryThreadProps {
  inquiryId: string;
}

export function InquiryThread({ inquiryId }: InquiryThreadProps) {
  const [data, setData] = useState<InquiryThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/inquiries/${encodeURIComponent(inquiryId)}`, {
        credentials: "include",
        cache: "no-store",
      });

      if (res.status === 404 || res.status === 403) {
        setNotFoundError(true);
        return;
      }

      if (!res.ok) {
        setError("문의를 불러오지 못했습니다.");
        return;
      }

      const json = (await res.json()) as InquiryThreadData;
      setData(json);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [inquiryId]);

  useEffect(() => {
    void fetchThread();
  }, [fetchThread]);

  // 404/403 처리
  if (notFoundError) {
    notFound();
  }

  return (
    <main id="main" className={loungeStyles.page}>
      <div className={loungeStyles.detailLayout}>
        {loading ? (
          <ThreadSkeleton />
        ) : error ? (
          <div className={styles.noReplies}>{error}</div>
        ) : data ? (
          <article className={loungeStyles.postDetail}>

            {/* ── 상세 헤더: 상태 배지 + 제목 + 메타 ── */}
            <header className={loungeStyles.detailHeader}>
              <div className={loungeStyles.detailCategoryRow}>
                <Badge tone={STATUS_TONE[data.inquiry.status]} variant="soft">
                  {STATUS_LABEL[data.inquiry.status]}
                </Badge>
              </div>

              <h1>{data.inquiry.title}</h1>

              <div className={loungeStyles.detailMeta}>
                <span>{formatDateTime(data.inquiry.createdAt)}</span>
              </div>
            </header>

            {/* ── 문의 원문 본문 ── */}
            <div className={loungeStyles.articleBody}>
              <TiptapRenderer content={data.inquiry.body} />
            </div>

            {/* ── 운영진 답변 스레드 (댓글 영역 자리, 일반 댓글 폼 없음) ── */}
            <section className={styles.repliesWrapper} aria-labelledby="reply-title">
              <h3 id="reply-title" className={styles.repliesSectionTitle}>
                {data.replies.length === 0
                  ? "답변 대기중"
                  : `운영진 답변 ${data.replies.length}건`}
              </h3>

              {data.replies.length === 0 ? (
                <div className={styles.noReplies}>
                  아직 운영진 답변이 없습니다. 빠른 시일 내에 답변드리겠습니다.
                </div>
              ) : (
                <div className={styles.repliesSection}>
                  {data.replies.map((reply) =>
                    reply.authorType === "admin" ? (
                      // 운영진 답변 — 전체폭 카드
                      <div key={reply.id} className={styles.adminReply}>
                        <div className={styles.adminBubble}>
                          <div className={styles.adminHeader}>
                            <span className={styles.adminLabel}>운영진</span>
                            <time className={styles.replyTime} dateTime={reply.createdAt}>
                              {formatDateTime(reply.createdAt)}
                            </time>
                          </div>
                          <div className={styles.adminBody}>
                            <TiptapRenderer content={reply.body} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      // 회원 메시지 — 우측
                      <div key={reply.id} className={styles.userReply}>
                        <div className={styles.userBubble}>
                          <div className={styles.userBody}>
                            <TiptapRenderer content={reply.body} />
                          </div>
                        </div>
                        <time
                          className={`${styles.replyTime} ${styles.userTimeRight}`}
                          dateTime={reply.createdAt}
                        >
                          {formatDateTime(reply.createdAt)}
                        </time>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>

            {/* ── 하단 목록 버튼 (게시판 상세 패턴) ── */}
            <footer className={loungeStyles.detailFooter}>
              <Link href="/inquiries" className={loungeStyles.listButton}>
                <Icon name="list-check" />
                목록으로
              </Link>
            </footer>
          </article>
        ) : null}
      </div>
    </main>
  );
}

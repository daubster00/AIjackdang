"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { Badge, Button, Card, Skeleton } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { TiptapRenderer } from "./TiptapRenderer";
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
  const router = useRouter();
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
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* 뒤로가기 */}
        <a
          href="/inquiries"
          className={styles.threadBack}
          onClick={(e) => {
            e.preventDefault();
            router.push("/inquiries");
          }}
          aria-label="문의 목록으로"
        >
          ← 문의 목록
        </a>

        {loading ? (
          <ThreadSkeleton />
        ) : error ? (
          <div className={styles.noReplies}>{error}</div>
        ) : data ? (
          <>
            {/* 스레드 헤더 */}
            <div className={styles.threadHeader}>
              <h1 className={styles.threadHeaderTitle}>{data.inquiry.title}</h1>
              <Badge tone={STATUS_TONE[data.inquiry.status]} variant="soft">
                {STATUS_LABEL[data.inquiry.status]}
              </Badge>
            </div>

            {/* 원문 카드 */}
            <Card className={styles.originalCard}>
              <p className={styles.originalMeta}>
                {formatDateTime(data.inquiry.createdAt)}
              </p>
              <div className={styles.originalBody}>
                <TiptapRenderer content={data.inquiry.body} />
              </div>
            </Card>

            {/* 답변 스레드 */}
            <div className={styles.repliesSection}>
              {data.replies.length === 0 ? (
                <div className={styles.noReplies}>
                  아직 운영진 답변이 없습니다. 빠른 시일 내에 답변드리겠습니다.
                </div>
              ) : (
                <>
                  <p className={styles.repliesSectionTitle}>
                    답변 {data.replies.length}건
                  </p>
                  {data.replies.map((reply) =>
                    reply.authorType === "admin" ? (
                      // 운영진 답변 — 좌측
                      <div key={reply.id} className={styles.adminReply}>
                        <div className={styles.adminBubble}>
                          <span className={styles.adminLabel}>운영진</span>
                          <div className={styles.adminBody}>
                            <TiptapRenderer content={reply.body} />
                          </div>
                        </div>
                        <time className={styles.replyTime} dateTime={reply.createdAt}>
                          {formatDateTime(reply.createdAt)}
                        </time>
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
                </>
              )}
            </div>

            {/* 하단 목록 버튼 */}
            <div style={{ marginTop: "var(--space-8)" }}>
              <Button variant="ghost" onClick={() => router.push("/inquiries")}>
                목록으로
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

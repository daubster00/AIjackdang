"use client";

// 작당 의뢰소 상세 페이지 클라이언트 컴포넌트.
// - 모집상태 낙관적 토글(작성자 본인 가정 시)
// - [쪽지 보내기] 슬롯 버튼 (alert mock)
// - 거래주의 고지 배너
// - 비회원 쪽지 보내기 게이팅

import Link from "next/link";
import { useState } from "react";
import { Avatar, AuthorName, Badge, Button, Icon, MessageModal } from "@/components/ui";
import { AttachmentList } from "@/components/board";
import { useMockAuth } from "@/hooks/useMockAuth";
import { type GigPost, type GigStatus } from "../page";
import styles from "../gigs.module.css";
import commentStyles from "../../lounge.module.css";
import { CommentForm } from "./CommentForm";

type Props = {
  post: GigPost;
};


export function GigDetailClient({ post }: Props) {
  const { user } = useMockAuth();

  // 모집상태: 클라이언트 낙관적 토글 state
  const [status, setStatus] = useState<GigStatus>(post.status);

  // 쪽지 보내기 모달 state
  const [dmOpen, setDmOpen] = useState(false);

  // 목업: 작성자 본인 여부 — 실제 구현 전까지는 로그인된 경우 본인으로 간주
  const isOwner = !!user;

  function handleDmClick() {
    if (!user) {
      alert("로그인 후 쪽지를 보낼 수 있습니다.");
      return;
    }
    // 로그인 상태면 쪽지 모달 오픈
    setDmOpen(true);
  }

  function toggleStatus() {
    setStatus((prev) => (prev === "모집중" ? "마감" : "모집중"));
  }

  const isClosed = status === "마감";

  return (
    <div className={styles.detailLayout}>
      <article className={styles.postDetail}>
        {/* ── 의뢰 정보 카드 ── */}
        <div className={styles.infoCard}>
          {/* 카드 헤더: 제목 + 배지 */}
          <div className={styles.infoCardHeader}>
            <div className={styles.infoCardTitle}>
              {/* 글유형 배지: 의뢰=info, 구직=success */}
              <Badge tone={post.type === "의뢰" ? "info" : "success"} variant="soft">
                {post.type}
              </Badge>
            </div>
            {/* 모집상태 배지: 목업 토글 state 반영 */}
            <div className={styles.infoBadgeRow}>
              <Badge
                tone={isClosed ? "neutral" : "success"}
                variant={isClosed ? "outline" : "soft"}
              >
                {status}
              </Badge>
              {/* 분야 배지들 */}
              {post.fields.map((f) => (
                <span key={f} className={styles.fieldChip}>{f}</span>
              ))}
            </div>
          </div>

          {/* 의뢰 정보 그리드 */}
          <div className={styles.infoGrid}>
            {post.budget && (
              <div className={styles.infoRow}>
                <span className={styles.infoRowLabel}>예산 / 희망단가</span>
                <span className={styles.infoRowValue}>{post.budget}</span>
              </div>
            )}
            {post.period && (
              <div className={styles.infoRow}>
                <span className={styles.infoRowLabel}>작업기간 / 마감</span>
                <span className={styles.infoRowValue}>{post.period}</span>
              </div>
            )}
            {/* 진행방식 (mock 데이터에서 있을 경우 표시) */}
            {"workStyle" in post && (post as GigPost & { workStyle?: string }).workStyle && (
              <div className={styles.infoRow}>
                <span className={styles.infoRowLabel}>진행방식</span>
                <span className={styles.infoRowValue}>
                  {(post as GigPost & { workStyle?: string }).workStyle}
                </span>
              </div>
            )}
            <div className={styles.infoRow}>
              <span className={styles.infoRowLabel}>연락방법</span>
              <span className={styles.infoRowValue}>사이트 쪽지</span>
            </div>
          </div>

          {/* 연락 액션 버튼 행 */}
          <div className={styles.contactActions}>
            {/* 쪽지 보내기 슬롯 버튼 */}
            <Button
              className={styles.dmButton}
              onClick={handleDmClick}
              leftIcon={<Icon name="mail-send-line" />}
            >
              쪽지 보내기
            </Button>

            {/* 본인만 노출: 모집상태 토글 */}
            {isOwner && (
              <button
                type="button"
                className={styles.statusToggle}
                onClick={toggleStatus}
                aria-label={`현재 ${status}. 클릭하면 ${isClosed ? "모집중" : "마감"}으로 변경`}
              >
                <Icon name="refresh-line" />
                {isClosed ? "모집중으로 변경" : "마감으로 변경"}
              </button>
            )}
          </div>
        </div>

        {/* ── 거래주의 고지 배너 ── */}
        <div className={styles.caution} role="note" aria-label="거래 주의 안내" style={{ marginBottom: "var(--space-5)" }}>
          <span className={styles.cautionIcon} aria-hidden="true">
            <Icon name="alert-line" />
          </span>
          <div className={styles.cautionText}>
            <strong>거래 보증 없음 · 직거래 사기 주의</strong>
            AI작당은 거래를 보증하지 않습니다. 직거래 시 사기에 주의하고, 선입금·계약은 신중히 진행하세요.
          </div>
        </div>

        {/* ── 글 헤더 ── */}
        <header className={styles.detailHeader}>
          <div className={styles.detailCategoryRow}>
            <span style={{ color: "var(--color-text-sub)", fontSize: "var(--font-size-sm)" }}>
              작당 의뢰소
            </span>
          </div>
          <h2>{post.title}</h2>
          <div className={styles.detailMeta}>
            <span>
              <Avatar name={post.author} size="sm" />
            </span>
            <AuthorName name={post.author} />
            <span>{post.date}</span>
            <span>조회 {post.views}</span>
            <span>댓글 {post.comments}</span>
          </div>
        </header>

        {/* ── 본문 ── */}
        <div className={styles.articleBody}>
          <p>{post.excerpt}</p>
          {/* 첨부파일 다운로드 영역 */}
          <AttachmentList />
        </div>

        {/* ── 댓글 영역 ── */}
        <section className={commentStyles.commentSection} aria-labelledby="gig-comment-title">
          <div className={commentStyles.commentHeader}>
            <h3 id="gig-comment-title">댓글 {post.comments}</h3>
          </div>

          {/* 댓글 작성 폼 */}
          <CommentForm />

        </section>

        {/* ── 상세 푸터 ── */}
        <footer className={styles.detailFooter}>
          <Link href="/lounge/gigs" className={styles.listButton}>
            <Icon name="list-check" />
            목록으로
          </Link>
          {/* 본인만 수정/삭제 노출 */}
          {isOwner && (
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

      {/* ── 쪽지 보내기 모달 (공용 컴포넌트) ── */}
      <MessageModal open={dmOpen} onClose={() => setDmOpen(false)} recipient={post.author} />
    </div>
  );
}

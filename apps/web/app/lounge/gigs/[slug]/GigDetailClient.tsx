"use client";

// 작당 의뢰소 상세 페이지 클라이언트 컴포넌트.
// Story 2.12: mock 타입 → API PostDetail + recruitPost 타입으로 교체.
// - 모집상태 낙관적 토글 (PATCH /api/v1/posts/:id/recruit-status)
// - [쪽지 보내기] 슬롯 버튼 (MessageModal)
// - 거래주의 고지 배너
// - 비회원 쪽지 보내기 게이팅

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, AuthorName, Badge, Button, Icon, MessageModal } from "@/components/ui";
import { AttachmentList } from "@/components/board";
import { useGating } from "@/hooks/useGating";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast/Toast";
import type { PostDetail } from "@ai-jakdang/contracts";
import styles from "../gigs.module.css";
import commentStyles from "../../lounge.module.css";
import { CommentForm } from "./CommentForm";

type RecruitStatus = "open" | "closed";

type Props = {
  post: PostDetail;
};

// 진행방식 한국어 매핑
const WORK_MODE_LABEL: Record<string, string> = {
  remote: "원격",
  onsite: "대면",
  hybrid: "혼합",
};

// post_kind 한국어 매핑
function postKindLabel(kind: string) {
  return kind === "request" ? "의뢰" : "구직";
}

export function GigDetailClient({ post }: Props) {
  const { user } = useAuth();
  const { requireAuth } = useGating();
  const { toast } = useToast();
  const router = useRouter();

  const recruitMeta = post.recruitPost;

  // 모집상태: 클라이언트 낙관적 토글 state
  const [recruitStatus, setRecruitStatus] = useState<RecruitStatus>(
    recruitMeta?.recruitStatus ?? "open",
  );
  const [toggling, setToggling] = useState(false);

  // 쪽지 보내기 모달 state
  const [dmOpen, setDmOpen] = useState(false);

  // 작성자 본인 여부: API isOwner 필드
  const isOwner = post.isOwner;

  // 자기 자신 여부 — 게시글 작성자가 본인이면 쪽지 불가
  const isSelf = isOwner;

  function handleDmClick() {
    if (!requireAuth("message")) return;
    if (isSelf) {
      toast({ tone: "warning", title: "자기 자신에게는 쪽지를 보낼 수 없습니다." });
      return;
    }
    setDmOpen(true);
  }

  async function toggleStatus() {
    if (toggling) return;

    const newStatus: RecruitStatus = recruitStatus === "open" ? "closed" : "open";
    // 낙관적 업데이트
    setRecruitStatus(newStatus);
    setToggling(true);

    try {
      const res = await fetch(`/api/v1/posts/${post.id}/recruit-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recruitStatus: newStatus }),
      });

      if (!res.ok) {
        // 롤백
        setRecruitStatus(recruitStatus);
        const data = (await res.json()) as { error?: { message?: string } };
        toast({ tone: "danger", title: data.error?.message ?? "모집상태 변경에 실패했습니다." });
        return;
      }

      // 성공 시 페이지 갱신 (서버 컴포넌트 데이터 재검증)
      router.refresh();
    } catch {
      // 롤백
      setRecruitStatus(recruitStatus);
      toast({ tone: "danger", title: "모집상태 변경에 실패했습니다. 잠시 후 다시 시도해주세요." });
    } finally {
      setToggling(false);
    }
  }

  const isClosed = recruitStatus === "closed";

  return (
    <div className={styles.detailLayout}>
      <article className={styles.postDetail}>
        {/* ── 의뢰 정보 카드 ── */}
        <div className={styles.infoCard}>
          {/* 카드 헤더: 제목 + 배지 */}
          <div className={styles.infoCardHeader}>
            <div className={styles.infoCardTitle}>
              {/* 글유형 배지: 의뢰=info, 구직=success */}
              {recruitMeta?.postKind && (
                <Badge tone={recruitMeta.postKind === "request" ? "info" : "success"} variant="soft">
                  {postKindLabel(recruitMeta.postKind)}
                </Badge>
              )}
            </div>
            {/* 모집상태 배지 + 분야 배지들 */}
            <div className={styles.infoBadgeRow}>
              <Badge
                tone={isClosed ? "neutral" : "success"}
                variant={isClosed ? "outline" : "soft"}
              >
                {isClosed ? "마감" : "모집중"}
              </Badge>
              {recruitMeta?.fields?.map((f) => (
                <span key={f} className={styles.fieldChip}>{f}</span>
              ))}
            </div>
          </div>

          {/* 의뢰 정보 그리드 */}
          {recruitMeta && (
            <div className={styles.infoGrid}>
              {recruitMeta.budget && (
                <div className={styles.infoRow}>
                  <span className={styles.infoRowLabel}>예산 / 희망단가</span>
                  <span className={styles.infoRowValue}>{recruitMeta.budget}</span>
                </div>
              )}
              {recruitMeta.duration && (
                <div className={styles.infoRow}>
                  <span className={styles.infoRowLabel}>작업기간 / 마감</span>
                  <span className={styles.infoRowValue}>{recruitMeta.duration}</span>
                </div>
              )}
              {recruitMeta.workMode && (
                <div className={styles.infoRow}>
                  <span className={styles.infoRowLabel}>진행방식</span>
                  <span className={styles.infoRowValue}>
                    {WORK_MODE_LABEL[recruitMeta.workMode] ?? recruitMeta.workMode}
                  </span>
                </div>
              )}
              <div className={styles.infoRow}>
                <span className={styles.infoRowLabel}>연락방법</span>
                <span className={styles.infoRowValue}>
                  {recruitMeta.contactMethod.types.join(", ")}
                  {recruitMeta.contactMethod.external && (
                    <span style={{ marginLeft: "var(--space-2)", color: "var(--color-text-sub)", fontSize: "var(--font-size-sm)" }}>
                      ({recruitMeta.contactMethod.external})
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* 연락 액션 버튼 행 */}
          <div className={styles.contactActions}>
            {/* 쪽지 보내기 슬롯 버튼 (Epic 7 FR-13 연계, 현재 MessageModal) */}
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
                disabled={toggling}
                aria-label={`현재 ${isClosed ? "마감" : "모집중"}. 클릭하면 ${isClosed ? "모집중" : "마감"}으로 변경`}
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
              <Avatar name={post.authorNickname ?? "익명"} src={post.authorAvatarUrl ?? undefined} size="sm" />
            </span>
            <AuthorName name={post.authorNickname ?? "탈퇴 회원"} authorId={post.authorId ?? undefined} />
            <span>{new Date(post.createdAt).toLocaleDateString("ko-KR")}</span>
            <span>조회 {post.viewCount}</span>
            <span>댓글 {post.commentCount}</span>
          </div>
        </header>

        {/* ── 본문 ── */}
        <div
          className={styles.articleBody}
          // contentHtml: 서버에서 Tiptap JSON → sanitize-html 변환 결과 (Story 2.6)
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {/* 첨부파일 다운로드 영역 */}
        <AttachmentList />

        {/* ── 댓글 영역 ── */}
        <section className={commentStyles.commentSection} aria-labelledby="gig-comment-title">
          <div className={commentStyles.commentHeader}>
            <h3 id="gig-comment-title">댓글 {post.commentCount}</h3>
          </div>

          {/* 댓글 작성 폼 */}
          <CommentForm targetType="post" targetId={post.id} />
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
              <Link href={`/lounge/gigs/write?edit=${post.id}`}>
                <button type="button">
                  <Icon name="edit-2-line" />
                  수정
                </button>
              </Link>
              <button type="button">
                <Icon name="delete-bin-line" />
                삭제
              </button>
            </div>
          )}
        </footer>
      </article>

      {/* ── 쪽지 보내기 모달 (공용 컴포넌트) ── */}
      {user && (
        <MessageModal
          open={dmOpen}
          onClose={() => setDmOpen(false)}
          recipient={post.authorNickname ?? ""}
        />
      )}
    </div>
  );
}

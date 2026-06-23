"use client";

/**
 * 실전자료 상세 클라이언트 컴포넌트 — Story 4.3
 *
 * 담당:
 * - 다운로드 버튼 상태: scan_status 기반 (pending=비활성, infected=숨김, clean=활성)
 * - 모바일 하단 고정 다운로드 바
 * - 작성자 [수정하기] / [삭제하기] 버튼
 * - Epic 5 슬롯: 좋아요/신고/북마크, 후기 댓글
 * - Story 4.7 슬롯: 평점 입력 (구현 완료)
 *
 * IMPORTANT: 이 파일은 Story 4.6(다운로드), 4.7(평점)이 UPDATE한다.
 * 슬롯 주석을 보존하라.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { RatingInput } from "@/components/ui/RatingInput";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useGatingContext } from "@/contexts/GatingContext";
import styles from "./resource-detail.module.css";

export type ScanStatus = "pending" | "clean" | "infected" | "error";

export interface ResourceFile {
  id: string;
  originalName: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  allowedExtension: string;
  isPrimary: boolean;
  scanStatus: ScanStatus;
  displayOrder: number;
}

export interface ResourceDetailClientProps {
  resourceId: string;
  resourceSlug: string;
  /** 대표 파일 (isPrimary=true) */
  primaryFile: ResourceFile | null;
  /** 첨부 파일 목록 (isPrimary=false) */
  attachmentFiles: ResourceFile[];
  /** 평점 평균 */
  avgRating: number;
  /** 평점 개수 */
  ratingCount: number;
  /** 작성자 본인 여부 */
  userIsOwner: boolean;
}

/** 파일 크기를 사람이 읽기 좋은 형식으로 변환 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** 평점을 별 5칸으로 그린다 */
function RatingStars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={`${styles.stars} ${className ?? ""}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name={n <= Math.round(rating) ? "star-fill" : "star-line"}
          className={n <= Math.round(rating) ? styles.starOn : styles.starOff}
        />
      ))}
    </span>
  );
}

/** 다운로드 버튼 — scan_status 기반 상태 처리 */
function DownloadButton({
  file,
  resourceId: _resourceId, // TODO: Story 4.6 — 실제 다운로드 핸들러에서 사용
  className,
}: {
  file: ResourceFile;
  resourceId: string;
  className?: string;
}) {
  if (file.scanStatus === "infected") {
    return (
      <span className={styles.downloadScanInfected}>
        <Icon name="shield-cross-line" />
        보안 검사 문제 발견
      </span>
    );
  }

  if (file.scanStatus === "pending" || file.scanStatus === "error") {
    return (
      <button type="button" className={className} disabled aria-disabled="true">
        <Icon name="loader-4-line" />
        검사 중
      </button>
    );
  }

  // clean — Story 4.6에서 실제 다운로드 연결
  return (
    <button
      type="button"
      className={className}
      // TODO: Story 4.6 — onClick에 다운로드 핸들러 연결
      aria-label={`${file.originalName} 다운로드`}
    >
      <Icon name="download-cloud-2-line" />
      다운로드
    </button>
  );
}

export function ResourceDetailClient({
  resourceId,
  resourceSlug,
  primaryFile,
  attachmentFiles,
  avgRating: initialAvgRating,
  ratingCount: initialRatingCount,
  userIsOwner,
}: ResourceDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { requireAuth } = useGatingContext();

  // ── 평점 상태 (SSR 데이터 초기값, API 응답으로 교체) ─────────────────────────
  const [avgRating, setAvgRating] = useState(initialAvgRating);
  const [ratingCount, setRatingCount] = useState(initialRatingCount);
  const [myRating, setMyRating] = useState<number>(0);
  const [ratingLoading, setRatingLoading] = useState(false);

  // ── 마운트 시 기존 평점 조회 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchMyRating = async () => {
      try {
        const res = await fetch(`/api/v1/resources/${resourceId}/ratings/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { id: string; score: number } | null;
          if (data) {
            setMyRating(data.score);
          }
        }
      } catch {
        // 조회 실패 시 조용히 무시 (미선택 상태 유지)
      }
    };

    void fetchMyRating();
  }, [resourceId, user]);

  // ── 별점 클릭 핸들러 ──────────────────────────────────────────────────────────
  const handleRatingChange = useCallback(
    async (score: number) => {
      // 비회원: 로그인 유도 모달
      if (!requireAuth("평점 등록")) return;

      setRatingLoading(true);
      const prevMyRating = myRating;
      const prevAvgRating = avgRating;
      const prevRatingCount = ratingCount;

      try {
        const res = await fetch(`/api/v1/resources/${resourceId}/ratings`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score }),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: { code?: string; message?: string } };
          const message = err.error?.message ?? "평점 등록에 실패했습니다.";
          toast({ tone: "danger", title: "평점 등록 실패", description: message });
          // 이전 상태 복원
          setMyRating(prevMyRating);
          setAvgRating(prevAvgRating);
          setRatingCount(prevRatingCount);
          return;
        }

        const data = (await res.json()) as {
          score: number;
          avgRating: number;
          ratingCount: number;
        };

        // 성공: 응답 값으로 즉시 갱신
        setMyRating(data.score);
        setAvgRating(data.avgRating);
        setRatingCount(data.ratingCount);

        toast({
          tone: "success",
          title: "평점이 등록되었습니다.",
          description: `${data.score}점을 남겼습니다.`,
        });
      } catch {
        toast({ tone: "danger", title: "평점 등록 실패", description: "잠시 후 다시 시도해 주세요." });
        setMyRating(prevMyRating);
        setAvgRating(prevAvgRating);
        setRatingCount(prevRatingCount);
      } finally {
        setRatingLoading(false);
      }
    },
    [requireAuth, myRating, avgRating, ratingCount, resourceId, toast],
  );

  const handleDelete = () => {
    // TODO: Story 4.8 — 확인 다이얼로그 + DELETE /api/v1/resources/:id 연결
    if (!confirm("자료를 삭제하시겠습니까?")) return;
    console.warn("[4.8 TODO] DELETE /api/v1/resources/" + resourceId);
  };

  return (
    <>
      {/* ── ② 다운로드 영역 ──────────────────────────────────────────────── */}
      {primaryFile && (
        <section className={styles.downloadPanel} aria-label="파일 다운로드">
          <div className={styles.downloadFile}>
            <span className={styles.downloadFileIcon}>
              <Icon
                name={
                  primaryFile.allowedExtension === "zip"
                    ? "folder-zip-line"
                    : primaryFile.allowedExtension === "pdf"
                      ? "file-pdf-line"
                      : "file-code-line"
                }
              />
            </span>
            <div className={styles.downloadFileText}>
              <strong className={styles.downloadFileName}>{primaryFile.originalName}</strong>
              <span className={styles.downloadFileMeta}>
                .{primaryFile.allowedExtension} · {formatFileSize(primaryFile.fileSize)}
              </span>
            </div>
          </div>

          {/* [다운로드] 슬롯 — Story 4.6에서 실제 다운로드 핸들러 연결 */}
          <DownloadButton
            file={primaryFile}
            resourceId={resourceId}
            className={styles.downloadAction}
          />
        </section>
      )}

      {/* 추가 첨부 파일 목록 */}
      {attachmentFiles.length > 0 && (
        <ul className={styles.attachmentList} aria-label="첨부 파일 목록">
          {attachmentFiles.map((file) => (
            <li key={file.id} className={styles.attachmentItem}>
              <Icon name="file-text-line" />
              <span>{file.originalName}</span>
              <span className={styles.downloadFileMeta}>{formatFileSize(file.fileSize)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* ── ⑦ 평점 영역 ──────────────────────────────────────────────────── */}
      <section
        className={`${styles.sectionCard} ${styles.reviewSection}`}
        aria-labelledby="rating-section-title"
      >
        <div className={styles.reviewSummary}>
          <div className={styles.reviewScore}>
            <strong>{avgRating > 0 ? avgRating.toFixed(1) : "–"}</strong>
            <RatingStars rating={avgRating} className={styles.reviewScoreStars} />
            <span className={styles.reviewScoreCount}>후기 {ratingCount}개</span>
          </div>

          {/* Story 4.7: 평점 입력 슬롯 — 구현 완료 */}
          <div data-slot="rating-input">
            <RatingInput
              value={myRating}
              onChange={!ratingLoading ? handleRatingChange : undefined}
              disabled={ratingLoading || !user}
              disabledLabel={!user ? "로그인 후 평점 등록" : "평점 등록 중..."}
            />
          </div>
        </div>

        <h2 id="rating-section-title" className={styles.sectionTitle}>
          후기 {ratingCount}
        </h2>

        {/* TODO: Epic 5 — 후기 댓글 목록 */}
        {/* Story 4.7 슬롯: 후기 댓글 목록 */}
        <div
          data-slot="review-comments"
          aria-label="후기 댓글 (Story 4.7 / Epic 5에서 활성화)"
          aria-disabled="true"
        />
      </section>

      {/* ── ⑧ 후기 댓글 슬롯 (Epic 5) ─────────────────────────────────────── */}
      {/* TODO: Epic 5 — 댓글 컴포넌트 */}
      <div
        data-slot="comments"
        aria-label="댓글 (Epic 5에서 활성화)"
        aria-disabled="true"
        style={{ display: "none" }}
      />

      {/* ── ⑨ 좋아요·신고·북마크 슬롯 (Epic 5) ──────────────────────────── */}
      <div className={styles.detailActions}>
        {/* TODO: Epic 5 — 북마크 토글 */}
        <button type="button" className={styles.detailActionBtn} aria-disabled="true">
          <Icon name="bookmark-line" />
          북마크
        </button>
        {/* TODO: Epic 5 — 공유 버튼 */}
        <button type="button" className={styles.detailActionBtn}>
          <Icon name="share-line" />
          공유
        </button>
        {/* TODO: Epic 5 — 신고 */}
        <button
          type="button"
          className={`${styles.detailActionBtn} ${styles.detailActionReport}`}
          aria-disabled="true"
        >
          <Icon name="flag-line" />
          신고
        </button>
      </div>

      {/* ── 작성자 버튼 (본인만) ────────────────────────────────────────────── */}
      {userIsOwner && (
        <div className={styles.ownerActions}>
          <button
            type="button"
            onClick={() => router.push(`/resources/${resourceSlug}/edit`)}
          >
            <Icon name="edit-2-line" />
            수정하기
          </button>
          {/* TODO: Story 4.8 — 삭제 확인 다이얼로그 + API 연결 */}
          <button type="button" onClick={handleDelete}>
            <Icon name="delete-bin-line" />
            삭제하기
          </button>
        </div>
      )}

      {/* ── 모바일 다운로드 고정 바 (AC #3) ────────────────────────────────── */}
      {primaryFile && (
        <div className={styles.downloadBarMobile} aria-label="다운로드 고정 바" role="complementary">
          <div className={styles.downloadBarMobileFile}>
            <strong>{primaryFile.originalName}</strong>
            <span>.{primaryFile.allowedExtension} · {formatFileSize(primaryFile.fileSize)}</span>
          </div>
          {/* [다운로드] 슬롯 — Story 4.6에서 실제 다운로드 핸들러 연결 */}
          <DownloadButton
            file={primaryFile}
            resourceId={resourceId}
            className={styles.downloadBarMobileBtn}
          />
        </div>
      )}
    </>
  );
}

"use client";

/**
 * 실전자료 상세 클라이언트 컴포넌트 — Story 4.3 (Story 4.6 UPDATE)
 *
 * 담당:
 * - 다운로드 버튼 상태: scan_status 기반 (pending=비활성, infected=숨김, clean=활성)
 * - 비회원 [다운로드] 클릭 → 로그인 유도 모달 (redirectTo에 ?download=true 포함)
 * - 회원 [다운로드] → POST /api/v1/resources/{id}/download → presigned URL → 자동 다운로드
 * - useEffect: ?download=true 또는 ?action=download → 마운트 시 자동 다운로드
 * - 모바일 하단 고정 다운로드 바
 * - 작성자 [수정하기] / [삭제하기] 버튼
 * - Epic 5 슬롯: 좋아요/신고/북마크, 후기 댓글
 * - Story 4.7 슬롯: 평점 입력
 *
 * IMPORTANT: 이 파일은 Story 4.7(평점)이 UPDATE한다.
 * 슬롯 주석을 보존하라.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui";
import { LoginGatingModal } from "@/components/ui/LoginGatingModal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast/Toast";
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

/**
 * presigned URL로 파일 다운로드를 트리거한다.
 * a 태그를 동적으로 생성해 클릭 후 즉시 제거한다.
 */
function triggerDownload(presignedUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = presignedUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** 다운로드 버튼 — scan_status 기반 상태 처리 (Story 4.6) */
function DownloadButton({
  file,
  onDownload,
  isDownloading,
  className,
}: {
  file: ResourceFile;
  onDownload: () => void;
  isDownloading: boolean;
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

  // clean — 다운로드 핸들러 연결
  return (
    <button
      type="button"
      className={className}
      onClick={onDownload}
      disabled={isDownloading}
      aria-label={`${file.originalName} 다운로드`}
    >
      <Icon name={isDownloading ? "loader-4-line" : "download-cloud-2-line"} />
      {isDownloading ? "다운로드 중..." : "다운로드"}
    </button>
  );
}

export function ResourceDetailClient({
  resourceId,
  resourceSlug,
  primaryFile,
  attachmentFiles,
  avgRating,
  ratingCount,
  userIsOwner,
}: ResourceDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isDownloading, setIsDownloading] = useState(false);
  const [gatingModalOpen, setGatingModalOpen] = useState(false);
  const autoDownloadTriggeredRef = useRef(false);

  // ── 대표 파일 다운로드 핸들러 ─────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    // 비회원: 로그인 유도 모달 (redirectTo에 ?download=true 포함)
    if (!user) {
      setGatingModalOpen(true);
      return;
    }

    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const res = await fetch(`/api/v1/resources/${resourceId}/download`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = data?.error?.code;
        if (code === "RESOURCE_SCAN_PENDING") {
          toast({ tone: "info", title: "파일 보안 검사가 진행 중입니다. 잠시 후 다시 시도해주세요." });
        } else if (code === "RESOURCE_INFECTED") {
          toast({ tone: "danger", title: "보안 검사에서 문제가 발견된 파일입니다." });
        } else if (code === "RESOURCE_SCAN_ERROR") {
          toast({ tone: "danger", title: "파일 보안 검사 오류가 발생했습니다. 관리자에게 문의해주세요." });
        } else if (res.status === 401) {
          setGatingModalOpen(true);
        } else {
          toast({ tone: "danger", title: "다운로드 중 오류가 발생했습니다." });
        }
        return;
      }

      const { url, fileName } = await res.json();
      triggerDownload(url, fileName);
      toast({ tone: "success", title: "다운로드가 시작됩니다." });
    } catch {
      toast({ tone: "danger", title: "다운로드 중 오류가 발생했습니다." });
    } finally {
      setIsDownloading(false);
    }
  }, [user, resourceId, isDownloading, toast]);

  // ── 자동 다운로드: ?download=true 또는 ?action=download 쿼리 파라미터 감지 ─────
  useEffect(() => {
    const shouldAutoDownload =
      searchParams.get("download") === "true" ||
      searchParams.get("action") === "download";

    if (
      shouldAutoDownload &&
      user &&
      primaryFile?.scanStatus === "clean" &&
      !autoDownloadTriggeredRef.current
    ) {
      autoDownloadTriggeredRef.current = true;
      handleDownload();
    }
  }, [searchParams, user, primaryFile, handleDownload]);

  const handleDelete = () => {
    // TODO: Story 4.8 — 확인 다이얼로그 + DELETE /api/v1/resources/:id 연결
    if (!confirm("자료를 삭제하시겠습니까?")) return;
    console.warn("[4.8 TODO] DELETE /api/v1/resources/" + resourceId);
  };

  // ── 비회원 게이팅 모달 (redirectTo: /resources/{slug}?download=true) ──────────
  // LoginGatingModal의 intendedAction을 사용하면 ?action=download 로 리다이렉트되므로
  // useEffect에서 ?action=download도 자동 다운로드로 처리한다.
  const gatingRedirectPath = `/resources/${resourceSlug}?download=true`;

  return (
    <>
      {/* 비회원 게이팅 모달 — redirectTo에 ?download=true 포함 */}
      <LoginGatingModal
        open={gatingModalOpen}
        onClose={() => setGatingModalOpen(false)}
        redirectOverride={gatingRedirectPath}
      />

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

          {/* [다운로드] 슬롯 — Story 4.6 실제 다운로드 핸들러 연결 완료 */}
          <DownloadButton
            file={primaryFile}
            onDownload={handleDownload}
            isDownloading={isDownloading}
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

          {/* TODO: Story 4.7 — RatingInput 컴포넌트 연결 (현재 슬롯만 유지) */}
          {/* Story 4.7 슬롯: 평점 입력 */}
          <div
            data-slot="rating-input"
            aria-label="평점 입력 (Story 4.7에서 활성화)"
            aria-disabled="true"
          />
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

      {/* ── 모바일 다운로드 고정 바 ────────────────────────────────────────── */}
      {primaryFile && (
        <div className={styles.downloadBarMobile} aria-label="다운로드 고정 바" role="complementary">
          <div className={styles.downloadBarMobileFile}>
            <strong>{primaryFile.originalName}</strong>
            <span>.{primaryFile.allowedExtension} · {formatFileSize(primaryFile.fileSize)}</span>
          </div>
          {/* [다운로드] 슬롯 — Story 4.6 실제 다운로드 핸들러 연결 완료 */}
          <DownloadButton
            file={primaryFile}
            onDownload={handleDownload}
            isDownloading={isDownloading}
            className={styles.downloadBarMobileBtn}
          />
        </div>
      )}
    </>
  );
}


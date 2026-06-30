"use client";

/**
 * AttachmentUpload — 공유 첨부파일 드롭존 컴포넌트 (관리자 전용)
 *
 * 디자인은 apps/web/components/board/PostWriteForm.tsx 의 파일 첨부 섹션을 기준으로
 * 관리자 디자인 시스템 토큰에 맞춰 포팅했다.
 *
 * 사용처:
 *   - apps/admin/app/resources/_components/ResourceForm.tsx (수정 모드 기존 파일 포함)
 *   - apps/admin/app/posts/_components/PostForm.tsx
 *
 * 허용 확장자·파일 크기·최대 개수는 모두 props로 주입하며,
 * 각 사용처에서 관리자 파일관리 설정(site_settings)을 읽어 전달한다.
 */

import { useRef, useState } from "react";
import styles from "./AttachmentUpload.module.css";

/** 수정 모드에서 이미 업로드된 파일 항목 */
export interface AttachmentExistingFile {
  id: string;
  /** 화면에 표시할 원본 파일명 */
  name: string;
  /** 파일 크기 (바이트). 없으면 크기 표시 생략. */
  size?: number;
}

export interface AttachmentUploadProps {
  /** 이번 세션에서 새로 추가된 파일 목록 */
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** 수정 모드: 이미 서버에 업로드된 파일 목록 */
  existingFiles?: AttachmentExistingFile[];
  /** 기존 파일 삭제 핸들러 — 없으면 삭제 버튼 숨김 */
  onDeleteExisting?: (id: string) => void;
  /**
   * 허용 확장자 목록. 점 포함/미포함 모두 수용한다.
   * 예: [".zip", "pdf", ".json"]
   * 기본값은 관리자 설정 미지정 시 대체값 (upload.service.ts 기본과 동일).
   */
  allowedExtensions?: string[];
  /** 최대 첨부 파일 수 (기존 파일 포함). 기본 3. */
  maxFiles?: number;
  /** 파일당 최대 크기(MB). 기본 50. */
  maxSizeMb?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeExt(ext: string): string {
  return ext.trim().replace(/^\./, "").toLowerCase();
}

export function AttachmentUpload({
  files,
  onFilesChange,
  existingFiles = [],
  onDeleteExisting,
  allowedExtensions = [".zip", ".docx", ".xlsx", ".pdf", ".md", ".txt", ".json"],
  maxFiles = 3,
  maxSizeMb = 50,
}: AttachmentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizedAllowed = allowedExtensions.map(normalizeExt);
  const maxBytes = maxSizeMb * 1024 * 1024;
  const acceptAttr = normalizedAllowed.map((e) => `.${e}`).join(",");
  const extHint = normalizedAllowed.map((e) => `.${e}`).join(", ");

  // 기존 파일 수를 고려한 잔여 슬롯
  const usedSlots = existingFiles.length + files.length;
  const remainingSlots = Math.max(0, maxFiles - existingFiles.length - files.length);
  const canAddMore = usedSlots < maxFiles;

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (next.length + existingFiles.length >= maxFiles) break;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!normalizedAllowed.includes(ext)) continue;
      if (file.size > maxBytes) continue;
      // 동일 파일명 중복 방지
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
    }
    onFilesChange(next);
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  return (
    <div>
      {/* 이미 업로드된 파일 목록 (수정 모드) */}
      {existingFiles.length > 0 && (
        <ul className={styles.fileList}>
          {existingFiles.map((f) => (
            <li key={f.id} className={styles.fileItem}>
              <i className={`ri-file-line ${styles.fileIcon}`} />
              <span className={styles.fileName}>{f.name}</span>
              {f.size !== undefined && (
                <span className={styles.fileSize}>{formatBytes(f.size)}</span>
              )}
              <span className={styles.existingBadge}>업로드됨</span>
              {onDeleteExisting && (
                <button
                  type="button"
                  className={styles.fileRemoveBtn}
                  aria-label={`${f.name} 삭제`}
                  onClick={() => onDeleteExisting(f.id)}
                >
                  <i className="ri-delete-bin-line" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 드롭존 — 슬롯이 남아 있을 때만 표시 */}
      {canAddMore && (
        <>
          <div
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
            style={existingFiles.length > 0 || files.length > 0 ? { marginTop: 12 } : undefined}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="파일 첨부 영역. 클릭하거나 파일을 끌어오세요"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <i className={`ri-upload-cloud-2-line ${styles.dropzoneIcon}`} />
            <p className={styles.dropzoneText}>클릭하거나 파일을 끌어다 놓으세요</p>
            <p className={styles.dropzoneHint}>
              {extHint} 지원 · 최대 {remainingSlots}개 추가 가능 · 파일당 최대 {maxSizeMb}MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptAttr}
            className={styles.hiddenInput}
            onChange={(e) => {
              addFiles(e.target.files);
              // 동일 파일 재선택을 허용하기 위해 value 초기화
              e.target.value = "";
            }}
            aria-hidden="true"
          />
        </>
      )}

      {/* 이번 세션에서 새로 추가된 파일 목록 */}
      {files.length > 0 && (
        <ul className={styles.fileList}>
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className={styles.fileItem}>
              <i className={`ri-file-line ${styles.fileIcon}`} />
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>{formatBytes(file.size)}</span>
              <button
                type="button"
                className={styles.fileRemoveBtn}
                aria-label={`${file.name} 제거`}
                onClick={() => removeFile(i)}
              >
                <i className="ri-close-line" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

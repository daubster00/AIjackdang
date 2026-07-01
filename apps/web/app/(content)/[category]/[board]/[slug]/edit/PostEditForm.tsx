"use client";

/**
 * 게시글 수정 폼 — Story 2.8
 *
 * 기존 PostWriteForm 패턴을 재사용하되 수정(PATCH) 전용으로 구성.
 * - 제목·본문·태그: 기존 데이터 pre-fill
 * - board: 읽기전용 표시 (수정 불가)
 * - 첨부파일: 기존 목록 표시·삭제 + 새 파일 추가 (합산 최대 5개 · 파일당 10MB)
 *   - 기존 첨부는 post.attachments에서 초기화. 삭제 버튼으로 제거 가능.
 *   - 새 파일은 POST /api/v1/posts/attachments 업로드 후 URL·메타 획득.
 *   - PATCH body에 항상 현재 유지 목록 전체를 attachments 배열로 전송 (updatePost가 전량 교체).
 * - 저장: PATCH /api/v1/posts/{id} → 성공 시 상세 페이지로 이동 + 성공 토스트
 * - 취소: router.back()
 */

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Icon } from "@/components/ui";
import { TagInput } from "@/components/ui/TagInput";
import { useToast } from "@/components/ui/Toast/Toast";
import { Editor } from "@/features/editor";
import type { PostDetail } from "@ai-jakdang/contracts";
import { useUploadConfig } from "@/hooks/useUploadConfig";
import styles from "@/components/board/PostWriteForm.module.css";

interface PostEditFormProps {
  post: PostDetail;
  /** 수정 완료 후 이동할 상세 페이지 경로 (예: "/vibe-coding/my-post-slug") */
  detailHref: string;
}

interface FormErrors {
  title?: string;
  body?: string;
}

/** 기존 첨부파일 (서버에서 내려온 것, size는 포맷된 문자열) */
interface ExistingAttachment {
  url: string;
  name: string;
  size: string; // 예: "2.4 MB"
}

/** 새로 추가할 로컬 파일 (제출 시 업로드) */
interface NewAttachedFile {
  file: File;
  name: string;
  size: string; // 표시용 포맷 문자열
  isImage: boolean;
}

/** POST /api/v1/posts/attachments 응답 — attachmentInputSchema 형식 */
interface UploadedAttachment {
  url: string;
  name: string;
  size: number; // bytes
  mimeType: string;
}

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 파일당 10MB

const validateTitle = (val: string): string | undefined =>
  val.trim().length < 2 ? "제목을 2자 이상 입력해 주세요." : undefined;

const validateBody = (val: JSONContent | undefined): string | undefined => {
  if (!val) return "본문을 입력해 주세요.";
  const hasText = val.content?.some((node) => {
    if (node.type === "paragraph" && node.content?.length) return true;
    if (node.content?.length) return true;
    return false;
  });
  return hasText ? undefined : "본문을 입력해 주세요.";
};

/** 포맷 문자열("2.4 MB", "512 KB" 등)을 바이트 수치로 역변환한다. */
function parseFileSizeToBytes(sizeStr: string): number {
  const m = sizeStr.trim().match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  if (u === "B") return Math.round(n);
  if (u === "KB") return Math.round(n * 1024);
  if (u === "MB") return Math.round(n * 1024 * 1024);
  return Math.round(n * 1024 * 1024 * 1024);
}

/** 파일 확장자로 MIME 타입을 추정한다 (기존 첨부 보존 시 mimeType 대체용). */
function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    zip: "application/zip",
    "7z": "application/x-7z-compressed",
    rar: "application/x-rar-compressed",
    json: "application/json",
    md: "text/markdown",
    txt: "text/plain",
    csv: "text/csv",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext] ?? "application/octet-stream";
}

/** 파일명 확장자로 아이콘 이름을 선택한다. */
function iconForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image-line";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "file-zip-line";
  if (["pdf"].includes(ext)) return "file-pdf-line";
  if (["doc", "docx", "txt", "md", "hwp"].includes(ext)) return "file-text-line";
  return "file-line";
}

export function PostEditForm({ post, detailHref }: PostEditFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { fileExtensions, toAccept } = useUploadConfig();

  const [title, setTitle] = useState(post.title);
  const [titleTouched, setTitleTouched] = useState(false);
  const [tags, setTags] = useState<string[]>(post.tags ?? []);
  const [contentJson, setContentJson] = useState<JSONContent | undefined>(
    post.contentJson as JSONContent | undefined,
  );
  const [contentTouched, setContentTouched] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── 첨부파일 상태 ────────────────────────────────────────────────────────────
  /** 기존 첨부파일 목록 (post.attachments에서 초기화, 삭제 버튼으로 제거) */
  const [existingAttachments, setExistingAttachments] = useState<ExistingAttachment[]>(
    (post.attachments ?? []).map((att) => ({
      url: att.url,
      name: att.name,
      size: att.size,
    })),
  );
  /** 새로 추가할 파일 (제출 시 업로드) */
  const [newFiles, setNewFiles] = useState<NewAttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalCount = existingAttachments.length + newFiles.length;

  // ── 새 파일 선택 핸들러 ──────────────────────────────────────────────────────
  const handleFileSelect = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const remaining = MAX_FILES - totalCount;
      if (remaining <= 0) {
        toast({ tone: "warning", title: `첨부파일은 최대 ${MAX_FILES}개까지 가능합니다.` });
        return;
      }
      const picked = Array.from(fileList);
      const tooLarge = picked.filter((f) => f.size > MAX_FILE_BYTES);
      if (tooLarge.length > 0) {
        toast({
          tone: "warning",
          title: "파일이 너무 큽니다",
          description: `${tooLarge.map((f) => f.name).join(", ")} — 파일당 최대 10MB`,
        });
      }
      const added: NewAttachedFile[] = picked
        .filter((f) => f.size <= MAX_FILE_BYTES)
        .slice(0, remaining)
        .map((f) => ({
          file: f,
          name: f.name,
          size:
            f.size < 1024 * 1024
              ? `${(f.size / 1024).toFixed(1)} KB`
              : `${(f.size / 1024 / 1024).toFixed(1)} MB`,
          isImage: f.type.startsWith("image/"),
        }));
      if (added.length > 0) {
        setNewFiles((prev) => [...prev, ...added].slice(0, MAX_FILES - existingAttachments.length));
      }
    },
    [totalCount, existingAttachments.length, toast],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect],
  );

  // ── 폼 제출 ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const titleErr = validateTitle(title);
      const bodyErr = validateBody(contentJson);

      if (titleErr || bodyErr) {
        setErrors({ title: titleErr, body: bodyErr });
        setTitleTouched(true);
        setContentTouched(true);
        toast({ tone: "warning", title: titleErr ?? bodyErr ?? "입력 내용을 확인해 주세요." });
        return;
      }

      setIsSubmitting(true);

      try {
        // ── 1) 새 파일 업로드 (있을 때만) ────────────────────────────────────
        let uploadedAttachments: UploadedAttachment[] = [];
        if (newFiles.length > 0) {
          const fd = new FormData();
          for (const f of newFiles) fd.append("files", f.file);
          const upRes = await fetch("/api/v1/posts/attachments", {
            method: "POST",
            credentials: "include",
            body: fd,
          });
          if (upRes.status === 401) {
            toast({ tone: "danger", title: "로그인 후 이용해 주세요." });
            router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
            return;
          }
          if (!upRes.ok) {
            const data = (await upRes.json().catch(() => null)) as {
              error?: { message?: string };
            } | null;
            toast({
              tone: "danger",
              title: "첨부파일 업로드 실패",
              description: data?.error?.message ?? "허용되지 않는 파일이거나 용량을 초과했습니다.",
            });
            return;
          }
          const upData = (await upRes.json()) as { files: UploadedAttachment[] };
          uploadedAttachments = upData.files;
        }

        // ── 2) 기존 첨부를 attachmentInputSchema 형식으로 변환 ────────────────
        // updatePost는 attachments !== undefined면 전량 교체하므로, 유지할 기존 목록도 포함해야 한다.
        // 서버가 size를 포맷 문자열로 내려보내므로 바이트 수치로 역변환하고, mimeType은 확장자로 추정.
        const preservedAttachments = existingAttachments.map((att) => ({
          url: att.url,
          name: att.name,
          size: parseFileSizeToBytes(att.size),
          mimeType: guessMimeType(att.name),
        }));

        // ── 3) PATCH — 항상 attachments 포함 (미전송 시 기존 보존, 전송 시 전량 교체) ──
        const allAttachments = [...preservedAttachments, ...uploadedAttachments];

        const res = await fetch(`/api/v1/posts/${post.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: title.trim(),
            contentJson: contentJson ?? { type: "doc", content: [] },
            tags,
            attachments: allAttachments,
          }),
        });

        if (res.status === 401) {
          toast({ tone: "danger", title: "로그인이 필요합니다." });
          router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
          return;
        }

        if (res.status === 403) {
          toast({ tone: "danger", title: "수정 권한이 없습니다." });
          return;
        }

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          toast({
            tone: "danger",
            title: "수정 실패",
            description: data?.error?.message ?? "잠시 후 다시 시도해 주세요.",
          });
          return;
        }

        toast({ tone: "success", title: "수정되었습니다." });
        router.push(detailHref);
      } catch {
        toast({
          tone: "danger",
          title: "네트워크 오류",
          description: "잠시 후 다시 시도해 주세요.",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [title, contentJson, tags, existingAttachments, newFiles, post.id, detailHref, router, toast],
  );

  return (
    <div className={styles.writeLayout}>
      <form className={styles.writeCard} onSubmit={handleSubmit}>
        {/* 게시판 읽기전용 표시 */}
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>게시판</span>
          <span style={{ padding: "var(--space-2) 0", color: "var(--color-text-sub)", fontSize: "var(--font-size-sm)" }}>
            {post.board}
          </span>
        </div>

        {/* 제목 */}
        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabelRow}>
            <label className={styles.fieldLabel} htmlFor="edit-post-title">
              제목 <span className={styles.required}>*</span>
            </label>
            <span className={styles.titleCount}>{title.length}/100</span>
          </div>
          <input
            id="edit-post-title"
            className={`${styles.titleInput} ${titleTouched && errors.title ? styles.inputError : ""}`}
            type="text"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleTouched) {
                setErrors((prev) => ({ ...prev, title: validateTitle(e.target.value) }));
              }
            }}
            onBlur={() => {
              setTitleTouched(true);
              setErrors((prev) => ({ ...prev, title: validateTitle(title) }));
            }}
            maxLength={100}
          />
          {titleTouched && errors.title && (
            <p className={styles.errorMsg} role="alert">
              {errors.title}
            </p>
          )}
        </div>

        {/* 본문 에디터 */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            본문 <span className={styles.required}>*</span>
          </label>
          <Editor
            preset="full"
            value={contentJson}
            onChange={(val) => {
              setContentJson(val);
              if (contentTouched) {
                setErrors((prev) => ({ ...prev, body: validateBody(val) }));
              }
            }}
            placeholder="내용을 입력하세요."
          />
          {contentTouched && errors.body && (
            <p className={styles.errorMsg} role="alert">
              {errors.body}
            </p>
          )}
        </div>

        {/* 태그 */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            태그{" "}
            <span className={styles.fieldHint}>(최대 10개 · Enter 또는 쉼표로 추가)</span>
          </label>
          <TagInput
            value={tags}
            onChange={setTags}
            placeholder="태그를 입력하세요"
            suggestedTags={[]}
          />
        </div>

        {/* 파일 첨부 */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            파일 첨부{" "}
            <span className={styles.fieldHint}>(최대 {MAX_FILES}개 · 파일당 최대 10MB)</span>
          </label>

          {/* 현재 첨부파일 통합 목록 (기존 + 새 파일) */}
          {(existingAttachments.length > 0 || newFiles.length > 0) && (
            <ul className={styles.fileList}>
              {existingAttachments.map((att) => (
                <li key={`existing-${att.url}`} className={styles.fileItem}>
                  <Icon name={iconForName(att.name)} className={styles.fileIcon} />
                  <span className={styles.fileName}>{att.name}</span>
                  <span className={styles.fileSize}>{att.size}</span>
                  <button
                    type="button"
                    className={styles.fileRemoveBtn}
                    aria-label={`${att.name} 삭제`}
                    onClick={() =>
                      setExistingAttachments((prev) => prev.filter((a) => a.url !== att.url))
                    }
                  >
                    <Icon name="close-line" />
                  </button>
                </li>
              ))}
              {newFiles.map((file, i) => (
                <li key={`new-${i}`} className={styles.fileItem}>
                  <Icon
                    name={file.isImage ? "image-line" : "file-line"}
                    className={styles.fileIcon}
                  />
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.fileSize}>{file.size}</span>
                  <button
                    type="button"
                    className={styles.fileRemoveBtn}
                    aria-label={`${file.name} 삭제`}
                    onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Icon name="close-line" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 새 파일 추가 드롭존 — 총 5개 미만일 때만 노출 */}
          {totalCount < MAX_FILES && (
            <>
              <div
                className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="파일 추가 영역. 클릭하거나 파일을 끌어오세요"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <Icon name="upload-cloud-2-line" className={styles.dropzoneIcon} />
                <p className={styles.dropzoneText}>클릭하거나 파일을 끌어다 놓으세요</p>
                <p className={styles.dropzoneHint}>
                  {fileExtensions.join(", ")} 지원 (허용 형식은 운영자 설정 기준)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={toAccept(fileExtensions)}
                className={styles.hiddenInput}
                onChange={(e) => handleFileSelect(e.target.files)}
                aria-hidden="true"
              />
            </>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className={styles.formActions}>
          <div className={styles.formActionsLeft} />
          <div className={styles.formActionsRight}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => router.back()}
            >
              취소
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
            >
              <Icon name="save-line" />
              {isSubmitting ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

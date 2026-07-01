"use client";

/**
 * 질문 수정 클라이언트 컴포넌트 — Story 3.8
 *
 * PATCH /api/v1/qna/questions/:id 를 호출하여 질문을 수정한다.
 * QuestionWriteClient 패턴을 그대로 따르되,
 * - POST → PATCH 엔드포인트 변경
 * - 초기값(기존 제목·본문·태그) prefill
 * - 임시저장 버튼 없음 (수정 전용)
 * - 성공 시 /questions/{slug} 로 리다이렉트 + 성공 토스트
 */

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Icon } from "@/components/ui";
import { TagInput } from "@/components/ui/TagInput";
import { useToast } from "@/components/ui/Toast/Toast";
import { Editor } from "@/features/editor";
import { useUploadConfig } from "@/hooks/useUploadConfig";
import styles from "@/components/board/PostWriteForm.module.css";

const MAX_FILES = 5;

interface AttachedFile {
  name: string;
  size: string;
  isImage: boolean;
}

/** 인라인 검증 오류 */
interface FormErrors {
  title?: string;
  body?: string;
}

const SUGGESTED_TAGS = [
  "ClaudeCode", "Cursor", "n8n", "MCP", "바이브코딩",
  "자동화", "프롬프트", "수익화", "입문", "React",
  "PHP", "배포", "외주", "Make", "Zapier",
];

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

interface QuestionEditClientProps {
  questionId: string;
  questionSlug: string;
  initialTitle: string;
  initialContentJson: Record<string, unknown>;
  initialTags: string[];
}

export function QuestionEditClient({
  questionId,
  questionSlug,
  initialTitle,
  initialContentJson,
  initialTags,
}: QuestionEditClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { fileExtensions, toAccept } = useUploadConfig();

  const [title, setTitle] = useState(initialTitle);
  const [titleTouched, setTitleTouched] = useState(false);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [contentJson, setContentJson] = useState<JSONContent | undefined>(
    initialContentJson as JSONContent | undefined,
  );
  const [contentTouched, setContentTouched] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 수정 저장 ─────────────────────────────────────────────────────────────
  const submitEdit = useCallback(async () => {
    const titleErr = validateTitle(title);
    const bodyErr = validateBody(contentJson);

    if (titleErr || bodyErr) {
      setErrors({ title: titleErr, body: bodyErr });
      setTitleTouched(true);
      setContentTouched(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/v1/qna/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          contentJson: contentJson ?? { type: "doc", content: [] },
          tags,
        }),
      });

      if (res.status === 401) {
        toast({ tone: "danger", title: "로그인이 필요합니다." });
        router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      if (res.status === 403) {
        toast({ tone: "danger", title: "질문 작성자만 수정할 수 있습니다." });
        router.push(`/questions/${questionSlug}`);
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

      toast({ tone: "success", title: "질문이 수정되었습니다." });
      router.push(`/questions/${questionSlug}`);
    } catch {
      toast({
        tone: "danger",
        title: "네트워크 오류",
        description: "잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [contentJson, questionId, questionSlug, router, tags, title, toast]);

  // ── 파일 첨부 (Epic 4 파일 업로드 구현 전 로컬 미리보기만) ──────────────────
  const handleFileSelect = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const remaining = MAX_FILES - files.length;
      if (remaining <= 0) return;
      const newFiles: AttachedFile[] = Array.from(fileList)
        .slice(0, remaining)
        .map((f) => ({
          name: f.name,
          size:
            f.size < 1024 * 1024
              ? `${(f.size / 1024).toFixed(1)} KB`
              : `${(f.size / 1024 / 1024).toFixed(1)} MB`,
          isImage: f.type.startsWith("image/"),
        }));
      setFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES));
    },
    [files.length],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect],
  );

  // ── 폼 submit ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void submitEdit();
    },
    [submitEdit],
  );

  return (
    <div className={styles.writeLayout}>
      <form className={styles.writeCard} onSubmit={handleSubmit}>
        {/* 게시판 헤더 */}
        <header className={styles.cardHead}>
          <div className={styles.cardHeadTop}>
            <span className={styles.boardBadge}>
              <Icon name="question-answer-line" />
              묻고답하기
            </span>
          </div>
          <h1 className={styles.cardTitle}>질문 수정</h1>
          <p className={styles.cardSub}>
            질문의 제목·내용·태그를 수정합니다.
          </p>
        </header>

        {/* 제목 */}
        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabelRow}>
            <label className={styles.fieldLabel} htmlFor="question-edit-title">
              질문 제목 <span className={styles.required}>*</span>
            </label>
            <span className={styles.titleCount}>{title.length}/100</span>
          </div>
          <input
            id="question-edit-title"
            className={`${styles.titleInput} ${titleTouched && errors.title ? styles.inputError : ""}`}
            type="text"
            placeholder="핵심을 한 문장으로 — 예: Claude Code가 PHP 구조를 잘못 이해할 때 컨텍스트 잡는 법?"
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

        {/* 본문 에디터 — Tiptap full preset */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            질문 내용 <span className={styles.required}>*</span>
          </label>
          <Editor
            preset="full"
            value={initialContentJson as JSONContent}
            onChange={(val) => {
              setContentJson(val);
              if (contentTouched) {
                setErrors((prev) => ({ ...prev, body: validateBody(val) }));
              }
            }}
            placeholder="질문 내용을 입력하세요. 코드, 에러 메시지, 스크린샷을 함께 올리면 답변받기 쉬워요."
          />
          {contentTouched && errors.body && (
            <p className={styles.errorMsg} role="alert">
              {errors.body}
            </p>
          )}
        </div>

        {/* 태그 — TagInput 컴포넌트 (API 자동완성 + 자유 입력) */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            태그{" "}
            <span className={styles.fieldHint}>(최대 10개 · Enter 또는 쉼표로 추가)</span>
          </label>
          <TagInput
            value={tags}
            onChange={setTags}
            placeholder="주제 태그를 입력하세요 (예: ClaudeCode)"
            suggestedTags={SUGGESTED_TAGS}
          />
        </div>

        {/* 파일 첨부 */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            파일 첨부{" "}
            <span className={styles.fieldHint}>(최대 {MAX_FILES}개 · 파일당 최대 10MB)</span>
          </label>
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
            aria-label="파일 첨부 영역. 클릭하거나 파일을 끌어오세요"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <Icon name="upload-cloud-2-line" className={styles.dropzoneIcon} />
            <p className={styles.dropzoneText}>
              에러 로그·스크린샷을 끌어다 놓거나 클릭해서 선택하세요
            </p>
            <p className={styles.dropzoneHint}>
              jpg, png, gif, {fileExtensions.join(", ")} 지원 (허용 형식은 운영자 설정 기준)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={`image/*,${toAccept(fileExtensions)}`}
            className={styles.hiddenInput}
            onChange={(e) => handleFileSelect(e.target.files)}
            aria-hidden="true"
          />
          {files.length > 0 && (
            <ul className={styles.fileList}>
              {files.map((file, i) => (
                <li key={i} className={styles.fileItem}>
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
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Icon name="close-line" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className={styles.formActions}>
          <div className={styles.formActionsLeft} />
          <div className={styles.formActionsRight}>
            <a href={`/questions/${questionSlug}`} className={styles.cancelBtn}>
              취소
            </a>
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

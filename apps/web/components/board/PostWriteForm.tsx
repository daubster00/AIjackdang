"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import type { CreativeSpec } from "@ai-jakdang/contracts";
import { Icon } from "@/components/ui";
import { TagInput } from "@/components/ui/TagInput";
import { useToast } from "@/components/ui/Toast/Toast";
import { Editor } from "@/features/editor";
import styles from "./PostWriteForm.module.css";

/**
 * 게시판 글쓰기 폼 (공용) — Story 2.7에서 실 API 연동.
 *
 * 바이브코딩/묻고답하기 등 모든 게시판이 이 컴포넌트 하나를 공유한다.
 * 에디터·태그·파일첨부 등 기능을 한 곳에서 고치면 모든 게시판에 반영된다.
 * 게시판마다 다른 문구/링크/추천태그 등은 config prop으로만 주입한다.
 *
 * 하위 호환 유지:
 * - `PostWriteFormConfig` 인터페이스 모든 기존 필드 보존.
 * - `submitAlert` 는 deprecated 되었으나 타입에 남겨 기존 페이지가 에러 없이 빌드되도록 함.
 * - `board` 필드: 실제 API 호출에 필요. 기존 config 에 없던 경우 필수로 추가됨.
 */
export type PostWriteFormConfig = {
  /** 상단 헤더(배지+제목+설명). 없으면 헤더를 그리지 않는다. */
  header?: {
    badgeIcon: string;
    badgeLabel: string;
    title: string;
    description: string;
  };
  /** 작성 가이드 팁 박스. 없으면 그리지 않는다. */
  tip?: {
    title: string;
    items: string[];
  };
  titleLabel: string;
  titlePlaceholder: string;
  /** 제목 input의 id (label 연결용). 기본 "post-title" */
  titleInputId?: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  /** 태그가 없을 때 보일 입력 placeholder */
  tagPlaceholder: string;
  suggestedTags: string[];
  dropzoneText: string;
  cancelHref: string;
  submitLabel: string;
  /** 제출 버튼 좌측 아이콘(선택) */
  submitIcon?: string;
  /**
   * @deprecated Story 2.7에서 실 API 연동으로 대체됨.
   * 하위 호환을 위해 필드는 유지되나 더 이상 alert 로 사용하지 않는다.
   */
  submitAlert?: string;
  /**
   * 게시판 슬러그 (예: "vibe-coding", "lounge").
   * POST /api/v1/posts 에 필수. 작성 페이지가 주입한다.
   */
  board: string;
  /**
   * 등록 성공 후 리다이렉트할 기본 경로 prefix.
   * 기본: `/${board}` → 실제 slug 가 붙으면 `/${board}/${slug}` 로 이동.
   * (category 가 있을 때: `/${category}/${board}/${slug}`)
   */
  boardHref?: string;
  /**
   * Story 2.11: AI 창작마당 창작 스펙.
   * CreativeSpecFields에서 수집한 스펙 데이터를 주입하면 POST body에 포함된다.
   * board='ai-creation' 이외에서는 무시.
   */
  creativeSpec?: CreativeSpec | null;
};

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

export function PostWriteForm({ config }: { config: PostWriteFormConfig }) {
  const router = useRouter();
  const { toast } = useToast();

  const titleInputId = config.titleInputId ?? "post-title";

  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [contentJson, setContentJson] = useState<JSONContent | undefined>(undefined);
  const [contentTouched, setContentTouched] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 검증 ───────────────────────────────────────────────────────────────────
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

  // ── API 호출 ───────────────────────────────────────────────────────────────
  const submitPost = useCallback(
    async (status: "published" | "draft") => {
      const isDraft = status === "draft";

      // draft 일 때는 제목만 최소 검증
      const titleErr = validateTitle(title);
      const bodyErr = isDraft ? undefined : validateBody(contentJson);

      if (titleErr || bodyErr) {
        setErrors({ title: titleErr, body: bodyErr });
        setTitleTouched(true);
        if (!isDraft) setContentTouched(true);
        return;
      }

      const setter = isDraft ? setIsSavingDraft : setIsSubmitting;
      setter(true);

      try {
        const postBody: Record<string, unknown> = {
          board: config.board,
          title: title.trim(),
          contentJson: contentJson ?? { type: "doc", content: [] },
          tags,
          status,
        };

        // Story 2.11: AI 창작마당에서만 creativeSpec 포함
        if (config.board === "ai-creation" && config.creativeSpec) {
          postBody.creativeSpec = config.creativeSpec;
        }

        const res = await fetch("/api/v1/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(postBody),
        });

        if (res.status === 401) {
          toast({ tone: "danger", title: "로그인이 필요합니다." });
          router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
          return;
        }

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          toast({
            tone: "danger",
            title: isDraft ? "임시저장 실패" : "등록 실패",
            description: data?.error?.message ?? "잠시 후 다시 시도해 주세요.",
          });
          return;
        }

        const data = (await res.json()) as {
          id: string;
          slug: string;
          board: string;
          category: string | null;
        };

        if (isDraft) {
          toast({ tone: "success", title: "임시저장되었습니다." });
        } else {
          // 등록 성공 → 상세 페이지로 이동
          const base = config.boardHref ?? `/${data.board}`;
          router.push(`${base}/${data.slug}`);
        }
      } catch {
        toast({
          tone: "danger",
          title: "네트워크 오류",
          description: "잠시 후 다시 시도해 주세요.",
        });
      } finally {
        setter(false);
      }
    },
    [config.board, config.boardHref, config.creativeSpec, contentJson, router, tags, title, toast],
  );

  // ── 파일 첨부 (Epic 4 파일 업로드 구현 전 로컬 미리보기만) ─────────────────
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

  // ── 폼 submit ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void submitPost("published");
    },
    [submitPost],
  );

  const handleDraftSave = useCallback(() => {
    void submitPost("draft");
  }, [submitPost]);

  return (
    <div className={styles.writeLayout}>
      <form className={styles.writeCard} onSubmit={handleSubmit}>
        {/* 게시판 헤더 (배지 + 제목 + 설명) — config.header 있을 때만 */}
        {config.header && (
          <header className={styles.cardHead}>
            <div className={styles.cardHeadTop}>
              <span className={styles.boardBadge}>
                <Icon name={config.header.badgeIcon} />
                {config.header.badgeLabel}
              </span>
            </div>
            <h1 className={styles.cardTitle}>{config.header.title}</h1>
            <p className={styles.cardSub}>{config.header.description}</p>
          </header>
        )}

        {/* 작성 가이드 팁 박스 — config.tip 있을 때만 */}
        {config.tip && (
          <aside className={styles.tipBox}>
            <Icon name="lightbulb-line" className={styles.tipIcon} aria-hidden="true" />
            <div className={styles.tipBody}>
              <p className={styles.tipTitle}>{config.tip.title}</p>
              <ul className={styles.tipList}>
                {config.tip.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        {/* 제목 */}
        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabelRow}>
            <label className={styles.fieldLabel} htmlFor={titleInputId}>
              {config.titleLabel} <span className={styles.required}>*</span>
            </label>
            <span className={styles.titleCount}>{title.length}/100</span>
          </div>
          <input
            id={titleInputId}
            className={`${styles.titleInput} ${titleTouched && errors.title ? styles.inputError : ""}`}
            type="text"
            placeholder={config.titlePlaceholder}
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

        {/* 본문 에디터 — Tiptap full preset (Story 2.5) */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            {config.bodyLabel} <span className={styles.required}>*</span>
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
            placeholder={config.bodyPlaceholder}
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
            placeholder={config.tagPlaceholder}
            suggestedTags={config.suggestedTags}
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
            <p className={styles.dropzoneText}>{config.dropzoneText}</p>
            <p className={styles.dropzoneHint}>
              jpg, png, gif, pdf, zip, md, txt, json, docx, xlsx 지원
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.zip,.md,.txt,.json,.docx,.xlsx"
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
          <div className={styles.formActionsLeft}>
            <button
              type="button"
              className={styles.draftBtn}
              onClick={handleDraftSave}
              disabled={isSavingDraft || isSubmitting}
            >
              <Icon name="save-line" />
              {isSavingDraft ? "저장 중…" : "임시저장"}
            </button>
          </div>
          <div className={styles.formActionsRight}>
            <a href={config.cancelHref} className={styles.cancelBtn}>
              취소
            </a>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || isSavingDraft}
            >
              {config.submitIcon && <Icon name={config.submitIcon} />}
              {isSubmitting ? "등록 중…" : config.submitLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

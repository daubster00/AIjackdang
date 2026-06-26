"use client";

/**
 * 질문 작성 클라이언트 컴포넌트 — Story 3.3
 *
 * POST /api/v1/qna/questions 를 호출하여 질문을 등록·임시저장한다.
 * 기존 PostWriteForm 의 UI/UX 패턴을 그대로 따르되,
 * board 대신 questions 전용 엔드포인트를 사용한다.
 *
 * 초기값(draft 복원):
 *   서버 컴포넌트(page.tsx)가 GET /api/v1/qna/questions/draft 로 조회한
 *   draft를 initialDraft prop으로 받아 폼에 주입한다.
 *
 * 성공 후 리다이렉트: /questions/{slug}
 */

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Icon } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TagInput } from "@/components/ui/TagInput";
import { useToast } from "@/components/ui/Toast/Toast";
import { Editor } from "@/features/editor";
import { useAuth } from "@/hooks/useAuth";
import styles from "@/components/board/PostWriteForm.module.css";

/** 드래프트 초기값 (서버에서 주입) */
export interface DraftInitialValue {
  id: string;
  title: string;
  contentJson: Record<string, unknown>;
  tags: string[];
}

interface QuestionWriteClientProps {
  initialDraft?: DraftInitialValue | null;
  /**
   * URL ?tags= 쿼리에서 파싱된 초기 태그 배열 (Story 3.4).
   * draft 태그가 있으면 draft 태그를 우선, 없으면 urlTags를 초기값으로 사용한다.
   * 사용자가 자유롭게 수정·삭제·추가 가능 (강제 고정 아님).
   */
  urlTags?: string[];
}

/** 인라인 검증 오류 */
interface FormErrors {
  title?: string;
  body?: string;
}

const MAX_FILES = 5;

interface AttachedFile {
  name: string;
  size: string;
  isImage: boolean;
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

export function QuestionWriteClient({ initialDraft, urlTags = [] }: QuestionWriteClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [titleTouched, setTitleTouched] = useState(false);
  // draft 태그 우선, draft가 없으면 URL 쿼리 태그를 초기값으로 사용 (Story 3.4)
  const [tags, setTags] = useState<string[]>(
    initialDraft?.tags?.length ? initialDraft.tags : urlTags,
  );
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [contentJson, setContentJson] = useState<JSONContent | undefined>(
    initialDraft?.contentJson as JSONContent | undefined,
  );
  const [contentTouched, setContentTouched] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── API 호출 ─────────────────────────────────────────────────────────────
  const submitQuestion = useCallback(
    async (status: "published" | "draft") => {
      const isDraft = status === "draft";

      // draft 는 제목만 최소 검증, published 는 본문 필수
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
        const res = await fetch("/api/v1/qna/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: title.trim(),
            contentJson: contentJson ?? { type: "doc", content: [] },
            tags,
            status,
          }),
        });

        if (res.status === 401) {
          toast({ tone: "danger", title: "로그인 후 이용해 주세요." });
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
          status: string;
        };

        if (isDraft) {
          toast({ tone: "success", title: "임시저장되었습니다." });
        } else {
          // 등록 성공 → 질문 상세 페이지로 이동
          toast({ tone: "success", title: "질문이 등록되었습니다." });
          router.push(`/questions/${data.slug}`);
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
    [contentJson, router, tags, title, toast],
  );

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
      void submitQuestion("published");
    },
    [submitQuestion],
  );

  const handleDraftSave = useCallback(() => {
    void submitQuestion("draft");
  }, [submitQuestion]);

  // 비로그인 게이트 — ready=true이고 세션 없음이 확인된 경우만 차단
  if (ready && !user) {
    return (
      <div className={styles.writeLayout}>
        <EmptyState
          icon="lock-line"
          title="로그인 후 이용해 주세요"
          description="질문을 등록하려면 로그인이 필요합니다."
          actions={
            <Link href={`/login?redirectTo=${encodeURIComponent(pathname)}`}>
              <Button variant="primary">로그인하기</Button>
            </Link>
          }
        />
      </div>
    );
  }

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
          <h1 className={styles.cardTitle}>질문하기</h1>
          <p className={styles.cardSub}>
            막히는 부분을 구체적으로 적을수록 더 빠르고 정확한 답변을 받을 수 있어요.
          </p>
        </header>

        {/* 작성 가이드 팁 박스 */}
        <aside className={styles.tipBox}>
          <Icon name="lightbulb-line" className={styles.tipIcon} aria-hidden="true" />
          <div className={styles.tipBody}>
            <p className={styles.tipTitle}>좋은 질문을 위한 체크리스트</p>
            <ul className={styles.tipList}>
              <li>무엇을 하려고 했는지 + 어떤 문제가 생겼는지 함께 적어주세요.</li>
              <li>사용 중인 도구·버전·에러 메시지를 코드블록으로 붙여주세요.</li>
              <li>이미 시도해 본 방법이 있다면 적어주면 중복 답변을 줄일 수 있어요.</li>
            </ul>
          </div>
        </aside>

        {/* 제목 */}
        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabelRow}>
            <label className={styles.fieldLabel} htmlFor="question-title">
              질문 제목 <span className={styles.required}>*</span>
            </label>
            <span className={styles.titleCount}>{title.length}/100</span>
          </div>
          <input
            id="question-title"
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
            value={contentJson}
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
            <a href="/questions" className={styles.cancelBtn}>
              취소
            </a>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || isSavingDraft}
            >
              <Icon name="question-answer-line" />
              {isSubmitting ? "등록 중…" : "질문 등록"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

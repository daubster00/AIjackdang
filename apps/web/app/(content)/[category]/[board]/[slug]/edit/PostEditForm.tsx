"use client";

/**
 * 게시글 수정 폼 — Story 2.8
 *
 * 기존 PostWriteForm 패턴을 재사용하되 수정(PATCH) 전용으로 구성.
 * - 제목·본문·태그: 기존 데이터 pre-fill
 * - board: 읽기전용 표시 (수정 불가)
 * - 저장: PATCH /api/v1/posts/{id} → 성공 시 상세 페이지로 이동 + 성공 토스트
 * - 취소: router.back()
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Icon } from "@/components/ui";
import { TagInput } from "@/components/ui/TagInput";
import { useToast } from "@/components/ui/Toast/Toast";
import { Editor } from "@/features/editor";
import type { PostDetail } from "@ai-jakdang/contracts";
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

export function PostEditForm({ post, detailHref }: PostEditFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState(post.title);
  const [titleTouched, setTitleTouched] = useState(false);
  const [tags, setTags] = useState<string[]>(post.tags ?? []);
  const [contentJson, setContentJson] = useState<JSONContent | undefined>(
    post.contentJson as JSONContent | undefined,
  );
  const [contentTouched, setContentTouched] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

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
        const res = await fetch(`/api/v1/posts/${post.id}`, {
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
    [title, contentJson, tags, post.id, detailHref, router, toast],
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

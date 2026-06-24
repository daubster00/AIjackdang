"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Button, Card, Input } from "@/components/ui";
import { Editor } from "@/features/editor";
import { useToast } from "@/components/ui/Toast";
import styles from "./inquiry.module.css";

// ── Tiptap JSON 래퍼 (Textarea 폴백용) ────────────────────────────────────────

function wrapPlainText(text: string): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text
          ? [{ type: "text", text }]
          : [],
      },
    ],
  };
}

// ── 텍스트 길이 계산 (Tiptap JSON에서 text node 합산) ──────────────────────────

function extractTextLength(json: JSONContent | null): number {
  if (!json) return 0;
  let total = 0;

  function walk(node: JSONContent) {
    if (node.type === "text" && typeof node.text === "string") {
      total += node.text.length;
    }
    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(json);
  return total;
}

// ── 유효성 검사 ───────────────────────────────────────────────────────────────

function validateTitle(value: string): string | null {
  if (!value.trim()) return "제목을 입력해 주세요.";
  if (value.length > 100) return "제목은 100자 이하로 입력해 주세요.";
  return null;
}

function validateBody(json: JSONContent | null): string | null {
  const len = extractTextLength(json);
  if (len === 0) return "문의 내용을 입력해 주세요.";
  if (len > 500) return "본문은 500자 이하로 입력해 주세요.";
  return null;
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function InquiryForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [bodyJson, setBodyJson] = useState<JSONContent | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── 제목 blur 검증 ────────────────────────────────────────────────────────
  const handleTitleBlur = useCallback(() => {
    setTitleError(validateTitle(title));
  }, [title]);

  // ── 본문 변경 시 검증 초기화 ─────────────────────────────────────────────
  const handleBodyChange = useCallback((json: JSONContent) => {
    setBodyJson(json);
    // 이미 에러가 표시된 경우 실시간 갱신
    if (bodyError) {
      setBodyError(validateBody(json));
    }
  }, [bodyError]);

  // ── 본문 blur — Editor는 blur 이벤트 없으므로 에디터 wrapper onBlur 사용 ──
  const handleBodyBlur = useCallback(() => {
    setBodyError(validateBody(bodyJson));
  }, [bodyJson]);

  // ── 제출 ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const tErr = validateTitle(title);
      const bErr = validateBody(bodyJson);
      setTitleError(tErr);
      setBodyError(bErr);
      if (tErr || bErr) return;

      setSubmitting(true);
      try {
        const body = bodyJson ?? wrapPlainText("");
        const res = await fetch("/api/v1/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ title, body }),
        });

        if (res.status === 429) {
          const data = (await res.json()) as { error?: { message?: string } };
          toast({
            tone: "danger",
            title: data.error?.message ?? "하루 최대 5건의 문의를 접수할 수 있습니다.",
          });
          return;
        }

        if (!res.ok) {
          toast({ tone: "danger", title: "문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요." });
          return;
        }

        toast({ tone: "success", title: "문의가 접수됐습니다." });
        router.push("/inquiries");
      } catch {
        toast({ tone: "danger", title: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
      } finally {
        setSubmitting(false);
      }
    },
    [title, bodyJson, toast, router],
  );

  const bodyTextLength = extractTextLength(bodyJson);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <form onSubmit={handleSubmit} noValidate>
          <Card className={styles.formCard}>
            <h1 className={styles.formTitle}>새 문의 작성</h1>

            <div className={styles.fieldGroup}>
              {/* 제목 */}
              <div>
                <Input
                  label="제목"
                  required
                  placeholder="문의 제목을 입력하세요"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (titleError) setTitleError(validateTitle(e.target.value));
                  }}
                  onBlur={handleTitleBlur}
                  error={titleError ?? undefined}
                  maxLength={100}
                />
                <div className={`${styles.charCount} ${title.length > 100 ? styles.charCountOver : ""}`}>
                  {title.length} / 100
                </div>
              </div>

              {/* 본문 */}
              <div>
                <label className={styles.fieldLabel}>
                  내용
                  <span className={styles.fieldRequired} aria-hidden="true">*</span>
                </label>
                <div
                  className={`${styles.editorWrapper} ${bodyError ? styles.editorWrapperError : ""}`}
                  onBlur={handleBodyBlur}
                >
                  <Editor
                    preset="lite"
                    placeholder="문의 내용을 입력하세요 (최대 500자)"
                    onChange={handleBodyChange}
                  />
                </div>
                <div
                  className={`${styles.charCount} ${bodyTextLength > 500 ? styles.charCountOver : ""}`}
                >
                  {bodyTextLength} / 500
                </div>
                {bodyError && (
                  <p className={styles.fieldError} role="alert">
                    {bodyError}
                  </p>
                )}
              </div>
            </div>

            {/* 액션 */}
            <div className={styles.formActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/inquiries")}
                disabled={submitting}
              >
                취소
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                제출
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
}

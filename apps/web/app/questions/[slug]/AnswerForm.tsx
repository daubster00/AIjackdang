"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import { LightEditor } from "@/components/board";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast/Toast";
import styles from "../questions.module.css";

const MAX_LENGTH = 2000;

interface AnswerFormProps {
  questionId: string;
  onSuccess?: () => void;
}

/**
 * 질문에 답변을 작성하는 폼 — Story 3.6
 *
 * - 비회원: 로그인 유도 (redirectTo=/questions/{slug})
 * - 회원: POST /api/v1/qna/questions/{questionId}/answers
 * - 성공: 토스트 + 에디터 리셋 + onSuccess 콜백(목록 재패치)
 * - 실패: danger 토스트 + 입력 유지
 *
 * LightEditor는 HTML을 반환하므로 { type: "doc", html: "<innerHTML>" } 형태로
 * content_json에 감싸 저장한다(AR-8: HTML 컬럼 저장 금지, JSON 컬럼에 저장).
 * 렌더 시 서버가 html 필드를 추출하여 sanitize-html로 안전 렌더한다.
 */
export function AnswerForm({ questionId, onSuccess }: AnswerFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, ready } = useAuth();

  const [textLength, setTextLength] = useState(0);
  const [isOverLimit, setIsOverLimit] = useState(false);
  const [htmlContent, setHtmlContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // LightEditor 리셋을 위한 key
  const [editorKey, setEditorKey] = useState(0);
  const resetEditor = useCallback(() => {
    setEditorKey((k) => k + 1);
    setTextLength(0);
    setIsOverLimit(false);
    setHtmlContent("");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // ── 비회원 → 로그인 유도 ─────────────────────────────────────────────
    if (ready && !user) {
      router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (textLength === 0 || isOverLimit) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/qna/questions/${questionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          questionId,
          // LightEditor는 HTML을 반환하므로 doc JSON으로 감싼다 (AR-8 준수)
          contentJson: { type: "doc", html: htmlContent },
        }),
      });

      if (res.status === 401) {
        router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast({
          tone: "danger",
          title: "답변 등록 실패",
          description: data?.error?.message ?? "잠시 후 다시 시도해 주세요.",
        });
        return;
      }

      toast({ tone: "success", title: "답변이 등록되었습니다." });
      resetEditor();
      onSuccess?.();
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "네트워크 오류가 발생했습니다." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.answerForm} onSubmit={handleSubmit}>
      <span className="sr-only" id="answer-label">
        답변 작성
      </span>
      <LightEditor
        key={editorKey}
        ariaLabel="답변 작성"
        placeholder="질문자에게 도움이 되도록 구체적으로 답변해 주세요. (코드/예시/근거를 함께 적으면 채택될 확률이 올라갑니다.)"
        minHeight={180}
        maxLength={MAX_LENGTH}
        onChange={({ text, html, isOverLimit }) => {
          setTextLength(text.trim().length);
          setIsOverLimit(isOverLimit);
          setHtmlContent(html);
        }}
      />
      <div className={styles.answerFormActions}>
        <Button
          leftIcon={<Icon name="chat-check-line" />}
          disabled={textLength === 0 || isOverLimit || isSubmitting}
          type="submit"
        >
          {isSubmitting ? "등록 중..." : "답변 등록"}
        </Button>
      </div>
    </form>
  );
}

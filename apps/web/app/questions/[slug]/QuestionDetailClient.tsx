"use client";

/**
 * 질문 상세 클라이언트 컴포넌트 — Story 3.5 / 수정요청 반영
 *
 * 상단(헤더)에서는 상태 배지와 [해결됨으로 표시] 액션만 소유한다.
 * 질문자의 [수정]·[삭제] 버튼은 다른 게시판과 동일한 위치(하단 footer)로 옮겼다
 *   → QuestionFooterOwnerActions 가 담당.
 *
 * isResolved 상태를 이 컴포넌트가 소유하여 배지와 [해결됨으로 표시] 버튼을 함께 반영한다.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionStatusBadge } from "@/components/qna/QuestionStatusBadge";
import type { QuestionDerivedStatus } from "@/components/qna/QuestionStatusBadge";
import { Icon, Tag } from "@/components/ui";
import styles from "../questions.module.css";

interface QuestionDetailClientProps {
  questionId: string;
  initialDerivedStatus: QuestionDerivedStatus;
  isResolved: boolean;
  isAsker: boolean;
  tags: string[];
}

export function QuestionDetailClient({
  questionId,
  initialDerivedStatus,
  isResolved: initialIsResolved,
  isAsker,
  tags,
}: QuestionDetailClientProps) {
  const router = useRouter();
  const [derivedStatus, setDerivedStatus] = useState<QuestionDerivedStatus>(initialDerivedStatus);
  const [isResolved, setIsResolved] = useState(initialIsResolved);
  const [resolving, setResolving] = useState(false);

  async function handleResolve() {
    if (resolving || isResolved) return;
    setResolving(true);
    // 낙관적 UI 선반영
    setDerivedStatus("resolved");
    setIsResolved(true);
    try {
      const res = await fetch(`/api/v1/qna/questions/${questionId}/resolve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) router.refresh();
    } catch {
      router.refresh();
    } finally {
      setResolving(false);
    }
  }

  return (
    <>
      {/* ── 배지 + 태그 행 ── */}
      <div className={styles.detailTopRow}>
        {/* 상태 배지 — 낙관적 업데이트 반영 */}
        <QuestionStatusBadge status={derivedStatus} className={styles.detailStatusBadge} />

        <div className={styles.detailTagRow}>
          {tags.map((tag) => (
            <Tag key={tag} href={`/tags/${encodeURIComponent(tag)}`}>
              #{tag}
            </Tag>
          ))}
        </div>
      </div>

      {/* ── [해결됨으로 표시] — 질문자이며 아직 미해결일 때만 ── */}
      {isAsker && !isResolved && (
        <div className={styles.resolveActionRow}>
          <button
            type="button"
            className={styles.ownerResolveBtn}
            onClick={handleResolve}
            disabled={resolving}
          >
            <Icon name="checkbox-circle-line" />
            {resolving ? "처리 중..." : "해결됨으로 표시"}
          </button>
        </div>
      )}
    </>
  );
}

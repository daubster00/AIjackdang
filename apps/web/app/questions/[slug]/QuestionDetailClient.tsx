"use client";

/**
 * 질문 상세 클라이언트 컴포넌트 — Story 3.5
 *
 * SSR 서버 컴포넌트(page.tsx)에서 낙관적 상태 변경이 필요한 부분을 위임받는다.
 *
 * 이 컴포넌트 하나가 상태를 소유하고 두 가지를 렌더한다:
 *   1. 상태 배지 (detailTopRow 내부 — QuestionStatusBadge)
 *   2. 질문자 액션 버튼 (QuestionOwnerActions, isAsker=true 시만)
 *
 * isResolved가 변하면 배지와 [해결됨으로 표시] 버튼 모두 반영된다.
 */

import { useState } from "react";
import { QuestionStatusBadge } from "@/components/qna/QuestionStatusBadge";
import type { QuestionDerivedStatus } from "@/components/qna/QuestionStatusBadge";
import { Tag } from "@/components/ui";
import { QuestionOwnerActions } from "./QuestionOwnerActions";
import styles from "../questions.module.css";

interface QuestionDetailClientProps {
  questionId: string;
  questionSlug: string;
  initialDerivedStatus: QuestionDerivedStatus;
  isResolved: boolean;
  isAsker: boolean;
  tags: string[];
}

export function QuestionDetailClient({
  questionId,
  questionSlug,
  initialDerivedStatus,
  isResolved: initialIsResolved,
  isAsker,
  tags,
}: QuestionDetailClientProps) {
  const [derivedStatus, setDerivedStatus] = useState<QuestionDerivedStatus>(initialDerivedStatus);
  const [isResolved, setIsResolved] = useState(initialIsResolved);

  function handleResolved() {
    setDerivedStatus("resolved");
    setIsResolved(true);
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

      {/* ── 질문자 액션 버튼 (수정·삭제·해결됨) — isAsker=true 시만 렌더 ── */}
      {isAsker && (
        <QuestionOwnerActions
          questionId={questionId}
          questionSlug={questionSlug}
          isResolved={isResolved}
          onResolved={handleResolved}
        />
      )}
    </>
  );
}

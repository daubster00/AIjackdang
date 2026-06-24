"use client";

/**
 * 질문 작성자 전용 액션 버튼 — Story 3.5
 *
 * [수정] → /questions/{slug}/edit 링크
 * [삭제] → 확인 모달 → DELETE API → /questions 리다이렉트
 * [해결됨으로 표시] → PATCH /resolve → 낙관적 배지 교체
 *
 * ownerActions div 안의 a·button 공통 스타일은 questions.module.css가 담당.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui";
import styles from "../questions.module.css";

interface QuestionOwnerActionsProps {
  questionId: string;
  questionSlug: string;
  isResolved: boolean;
  onResolved: () => void;
}

export function QuestionOwnerActions({
  questionId,
  questionSlug,
  isResolved,
  onResolved,
}: QuestionOwnerActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── [해결됨으로 표시] ─────────────────────────────────────────────────────────
  async function handleResolve() {
    if (resolving || isResolved) return;
    setResolving(true);
    // 낙관적 UI 선반영
    onResolved();
    try {
      const res = await fetch(`/api/v1/qna/questions/${questionId}/resolve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) {
        router.refresh();
      }
    } catch {
      router.refresh();
    } finally {
      setResolving(false);
    }
  }

  // ── [삭제] ────────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/qna/questions/${questionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok || res.status === 204) {
        router.push("/questions");
      } else {
        setDeleteOpen(false);
        alert("삭제에 실패했습니다. 다시 시도해 주세요.");
      }
    } catch {
      setDeleteOpen(false);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className={styles.ownerActions}>
        {/* [수정] */}
        <Link href={`/questions/${questionSlug}/edit`} className={styles.ownerActionLink}>
          <Icon name="edit-2-line" />
          수정
        </Link>

        {/* [삭제] */}
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          disabled={deleting}
        >
          <Icon name="delete-bin-line" />
          삭제
        </button>

        {/* [해결됨으로 표시] — is_resolved=false 일 때만 */}
        {!isResolved && (
          <button
            type="button"
            className={styles.ownerResolveBtn}
            onClick={handleResolve}
            disabled={resolving}
          >
            <Icon name="checkbox-circle-line" />
            {resolving ? "처리 중..." : "해결됨으로 표시"}
          </button>
        )}
      </div>

      {/* ── 삭제 확인 모달 ── */}
      {deleteOpen && (
        <div className={styles.deleteModalOverlay} role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
          <div className={styles.deleteModalDialog}>
            <h2 id="delete-confirm-title" className={styles.deleteModalTitle}>
              질문을 삭제하시겠습니까?
            </h2>
            <p className={styles.deleteModalDesc}>
              삭제된 질문은 복구할 수 없습니다.
            </p>
            <div className={styles.deleteModalActions}>
              <button
                type="button"
                className={styles.deleteModalCancel}
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.deleteModalOk}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

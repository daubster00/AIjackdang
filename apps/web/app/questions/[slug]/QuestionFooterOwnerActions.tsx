"use client";

/**
 * 질문 작성자 전용 하단 액션 (수정·삭제) — 수정요청 반영
 *
 * 다른 게시판과 동일하게 상세 하단 footer(목록으로 옆)에 [수정]·[삭제]를 배치한다.
 * 삭제 확인 창은 전 게시판 공용 DeleteConfirmModal 을 사용한다.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { useToast } from "@/components/ui/Toast/Toast";
import styles from "../questions.module.css";

interface QuestionFooterOwnerActionsProps {
  questionId: string;
  questionSlug: string;
}

export function QuestionFooterOwnerActions({
  questionId,
  questionSlug,
}: QuestionFooterOwnerActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/qna/questions/${questionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok || res.status === 204) {
        toast({ tone: "success", title: "질문이 삭제되었습니다." });
        router.push("/questions");
      } else {
        setDeleteOpen(false);
        toast({ tone: "danger", title: "삭제에 실패했습니다. 다시 시도해 주세요." });
      }
    } catch {
      setDeleteOpen(false);
      toast({ tone: "danger", title: "네트워크 오류가 발생했습니다." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.ownerActions}>
      <Link href={`/questions/${questionSlug}/edit`} className={styles.ownerActionLink}>
        <Icon name="edit-2-line" />
        수정
      </Link>
      <button type="button" onClick={() => setDeleteOpen(true)} disabled={deleting}>
        <Icon name="delete-bin-line" />
        삭제
      </button>

      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="질문을 삭제하시겠습니까?"
        description="삭제된 질문은 복구할 수 없습니다."
        loading={deleting}
      />
    </div>
  );
}

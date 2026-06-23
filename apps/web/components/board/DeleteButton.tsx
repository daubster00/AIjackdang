"use client";

/**
 * 게시글 삭제 버튼 — Story 2.8
 *
 * - 클릭 → 확인 모달 (ConfirmDialog) open
 * - 삭제 확인 → DELETE /api/v1/posts/{id} → 목록 리다이렉트 + 성공 토스트
 * - ConfirmDialog: 기존 Modal 기반, 포커스 트랩·ESC 닫기·배경 스크롤 잠금은 Modal이 처리
 * - 취소 버튼에 autoFocus (실수 삭제 방지, AC #5)
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast/Toast";

interface DeleteButtonProps {
  /** 삭제할 게시글 id (uuid) */
  postId: string;
  /** 삭제 후 이동할 목록 URL (예: "/vibe-coding") */
  listUrl: string;
  /** 버튼 CSS className (외부 스타일 주입용) */
  className?: string;
}

export function DeleteButton({ postId, listUrl, className }: DeleteButtonProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.status === 401) {
        toast({ tone: "danger", title: "로그인이 필요합니다." });
        return;
      }

      if (res.status === 403) {
        toast({ tone: "danger", title: "삭제 권한이 없습니다." });
        setOpen(false);
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast({
          tone: "danger",
          title: "삭제 실패",
          description: data?.error?.message ?? "잠시 후 다시 시도해 주세요.",
        });
        return;
      }

      setOpen(false);
      toast({ tone: "success", title: "게시글이 삭제되었습니다." });
      router.push(listUrl);
    } catch {
      toast({
        tone: "danger",
        title: "네트워크 오류",
        description: "잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [postId, listUrl, router, toast]);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
      >
        <Icon name="delete-bin-line" />
        삭제
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="게시글 삭제"
        tone="danger"
        confirmLabel="삭제"
        cancelLabel="취소"
        loading={isDeleting}
      >
        <p>게시글을 삭제하시겠습니까?</p>
        <p style={{ marginTop: "var(--space-2)", color: "var(--color-text-sub)", fontSize: "var(--font-size-sm)" }}>
          삭제된 게시글은 복구할 수 없습니다.
        </p>
      </ConfirmDialog>
    </>
  );
}

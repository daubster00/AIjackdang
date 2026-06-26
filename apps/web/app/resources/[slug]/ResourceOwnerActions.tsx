"use client";

/**
 * 실전자료 소유자 액션 버튼 — 수정하기 / 삭제하기
 * resources/[slug]/page.tsx 의 detailFooter 오른쪽에 렌더된다.
 *
 * - 수정하기: /resources/{slug}/edit 로 이동
 * - 삭제하기: DELETE /api/v1/resources/{id} → /resources 로 이동
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { useToast } from "@/components/ui/Toast/Toast";
import styles from "./resource-detail.module.css";

type ResourceType =
  | "prompt"
  | "claude-code-skill"
  | "mcp"
  | "rules-config"
  | "template-checklist";

/** resourceType → 해당 유형 목록 페이지 URL */
function typeToListUrl(resourceType: ResourceType): string {
  const map: Record<ResourceType, string> = {
    prompt: "/resources/prompts",
    "claude-code-skill": "/resources/mcp-skills",
    mcp: "/resources/mcp-skills",
    "rules-config": "/resources/rules",
    "template-checklist": "/resources/templates",
  };
  return map[resourceType] ?? "/resources/prompts";
}

interface ResourceOwnerActionsProps {
  resourceId: string;
  resourceSlug: string;
  resourceType: ResourceType;
}

export function ResourceOwnerActions({ resourceId, resourceSlug, resourceType }: ResourceOwnerActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/resources/${resourceId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message =
          (data as { error?: { message?: string } }).error?.message ??
          "삭제 중 오류가 발생했습니다.";
        toast({ tone: "danger", title: message });
        return;
      }

      toast({ tone: "success", title: "자료가 삭제되었습니다." });
      router.push(typeToListUrl(resourceType));
    } catch {
      toast({ tone: "danger", title: "삭제 중 오류가 발생했습니다." });
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  }, [resourceId, router, toast]);

  return (
    <>
      <div className={styles.ownerActions}>
        <Link href={`/resources/${resourceSlug}/edit`} className={styles.editLink}>
          <Icon name="edit-2-line" />
          수정하기
        </Link>
        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => setDeleteOpen(true)}
          disabled={isDeleting}
          aria-disabled={isDeleting}
        >
          <Icon name={isDeleting ? "loader-4-line" : "delete-bin-line"} />
          {isDeleting ? "삭제 중..." : "삭제하기"}
        </button>
      </div>
      <DeleteConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title="자료를 삭제하시겠습니까?"
        description="삭제된 자료는 복구할 수 없습니다."
        loading={isDeleting}
      />
    </>
  );
}

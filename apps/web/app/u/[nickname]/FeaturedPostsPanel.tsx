"use client";

/**
 * FeaturedPostsPanel — 프로필 오너가 "계정 페이지 노출 글"을 선택하는 우측 280px 패널.
 * - 본인 글 목록을 /api/v1/users/me/posts 에서 조회한다.
 * - 체크박스로 최대 5개 선택 후 PATCH /api/v1/users/me/featured-posts 로 저장.
 * - 비오너에게는 렌더링되지 않는다 (부모 서버 컴포넌트가 isOwner 조건부로 마운트).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Icon, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import styles from "./FeaturedPostsPanel.module.css";

interface PostItem {
  id: string;
  kind: "post" | "resource";
  board: string;
  boardLabel: string;
  slug: string;
  title: string;
  excerpt: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
}

interface FeaturedPostsPanelProps {
  /** 현재 저장된 featured post id 배열 (서버에서 내려온 초기값). */
  initialFeaturedIds: string[];
}

const MAX_FEATURED = 5;

export function FeaturedPostsPanel({ initialFeaturedIds }: FeaturedPostsPanelProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialFeaturedIds));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // 내 글 목록 조회
  useEffect(() => {
    setLoading(true);
    fetch("/api/v1/users/me/posts?pageSize=100", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items: PostItem[] } | null) => {
        if (data?.items) setPosts(data.items.filter((p) => p.kind === "post"));
      })
      .catch(() => {/* 조회 실패 시 빈 목록 유지 */})
      .finally(() => setLoading(false));
  }, []);

  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_FEATURED) {
          toast({ tone: "warning", title: `최대 ${MAX_FEATURED}개까지 선택할 수 있어요` });
          return prev;
        }
        next.add(id);
      }
      setDirty(true);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/users/me/featured-posts", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        toast({ tone: "success", title: "노출 글이 저장됐어요" });
        setDirty(false);
        router.refresh();
      } else {
        const err = (await res.json()) as { error?: { message?: string } };
        toast({ tone: "danger", title: "저장 실패", description: err.error?.message });
      }
    } catch {
      toast({ tone: "danger", title: "저장 중 오류가 발생했어요" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className={styles.panel} aria-label="계정 노출 글 선택">
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>
          <Icon name="star-line" />
          노출 글 설정
        </h3>
        <p className={styles.panelDesc}>
          방문자에게 보여줄 글을 최대 {MAX_FEATURED}개 선택하세요.
        </p>
      </div>

      <div className={styles.panelBody}>
        {loading ? (
          <div className={styles.loadingWrap}>
            <Spinner size="sm" />
          </div>
        ) : posts.length === 0 ? (
          <p className={styles.emptyMsg}>아직 공개된 글이 없어요.</p>
        ) : (
          <ul className={styles.postList} role="list">
            {posts.map((post) => {
              const checked = selectedIds.has(post.id);
              const disabled = !checked && selectedIds.size >= MAX_FEATURED;
              return (
                <li key={post.id} className={styles.postItem}>
                  <Checkbox
                    checked={checked}
                    onChange={() => handleToggle(post.id)}
                    disabled={disabled}
                  >
                    <span className={`${styles.postLabel} ${disabled ? styles.postLabelDisabled : ""}`}>
                      <span className={styles.postBoard}>{post.boardLabel}</span>
                      <span className={styles.postTitleText}>{post.title}</span>
                    </span>
                  </Checkbox>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!loading && posts.length > 0 && (
        <div className={styles.panelFooter}>
          <span className={styles.selectedCount}>
            {selectedIds.size} / {MAX_FEATURED}
          </span>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !dirty}
            leftIcon={<Icon name="save-line" />}
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      )}
    </aside>
  );
}

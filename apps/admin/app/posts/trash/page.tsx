"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { dbBoardToAdminSlug } from "@/lib/boards";
import { API_BASE_URL } from "@/lib/api";

/**
 * 게시글 휴지통 페이지 (/posts/trash).
 * status='deleted' 게시글 목록 조회 + 영구삭제(purge) / 복구(restore) 기능.
 * 영구삭제는 super_admin 전용 (DELETE /admin/posts/:id/purge).
 * 복구는 PATCH /admin/posts/:id/restore.
 */

type TrashPost = {
  id: string;
  board: string;
  title: string;
  status: string;
  authorNickname: string | null;
  authorAvatarUrl?: string | null;
  authorImage?: string | null;
  authorDefaultAvatarIndex?: number | null;
  viewCount: number;
  deletedAt: string | null;
  createdAt: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return iso.slice(0, 10).replace(/-/g, ".");
}

// ── 영구삭제 확인 모달 ────────────────────────────────────────────────────────

function PurgeModal({
  title,
  onConfirm,
  onClose,
}: {
  title: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--gray-0, #fff)", borderRadius: 8, padding: 24,
          width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 16, color: "var(--danger)" }}>
          <i className="ri-error-warning-line" style={{ marginRight: 6 }} />
          영구삭제 확인
        </h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 12 }}>
          이 작업은 취소할 수 없습니다. 데이터가 완전히 삭제됩니다.
        </p>
        <p
          style={{
            fontSize: 13, fontWeight: 600, wordBreak: "break-all",
            padding: "8px 12px", background: "var(--gray-50)", borderRadius: 6, marginBottom: 16,
          }}
        >
          {title}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>취소</button>
          <button className="btn btn-danger" onClick={onConfirm}>영구삭제</button>
        </div>
      </div>
    </div>
  );
}

// ── 토스트 ────────────────────────────────────────────────────────────────────

function Toast({
  message, type, onClose,
}: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff", borderRadius: 8, padding: "12px 20px",
        fontSize: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex", alignItems: "center", gap: 10,
      }}
    >
      <i className={type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} />
      {message}
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8 }} aria-label="닫기">
        <i className="ri-close-line" />
      </button>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function TrashPage() {
  const [posts, setPosts] = useState<TrashPost[]>([]);
  const [pageMeta, setPageMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; title: string } | null>(null);
  const [page, setPage] = useState(1);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", "deleted");
      params.set("page", String(page));
      params.set("pageSize", "20");

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = await res.json();
      setPosts(data.items ?? []);
      setPageMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("휴지통 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/get-session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.user?.role === "super_admin") setIsSuperAdmin(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  async function handlePurge(id: string) {
    setPurgeTarget(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${id}/purge`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 403) {
        showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error");
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast((err as { error?: { message?: string } })?.error?.message ?? "영구삭제에 실패했습니다.", "error");
        return;
      }
      showToast("게시글이 영구삭제되었습니다.", "success");
      void fetchPosts();
    } catch {
      showToast("영구삭제 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleRestore(id: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${id}/restore`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      showToast("게시글이 복구되었습니다.", "success");
      void fetchPosts();
    } catch {
      showToast("복구 중 오류가 발생했습니다.", "error");
    }
  }

  return (
    <AdminShell
      breadcrumb={["관리자", "게시글 관리", "휴지통"]}
      activeKey="posts"
      activeSubKey="trash"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="ri-delete-bin-2-line" style={{ marginRight: 8, color: "var(--danger)" }} />
            게시글 휴지통
          </h1>
          <p className="page-description">
            유저/관리자가 삭제한 게시글입니다. 삭제 후 30일이 지나면 자동으로 영구삭제됩니다.
          </p>
        </div>
      </div>

      <section className="section" aria-label="휴지통 게시글 목록">
        <article className="card">
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 {pageMeta.totalItems}개</span>
            </div>
          </div>

          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
                불러오는 중...
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>제목</th>
                    <th>게시판</th>
                    <th>작성자</th>
                    <th>삭제일</th>
                    <th>작성일</th>
                    <th style={{ width: 160 }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>
                        휴지통이 비어 있습니다.
                      </td>
                    </tr>
                  ) : (
                    posts.map((p) => {
                      const adminSlug = dbBoardToAdminSlug(p.board);
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="content-title" style={{ color: "var(--gray-500)" }}>
                              {p.title}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-gray">{adminSlug}</span>
                          </td>
                          <td>
                            <div className="author">
                              <UserAvatar
                                size={28}
                                alt={p.authorNickname ?? "탈퇴"}
                                avatarUrl={p.authorAvatarUrl}
                                image={p.authorImage}
                                defaultAvatarIndex={p.authorDefaultAvatarIndex ?? 0}
                              />
                              <span>{p.authorNickname ?? "(탈퇴)"}</span>
                            </div>
                          </td>
                          <td className="num">{formatDate(p.deletedAt)}</td>
                          <td className="num">{formatDate(p.createdAt)}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => void handleRestore(p.id)}
                                title="복구"
                              >
                                <i className="ri-arrow-go-back-line" />
                                복구
                              </button>
                              {isSuperAdmin && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => setPurgeTarget({ id: p.id, title: p.title })}
                                  title="영구삭제"
                                >
                                  <i className="ri-delete-bin-fill" />
                                  영구삭제
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {pageMeta.totalPages > 1 && (
            <div className="pagination">
              <div className="page-info">
                {(pageMeta.page - 1) * pageMeta.pageSize + 1}–{Math.min(pageMeta.page * pageMeta.pageSize, pageMeta.totalItems)} / 총 {pageMeta.totalItems}개
              </div>
              <div className="page-buttons">
                <button
                  className="page-button"
                  aria-label="이전 페이지"
                  disabled={pageMeta.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <i className="ri-arrow-left-s-line" />
                </button>
                {Array.from({ length: Math.min(pageMeta.totalPages, 5) }, (_, i) => {
                  const pg = i + 1;
                  return (
                    <button
                      key={pg}
                      className={`page-button${pageMeta.page === pg ? " active" : ""}`}
                      onClick={() => setPage(pg)}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button
                  className="page-button"
                  aria-label="다음 페이지"
                  disabled={pageMeta.page >= pageMeta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <i className="ri-arrow-right-s-line" />
                </button>
              </div>
            </div>
          )}
        </article>
      </section>

      {purgeTarget && (
        <PurgeModal
          title={purgeTarget.title}
          onConfirm={() => void handlePurge(purgeTarget.id)}
          onClose={() => setPurgeTarget(null)}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

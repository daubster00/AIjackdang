"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense, use } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { findBoard } from "@/lib/boards";
import { API_BASE_URL } from "../../../lib/api";
import type { AdminPostItem } from "@ai-jakdang/contracts";

/**
 * 게시판별 게시글 목록 페이지 (/posts/[board]) — Story 9.6.
 * board 파라미터 기반 필터 적용. GET /api/v1/admin/posts?board=... 실제 API 연동.
 */

const STATUSES = [
  { value: "all", label: "상태: 전체" },
  { value: "published", label: "공개" },
  { value: "hidden", label: "숨김" },
  { value: "deleted", label: "삭제" },
  { value: "draft", label: "초안" },
] as const;

const FLAGS = [
  { value: "all", label: "속성: 전체" },
  { value: "notice", label: "공지글만" },
  { value: "pinned", label: "상단고정만" },
  { value: "featured", label: "추천글만" },
  { value: "main", label: "메인노출만" },
] as const;

function statusBadge(status: string): [string, string] {
  switch (status) {
    case "published": return ["badge-green", "공개"];
    case "hidden": return ["badge-gray", "숨김"];
    case "deleted": return ["badge-gray", "삭제"];
    case "draft": return ["badge-yellow", "초안"];
    default: return ["badge-gray", status];
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

// ── 토스트 ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
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
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8 }}
        aria-label="닫기"
      >
        <i className="ri-close-line" />
      </button>
    </div>
  );
}

// ── 삭제 모달 ──────────────────────────────────────────────────────────────────

function DeleteModal({
  postId,
  postTitle,
  onConfirm,
  onClose,
}: {
  postId: string;
  postTitle: string;
  onConfirm: (id: string, reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--surface)", borderRadius: 8, padding: 24,
          width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>게시글 삭제</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          아래 게시글을 삭제합니다. 삭제 후 복구 가능합니다.
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, wordBreak: "break-all" }}>
          {postTitle}
        </p>
        <label style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}>
          삭제 사유 (필수)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="삭제 사유를 입력하세요"
          rows={3}
          style={{
            width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
            borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>취소</button>
          <button
            className="btn btn-danger"
            disabled={!reason.trim()}
            onClick={() => onConfirm(postId, reason.trim())}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 벌크 삭제 모달 ────────────────────────────────────────────────────────────

function BulkDeleteModal({
  count: cnt,
  onConfirm,
  onClose,
}: {
  count: number;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ background: "var(--surface)", borderRadius: 8, padding: 24, width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>일괄 삭제</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          선택한 <strong>{cnt}개</strong> 게시글을 삭제합니다.
        </p>
        <label style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}>삭제 사유 (필수)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="삭제 사유를 입력하세요"
          rows={3}
          style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>취소</button>
          <button className="btn btn-danger" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>삭제 확정</button>
        </div>
      </div>
    </div>
  );
}

// ── SEO 드로어 ────────────────────────────────────────────────────────────────

function SeoDrawer({ post, onClose, onSaved }: { post: AdminPostItem | null; onClose: () => void; onSaved: () => void }) {
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "");
  const [seoDesc, setSeoDesc] = useState(post?.seoDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setSeoTitle(post?.seoTitle ?? ""); setSeoDesc(post?.seoDescription ?? ""); }, [post?.id, post?.seoTitle, post?.seoDescription]);
  if (!post) return null;

  async function handleSave() {
    if (!post) return;
    setSaving(true);
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${post.id}/seo`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seoTitle: seoTitle || null, seoDescription: seoDesc || null }),
    });
    setSaving(false);
    setMsg(res.ok ? "저장되었습니다." : "저장에 실패했습니다.");
    setTimeout(() => setMsg(null), 2000);
    if (res.ok) onSaved();
  }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 9997 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 400, background: "var(--surface)", zIndex: 9998, padding: 28, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", boxShadow: "-4px 0 24px rgba(0,0,0,.12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>SEO 메타 수정</h2>
          <button className="icon-button" onClick={onClose} aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <p style={{ fontSize: 13, color: "var(--gray-500)", wordBreak: "break-all" }}>{post.title}</p>
        {msg && <div style={{ background: "var(--gray-900)", color: "#fff", borderRadius: 6, padding: "8px 14px", fontSize: 13 }}>{msg}</div>}
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-700)" }}>SEO 제목 ({seoTitle.length}/60)</span>
          <input className="control" type="text" maxLength={60} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="SEO 제목 (최대 60자)" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-700)" }}>SEO 설명 ({seoDesc.length}/160)</span>
          <textarea className="control" rows={4} maxLength={160} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} placeholder="SEO 설명 (최대 160자)" style={{ resize: "vertical" }} />
        </label>
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? "저장 중..." : "저장"}</button>
      </div>
    </>
  );
}

// ── 메인 컨텐츠 ─────────────────────────────────────────────────────────────────

function BoardPostsContent({ boardSlug }: { boardSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const meta = findBoard(boardSlug);
  if (!meta) notFound();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const statusParam = searchParams.get("status") ?? "all";
  const qParam = searchParams.get("q") ?? "";
  const flagParam = searchParams.get("flag") ?? "all";

  const [posts, setPosts] = useState<AdminPostItem[]>([]);
  const [pageMeta, setPageMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(qParam);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [seoPost, setSeoPost] = useState<AdminPostItem | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("board", boardSlug);
      params.set("page", String(pageParam));
      params.set("pageSize", "20");
      if (statusParam && statusParam !== "all") params.set("status", statusParam);
      if (qParam) params.set("q", qParam);
      if (flagParam === "notice") params.set("isNotice", "true");
      if (flagParam === "pinned") params.set("isPinned", "true");
      if (flagParam === "featured") params.set("isFeatured", "true");
      if (flagParam === "main") params.set("isMainFeatured", "true");

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = await res.json();
      setPosts(data.items ?? []);
      setPageMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("게시글 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [boardSlug, pageParam, statusParam, qParam, flagParam, showToast]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.user?.role === "super_admin") setIsSuperAdmin(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "all" && v !== "") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`/posts/${boardSlug}?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/posts/${boardSlug}?${next.toString()}`);
  }

  async function handleFlag(id: string, flagKey: string, current: boolean) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${id}/flags`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [flagKey]: !current }),
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("플래그가 변경되었습니다.", "success");
      fetchPosts();
    } catch {
      showToast("플래그 변경 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleHide(id: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${id}/hide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("게시글이 숨김 처리되었습니다.", "success");
      fetchPosts();
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
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
      fetchPosts();
    } catch {
      showToast("복구 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleDeleteConfirm(id: string, _reason: string) {
    setDeleteModal(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("게시글이 삭제되었습니다.", "success");
      fetchPosts();
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleBulkHide() {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/bulk`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "hide" }),
      });
      if (!res.ok) throw new Error();
      showToast(`${selectedIds.size}개 게시글이 숨김 처리되었습니다.`, "success");
      setSelectedIds(new Set());
      fetchPosts();
    } catch {
      showToast("일괄 숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleBulkDelete(reason: string) {
    if (selectedIds.size === 0) return;
    setBulkDeleteOpen(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/bulk`, {
        m
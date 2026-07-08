"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RowActionMenu, type RowActionItem } from "@/components/ui/RowActionMenu";
import { API_BASE_URL } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import type { AdminPostItem } from "@ai-jakdang/contracts";
import { BOARDS as ADMIN_BOARDS, dbBoardToAdminSlug } from "@/lib/boards";

/**
 * 게시글 관리 페이지 (Story 9.6).
 * GET /api/v1/admin/posts 실제 API 연동.
 * URL 파라미터: page, board, status, q
 * 플래그 토글/숨김/복구/삭제 → API 호출 후 목록 재조회.
 * 삭제는 super_admin 역할만 표시.
 */

// 게시판 필터 목록. value = posts.board(DB 실제값), label = 화면 표기.
// lib/boards.ts(웹 대메뉴와 일치하는 단일 소스)에서 파생한다. API 필터는 board 를
// posts.board 와 정확히 일치(eq)로 비교하므로 value 는 반드시 DB 실제값이어야 한다.
const BOARDS = [
  { value: "all", label: "게시판: 전체" },
  ...ADMIN_BOARDS.map((b) => ({ value: b.apiBoard ?? b.slug, label: b.label })),
] as const;

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

// p.board(DB 실제값) → 뱃지 클래스 / 라벨. lib/boards.ts 에서 DB 값으로 키를 잡는다.
const BOARD_BADGE: Record<string, string> = Object.fromEntries(
  ADMIN_BOARDS.map((b) => [b.apiBoard ?? b.slug, b.badge]),
);

const BOARD_LABEL: Record<string, string> = Object.fromEntries(
  ADMIN_BOARDS.map((b) => [b.apiBoard ?? b.slug, b.label]),
);

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

// ── 모달 컴포넌트 ─────────────────────────────────────────────────────────────

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
          background: "var(--gray-0, #fff)", borderRadius: 8, padding: 24,
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

// ── SEO 드로어 ────────────────────────────────────────────────────────────────

function SeoDrawer({
  post,
  onClose,
  onSaved,
}: {
  post: AdminPostItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "");
  const [seoDesc, setSeoDesc] = useState(post?.seoDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [drawerToast, setDrawerToast] = useState<string | null>(null);

  useEffect(() => {
    setSeoTitle(post?.seoTitle ?? "");
    setSeoDesc(post?.seoDescription ?? "");
  }, [post?.id, post?.seoTitle, post?.seoDescription]);

  if (!post) return null;

  async function handleSave() {
    if (!post) return;
    setSaving(true);
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${post.id}/seo`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seoTitle: seoTitle || null, seoDescription: seoDesc || null }),
    });
    setSaving(false);
    if (res.ok) {
      setDrawerToast("SEO 메타가 저장되었습니다.");
      setTimeout(() => setDrawerToast(null), 2000);
      onSaved();
    } else {
      setDrawerToast("저장에 실패했습니다.");
      setTimeout(() => setDrawerToast(null), 2000);
    }
  }

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 9997 }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 400,
          background: "var(--gray-0, #fff)", zIndex: 9998, padding: 28,
          display: "flex", flexDirection: "column", gap: 20,
          overflowY: "auto", boxShadow: "-4px 0 24px rgba(0,0,0,.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)" }}>SEO 메타 수정</h2>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <i className="ri-close-line" />
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--gray-500)", wordBreak: "break-all" }}>{post.title}</p>
        {drawerToast && (
          <div style={{ background: "var(--gray-900)", color: "#fff", borderRadius: 6, padding: "8px 14px", fontSize: 13 }}>
            {drawerToast}
          </div>
        )}
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-700)" }}>
            SEO 제목 ({seoTitle.length}/60)
          </span>
          <input
            className="control"
            type="text"
            maxLength={60}
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder="SEO 제목 (최대 60자)"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-700)" }}>
            SEO 설명 ({seoDesc.length}/160)
          </span>
          <textarea
            className="control"
            rows={4}
            maxLength={160}
            value={seoDesc}
            onChange={(e) => setSeoDesc(e.target.value)}
            placeholder="SEO 설명 (최대 160자)"
            style={{ resize: "vertical" }}
          />
        </label>
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </>
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
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>일괄 삭제</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          선택한 <strong>{cnt}개</strong> 게시글을 삭제합니다.
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
            onClick={() => onConfirm(reason.trim())}
          >
            삭제 확정
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 컴포넌트 ───────────────────────────────────────────────────────

function AdminPostsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const boardParam = searchParams.get("board") ?? "all";
  const statusParam = searchParams.get("status") ?? "all";
  const qParam = searchParams.get("q") ?? "";
  const flagParam = searchParams.get("flag") ?? "all";

  const [posts, setPosts] = useState<AdminPostItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(qParam);

  // 현재 관리자 role (세션 쿠키에서 서버사이드로 알 수 없으므로 API 응답으로 확인)
  // 삭제 버튼 표시 여부는 클라이언트에서 세션 확인 없이 항상 렌더링하고,
  // 실제 서버에서 super_admin 체크를 한다. (UX: 403이면 "권한 없음" 토스트)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [seoPost, setSeoPost] = useState<AdminPostItem | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // API 호출
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("pageSize", "20");
      if (boardParam && boardParam !== "all") params.set("board", boardParam);
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
      setMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("게시글 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [pageParam, boardParam, statusParam, qParam, flagParam, showToast]);

  // 현재 관리자 role 조회
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/get-session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.role === "super_admin") setIsSuperAdmin(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // URL 파라미터 업데이트
  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "all" && v !== "") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page"); // 필터 변경 시 1페이지로
    router.push(`/posts?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/posts?${next.toString()}`);
  }

  // ── 액션 함수들 ──────────────────────────────────────────────────────────────

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
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
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
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "delete", note: reason }),
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast(`${selectedIds.size}개 게시글이 삭제되었습니다.`, "success");
      setSelectedIds(new Set());
      fetchPosts();
    } catch {
      showToast("일괄 삭제 중 오류가 발생했습니다.", "error");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === posts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(posts.map((p) => p.id)));
    }
  }

  function handleDownloadCsv() {
    if (posts.length === 0) {
      showToast("다운로드할 게시글이 없습니다.", "error");
      return;
    }
    downloadCsv("admin-posts.csv", posts.map((post) => ({
      id: post.id,
      board: BOARD_LABEL[post.board] ?? post.board,
      title: post.title,
      status: statusBadge(post.status)[1],
      author: post.authorNickname ?? "(운영자)",
      views: post.viewCount,
      comments: post.commentCount,
      likes: post.likeCount,
      reports: post.reportCount,
      createdAt: post.createdAt,
    })));
    showToast("CSV 다운로드를 시작했습니다.", "success");
  }

  const hasSelection = selectedIds.size > 0;

  return (
    <AdminShell breadcrumb={["관리자", "게시글 관리"]} activeKey="posts">
      <div className="page-header">
        <div>
          <h1 className="page-title">게시글 관리</h1>
          <p className="page-description">전체 게시판의 게시글을 검색·필터하고 공지·추천·노출·삭제를 관리합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" type="button" onClick={handleDownloadCsv}>
            <i className="ri-file-excel-2-line" />
            CSV 내보내기
          </button>
          <Link className="btn btn-primary" href="/posts/vibe-guide/new">
            <i className="ri-add-line" />
            새 게시글
          </Link>
        </div>
      </div>

      <section className="section" aria-label="게시글 목록">
        <article className="card">
          {/* 필터 패널 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input
                  className="control"
                  type="search"
                  placeholder="제목·본문 검색"
                  aria-label="게시글 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") updateParams({ q: searchInput }); }}
                />
              </div>

              <div className="custom-select" data-select="board">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{BOARDS.find((b) => b.value === boardParam)?.label ?? "게시판: 전체"}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {BOARDS.map((b) => (
                    <button
                      key={b.value}
                      className={`select-option${boardParam === b.value ? " selected" : ""}`}
                      data-value={b.value}
                      onClick={() => updateParams({ board: b.value })}
                    >
                      {b.label}
                      {boardParam === b.value ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-select" data-select="status">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{STATUSES.find((s) => s.value === statusParam)?.label ?? "상태: 전체"}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      className={`select-option${statusParam === s.value ? " selected" : ""}`}
                      data-value={s.value}
                      onClick={() => updateParams({ status: s.value })}
                    >
                      {s.label}
                      {statusParam === s.value ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-select" data-select="flag">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{FLAGS.find((f) => f.value === flagParam)?.label ?? "속성: 전체"}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {FLAGS.map((f) => (
                    <button
                      key={f.value}
                      className={`select-option${flagParam === f.value ? " selected" : ""}`}
                      data-value={f.value}
                      onClick={() => updateParams({ flag: f.value })}
                    >
                      {f.label}
                      {flagParam === f.value ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="filter-row">
              <div className="filter-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => { setSearchInput(""); router.push("/posts"); }}
                >
                  <i className="ri-refresh-line" />
                  초기화
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => updateParams({ q: searchInput })}
                >
                  <i className="ri-search-line" />
                  검색
                </button>
              </div>
            </div>
          </div>

          {/* 툴바 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 {meta.totalItems}개의 게시글</span>
              <button
                className="btn btn-outline btn-sm"
                disabled={!hasSelection}
                onClick={handleBulkHide}
              >
                <i className="ri-eye-off-line" />
                숨김 처리
              </button>
              {isSuperAdmin && (
                <button
                  className="btn btn-danger btn-sm"
                  disabled={!hasSelection}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <i className="ri-delete-bin-line" />
                  일괄 삭제
                </button>
              )}
            </div>
            <div className="toolbar-right">
              <button className="btn btn-outline btn-sm" type="button" onClick={handleDownloadCsv}>
                <i className="ri-file-excel-2-line" />
                CSV 다운로드
              </button>
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
                    <th style={{ width: 44 }}>
                      <input
                        className="check"
                        type="checkbox"
                        aria-label="전체 선택"
                        checked={posts.length > 0 && selectedIds.size === posts.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>제목</th>
                    <th>게시판</th>
                    <th>작성자</th>
                    <th>작성일</th>
                    <th>조회</th>
                    <th>상태</th>
                    <th style={{ width: 60 }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>
                        게시글이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    posts.map((p) => {
                      const [badgeClass, statusLabel] = statusBadge(p.status);
                      const boardBadge = BOARD_BADGE[p.board] ?? "badge-gray";
                      const boardLabel = BOARD_LABEL[p.board] ?? p.board;
                      // p.board 는 DB 실제값(예: monetization-cases). 관리자 URL 은 slug(money-case)를
                      // 써야 하므로 dbBoardToAdminSlug 로 변환한다. 변환 없이 p.board 를 쓰면
                      // slug≠apiBoard 인 게시판(수익화 사례·공지사항·바이브코딩 등)에서 수정/목록 진입이 404.
                      const adminSlug = dbBoardToAdminSlug(p.board);
                      return (
                        <tr key={p.id}>
                          <td>
                            <input
                              className="check row-check"
                              type="checkbox"
                              aria-label="행 선택"
                              checked={selectedIds.has(p.id)}
                              onChange={() => toggleSelect(p.id)}
                            />
                          </td>
                          <td>
                            <div className="content-title">
                              {p.isNotice ? (
                                <span className="badge badge-red" title="공지글">공지</span>
                              ) : null}
                              {p.isPinned ? (
                                <i className="ri-pushpin-2-fill" title="상단 고정" style={{ color: "var(--primary-600)" }} />
                              ) : null}
                              {p.isFeatured ? (
                                <i className="ri-star-fill" title="추천글" style={{ color: "var(--warning)" }} />
                              ) : null}
                              {p.isMainFeatured ? (
                                <i className="ri-home-4-fill" title="메인 노출" style={{ color: "var(--brand-accent)" }} />
                              ) : null}
                              <Link
                                href={`/posts/${adminSlug}/${p.id}`}
                                style={{ marginLeft: (p.isNotice || p.isPinned || p.isFeatured || p.isMainFeatured) ? 6 : 0 }}
                              >
                                {p.title}
                              </Link>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${boardBadge}`}>{boardLabel}</span>
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
                          <td className="num">{formatDate(p.createdAt)}</td>
                          <td className="num">{p.viewCount.toLocaleString()}</td>
                          <td>
                            <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                          </td>
                          <td>
                            <RowActionMenu
                              items={[
                                { label: "보기", icon: "ri-eye-line", href: `/posts/${adminSlug}/${p.id}` },
                                { label: "수정", icon: "ri-edit-line", href: `/posts/${adminSlug}/${p.id}/edit` },
                                { label: p.isNotice ? "공지 해제" : "공지 설정", icon: "ri-megaphone-line", onClick: () => handleFlag(p.id, "isNotice", p.isNotice) },
                                { label: p.isPinned ? "상단고정 해제" : "상단고정 설정", icon: "ri-pushpin-2-line", onClick: () => handleFlag(p.id, "isPinned", p.isPinned) },
                                { label: p.isFeatured ? "추천 해제" : "추천 지정", icon: "ri-star-line", onClick: () => handleFlag(p.id, "isFeatured", p.isFeatured) },
                                { label: p.isMainFeatured ? "메인노출 해제" : "메인노출 설정", icon: "ri-home-4-line", onClick: () => handleFlag(p.id, "isMainFeatured", p.isMainFeatured) },
                                { label: "SEO 수정", icon: "ri-seo-line", onClick: () => setSeoPost(p) },
                                ...(p.status !== "hidden" ? [{ label: "숨김", icon: "ri-eye-off-line", onClick: () => handleHide(p.id) } as RowActionItem] : []),
                                ...(p.status === "deleted"
                                  ? [{ label: "복구", icon: "ri-arrow-go-back-line", onClick: () => handleRestore(p.id) } as RowActionItem]
                                  : isSuperAdmin
                                  ? [{ label: "삭제", icon: "ri-delete-bin-line", danger: true, onClick: () => setDeleteModal({ id: p.id, title: p.title }) } as RowActionItem]
                                  : []),
                              ]}
                              ariaLabel="게시글 관리 메뉴"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* 페이지네이션 */}
          {meta.totalPages > 1 && (
            <div className="pagination">
              <div className="page-info">
                {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.totalItems)} / 총 {meta.totalItems}개
              </div>
              <div className="page-buttons">
                <button
                  className="page-button"
                  aria-label="이전 페이지"
                  disabled={meta.page <= 1}
                  onClick={() => goPage(meta.page - 1)}
                >
                  <i className="ri-arrow-left-s-line" />
                </button>
                {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      className={`page-button${meta.page === p ? " active" : ""}`}
                      onClick={() => goPage(p)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  className="page-button"
                  aria-label="다음 페이지"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => goPage(meta.page + 1)}
                >
                  <i className="ri-arrow-right-s-line" />
                </button>
              </div>
            </div>
          )}
        </article>
      </section>

      {/* 단일 삭제 모달 */}
      {deleteModal && (
        <DeleteModal
          postId={deleteModal.id}
          postTitle={deleteModal.title}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteModal(null)}
        />
      )}

      {/* 벌크 삭제 모달 */}
      {bulkDeleteOpen && (
        <BulkDeleteModal
          count={selectedIds.size}
          onConfirm={handleBulkDelete}
          onClose={() => setBulkDeleteOpen(false)}
        />
      )}

      {/* SEO 드로어 */}
      <SeoDrawer
        post={seoPost}
        onClose={() => setSeoPost(null)}
        onSaved={() => {
          setSeoPost(null);
          fetchPosts();
        }}
      />

      {/* 토스트 */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

export default function AdminPostsPage() {
  return (
    <Suspense>
      <AdminPostsContent />
    </Suspense>
  );
}

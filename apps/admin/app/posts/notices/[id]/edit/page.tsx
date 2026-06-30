"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, use } from "react";
import type { JSONContent } from "@tiptap/core";
import { AdminShell } from "@/components/layout/AdminShell";
import { Editor, textToTiptapJson } from "@/features/editor";
import { API_BASE_URL } from "@/lib/api";

/**
 * 공지 수정 페이지 (/posts/notices/[id]/edit) — Story 9.17.
 *
 * 1. GET /api/v1/admin/posts/:id 로 게시글 단건을 조회해 폼에 채운다.
 * 2. PATCH /api/v1/admin/posts/:id (본문·제목 수정) — 토스트.
 * 3. PATCH /api/v1/admin/posts/:id/flags (상단고정·메인배너 토글) — 즉시+토스트.
 * 4. PATCH /api/v1/admin/posts/:id/hide  (숨김) — 즉시+토스트.
 * 5. DELETE /api/v1/admin/posts/:id       (삭제, super_admin) — 모달+사유.
 */

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff",
        borderRadius: 8,
        padding: "12px 20px",
        fontSize: 14,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <i className={type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} />
      {message}
      <button
        type="button"
        onClick={onClose}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8 }}
        aria-label="닫기"
      >
        <i className="ri-close-line" />
      </button>
    </div>
  );
}

function DeleteModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--gray-0, #fff)",
          borderRadius: 8,
          padding: 24,
          width: 400,
          boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>공지 삭제</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 16 }}>
          이 공지를 삭제합니다. 삭제 후 복구 가능합니다. super_admin 권한이 필요합니다.
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
            width: "100%",
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 13,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

interface PostData {
  id: string;
  title: string;
  contentJson?: unknown;
  tags?: string[];
  isPinned: boolean;
  isMainFeatured: boolean;
  status: string;
}

export default function NoticeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [contentJson, setContentJson] = useState<JSONContent>(() => textToTiptapJson(""));
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isMainFeatured, setIsMainFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => setToast({ message, type });

  // 게시글 로드 — GET /api/v1/admin/posts/:id 단건 조회
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/admin/posts/${id}`,
          { credentials: "include" },
        );
        if (!res.ok) throw new Error();
        const found = (await res.json()) as PostData;
        setPost(found);
        setTitle(found.title);
        setContentJson((found.contentJson as JSONContent) ?? textToTiptapJson(""));
        setTags(found.tags ?? []);
        setIsPinned(found.isPinned);
        setIsMainFeatured(found.isMainFeatured);
      } catch {
        showToast("공지 정보를 불러오지 못했습니다.", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  async function handleSave() {
    if (!title.trim()) {
      showToast("제목을 입력해주세요.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), contentJson, tags }),
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast("공지가 수정되었습니다.", "success");
    } catch {
      showToast("수정 중 오류가 발생했습니다.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleFlag(flagKey: "isPinned" | "isMainFeatured", current: boolean) {
    const newVal = !current;
    if (flagKey === "isPinned") setIsPinned(newVal);
    else setIsMainFeatured(newVal);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${id}/flags`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [flagKey]: newVal }),
      });
      if (!res.ok) {
        // 실패 시 되돌리기
        if (flagKey === "isPinned") setIsPinned(current);
        else setIsMainFeatured(current);
        showToast("플래그 변경에 실패했습니다.", "error");
        return;
      }
      showToast(
        newVal
          ? (flagKey === "isPinned" ? "상단 고정되었습니다." : "메인/배너에 노출됩니다.")
          : (flagKey === "isPinned" ? "상단 고정이 해제되었습니다." : "메인/배너 노출이 해제되었습니다."),
        "success",
      );
    } catch {
      if (flagKey === "isPinned") setIsPinned(current);
      else setIsMainFeatured(current);
      showToast("플래그 변경 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleHide() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${id}/hide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.status === 403) { showToast("권한이 없습니다.", "error"); return; }
      if (!res.ok) throw new Error();
      if (post) setPost({ ...post, status: "hidden" });
      showToast("공지가 숨김 처리되었습니다.", "success");
    } catch {
      showToast("숨김 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleRestore() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${id}/restore`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      if (post) setPost({ ...post, status: "published" });
      showToast("공지가 복구되었습니다.", "success");
    } catch {
      showToast("복구 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleDelete(reason: string) {
    setShowDeleteModal(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 403) { showToast("최고 관리자(super_admin) 권한이 필요합니다.", "error"); return; }
      if (!res.ok) throw new Error();
      showToast(`공지가 삭제되었습니다. (사유: ${reason})`, "success");
      setTimeout(() => router.push("/posts/notices"), 800);
    } catch {
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  }

  return (
    <AdminShell
      breadcrumb={["관리자", "게시글 관리", "공지사항", "수정"]}
      activeKey="posts"
      activeSubKey="notices"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">공지 수정</h1>
          <p className="page-description">
            <span className="badge badge-red" style={{ marginRight: 6 }}>공지사항</span>
            공지 게시글을 수정합니다.
          </p>
        </div>
        <div className="page-actions">
          {post && post.status !== "hidden" && (
            <button type="button" className="btn btn-outline" onClick={handleHide}>
              <i className="ri-eye-off-line" />
              숨김
            </button>
          )}
          {post && post.status === "hidden" && (
            <button type="button" className="btn btn-outline" onClick={handleRestore}>
              <i className="ri-arrow-go-back-line" />
              복구
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setShowDeleteModal(true)}
          >
            <i className="ri-delete-bin-line" />
            삭제
          </button>
        </div>
      </div>

      <section className="section" aria-label="공지 수정">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
            불러오는 중...
          </div>
        ) : (
          <div className="card">
            <div style={{ padding: "20px", display: "grid", gap: 18 }}>
              {/* 제목 */}
              <div className="field">
                <label className="field-label" htmlFor="notice-title">
                  제목
                </label>
                <input
                  id="notice-title"
                  className="control"
                  type="text"
                  placeholder="공지 제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* 본문 */}
              <div className="field">
                <label className="field-label">본문</label>
                <Editor preset="full" value={contentJson} onChange={(json) => setContentJson(json)} />
              </div>

              {/* 태그 */}
              <div className="field">
                <span className="field-label">태그</span>
                <div className="tag-input">
                  {tags.map((t) => (
                    <span className="tag" key={t}>
                      #{t}
                      <button
                        type="button"
                        aria-label={`${t} 태그 제거`}
                        onClick={() => removeTag(t)}
                      >
                        <i className="ri-close-line" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="태그 입력 후 Enter"
                    aria-label="태그 추가"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                </div>
                <p className="field-help">Enter 로 태그를 추가합니다.</p>
              </div>

              {/* 플래그 토글 */}
              <div className="field">
                <span className="field-label">게시글 속성</span>
                <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
                  {/* 상단 고정 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ color: "var(--gray-800)", fontWeight: 600 }}>상단 고정</div>
                      <div className="field-help" style={{ marginTop: 2 }}>목록 최상단에 고정됩니다. 토글 시 즉시 반영됩니다.</div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={() => handleFlag("isPinned", isPinned)}
                        aria-label="상단 고정"
                      />
                      <span className="switch-track" />
                    </label>
                  </div>
                  {/* 메인/배너 노출 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ color: "var(--gray-800)", fontWeight: 600 }}>메인/배너 노출</div>
                      <div className="field-help" style={{ marginTop: 2 }}>사이트 메인 페이지에 노출됩니다. 토글 시 즉시 반영됩니다.</div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={isMainFeatured}
                        onChange={() => handleFlag("isMainFeatured", isMainFeatured)}
                        aria-label="메인/배너 노출"
                      />
                      <span className="switch-track" />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 하단 액션 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                padding: "16px 20px",
                borderTop: "1px solid var(--gray-200)",
              }}
            >
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => router.push("/posts/notices")}
              >
                목록으로
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={handleSave}
              >
                <i className="ri-save-line" />
                {saving ? "저장 중..." : "수정 저장"}
              </button>
            </div>
          </div>
        )}
      </section>

      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

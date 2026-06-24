"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "@/lib/api";

/**
 * 공지사항 작성 페이지 (/posts/notices/new) — Story 9.17.
 *
 * POST /api/v1/posts { board: 'notice', ... } 로 공지 게시글을 생성한다.
 * 관리자 쿠키(aj_admin_session)가 필요하며, 없으면 API가 403을 반환한다.
 *
 * 에디터: 관리자 전용 구조화 textarea. 본문은 Tiptap JSON 형식으로 변환하여 전달한다.
 * (apps/admin 에 @tiptap/react 미설치 상태이므로, plain-text → paragraph JSON 변환 방식 채택.
 *  추후 Tiptap 설치 시 NoticeEditor.tsx 로 교체 가능.)
 */

// plain text → Tiptap doc JSON 변환 헬퍼
function textToTiptapJson(text: string): Record<string, unknown> {
  const paragraphs = text
    .split("\n")
    .map((line) => ({
      type: "paragraph",
      content: line.trim() ? [{ type: "text", text: line }] : [],
    }));
  return { type: "doc", content: paragraphs.length ? paragraphs : [{ type: "paragraph" }] };
}

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
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

export default function NoticeNewPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isMainFeatured, setIsMainFeatured] = useState(false);
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  async function handleSubmit(submitStatus: "published" | "draft") {
    if (!title.trim()) {
      setToast({ message: "제목을 입력해주세요.", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const contentJson = textToTiptapJson(content);

      // 공지 게시글 생성 — POST /api/v1/admin/posts (관리자 세션 전용)
      // ADR-0003: admin_users ↔ users 완전 분리. 관리자는 user 세션 없음.
      // /api/v1/admin/posts 는 adminGuardHook 이 보호하며 user_id=null 로 공지를 생성한다.
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          contentJson,
          tags,
          status: submitStatus,
          isPinned,
          isMainFeatured,
        }),
      });

      if (res.status === 401) {
        setToast({ message: "관리자 로그인이 필요합니다.", type: "error" });
        return;
      }
      if (res.status === 403) {
        setToast({ message: "공지 작성은 운영자(관리자) 세션이 필요합니다.", type: "error" });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setToast({
          message: (err as { error?: { message?: string } })?.error?.message ?? "공지 작성 중 오류가 발생했습니다.",
          type: "error",
        });
        return;
      }

      setToast({
        message: submitStatus === "published" ? "공지가 발행되었습니다." : "임시저장되었습니다.",
        type: "success",
      });
      setTimeout(() => router.push("/posts/notices"), 800);
    } catch {
      setToast({ message: "공지 작성 중 오류가 발생했습니다.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      breadcrumb={["관리자", "게시글 관리", "공지사항", "새 공지 작성"]}
      activeKey="posts"
      activeSubKey="notices"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">새 공지 작성</h1>
          <p className="page-description">
            <span className="badge badge-red" style={{ marginRight: 6 }}>공지사항</span>
            공지 게시판에 새 게시글을 작성합니다. 운영자 계정만 작성 가능합니다.
          </p>
        </div>
      </div>

      <section className="section" aria-label="새 공지 작성">
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(status);
          }}
        >
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
                required
              />
            </div>

            {/* 본문 */}
            <div className="field">
              <label className="field-label" htmlFor="notice-content">
                본문
              </label>
              <textarea
                id="notice-content"
                className="control"
                style={{ minHeight: 300, resize: "vertical" }}
                placeholder="공지 내용을 입력하세요"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <p className="field-help">
                입력된 텍스트는 Tiptap 단락(paragraph) JSON 포맷으로 변환되어 저장됩니다.
              </p>
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ color: "var(--gray-800)", fontWeight: 600 }}>상단 고정</div>
                    <div className="field-help" style={{ marginTop: 2 }}>목록 최상단에 고정됩니다.</div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      aria-label="상단 고정"
                    />
                    <span className="switch-track" />
                  </label>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ color: "var(--gray-800)", fontWeight: 600 }}>메인/배너 노출</div>
                    <div className="field-help" style={{ marginTop: 2 }}>사이트 메인 페이지에 노출됩니다.</div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={isMainFeatured}
                      onChange={(e) => setIsMainFeatured(e.target.checked)}
                      aria-label="메인/배너 노출"
                    />
                    <span className="switch-track" />
                  </label>
                </div>
              </div>
            </div>

            {/* 상태 */}
            <div className="field">
              <span className="field-label">상태</span>
              <div className="choice-row" style={{ marginTop: 4 }}>
                <label className="choice">
                  <input
                    type="radio"
                    name="notice-status"
                    checked={status === "published"}
                    onChange={() => setStatus("published")}
                  />
                  공개(즉시 발행)
                </label>
                <label className="choice">
                  <input
                    type="radio"
                    name="notice-status"
                    checked={status === "draft"}
                    onChange={() => setStatus("draft")}
                  />
                  임시저장
                </label>
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
              취소
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={saving}
                onClick={() => handleSubmit("draft")}
              >
                <i className="ri-draft-line" />
                임시저장
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                <i className="ri-send-plane-line" />
                {saving ? "저장 중..." : "발행"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { BOARDS } from "@/lib/boards";

export type PostFormDefaults = {
  title?: string;
  content?: string;
  tags?: string[];
  notice?: boolean;
  pinned?: boolean;
  featured?: boolean;
  main?: boolean;
  visibility?: "public" | "hidden";
};

type PostDetail = {
  id: string;
  board: string;
  title: string;
  contentJson: unknown;
  status: "draft" | "published" | "hidden" | "deleted";
  isNotice: boolean;
  isPinned: boolean;
  isFeatured: boolean;
  isMainFeatured: boolean;
  tags?: string[];
};

function textToTiptapJson(text: string): Record<string, unknown> {
  const paragraphs = text.split("\n").map((line) => ({
    type: "paragraph",
    content: line.trim() ? [{ type: "text", text: line }] : [],
  }));
  return { type: "doc", content: paragraphs.length ? paragraphs : [{ type: "paragraph" }] };
}

function tiptapJsonToText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const node = value as { type?: string; text?: string; content?: unknown[] };
  if (node.type === "text") return node.text ?? "";
  if (!Array.isArray(node.content)) return "";
  if (node.type === "paragraph") return node.content.map(tiptapJsonToText).join("");
  return node.content.map(tiptapJsonToText).join("\n").replace(/\n{3,}/g, "\n\n");
}

function parseTags(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .filter((tag, index, arr) => arr.indexOf(tag) === index)
    .slice(0, 10);
}

export function PostForm({
  mode,
  board,
  postId,
  defaults = {},
}: {
  mode: "new" | "edit";
  board: string;
  postId?: string;
  defaults?: PostFormDefaults;
}) {
  const router = useRouter();
  const [selectedBoard, setSelectedBoard] = useState(board);
  const [title, setTitle] = useState(defaults.title ?? "");
  const [content, setContent] = useState(defaults.content ?? "");
  const [tags, setTags] = useState((defaults.tags ?? []).join(", "));
  const [isNotice, setIsNotice] = useState(defaults.notice ?? false);
  const [isPinned, setIsPinned] = useState(defaults.pinned ?? false);
  const [isFeatured, setIsFeatured] = useState(defaults.featured ?? false);
  const [isMainFeatured, setIsMainFeatured] = useState(defaults.main ?? false);
  const [status, setStatus] = useState<"published" | "draft" | "hidden">(
    defaults.visibility === "hidden" ? "hidden" : "published",
  );
  const [loading, setLoading] = useState(mode === "edit" && Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !postId) return;
    let alive = true;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/v1/admin/posts/${postId}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("load failed");
        return (await res.json()) as PostDetail;
      })
      .then((post) => {
        if (!alive) return;
        setSelectedBoard(post.board);
        setTitle(post.title);
        setContent(tiptapJsonToText(post.contentJson));
        setTags((post.tags ?? []).join(", "));
        setIsNotice(post.isNotice);
        setIsPinned(post.isPinned);
        setIsFeatured(post.isFeatured);
        setIsMainFeatured(post.isMainFeatured);
        setStatus(post.status === "hidden" ? "hidden" : post.status === "draft" ? "draft" : "published");
      })
      .catch(() => {
        if (alive) setMessage({ type: "error", text: "게시글을 불러오지 못했습니다." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, postId]);

  async function save(nextStatus: "published" | "draft" | "hidden" = status) {
    if (!title.trim()) {
      setMessage({ type: "error", text: "제목을 입력해주세요." });
      return;
    }
    setSaving(true);
    setMessage(null);

    const payload = {
      board: selectedBoard,
      title: title.trim(),
      contentJson: textToTiptapJson(content),
      tags: parseTags(tags),
      status: nextStatus,
      isNotice,
      isPinned,
      isFeatured,
      isMainFeatured,
    };

    try {
      const url =
        mode === "edit" && postId
          ? `${API_BASE_URL}/api/v1/admin/posts/${postId}`
          : `${API_BASE_URL}/api/v1/admin/posts`;
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage({
          type: "error",
          text: (err as { error?: { message?: string } })?.error?.message ?? "저장 중 오류가 발생했습니다.",
        });
        return;
      }

      const result = (await res.json().catch(() => ({}))) as { id?: string; board?: string };
      setMessage({ type: "success", text: mode === "edit" ? "게시글이 수정되었습니다." : "게시글이 등록되었습니다." });
      setTimeout(() => {
        router.push(`/posts/${result.board ?? selectedBoard}`);
        router.refresh();
      }, 500);
    } catch {
      setMessage({ type: "error", text: "저장 중 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!postId || !confirm("이 게시글을 삭제할까요?")) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setMessage({ type: "error", text: res.status === 403 ? "최고 관리자 권한이 필요합니다." : "삭제에 실패했습니다." });
        return;
      }
      setMessage({ type: "success", text: "게시글이 삭제되었습니다." });
      setTimeout(() => router.push(`/posts/${selectedBoard}`), 500);
    } catch {
      setMessage({ type: "error", text: "삭제 중 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  }

  const toggles = [
    { key: "notice", label: "공지글로 등록", help: "게시판 상단에 공지로 노출됩니다.", checked: isNotice, set: setIsNotice },
    { key: "pinned", label: "상단 고정", help: "목록 최상단에 고정됩니다.", checked: isPinned, set: setIsPinned },
    { key: "featured", label: "추천글 지정", help: "추천글 영역에 노출됩니다.", checked: isFeatured, set: setIsFeatured },
    { key: "main", label: "메인 노출", help: "사이트 메인 페이지에 노출됩니다.", checked: isMainFeatured, set: setIsMainFeatured },
  ] as const;

  return (
    <form
      className="card"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div style={{ padding: "20px", display: "grid", gap: 18 }}>
        {message && (
          <div className={`alert ${message.type === "success" ? "alert-success" : "alert-danger"}`}>
            {message.text}
          </div>
        )}
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--gray-500)" }}>불러오는 중...</div>
        ) : (
          <>
            <div className="field">
              <label className="field-label" htmlFor="post-title">제목</label>
              <input id="post-title" className="control" type="text" placeholder="게시글 제목을 입력하세요" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="post-board">게시판</label>
              <select id="post-board" className="control" value={selectedBoard} onChange={(e) => setSelectedBoard(e.target.value)}>
                {BOARDS.map((b) => (
                  <option key={b.slug} value={b.slug}>{b.label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="post-content">본문</label>
              <textarea id="post-content" className="control" style={{ minHeight: 240 }} placeholder="본문 내용을 입력하세요" value={content} onChange={(e) => setContent(e.target.value)} />
              <p className="field-help">입력한 텍스트는 Tiptap paragraph JSON으로 저장됩니다.</p>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="post-tags">태그</label>
              <input id="post-tags" className="control" type="text" placeholder="쉼표로 태그를 구분하세요" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>

            <div className="field">
              <span className="field-label">게시글 속성</span>
              <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
                {toggles.map((t) => (
                  <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ color: "var(--gray-800)", fontWeight: 600 }}>{t.label}</div>
                      <div className="field-help" style={{ marginTop: 2 }}>{t.help}</div>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={t.checked} onChange={(e) => t.set(e.target.checked)} aria-label={t.label} />
                      <span className="switch-track" />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">상태</span>
              <div className="choice-row" style={{ marginTop: 4 }}>
                <label className="choice"><input type="radio" name="post-status" checked={status === "published"} onChange={() => setStatus("published")} /> 공개</label>
                <label className="choice"><input type="radio" name="post-status" checked={status === "draft"} onChange={() => setStatus("draft")} /> 임시저장</label>
                <label className="choice"><input type="radio" name="post-status" checked={status === "hidden"} onChange={() => setStatus("hidden")} /> 숨김</label>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "16px 20px", borderTop: "1px solid var(--gray-200)" }}>
        <Link className="btn btn-outline" href={`/posts/${selectedBoard}`}>취소</Link>
        <div style={{ display: "flex", gap: 8 }}>
          {mode === "new" ? (
            <>
              <button className="btn btn-outline" type="button" disabled={saving || loading} onClick={() => save("draft")}><i className="ri-draft-line" />임시저장</button>
              <button className="btn btn-primary" type="submit" disabled={saving || loading}><i className="ri-send-plane-line" />{saving ? "저장 중..." : "발행"}</button>
            </>
          ) : (
            <>
              <button className="btn btn-danger" type="button" disabled={saving || loading} onClick={remove}><i className="ri-delete-bin-line" />삭제</button>
              <button className="btn btn-primary" type="submit" disabled={saving || loading}><i className="ri-save-line" />{saving ? "저장 중..." : "수정 저장"}</button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

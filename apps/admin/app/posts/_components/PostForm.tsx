"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { API_BASE_URL } from "@/lib/api";
import { BOARDS } from "@/lib/boards";
import { confirmDialog } from "@/lib/dialog";
import { Select } from "@/components/ui/Select";
import { Editor, textToTiptapJson } from "@/features/editor";
import { AttachmentUpload } from "@/components/ui/AttachmentUpload";

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
  const [contentJson, setContentJson] = useState<JSONContent>(() =>
    textToTiptapJson(defaults.content ?? ""),
  );
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

  /**
   * 첨부파일 상태 — 신규 작성 시 save()에서 POST /api/v1/admin/posts/attachments 로
   * 업로드 후 반환 메타를 본문 attachments 에 포함한다.
   */
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  /** 관리자 파일설정: site_settings에서 읽고, 실패 시 기본값 유지 */
  const [fileSettings, setFileSettings] = useState({
    allowedExtensions: [".zip", ".pdf", ".json", ".md", ".txt", ".csv", ".xlsx"],
    maxFiles: 5,
    maxSizeMb: 10,
  });

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/settings`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return; // staff는 403 → 기본값 유지
        const settings = (await res.json()) as Record<string, unknown>;
        const extRaw =
          typeof settings.file_allowed_extensions === "string" && settings.file_allowed_extensions.trim()
            ? settings.file_allowed_extensions
            : null;
        const allowedExtensions = extRaw
          ? extRaw.split(",").map((e) => e.trim()).filter(Boolean)
          : undefined;
        const maxSizeMb =
          typeof settings.max_upload_mb === "number" && settings.max_upload_mb > 0
            ? settings.max_upload_mb
            : undefined;
        if (allowedExtensions || maxSizeMb) {
          setFileSettings((prev) => ({
            ...prev,
            ...(allowedExtensions ? { allowedExtensions } : {}),
            ...(maxSizeMb ? { maxSizeMb } : {}),
          }));
        }
      })
      .catch(() => {}); // 오류 시 기본값 유지
  }, []);

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
        setContentJson((post.contentJson as JSONContent) ?? textToTiptapJson(""));
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

    // 첨부파일 업로드 (신규 작성 시) — 업로드 후 반환된 메타를 본문에 포함
    let uploadedAttachments: { url: string; name: string; size: number; mimeType: string }[] = [];
    if (mode !== "edit" && selectedFiles.length > 0) {
      try {
        const fd = new FormData();
        selectedFiles.forEach((f) => fd.append("files", f));
        const upRes = await fetch(`${API_BASE_URL}/api/v1/admin/posts/attachments`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (!upRes.ok) {
          const e = await upRes.json().catch(() => ({}));
          setMessage({
            type: "error",
            text: (e as { error?: { message?: string } })?.error?.message ?? "첨부파일 업로드에 실패했습니다.",
          });
          setSaving(false);
          return;
        }
        const upJson = (await upRes.json()) as {
          files: { url: string; name: string; size: number; mimeType: string }[];
        };
        uploadedAttachments = upJson.files ?? [];
      } catch {
        setMessage({ type: "error", text: "첨부파일 업로드 중 오류가 발생했습니다." });
        setSaving(false);
        return;
      }
    }

    const payload = {
      board: selectedBoard,
      title: title.trim(),
      contentJson,
      tags: parseTags(tags),
      status: nextStatus,
      isNotice,
      isPinned,
      isFeatured,
      isMainFeatured,
      attachments: uploadedAttachments,
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
    if (!postId || !(await confirmDialog({ title: "삭제", message: "이 게시글을 삭제할까요?", tone: "danger" }))) return;
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
              <label className="field-label">게시판</label>
              <Select
                id="post-board"
                options={BOARDS.map((b) => ({ value: b.slug, label: b.label }))}
                value={selectedBoard}
                onChange={(v) => setSelectedBoard(v)}
              />
            </div>

            <div className="field">
              <label className="field-label">본문</label>
              <Editor preset="full" value={contentJson} onChange={(json) => setContentJson(json)} />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="post-tags">태그</label>
              <input id="post-tags" className="control" type="text" placeholder="쉼표로 태그를 구분하세요" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>

            <div className="field">
              <label className="field-label">
                첨부파일{" "}
                <span className="field-help" style={{ fontWeight: 400 }}>
                  (최대 {fileSettings.maxFiles}개 · 파일당 최대 {fileSettings.maxSizeMb}MB)
                </span>
              </label>
              {mode === "edit" && (
                <div className="field-help" style={{ marginBottom: 8 }}>
                  첨부파일 추가는 새 글 작성 시 지원됩니다.
                </div>
              )}
              {mode !== "edit" && (
                <AttachmentUpload
                  files={selectedFiles}
                  onFilesChange={setSelectedFiles}
                  allowedExtensions={fileSettings.allowedExtensions}
                  maxFiles={fileSettings.maxFiles}
                  maxSizeMb={fileSettings.maxSizeMb}
                />
              )}
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

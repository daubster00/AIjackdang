"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { AdminShell } from "@/components/layout/AdminShell";
import { Select } from "@/components/ui/Select";
import { Editor, textToTiptapJson } from "@/features/editor";
import { API_BASE_URL } from "@/lib/api";
import { confirmDialog } from "@/lib/dialog";
import {
  AttachmentUpload,
  type AttachmentExistingFile,
} from "@/components/ui/AttachmentUpload";

const TYPE_OPTIONS = [
  { value: "prompt", label: "프롬프트" },
  { value: "claude-code-skill", label: "Claude Code Skill" },
  { value: "mcp", label: "MCP" },
  { value: "rules-config", label: "Rules/Config" },
  { value: "template-checklist", label: "템플릿/체크리스트" },
] as const;

const ENV_OPTIONS = [
  { value: "claude-code", label: "Claude Code" },
  { value: "n8n", label: "n8n" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "cursor", label: "Cursor" },
  { value: "cross", label: "환경 무관" },
] as const;

const STATUS_OPTIONS = [
  { value: "published", label: "공개" },
  { value: "draft", label: "임시저장" },
  { value: "hidden", label: "숨김" },
] as const;

type ResourceType = (typeof TYPE_OPTIONS)[number]["value"];
type ResourceStatus = (typeof STATUS_OPTIONS)[number]["value"];

/** 관리자 파일관리 설정 미지정 시 대체값 */
const DEFAULT_FILE_SETTINGS = {
  allowedExtensions: [".zip", ".docx", ".xlsx", ".pdf", ".md", ".txt", ".json"],
  maxFiles: 3,
  maxSizeMb: 50,
};

type ResourceFile = {
  id: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  allowedExtension: string;
  fileStatus: string;
  displayOrder: number;
  createdAt: string;
};

type ResourceDetail = {
  id: string;
  title: string;
  summary: string;
  resourceType: ResourceType;
  environment: string[];
  difficulty: string;
  status: ResourceStatus | "deleted";
  descriptionJson: unknown;
  usageJson: unknown;
  version: string | null;
  files?: ResourceFile[];
};

type ResourceFormDefaults = {
  title: string;
  type: string;
  env: string;
  status: string;
  desc: string;
  price: string;
  points: string;
};

function asType(value: string | undefined): ResourceType {
  return TYPE_OPTIONS.some((option) => option.value === value) ? (value as ResourceType) : "prompt";
}

function asStatus(value: string | undefined): ResourceStatus {
  if (value === "hidden" || value === "draft") return value;
  return "published";
}

/** site_settings 응답에서 파일 설정을 파싱한다. */
function parseFileSettings(settings: Record<string, unknown>) {
  const extRaw =
    typeof settings.resource_extensions === "string" && settings.resource_extensions.trim()
      ? settings.resource_extensions
      : typeof settings.file_allowed_extensions === "string" && settings.file_allowed_extensions.trim()
        ? settings.file_allowed_extensions
        : null;

  const allowedExtensions = extRaw
    ? extRaw
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
    : DEFAULT_FILE_SETTINGS.allowedExtensions;

  const maxSizeMb =
    typeof settings.max_upload_mb === "number" && settings.max_upload_mb > 0
      ? settings.max_upload_mb
      : DEFAULT_FILE_SETTINGS.maxSizeMb;

  return { allowedExtensions, maxFiles: DEFAULT_FILE_SETTINGS.maxFiles, maxSizeMb };
}

export function ResourceForm({
  mode,
  id,
  defaults,
}: {
  mode: "new" | "edit";
  id?: string;
  defaults?: ResourceFormDefaults;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const backHref = isEdit && id ? `/resources/${id}` : "/resources";

  const [title, setTitle] = useState(defaults?.title ?? "");
  const [summary, setSummary] = useState("");
  const [type, setType] = useState<ResourceType>(asType(defaults?.type));
  const [env, setEnv] = useState(defaults?.env ?? "claude-code");
  const [status, setStatus] = useState<ResourceStatus>(asStatus(defaults?.status));
  const [descJson, setDescJson] = useState<JSONContent>(() =>
    textToTiptapJson(defaults?.desc ?? ""),
  );
  const [usageJson, setUsageJson] = useState<JSONContent>(() => textToTiptapJson(""));
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(isEdit && Boolean(id));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<ResourceFile[]>([]);

  /**
   * 관리자 파일관리 설정(site_settings)에서 허용 확장자·크기 제한을 읽는다.
   * GET /api/v1/admin/settings는 super_admin 전용이므로 실패 시 기본값으로 폴백.
   */
  const [fileSettings, setFileSettings] = useState(DEFAULT_FILE_SETTINGS);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/settings`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return; // staff는 403 → 기본값 유지
        const settings = (await res.json()) as Record<string, unknown>;
        setFileSettings(parseFileSettings(settings));
      })
      .catch(() => {}); // 네트워크 오류 시 기본값 유지
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let alive = true;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/v1/admin/resources/${id}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("load failed");
        return (await res.json()) as ResourceDetail;
      })
      .then((resource) => {
        if (!alive) return;
        setTitle(resource.title);
        setSummary(resource.summary);
        setType(asType(resource.resourceType));
        setEnv(resource.environment[0] ?? "claude-code");
        setStatus(asStatus(resource.status));
        setDescJson((resource.descriptionJson as JSONContent) ?? textToTiptapJson(""));
        setUsageJson((resource.usageJson as JSONContent) ?? textToTiptapJson(""));
        setVersion(resource.version ?? "");
        if (resource.files) {
          setExistingFiles(resource.files.filter((f) => f.fileStatus !== "deleted"));
        }
      })
      .catch(() => {
        if (alive) setMessage({ type: "error", text: "자료를 불러오지 못했습니다." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, isEdit]);

  async function uploadFiles(resourceId: string): Promise<string | null> {
    if (selectedFiles.length === 0) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append("files", file);
      }
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/resources/${resourceId}/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return (err as { error?: { message?: string } })?.error?.message ?? "파일 업로드 중 오류가 발생했습니다.";
      }
      setSelectedFiles([]);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(fileId: string) {
    if (!id) return;
    if (!(await confirmDialog({ title: "삭제", message: "이 첨부파일을 삭제하시겠습니까?", tone: "danger" }))) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/resources/${id}/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "관리자 삭제" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage({
          type: "error",
          text: (err as { error?: { message?: string } })?.error?.message ?? "파일 삭제 중 오류가 발생했습니다.",
        });
        return;
      }
      setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      setMessage({ type: "error", text: "파일 삭제 중 오류가 발생했습니다." });
    }
  }

  async function save() {
    if (!title.trim() || !summary.trim()) {
      setMessage({ type: "error", text: "자료명과 요약은 필수입니다." });
      return;
    }
    setSaving(true);
    setMessage(null);

    const payload = {
      title: title.trim(),
      summary: summary.trim(),
      resourceType: type,
      environment: [env],
      status,
      descriptionJson: descJson,
      usageJson: usageJson,
      version: version.trim() || undefined,
    };

    try {
      const url = isEdit && id ? `${API_BASE_URL}/api/v1/admin/resources/${id}` : `${API_BASE_URL}/api/v1/admin/resources`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
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
      const result = (await res.json().catch(() => ({}))) as { id?: string };
      // 메타데이터 저장 완료 후 파일 업로드 (create: 새 id 사용, edit: 기존 id 사용)
      const targetId = result.id ?? id;
      if (targetId && selectedFiles.length > 0) {
        setSaving(false);
        const uploadError = await uploadFiles(targetId);
        if (uploadError) {
          setMessage({ type: "error", text: uploadError });
          return;
        }
      }
      setMessage({ type: "success", text: isEdit ? "자료가 수정되었습니다." : "자료가 등록되었습니다." });
      setTimeout(() => {
        router.push(result.id ? `/resources/${result.id}` : "/resources");
        router.refresh();
      }, 500);
    } catch {
      setMessage({ type: "error", text: "저장 중 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  }

  /** ResourceFile[] → AttachmentExistingFile[] 변환 */
  const existingForUpload: AttachmentExistingFile[] = existingFiles.map((f) => ({
    id: f.id,
    name: f.originalName,
    size: f.fileSize,
  }));

  return (
    <AdminShell breadcrumb={["관리자", "실전자료 관리", isEdit ? "자료 수정" : "새 자료 등록"]} activeKey="resources">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? "자료 수정" : "새 자료 등록"}</h1>
          <p className="page-description">
            {isEdit ? "운영자 권한으로 실전자료 내용을 수정합니다." : "운영자가 직접 실전자료를 등록합니다."}
          </p>
        </div>
        <div className="page-actions">
          <a className="btn btn-outline" href={backHref}><i className="ri-arrow-left-line" />취소</a>
          <button className="btn btn-primary" type="button" onClick={save} disabled={saving || uploading || loading}><i className="ri-save-line" />{saving ? "저장 중..." : uploading ? "업로드 중..." : isEdit ? "변경 저장" : "자료 등록"}</button>
        </div>
      </div>

      <section className="section">
        <article className="card">
          <div className="card-body component-stack">
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
                  <label className="field-label" htmlFor="res-title">자료명</label>
                  <input className="control" id="res-title" type="text" placeholder="자료명을 입력하세요" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="res-summary">요약</label>
                  <input className="control" id="res-summary" type="text" placeholder="목록에 표시할 한 줄 요약" value={summary} onChange={(e) => setSummary(e.target.value)} />
                </div>

                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="field">
                    <label className="field-label">자료유형</label>
                    <Select
                      id="res-type"
                      options={[...TYPE_OPTIONS]}
                      value={type}
                      onChange={(v) => setType(asType(v))}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">지원환경</label>
                    <Select
                      id="res-env"
                      options={[...ENV_OPTIONS]}
                      value={env}
                      onChange={(v) => setEnv(v)}
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">상태</label>
                  <Select
                    id="res-status"
                    options={[...STATUS_OPTIONS]}
                    value={status}
                    onChange={(v) => setStatus(asStatus(v))}
                  />
                </div>

                <div className="field">
                  <label className="field-label">자료 설명</label>
                  <Editor preset="full" value={descJson} onChange={(json) => setDescJson(json)} />
                </div>

                <div className="field">
                  <label className="field-label">사용법</label>
                  <Editor preset="full" value={usageJson} onChange={(json) => setUsageJson(json)} />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="res-version">버전</label>
                  <input className="control" id="res-version" type="text" placeholder="예: 1.0.0" value={version} onChange={(e) => setVersion(e.target.value)} />
                </div>

                <div className="field">
                  <label className="field-label">
                    첨부파일{" "}
                    <span className="field-help" style={{ fontWeight: 400 }}>
                      (최대 {fileSettings.maxFiles}개 · 파일당 최대 {fileSettings.maxSizeMb}MB)
                    </span>
                  </label>
                  {/* 드롭존 UI — 허용 확장자·크기는 관리자 파일관리 설정에서 읽음 */}
                  <AttachmentUpload
                    files={selectedFiles}
                    onFilesChange={setSelectedFiles}
                    existingFiles={existingForUpload}
                    onDeleteExisting={isEdit ? deleteFile : undefined}
                    allowedExtensions={fileSettings.allowedExtensions}
                    maxFiles={fileSettings.maxFiles}
                    maxSizeMb={fileSettings.maxSizeMb}
                  />
                  {uploading && (
                    <p className="field-help" style={{ marginTop: 8 }}>업로드 중...</p>
                  )}
                </div>
              </>
            )}
          </div>
        </article>

        <div className="page-actions" style={{ marginTop: "16px", justifyContent: "flex-end" }}>
          <a className="btn btn-outline" href={backHref}>취소</a>
          <button className="btn btn-primary" type="button" onClick={save} disabled={saving || uploading || loading}><i className="ri-save-line" />{saving ? "저장 중..." : uploading ? "업로드 중..." : isEdit ? "변경 저장" : "자료 등록"}</button>
        </div>
      </section>
    </AdminShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "@/lib/api";

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

const LEVEL_OPTIONS = [
  { value: "beginner", label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
] as const;

const STATUS_OPTIONS = [
  { value: "published", label: "공개" },
  { value: "draft", label: "임시저장" },
  { value: "hidden", label: "숨김" },
] as const;

type ResourceType = (typeof TYPE_OPTIONS)[number]["value"];
type Difficulty = (typeof LEVEL_OPTIONS)[number]["value"];
type ResourceStatus = (typeof STATUS_OPTIONS)[number]["value"];

type ResourceDetail = {
  id: string;
  title: string;
  summary: string;
  resourceType: ResourceType;
  environment: string[];
  difficulty: Difficulty;
  status: ResourceStatus | "deleted";
  descriptionJson: unknown;
  usageJson: unknown;
  version: string | null;
};

type ResourceFormDefaults = {
  title: string;
  type: string;
  env: string;
  level: string;
  status: string;
  desc: string;
  price: string;
  points: string;
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

function asType(value: string | undefined): ResourceType {
  return TYPE_OPTIONS.some((option) => option.value === value) ? (value as ResourceType) : "prompt";
}

function asDifficulty(value: string | undefined): Difficulty {
  return LEVEL_OPTIONS.some((option) => option.value === value) ? (value as Difficulty) : "beginner";
}

function asStatus(value: string | undefined): ResourceStatus {
  if (value === "hidden" || value === "draft") return value;
  return "published";
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
  const [level, setLevel] = useState<Difficulty>(asDifficulty(defaults?.level));
  const [status, setStatus] = useState<ResourceStatus>(asStatus(defaults?.status));
  const [desc, setDesc] = useState(defaults?.desc ?? "");
  const [usage, setUsage] = useState("");
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(isEdit && Boolean(id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
        setLevel(asDifficulty(resource.difficulty));
        setStatus(asStatus(resource.status));
        setDesc(tiptapJsonToText(resource.descriptionJson));
        setUsage(tiptapJsonToText(resource.usageJson));
        setVersion(resource.version ?? "");
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

  async function save() {
    if (!title.trim() || !summary.trim() || !desc.trim()) {
      setMessage({ type: "error", text: "자료명, 요약, 자료 설명은 필수입니다." });
      return;
    }
    setSaving(true);
    setMessage(null);

    const payload = {
      title: title.trim(),
      summary: summary.trim(),
      resourceType: type,
      environment: [env],
      difficulty: level,
      status,
      descriptionJson: textToTiptapJson(desc),
      usageJson: textToTiptapJson(usage || "관리자 등록 자료입니다."),
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
          <button className="btn btn-primary" type="button" onClick={save} disabled={saving || loading}><i className="ri-save-line" />{saving ? "저장 중..." : isEdit ? "변경 저장" : "자료 등록"}</button>
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
                    <label className="field-label" htmlFor="res-type">자료유형</label>
                    <select className="control" id="res-type" value={type} onChange={(e) => setType(asType(e.target.value))}>
                      {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="res-env">지원환경</label>
                    <select className="control" id="res-env" value={env} onChange={(e) => setEnv(e.target.value)}>
                      {ENV_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="field">
                    <label className="field-label" htmlFor="res-level">난이도</label>
                    <select className="control" id="res-level" value={level} onChange={(e) => setLevel(asDifficulty(e.target.value))}>
                      {LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="res-status">상태</label>
                    <select className="control" id="res-status" value={status} onChange={(e) => setStatus(asStatus(e.target.value))}>
                      {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="res-desc">자료 설명</label>
                  <textarea className="control" id="res-desc" rows={8} placeholder="자료 내용·사용법을 설명하세요" value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="res-usage">사용법</label>
                  <textarea className="control" id="res-usage" rows={5} placeholder="설치/사용 절차를 입력하세요" value={usage} onChange={(e) => setUsage(e.target.value)} />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="res-version">버전</label>
                  <input className="control" id="res-version" type="text" placeholder="예: 1.0.0" value={version} onChange={(e) => setVersion(e.target.value)} />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="res-file">첨부파일</label>
                  <input className="control" id="res-file" type="file" multiple disabled />
                  <p className="field-help">파일 업로드는 사용자 자료 업로드/R2 스캔 파이프라인과 별도 연결이 필요해 현재 메타데이터 저장만 처리합니다.</p>
                </div>
              </>
            )}
          </div>
        </article>

        <div className="page-actions" style={{ marginTop: "16px", justifyContent: "flex-end" }}>
          <a className="btn btn-outline" href={backHref}>취소</a>
          <button className="btn btn-primary" type="button" onClick={save} disabled={saving || loading}><i className="ri-save-line" />{saving ? "저장 중..." : isEdit ? "변경 저장" : "자료 등록"}</button>
        </div>
      </section>
    </AdminShell>
  );
}

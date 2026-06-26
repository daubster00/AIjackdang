"use client";

/**
 * ResourceWriteForm — 자료 등록·수정 단일 폼 (수정요청 반영)
 *
 * 기존 7-Step 마법사를 폐기하고 다른 게시판처럼 한 화면에서 한 번에 작성하는 폼으로 변경.
 * - 난이도 입력 제거 (서버 계약 호환을 위해 내부적으로 "beginner" 고정 전송)
 * - "이 자료는 무엇인가요? / 사용법 / 주의사항" 3개 입력을 → "자료설명" 하나로 통합
 *   (descriptionJson 으로만 저장. usageJson 은 빈 문서로 전송, cautionJson 은 미전송)
 * - 미리보기 단계 제거
 */

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Editor } from "@/features/editor";
import { Icon } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast/Toast";
import { useAuth } from "@/hooks/useAuth";
import styles from "./resource-new.module.css";

// ── 상수 ──────────────────────────────────────────────────────────────────────

/** 5개 유형 카드 정의 */
const RESOURCE_TYPES = [
  { value: "prompt", label: "프롬프트", icon: "chat-quote-line", hint: "재사용 가능한 AI 프롬프트" },
  { value: "claude-code-skill", label: "Claude Code Skill", icon: "terminal-box-line", hint: "Claude Code 커스텀 슬래시 커맨드" },
  { value: "mcp", label: "MCP", icon: "plug-line", hint: "Model Context Protocol 서버" },
  { value: "rules-config", label: "Rules · 설정", icon: "settings-3-line", hint: ".cursorrules / CLAUDE.md 등 설정 파일" },
  { value: "template-checklist", label: "템플릿 · 체크리스트", icon: "file-list-3-line", hint: "작업 템플릿 및 체크리스트" },
] as const;

export type ResourceTypeValue = (typeof RESOURCE_TYPES)[number]["value"];

/** 허용 파일 확장자 */
const ALLOWED_EXTS = ["zip", "md", "txt", "json", "pdf", "docx", "xlsx"] as const;
type AllowedExt = (typeof ALLOWED_EXTS)[number];

/** 파일 제한 */
const MAX_FILES = 3;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/** 태그 제한 */
const MAX_TAGS = 10;

/** 지원 환경 목록 */
const ENV_OPTIONS = ["Claude Desktop", "Cursor", "Claude Code", "VSCode", "기타"] as const;

/** 추천 태그 */
const SUGGESTED_TAGS = [
  "프롬프트", "클로드", "AI", "자동화", "생산성",
  "코드리뷰", "문서화", "Claude Code", "MCP", "커서",
];

/** 빈 Tiptap 문서 */
const EMPTY_DOC: JSONContent = { type: "doc", content: [] };

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface AttachedFile {
  file: File;
  sizeLabel: string;
  error: string | null;
}

/**
 * 편집 모드용 초기 데이터 (Story 4.8).
 * 모든 필드 선택적 — 제공된 필드만 폼에 prefill.
 */
export interface ResourceWriteFormInitialData {
  resourceType?: ResourceTypeValue;
  title?: string;
  summary?: string;
  environment?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced";
  descriptionJson?: JSONContent;
  usageJson?: JSONContent;
  cautionJson?: JSONContent | null;
  version?: string;
  tags?: string[];
}

export interface ResourceWriteFormProps {
  /** 편집 대상 자료 ID (undefined = 신규 등록 모드) */
  resourceId?: string;
  /** 편집 모드용 초기 데이터 */
  initialData?: ResourceWriteFormInitialData;
  /** 성공 후 이동할 slug (편집 모드에서 사용) */
  returnSlug?: string;
  /**
   * 게시판별 고정 유형 (제공 시 유형 선택 UI를 숨기고 이 값으로 등록).
   * /resources/{type}/write 경로에서 해당 게시판 유형을 고정 전달한다.
   */
  fixedResourceType?: ResourceTypeValue;
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isAllowedExt(ext: string): ext is AllowedExt {
  return ALLOWED_EXTS.includes(ext as AllowedExt);
}

function typeToPageType(resourceType: string): string {
  const map: Record<string, string> = {
    prompt: "prompts",
    "claude-code-skill": "mcp-skills",
    mcp: "mcp-skills",
    "rules-config": "rules",
    "template-checklist": "templates",
  };
  return map[resourceType] ?? "prompts";
}

/** Tiptap 문서가 비어있는지 검사 */
function isEmptyDoc(doc: JSONContent | undefined | null): boolean {
  if (!doc || !doc.content) return true;
  return doc.content.length === 0;
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function ResourceWriteForm({
  resourceId,
  initialData,
  returnSlug,
  fixedResourceType,
}: ResourceWriteFormProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const { toast } = useToast();

  const isEditMode = !!resourceId;

  // ── 입력 상태 ──────────────────────────────────────────────────────────────
  // fixedResourceType이 주어지면 그 값으로 고정, 아니면 initialData 또는 기본값 사용
  const [resourceType, setResourceType] = useState<ResourceTypeValue>(
    fixedResourceType ?? initialData?.resourceType ?? "prompt",
  );
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [summary, setSummary] = useState(initialData?.summary ?? "");
  const [environments, setEnvironments] = useState<string[]>(initialData?.environment ?? []);
  const [descriptionJson, setDescriptionJson] = useState<JSONContent>(
    initialData?.descriptionJson ?? EMPTY_DOC,
  );

  // ── 첨부파일 ───────────────────────────────────────────────────────────────
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [primaryFileIndex, setPrimaryFileIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 태그 ───────────────────────────────────────────────────────────────────
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  // ── 저작권 ────────────────────────────────────────────────────────────────
  const [copyrightAgreed, setCopyrightAgreed] = useState(false);

  // ── 제출 상태 ──────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── 유효성 오류 ────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (title.trim().length < 2) next.title = "제목은 2자 이상 입력해 주세요.";
    if (title.trim().length > 150) next.title = "제목은 150자 이하로 입력해 주세요.";
    if (summary.trim().length < 1) next.summary = "한줄설명을 입력해 주세요.";
    if (summary.trim().length > 300) next.summary = "한줄설명은 300자 이하로 입력해 주세요.";
    if (isEmptyDoc(descriptionJson)) next.description = "자료설명을 입력해 주세요.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast({ tone: "warning", title: Object.values(next)[0] });
      return false;
    }
    return true;
  }

  // ── 파일 처리 ──────────────────────────────────────────────────────────────

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      setFileError(null);

      const next: AttachedFile[] = [];
      for (const f of Array.from(incoming)) {
        const ext = extOf(f.name);
        if (!isAllowedExt(ext)) {
          setFileError(`허용되지 않는 형식입니다: .${ext} (가능: ${ALLOWED_EXTS.join(", ")})`);
          continue;
        }
        if (f.size > MAX_FILE_SIZE) {
          setFileError(`파일 크기 초과: ${f.name} (최대 50MB)`);
          continue;
        }
        next.push({ file: f, sizeLabel: formatSize(f.size), error: null });
      }

      setFiles((prev) => {
        const combined = [...prev, ...next].slice(0, MAX_FILES);
        if (combined.length > 0 && primaryFileIndex === null) {
          setPrimaryFileIndex(0);
        }
        return combined;
      });
    },
    [primaryFileIndex],
  );

  function removeFile(index: number) {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (primaryFileIndex === index) {
        setPrimaryFileIndex(next.length > 0 ? 0 : null);
      } else if (primaryFileIndex !== null && primaryFileIndex > index) {
        setPrimaryFileIndex(primaryFileIndex - 1);
      }
      return next;
    });
  }

  // ── 태그 처리 ──────────────────────────────────────────────────────────────

  function addTag(raw: string) {
    const tag = raw.trim().replace(/^#/, "");
    if (!tag) return;
    if (tags.includes(tag) || tags.length >= MAX_TAGS) return;
    setTags((prev) => [...prev, tag]);
    setTagInput("");
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  // ── API 제출 ───────────────────────────────────────────────────────────────

  async function submitResource(status: "published" | "draft") {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4003";

    // 서버 계약(createResourceSchema)은 difficulty·usageJson 을 필수로 요구하므로
    // 화면에는 없지만 기본값을 함께 전송한다.
    const commonBody: Record<string, unknown> = {
      title: title.trim() || (status === "draft" ? "임시저장" : ""),
      summary: summary.trim(),
      resourceType,
      environment: environments,
      difficulty: "beginner",
      descriptionJson,
      usageJson: EMPTY_DOC,
      tags,
    };

    if (isEditMode && resourceId) {
      // ── 편집 모드: PATCH /api/v1/resources/:id ────────────────────────────
      const resourceBody = { ...commonBody };
      if (status === "published") resourceBody.copyrightAgreed = true;

      const res = await fetch(`${apiBase}/api/v1/resources/${resourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resource: resourceBody }),
      });

      if (res.status === 401) {
        toast({ tone: "danger", title: "로그인 후 이용해 주세요." });
        router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
        throw new Error("_401");
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: { message?: string } }).error?.message ?? "수정에 실패했습니다.");
      }

      const data = (await res.json()) as { id: string; slug: string; resourceType: string; status: string };

      if (files.length > 0) {
        try {
          const formData = new FormData();
          files.forEach((f) => formData.append("files", f.file));
          if (primaryFileIndex !== null) formData.append("primaryIndex", String(primaryFileIndex));
          await fetch(`${apiBase}/api/v1/resources/${data.id}/files`, {
            method: "POST",
            credentials: "include",
            body: formData,
          });
        } catch {
          // 파일 업로드 오류는 non-fatal
        }
      }

      return { ...data, pageType: typeToPageType(data.resourceType) };
    }

    // ── 신규 등록 모드: POST /api/v1/resources ────────────────────────────────
    const endpoint = status === "draft" ? "/api/v1/resources/draft" : "/api/v1/resources";
    const body = { ...commonBody };
    if (status === "published") body.copyrightAgreed = true;

    const res = await fetch(`${apiBase}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      toast({ tone: "danger", title: "로그인 후 이용해 주세요." });
      router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
      throw new Error("_401");
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: { message?: string } }).error?.message ?? "등록에 실패했습니다.");
    }

    const data = (await res.json()) as {
      id: string;
      slug: string;
      resourceType: string;
      status: string;
      pageType: string;
    };

    if (status === "published" && files.length > 0) {
      try {
        const formData = new FormData();
        files.forEach((f) => formData.append("files", f.file));
        if (primaryFileIndex !== null) formData.append("primaryIndex", String(primaryFileIndex));
        await fetch(`${apiBase}/api/v1/resources/${data.id}/files`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      } catch {
        // 파일 업로드 오류는 non-fatal
      }
    }

    return data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!copyrightAgreed) {
      toast({ tone: "warning", title: "저작권 동의가 필요합니다." });
      return;
    }
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const data = await submitResource("published");
      if (isEditMode) {
        toast({ title: "수정되었습니다.", tone: "success" });
        router.push(`/resources/${returnSlug ?? data.slug}`);
      } else {
        toast({ title: "자료가 등록되었습니다.", tone: "success" });
        // 상세는 API 연동된 /resources/[slug] 로 이동한다.
        // (/resources/{pageType}/[slug] 는 목업 페이지라 실제 slug 로는 404)
        router.push(`/resources/${data.slug}`);
      }
    } catch (err) {
      // _401: 이미 toast+redirect 처리됨
      if (err instanceof Error && err.message === "_401") return;
      toast({
        title: err instanceof Error ? err.message : (isEditMode ? "수정 중 오류가 발생했습니다." : "등록 중 오류가 발생했습니다."),
        tone: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    try {
      await submitResource("draft");
      toast({ title: "임시저장되었습니다.", description: "/mypage 자료 탭에서 확인하세요.", tone: "success" });
    } catch (err) {
      // _401: 이미 toast+redirect 처리됨
      if (err instanceof Error && err.message === "_401") return;
      toast({
        title: "임시저장 실패",
        description: err instanceof Error ? err.message : "임시저장 중 오류가 발생했습니다.",
        tone: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  }

  // ── 렌더 ───────────────────────────────────────────────────────────────────

  // 비로그인 게이트 — ready=true이고 세션 없음이 확인된 경우만 차단
  if (ready && !user) {
    return (
      <EmptyState
        icon="lock-line"
        title="로그인 후 이용해 주세요"
        description="자료를 등록하려면 로그인이 필요합니다."
        actions={
          <Link href={`/login?redirectTo=${encodeURIComponent(pathname)}`}>
            <Button variant="primary">로그인하기</Button>
          </Link>
        }
      />
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <header className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{isEditMode ? "자료 수정" : "자료 등록"}</h2>
        <p className={styles.stepDesc}>한 화면에서 자료 정보를 작성한 뒤 등록하세요.</p>
      </header>

      {/* 자료 유형 — fixedResourceType이 주어지면 숨김 (게시판별 고정 유형 등록) */}
      {!fixedResourceType && (
        <fieldset className={styles.field}>
          <legend className={styles.label}>
            자료 유형 <span className={styles.required}>*</span>
          </legend>
          <div className={styles.typeGroup}>
            {RESOURCE_TYPES.map((rt) => (
              <button
                key={rt.value}
                type="button"
                className={`${styles.typeCard} ${resourceType === rt.value ? styles.typeCardActive : ""}`}
                aria-pressed={resourceType === rt.value}
                onClick={() => setResourceType(rt.value)}
              >
                <span className={styles.typeCardIcon}>
                  <Icon name={rt.icon} />
                </span>
                <span className={styles.typeCardText}>
                  <strong>{rt.label}</strong>
                  <span>{rt.hint}</span>
                </span>
                {resourceType === rt.value && (
                  <span className={styles.typeCardCheck}>
                    <Icon name="check-line" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* 제목 */}
      <div className={styles.field} style={{ marginTop: "var(--space-5)" }}>
        <label className={styles.label} htmlFor="res-title">
          제목 <span className={styles.required}>*</span>
        </label>
        <input
          id="res-title"
          className={`${styles.input} ${errors.title ? styles.inputError : ""}`}
          type="text"
          placeholder="자료 이름을 입력하세요 (최대 150자)"
          value={title}
          maxLength={150}
          onChange={(e) => setTitle(e.target.value)}
        />
        {errors.title && <span className={styles.fieldError}>{errors.title}</span>}
        <div className={styles.charCount}>
          <span className={title.length >= 140 ? styles.charNearLimit : undefined}>{title.length}</span>
          <span> / 150</span>
        </div>
      </div>

      {/* 한줄설명 */}
      <div className={styles.field} style={{ marginTop: "var(--space-4)" }}>
        <label className={styles.label} htmlFor="res-summary">
          한줄설명 <span className={styles.required}>*</span>
        </label>
        <input
          id="res-summary"
          className={`${styles.input} ${errors.summary ? styles.inputError : ""}`}
          type="text"
          placeholder="이 자료를 한 문장으로 설명해 주세요 (최대 300자)"
          value={summary}
          maxLength={300}
          onChange={(e) => setSummary(e.target.value)}
        />
        {errors.summary && <span className={styles.fieldError}>{errors.summary}</span>}
        <div className={styles.charCount}>
          <span className={summary.length >= 280 ? styles.charNearLimit : undefined}>{summary.length}</span>
          <span> / 300</span>
        </div>
      </div>

      {/* 지원환경 */}
      <div className={styles.field} style={{ marginTop: "var(--space-4)" }}>
        <span className={styles.label}>
          지원 환경 <span className={styles.optional}>(선택)</span>
        </span>
        <div className={styles.envCheckGroup}>
          {ENV_OPTIONS.map((env) => (
            <label key={env} className={styles.envCheckItem}>
              <input
                type="checkbox"
                checked={environments.includes(env)}
                onChange={(e) => {
                  if (e.target.checked) setEnvironments((prev) => [...prev, env]);
                  else setEnvironments((prev) => prev.filter((v) => v !== env));
                }}
              />
              {env}
            </label>
          ))}
        </div>
      </div>

      {/* 자료설명 (통합) */}
      <div className={styles.field} style={{ marginTop: "var(--space-4)" }}>
        <span className={styles.label}>
          자료설명 <span className={styles.required}>*</span>
        </span>
        <Editor
          preset="full"
          value={descriptionJson}
          onChange={(json) => setDescriptionJson(json)}
          placeholder="이 자료가 무엇인지, 어떻게 사용하는지, 주의할 점은 무엇인지 자유롭게 설명해 주세요."
        />
        {errors.description && <span className={styles.fieldError}>{errors.description}</span>}
      </div>

      {/* 첨부파일 */}
      <div className={styles.field} style={{ marginTop: "var(--space-4)" }}>
        <span className={styles.label}>
          첨부파일 <span className={styles.optional}>(선택 · 최대 {MAX_FILES}개)</span>
        </span>

        {files.length < MAX_FILES && (
          <div
            className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <span className={styles.dropzoneIcon}>
              <Icon name="upload-cloud-2-line" />
            </span>
            <strong>파일을 끌어다 놓거나 클릭해서 선택하세요</strong>
            <span className={styles.dropzoneHint}>
              가능한 형식: {ALLOWED_EXTS.map((e) => `.${e}`).join(" ")} · 최대 {MAX_FILES}개 · 개당 50MB 이내
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className={styles.fileInput}
              accept={ALLOWED_EXTS.map((e) => `.${e}`).join(",")}
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
        )}

        {fileError && (
          <p className={styles.fileError} role="alert">
            <Icon name="error-warning-line" />
            {fileError}
          </p>
        )}

        {files.length > 0 && (
          <ul className={styles.fileList}>
            {files.map((f, i) => (
              <li key={`${f.file.name}-${i}`} className={styles.fileItem}>
                <span className={styles.fileItemIcon}>
                  <Icon name="file-zip-line" />
                </span>
                <span className={styles.fileItemName}>{f.file.name}</span>
                <span className={styles.fileItemSize}>{f.sizeLabel}</span>
                <label className={styles.filePrimaryRadio}>
                  <input
                    type="radio"
                    name="primary-file"
                    checked={primaryFileIndex === i}
                    onChange={() => setPrimaryFileIndex(i)}
                  />
                  대표
                </label>
                <button
                  type="button"
                  className={styles.fileRemove}
                  aria-label={`${f.file.name} 삭제`}
                  onClick={() => removeFile(i)}
                >
                  <Icon name="close-line" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 태그 */}
      <div className={styles.field} style={{ marginTop: "var(--space-4)" }}>
        <label className={styles.label} htmlFor="res-tags">
          태그 <span className={styles.optional}>(선택 · 최대 {MAX_TAGS}개)</span>
        </label>
        <div className={styles.tagBox}>
          {tags.map((tag) => (
            <span key={tag} className={styles.tagChip}>
              #{tag}
              <button
                type="button"
                aria-label={`${tag} 태그 삭제`}
                onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
              >
                <Icon name="close-line" />
              </button>
            </span>
          ))}
          {tags.length < MAX_TAGS && (
            <input
              id="res-tags"
              className={styles.tagInput}
              type="text"
              placeholder={tags.length === 0 ? "태그 입력 후 Enter (예: Claude Code)" : ""}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
            />
          )}
        </div>
        <div className={styles.suggestedTags}>
          <span className={styles.suggestedLabel}>추천 태그</span>
          {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles.suggestedTag}
              disabled={tags.length >= MAX_TAGS}
              onClick={() => addTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* 저작권 동의 */}
      <div className={styles.copyrightCheck} style={{ marginTop: "var(--space-5)" }}>
        <input
          id="copyright-agreed"
          type="checkbox"
          checked={copyrightAgreed}
          onChange={(e) => setCopyrightAgreed(e.target.checked)}
        />
        <label htmlFor="copyright-agreed" className={styles.copyrightLabel}>
          이 자료의 저작권을 보유하거나 배포 권한이 있음을 확인합니다.
        </label>
      </div>

      {/* 액션 */}
      <div className={styles.stepNav}>
        <Link href="/resources" className={styles.stepNavPrev}>
          취소
        </Link>
        <div className={styles.rightBtns}>
          {!isEditMode && (
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSaveDraft}
              disabled={isSaving || isSubmitting}
            >
              {isSaving ? "저장 중…" : "임시저장"}
            </button>
          )}
          <button
            type="submit"
            className={styles.stepNavNext}
            disabled={!copyrightAgreed || isSubmitting || isSaving}
          >
            {isSubmitting ? (isEditMode ? "수정 중…" : "등록 중…") : (
              <>
                <Icon name={isEditMode ? "save-line" : "upload-2-line"} />
                {isEditMode ? "저장하기" : "등록하기"}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

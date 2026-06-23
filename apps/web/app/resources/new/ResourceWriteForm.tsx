"use client";

/**
 * ResourceWriteForm — 7-Step 자료 등록 통합 폼 (Story 4.4)
 *
 * Step 1: 유형 선택
 * Step 2: 공통 정보 (제목·한줄설명·지원환경·난이도·본문 Tiptap full)
 * Step 3: 첨부파일 (드래그앤드롭, max 3개, 50MB/개, 대표파일 지정)
 * Step 4: 사용법/주의사항 (Tiptap lite)
 * Step 5: 태그 (자동완성, max 10개)
 * Step 6: 미리보기
 * Step 7: 저작권 동의 + 임시저장 + 등록
 */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Editor } from "@/features/editor";
import { Icon } from "@/components/ui";
import { useToast } from "@/components/ui/Toast/Toast";
import { StepIndicator } from "./StepIndicator";
import styles from "./resource-new.module.css";

// ── 상수 ──────────────────────────────────────────────────────────────────────

/** 6개 유형 카드 정의 (pack 제거, Story 4.4 스펙) */
const RESOURCE_TYPES = [
  {
    value: "prompt",
    label: "프롬프트",
    icon: "chat-quote-line",
    hint: "재사용 가능한 AI 프롬프트",
  },
  {
    value: "claude-code-skill",
    label: "Claude Code Skill",
    icon: "terminal-box-line",
    hint: "Claude Code 커스텀 슬래시 커맨드",
  },
  {
    value: "mcp",
    label: "MCP",
    icon: "plug-line",
    hint: "Model Context Protocol 서버",
  },
  {
    value: "rules-config",
    label: "Rules · 설정",
    icon: "settings-3-line",
    hint: ".cursorrules / CLAUDE.md 등 설정 파일",
  },
  {
    value: "template-checklist",
    label: "템플릿 · 체크리스트",
    icon: "file-list-3-line",
    hint: "작업 템플릿 및 체크리스트",
  },
] as const;

type ResourceTypeValue = (typeof RESOURCE_TYPES)[number]["value"];

/** 허용 파일 확장자 */
const ALLOWED_EXTS = ["zip", "md", "txt", "json", "pdf", "docx", "xlsx"] as const;
type AllowedExt = (typeof ALLOWED_EXTS)[number];

/** 파일 제한 */
const MAX_FILES = 3;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/** 태그 제한 */
const MAX_TAGS = 10;

/** 지원 환경 목록 */
const ENV_OPTIONS = [
  "Claude Desktop",
  "Cursor",
  "Claude Code",
  "VSCode",
  "기타",
] as const;

/** 난이도 옵션 */
const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "입문 (Beginner)" },
  { value: "intermediate", label: "중급 (Intermediate)" },
  { value: "advanced", label: "고급 (Advanced)" },
] as const;

/** 추천 태그 */
const SUGGESTED_TAGS = [
  "프롬프트", "클로드", "AI", "자동화", "생산성",
  "코드리뷰", "문서화", "Claude Code", "MCP", "커서",
];

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface AttachedFile {
  /** File 객체 원본 (업로드 시 사용) */
  file: File;
  /** 표시용 크기 문자열 */
  sizeLabel: string;
  /** 에러 메시지 (없으면 null) */
  error: string | null;
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

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function ResourceWriteForm() {
  const router = useRouter();
  const { toast } = useToast();

  // ── 스텝 상태 ──────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);

  // ── Step 1: 유형 ───────────────────────────────────────────────────────────
  const [resourceType, setResourceType] = useState<ResourceTypeValue>("prompt");

  // ── Step 2: 공통 정보 ──────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [environments, setEnvironments] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [descriptionJson, setDescriptionJson] = useState<JSONContent>({ type: "doc", content: [] });

  // ── Step 3: 첨부파일 ───────────────────────────────────────────────────────
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [primaryFileIndex, setPrimaryFileIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 4: 사용법/주의사항 ────────────────────────────────────────────────
  const [usageJson, setUsageJson] = useState<JSONContent>({ type: "doc", content: [] });
  const [cautionJson, setCautionJson] = useState<JSONContent | null>(null);

  // ── Step 5: 태그 ───────────────────────────────────────────────────────────
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // ── Step 7: 저작권 ────────────────────────────────────────────────────────
  const [copyrightAgreed, setCopyrightAgreed] = useState(false);

  // ── 제출 상태 ──────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── 유효성 오류 ────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── 유틸 핸들러 ────────────────────────────────────────────────────────────

  function goStep(step: number) {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateStep(step: number): boolean {
    const next: Record<string, string> = {};
    if (step === 2) {
      if (title.trim().length < 2) next.title = "제목은 2자 이상 입력해 주세요.";
      if (title.trim().length > 150) next.title = "제목은 150자 이하로 입력해 주세요.";
      if (summary.trim().length < 1) next.summary = "한줄설명을 입력해 주세요.";
      if (summary.trim().length > 300) next.summary = "한줄설명은 300자 이하로 입력해 주세요.";
    }
    if (step === 4) {
      const usageText = JSON.stringify(usageJson);
      if (usageText === JSON.stringify({ type: "doc", content: [] }) || usageJson.content?.length === 0) {
        next.usage = "사용법을 입력해 주세요.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleNextStep() {
    if (!validateStep(currentStep)) return;
    goStep(currentStep + 1);
  }

  function handlePrevStep() {
    goStep(currentStep - 1);
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
    const endpoint = status === "draft" ? "/api/v1/resources/draft" : "/api/v1/resources";

    const body: Record<string, unknown> = {
      title: title.trim() || "임시저장",
      summary: summary.trim(),
      resourceType,
      environment: environments,
      difficulty,
      descriptionJson,
      usageJson,
      cautionJson: cautionJson ?? undefined,
      tags,
    };

    if (status === "published") {
      body.copyrightAgreed = true;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4003";
    const res = await fetch(`${apiBase}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = (data as { error?: { message?: string } }).error?.message ?? "등록에 실패했습니다.";
      throw new Error(msg);
    }

    const data = (await res.json()) as {
      id: string;
      slug: string;
      resourceType: string;
      status: string;
      pageType: string;
    };

    // 등록 성공 후 파일 업로드 (4.5 파이프라인)
    if (status === "published" && files.length > 0) {
      try {
        const formData = new FormData();
        files.forEach((f) => formData.append("files", f.file));
        if (primaryFileIndex !== null) {
          formData.append("primaryIndex", String(primaryFileIndex));
        }
        await fetch(`${apiBase}/api/v1/resources/${data.id}/files`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        // 파일 업로드 실패는 non-blocking (자료 자체는 등록 성공)
      } catch {
        // 파일 업로드 오류는 non-fatal
      }
    }

    return data;
  }

  async function handleSubmit() {
    if (!copyrightAgreed) return;
    setIsSubmitting(true);
    try {
      const data = await submitResource("published");
      toast({ title: "자료가 등록되었습니다.", tone: "success" });
      const pageType = data.pageType ?? typeToPageType(data.resourceType);
      router.push(`/resources/${pageType}/${data.slug}`);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "등록 중 오류가 발생했습니다.",
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

  return (
    <div className={styles.form}>
      {/* 스텝 진행 표시자 */}
      <StepIndicator currentStep={currentStep} onStepClick={goStep} />

      {/* ─── Step 1: 유형 선택 ─────────────────────────────────────────── */}
      {currentStep === 1 && (
        <section>
          <header className={styles.stepHeader}>
            <h2 className={styles.stepTitle}>어떤 유형의 자료인가요?</h2>
            <p className={styles.stepDesc}>자료 유형을 선택하면 맞춤 안내가 표시됩니다.</p>
          </header>

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

          <div className={styles.stepNav}>
            <div className={styles.rightBtns}>
              <button type="button" className={styles.stepNavNext} onClick={handleNextStep}>
                다음
                <Icon name="arrow-right-s-line" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── Step 2: 공통 정보 ─────────────────────────────────────────── */}
      {currentStep === 2 && (
        <section>
          <header className={styles.stepHeader}>
            <h2 className={styles.stepTitle}>자료 기본 정보를 입력하세요</h2>
            <p className={styles.stepDesc}>
              {resourceType === "prompt" && "프롬프트 자료의 제목과 설명을 작성해 주세요."}
              {resourceType === "claude-code-skill" && "Claude Code Skill의 제목과 설명을 작성해 주세요."}
              {resourceType === "mcp" && "MCP 서버의 제목과 설명을 작성해 주세요."}
              {resourceType === "rules-config" && "Rules/설정 파일의 제목과 설명을 작성해 주세요."}
              {resourceType === "template-checklist" && "템플릿/체크리스트의 제목과 설명을 작성해 주세요."}
            </p>
          </header>

          {/* 제목 */}
          <div className={styles.field}>
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
              onBlur={() => validateStep(2)}
            />
            {errors.title && <span className={styles.fieldError}>{errors.title}</span>}
            <div className={styles.charCount}>
              <span className={title.length >= 140 ? styles.charNearLimit : undefined}>
                {title.length}
              </span>
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
              onBlur={() => validateStep(2)}
            />
            {errors.summary && <span className={styles.fieldError}>{errors.summary}</span>}
            <div className={styles.charCount}>
              <span className={summary.length >= 280 ? styles.charNearLimit : undefined}>
                {summary.length}
              </span>
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
                      if (e.target.checked) {
                        setEnvironments((prev) => [...prev, env]);
                      } else {
                        setEnvironments((prev) => prev.filter((v) => v !== env));
                      }
                    }}
                  />
                  {env}
                </label>
              ))}
            </div>
          </div>

          {/* 난이도 */}
          <div className={styles.field} style={{ marginTop: "var(--space-4)" }}>
            <label className={styles.label} htmlFor="res-difficulty">
              난이도 <span className={styles.required}>*</span>
            </label>
            <select
              id="res-difficulty"
              className={styles.difficultySelect}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
            >
              {DIFFICULTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 본문 에디터 */}
          <div className={styles.field} style={{ marginTop: "var(--space-4)" }}>
            <span className={styles.label}>
              이 자료는 무엇인가요? <span className={styles.required}>*</span>
            </span>
            <Editor
              preset="full"
              value={descriptionJson}
              onChange={(json) => setDescriptionJson(json)}
              placeholder="이 자료가 무엇인지, 어디에 어떻게 쓰는지 설명해 주세요."
            />
          </div>

          <div className={styles.stepNav}>
            <button type="button" className={styles.stepNavPrev} onClick={handlePrevStep}>
              <Icon name="arrow-left-s-line" />
              이전
            </button>
            <div className={styles.rightBtns}>
              <button type="button" className={styles.stepNavNext} onClick={handleNextStep}>
                다음
                <Icon name="arrow-right-s-line" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── Step 3: 첨부파일 ──────────────────────────────────────────── */}
      {currentStep === 3 && (
        <section>
          <header className={styles.stepHeader}>
            <h2 className={styles.stepTitle}>파일을 첨부하세요</h2>
            <p className={styles.stepDesc}>
              최대 3개, 개당 50MB 이내. 대표 파일 1개를 지정할 수 있습니다.
            </p>
          </header>

          <div className={styles.field}>
            <span className={styles.label}>
              첨부파일 <span className={styles.optional}>(선택 · 최대 {MAX_FILES}개)</span>
            </span>

            {/* 드롭존 */}
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

            {/* 파일 오류 */}
            {fileError && (
              <p className={styles.fileError} role="alert">
                <Icon name="error-warning-line" />
                {fileError}
              </p>
            )}

            {/* 파일 목록 */}
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

          <div className={styles.stepNav}>
            <button type="button" className={styles.stepNavPrev} onClick={handlePrevStep}>
              <Icon name="arrow-left-s-line" />
              이전
            </button>
            <div className={styles.rightBtns}>
              <button type="button" className={styles.stepNavNext} onClick={handleNextStep}>
                다음
                <Icon name="arrow-right-s-line" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── Step 4: 사용법/주의사항 ──────────────────────────────────────── */}
      {currentStep === 4 && (
        <section>
          <header className={styles.stepHeader}>
            <h2 className={styles.stepTitle}>사용법을 알려주세요</h2>
            <p className={styles.stepDesc}>어떻게 사용하는지, 주의할 점이 있는지 작성해 주세요.</p>
          </header>

          {/* 사용법 */}
          <div className={styles.field}>
            <span className={styles.label}>
              사용법 <span className={styles.required}>*</span>
            </span>
            <Editor
              preset="lite"
              value={usageJson}
              onChange={(json) => setUsageJson(json)}
              placeholder="이 자료를 어떻게 사용하는지 단계별로 알려주세요."
            />
            {errors.usage && <span className={styles.fieldError}>{errors.usage}</span>}
          </div>

          {/* 주의사항 */}
          <div className={styles.field} style={{ marginTop: "var(--space-5)" }}>
            <span className={styles.label}>
              주의사항 <span className={styles.optional}>(선택)</span>
            </span>
            <Editor
              preset="lite"
              value={cautionJson ?? { type: "doc", content: [] }}
              onChange={(json) => setCautionJson(json)}
              placeholder="사용 시 주의해야 할 점이 있다면 입력해 주세요."
            />
          </div>

          <div className={styles.stepNav}>
            <button type="button" className={styles.stepNavPrev} onClick={handlePrevStep}>
              <Icon name="arrow-left-s-line" />
              이전
            </button>
            <div className={styles.rightBtns}>
              <button type="button" className={styles.stepNavNext} onClick={handleNextStep}>
                다음
                <Icon name="arrow-right-s-line" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── Step 5: 태그 ──────────────────────────────────────────────── */}
      {currentStep === 5 && (
        <section>
          <header className={styles.stepHeader}>
            <h2 className={styles.stepTitle}>태그를 추가하세요</h2>
            <p className={styles.stepDesc}>
              관련 태그를 추가하면 검색에서 더 잘 발견됩니다. 최대 {MAX_TAGS}개.
            </p>
          </header>

          <div className={styles.field}>
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

          <div className={styles.stepNav}>
            <button type="button" className={styles.stepNavPrev} onClick={handlePrevStep}>
              <Icon name="arrow-left-s-line" />
              이전
            </button>
            <div className={styles.rightBtns}>
              <button type="button" className={styles.stepNavNext} onClick={handleNextStep}>
                다음
                <Icon name="arrow-right-s-line" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── Step 6: 미리보기 ───────────────────────────────────────────── */}
      {currentStep === 6 && (
        <section>
          <header className={styles.stepHeader}>
            <h2 className={styles.stepTitle}>등록 전 미리보기</h2>
            <p className={styles.stepDesc}>자료가 어떻게 보일지 확인하세요. [수정하기]로 해당 단계로 돌아갈 수 있습니다.</p>
          </header>

          <div className={styles.previewSection}>
            {/* 유형 뱃지 */}
            <div>
              <span className={styles.previewBadge}>
                {RESOURCE_TYPES.find((t) => t.value === resourceType)?.label ?? resourceType}
              </span>
            </div>

            {/* 제목 */}
            <h3 className={styles.previewTitle}>
              {title || <em style={{ color: "var(--color-text-sub)" }}>(제목 없음)</em>}
            </h3>

            {/* 메타 */}
            <div className={styles.previewMeta}>
              {difficulty && (
                <span>{DIFFICULTY_OPTIONS.find((d) => d.value === difficulty)?.label}</span>
              )}
              {environments.length > 0 && (
                <span>지원환경: {environments.join(", ")}</span>
              )}
            </div>

            {/* 한줄설명 */}
            <p className={styles.previewSummary}>
              {summary || <em style={{ color: "var(--color-text-sub)" }}>(한줄설명 없음)</em>}
            </p>

            {/* 파일 목록 */}
            {files.length > 0 && (
              <div>
                <p className={styles.label} style={{ marginBottom: "var(--space-2)" }}>첨부파일</p>
                <div className={styles.previewFileList}>
                  {files.map((f, i) => (
                    <span key={i} className={styles.previewFileChip}>
                      <Icon name="file-zip-line" />
                      {f.file.name}
                      {primaryFileIndex === i && " (대표)"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 태그 */}
            {tags.length > 0 && (
              <div className={styles.previewTags}>
                {tags.map((tag) => (
                  <span key={tag} className={styles.previewTag}>#{tag}</span>
                ))}
              </div>
            )}

            {/* 수정 링크들 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
              <button type="button" className={styles.previewEditLink} onClick={() => goStep(2)}>
                기본 정보 수정
              </button>
              <button type="button" className={styles.previewEditLink} onClick={() => goStep(3)}>
                파일 수정
              </button>
              <button type="button" className={styles.previewEditLink} onClick={() => goStep(4)}>
                사용법 수정
              </button>
              <button type="button" className={styles.previewEditLink} onClick={() => goStep(5)}>
                태그 수정
              </button>
            </div>
          </div>

          <div className={styles.stepNav}>
            <button type="button" className={styles.stepNavPrev} onClick={handlePrevStep}>
              <Icon name="arrow-left-s-line" />
              이전
            </button>
            <div className={styles.rightBtns}>
              <button type="button" className={styles.stepNavNext} onClick={handleNextStep}>
                다음
                <Icon name="arrow-right-s-line" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── Step 7: 등록 ──────────────────────────────────────────────── */}
      {currentStep === 7 && (
        <section>
          <header className={styles.stepHeader}>
            <h2 className={styles.stepTitle}>마지막 단계입니다</h2>
            <p className={styles.stepDesc}>
              저작권 동의 후 등록하거나, 임시저장하고 나중에 완성할 수 있습니다.
            </p>
          </header>

          {/* 저작권 동의 */}
          <div className={styles.copyrightCheck}>
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

          <div className={styles.stepNav}>
            <button type="button" className={styles.stepNavPrev} onClick={handlePrevStep}>
              <Icon name="arrow-left-s-line" />
              이전
            </button>
            <div className={styles.rightBtns}>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleSaveDraft}
                disabled={isSaving || isSubmitting}
              >
                {isSaving ? "저장 중…" : "임시저장"}
              </button>
              <button
                type="button"
                className={styles.stepNavNext}
                onClick={handleSubmit}
                disabled={!copyrightAgreed || isSubmitting || isSaving}
              >
                {isSubmitting ? "등록 중…" : (
                  <>
                    <Icon name="upload-2-line" />
                    등록하기
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

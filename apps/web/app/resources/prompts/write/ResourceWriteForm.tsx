"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { useUploadConfig } from "@/hooks/useUploadConfig";
import styles from "./resource-write.module.css";

/**
 * 실전자료 등록 폼 (프롬프트).
 * 일반 게시판 글쓰기(PostWriteForm)와 달리, 실전자료는 다운로드형 자료실이라
 * "첨부 파일 + 설명"이 핵심이다. 모든 자료 유형은 같은 등록폼을 공유한다.
 */

/** 자료 유형 — 프롬프트 하위 게시판은 단일 프롬프트 / 프롬프트 팩 두 유형을 받는다. */
const resourceTypes = [
  { value: "prompt", label: "단일 프롬프트", icon: "chat-quote-line", hint: "md·txt 권장 · 프롬프트 1개" },
  { value: "pack", label: "프롬프트 팩", icon: "stack-line", hint: "zip 권장 · 여러 프롬프트 묶음" },
] as const;

/** 허용 파일 형식 (마스터플랜 6-5) */
const ALLOWED_EXTS = ["zip", "md", "txt", "json", "pdf", "docx", "xlsx"];

const SUGGESTED_TAGS = [
  "프롬프트", "리뷰", "문서화", "블로그", "SQL",
  "데이터", "기획", "인터뷰", "ClaudeCode", "검증",
];

const MAX_DESC = 1000;
const MAX_TAGS = 5;
const MAX_FILES = 5;

type AttachedFile = { name: string; size: string };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function ResourceWriteForm() {
  const { resourceExtensions, toAccept } = useUploadConfig();
  const [type, setType] = useState<string>("prompt");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      setFileError(null);
      const next: AttachedFile[] = [];
      for (const file of Array.from(incoming)) {
        if (!resourceExtensions.includes(extOf(file.name)) && !ALLOWED_EXTS.includes(extOf(file.name))) {
          setFileError(`허용되지 않는 형식입니다: .${extOf(file.name)} (가능: ${resourceExtensions.join(", ")})`);
          continue;
        }
        next.push({ name: file.name, size: formatSize(file.size) });
      }
      setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
    },
    [resourceExtensions],
  );

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    alert("등록 기능은 아직 개발 중입니다.");
  }

  const canSubmit = title.trim() && desc.trim() && files.length > 0;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <header className={styles.formHeader}>
        <span className={styles.formBadge}>
          <Icon name="upload-cloud-2-line" />
          자료 등록
        </span>
        <h1 className={styles.formTitle}>프롬프트 자료 등록</h1>
        <p className={styles.formDesc}>
          바로 복사해서 쓸 수 있는 프롬프트를 올리고 설명을 적으면 다른 사람이 받아서 바로 적용할 수 있습니다.
          실제 프롬프트 내용은 첨부 파일 안에 포함해 주세요.
        </p>
      </header>

      {/* 자료 유형 */}
      <fieldset className={styles.field}>
        <legend className={styles.label}>
          자료 유형 <span className={styles.required}>*</span>
        </legend>
        <div className={styles.typeGroup}>
          {resourceTypes.map((rt) => (
            <button
              key={rt.value}
              type="button"
              className={`${styles.typeCard} ${type === rt.value ? styles.typeCardActive : ""}`}
              aria-pressed={type === rt.value}
              onClick={() => setType(rt.value)}
            >
              <span className={styles.typeCardIcon}>
                <Icon name={rt.icon} />
              </span>
              <span className={styles.typeCardText}>
                <strong>{rt.label}</strong>
                <span>{rt.hint}</span>
              </span>
              {type === rt.value && <Icon name="check-line" className={styles.typeCardCheck} />}
            </button>
          ))}
        </div>
      </fieldset>

      {/* 제목 */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="resource-title">
          제목 <span className={styles.required}>*</span>
        </label>
        <input
          id="resource-title"
          className={styles.input}
          type="text"
          placeholder="자료 이름을 입력하세요 (예: 코드 리뷰 요청 프롬프트)"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* 자료 설명 */}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="resource-desc">
          자료 설명 <span className={styles.required}>*</span>
        </label>
        <div className={styles.textareaBox}>
          <textarea
            id="resource-desc"
            className={styles.textarea}
            placeholder="무엇을 하는 프롬프트인지, 어떤 입력을 넣고 어떻게 쓰는지 설명해 주세요."
            value={desc}
            maxLength={MAX_DESC}
            onChange={(e) => setDesc(e.target.value)}
          />
          <div className={styles.charCount}>
            <span className={desc.length >= MAX_DESC ? styles.charNearLimit : undefined}>
              {desc.length}
            </span>
            <span className={styles.charMax}> / {MAX_DESC}</span>
          </div>
        </div>
      </div>

      {/* 첨부 파일 */}
      <div className={styles.field}>
        <span className={styles.label}>
          첨부 파일 <span className={styles.required}>*</span>
        </span>
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
          <Icon name="upload-cloud-2-line" className={styles.dropzoneIcon} />
          <strong>파일을 끌어다 놓거나 클릭해서 선택하세요</strong>
          <span className={styles.dropzoneHint}>
            가능한 형식: {resourceExtensions.map((e) => `.${e}`).join(" ")} · 최대 {MAX_FILES}개
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className={styles.fileInput}
            accept={toAccept(resourceExtensions)}
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {fileError && (
          <p className={styles.fileError} role="alert">
            <Icon name="error-warning-line" />
            {fileError}
          </p>
        )}

        {files.length > 0 && (
          <ul className={styles.fileList}>
            {files.map((file, i) => (
              <li key={`${file.name}-${i}`} className={styles.fileItem}>
                <Icon name="file-zip-line" className={styles.fileItemIcon} />
                <span className={styles.fileItemName}>{file.name}</span>
                <span className={styles.fileItemSize}>{file.size}</span>
                <button
                  type="button"
                  className={styles.fileRemove}
                  aria-label={`${file.name} 삭제`}
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
      <div className={styles.field}>
        <label className={styles.label} htmlFor="resource-tags">
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
              id="resource-tags"
              className={styles.tagInput}
              type="text"
              placeholder={tags.length === 0 ? "태그를 입력하고 Enter (예: 프롬프트)" : ""}
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

      {/* 액션 */}
      <div className={styles.formActions}>
        <Link href="/resources/prompts" className={styles.cancelBtn}>
          취소
        </Link>
        <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
          <Icon name="upload-2-line" />
          등록하기
        </button>
      </div>
    </form>
  );
}

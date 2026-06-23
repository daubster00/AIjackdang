"use client";

import { useState, useRef, useCallback } from "react";
import type { JSONContent } from "@tiptap/react";
import { Icon } from "@/components/ui";
import { Editor } from "@/features/editor";
import styles from "./PostWriteForm.module.css";

/**
 * 게시판 글쓰기 폼 (공용).
 * 바이브코딩/묻고답하기 등 모든 게시판이 이 컴포넌트 하나를 공유한다.
 * 에디터·태그·파일첨부 등 기능을 한 곳에서 고치면 모든 게시판에 반영된다.
 * 게시판마다 다른 문구/링크/추천태그 등은 config prop으로만 주입한다.
 */
export type PostWriteFormConfig = {
  /** 상단 헤더(배지+제목+설명). 없으면 헤더를 그리지 않는다. */
  header?: {
    badgeIcon: string;
    badgeLabel: string;
    title: string;
    description: string;
  };
  /** 작성 가이드 팁 박스. 없으면 그리지 않는다. */
  tip?: {
    title: string;
    items: string[];
  };
  titleLabel: string;
  titlePlaceholder: string;
  /** 제목 input의 id (label 연결용). 기본 "post-title" */
  titleInputId?: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  /** 태그가 없을 때 보일 입력 placeholder */
  tagPlaceholder: string;
  suggestedTags: string[];
  dropzoneText: string;
  cancelHref: string;
  submitLabel: string;
  /** 제출 버튼 좌측 아이콘(선택) */
  submitIcon?: string;
  /** 제출 시 안내 alert 문구 (등록 기능 미구현 단계) */
  submitAlert: string;
};

const MAX_TAGS = 5;
const MAX_FILES = 5;


interface AttachedFile {
  name: string;
  size: string;
  isImage: boolean;
}

export function PostWriteForm({ config }: { config: PostWriteFormConfig }) {
  const titleInputId = config.titleInputId ?? "post-title";

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  // Tiptap JSON 본문 (FULL preset)
  const [contentJson, setContentJson] = useState<JSONContent | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().replace(/^#/, "");
    if (tag && !tags.includes(tag) && tags.length < MAX_TAGS) {
      setTags((prev) => [...prev, tag]);
      setTagInput("");
    }
  }, [tagInput, tags]);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        handleAddTag();
      } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
        setTags((prev) => prev.slice(0, -1));
      }
    },
    [handleAddTag, tagInput, tags.length],
  );

  const handleRemoveTag = useCallback((index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFileSelect = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const remaining = MAX_FILES - files.length;
      if (remaining <= 0) return;
      const newFiles: AttachedFile[] = Array.from(fileList)
        .slice(0, remaining)
        .map((f) => ({
          name: f.name,
          size:
            f.size < 1024 * 1024
              ? `${(f.size / 1024).toFixed(1)} KB`
              : `${(f.size / 1024 / 1024).toFixed(1)} MB`,
          isImage: f.type.startsWith("image/"),
        }));
      setFiles((prev) => [...prev, ...newFiles].slice(0, MAX_FILES));
    },
    [files.length],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect],
  );

  return (
    <div className={styles.writeLayout}>
      <form
        className={styles.writeCard}
        onSubmit={(e) => {
          e.preventDefault();
          alert(config.submitAlert);
        }}
      >
        {/* 게시판 헤더 (배지 + 제목 + 설명) — config.header 있을 때만 */}
        {config.header && (
          <header className={styles.cardHead}>
            <div className={styles.cardHeadTop}>
              <span className={styles.boardBadge}>
                <Icon name={config.header.badgeIcon} />
                {config.header.badgeLabel}
              </span>
            </div>
            <h1 className={styles.cardTitle}>{config.header.title}</h1>
            <p className={styles.cardSub}>{config.header.description}</p>
          </header>
        )}

        {/* 작성 가이드 팁 박스 — config.tip 있을 때만 */}
        {config.tip && (
          <aside className={styles.tipBox}>
            <Icon name="lightbulb-line" className={styles.tipIcon} aria-hidden="true" />
            <div className={styles.tipBody}>
              <p className={styles.tipTitle}>{config.tip.title}</p>
              <ul className={styles.tipList}>
                {config.tip.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        {/* 제목 */}
        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabelRow}>
            <label className={styles.fieldLabel} htmlFor={titleInputId}>
              {config.titleLabel} <span className={styles.required}>*</span>
            </label>
            <span className={styles.titleCount}>{title.length}/100</span>
          </div>
          <input
            id={titleInputId}
            className={styles.titleInput}
            type="text"
            placeholder={config.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            required
          />
        </div>

        {/* 본문 에디터 — Tiptap full preset (Story 2.5) */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            {config.bodyLabel} <span className={styles.required}>*</span>
          </label>
          <Editor
            preset="full"
            value={contentJson}
            onChange={setContentJson}
            placeholder={config.bodyPlaceholder}
          />
        </div>

        {/* 태그 */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            태그{" "}
            <span className={styles.fieldHint}>
              (최대 {MAX_TAGS}개 · Enter 또는 쉼표로 추가)
            </span>
          </label>
          <div className={styles.tagField}>
            <div className={styles.tagInputRow}>
              {tags.map((tag, i) => (
                <span key={i} className={styles.tagChip}>
                  #{tag}
                  <button
                    type="button"
                    className={styles.tagRemoveBtn}
                    aria-label={`${tag} 태그 제거`}
                    onClick={() => handleRemoveTag(i)}
                  >
                    <Icon name="close-line" />
                  </button>
                </span>
              ))}
              {tags.length < MAX_TAGS && (
                <input
                  className={styles.tagInput}
                  type="text"
                  placeholder={tags.length === 0 ? config.tagPlaceholder : "태그 추가"}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleAddTag}
                  aria-label="태그 입력"
                />
              )}
            </div>
          </div>
          <div className={styles.suggestedTags}>
            <span className={styles.suggestedLabel}>추천 태그:</span>
            {config.suggestedTags
              .filter((t) => !tags.includes(t))
              .slice(0, 10)
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={styles.suggestedTag}
                  disabled={tags.length >= MAX_TAGS}
                  onClick={() => {
                    if (tags.length < MAX_TAGS) {
                      setTags((prev) => [...prev, tag]);
                    }
                  }}
                >
                  #{tag}
                </button>
              ))}
          </div>
        </div>

        {/* 파일 첨부 */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            파일 첨부{" "}
            <span className={styles.fieldHint}>(최대 {MAX_FILES}개 · 파일당 최대 10MB)</span>
          </label>
          <div
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="파일 첨부 영역. 클릭하거나 파일을 끌어오세요"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <Icon name="upload-cloud-2-line" className={styles.dropzoneIcon} />
            <p className={styles.dropzoneText}>{config.dropzoneText}</p>
            <p className={styles.dropzoneHint}>
              jpg, png, gif, pdf, zip, md, txt, json, docx, xlsx 지원
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.zip,.md,.txt,.json,.docx,.xlsx"
            className={styles.hiddenInput}
            onChange={(e) => handleFileSelect(e.target.files)}
            aria-hidden="true"
          />
          {files.length > 0 && (
            <ul className={styles.fileList}>
              {files.map((file, i) => (
                <li key={i} className={styles.fileItem}>
                  <Icon
                    name={file.isImage ? "image-line" : "file-line"}
                    className={styles.fileIcon}
                  />
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.fileSize}>{file.size}</span>
                  <button
                    type="button"
                    className={styles.fileRemoveBtn}
                    aria-label={`${file.name} 삭제`}
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Icon name="close-line" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className={styles.formActions}>
          <div className={styles.formActionsLeft}>
            <button
              type="button"
              className={styles.draftBtn}
              onClick={() => alert("임시저장되었습니다.")}
            >
              <Icon name="save-line" />
              임시저장
            </button>
          </div>
          <div className={styles.formActionsRight}>
            <a href={config.cancelHref} className={styles.cancelBtn}>
              취소
            </a>
            <button type="submit" className={styles.submitBtn}>
              {config.submitIcon && <Icon name={config.submitIcon} />}
              {config.submitLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

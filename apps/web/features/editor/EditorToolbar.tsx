"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import styles from "./Editor.module.css";

/**
 * 허용 색상 팔레트 (제한 팔레트 — 자유 색상 입력 금지, FR-2.5).
 * 토큰 기반 색상만 노출한다.
 */
const FONT_COLORS = [
  { name: "기본", value: "" },
  { name: "강조(파랑)", value: "#3030c0" },
  { name: "위험(빨강)", value: "#d9363e" },
  { name: "성공(초록)", value: "#148f73" },
  { name: "중립(회색)", value: "#6b7280" },
  { name: "정보(하늘)", value: "#2478d4" },
];

/**
 * 형광펜 허용 색상 팔레트 (3가지 제한).
 */
const HIGHLIGHT_COLORS = [
  { name: "노란색", value: "#fff176" },
  { name: "하늘색", value: "#b3e5fc" },
  { name: "연두색", value: "#c8e6c9" },
];

type EditorToolbarProps = {
  editor: Editor | null;
  preset: "full" | "lite";
};

export function EditorToolbar({ editor, preset }: EditorToolbarProps) {
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showHighlightPalette, setShowHighlightPalette] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");

  if (!editor) return null;

  /** 링크 삽입 / 해제 */
  const handleLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = prompt("링크 URL을 입력하세요:");
    if (!url) return;
    editor.chain().focus().setLink({ href: url, target: "_blank", rel: "noopener noreferrer" }).run();
  };

  /** 이미지 삽입 (URL + alt 강제) */
  const handleInsertImage = () => {
    if (!imageUrl || !imageAlt) return;
    editor.chain().focus().setImage({ src: imageUrl, alt: imageAlt }).run();
    setImageUrl("");
    setImageAlt("");
    setShowImageModal(false);
  };

  /** 색상 적용 */
  const handleColor = (color: string) => {
    if (!color) {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(color).run();
    }
    setShowColorPalette(false);
  };

  /** 형광펜 적용 */
  const handleHighlight = (color: string) => {
    editor.chain().focus().toggleHighlight({ color }).run();
    setShowHighlightPalette(false);
  };

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="서식 도구 모음">
      {/* ── full + lite 공통 버튼 ── */}

      {/* 링크 */}
      <button
        type="button"
        className={`${styles.toolbarBtn}${editor.isActive("link") ? ` ${styles.toolbarBtnActive}` : ""}`}
        aria-label="링크 삽입"
        aria-pressed={editor.isActive("link")}
        title="링크 삽입"
        onClick={handleLink}
      >
        <i className="ri-link" aria-hidden="true" />
      </button>

      {/* 이미지 */}
      <div className={styles.colorPickerWrap}>
        <button
          type="button"
          className={styles.toolbarBtn}
          aria-label="이미지 삽입"
          aria-expanded={showImageModal}
          title="이미지 삽입 (URL + 설명 필수)"
          onClick={() => {
            setShowImageModal((prev) => !prev);
            setShowColorPalette(false);
            setShowHighlightPalette(false);
          }}
        >
          <i className="ri-image-line" aria-hidden="true" />
        </button>
        {showImageModal && (
          <div className={styles.imageModal} role="dialog" aria-label="이미지 삽입">
            <div>
              <label htmlFor="editor-img-url">이미지 URL</label>
              <input
                id="editor-img-url"
                className={styles.imageModalInput}
                type="url"
                placeholder="https://example.com/image.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="editor-img-alt">이미지 설명(alt) <span style={{ color: "var(--color-danger)" }}>*</span></label>
              <input
                id="editor-img-alt"
                className={styles.imageModalInput}
                type="text"
                placeholder="이미지를 설명하세요 (필수)"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
              />
            </div>
            <div className={styles.imageModalActions}>
              <button
                type="button"
                className={styles.imageModalCancelBtn}
                onClick={() => {
                  setShowImageModal(false);
                  setImageUrl("");
                  setImageAlt("");
                }}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.imageModalInsertBtn}
                disabled={!imageUrl || !imageAlt}
                onClick={handleInsertImage}
              >
                삽입
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 코드블록 */}
      <button
        type="button"
        className={`${styles.toolbarBtn}${editor.isActive("codeBlock") ? ` ${styles.toolbarBtnActive}` : ""}`}
        aria-label="코드블록"
        aria-pressed={editor.isActive("codeBlock")}
        title="코드블록"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <i className="ri-code-s-slash-line" aria-hidden="true" />
      </button>

      {/* ── full preset 전용 버튼 ── */}
      {preset === "full" && (
        <>
          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 굵게 */}
          <button
            type="button"
            className={`${styles.toolbarBtn}${editor.isActive("bold") ? ` ${styles.toolbarBtnActive}` : ""}`}
            aria-label="굵게"
            aria-pressed={editor.isActive("bold")}
            title="굵게"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <i className="ri-bold" aria-hidden="true" />
          </button>

          {/* 기울임 */}
          <button
            type="button"
            className={`${styles.toolbarBtn}${editor.isActive("italic") ? ` ${styles.toolbarBtnActive}` : ""}`}
            aria-label="기울임"
            aria-pressed={editor.isActive("italic")}
            title="기울임"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <i className="ri-italic" aria-hidden="true" />
          </button>

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* H2 */}
          <button
            type="button"
            className={`${styles.toolbarBtn}${editor.isActive("heading", { level: 2 }) ? ` ${styles.toolbarBtnActive}` : ""}`}
            aria-label="제목 2 (H2)"
            aria-pressed={editor.isActive("heading", { level: 2 })}
            title="제목 2 (H2)"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <i className="ri-h-2" aria-hidden="true" />
          </button>

          {/* H3 */}
          <button
            type="button"
            className={`${styles.toolbarBtn}${editor.isActive("heading", { level: 3 }) ? ` ${styles.toolbarBtnActive}` : ""}`}
            aria-label="제목 3 (H3)"
            aria-pressed={editor.isActive("heading", { level: 3 })}
            title="제목 3 (H3)"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <i className="ri-h-3" aria-hidden="true" />
          </button>

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 불릿 목록 */}
          <button
            type="button"
            className={`${styles.toolbarBtn}${editor.isActive("bulletList") ? ` ${styles.toolbarBtnActive}` : ""}`}
            aria-label="불릿 목록"
            aria-pressed={editor.isActive("bulletList")}
            title="불릿 목록"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <i className="ri-list-unordered" aria-hidden="true" />
          </button>

          {/* 순서 목록 */}
          <button
            type="button"
            className={`${styles.toolbarBtn}${editor.isActive("orderedList") ? ` ${styles.toolbarBtnActive}` : ""}`}
            aria-label="순서있는 목록"
            aria-pressed={editor.isActive("orderedList")}
            title="순서있는 목록"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <i className="ri-list-ordered" aria-hidden="true" />
          </button>

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 인용 */}
          <button
            type="button"
            className={`${styles.toolbarBtn}${editor.isActive("blockquote") ? ` ${styles.toolbarBtnActive}` : ""}`}
            aria-label="인용"
            aria-pressed={editor.isActive("blockquote")}
            title="인용"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <i className="ri-double-quotes-l" aria-hidden="true" />
          </button>

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 색상 (제한 팔레트) */}
          <div className={styles.colorPickerWrap}>
            <button
              type="button"
              className={styles.toolbarBtn}
              aria-label="글자 색상"
              aria-expanded={showColorPalette}
              title="글자 색상 (제한 팔레트)"
              onClick={() => {
                setShowColorPalette((prev) => !prev);
                setShowHighlightPalette(false);
                setShowImageModal(false);
              }}
            >
              <i className="ri-font-color" aria-hidden="true" />
            </button>
            {showColorPalette && (
              <div
                className={styles.colorPalette}
                role="listbox"
                aria-label="글자 색상 선택"
              >
                {FONT_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className={styles.colorSwatch}
                    style={{ background: c.value || "var(--color-text)" }}
                    title={c.name}
                    aria-label={c.name}
                    onClick={() => handleColor(c.value)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 형광펜 (제한 팔레트) */}
          <div className={styles.colorPickerWrap}>
            <button
              type="button"
              className={`${styles.toolbarBtn}${editor.isActive("highlight") ? ` ${styles.toolbarBtnActive}` : ""}`}
              aria-label="형광펜"
              aria-expanded={showHighlightPalette}
              aria-pressed={editor.isActive("highlight")}
              title="형광펜 (제한 팔레트)"
              onClick={() => {
                setShowHighlightPalette((prev) => !prev);
                setShowColorPalette(false);
                setShowImageModal(false);
              }}
            >
              <i className="ri-mark-pen-line" aria-hidden="true" />
            </button>
            {showHighlightPalette && (
              <div
                className={styles.colorPalette}
                role="listbox"
                aria-label="형광펜 색상 선택"
              >
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className={styles.colorSwatch}
                    style={{ background: c.value }}
                    title={c.name}
                    aria-label={c.name}
                    onClick={() => handleHighlight(c.value)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

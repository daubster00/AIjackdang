"use client";

import { useRef, useState } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import styles from "./Editor.module.css";
import { FontSizeSelect } from "./FontSizeSelect";
import { notifyDialog } from "@/lib/dialog";

/**
 * 허용 색상 팔레트 (12개 제한 팔레트).
 */
const FONT_COLORS = [
  { name: "기본", value: "" },
  { name: "강조(파랑)", value: "#3030c0" },
  { name: "위험(빨강)", value: "#d9363e" },
  { name: "성공(초록)", value: "#148f73" },
  { name: "중립(회색)", value: "#6b7280" },
  { name: "정보(하늘)", value: "#2478d4" },
  { name: "주황", value: "#e07b00" },
  { name: "보라", value: "#7c3aed" },
  { name: "분홍", value: "#d6409f" },
  { name: "청록", value: "#0891b2" },
  { name: "연두", value: "#65a30d" },
  { name: "갈색", value: "#92400e" },
];

/**
 * 폰트 크기 선택 옵션.
 */
const FONT_SIZES: Array<{
  label: string;
  type: "paragraph" | "fontSize";
  value: string;
}> = [
  { label: "기본", type: "paragraph", value: "" },
  { label: "작게 (12px)", type: "fontSize", value: "12px" },
  { label: "보통 (15px)", type: "fontSize", value: "15px" },
  { label: "크게 (18px)", type: "fontSize", value: "18px" },
  { label: "더 크게 (22px)", type: "fontSize", value: "22px" },
  { label: "26px", type: "fontSize", value: "26px" },
  { label: "30px", type: "fontSize", value: "30px" },
  { label: "36px", type: "fontSize", value: "36px" },
  { label: "42px", type: "fontSize", value: "42px" },
  { label: "48px", type: "fontSize", value: "48px" },
];

export type EditorToolbarProps = {
  editor: Editor | null;
  preset: "full" | "lite";
};

export function EditorToolbar({ editor, preset }: EditorToolbarProps) {
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#3030c0");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editorState = useEditorState({
    editor,
    selector: (snapshot) => {
      const ed = snapshot.editor;
      if (!ed) {
        return {
          isLink: false,
          isCodeBlock: false,
          isBold: false,
          isItalic: false,
          isBulletList: false,
          isOrderedList: false,
          textAlignLeft: false,
          textAlignCenter: false,
          textAlignRight: false,
          fontSizeValue: "",
        };
      }
      const fs = (ed.getAttributes("textStyle") as { fontSize?: string })?.fontSize;
      return {
        isLink: ed.isActive("link"),
        isCodeBlock: ed.isActive("codeBlock"),
        isBold: ed.isActive("bold"),
        isItalic: ed.isActive("italic"),
        isBulletList: ed.isActive("bulletList"),
        isOrderedList: ed.isActive("orderedList"),
        textAlignLeft: ed.isActive({ textAlign: "left" }),
        textAlignCenter: ed.isActive({ textAlign: "center" }),
        textAlignRight: ed.isActive({ textAlign: "right" }),
        fontSizeValue: fs ?? "",
      };
    },
  });

  if (!editor || !editorState) return null;

  /** 링크 삽입 / 해제 */
  const handleLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = prompt("링크 URL을 입력하세요:");
    if (!url) return;
    editor
      .chain()
      .focus()
      .setLink({ href: url, target: "_blank", rel: "noopener noreferrer" })
      .run();
  };

  /** 이미지 업로드 */
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/users/uploads/editor-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          (err as { error?: { message?: string } })?.error?.message ?? "업로드 실패";
        await notifyDialog(msg, "danger");
        return;
      }

      const { url } = (await res.json()) as { url: string };
      editor.chain().focus().setImage({ src: url, alt: "" }).run();
    } catch {
      await notifyDialog("업로드 중 오류가 발생했습니다.", "danger");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /** 색상 적용 */
  const handleColor = (color: string) => {
    if (!color) {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(color).run();
      setSelectedColor(color);
    }
    setShowColorPalette(false);
  };

  /** 폰트 크기 적용 */
  const handleFontSize = (rawValue: string) => {
    const option = FONT_SIZES.find((s) => s.value === rawValue);
    if (!option) return;
    if (option.type === "paragraph") {
      editor.chain().focus().setParagraph().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(option.value).run();
    }
  };

  /** YouTube 동영상 삽입 */
  const handleVideo = () => {
    const url = prompt("YouTube 동영상 URL을 입력하세요:");
    if (!url) return;
    editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  const btnClass = (active: boolean) =>
    `${styles.toolbarBtn}${active ? ` ${styles.toolbarBtnActive}` : ""}`;

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="서식 도구 모음">
      {/* ── full + lite 공통 버튼 ── */}

      {/* 링크 */}
      <button
        type="button"
        className={btnClass(editorState.isLink)}
        aria-label="링크 삽입"
        aria-pressed={editorState.isLink}
        title="링크 삽입"
        onClick={handleLink}
      >
        <i className="ri-link" aria-hidden="true" />
      </button>

      {/* 이미지 */}
      <button
        type="button"
        className={btnClass(uploading)}
        aria-label="이미지 삽입"
        title="이미지 파일 선택 후 즉시 삽입"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        <i className="ri-image-line" aria-hidden="true" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        disabled={uploading}
        onChange={handleImageFileChange}
      />

      {/* 코드블록 */}
      <button
        type="button"
        className={btnClass(editorState.isCodeBlock)}
        aria-label="코드블록"
        aria-pressed={editorState.isCodeBlock}
        title="코드블록"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <i className="ri-code-s-slash-line" aria-hidden="true" />
      </button>

      {/* 동영상 — full preset 전용 */}
      {preset === "full" && (
        <button
          type="button"
          className={styles.toolbarBtn}
          aria-label="동영상 삽입"
          title="동영상 삽입 (YouTube URL)"
          onClick={handleVideo}
        >
          <i className="ri-video-add-line" aria-hidden="true" />
        </button>
      )}

      {/* ── full preset 전용 버튼 ── */}
      {preset === "full" && (
        <>
          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 굵게 */}
          <button
            type="button"
            className={btnClass(editorState.isBold)}
            aria-label="굵게"
            aria-pressed={editorState.isBold}
            title="굵게"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <i className="ri-bold" aria-hidden="true" />
          </button>

          {/* 기울임 */}
          <button
            type="button"
            className={btnClass(editorState.isItalic)}
            aria-label="기울임"
            aria-pressed={editorState.isItalic}
            title="기울임"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <i className="ri-italic" aria-hidden="true" />
          </button>

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 폰트 크기 (디자인 시스템 커스텀 드롭다운 — OS 기본 select 금지) */}
          <FontSizeSelect
            value={editorState.fontSizeValue}
            options={FONT_SIZES.map((s) => ({ label: s.label, value: s.value }))}
            onChange={handleFontSize}
          />

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 왼쪽 정렬 */}
          <button
            type="button"
            className={btnClass(editorState.textAlignLeft)}
            aria-label="왼쪽 정렬"
            aria-pressed={editorState.textAlignLeft}
            title="왼쪽 정렬"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <i className="ri-align-left" aria-hidden="true" />
          </button>

          {/* 가운데 정렬 */}
          <button
            type="button"
            className={btnClass(editorState.textAlignCenter)}
            aria-label="가운데 정렬"
            aria-pressed={editorState.textAlignCenter}
            title="가운데 정렬"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <i className="ri-align-center" aria-hidden="true" />
          </button>

          {/* 오른쪽 정렬 */}
          <button
            type="button"
            className={btnClass(editorState.textAlignRight)}
            aria-label="오른쪽 정렬"
            aria-pressed={editorState.textAlignRight}
            title="오른쪽 정렬"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <i className="ri-align-right" aria-hidden="true" />
          </button>

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 불릿 목록 */}
          <button
            type="button"
            className={btnClass(editorState.isBulletList)}
            aria-label="불릿 목록"
            aria-pressed={editorState.isBulletList}
            title="불릿 목록"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <i className="ri-list-unordered" aria-hidden="true" />
          </button>

          {/* 순서 목록 */}
          <button
            type="button"
            className={btnClass(editorState.isOrderedList)}
            aria-label="순서있는 목록"
            aria-pressed={editorState.isOrderedList}
            title="순서있는 목록"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <i className="ri-list-ordered" aria-hidden="true" />
          </button>

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 글자 색상 */}
          <div className={styles.colorPickerWrap}>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${styles.colorBtn}`}
              aria-label="글자 색상"
              aria-expanded={showColorPalette}
              title="글자 색상 (제한 팔레트)"
              onClick={() => setShowColorPalette((prev) => !prev)}
            >
              <span className={styles.colorLetter} aria-hidden="true">
                A
              </span>
              <span
                className={styles.colorBar}
                style={{ background: selectedColor }}
                aria-hidden="true"
              />
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
                    style={{ background: c.value || "var(--gray-800)" }}
                    title={c.name}
                    aria-label={c.name}
                    onClick={() => handleColor(c.value)}
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

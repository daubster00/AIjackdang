"use client";

import { useRef, useState } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import styles from "./Editor.module.css";

/**
 * 허용 색상 팔레트 (12개 제한 팔레트 — 자유 색상 입력 금지, FR-2.5).
 * 토큰 기반 색상 + 보조 색상으로 12개를 구성한다.
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
 * 글 형식(블록 서식) 선택 옵션 — 검색 노출(SEO)을 위한 시맨틱 마크업.
 *
 * 옛 방식(인라인 font-size 스팬)은 큰 글씨를 <span style="font-size:36px"> 로만 만들어
 * 검색엔진이 문서 구조(제목/본문)를 인식하지 못했다. 이제 '글자 크기' 대신 '글 형식' 으로
 * 각 블록을 의미 있는 태그로 지정한다.
 *
 * - paragraph : 본문 → <p>
 * - h2        : 제목 → <h2>
 * - h3        : 소제목 → <h3>
 * - caption   : 캡션(이미지 설명·출처 등) → <p class="caption">
 */
const BLOCK_FORMATS: Array<{
  label: string;
  value: "paragraph" | "h2" | "h3" | "caption";
}> = [
  { label: "본문", value: "paragraph" },
  { label: "제목 (H2)", value: "h2" },
  { label: "소제목 (H3)", value: "h3" },
  { label: "캡션", value: "caption" },
];

type EditorToolbarProps = {
  editor: Editor | null;
  preset: "full" | "lite";
};

export function EditorToolbar({ editor, preset }: EditorToolbarProps) {
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [uploading, setUploading] = useState(false);
  // 색상 'A' 버튼 밑 작대기에 표시할, 가장 최근에 고른 글자 색상.
  const [selectedColor, setSelectedColor] = useState("#3030c0");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 에디터 내부 상태(선택 위치·서식) 구독.
   * `editor.isActive(...)` 를 JSX에서 직접 호출하면 selectionUpdate/transaction 이벤트가
   * 발생해도 React가 이 컴포넌트를 자동 리렌더하지 않는다.
   * useEditorState 는 Tiptap 이벤트를 useSyncExternalStore 로 연결해
   * 선택된 값이 바뀔 때만 리렌더를 트리거한다.
   */
  const editorState = useEditorState({
    editor,
    selector: (snapshot) => {
      const ed = snapshot.editor;
      // editor 가 초기화되기 전(null) 에는 빈 기본값을 반환한다.
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
          blockFormat: "paragraph" as "paragraph" | "h2" | "h3" | "caption",
        };
      }
      // 현재 커서 블록의 시맨틱 형식(본문/제목/소제목/캡션)을 판별한다.
      let blockFormat: "paragraph" | "h2" | "h3" | "caption" = "paragraph";
      if (ed.isActive("heading", { level: 2 })) blockFormat = "h2";
      else if (ed.isActive("heading", { level: 3 })) blockFormat = "h3";
      else if (ed.isActive("caption")) blockFormat = "caption";
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
        blockFormat,
      };
    },
  });

  // editor 가 null 이면 selector 는 호출되지 않아 editorState 도 null.
  // 두 조건을 함께 검사해 이후 블록에서 non-null 타입 보장.
  if (!editor || !editorState) return null;

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

  /** 파일 선택 후 업로드 → 에디터에 이미지 즉시 삽입 */
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
        const msg = (err as { error?: { message?: string } })?.error?.message ?? "업로드 실패";
        alert(msg);
        return;
      }

      const { url } = await res.json() as { url: string };
      editor.chain().focus().setImage({ src: url, alt: "" }).run();
    } catch {
      alert("업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      // 파일 input 초기화 (같은 파일 재선택 허용)
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

  /** 글 형식(블록 서식) 적용 — 시맨틱 태그로 변환(SEO) */
  const handleBlockFormat = (value: string) => {
    // 형식 변경 시 옛 인라인 글자 크기(font-size 스팬)는 해제해 시맨틱 크기로 통일한다.
    const chain = editor.chain().focus().unsetFontSize();
    switch (value) {
      case "h2":
        chain.setHeading({ level: 2 }).run();
        break;
      case "h3":
        chain.setHeading({ level: 3 }).run();
        break;
      case "caption":
        chain.setCaption().run();
        break;
      case "paragraph":
      default:
        chain.setParagraph().run();
        break;
    }
  };

  /** 동영상(YouTube) 삽입 */
  const handleVideo = () => {
    const url = prompt("YouTube 동영상 URL을 입력하세요:");
    if (!url) return;
    editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="서식 도구 모음">
      {/* ── full + lite 공통 버튼 ── */}

      {/* 링크 */}
      <button
        type="button"
        className={`${styles.toolbarBtn}${editorState.isLink ? ` ${styles.toolbarBtnActive}` : ""}`}
        aria-label="링크 삽입"
        aria-pressed={editorState.isLink}
        title="링크 삽입"
        onClick={handleLink}
      >
        <i className="ri-link" aria-hidden="true" />
      </button>

      {/* 이미지 — 버튼 클릭 시 파일 선택 창 즉시 열기 */}
      <button
        type="button"
        className={`${styles.toolbarBtn}${uploading ? ` ${styles.toolbarBtnActive}` : ""}`}
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
        className={`${styles.toolbarBtn}${editorState.isCodeBlock ? ` ${styles.toolbarBtnActive}` : ""}`}
        aria-label="코드블록"
        aria-pressed={editorState.isCodeBlock}
        title="코드블록"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <i className="ri-code-s-slash-line" aria-hidden="true" />
      </button>

      {/* 동영상 (YouTube) — full preset 에서만 노출 */}
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
            className={`${styles.toolbarBtn}${editorState.isBold ? ` ${styles.toolbarBtnActive}` : ""}`}
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
            className={`${styles.toolbarBtn}${editorState.isItalic ? ` ${styles.toolbarBtnActive}` : ""}`}
            aria-label="기울임"
            aria-pressed={editorState.isItalic}
            title="기울임"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <i className="ri-italic" aria-hidden="true" />
          </button>

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 글 형식 선택 드롭다운 — 제목/소제목/본문/캡션을 시맨틱 태그로 지정(SEO) */}
          <select
            className={styles.fontSizeSelect}
            aria-label="글 형식"
            title="글 형식 (제목·소제목·본문·캡션)"
            value={editorState.blockFormat}
            onChange={(e) => handleBlockFormat(e.target.value)}
          >
            {BLOCK_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 왼쪽 정렬 */}
          <button
            type="button"
            className={`${styles.toolbarBtn}${editorState.textAlignLeft ? ` ${styles.toolbarBtnActive}` : ""}`}
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
            className={`${styles.toolbarBtn}${editorState.textAlignCenter ? ` ${styles.toolbarBtnActive}` : ""}`}
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
            className={`${styles.toolbarBtn}${editorState.textAlignRight ? ` ${styles.toolbarBtnActive}` : ""}`}
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
            className={`${styles.toolbarBtn}${editorState.isBulletList ? ` ${styles.toolbarBtnActive}` : ""}`}
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
            className={`${styles.toolbarBtn}${editorState.isOrderedList ? ` ${styles.toolbarBtnActive}` : ""}`}
            aria-label="순서있는 목록"
            aria-pressed={editorState.isOrderedList}
            title="순서있는 목록"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <i className="ri-list-ordered" aria-hidden="true" />
          </button>

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* 색상 (제한 팔레트) — 'A' 글자 밑 3px 작대기에 현재 선택색 표시 */}
          <div className={styles.colorPickerWrap}>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${styles.colorBtn}`}
              aria-label="글자 색상"
              aria-expanded={showColorPalette}
              title="글자 색상 (제한 팔레트)"
              onClick={() => {
                setShowColorPalette((prev) => !prev);
              }}
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
                    style={{ background: c.value || "var(--color-text)" }}
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

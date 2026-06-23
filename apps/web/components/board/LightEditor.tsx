"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Icon } from "@/components/ui";
import styles from "./LightEditor.module.css";

/**
 * 경량 리치 에디터 (공용).
 * 답변·댓글처럼 풀 에디터(PostWriteForm)까지는 필요 없는 짧은 본문 입력에 쓴다.
 * 서식: 굵게·기울임 / 정렬(왼·가운데·오른쪽) / 목록 / 링크 / 이미지 / 코드블록.
 * (글자 크기·색상·유튜브·파일첨부는 풀 에디터 전용. 여기엔 의도적으로 넣지 않는다.)
 *
 * 자기완결형 컴포넌트라 PostWriteForm 과 코드를 공유하지 않는다(작업 충돌 방지).
 * 부모는 onChange 로 html·text·초과여부를 받아 제출 버튼 활성/비활성 등에 사용한다.
 */
export type LightEditorState = {
  /** 에디터 본문 HTML */
  html: string;
  /** 태그를 제외한 순수 텍스트 (글자 수 계산용) */
  text: string;
  /** maxLength 초과 여부 (maxLength 미지정 시 항상 false) */
  isOverLimit: boolean;
};

export type LightEditorProps = {
  /** 빈 상태 안내 문구 */
  placeholder?: string;
  /** 접근성 라벨 (기본 "내용 입력") */
  ariaLabel?: string;
  /** 에디터 최소 높이(px). 기본 160 */
  minHeight?: number;
  /** 최대 글자 수. 지정하면 하단에 글자 수 카운터를 표시한다. */
  maxLength?: number;
  /** 내용이 바뀔 때마다 호출 */
  onChange?: (state: LightEditorState) => void;
  /** 에디터 래퍼에 붙일 추가 클래스 */
  className?: string;
};

export function LightEditor({
  placeholder = "내용을 입력하세요.",
  ariaLabel = "내용 입력",
  minHeight = 160,
  maxLength,
  onChange,
  className,
}: LightEditorProps) {
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const [charCount, setCharCount] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedSelection = useRef<Range | null>(null);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (!savedSelection.current || !editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  }, []);

  // 현재 커서 위치 기준으로 활성 서식(굵게/정렬/목록/코드)을 갱신해 버튼 눌림 상태에 반영
  const updateActiveFormats = useCallback(() => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setActiveFormats({}); return; }
    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.startContainer)) { setActiveFormats({}); return; }

    const formats: Record<string, boolean> = {
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      ul: document.queryCommandState("insertUnorderedList"),
      alignLeft: document.queryCommandState("justifyLeft"),
      alignCenter: document.queryCommandState("justifyCenter"),
      alignRight: document.queryCommandState("justifyRight"),
    };
    let node: Node | null = range.startContainer;
    while (node && node !== editorRef.current) {
      if (node.nodeName === "PRE") formats.code = true;
      node = node.parentNode;
    }
    setActiveFormats(formats);
  }, []);

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = (editor.textContent ?? "").replace(/​/g, "");
    setCharCount(text.length);
    onChange?.({
      html: editor.innerHTML,
      text,
      isOverLimit: maxLength != null && text.length > maxLength,
    });
  }, [onChange, maxLength]);

  const execFormat = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      // execCommand는 deprecated이나 모든 브라우저에서 여전히 동작한다.
      document.execCommand(command, false, value);
      emitChange();
      updateActiveFormats();
    },
    [emitChange, updateActiveFormats],
  );

  const handleLink = useCallback(() => {
    const url = prompt("링크 URL을 입력하세요:");
    if (url) execFormat("createLink", url);
  }, [execFormat]);

  const handleInsertImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          restoreSelection();
          document.execCommand("insertImage", false, ev.target.result as string);
          editorRef.current?.focus();
          emitChange();
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [restoreSelection, emitChange],
  );

  // 선택한 텍스트(없으면 안내 문구)를 코드블록으로 감싸고, 뒤에 탈출용 빈 단락을 둔다.
  const handleInsertCode = useCallback(() => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || !editorRef.current || sel.rangeCount === 0) return;
    const selectedText = sel.toString();
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = selectedText || "// 코드를 입력하세요";
    pre.appendChild(code);

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(pre);
    const exitPara = document.createElement("p");
    exitPara.appendChild(document.createElement("br"));
    pre.parentNode?.insertBefore(exitPara, pre.nextSibling);

    const newRange = document.createRange();
    const textNode = code.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      newRange.setStart(textNode, 0);
    } else {
      newRange.setStart(code, 0);
    }
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    editorRef.current.focus();
    emitChange();
  }, [emitChange]);

  // Shift+Enter: 코드블록 안에서 일반 텍스트 영역으로 탈출
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || !e.shiftKey) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    let node: Node | null = sel.getRangeAt(0).startContainer;
    let preEl: HTMLElement | null = null;
    while (node && node !== editorRef.current) {
      if (node.nodeName === "PRE") { preEl = node as HTMLElement; break; }
      node = node.parentNode;
    }
    if (!preEl) return;

    e.preventDefault();
    let exitEl = preEl.nextElementSibling as HTMLElement | null;
    if (!exitEl || exitEl.nodeName === "PRE") {
      exitEl = document.createElement("p");
      exitEl.appendChild(document.createElement("br"));
      preEl.parentNode?.insertBefore(exitEl, preEl.nextSibling);
    }
    const newRange = document.createRange();
    newRange.setStart(exitEl, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateActiveFormats);
    return () => document.removeEventListener("selectionchange", updateActiveFormats);
  }, [updateActiveFormats]);

  const isOverLimit = maxLength != null && charCount > maxLength;

  return (
    <div className={`${styles.editorWrap} ${className ?? ""}`}>
      <div className={styles.toolbar} role="toolbar" aria-label="서식 도구 모음">
        {/* 굵게 / 기울임 */}
        <button
          type="button"
          className={`${styles.btn}${activeFormats.bold ? ` ${styles.btnActive}` : ""}`}
          title="굵게"
          aria-label="굵게"
          aria-pressed={!!activeFormats.bold}
          onClick={() => execFormat("bold")}
        >
          <Icon name="bold" />
        </button>
        <button
          type="button"
          className={`${styles.btn}${activeFormats.italic ? ` ${styles.btnActive}` : ""}`}
          title="기울임"
          aria-label="기울임"
          aria-pressed={!!activeFormats.italic}
          onClick={() => execFormat("italic")}
        >
          <Icon name="italic" />
        </button>

        <span className={styles.divider} aria-hidden="true" />

        {/* 정렬: 왼쪽 / 가운데 / 오른쪽 */}
        <button
          type="button"
          className={`${styles.btn}${activeFormats.alignLeft ? ` ${styles.btnActive}` : ""}`}
          title="왼쪽 정렬"
          aria-label="왼쪽 정렬"
          aria-pressed={!!activeFormats.alignLeft}
          onClick={() => execFormat("justifyLeft")}
        >
          <Icon name="align-left" />
        </button>
        <button
          type="button"
          className={`${styles.btn}${activeFormats.alignCenter ? ` ${styles.btnActive}` : ""}`}
          title="가운데 정렬"
          aria-label="가운데 정렬"
          aria-pressed={!!activeFormats.alignCenter}
          onClick={() => execFormat("justifyCenter")}
        >
          <Icon name="align-center" />
        </button>
        <button
          type="button"
          className={`${styles.btn}${activeFormats.alignRight ? ` ${styles.btnActive}` : ""}`}
          title="오른쪽 정렬"
          aria-label="오른쪽 정렬"
          aria-pressed={!!activeFormats.alignRight}
          onClick={() => execFormat("justifyRight")}
        >
          <Icon name="align-right" />
        </button>

        <span className={styles.divider} aria-hidden="true" />

        {/* 목록 */}
        <button
          type="button"
          className={`${styles.btn}${activeFormats.ul ? ` ${styles.btnActive}` : ""}`}
          title="목록"
          aria-label="목록"
          aria-pressed={!!activeFormats.ul}
          onClick={() => execFormat("insertUnorderedList")}
        >
          <Icon name="list-unordered" />
        </button>

        <span className={styles.divider} aria-hidden="true" />

        {/* 링크 / 이미지 / 코드블록 */}
        <button
          type="button"
          className={styles.btn}
          title="링크 삽입"
          aria-label="링크 삽입"
          onClick={handleLink}
        >
          <Icon name="link" />
        </button>
        <button
          type="button"
          className={styles.btn}
          title="이미지 삽입"
          aria-label="이미지 삽입"
          onClick={() => {
            saveSelection();
            imageInputRef.current?.click();
          }}
        >
          <Icon name="image-line" />
        </button>
        <button
          type="button"
          className={`${styles.btn}${activeFormats.code ? ` ${styles.btnActive}` : ""}`}
          title="코드블록"
          aria-label="코드블록"
          aria-pressed={!!activeFormats.code}
          onClick={handleInsertCode}
        >
          <Icon name="code-s-slash-line" />
        </button>
      </div>

      <div
        ref={editorRef}
        className={styles.editorArea}
        style={{ minHeight }}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onKeyDown={handleEditorKeyDown}
        data-placeholder={placeholder}
        aria-label={ariaLabel}
        aria-multiline="true"
        role="textbox"
      />

      {maxLength != null && (
        <div className={styles.footer}>
          <span className={`${styles.charCount} ${isOverLimit ? styles.charCountWarn : ""}`}>
            {charCount.toLocaleString()}/{maxLength.toLocaleString()}자
          </span>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handleInsertImage}
        aria-hidden="true"
      />
    </div>
  );
}

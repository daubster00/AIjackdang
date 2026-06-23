"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Icon } from "@/components/ui";
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

const FONT_COLORS = [
  { name: "기본", value: "#171827" },
  { name: "강조", value: "#3030c0" },
  { name: "빨강", value: "#d9363e" },
  { name: "파랑", value: "#1a73e8" },
  { name: "초록", value: "#188a42" },
  { name: "회색", value: "#8a8ea0" },
];

// 에디터에서 허용하는 폰트 크기(px). 기획상 "자유 글자 크기"는 비활성이라 정해진 값만 노출한다.
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

const MAX_CHARS = 3000;
const MAX_TAGS = 5;
const MAX_FILES = 5;

// 유튜브 링크에서 11자리 영상 ID를 뽑아낸다. watch?v= / youtu.be / shorts / embed 형식과
// ID만 입력한 경우를 지원한다. 못 찾으면 null.
function parseYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[\w-]{11}$/.test(url)) return url;
  return null;
}

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
  const [charCount, setCharCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const [currentFontSize, setCurrentFontSize] = useState("");
  // 툴바 색상 아이콘 밑줄에 비칠 색. 커서 위치의 색을 따라가며, 색을 막 고른 직후엔 그 색을 보여준다.
  const [currentFontColor, setCurrentFontColor] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorImageInputRef = useRef<HTMLInputElement>(null);
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

  const updateActiveFormats = useCallback(() => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setActiveFormats({}); setCurrentFontSize(""); setCurrentFontColor(""); return; }
    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.startContainer)) { setActiveFormats({}); setCurrentFontSize(""); setCurrentFontColor(""); return; }

    const formats: Record<string, boolean> = {
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
      alignLeft: document.queryCommandState("justifyLeft"),
      alignCenter: document.queryCommandState("justifyCenter"),
      alignRight: document.queryCommandState("justifyRight"),
    };
    let fontSize = "";
    let fontColor = "";
    let node: Node | null = range.startContainer;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (!fontSize && el.dataset.fontSize) fontSize = el.dataset.fontSize;
        if (!fontColor && el.dataset.fontColor) fontColor = el.dataset.fontColor;
      }
      switch (node.nodeName) {
        case "BLOCKQUOTE": formats.blockquote = true; break;
        case "PRE": formats.code = true; break;
      }
      node = node.parentNode;
    }
    setActiveFormats(formats);
    setCurrentFontSize(fontSize);
    setCurrentFontColor(fontColor);
  }, []);

  const execFormat = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    // execCommand is deprecated but still functional across all browsers
    document.execCommand(command, false, value);
    // 클릭 직후 selection이 바뀌지 않아도 (커서만 있는 상태에서 볼드/기울임 토글)
    // 버튼 활성 표시를 즉시 갱신한다.
    updateActiveFormats();
  }, [updateActiveFormats]);

  // 선택한(드래그한) 글자만 span으로 감싸 스타일을 적용한다. dedupeSelector에 걸리는
  // 기존 span은 풀어서 중첩을 막는다. 선택 영역이 없으면 아무 것도 하지 않는다.
  const wrapSelection = useCallback(
    (configure: (span: HTMLSpanElement) => void, dedupeSelector: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed || !editor.contains(range.startContainer)) return;

      const frag = range.extractContents();
      frag.querySelectorAll(dedupeSelector).forEach((el) => {
        while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
        el.parentNode?.removeChild(el);
      });
      const span = document.createElement("span");
      configure(span);
      span.appendChild(frag);
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      handleEditorInput();
      updateActiveFormats();
    },
    [updateActiveFormats], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 선택 영역 안의 특정 span을 풀어 원래 스타일로 되돌린다.
  const unwrapSelection = useCallback(
    (selector: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed || !editor.contains(range.startContainer)) return;

      const frag = range.extractContents();
      frag.querySelectorAll(selector).forEach((el) => {
        while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
        el.parentNode?.removeChild(el);
      });
      range.insertNode(frag);
      handleEditorInput();
      updateActiveFormats();
    },
    [updateActiveFormats], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 폰트 크기 선택. 드래그한 글자가 있으면 그 글자에만 적용하고,
  // 커서만 있을 때는 빈 크기 span을 만들어 그 안에 커서를 두어 이후 입력이 그 크기로 들어가게 한다.
  const handleFontSize = useCallback(
    (size: string) => {
      setShowFontSizePicker(false);
      restoreSelection();
      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) { editor.focus(); return; }
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.startContainer)) { editor.focus(); return; }

      // 드래그로 선택된 글자가 있는 경우
      if (!range.collapsed) {
        if (!size) unwrapSelection("span[data-font-size]");
        else
          wrapSelection((span) => {
            span.dataset.fontSize = size;
            span.style.fontSize = `${size}px`;
          }, "span[data-font-size]");
        return;
      }

      // 커서만 있는 경우 (선택 글자 없음) — 이후 입력에 크기를 적용/해제
      const ZWSP = "​";
      if (size) {
        const span = document.createElement("span");
        span.dataset.fontSize = size;
        span.style.fontSize = `${size}px`;
        const zwsp = document.createTextNode(ZWSP);
        span.appendChild(zwsp);
        range.insertNode(span);
        const r = document.createRange();
        r.setStart(zwsp, 1);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      } else {
        // 기본: 현재 크기 span 밖으로 커서를 빼내 이후 입력이 기본 크기로 들어가게 한다
        let sizeSpan: HTMLElement | null = null;
        let node: Node | null = range.startContainer;
        while (node && node !== editor) {
          if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset.fontSize) {
            sizeSpan = node as HTMLElement;
            break;
          }
          node = node.parentNode;
        }
        if (!sizeSpan) { editor.focus(); return; }
        const zwsp = document.createTextNode(ZWSP);
        sizeSpan.parentNode?.insertBefore(zwsp, sizeSpan.nextSibling);
        const r = document.createRange();
        r.setStart(zwsp, 1);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      handleEditorInput();
      updateActiveFormats();
    },
    [restoreSelection, wrapSelection, unwrapSelection, updateActiveFormats], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleBlockquote = useCallback(() => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    let isInBlockquote = false;
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.getRangeAt(0).startContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeName === "BLOCKQUOTE") { isInBlockquote = true; break; }
        node = node.parentNode;
      }
    }
    if (isInBlockquote) {
      execFormat("formatBlock", "<p>");
      return;
    }
    execFormat("formatBlock", "<blockquote>");
    // 인용 블록 뒤에 탈출용 빈 단락 추가
    setTimeout(() => {
      const s = window.getSelection();
      if (!s || !editorRef.current || s.rangeCount === 0) return;
      let nd: Node | null = s.getRangeAt(0).startContainer;
      let bq: HTMLElement | null = null;
      while (nd && nd !== editorRef.current) {
        if (nd.nodeName === "BLOCKQUOTE") { bq = nd as HTMLElement; break; }
        nd = nd.parentNode;
      }
      if (bq && !bq.nextElementSibling) {
        const p = document.createElement("p");
        p.appendChild(document.createElement("br"));
        bq.parentNode?.insertBefore(p, bq.nextSibling);
      }
    }, 0);
  }, [execFormat]);

  const handleInsertCode = useCallback(() => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;
    const selectedText = sel.toString();
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = selectedText || "// 코드를 입력하세요";
    pre.appendChild(code);
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(pre);
      const exitPara = document.createElement("p");
      exitPara.appendChild(document.createElement("br"));
      if (pre.parentNode) {
        pre.parentNode.insertBefore(exitPara, pre.nextSibling);
      }
      // 텍스트 선택 없이 커서만 코드 맨 앞에 위치
      const newRange = document.createRange();
      const textNode = code.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        newRange.setStart(textNode, 0);
        newRange.collapse(true);
      } else {
        newRange.setStart(code, 0);
        newRange.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    editorRef.current.focus();
    handleEditorInput();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Shift+Enter: 코드 블록 / 인용 안에서 일반 텍스트 영역으로 탈출
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter" || !e.shiftKey) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      let node: Node | null = sel.getRangeAt(0).startContainer;
      let blockEl: HTMLElement | null = null;
      while (node && node !== editorRef.current) {
        if (node.nodeName === "PRE" || node.nodeName === "BLOCKQUOTE") {
          blockEl = node as HTMLElement;
          break;
        }
        node = node.parentNode;
      }
      if (!blockEl) return;

      e.preventDefault();
      let exitEl = blockEl.nextElementSibling as HTMLElement | null;
      if (!exitEl || exitEl.nodeName === "PRE" || exitEl.nodeName === "BLOCKQUOTE") {
        exitEl = document.createElement("p");
        exitEl.appendChild(document.createElement("br"));
        blockEl.parentNode?.insertBefore(exitEl, blockEl.nextSibling);
      }
      const newRange = document.createRange();
      newRange.setStart(exitEl, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    },
    [],
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
          handleEditorInput();
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [restoreSelection], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 유튜브 링크를 받아 반응형 임베드(16:9)를 커서 위치에 삽입한다.
  // 임베드는 contentEditable="false" 블록으로 넣어 에디터 안에서 통째로 다뤄지게 하고,
  // 뒤에 빈 단락을 두어 임베드 다음에 계속 입력할 수 있게 한다.
  const handleInsertVideo = useCallback(() => {
    saveSelection();
    const url = prompt("유튜브 링크를 입력하세요:");
    if (url === null) return;
    const id = parseYouTubeId(url.trim());
    if (!id) {
      alert("올바른 유튜브 링크가 아닙니다. 예: https://www.youtube.com/watch?v=...");
      return;
    }
    restoreSelection();
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { editor.focus(); return; }
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.startContainer)) { editor.focus(); return; }

    const wrapper = document.createElement("div");
    wrapper.className = styles.videoEmbed;
    wrapper.contentEditable = "false";
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube.com/embed/${id}`;
    iframe.title = "유튜브 동영상";
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    );
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    wrapper.appendChild(iframe);

    range.deleteContents();
    range.insertNode(wrapper);

    // 임베드 뒤 탈출용 빈 단락 (이미 다음 형제가 있으면 그쪽으로 커서 이동)
    let exitEl = wrapper.nextElementSibling as HTMLElement | null;
    if (!exitEl) {
      exitEl = document.createElement("p");
      exitEl.appendChild(document.createElement("br"));
      wrapper.parentNode?.insertBefore(exitEl, wrapper.nextSibling);
    }
    const newRange = document.createRange();
    newRange.setStart(exitEl, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    editor.focus();
    handleEditorInput();
  }, [saveSelection, restoreSelection]); // eslint-disable-line react-hooks/exhaustive-deps

  // 글자 색상 선택. 드래그한 글자가 있으면 그 글자에만 적용하고,
  // 커서만 있을 때는 빈 색상 span을 만들어 그 안에 커서를 두어 이후 입력이 그 색으로 들어가게 한다.
  const handleFontColor = useCallback(
    (color: string) => {
      setShowColorPicker(false);
      // 팝오버를 여닫으며 잃은 선택을 복원한다.
      restoreSelection();
      const isDefault = color === FONT_COLORS[0].value;
      // 툴바 아이콘 밑줄에 고른 색을 즉시 반영 (기본은 비움)
      setCurrentFontColor(isDefault ? "" : color);

      const editor = editorRef.current;
      if (!editor) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) { editor.focus(); return; }
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.startContainer)) { editor.focus(); return; }

      // 드래그로 선택된 글자가 있는 경우 — 선택 글자에만 적용/해제
      if (!range.collapsed) {
        if (isDefault) unwrapSelection("span[data-font-color]");
        else
          wrapSelection((span) => {
            span.dataset.fontColor = color;
            span.style.color = color;
          }, "span[data-font-color]");
        return;
      }

      // 커서만 있는 경우 (선택 글자 없음) — 이후 입력에 색을 적용/해제
      const ZWSP = "​";
      if (!isDefault) {
        const span = document.createElement("span");
        span.dataset.fontColor = color;
        span.style.color = color;
        const zwsp = document.createTextNode(ZWSP);
        span.appendChild(zwsp);
        range.insertNode(span);
        const r = document.createRange();
        r.setStart(zwsp, 1);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      } else {
        // 기본: 현재 색상 span 밖으로 커서를 빼내 이후 입력이 기본 색으로 들어가게 한다
        let colorSpan: HTMLElement | null = null;
        let node: Node | null = range.startContainer;
        while (node && node !== editor) {
          if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset.fontColor) {
            colorSpan = node as HTMLElement;
            break;
          }
          node = node.parentNode;
        }
        if (!colorSpan) { editor.focus(); return; }
        const zwsp = document.createTextNode(ZWSP);
        colorSpan.parentNode?.insertBefore(zwsp, colorSpan.nextSibling);
        const r = document.createRange();
        r.setStart(zwsp, 1);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      handleEditorInput();
      updateActiveFormats();
    },
    [restoreSelection, wrapSelection, unwrapSelection, updateActiveFormats], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleEditorInput() {
    if (editorRef.current) {
      // 폭 0 공백(zero-width space)은 크기 적용용 보조 문자이므로 글자 수에서 제외
      const text = (editorRef.current.textContent ?? "").replace(/​/g, "");
      setCharCount(text.length);
    }
  }

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

  useEffect(() => {
    // 피커 바깥을 클릭했을 때만 닫는다. (stopPropagation 에 의존하지 않고 포함 여부로 판단)
    const close = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target && target.closest("[data-picker]")) return;
      setShowColorPicker(false);
      setShowFontSizePicker(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowColorPicker(false);
        setShowFontSizePicker(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateActiveFormats);
    return () => document.removeEventListener("selectionchange", updateActiveFormats);
  }, [updateActiveFormats]);

  const isOverLimit = charCount > MAX_CHARS;

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

        {/* 본문 에디터 */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            {config.bodyLabel} <span className={styles.required}>*</span>
          </label>
          <div className={styles.editorWrap}>
            {/* 툴바 */}
            <div className={styles.editorToolbar} role="toolbar" aria-label="서식 도구 모음">
              {/* Bold / Italic */}
              <button
                type="button"
                className={`${styles.toolbarBtn}${activeFormats.bold ? ` ${styles.toolbarBtnActive}` : ""}`}
                title="굵게"
                aria-label="굵게"
                aria-pressed={!!activeFormats.bold}
                onClick={() => execFormat("bold")}
              >
                <Icon name="bold" />
              </button>
              <button
                type="button"
                className={`${styles.toolbarBtn}${activeFormats.italic ? ` ${styles.toolbarBtnActive}` : ""}`}
                title="기울임"
                aria-label="기울임"
                aria-pressed={!!activeFormats.italic}
                onClick={() => execFormat("italic")}
              >
                <Icon name="italic" />
              </button>

              <span className={styles.toolbarDivider} aria-hidden="true" />

              {/* Font size */}
              <div className={styles.toolbarPickerWrap} data-picker>
                <button
                  type="button"
                  className={styles.fontSizeBtn}
                  title="글자 크기"
                  aria-label="글자 크기"
                  aria-haspopup="listbox"
                  aria-expanded={showFontSizePicker}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    saveSelection();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFontSizePicker((prev) => !prev);
                    setShowColorPicker(false);
                  }}
                >
                  <span className={styles.fontSizeBtnLabel}>
                    {currentFontSize ? `${currentFontSize}px` : "본문"}
                  </span>
                  <Icon name="arrow-down-s-line" className={styles.fontSizeBtnCaret} />
                </button>
                {showFontSizePicker && (
                  <div
                    className={styles.fontSizeMenu}
                    role="listbox"
                    aria-label="글자 크기 선택"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={!currentFontSize}
                      className={`${styles.fontSizeOption}${!currentFontSize ? ` ${styles.fontSizeOptionActive}` : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFontSize("")}
                    >
                      본문
                    </button>
                    {FONT_SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="option"
                        aria-selected={currentFontSize === String(s)}
                        className={`${styles.fontSizeOption}${currentFontSize === String(s) ? ` ${styles.fontSizeOptionActive}` : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleFontSize(String(s))}
                      >
                        {s}px
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className={styles.toolbarDivider} aria-hidden="true" />

              {/* List */}
              <button
                type="button"
                className={`${styles.toolbarBtn}${activeFormats.ul ? ` ${styles.toolbarBtnActive}` : ""}`}
                title="순서없는 목록"
                aria-label="순서없는 목록"
                aria-pressed={!!activeFormats.ul}
                onClick={() => execFormat("insertUnorderedList")}
              >
                <Icon name="list-unordered" />
              </button>
              <button
                type="button"
                className={`${styles.toolbarBtn}${activeFormats.ol ? ` ${styles.toolbarBtnActive}` : ""}`}
                title="순서있는 목록"
                aria-label="순서있는 목록"
                aria-pressed={!!activeFormats.ol}
                onClick={() => execFormat("insertOrderedList")}
              >
                <Icon name="list-ordered" />
              </button>

              <span className={styles.toolbarDivider} aria-hidden="true" />

              {/* Align: left / center / right */}
              <button
                type="button"
                className={`${styles.toolbarBtn}${activeFormats.alignLeft ? ` ${styles.toolbarBtnActive}` : ""}`}
                title="왼쪽 정렬"
                aria-label="왼쪽 정렬"
                aria-pressed={!!activeFormats.alignLeft}
                onClick={() => execFormat("justifyLeft")}
              >
                <Icon name="align-left" />
              </button>
              <button
                type="button"
                className={`${styles.toolbarBtn}${activeFormats.alignCenter ? ` ${styles.toolbarBtnActive}` : ""}`}
                title="가운데 정렬"
                aria-label="가운데 정렬"
                aria-pressed={!!activeFormats.alignCenter}
                onClick={() => execFormat("justifyCenter")}
              >
                <Icon name="align-center" />
              </button>
              <button
                type="button"
                className={`${styles.toolbarBtn}${activeFormats.alignRight ? ` ${styles.toolbarBtnActive}` : ""}`}
                title="오른쪽 정렬"
                aria-label="오른쪽 정렬"
                aria-pressed={!!activeFormats.alignRight}
                onClick={() => execFormat("justifyRight")}
              >
                <Icon name="align-right" />
              </button>

              <span className={styles.toolbarDivider} aria-hidden="true" />

              {/* Link / Image / Video / Code / Quote */}
              <button
                type="button"
                className={styles.toolbarBtn}
                title="링크 삽입"
                aria-label="링크 삽입"
                onClick={handleLink}
              >
                <Icon name="link" />
              </button>
              <button
                type="button"
                className={styles.toolbarBtn}
                title="이미지 삽입"
                aria-label="이미지 삽입"
                onClick={() => {
                  saveSelection();
                  editorImageInputRef.current?.click();
                }}
              >
                <Icon name="image-line" />
              </button>
              <button
                type="button"
                className={styles.toolbarBtn}
                title="동영상 삽입 (유튜브)"
                aria-label="동영상 삽입"
                onClick={handleInsertVideo}
              >
                <Icon name="video-add-line" />
              </button>
              <button
                type="button"
                className={`${styles.toolbarBtn}${activeFormats.code ? ` ${styles.toolbarBtnActive}` : ""}`}
                title="코드블록"
                aria-label="코드블록"
                aria-pressed={!!activeFormats.code}
                onClick={handleInsertCode}
              >
                <Icon name="code-s-slash-line" />
              </button>
              <button
                type="button"
                className={`${styles.toolbarBtn}${activeFormats.blockquote ? ` ${styles.toolbarBtnActive}` : ""}`}
                title="인용"
                aria-label="인용"
                aria-pressed={!!activeFormats.blockquote}
                onClick={handleBlockquote}
              >
                <Icon name="double-quotes-l" />
              </button>

              <span className={styles.toolbarDivider} aria-hidden="true" />

              {/* Font Color picker */}
              <div className={styles.toolbarPickerWrap} data-picker>
                <button
                  type="button"
                  className={styles.toolbarBtn}
                  title="글자 색상"
                  aria-label="글자 색상"
                  aria-expanded={showColorPicker}
                  onClick={(e) => {
                    e.stopPropagation();
                    saveSelection();
                    setShowColorPicker((prev) => !prev);
                  }}
                >
                  <span className={styles.fontColorIcon} aria-hidden="true">
                    <span className={styles.fontColorIconLetter}>A</span>
                    <span
                      className={styles.fontColorIconBar}
                      style={{ background: currentFontColor || "currentColor" }}
                    />
                  </span>
                </button>
                {showColorPicker && (
                  <div
                    className={styles.colorPicker}
                    role="listbox"
                    aria-label="글자 색상 선택"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {FONT_COLORS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        className={styles.colorSwatch}
                        style={{ background: c.value }}
                        title={c.name}
                        aria-label={c.name}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleFontColor(c.value)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 에디터 영역 */}
            <div
              ref={editorRef}
              className={styles.editorArea}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onKeyDown={handleEditorKeyDown}
              data-placeholder={config.bodyPlaceholder}
              aria-label={config.bodyLabel}
              aria-multiline="true"
              role="textbox"
            />

            {/* 글자 수 */}
            <div className={styles.editorFooter}>
              <span
                className={`${styles.charCount} ${isOverLimit ? styles.charCountWarn : ""}`}
              >
                {charCount.toLocaleString()}/{MAX_CHARS.toLocaleString()}자
              </span>
            </div>
          </div>
          <input
            ref={editorImageInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={handleInsertImage}
            aria-hidden="true"
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
            <button type="submit" className={styles.submitBtn} disabled={isOverLimit}>
              {config.submitIcon && <Icon name={config.submitIcon} />}
              {config.submitLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

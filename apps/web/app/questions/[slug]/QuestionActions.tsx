"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { ReportModal } from "../../vibe-coding/[slug]/ReportModal";
import styles from "../questions.module.css";

/** 질문 본문 하단 반응 바: 공유 / 신고 */
const SHARE_OPTIONS = [
  { id: "kakao",    label: "카카오톡",   iconName: "kakao-talk-fill", bg: "#FEE500", fg: "#3A1D1D" },
  { id: "band",     label: "밴드",       iconName: "group-2-fill",    bg: "#00C73C", fg: "#ffffff" },
  { id: "facebook", label: "Facebook",   iconName: "facebook-fill",   bg: "#1877F2", fg: "#ffffff" },
  { id: "twitter",  label: "X (트위터)", iconName: "twitter-x-fill",  bg: "#000000", fg: "#ffffff" },
  { id: "copy",     label: "링크 복사",  iconName: "links-line",      bg: "var(--color-bg)", fg: "var(--color-text)", border: true },
] as const;

export function QuestionActions() {
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    }
    if (shareOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [shareOpen]);

  function handleShare(id: string) {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (id === "copy") {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => { setCopied(false); setShareOpen(false); }, 1500);
      });
      return;
    }
    const encodedUrl = encodeURIComponent(url);
    const shareUrls: Record<string, string> = {
      kakao:    `https://sharer.kakao.com/talk/friends/picker/link?url=${encodedUrl}`,
      band:     `https://band.us/plugin/share?body=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter:  `https://twitter.com/intent/tweet?url=${encodedUrl}`,
    };
    if (shareUrls[id]) {
      window.open(shareUrls[id], "_blank", "noopener,noreferrer,width=600,height=500");
    }
    setShareOpen(false);
  }

  return (
    <>
      <div className={styles.reactionBar} aria-label="질문 반응">
        <div className={styles.shareDropdownWrapper} ref={shareRef}>
          <button
            type="button"
            onClick={() => setShareOpen((prev) => !prev)}
            aria-expanded={shareOpen}
          >
            <Icon name="share-forward-line" />
            공유
          </button>
          {shareOpen && (
            <div className={styles.shareDropdown} role="menu">
              {SHARE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={styles.shareDropdownItem}
                  role="menuitem"
                  onClick={() => handleShare(opt.id)}
                >
                  <span
                    className={styles.shareDropdownIcon}
                    style={{
                      background: opt.bg,
                      color: opt.fg,
                      boxShadow: "border" in opt && opt.border ? "inset 0 0 0 1px var(--color-border)" : undefined,
                    }}
                  >
                    <Icon name={opt.id === "copy" && copied ? "check-line" : opt.iconName} />
                  </span>
                  <span>{opt.id === "copy" && copied ? "복사됐습니다!" : opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" onClick={() => setReportOpen(true)}>
          <Icon name="alarm-warning-line" />
          신고
        </button>
      </div>
      <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />
    </>
  );
}

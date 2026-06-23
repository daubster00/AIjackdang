"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import styles from "../vibe-coding.module.css";

const SHARE_OPTIONS = [
  {
    id: "kakao",
    label: "카카오톡",
    iconName: "kakao-talk-fill",
    bg: "#FEE500",
    fg: "#3A1D1D",
  },
  {
    id: "band",
    label: "밴드",
    iconName: "group-2-fill",
    bg: "#00C73C",
    fg: "#ffffff",
  },
  {
    id: "facebook",
    label: "Facebook",
    iconName: "facebook-fill",
    bg: "#1877F2",
    fg: "#ffffff",
  },
  {
    id: "twitter",
    label: "X (트위터)",
    iconName: "twitter-x-fill",
    bg: "#000000",
    fg: "#ffffff",
  },
  {
    id: "copy",
    label: "링크 복사",
    iconName: "links-line",
    bg: "var(--color-bg)",
    fg: "var(--color-text)",
    border: true,
  },
] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function ShareModal({ isOpen, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      setCopied(false);
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  function handleShare(id: string) {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (id === "copy") {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
      return;
    }

    const encodedUrl = encodeURIComponent(url);
    const shareUrls: Record<string, string> = {
      kakao: `https://sharer.kakao.com/talk/friends/picker/link?url=${encodedUrl}`,
      band: `https://band.us/plugin/share?body=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}`,
    };
    if (shareUrls[id]) {
      window.open(shareUrls[id], "_blank", "noopener,noreferrer,width=600,height=500");
    }
  }

  return (
    <dialog ref={dialogRef} className={styles.reportDialog}>
      <div className={styles.shareModal}>
        <header className={styles.reportHeader}>
          <h3>공유하기</h3>
          <button
            type="button"
            className={styles.reportCloseBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            <Icon name="close-line" />
          </button>
        </header>

        <div className={styles.shareOptions}>
          {SHARE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={styles.shareOptionBtn}
              onClick={() => handleShare(opt.id)}
              aria-label={opt.id === "copy" && copied ? "링크가 복사됐습니다" : opt.label}
            >
              <span
                className={styles.shareIconCircle}
                style={{
                  background: opt.bg,
                  color: opt.fg,
                  boxShadow: "border" in opt && opt.border ? "inset 0 0 0 1px var(--color-border)" : undefined,
                }}
              >
                <Icon name={opt.id === "copy" && copied ? "check-line" : opt.iconName} />
              </span>
              <span className={styles.shareOptionLabel}>
                {opt.id === "copy" && copied ? "복사됨!" : opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { useGating } from "@/hooks/useGating";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast/Toast";
import { ReportModal } from "./ReportModal";
import styles from "../vibe-coding.module.css";

const SHARE_OPTIONS = [
  { id: "kakao",    label: "카카오톡",   iconName: "kakao-talk-fill", bg: "#FEE500", fg: "#3A1D1D" },
  { id: "band",     label: "밴드",       iconName: "group-2-fill",    bg: "#00C73C", fg: "#ffffff" },
  { id: "facebook", label: "Facebook",   iconName: "facebook-fill",   bg: "#1877F2", fg: "#ffffff" },
  { id: "twitter",  label: "X (트위터)", iconName: "twitter-x-fill",  bg: "#000000", fg: "#ffffff" },
  { id: "copy",     label: "링크 복사",  iconName: "links-line",      bg: "var(--color-bg)", fg: "var(--color-text)", border: true },
] as const;

type Props = {
  likes: number;
  bookmarks: number;
  postId: string;
  targetType: "post" | "question" | "answer" | "resource" | "comment";
  authorId: string | null;
  initialLiked?: boolean;
  initialBookmarked?: boolean;
  bookmarkId?: string | null;
};

export function ReactionBar({
  likes,
  bookmarks,
  postId,
  targetType,
  authorId,
  initialLiked = false,
  initialBookmarked = false,
  bookmarkId: initialBookmarkId = null,
}: Props) {
  const { requireAuth } = useGating();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(initialLiked);
  const [reactionId, setReactionId] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkId, setBookmarkId] = useState<string | null>(initialBookmarkId);
  const [likeCount, setLikeCount] = useState(likes);
  const [bookmarkCount, setBookmarkCount] = useState(bookmarks);
  const shareRef = useRef<HTMLDivElement>(null);

  const isSelf = user !== null && authorId !== null && user.id === authorId;

  // 마운트 시 좋아요·북마크 상태 조회
  useEffect(() => {
    if (!user) return;
    if (!isSelf) {
      void fetch(`/api/v1/reactions/me?targetType=${targetType}&targetId=${postId}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { liked: boolean; reactionId: string | null } | null) => {
          if (data) { setLiked(data.liked); setReactionId(data.reactionId); }
        })
        .catch(() => null);
    }
    if (targetType === "post" || targetType === "question" || targetType === "resource") {
      void fetch(`/api/v1/users/me/bookmarks/status?targetType=${targetType}&targetId=${postId}`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { bookmarked: boolean; bookmarkId: string | null } | null) => {
          if (data) { setBookmarked(data.bookmarked); setBookmarkId(data.bookmarkId); }
        })
        .catch(() => null);
    }
  }, [user, postId, targetType, isSelf]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false);
    }
    if (shareOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [shareOpen]);

  async function toggleLike() {
    if (!requireAuth("like")) return;
    if (isSelf) return;
    const prevLiked = liked;
    const prevCount = likeCount;
    const prevReactionId = reactionId;
    if (liked) { setLiked(false); setLikeCount((p) => p - 1); setReactionId(null); }
    else { setLiked(true); setLikeCount((p) => p + 1); }
    try {
      if (prevLiked && prevReactionId) {
        const res = await fetch(`/api/v1/reactions/${prevReactionId}`, { method: "DELETE", credentials: "include" });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch("/api/v1/reactions", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId: postId, reactionType: "like" }) });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { id: string };
        setReactionId(data.id);
      }
    } catch {
      setLiked(prevLiked); setLikeCount(prevCount); setReactionId(prevReactionId);
      toast({ tone: "danger", title: "좋아요 처리 중 오류가 발생했습니다." });
    }
  }

  async function toggleBookmark() {
    if (!requireAuth("bookmark")) return;
    const prevBookmarked = bookmarked;
    const prevCount = bookmarkCount;
    const prevBookmarkId = bookmarkId;
    if (bookmarked && bookmarkId) {
      setBookmarked(false); setBookmarkCount((p) => p - 1); setBookmarkId(null);
      try {
        const res = await fetch(`/api/v1/bookmarks/${bookmarkId}`, { method: "DELETE", credentials: "include" });
        if (!res.ok) throw new Error();
      } catch {
        setBookmarked(prevBookmarked); setBookmarkCount(prevCount); setBookmarkId(prevBookmarkId);
        toast({ tone: "danger", title: "북마크 해제에 실패했습니다." });
      }
    } else {
      setBookmarked(true); setBookmarkCount((p) => p + 1);
      try {
        const bmTargetType = (targetType === "post" || targetType === "question" || targetType === "resource") ? targetType : "post";
        const res = await fetch("/api/v1/bookmarks", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: bmTargetType, targetId: postId }) });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { id: string };
        setBookmarkId(data.id);
      } catch {
        setBookmarked(prevBookmarked); setBookmarkCount(prevCount); setBookmarkId(prevBookmarkId);
        toast({ tone: "danger", title: "북마크에 실패했습니다." });
      }
    }
  }

  async function handleShare(id: string) {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (id === "copy") {
      // 모바일 navigator.share 우선
      if (typeof navigator !== "undefined" && navigator.share) {
        try { await navigator.share({ url, title: document.title }); setShareOpen(false); return; } catch { /* 취소 시 fallback */ }
      }
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast({ tone: "success", title: "링크를 복사했어요." });
        setTimeout(() => { setCopied(false); setShareOpen(false); }, 1500);
      } catch {
        // clipboard 미지원 — 드롭다운에 URL 표시로 fallback
        setCopied(false);
      }
      return;
    }
    const encodedUrl = encodeURIComponent(url);
    const shareUrls: Record<string, string> = {
      kakao: `https://sharer.kakao.com/talk/friends/picker/link?url=${encodedUrl}`,
      band: `https://band.us/plugin/share?body=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}`,
    };
    if (shareUrls[id]) window.open(shareUrls[id], "_blank", "noopener,noreferrer,width=600,height=500");
    setShareOpen(false);
  }

  return (
    <>
      <div className={styles.reactionBar} aria-label="게시글 반응">
        <button
          type="button"
          className={liked ? styles.reactionBarBtnActive : undefined}
          onClick={() => void toggleLike()}
          aria-pressed={liked}
          aria-label={isSelf ? "내 글은 좋아요할 수 없습니다" : `좋아요 ${likeCount}개`}
          disabled={isSelf}
        >
          <Icon name={liked ? "heart-3-fill" : "heart-3-line"} />
          좋아요 {likeCount}
        </button>
        <button
          type="button"
          className={bookmarked ? styles.reactionBarBtnActive : undefined}
          onClick={() => void toggleBookmark()}
          aria-pressed={bookmarked}
          aria-label="북마크"
        >
          <Icon name={bookmarked ? "bookmark-fill" : "bookmark-line"} />
          북마크 {bookmarkCount}
        </button>

        <div className={styles.shareDropdownWrapper} ref={shareRef}>
          <button
            type="button"
            onClick={() => setShareOpen((prev) => !prev)}
            aria-expanded={shareOpen}
            aria-label="공유"
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
                  onClick={() => void handleShare(opt.id)}
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

        <button
          type="button"
          onClick={() => {
            if (!requireAuth("report")) return;
            setReportOpen(true);
          }}
        >
          <Icon name="alarm-warning-line" />
          신고
        </button>
      </div>
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType={targetType}
        targetId={postId}
      />
    </>
  );
}

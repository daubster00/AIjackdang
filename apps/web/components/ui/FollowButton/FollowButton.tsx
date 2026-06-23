"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGating } from "@/hooks/useGating";
import { useToast } from "@/components/ui/Toast/Toast";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import styles from "./FollowButton.module.css";

export interface FollowButtonProps {
  targetNickname: string;
  initialFollowing?: boolean;
  isBlocked?: boolean;
  className?: string;
}

export function FollowButton({
  targetNickname,
  initialFollowing = false,
  isBlocked = false,
  className,
}: FollowButtonProps) {
  const { user } = useAuth();
  const { requireAuth } = useGating();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  if (isBlocked) return null;

  async function handleClick() {
    if (!requireAuth("follow")) return;
    if (user && user.nickname === targetNickname) return;
    const prev = isFollowing;
    setIsFollowing(!prev);
    setLoading(true);
    try {
      if (prev) {
        const res = await fetch(`/api/v1/follows/${encodeURIComponent(targetNickname)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error();
      } else {
        const res = await fetch("/api/v1/follows", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetNickname }),
        });
        if (!res.ok) throw new Error();
        toast({ tone: "success", title: `${targetNickname} 님을 팔로우했습니다.` });
      }
    } catch {
      setIsFollowing(prev);
      toast({ tone: "danger", title: "팔로우 처리 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={cn(styles.btn, isFollowing && styles.following, className)}
      aria-pressed={isFollowing}
      disabled={loading}
      onClick={() => void handleClick()}
    >
      <Icon name={isFollowing ? "user-follow-line" : "user-add-line"} />
      {isFollowing ? "팔로잉" : "팔로우"}
    </button>
  );
}

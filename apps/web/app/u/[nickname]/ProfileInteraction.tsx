"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGating } from "@/hooks/useGating";
import { FollowButton } from "@/components/ui/FollowButton/FollowButton";
import { MemberReportModal } from "@/features/report/MemberReportModal";
import styles from "./profile.module.css";

interface ProfileInteractionProps {
  profileId: string;
  targetNickname: string;
  followers: number;
  following: number;
  initialFollowing?: boolean;
  isBlocked?: boolean;
}

export function ProfileInteraction({
  profileId,
  targetNickname,
  followers,
  following,
  initialFollowing = false,
  isBlocked = false,
}: ProfileInteractionProps) {
  const { user } = useAuth();
  const { requireAuth } = useGating();
  const isSelf = !!user && user.id === profileId;
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className={styles.interactionArea}>
      <div className={styles.followStats}>
        <span className={styles.followStatItem}>
          <strong className={styles.followCount}>{followers.toLocaleString()}</strong>
          <span className={styles.followLabel}>팔로워</span>
        </span>
        <span className={styles.followDivider} aria-hidden="true">·</span>
        <span className={styles.followStatItem}>
          <strong className={styles.followCount}>{following.toLocaleString()}</strong>
          <span className={styles.followLabel}>팔로잉</span>
        </span>
      </div>

      {isSelf ? (
        <Link href="/settings/profile" className={styles.editBtn}>
          프로필 편집
        </Link>
      ) : (
        <>
          <FollowButton
            targetNickname={targetNickname}
            initialFollowing={initialFollowing}
            isBlocked={isBlocked}
            className={styles.followBtn}
          />
          <button
            type="button"
            className={styles.reportBtn}
            onClick={() => {
              if (!requireAuth("report")) return;
              setReportOpen(true);
            }}
          >
            신고하기
          </button>
          <MemberReportModal
            isOpen={reportOpen}
            onClose={() => setReportOpen(false)}
            targetUserId={profileId}
            targetNickname={targetNickname}
          />
        </>
      )}
    </div>
  );
}

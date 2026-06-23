"use client";

// 공개 프로필 페이지의 인터랙션 영역 (클라이언트 컴포넌트).
// - 팔로워/팔로잉 카운트 표시
// - 본인 프로필이면 [프로필 편집] 버튼 → /settings/profile
// - 타인 프로필이면 FollowButton (낙관적 토글)
// 서버 컴포넌트(page.tsx)에서 static 데이터를 받아 렌더한다.

import Link from "next/link";
import { useMockAuth } from "@/hooks/useMockAuth";
import { FollowButton, Icon } from "@/components/ui";
import styles from "./profile.module.css";

interface ProfileInteractionProps {
  targetNickname: string;
  followers: number;
  following: number;
}

/**
 * 팔로워·팔로잉 카운트 + 팔로우 or 편집 버튼.
 * 로그인 사용자의 닉네임과 targetNickname 이 같으면 본인 프로필로 판단한다.
 */
export function ProfileInteraction({
  targetNickname,
  followers,
  following,
}: ProfileInteractionProps) {
  const { user } = useMockAuth();
  // isSelf: 현재 로그인 사용자와 프로필 주인이 같은지
  const isSelf = !!user && user.nickname === targetNickname;

  return (
    <div className={styles.interactionArea}>
      {/* 팔로워/팔로잉 카운트 */}
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

      {/* 본인이면 프로필 편집, 타인이면 팔로우 버튼 */}
      {isSelf ? (
        <Link href="/settings/profile" className={styles.editBtn}>
          <Icon name="edit-line" />
          프로필 편집
        </Link>
      ) : (
        <FollowButton
          targetNickname={targetNickname}
          initialFollowing={false}
          className={styles.followBtn}
        />
      )}
    </div>
  );
}

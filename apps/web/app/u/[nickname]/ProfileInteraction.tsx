"use client";

// 공개 프로필 페이지의 인터랙션 영역 (클라이언트 컴포넌트).
// - 팔로워/팔로잉 카운트 표시
// - 본인 프로필이면 [프로필 편집] 버튼 → /settings/profile
// - 타인 프로필이면 팔로우 버튼 (requireAuth 게이팅, Epic 5에서 실API 연결)
// 서버 컴포넌트(page.tsx)에서 static 데이터를 받아 렌더한다.

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useGating } from "@/hooks/useGating";
import { Icon } from "@/components/ui";
import styles from "./profile.module.css";

interface ProfileInteractionProps {
  /** 프로필 주인의 DB id (자신 여부 비교용) */
  profileId: string;
  targetNickname: string;
  /** 팔로워 수 (Epic 5 Story 5.12 전까지 0) */
  followers: number;
  /** 팔로잉 수 (Epic 5 Story 5.12 전까지 0) */
  following: number;
}

/**
 * 팔로워·팔로잉 카운트 + 팔로우 or 편집 버튼.
 * - 로그인 사용자의 id 와 profileId 가 같으면 본인 프로필로 판단한다.
 * - 팔로우 버튼 실API 연동은 Epic 5 Story 5.12에서 활성화.
 */
export function ProfileInteraction({
  profileId,
  targetNickname,
  followers,
  following,
}: ProfileInteractionProps) {
  // useMockAuth → useAuth (실제 세션)
  const { user } = useAuth();
  const { requireAuth } = useGating();

  // isSelf: 현재 로그인 사용자 id와 프로필 주인 id가 같은지
  const isSelf = !!user && user.id === profileId;

  // TODO: Epic 5 Story 5.12 — 팔로우/팔로워 실데이터 연결
  function handleFollow() {
    // requireAuth 게이팅: 비로그인이면 로그인 유도 모달 열고 false 반환
    if (!requireAuth("follow")) return;
    // 실API 연동 전 안내 (Epic 5 활성화 전)
    alert(`${targetNickname} 님 팔로우 기능은 준비 중이에요.`);
  }

  return (
    <div className={styles.interactionArea}>
      {/* 팔로워/팔로잉 카운트 (Epic 5 Story 5.12 전까지 0) */}
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
        <button
          type="button"
          className={styles.followBtn}
          onClick={handleFollow}
        >
          <Icon name="user-add-line" />
          팔로우
        </button>
      )}
    </div>
  );
}

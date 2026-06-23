"use client";

// 팔로우/언팔로우 토글 버튼.
// - 낙관적 UI: 클릭 즉시 상태를 뒤집은 뒤 목업 확인(alert)만 한다.
// - aria-pressed: 팔로잉 상태일 때 true, 아닐 때 false (접근성 토글 패턴).
// - 비회원이 누르면 로그인 유도 alert.
// - /u/[nickname] 공개 프로필 페이지와 마이페이지 팔로잉/팔로워 탭 양쪽에서 재사용한다.

import { useState } from "react";
import { useMockAuth } from "@/hooks/useMockAuth";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import styles from "./FollowButton.module.css";

export interface FollowButtonProps {
  /** 팔로우 대상 닉네임 (표시 및 식별용) */
  targetNickname: string;
  /** 초기 팔로잉 상태 */
  initialFollowing?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 팔로우/언팔로우 버튼.
 * 로그인 상태를 useMockAuth 로 확인하고, 비회원이면 로그인 유도 alert 을 띄운다.
 */
export function FollowButton({
  targetNickname,
  initialFollowing = false,
  className,
}: FollowButtonProps) {
  // isFollowing: 현재 팔로잉 여부 (낙관적 로컬 상태)
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const { user } = useMockAuth();

  function handleClick() {
    // 비회원이면 로그인 유도
    if (!user) {
      alert("팔로우하려면 로그인이 필요합니다.");
      return;
    }
    // 낙관적 토글: 즉시 상태 반전
    const next = !isFollowing;
    setIsFollowing(next);
    // 목업 단계: 실제 API 연동 전 확인 메시지
    if (next) {
      alert(`${targetNickname} 님을 팔로우했습니다.`);
    } else {
      alert(`${targetNickname} 님 팔로우를 취소했습니다.`);
    }
  }

  return (
    <button
      type="button"
      className={cn(styles.btn, isFollowing && styles.following, className)}
      aria-pressed={isFollowing}
      onClick={handleClick}
    >
      <Icon name={isFollowing ? "user-follow-line" : "user-add-line"} />
      {isFollowing ? "팔로잉" : "팔로우"}
    </button>
  );
}

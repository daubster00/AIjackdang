"use client";

/**
 * 게시글 작성 버튼 — Story 2.3
 *
 * 비회원 클릭 시 로그인 유도 모달 표시.
 * 로그인 상태 여부는 localStorage 의 mockAuth 키를 확인한다(임시 — Epic 5 에서 실 세션으로 교체 예정).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LoginGatingModal } from "@/components/ui/LoginGatingModal";

interface WriteButtonProps {
  /** 글쓰기 페이지 경로 (예: /vibe-coding/guide/write) */
  writePath: string;
  className?: string;
}

/** localStorage key — mockAuth (Story 1.x 임시 구현 일치) */
const MOCK_USER_KEY = "aijakdang.mockUser";

function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem(MOCK_USER_KEY));
  } catch {
    return false;
  }
}

export function WriteButton({ writePath, className }: WriteButtonProps) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    if (isLoggedIn()) {
      router.push(writePath);
    } else {
      setShowLoginModal(true);
    }
  };

  return (
    <>
      <Button
        className={className}
        onClick={handleClick}
        leftIcon={
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        }
      >
        글쓰기
      </Button>

      <LoginGatingModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        intendedAction="write"
      />
    </>
  );
}

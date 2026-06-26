"use client";

// 비회원 게이팅 래퍼.
// Story 2.12: useMockAuth → useAuth(실 인증) 교체.
// 회원 → RecruitForm 렌더, 비회원 → 로그인 유도 UI.
// hydration 불일치를 피하기 위해 ready 상태 확인 후 렌더.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { RecruitForm } from "./RecruitForm";
import styles from "../gigs.module.css";

export function GigWriteGate() {
  const { user, ready } = useAuth();
  const pathname = usePathname();

  // hydration 전: 아무것도 렌더하지 않음 (깜빡임 방지)
  if (!ready) return null;

  // 비회원: 로그인 유도 UI (행동 게이팅 — project-context §UX)
  if (!user) {
    return (
      <div className={styles.writeContainer}>
        <EmptyState
          icon="lock-line"
          title="로그인 후 이용해 주세요"
          description="의뢰·구직 글을 작성하려면 로그인이 필요합니다."
          actions={
            <>
              <Link href={`/login?redirectTo=${encodeURIComponent(pathname)}`}>
                <Button variant="primary">로그인하기</Button>
              </Link>
              <Link href="/lounge/gigs">
                <Button variant="ghost">목록으로</Button>
              </Link>
            </>
          }
        />
      </div>
    );
  }

  // 회원: 폼 렌더
  return (
    <div className={styles.writeContainer}>
      <RecruitForm />
    </div>
  );
}

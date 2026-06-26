"use client";

/**
 * ResourceWriteGate — 비회원 게이팅 래퍼 (Story 4.4, AC #1)
 *
 * - useAuth(실 인증)로 로그인 여부를 확인한다.
 * - 비회원: EmptyState + 로그인 버튼으로 안내.
 * - 회원: ResourceWriteForm 렌더.
 * - hydration 불일치 방지: ready 상태 확인 후 렌더.
 * - fixedResourceType: 게시판별 write 경로에서 유형을 고정 전달.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { ResourceWriteForm, type ResourceTypeValue } from "./ResourceWriteForm";

interface ResourceWriteGateProps {
  /** 게시판별 고정 유형 — 제공 시 유형 선택 UI를 숨기고 이 값으로 등록 */
  fixedResourceType?: ResourceTypeValue;
}

export function ResourceWriteGate({ fixedResourceType }: ResourceWriteGateProps = {}) {
  const { user, ready } = useAuth();
  const pathname = usePathname();

  // hydration 전: 아무것도 렌더하지 않음 (깜빡임 방지)
  if (!ready) return null;

  // 비회원: 로그인 유도 UI
  if (!user) {
    return (
      <EmptyState
        icon="lock-line"
        title="로그인 후 이용해 주세요"
        description="자료를 등록하려면 로그인이 필요합니다."
        actions={
          <>
            <Link href={`/login?redirectTo=${encodeURIComponent(pathname)}`}>
              <Button variant="primary">로그인하기</Button>
            </Link>
            <Link href="/resources/prompts">
              <Button variant="ghost">자료실 보기</Button>
            </Link>
          </>
        }
      />
    );
  }

  // 회원: 등록 폼 렌더 (fixedResourceType이 있으면 유형 선택 UI 숨김)
  return <ResourceWriteForm fixedResourceType={fixedResourceType} />;
}

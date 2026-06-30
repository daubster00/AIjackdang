/**
 * /notifications 페이지 — Story 7.2
 *
 * - noindex: 로그인 전용 페이지 → 검색엔진 색인 금지
 * - 서버 컴포넌트: 인증 쿠키 확인 → 미인증 시 login 리다이렉트
 * - 인증 확인 후 NotificationsPage 클라이언트 컴포넌트 렌더
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NotificationsPage } from "@/features/notification/NotificationsPage";

export const metadata: Metadata = {
  title: "알림 | AI작당",
  robots: { index: false, follow: true },
};

// 인증 전용(쿠키 기반 게이팅) 페이지 — 정적 프리렌더 금지.
// 알림 모달 서브트리가 useSearchParams(Pagination)를 포함하므로 CSR bailout 방지.
export const dynamic = "force-dynamic";

export default async function Page() {
  // 세션 쿠키 존재 여부로 빠른 미인증 게이팅
  // (실제 세션 유효성은 API 서버가 검증)
  const cookieStore = await cookies();
  const hasSession =
    cookieStore.has("aj_session.session_token") ||
    cookieStore.has("better-auth.session_token");

  if (!hasSession) {
    redirect("/login?redirectTo=/notifications");
  }

  return <NotificationsPage isLoggedIn />;
}

/**
 * /messages/[userId] 페이지 — Story 7.4
 *
 * 특정 상대와의 대화 스레드.
 * - 서버 컴포넌트: 인증 쿠키 확인 → 미인증 시 login 리다이렉트
 * - ThreadView 클라이언트 컴포넌트 렌더
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ThreadView } from "@/features/messages/ThreadView";

export const metadata: Metadata = {
  title: "쪽지 대화 | AI작당",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function Page({ params }: Props) {
  const { userId } = await params;

  // 세션 쿠키 존재 여부로 빠른 미인증 게이팅
  const cookieStore = await cookies();
  const hasSession =
    cookieStore.has("aj_session.session_token") ||
    cookieStore.has("better-auth.session_token");

  if (!hasSession) {
    redirect(`/login?redirectTo=/messages/${userId}`);
  }

  return <ThreadView partnerId={userId} />;
}

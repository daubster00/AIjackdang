/**
 * /inquiries 문의 목록 페이지 — Story 7.5
 *
 * 서버 컴포넌트:
 * - 미인증 → /login?redirectTo=/inquiries 리다이렉트
 * - 인증 완료 → InquiriesPage 클라이언트 컴포넌트 렌더
 *
 * ⚠️ SSR 500 방지: process.env 상수는 직접 인라인. 클라이언트 import 금지.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { InquiriesPage } from "@/features/inquiry/InquiriesPage";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

async function getServerSession(cookie?: string): Promise<{ userId: string } | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/get-session`, {
      headers: cookie ? { cookie } : {},
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: { id: string } } | null;
    if (!data?.user?.id) return null;
    return { userId: data.user.id };
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: "1:1 문의 | AI작당",
};

export const dynamic = "force-dynamic";

export default async function InquiriesListPage() {
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const session = await getServerSession(cookie);
  if (!session) {
    redirect("/login?redirectTo=/inquiries");
  }

  return <InquiriesPage />;
}

/**
 * /inquiries/[id] 문의 상세·스레드 페이지 — Story 7.5
 *
 * 서버 컴포넌트:
 * - 미인증 → /login?redirectTo=/inquiries/{id} 리다이렉트
 * - 인증 완료 → InquiryThread 클라이언트 컴포넌트 렌더
 * - 404/403는 InquiryThread에서 처리 (notFound())
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { InquiryThread } from "@/features/inquiry/InquiryThread";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

interface PageProps {
  params: Promise<{ id: string }>;
}

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "문의 상세 | AI작당",
    alternates: { canonical: `/inquiries/${id}` },
  };
}

export const dynamic = "force-dynamic";

export default async function InquiryDetailPage({ params }: PageProps) {
  const { id } = await params;

  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const session = await getServerSession(cookie);
  if (!session) {
    redirect(`/login?redirectTo=/inquiries/${id}`);
  }

  return <InquiryThread inquiryId={id} />;
}

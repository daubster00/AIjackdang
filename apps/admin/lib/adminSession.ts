import { cache } from "react";
import { cookies } from "next/headers";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

export interface AdminSessionUser {
  id: string;
  name: string;
  email: string;
  role: "staff" | "super_admin";
  status: string;
}

/**
 * 서버 컴포넌트에서 현재 로그인한 관리자 세션 정보를 조회한다.
 * aj_admin_session 쿠키를 직접 전달해 API 서버에서 세션을 검증한다.
 * React cache()로 동일 요청 내 중복 호출을 방지한다.
 */
export const getAdminSession = cache(async (): Promise<AdminSessionUser | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("aj_admin_session");
  if (!sessionCookie) return null;

  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/auth/session`, {
      headers: { Cookie: `aj_admin_session=${sessionCookie.value}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.user as AdminSessionUser) ?? null;
  } catch {
    return null;
  }
});

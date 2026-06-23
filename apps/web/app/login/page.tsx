import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "로그인",
  description: "AI작당 계정으로 로그인하고 실전 자료, 질문 답변, 작당 라운지 활동을 이어가세요.",
};

/**
 * 로그인 페이지 (AC #7).
 *
 * 서버 컴포넌트에서 기존 세션을 확인하고,
 * 이미 로그인된 경우 홈(/)으로 리다이렉트한다.
 *
 * 세션 확인: API 서버의 GET /api/v1/auth/get-session 에 쿠키 포워딩 (project-context §보안).
 */
export default async function LoginPage() {
  // 서버 컴포넌트에서 쿠키를 포워딩해 세션 확인 (AC #7)
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  if (cookieHeader) {
    try {
      const apiBase = process.env.API_INTERNAL_URL ?? "http://localhost:4003";
      const res = await fetch(`${apiBase}/api/v1/auth/get-session`, {
        headers: { Cookie: cookieHeader },
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { user?: { id?: string } } | null;
        if (data?.user?.id) {
          redirect("/");
        }
      }
    } catch {
      // API 미응답 시 로그인 페이지 렌더 (폴백)
    }
  }

  return (
    <main id="main" className={styles.page}>
      <section className={styles.authSection} aria-labelledby="login-title">
        <LoginForm />
      </section>
    </main>
  );
}

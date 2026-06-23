import type { Metadata } from "next";
import Link from "next/link";
import styles from "../signup.module.css";

export const metadata: Metadata = {
  title: "이메일 인증 완료",
  description: "AI작당 이메일 인증이 완료됐습니다.",
};

/**
 * 이메일 인증 완료 페이지 (Story 1.3, AC #5).
 *
 * Better Auth의 /api/v1/auth/verify-email?token= 엔드포인트는
 * 기본적으로 callbackURL 로 리다이렉트한다.
 * 가입 시 callbackURL="/signup/verified" 를 넘기면 이 페이지로 온다.
 */
export default function SignupVerifiedPage() {
  return (
    <main id="main" className={styles.page}>
      <section className={styles.authSection} aria-labelledby="verified-title">
        <div className={styles.formPanel}>
          <div className={styles.formHead}>
            <p className={styles.eyebrow}>Verified</p>
            <h1 id="verified-title">이메일 인증이 완료됐습니다</h1>
            <p>
              이제 로그인하여 AI작당 활동을 시작할 수 있습니다.
            </p>
          </div>

          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              minHeight: "48px",
              borderRadius: "var(--radius-md)",
              background: "var(--color-primary)",
              color: "#ffffff",
              fontSize: "var(--font-size-base)",
              fontWeight: "var(--font-weight-semibold)",
              textDecoration: "none",
              marginTop: "var(--space-4)",
            }}
          >
            로그인하기
          </Link>

          <p className={styles.loginText}>
            <Link href="/">홈으로 돌아가기</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

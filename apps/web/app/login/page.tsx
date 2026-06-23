import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "로그인",
  description: "AI작당 계정으로 로그인하고 실전 자료, 질문 답변, 작당 라운지 활동을 이어가세요.",
};

export default function LoginPage() {
  return (
    <main id="main" className={styles.page}>
      <section className={styles.authSection} aria-labelledby="login-title">
        <LoginForm />
      </section>
    </main>
  );
}

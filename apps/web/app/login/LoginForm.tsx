"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Checkbox, Icon, Input } from "@/components/ui";
import { useMockAuth } from "@/hooks/useMockAuth";
import { createMockUserFromEmail } from "@/lib/mockAuth";
import styles from "./login.module.css";

export function LoginForm() {
  const router = useRouter();
  const { login } = useMockAuth();

  // 데모(목업): 입력한 이메일로 가짜 로그인 처리 후 홈으로 이동한다.
  // 홈으로 돌아가면 상단 헤더가 로그인된 화면(아바타·등급·프로필 메뉴)으로 바뀐다.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    login(createMockUserFromEmail(email));
    router.push("/");
  }

  return (
    <div className={styles.formPanel}>
      <div className={styles.formHead}>
        <p className={styles.eyebrow}>Login</p>
        <h1 id="login-title">로그인</h1>
        <p>가입한 이메일로 AI작당을 계속 이용하세요.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          label="이메일"
          type="email"
          name="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          leftIcon={<Icon name="mail-line" />}
        />
        <Input
          label="비밀번호"
          type="password"
          name="password"
          placeholder="비밀번호 입력"
          autoComplete="current-password"
          required
          leftIcon={<Icon name="lock-line" />}
        />

        <div className={styles.formOptions}>
          <Checkbox name="remember">로그인 유지</Checkbox>
          <Link href="/forgot-password">비밀번호 찾기</Link>
        </div>

        <Button type="submit" size="lg" fullWidth rightIcon={<Icon name="arrow-right-line" />}>
          로그인
        </Button>
      </form>

      <div className={styles.divider}>
        <span>또는</span>
      </div>

      <div className={styles.socialGrid}>
        <button type="button" className={`${styles.socialButton} ${styles.kakaoButton}`}>
          <span className={styles.socialLogo} aria-hidden="true">
            <KakaoMark />
          </span>
          카카오로 로그인
        </button>
        <button type="button" className={`${styles.socialButton} ${styles.naverButton}`}>
          <span className={styles.socialLogo} aria-hidden="true">
            N
          </span>
          네이버로 로그인
        </button>
        <button type="button" className={`${styles.socialButton} ${styles.googleButton}`}>
          <span className={styles.socialLogo} aria-hidden="true">
            <svg className={styles.googleMark} viewBox="0 0 24 24" focusable="false">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.52Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.98-.9 6.64-2.44l-3.24-2.51c-.9.6-2.05.95-3.4.95-2.61 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.39 13.87A6.02 6.02 0 0 1 6.07 12c0-.65.12-1.28.32-1.87V7.54H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.46l3.35-2.59Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.98c1.47 0 2.79.51 3.82 1.5l2.88-2.88C16.97 2.99 14.7 2 12 2a10 10 0 0 0-8.96 5.54l3.35 2.59C7.18 7.75 9.39 5.98 12 5.98Z"
              />
            </svg>
          </span>
          Google로 로그인
        </button>
      </div>

      <p className={styles.signupText}>
        아직 계정이 없나요? <Link href="/signup">회원가입</Link>
      </p>
    </div>
  );
}

function KakaoMark() {
  return (
    <svg className={styles.kakaoMark} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.0009 3C17.7999 3 22.501 6.66445 22.501 11.1847C22.501 15.705 17.7999 19.3694 12.0009 19.3694C11.4127 19.3694 10.8361 19.331 10.2742 19.2586L5.86611 22.1419C5.36471 22.4073 5.18769 22.3778 5.39411 21.7289L6.28571 18.0513C3.40572 16.5919 1.50098 14.0619 1.50098 11.1847C1.50098 6.66445 6.20194 3 12.0009 3ZM17.908 11.0591L19.3783 9.63617C19.5656 9.45485 19.5705 9.15617 19.3893 8.96882C19.2081 8.78172 18.9094 8.77668 18.7219 8.95788L16.7937 10.8239V9.28226C16.7937 9.02172 16.5825 8.81038 16.3218 8.81038C16.0613 8.81038 15.8499 9.02172 15.8499 9.28226V11.8393C15.8321 11.9123 15.8325 11.9879 15.8499 12.0611V13.5C15.8499 13.7606 16.0613 13.9719 16.3218 13.9719C16.5825 13.9719 16.7937 13.7606 16.7937 13.5V12.1373L17.2213 11.7236L18.6491 13.7565C18.741 13.8873 18.8873 13.9573 19.0357 13.9573C19.1295 13.9573 19.2241 13.9293 19.3066 13.8714C19.5199 13.7217 19.5713 13.4273 19.4215 13.214L17.908 11.0591ZM14.9503 12.9839H13.4904V9.29702C13.4904 9.03648 13.2791 8.82514 13.0184 8.82514C12.7579 8.82514 12.5467 9.03648 12.5467 9.29702V13.4557C12.5467 13.7164 12.7579 13.9276 13.0184 13.9276H14.9503C15.211 13.9276 15.4222 13.7164 15.4222 13.4557C15.4222 13.1952 15.211 12.9839 14.9503 12.9839ZM9.09318 11.8925L9.78919 10.1849L10.4265 11.8925H9.09318ZM11.6159 12.3802C11.6161 12.3748 11.6175 12.3699 11.6175 12.3645C11.6175 12.2405 11.5687 12.1287 11.4906 12.0445L10.4452 9.24376C10.3468 8.9639 10.1005 8.77815 9.81761 8.77028C9.53948 8.76277 9.28066 8.93672 9.16453 9.21669L7.50348 13.2924C7.40519 13.5337 7.52107 13.8092 7.76242 13.9076C8.00378 14.006 8.2792 13.89 8.37749 13.6486L8.70852 12.8364H10.7787L11.077 13.6356C11.1479 13.8254 11.3278 13.9426 11.5193 13.9425C11.5741 13.9425 11.6298 13.9329 11.6842 13.9126C11.9284 13.8216 12.0524 13.5497 11.9612 13.3054L11.6159 12.3802ZM8.29446 9.30194C8.29446 9.0414 8.08312 8.83006 7.82258 8.83006H4.57822C4.31755 8.83006 4.10622 9.0414 4.10622 9.30194C4.10622 9.56249 4.31755 9.77382 4.57822 9.77382H5.73824V13.5099C5.73824 13.7705 5.94957 13.9817 6.21012 13.9817C6.47078 13.9817 6.68212 13.7705 6.68212 13.5099V9.77382H7.82258C8.08312 9.77382 8.29446 9.56249 8.29446 9.30194Z" />
    </svg>
  );
}

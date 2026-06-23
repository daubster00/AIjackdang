"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./login.module.css";

/**
 * 관리자 로그인 페이지 (디자인).
 *
 * 공통 관리자 디자인 시스템(@ai-jakdang/admin-design-system)의 토큰·컴포넌트
 * 클래스(.field-label, .input-icon, .control, .btn, .btn-primary)를 사용한다.
 *
 * 실제 인증 연동(Better Auth + 관리자 권한 검사 + 강화된 요청 제한)은
 * 인증 구현 단계에서 onSubmit 에 연결한다. 현재는 화면 디자인만 제공한다.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className={styles.wrap}>
      <section className={`card ${styles.card}`}>
        <div className={styles.body}>
          <div className={styles.brand}>
            <span className={styles.logo} aria-hidden="true">
              <i className="ri-shield-keyhole-line" />
            </span>
            <h1 className={styles.title}>AI작당 관리자</h1>
            <p className={styles.sub}>운영 관리자 전용 콘솔에 로그인합니다</p>
          </div>

          <form
            className={styles.form}
            onSubmit={(e) => {
              // 목업 동작: 실제 인증 없이 대시보드로 이동한다.
              // 인증 단계에서 이메일/비밀번호 검증 + 권한 확인 후 이동하도록 교체한다.
              e.preventDefault();
              router.push("/dashboard");
            }}
          >
            <div className="field">
              <label className="field-label" htmlFor="admin-email">
                이메일
              </label>
              <div className="input-icon">
                <i className="ri-mail-line" />
                <input
                  id="admin-email"
                  className="control"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="admin@ai-jakdang.com"
                  required
                />
              </div>
            </div>

            <div className={`field ${styles.passwordInput}`}>
              <label className="field-label" htmlFor="admin-password">
                비밀번호
              </label>
              <div className="input-icon">
                <i className="ri-lock-2-line" />
                <input
                  id="admin-password"
                  className="control"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="비밀번호 입력"
                  required
                />
                <button
                  type="button"
                  className={styles.toggle}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                  aria-pressed={showPassword}
                >
                  <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"} />
                </button>
              </div>
            </div>

            <div className={styles.options}>
              <label className={styles.remember}>
                <input className="check" type="checkbox" />
                로그인 유지
              </label>
              <a className={styles.helpLink} href="#">
                도움이 필요하신가요?
              </a>
            </div>

            <button className={`btn btn-primary btn-lg ${styles.submit}`} type="submit">
              <i className="ri-login-box-line" />
              로그인
            </button>
          </form>

          <p className={styles.foot}>
            아직 운영자 계정이 없으신가요?{" "}
            <Link className={styles.footLink} href="/signup">
              회원가입
            </Link>
          </p>
        </div>

        <p className={styles.notice}>
          <i className="ri-information-line" aria-hidden="true" />
          승인된 운영자만 접근할 수 있으며, 모든 접속 기록이 남습니다.
        </p>
      </section>
    </main>
  );
}

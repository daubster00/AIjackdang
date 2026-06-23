"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./signup.module.css";

/**
 * 관리자 회원가입 페이지 (디자인).
 *
 * 공통 관리자 디자인 시스템(@ai-jakdang/admin-design-system)의 토큰·컴포넌트
 * 클래스(.field-label, .input-icon, .control, .field-help, .btn, .btn-primary)를 사용한다.
 *
 * 일반 사용자 가입과 달리 관리자 가입은 누구나 할 수 없다.
 * 초대 코드(운영팀이 발급한 가입 허가 코드) 없이는 가입을 막는다.
 * 실제 가입 연동(Better Auth + 초대 코드 검증 + 권한 부여)은 인증 구현 단계에서 추가한다.
 */
export default function AdminSignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className={styles.wrap}>
      <section className={`card ${styles.card}`}>
        <div className={styles.body}>
          <div className={styles.brand}>
            <span className={styles.logo} aria-hidden="true">
              <i className="ri-user-add-line" />
            </span>
            <h1 className={styles.title}>AI작당 관리자 가입</h1>
            <p className={styles.sub}>운영팀에서 발급한 초대 코드가 필요합니다</p>
          </div>

          <form
            className={styles.form}
            onSubmit={(e) => {
              // 목업 동작: 실제 가입 처리 없이 대시보드로 이동한다.
              // 인증 단계에서 초대 코드 검증 + 계정 생성 후 이동하도록 교체한다.
              e.preventDefault();
              router.push("/dashboard");
            }}
          >
            <div className="field">
              <label className="field-label" htmlFor="admin-name">
                이름
              </label>
              <div className="input-icon">
                <i className="ri-user-line" />
                <input
                  id="admin-name"
                  className="control"
                  type="text"
                  autoComplete="name"
                  placeholder="운영자 이름"
                  required
                />
              </div>
            </div>

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
                  autoComplete="new-password"
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
              <p className="field-help">영문·숫자·특수문자 포함 10자 이상</p>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="admin-password-confirm">
                비밀번호 확인
              </label>
              <div className="input-icon">
                <i className="ri-lock-2-line" />
                <input
                  id="admin-password-confirm"
                  className="control"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="비밀번호 다시 입력"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="admin-invite-code">
                초대 코드
              </label>
              <div className="input-icon">
                <i className="ri-key-2-line" />
                <input
                  id="admin-invite-code"
                  className="control"
                  type="text"
                  autoComplete="off"
                  placeholder="운영팀에서 받은 코드"
                  required
                />
              </div>
              <p className="field-help">초대 코드가 없으면 가입할 수 없습니다.</p>
            </div>

            <button className={`btn btn-primary btn-lg ${styles.submit}`} type="submit">
              <i className="ri-user-add-line" />
              가입 신청
            </button>
          </form>

          <p className={styles.foot}>
            이미 계정이 있나요?{" "}
            <Link className={styles.footLink} href="/login">
              로그인
            </Link>
          </p>
        </div>

        <p className={styles.notice}>
          <i className="ri-information-line" aria-hidden="true" />
          가입 신청은 운영팀 승인 후 활성화되며, 모든 신청 기록이 남습니다.
        </p>
      </section>
    </main>
  );
}

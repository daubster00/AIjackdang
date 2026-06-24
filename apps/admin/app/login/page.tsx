"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { API_BASE_URL } from "../../lib/api";
import styles from "./login.module.css";

/**
 * 관리자 로그인 페이지 (Story 9.2 — Better Auth 연동).
 *
 * - active 계정: 로그인 성공 → /dashboard 리다이렉트
 * - pending/suspended/disabled: 상태별 인라인 오류 메시지
 * - 틀린 자격증명: "이메일 또는 비밀번호가 올바르지 않습니다."
 * - rate limit 초과: 429 안내
 * - 폼 검증: blur 시 개별 필드, submit 시 전체
 */
export default function AdminLoginPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 필드 오류 (blur 검증용)
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  // API 응답 오류 (submit 후 서버 반환 메시지)
  const [formError, setFormError] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // ── 클라이언트 필드 검증 ─────────────────────────────────────────────────────

  function validateEmail(value: string): string {
    if (!value.trim()) return "이메일을 입력해주세요.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "올바른 이메일 형식이 아닙니다.";
    return "";
  }

  function validatePassword(value: string): string {
    if (!value) return "비밀번호를 입력해주세요.";
    return "";
  }

  function handleEmailBlur() {
    setEmailError(validateEmail(emailRef.current?.value ?? ""));
  }

  function handlePasswordBlur() {
    setPasswordError(validatePassword(passwordRef.current?.value ?? ""));
  }

  // ── 제출 ──────────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");

    const email = emailRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";

    // submit 시 전체 검증
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/auth/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json() as {
        adminUser?: { id: string; name: string; email: string; role: string; status: string };
        error?: { code: string; message: string };
      };

      if (res.ok) {
        router.push("/dashboard");
        return;
      }

      // 오류 처리
      const code = data.error?.code ?? "UNKNOWN";
      const message = data.error?.message ?? "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

      if (res.status === 429) {
        setFormError("로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.");
      } else if (
        code === "PENDING_APPROVAL" ||
        code === "ACCOUNT_SUSPENDED" ||
        code === "ACCOUNT_DISABLED" ||
        code === "INVALID_CREDENTIALS"
      ) {
        setFormError(message);
      } else {
        setFormError(message);
      }
    } catch {
      setFormError("서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

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

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {/* 이메일 */}
            <div className="field">
              <label className="field-label" htmlFor="admin-email">
                이메일
              </label>
              <div className="input-icon">
                <i className="ri-mail-line" />
                <input
                  ref={emailRef}
                  id="admin-email"
                  className={`control${emailError ? " control--error" : ""}`}
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="admin@ai-jakdang.com"
                  disabled={loading}
                  onBlur={handleEmailBlur}
                  aria-describedby={emailError ? "email-error" : undefined}
                  aria-invalid={!!emailError}
                />
              </div>
              {emailError && (
                <p id="email-error" className={styles.fieldError} role="alert">
                  <i className="ri-error-warning-line" aria-hidden="true" />
                  {emailError}
                </p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className={`field ${styles.passwordInput}`}>
              <label className="field-label" htmlFor="admin-password">
                비밀번호
              </label>
              <div className="input-icon">
                <i className="ri-lock-2-line" />
                <input
                  ref={passwordRef}
                  id="admin-password"
                  className={`control${passwordError ? " control--error" : ""}`}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="비밀번호 입력"
                  disabled={loading}
                  onBlur={handlePasswordBlur}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  aria-invalid={!!passwordError}
                />
                <button
                  type="button"
                  className={styles.toggle}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                  aria-pressed={showPassword}
                  disabled={loading}
                >
                  <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"} />
                </button>
              </div>
              {passwordError && (
                <p id="password-error" className={styles.fieldError} role="alert">
                  <i className="ri-error-warning-line" aria-hidden="true" />
                  {passwordError}
                </p>
              )}
            </div>

            {/* 로그인 옵션 */}
            <div className={styles.options}>
              <label className={styles.remember}>
                <input className="check" type="checkbox" />
                로그인 유지
              </label>
              <a className={styles.helpLink} href="#">
                도움이 필요하신가요?
              </a>
            </div>

            {/* API 응답 오류 메시지 */}
            {formError && (
              <div className={styles.formError} role="alert" aria-live="assertive">
                <i className="ri-error-warning-line" aria-hidden="true" />
                {formError}
              </div>
            )}

            <button
              className={`btn btn-primary btn-lg ${styles.submit}`}
              type="submit"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line" style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true" />
                  로그인 중…
                </>
              ) : (
                <>
                  <i className="ri-login-box-line" />
                  로그인
                </>
              )}
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

"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { API_BASE_URL } from "../../lib/api";
import styles from "./signup.module.css";

/**
 * 관리자 회원가입 페이지 (Story 9.2 — AC#4, #5, #7).
 *
 * - 초대코드 없음. 이름·이메일·비밀번호·연락처 입력.
 * - 제출 성공: status=pending 생성 → "승인 대기" 안내 화면 전환.
 * - 중복 이메일: 409 → 인라인 오류 "이미 사용 중인 이메일입니다."
 * - 비밀번호 min 8자 클라이언트·서버 양측 검증.
 * - blur 시 개별 필드 검증, submit 시 전체 검증.
 */
export default function AdminSignupPage() {

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false); // 가입 성공 → 승인 대기 화면

  // 필드 오류
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordConfirmError, setPasswordConfirmError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  // API 응답 오류
  const [formError, setFormError] = useState("");

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // ── 클라이언트 필드 검증 ─────────────────────────────────────────────────────

  function validateName(v: string) {
    if (!v.trim()) return "이름을 입력해주세요.";
    if (v.trim().length > 50) return "이름은 50자 이하여야 합니다.";
    return "";
  }

  function validateEmail(v: string) {
    if (!v.trim()) return "이메일을 입력해주세요.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "올바른 이메일 형식이 아닙니다.";
    return "";
  }

  function validatePassword(v: string) {
    if (!v) return "비밀번호를 입력해주세요.";
    if (v.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
    if (v.length > 128) return "비밀번호는 128자 이하여야 합니다.";
    return "";
  }

  function validatePasswordConfirm(v: string) {
    if (!v) return "비밀번호를 한 번 더 입력해주세요.";
    if (v !== (passwordRef.current?.value ?? "")) return "비밀번호가 일치하지 않습니다.";
    return "";
  }

  function validatePhone(v: string) {
    if (!v.trim()) return "연락처를 입력해주세요.";
    if (v.trim().length > 20) return "연락처는 20자 이하여야 합니다.";
    return "";
  }

  function handleNameBlur() { setNameError(validateName(nameRef.current?.value ?? "")); }
  function handleEmailBlur() { setEmailError(validateEmail(emailRef.current?.value ?? "")); }
  function handlePasswordBlur() { setPasswordError(validatePassword(passwordRef.current?.value ?? "")); }
  function handlePasswordConfirmBlur() { setPasswordConfirmError(validatePasswordConfirm(passwordConfirmRef.current?.value ?? "")); }
  function handlePhoneBlur() { setPhoneError(validatePhone(phoneRef.current?.value ?? "")); }

  // ── 제출 ──────────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");

    const name = nameRef.current?.value ?? "";
    const email = emailRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";
    const passwordConfirm = passwordConfirmRef.current?.value ?? "";
    const phone = phoneRef.current?.value ?? "";

    // submit 시 전체 검증
    const nErr = validateName(name);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const pcErr = validatePasswordConfirm(passwordConfirm);
    const phErr = validatePhone(phone);

    setNameError(nErr);
    setEmailError(eErr);
    setPasswordError(pErr);
    setPasswordConfirmError(pcErr);
    setPhoneError(phErr);

    if (nErr || eErr || pErr || pcErr || phErr) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/auth/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim(),
        }),
      });

      const data = await res.json() as {
        status?: string;
        message?: string;
        error?: { code: string; message: string };
      };

      if (res.ok) {
        setSubmitted(true);
        return;
      }

      // 오류 처리
      const code = data.error?.code ?? "UNKNOWN";
      const message = data.error?.message ?? "가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

      if (res.status === 409 && code === "DUPLICATE_EMAIL") {
        setEmailError("이미 사용 중인 이메일입니다.");
      } else if (res.status === 429) {
        setFormError("가입 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.");
      } else {
        setFormError(message);
      }
    } catch {
      setFormError("서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  // ── 가입 성공 — 승인 대기 안내 화면 ─────────────────────────────────────────

  if (submitted) {
    return (
      <main className={styles.wrap}>
        <section className={`card ${styles.card}`}>
          <div className={styles.body}>
            <div className={styles.brand}>
              <span className={`${styles.logo} ${styles.logoPending}`} aria-hidden="true">
                <i className="ri-time-line" />
              </span>
              <h1 className={styles.title}>가입 신청 완료</h1>
              <p className={styles.sub}>최고관리자의 승인을 기다리고 있습니다</p>
            </div>

            <div className={styles.pendingBox}>
              <div className={styles.pendingIcon}>
                <i className="ri-shield-check-line" aria-hidden="true" />
              </div>
              <p className={styles.pendingTitle}>승인 대기 중</p>
              <p className={styles.pendingDesc}>
                가입 신청이 완료되었습니다.<br />
                최고관리자 승인 후 로그인이 가능합니다.<br />
                승인 여부는 등록한 이메일로 안내됩니다.
              </p>
            </div>

            <p className={styles.foot}>
              <Link className={styles.footLink} href="/login">
                로그인 페이지로 이동
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

  // ── 가입 폼 ───────────────────────────────────────────────────────────────────

  return (
    <main className={styles.wrap}>
      <section className={`card ${styles.card}`}>
        <div className={styles.body}>
          <div className={styles.brand}>
            <span className={styles.logo} aria-hidden="true">
              <i className="ri-user-add-line" />
            </span>
            <h1 className={styles.title}>AI작당 관리자 가입</h1>
            <p className={styles.sub}>가입 후 최고관리자 승인을 받으면 로그인할 수 있습니다</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {/* 이름 */}
            <div className="field">
              <label className="field-label" htmlFor="admin-name">
                이름
              </label>
              <div className="input-icon">
                <i className="ri-user-line" />
                <input
                  ref={nameRef}
                  id="admin-name"
                  className={`control${nameError ? " control--error" : ""}`}
                  type="text"
                  autoComplete="name"
                  placeholder="운영자 이름"
                  disabled={loading}
                  onBlur={handleNameBlur}
                  aria-describedby={nameError ? "name-error" : undefined}
                  aria-invalid={!!nameError}
                />
              </div>
              {nameError && (
                <p id="name-error" className={styles.fieldError} role="alert">
                  <i className="ri-error-warning-line" aria-hidden="true" />
                  {nameError}
                </p>
              )}
            </div>

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
                  autoComplete="new-password"
                  placeholder="8자 이상 입력"
                  disabled={loading}
                  onBlur={handlePasswordBlur}
                  aria-describedby={passwordError ? "password-error" : "password-help"}
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
              {passwordError ? (
                <p id="password-error" className={styles.fieldError} role="alert">
                  <i className="ri-error-warning-line" aria-hidden="true" />
                  {passwordError}
                </p>
              ) : (
                <p id="password-help" className="field-help">8자 이상 입력해주세요</p>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div className="field">
              <label className="field-label" htmlFor="admin-password-confirm">
                비밀번호 확인
              </label>
              <div className="input-icon">
                <i className="ri-lock-2-line" />
                <input
                  ref={passwordConfirmRef}
                  id="admin-password-confirm"
                  className={`control${passwordConfirmError ? " control--error" : ""}`}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="비밀번호 다시 입력"
                  disabled={loading}
                  onBlur={handlePasswordConfirmBlur}
                  aria-describedby={passwordConfirmError ? "password-confirm-error" : undefined}
                  aria-invalid={!!passwordConfirmError}
                />
              </div>
              {passwordConfirmError && (
                <p id="password-confirm-error" className={styles.fieldError} role="alert">
                  <i className="ri-error-warning-line" aria-hidden="true" />
                  {passwordConfirmError}
                </p>
              )}
            </div>

            {/* 연락처 */}
            <div className="field">
              <label className="field-label" htmlFor="admin-phone">
                연락처
              </label>
              <div className="input-icon">
                <i className="ri-phone-line" />
                <input
                  ref={phoneRef}
                  id="admin-phone"
                  className={`control${phoneError ? " control--error" : ""}`}
                  type="tel"
                  autoComplete="tel"
                  placeholder="010-0000-0000"
                  disabled={loading}
                  onBlur={handlePhoneBlur}
                  aria-describedby={phoneError ? "phone-error" : undefined}
                  aria-invalid={!!phoneError}
                />
              </div>
              {phoneError && (
                <p id="phone-error" className={styles.fieldError} role="alert">
                  <i className="ri-error-warning-line" aria-hidden="true" />
                  {phoneError}
                </p>
              )}
            </div>

            {/* API 응답 오류 */}
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
                  신청 중…
                </>
              ) : (
                <>
                  <i className="ri-user-add-line" />
                  가입 신청
                </>
              )}
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

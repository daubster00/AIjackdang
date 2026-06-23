"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Icon, Input } from "@/components/ui";
import styles from "./reset-password.module.css";

interface Props {
  /** URL ?token= 파라미터. page.tsx 에서 검증 후 전달. */
  token: string;
}

type Step = "form" | "success" | "error";

/**
 * 비밀번호 재설정 폼 (Story 1.6, AC #2, #3, #5).
 *
 * - 새 비밀번호 + 확인 필드
 * - 8자 미만 blur 시 인라인 오류 (AC #5)
 * - 불일치 인라인 오류
 * - 성공 → "비밀번호가 변경됐어요" + 로그인 링크
 * - 400 → "링크가 만료됐거나 이미 사용됐어요" + 재발송 링크
 */
export function ResetPasswordForm({ token }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  function validatePassword(value: string): string | null {
    if (value.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
    return null;
  }

  function handlePasswordBlur() {
    setPasswordError(validatePassword(newPassword));
  }

  function handleConfirmBlur() {
    if (confirmPassword && newPassword !== confirmPassword) {
      setConfirmError("비밀번호가 일치하지 않습니다.");
    } else {
      setConfirmError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    // 최종 검증
    const pwErr = validatePassword(newPassword);
    setPasswordError(pwErr);

    const cfErr = newPassword !== confirmPassword ? "비밀번호가 일치하지 않습니다." : null;
    setConfirmError(cfErr);

    if (pwErr || cfErr) return;

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
        credentials: "include",
      });

      if (res.ok) {
        setStep("success");
      } else {
        // 400 INVALID_TOKEN 또는 기타 오류
        setStep("error");
      }
    } catch {
      // 네트워크 오류
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main" className={styles.page}>
      <section className={styles.authSection} aria-labelledby="reset-password-title">
        <div className={styles.shell}>
          <div className={styles.formPanel}>
            <Link href="/login" className={styles.backLink}>
              <Icon name="arrow-left-line" />
              로그인으로 돌아가기
            </Link>
            <h1 id="reset-password-title" className={styles.pageTitle}>
              새 비밀번호 설정
            </h1>

            {step === "form" && (
              <form className={styles.form} onSubmit={handleSubmit} noValidate>
                <div className={styles.formHead}>
                  <span className={styles.statusBadge}>재설정</span>
                  <h2>새 비밀번호를 입력해 주세요</h2>
                  <p>8자 이상의 새 비밀번호를 설정해 주세요. 설정 후 기존 로그인 세션이 모두 종료됩니다.</p>
                </div>

                <Input
                  label="새 비밀번호"
                  type="password"
                  name="newPassword"
                  value={newPassword}
                  placeholder="8자 이상 입력"
                  autoComplete="new-password"
                  required
                  leftIcon={<Icon name="lock-line" />}
                  error={passwordError ?? undefined}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  onBlur={handlePasswordBlur}
                />

                <Input
                  label="새 비밀번호 확인"
                  type="password"
                  name="confirmPassword"
                  value={confirmPassword}
                  placeholder="비밀번호 재입력"
                  autoComplete="new-password"
                  required
                  leftIcon={<Icon name="lock-line" />}
                  error={confirmError ?? undefined}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    if (confirmError) setConfirmError(null);
                  }}
                  onBlur={handleConfirmBlur}
                />

                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  disabled={loading}
                  rightIcon={<Icon name="check-line" />}
                >
                  {loading ? "변경 중..." : "비밀번호 변경"}
                </Button>
              </form>
            )}

            {step === "success" && (
              <div className={styles.completePanel} role="status">
                <span className={styles.completeIcon}>
                  <Icon name="checkbox-circle-line" />
                </span>
                <div className={styles.formHead}>
                  <span className={styles.statusBadge}>완료</span>
                  <h2>비밀번호가 변경됐어요</h2>
                  <p>다시 로그인해 주세요. 기존 세션은 모두 종료되었습니다.</p>
                </div>
                <Link href="/login" className={styles.loginButton}>
                  로그인하러 가기
                  <Icon name="arrow-right-line" />
                </Link>
              </div>
            )}

            {step === "error" && (
              <div className={styles.errorPanel} role="alert">
                <span className={styles.errorIcon}>
                  <Icon name="error-warning-line" />
                </span>
                <div className={styles.formHead}>
                  <span className={styles.statusBadge}>오류</span>
                  <h2>링크가 만료됐어요</h2>
                  <p>링크가 만료됐거나 이미 사용됐어요. 비밀번호 재설정을 다시 요청해 주세요.</p>
                </div>
                <Link href="/forgot-password" className={styles.resendLink}>
                  재설정 링크 다시 받기
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

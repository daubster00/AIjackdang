"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Icon, Input } from "@/components/ui";
import styles from "./forgot-password.module.css";

/**
 * 비밀번호 찾기 폼 (Story 1.6).
 *
 * 2단계 플로우:
 * - "email"  단계: 이메일 입력 + "재설정 링크 받기" 버튼
 * - "sent"   단계: 완료 안내 화면 + 재발송 버튼
 *
 * 변경 근거: FR-1.4(이메일 재설정 링크) + ADR-0002 §휴대폰 본인인증 비도입.
 * 기존 3단계(identity→verify→complete, 휴대전화/인증번호 방식)는 FR-1.4 명세와 불일치하여 제거.
 *
 * 보안: API 성공/실패 무관하게 "sent" 단계로 전환 (계정 존재 여부 노출 금지).
 */

type Step = "email" | "sent";

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        credentials: "include",
      });
      // API 성공/실패 무관하게 "sent" 전환 (계정 존재 여부 노출 금지)
      setStep("sent");
    } catch {
      // 네트워크 오류: 그래도 "sent" 전환 (보안 원칙 유지)
      // 진짜 네트워크 단절은 fetch 자체가 throw — 동일 처리
      setStep("sent");
    } finally {
      setLoading(false);
    }
  }

  function handleResend() {
    setStep("email");
  }

  return (
    <main id="main" className={styles.page}>
      <section className={styles.authSection} aria-labelledby="forgot-password-title">
        <div className={styles.shell}>
          <div className={styles.formPanel}>
            <Link href="/login" className={styles.backLink}>
              <Icon name="arrow-left-line" />
              로그인으로 돌아가기
            </Link>
            <h1 id="forgot-password-title" className={styles.pageTitle}>
              비밀번호를 잊으셨나요?
            </h1>

            {step === "email" && (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.formHead}>
                  <span className={styles.statusBadge}>1단계</span>
                  <h2>이메일을 입력해 주세요</h2>
                  <p>가입 시 사용한 이메일로 비밀번호 재설정 링크를 보내드립니다.</p>
                </div>

                <Input
                  label="이메일"
                  type="email"
                  name="email"
                  value={email}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  leftIcon={<Icon name="mail-line" />}
                  onChange={(event) => setEmail(event.target.value)}
                />

                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  disabled={loading}
                  rightIcon={<Icon name="mail-send-line" />}
                >
                  {loading ? "전송 중..." : "재설정 링크 받기"}
                </Button>
              </form>
            )}

            {step === "sent" && (
              <div className={styles.completePanel} role="status">
                <span className={styles.completeIcon}>
                  <Icon name="mail-send-line" />
                </span>
                <div className={styles.formHead}>
                  <span className={styles.statusBadge}>완료</span>
                  <h2>재설정 안내를 보냈어요</h2>
                  <p>
                    입력하신 이메일로 재설정 안내를 보냈어요. 메일함을 확인해 주세요.
                  </p>
                </div>
                <button type="button" className={styles.textButton} onClick={handleResend}>
                  메일을 받지 못하셨나요? 다시 보내기
                </button>
                <Link href="/login" className={styles.loginButton}>
                  로그인하러 가기
                  <Icon name="arrow-right-line" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

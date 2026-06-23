"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Icon, Input } from "@/components/ui";
import styles from "./forgot-password.module.css";

type Step = "identity" | "verify" | "complete";

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("identity");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  const maskedEmail = maskEmail(email);

  function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep("verify");
  }

  function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep("complete");
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

            {step === "identity" && (
              <form className={styles.form} onSubmit={requestCode}>
                <div className={styles.formHead}>
                  <span className={styles.statusBadge}>1단계</span>
                  <h2>계정 정보를 입력해 주세요</h2>
                  <p>가입 시 사용한 이메일과 휴대전화 번호가 일치해야 인증번호를 받을 수 있습니다.</p>
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
                <Input
                  label="휴대전화 번호"
                  type="tel"
                  name="phone"
                  value={phone}
                  placeholder="010-0000-0000"
                  autoComplete="tel"
                  required
                  leftIcon={<Icon name="smartphone-line" />}
                  helpText="인증번호는 입력한 휴대전화 번호로 문자 발송됩니다."
                  onChange={(event) => setPhone(event.target.value)}
                />

                <Button type="submit" size="lg" fullWidth rightIcon={<Icon name="message-3-line" />}>
                  인증번호 문자로 받기
                </Button>
              </form>
            )}

            {step === "verify" && (
              <form className={styles.form} onSubmit={verifyCode}>
                <div className={styles.formHead}>
                  <span className={styles.statusBadge}>2단계</span>
                  <h2>문자로 받은 인증번호를 입력해 주세요</h2>
                  <p>{phone || "입력한 휴대전화 번호"}로 전송된 6자리 인증번호를 확인해 주세요.</p>
                </div>

                <Input
                  label="인증번호"
                  type="text"
                  name="verificationCode"
                  value={code}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  leftIcon={<Icon name="shield-check-line" />}
                  helpText="인증번호가 오지 않았다면 휴대전화 번호를 다시 확인해 주세요."
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                />

                <div className={styles.actionGrid}>
                  <Button type="button" variant="secondary" size="lg" onClick={() => setStep("identity")}>
                    정보 수정
                  </Button>
                  <Button type="submit" size="lg" rightIcon={<Icon name="check-line" />}>
                    인증 확인
                  </Button>
                </div>

                <button type="button" className={styles.textButton}>
                  인증번호 다시 받기
                </button>
              </form>
            )}

            {step === "complete" && (
              <div className={styles.completePanel} role="status">
                <span className={styles.completeIcon}>
                  <Icon name="mail-send-line" />
                </span>
                <div className={styles.formHead}>
                  <span className={styles.statusBadge}>완료</span>
                  <h2>새로운 비밀번호를 이메일로 보냈습니다</h2>
                  <p>
                    {maskedEmail} 메일함에서 임시 비밀번호를 확인한 뒤 로그인해 주세요. 로그인 후 비밀번호 변경을 권장합니다.
                  </p>
                </div>
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

function maskEmail(value: string) {
  const [name, domain] = value.split("@");

  if (!name || !domain) {
    return "입력한 이메일";
  }

  const visibleName = name.length <= 2 ? name[0] : `${name.slice(0, 2)}***`;
  return `${visibleName}@${domain}`;
}

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Checkbox, Icon, Input } from "@/components/ui";
import { useToast } from "@/components/ui/Toast/Toast";
import { signUp, checkEmailAvailable, resendVerificationEmail } from "@/lib/auth-api";
import styles from "./signup.module.css";

/** 카카오 로그인 활성 여부 (NEXT_PUBLIC_KAKAO_ENABLED=true 시 활성) */
const KAKAO_ENABLED = process.env.NEXT_PUBLIC_KAKAO_ENABLED === "true";

/**
 * Better Auth 소셜 회원가입/로그인 시작.
 * POST /api/v1/auth/sign-in/social {provider, callbackURL} → { url } 응답 → 그 URL 로 이동.
 * 신규 유저면 자동 회원가입, 기존 유저면 로그인으로 처리된다.
 * (GET /sign-in/social/{provider} 는 존재하지 않음 — 404)
 */
async function startSocialSignup(provider: "google" | "naver" | "kakao"): Promise<void> {
  const callbackURL = `${window.location.origin}/`;
  // 실패/취소 시 Better Auth 기본 에러 페이지 대신 회원가입 페이지(로그아웃 상태)로.
  const errorCallbackURL = `${window.location.origin}/signup?error=social`;
  const res = await fetch("/api/v1/auth/sign-in/social", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ provider, callbackURL, errorCallbackURL }),
  });
  if (res.ok) {
    const data = (await res.json()) as { url?: string };
    if (data.url) {
      window.location.href = data.url;
      return;
    }
  }
}

export function SignupForm() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [method, setMethod] = useState<"social" | "email">("social");
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [resending, setResending] = useState(false);

  // 인증 메일 재발송 — 같은 화면에 머물며 발송 후 안내 토스트를 띄운다.
  async function handleResend() {
    if (resending || !sentEmail) return;
    setResending(true);
    const ok = await resendVerificationEmail(sentEmail);
    setResending(false);
    toast(
      ok
        ? {
            tone: "success",
            title: "인증 메일을 다시 보냈어요",
            description: `${sentEmail} 메일함(스팸함 포함)을 확인해 주세요.`,
          }
        : {
            tone: "danger",
            title: "재발송에 실패했어요",
            description: "잠시 후 다시 시도해 주세요.",
          },
    );
  }

  // 인증 메일 발송 완료 화면
  if (emailSent) {
    return (
      <main id="main" className={styles.page}>
        <section className={styles.authSection} aria-labelledby="signup-title">
          <div className={styles.formPanel}>
            <div className={styles.formHead}>
              <p className={styles.eyebrow}>Join</p>
              <h1 id="signup-title">인증 메일을 보냈어요</h1>
              <p>
                <strong>{sentEmail}</strong> 로 인증 링크를 보냈습니다.
                메일함을 확인하고 링크를 클릭해 가입을 완료해 주세요.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              disabled={resending}
              onClick={() => void handleResend()}
            >
              {resending ? "보내는 중..." : "인증 메일 다시 보내기"}
            </Button>
            <p className={styles.loginText}>
              이미 계정이 있나요? <Link href="/login">로그인</Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main id="main" className={styles.page}>
      <section className={styles.authSection} aria-labelledby="signup-title">
        <div className={styles.formPanel}>
          <div className={styles.formHead}>
            <p className={styles.eyebrow}>Join</p>
            <h1 id="signup-title">회원가입</h1>
            <p>가입 방식을 선택하고 AI작당 활동을 시작하세요.</p>
          </div>

          {searchParams.get("error") === "social" && (
            <div
              role="alert"
              style={{
                margin: "0 0 16px",
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--color-danger-soft)",
                border: "1px solid rgba(217, 54, 62, 0.22)",
                color: "var(--color-text)",
                fontSize: "var(--font-size-sm)",
                lineHeight: 1.5,
              }}
            >
              이미 <strong>다른 방법(이메일·다른 소셜)으로 가입된 이메일</strong>이에요.
              기존에 가입한 방법으로 로그인해 주세요.
            </div>
          )}

          <div className={styles.methodTabs} role="tablist" aria-label="가입 방식 선택">
            <button
              type="button"
              role="tab"
              aria-selected={method === "social"}
              className={method === "social" ? styles.activeTab : undefined}
              onClick={() => setMethod("social")}
            >
              <Icon name="group-line" />
              소셜 가입
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={method === "email"}
              className={method === "email" ? styles.activeTab : undefined}
              onClick={() => setMethod("email")}
            >
              <Icon name="mail-line" />
              이메일 가입
            </button>
          </div>

          {method === "social" ? (
            <SocialSignup />
          ) : (
            <EmailSignup
              onSuccess={(email) => {
                setEmailSent(true);
                setSentEmail(email);
              }}
            />
          )}

          <p className={styles.loginText}>
            이미 계정이 있나요? <Link href="/login">로그인</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function SocialSignup() {
  // 소셜 버튼 활성화 여부: 이용약관 + 개인정보처리방침 둘 다 체크해야 가능
  const [socialCanProceed, setSocialCanProceed] = useState(false);

  return (
    <div className={styles.socialSection} role="tabpanel">
      <div className={styles.socialGrid}>
        <button
          type="button"
          className={`${styles.socialButton} ${styles.kakaoButton}`}
          disabled={!KAKAO_ENABLED || !socialCanProceed}
          title={
            !KAKAO_ENABLED
              ? "카카오 로그인 준비 중"
              : !socialCanProceed
              ? "이용약관과 개인정보처리방침에 동의해 주세요"
              : undefined
          }
          style={
            !KAKAO_ENABLED || !socialCanProceed
              ? { opacity: 0.4, cursor: "not-allowed" }
              : undefined
          }
          onClick={
            KAKAO_ENABLED && socialCanProceed
              ? () => {
                  void startSocialSignup("kakao");
                }
              : undefined
          }
        >
          <span className={styles.socialLogo} aria-hidden="true">
            <KakaoMark />
          </span>
          카카오로 가입
        </button>
        <button
          type="button"
          className={`${styles.socialButton} ${styles.naverButton}`}
          disabled={!socialCanProceed}
          title={!socialCanProceed ? "이용약관과 개인정보처리방침에 동의해 주세요" : undefined}
          style={!socialCanProceed ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
          onClick={
            socialCanProceed
              ? () => {
                  void startSocialSignup("naver");
                }
              : undefined
          }
        >
          <span className={styles.socialLogo} aria-hidden="true">
            N
          </span>
          네이버로 가입
        </button>
        <button
          type="button"
          className={`${styles.socialButton} ${styles.googleButton}`}
          disabled={!socialCanProceed}
          title={!socialCanProceed ? "이용약관과 개인정보처리방침에 동의해 주세요" : undefined}
          style={!socialCanProceed ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
          onClick={
            socialCanProceed
              ? () => {
                  void startSocialSignup("google");
                }
              : undefined
          }
        >
          <span className={styles.socialLogo} aria-hidden="true">
            <GoogleMark />
          </span>
          Google로 가입
        </button>
      </div>
      <AgreementPanel
        compact
        onAgreementChange={(terms, privacy) => setSocialCanProceed(terms && privacy)}
      />
    </div>
  );
}

interface EmailSignupProps {
  onSuccess: (email: string) => void;
}

function EmailSignup({ onSuccess }: EmailSignupProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    marketing: false,
  });

  const canSubmit = agreements.terms && agreements.privacy && !submitting;

  // 이메일 blur 검증
  function validateEmail(value: string): string {
    if (!value) return "이메일을 입력해 주세요.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "올바른 이메일 형식이 아닙니다.";
    return "";
  }

  // 비밀번호 blur 검증
  function validatePassword(value: string): string {
    if (!value) return "비밀번호를 입력해 주세요.";
    if (value.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
    if (value.length > 128) return "비밀번호는 128자 이하여야 합니다.";
    return "";
  }

  // 이메일 blur: 형식 검증 후 중복 여부까지 확인해 미리 막는다.
  async function handleEmailBlur(value: string) {
    const fmtErr = validateEmail(value);
    if (fmtErr) {
      setEmailError(fmtErr);
      return;
    }
    const available = await checkEmailAvailable(value.trim().toLowerCase());
    if (available === false) {
      setEmailError("이미 가입된 이메일이에요. 로그인하거나 소셜 로그인을 이용해 주세요.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // submit 시 전체 검증
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    if (!agreements.terms || !agreements.privacy) {
      toast({
        tone: "danger",
        title: "약관에 동의해 주세요",
        description: "이용약관과 개인정보보호방침 동의가 필요합니다.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp(email.trim().toLowerCase(), password, true);

      if (result.ok) {
        onSuccess(email.trim().toLowerCase());
        return;
      }

      // 실패 처리
      if (result.code === "EMAIL_DUPLICATE" || result.code === "DISPOSABLE_EMAIL") {
        setEmailError(result.message);
        return;
      }

      if (result.code === "RATE_LIMIT_EXCEEDED") {
        toast({
          tone: "danger",
          title: "잠시 후 다시 시도해 주세요",
          description: result.message,
        });
        return;
      }

      // 기타 오류
      toast({
        tone: "danger",
        title: "가입에 실패했어요",
        description: result.message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const agreeAll = agreements.terms && agreements.privacy && agreements.marketing;

  function updateAll(checked: boolean) {
    setAgreements({ terms: checked, privacy: checked, marketing: checked });
  }

  function updateAgreement(key: keyof typeof agreements, checked: boolean) {
    setAgreements((current) => ({ ...current, [key]: checked }));
  }

  return (
    <form className={styles.form} role="tabpanel" onSubmit={(e) => void handleSubmit(e)}>
      <div className={styles.fieldGroup}>
        <Input
          label="이메일"
          type="email"
          name="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          leftIcon={<Icon name="mail-line" />}
          value={email}
          error={emailError}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
          }}
          onBlur={(e) => void handleEmailBlur(e.target.value)}
        />
        <Input
          label="비밀번호"
          type="password"
          name="password"
          placeholder="8자 이상 입력"
          autoComplete="new-password"
          required
          leftIcon={<Icon name="lock-line" />}
          value={password}
          error={passwordError}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError("");
          }}
          onBlur={(e) => setPasswordError(validatePassword(e.target.value))}
        />
      </div>

      {/* 약관 동의 패널 (AgreementPanel 구조 보존) */}
      <div className={styles.agreementPanel}>
        <Checkbox name="agreeAll" checked={agreeAll} onChange={(event) => updateAll(event.target.checked)}>
          전체 동의
        </Checkbox>
        <div className={styles.agreementList}>
          <div className={styles.agreementItem}>
            <Checkbox
              name="terms"
              required
              checked={agreements.terms}
              onChange={(event) => updateAgreement("terms", event.target.checked)}
            >
              이용약관 동의
            </Checkbox>
            <Link href="/terms" target="_blank" rel="noopener noreferrer">보기</Link>
          </div>
          <div className={styles.agreementItem}>
            <Checkbox
              name="privacy"
              required
              checked={agreements.privacy}
              onChange={(event) => updateAgreement("privacy", event.target.checked)}
            >
              개인정보보호방침 동의
            </Checkbox>
            <Link href="/privacy" target="_blank" rel="noopener noreferrer">보기</Link>
          </div>
          <div className={styles.agreementItem}>
            <Checkbox
              name="marketing"
              checked={agreements.marketing}
              onChange={(event) => updateAgreement("marketing", event.target.checked)}
            >
              마케팅 정보 수신 동의
            </Checkbox>
            <span>선택</span>
            <Link href="/operation-policy" target="_blank" rel="noopener noreferrer">운영정책 보기</Link>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        fullWidth
        rightIcon={<Icon name="arrow-right-line" />}
        disabled={!canSubmit}
      >
        {submitting ? "가입 중..." : "이메일로 가입"}
      </Button>
    </form>
  );
}

interface AgreementPanelProps {
  compact?: boolean;
  /** terms·privacy 상태가 바뀔 때마다 부모에게 알림 (소셜 게이팅용) */
  onAgreementChange?: (terms: boolean, privacy: boolean) => void;
}

function AgreementPanel({ compact = false, onAgreementChange }: AgreementPanelProps) {
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
    marketing: false,
  });
  const agreeAll = agreements.terms && agreements.privacy && agreements.marketing;

  function updateAll(checked: boolean) {
    const next = {
      terms: checked,
      privacy: checked,
      marketing: checked,
    };
    setAgreements(next);
    onAgreementChange?.(checked, checked);
  }

  function updateAgreement(key: keyof typeof agreements, checked: boolean) {
    setAgreements((current) => {
      const next = { ...current, [key]: checked };
      onAgreementChange?.(next.terms, next.privacy);
      return next;
    });
  }

  return (
    <div className={compact ? `${styles.agreementPanel} ${styles.compactAgreement}` : styles.agreementPanel}>
      <Checkbox name="agreeAll" checked={agreeAll} onChange={(event) => updateAll(event.target.checked)}>
        전체 동의
      </Checkbox>
      <div className={styles.agreementList}>
        <div className={styles.agreementItem}>
          <Checkbox
            name="terms"
            required
            checked={agreements.terms}
            onChange={(event) => updateAgreement("terms", event.target.checked)}
          >
            이용약관 동의
          </Checkbox>
          <Link href="/terms" target="_blank" rel="noopener noreferrer">보기</Link>
        </div>
        <div className={styles.agreementItem}>
          <Checkbox
            name="privacy"
            required
            checked={agreements.privacy}
            onChange={(event) => updateAgreement("privacy", event.target.checked)}
          >
            개인정보보호방침 동의
          </Checkbox>
          <Link href="/privacy" target="_blank" rel="noopener noreferrer">보기</Link>
        </div>
        <div className={styles.agreementItem}>
          <Checkbox
            name="marketing"
            checked={agreements.marketing}
            onChange={(event) => updateAgreement("marketing", event.target.checked)}
          >
            마케팅 정보 수신 동의
          </Checkbox>
          <span>선택</span>
          <Link href="/operation-policy" target="_blank" rel="noopener noreferrer">운영정책 보기</Link>
        </div>
      </div>
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

function GoogleMark() {
  return (
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
  );
}

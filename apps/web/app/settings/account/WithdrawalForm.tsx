"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon, Input } from "@/components/ui";
import { withdrawUser } from "@/lib/users-api";
import { signOut } from "@/lib/auth-api";
import shell from "../settings.module.css";
import styles from "./account.module.css";

/** 탈퇴 확인 입력 문자열 */
const CONFIRM_TEXT = "탈퇴합니다";

/** 탈퇴 확인사항 목록 */
const WITHDRAWAL_NOTICES = [
  "작성한 글·댓글은 삭제되지 않으며 작성자 정보가 '익명'으로 변경됩니다.",
  "보유한 포인트와 등급 정보는 복구할 수 없습니다.",
  "탈퇴 후 동일 이메일로 재가입이 가능하나, 기존 데이터는 복구되지 않습니다.",
  "탈퇴 처리는 즉시 적용되며 로그아웃됩니다.",
] as const;

type Step = 1 | 2;

export function WithdrawalForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [confirmInput, setConfirmInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const isConfirmed = confirmInput === CONFIRM_TEXT;

  async function handleWithdraw() {
    if (!isConfirmed) return;
    setIsSubmitting(true);
    setErrorMessage(undefined);

    try {
      const result = await withdrawUser();

      if (result.ok) {
        // 세션 클리어 (서버 세션은 삭제됐으나 쿠키 정리)
        await signOut().catch(() => {
          // signOut 실패해도 홈 이동
        });
        router.push("/");
      } else {
        setErrorMessage(result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={shell.form}>
      {/* ── 1단계: 확인사항 안내 ── */}
      {step === 1 && (
        <>
          <div className={styles.noticeBox}>
            <p className={styles.noticeTitle}>
              <Icon name="alert-line" />
              탈퇴 전 꼭 확인하세요
            </p>
            <ul className={styles.noticeList}>
              {WITHDRAWAL_NOTICES.map((notice) => (
                <li key={notice} className={styles.noticeItem}>
                  <Icon name="checkbox-blank-circle-line" />
                  {notice}
                </li>
              ))}
            </ul>
          </div>

          <div className={shell.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/mypage")}
            >
              돌아가기
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setStep(2)}
            >
              확인했습니다
            </Button>
          </div>
        </>
      )}

      {/* ── 2단계: 탈퇴 확정 입력 ── */}
      {step === 2 && (
        <>
          <div className={styles.confirmSection}>
            <p className={styles.confirmDesc}>
              탈퇴를 확정하려면 아래 입력란에{" "}
              <strong>&ldquo;{CONFIRM_TEXT}&rdquo;</strong>를 정확히 입력하세요.
            </p>
            <Input
              label={`"${CONFIRM_TEXT}" 입력`}
              name="confirm-text"
              value={confirmInput}
              onChange={(e) => {
                setConfirmInput(e.target.value);
                setErrorMessage(undefined);
              }}
              placeholder={`"${CONFIRM_TEXT}"를 입력하세요`}
              autoComplete="off"
              error={errorMessage}
            />
          </div>

          <div className={shell.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStep(1);
                setConfirmInput("");
                setErrorMessage(undefined);
              }}
            >
              이전
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!isConfirmed || isSubmitting}
              onClick={handleWithdraw}
              leftIcon={<Icon name="delete-bin-line" />}
            >
              {isSubmitting ? "탈퇴 처리 중..." : "탈퇴 확정"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

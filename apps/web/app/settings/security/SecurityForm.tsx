"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Icon, Input } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { changePassword, getMyAccounts } from "@/lib/users-api";
import shell from "../settings.module.css";

/** 새 비밀번호 최소 길이 */
const MIN_LENGTH = 8;

export function SecurityForm() {
  const { toast } = useToast();

  // 제어 입력 상태 (current: 현재 비밀번호, next: 새 비밀번호, confirm: 새 비밀번호 확인)
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  // 제출 시도 후에만 유효성 안내를 보여주기 위한 플래그
  const [submitted, setSubmitted] = useState(false);
  // 현재 비밀번호 불일치 인라인 오류
  const [currentError, setCurrentError] = useState<string | undefined>(undefined);
  // 폼 제출 중 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 소셜 전용 계정 여부 (credential 없음)
  const [isSocialOnly, setIsSocialOnly] = useState<boolean | null>(null);

  // 길이 미달 / 불일치 여부 (확인란이 비어 있을 때는 불일치 안내를 띄우지 않는다)
  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;

  // 마운트 시 소셜 전용 계정 여부 확인
  useEffect(() => {
    void getMyAccounts().then((res) => {
      if (res === null) {
        setIsSocialOnly(false); // 오류 시 폼 표시
        return;
      }
      const hasCredential = res.providers.includes("credential");
      setIsSocialOnly(!hasCredential);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setCurrentError(undefined);

    if (!current || next.length < MIN_LENGTH || next !== confirm) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await changePassword({ currentPassword: current, newPassword: next });

      if (result.ok) {
        toast({ tone: "success", title: "비밀번호가 변경됐어요" });
        // 폼 초기화
        setCurrent("");
        setNext("");
        setConfirm("");
        setSubmitted(false);
      } else if (result.code === "WRONG_PASSWORD") {
        setCurrentError("현재 비밀번호가 올바르지 않습니다.");
      } else {
        toast({ tone: "danger", title: "변경 실패", description: result.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // 로딩 중
  if (isSocialOnly === null) {
    return <p style={{ padding: "1rem" }}>불러오는 중...</p>;
  }

  // 소셜 전용 계정 안내
  if (isSocialOnly) {
    return (
      <div className={shell.form}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <Icon name="information-line" />
          <p>
            소셜 계정(구글·네이버 등)으로 가입하셨어요.
            <br />
            비밀번호 없이 소셜 로그인만 사용하실 수 있습니다.
          </p>
        </div>
        <div className={shell.actions}>
          <Link href="/mypage">
            <Button type="button" variant="secondary">
              돌아가기
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className={shell.form} onSubmit={handleSubmit} noValidate>
      <Input
        label="현재 비밀번호"
        type="password"
        name="current-password"
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          setCurrentError(undefined);
        }}
        placeholder="현재 비밀번호"
        autoComplete="current-password"
        required
        error={currentError ?? (submitted && !current ? "현재 비밀번호를 입력하세요." : undefined)}
        leftIcon={<Icon name="lock-line" />}
      />

      <Input
        label="새 비밀번호"
        type="password"
        name="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        placeholder={`${MIN_LENGTH}자 이상`}
        autoComplete="new-password"
        required
        helpText={`영문·숫자를 포함해 ${MIN_LENGTH}자 이상 권장`}
        error={tooShort ? `새 비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다.` : undefined}
        leftIcon={<Icon name="lock-2-line" />}
      />

      <Input
        label="새 비밀번호 확인"
        type="password"
        name="confirm-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="새 비밀번호 다시 입력"
        autoComplete="new-password"
        required
        error={mismatch ? "새 비밀번호가 일치하지 않습니다." : undefined}
        success={confirm.length > 0 && !mismatch ? "비밀번호가 일치합니다." : undefined}
        leftIcon={<Icon name="lock-2-line" />}
      />

      <div className={shell.actions}>
        <Link href="/mypage">
          <Button type="button" variant="secondary">
            취소
          </Button>
        </Link>
        <Button type="submit" leftIcon={<Icon name="shield-check-line" />} disabled={isSubmitting}>
          {isSubmitting ? "변경 중..." : "변경"}
        </Button>
      </div>
    </form>
  );
}

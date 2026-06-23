"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Icon, Input } from "@/components/ui";
import shell from "../settings.module.css";

/** 새 비밀번호 최소 길이 */
const MIN_LENGTH = 8;

export function SecurityForm() {
  // 제어 입력 상태 (current: 현재 비밀번호, next: 새 비밀번호, confirm: 새 비밀번호 확인)
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  // 제출 시도 후에만 유효성 안내를 보여주기 위한 플래그
  const [submitted, setSubmitted] = useState(false);

  // 길이 미달 / 불일치 여부 (확인란이 비어 있을 때는 불일치 안내를 띄우지 않는다)
  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!current || next.length < MIN_LENGTH || next !== confirm) {
      // 유효성 미통과 시 제출 중단 (안내는 각 필드 error 로 표시)
      return;
    }

    // 목업 단계: 실제 변경 API 가 붙기 전이라 안내만 한다.
    alert("비밀번호 변경 기능은 아직 개발 중입니다.");
  }

  return (
    <form className={shell.form} onSubmit={handleSubmit} noValidate>
      <Input
        label="현재 비밀번호"
        type="password"
        name="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        placeholder="현재 비밀번호"
        autoComplete="current-password"
        required
        error={submitted && !current ? "현재 비밀번호를 입력하세요." : undefined}
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
        <Button type="submit" leftIcon={<Icon name="shield-check-line" />}>
          변경
        </Button>
      </div>
    </form>
  );
}

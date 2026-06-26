"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Icon, Input, Select, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile } from "@/lib/users-api";
import shell from "../settings.module.css";
import styles from "./membership.module.css";

/** 성별 셀렉트 옵션 */
const GENDER_OPTIONS = [
  { value: "", label: "선택안함" },
  { value: "male", label: "남성" },
  { value: "female", label: "여성" },
  { value: "other", label: "기타" },
];

export function AccountInfoForm() {
  const { user } = useAuth();
  const { toast } = useToast();

  // ── 회원정보 필드 ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [marketingAgreed, setMarketingAgreed] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 사용자 회원정보 로드
  useEffect(() => {
    if (!user) return;
    fetch("/api/v1/users/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          name?: string | null;
          phone?: string | null;
          gender?: "male" | "female" | "other" | null;
          birthDate?: string | null;
          marketingAgreed?: boolean;
        } | null) => {
          if (data?.name) setName(data.name);
          if (data?.phone) setPhone(data.phone);
          if (data?.gender) setGender(data.gender);
          if (data?.birthDate) setBirthDate(data.birthDate);
          if (typeof data?.marketingAgreed === "boolean") setMarketingAgreed(data.marketingAgreed);
        },
      )
      .catch(() => {
        /* 로드 실패 시 무시 */
      });
  }, [user]);

  // ── 폼 저장 ──

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // 휴대폰 필수 검증
    if (!phone.trim()) {
      toast({ tone: "danger", title: "휴대폰 번호를 입력해 주세요" });
      setPhoneError("휴대폰 번호는 필수입니다.");
      return;
    }
    const phonePattern = /^[\d\-]+$/;
    if (!phonePattern.test(phone.trim())) {
      toast({ tone: "danger", title: "휴대폰 형식 오류", description: "숫자와 하이픈(-)만 입력해 주세요." });
      setPhoneError("숫자와 하이픈(-)만 입력할 수 있습니다.");
      return;
    }
    setPhoneError(undefined);

    setIsSubmitting(true);

    try {
      const result = await updateProfile({
        name: name.trim() || null,
        phone: phone.trim(),
        gender: (gender as "male" | "female" | "other") || null,
        birthDate: birthDate || null,
        marketingAgreed,
      });

      if (result.ok) {
        toast({ tone: "success", title: "회원정보가 저장됐어요" });
        setPhoneError(undefined);
      } else {
        toast({ tone: "danger", title: "저장 실패", description: result.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={shell.form} onSubmit={handleSubmit} noValidate>

      {/* 이메일 (읽기전용) */}
      <div className={styles.readonlyField}>
        <span className={styles.readonlyLabel} id="email-readonly-label">이메일</span>
        <div className={styles.readonlyValue} aria-labelledby="email-readonly-label" aria-readonly="true">
          <Icon name="mail-line" />
          {user?.email ?? ""}
        </div>
      </div>

      {/* 이름 (선택) */}
      <Input
        label="이름"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="실명을 입력하세요 (선택)"
        autoComplete="name"
        maxLength={50}
        leftIcon={<Icon name="user-line" />}
      />

      {/* 휴대폰 (필수) */}
      <Input
        label="휴대폰"
        name="phone"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          setPhoneError(undefined);
        }}
        placeholder="예) 010-1234-5678"
        autoComplete="tel"
        inputMode="tel"
        required
        maxLength={20}
        leftIcon={<Icon name="smartphone-line" />}
        error={phoneError}
        helpText={!phoneError ? "숫자와 하이픈(-)만 입력해 주세요." : undefined}
      />

      {/* 성별 (선택) — 디자인 시스템 커스텀 Select */}
      <Select
        label="성별"
        name="gender"
        options={GENDER_OPTIONS}
        value={gender}
        onChange={setGender}
        placeholder="선택안함"
      />

      {/* 생년월일 (선택) */}
      <Input
        label="생년월일"
        type="date"
        name="birthDate"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
        autoComplete="bday"
        leftIcon={<Icon name="calendar-line" />}
      />

      {/* 마케팅 수신 동의 (선택) */}
      <div className={styles.switchRow}>
        <div className={styles.switchText}>
          <span className={styles.fieldLabel}>마케팅 수신 동의</span>
          <p className={styles.fieldDesc}>이벤트, 혜택, 새 기능 소식을 받아보세요.</p>
        </div>
        <Switch
          checked={marketingAgreed}
          onChange={(e) => setMarketingAgreed(e.target.checked)}
          aria-label="마케팅 수신 동의"
        />
      </div>

      {/* 비밀번호 변경 버튼 */}
      <div className={styles.passwordRow}>
        <div className={styles.passwordText}>
          <span className={styles.fieldLabel}>비밀번호</span>
          <p className={styles.fieldDesc}>보안 설정에서 비밀번호를 변경할 수 있습니다.</p>
        </div>
        <Link href="/settings/security">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Icon name="lock-2-line" />}
          >
            비밀번호 변경
          </Button>
        </Link>
      </div>

      <div className={shell.actions}>
        <Link href="/mypage">
          <Button type="button" variant="secondary">취소</Button>
        </Link>
        <Button type="submit" leftIcon={<Icon name="save-line" />} disabled={isSubmitting}>
          {isSubmitting ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}

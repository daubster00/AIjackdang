"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { useToast } from "@/components/ui/Toast/Toast";
import styles from "./MemberReportModal.module.css";

const MEMBER_REPORT_REASONS = [
  { code: "profile", label: "프로필 부적절 (닉네임/소개/아바타)" },
  { code: "impersonation", label: "사칭" },
  { code: "spam", label: "도배/광고" },
  { code: "abuse", label: "욕설/괴롭힘" },
  { code: "other", label: "기타" },
] as const;

type ReasonCode = (typeof MEMBER_REPORT_REASONS)[number]["code"];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetNickname: string;
}

export function MemberReportModal({ isOpen, onClose, targetUserId, targetNickname }: Props) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<ReasonCode | "">("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // isOpen 전환 시 상태 초기화 + showModal()/close() 호출
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      setSelected("");
      setDetail("");
      setError(null);
      dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isOpen]);

  // dialog close 이벤트 → onClose() 연계 (Esc 자동 지원)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  async function handleSubmit() {
    if (!selected) return;
    if (selected === "other" && !detail.trim()) {
      setError("기타 사유를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "user",
          targetId: targetUserId,
          reasonCode: selected,
          detail: selected === "other" ? detail.trim() : undefined,
        }),
      });
      if (res.status === 409) {
        setError("이미 신고한 회원입니다.");
        return;
      }
      if (!res.ok) {
        setError("신고 제출에 실패했습니다.");
        return;
      }
      toast({ tone: "success", title: "신고가 접수되었습니다." });
      onClose();
    } catch {
      setError("신고 제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="member-report-modal-title"
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div>
            <h3 id="member-report-modal-title" className={styles.title}>
              신고하기
            </h3>
            <p className={styles.subtitle}>{targetNickname} 님</p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            <Icon name="close-line" />
          </button>
        </header>

        <p className={styles.desc}>
          신고 사유를 선택해 주세요. 검토 후 적절한 조치를 취하겠습니다.
        </p>

        <fieldset className={styles.reasons}>
          <legend className="sr-only">신고 사유</legend>
          {MEMBER_REPORT_REASONS.map((reason) => (
            <label
              key={reason.code}
              className={`${styles.reasonItem} ${selected === reason.code ? styles.reasonSelected : ""}`}
            >
              <input
                type="radio"
                name="member-report-reason"
                value={reason.code}
                checked={selected === reason.code}
                onChange={() => setSelected(reason.code)}
              />
              <span>{reason.label}</span>
            </label>
          ))}
        </fieldset>

        {selected === "other" && (
          <textarea
            className={styles.detailInput}
            placeholder="기타 사유를 입력해주세요 (필수)"
            rows={3}
            maxLength={500}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        )}

        {error && (
          <p role="alert" className={styles.errorMsg}>
            {error}
          </p>
        )}

        <footer className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            disabled={!selected || submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "제출 중..." : "신고하기"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

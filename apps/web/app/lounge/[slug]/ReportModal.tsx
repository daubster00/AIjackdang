"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { useToast } from "@/components/ui/Toast/Toast";
import styles from "../lounge.module.css";

const REPORT_REASONS = [
  { code: "spam", label: "스팸 또는 광고" },
  { code: "abuse", label: "욕설 / 혐오 표현" },
  { code: "privacy", label: "개인정보 침해" },
  { code: "misinformation", label: "허위 정보" },
  { code: "other", label: "기타" },
] as const;

type ReasonCode = (typeof REPORT_REASONS)[number]["code"];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  targetType: string;
  targetId: string;
};

export function ReportModal({ isOpen, onClose, targetType, targetId }: Props) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<ReasonCode | "">("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      setSelected("");
      setDetail("");
      setError(null);
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

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
          targetType,
          targetId,
          reasonCode: selected,
          detail: selected === "other" ? detail.trim() : undefined,
        }),
      });
      if (res.status === 409) {
        setError("이미 신고한 콘텐츠입니다.");
        return;
      }
      if (!res.ok) {
        setError("신고 제출에 실패했습니다.");
        return;
      }
      toast({ tone: "success", title: "신고가 접수되었습니다." });
      onClose();
    } catch {
      setError("신고 제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog ref={dialogRef} className={styles.reportDialog} aria-labelledby="report-modal-title">
      <div className={styles.reportModal}>
        <header className={styles.reportHeader}>
          <h3 id="report-modal-title">신고하기</h3>
          <button type="button" className={styles.reportCloseBtn} onClick={onClose} aria-label="닫기">
            <Icon name="close-line" />
          </button>
        </header>

        <p className={styles.reportDesc}>
          신고 사유를 선택해 주세요. 검토 후 적절한 조치를 취하겠습니다.
        </p>

        <fieldset className={styles.reportReasons}>
          <legend className="sr-only">신고 사유</legend>
          {REPORT_REASONS.map((reason) => (
            <label
              key={reason.code}
              className={`${styles.reportReasonItem} ${selected === reason.code ? styles.reportReasonSelected : ""}`}
            >
              <input
                type="radio"
                name="report-reason"
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
            className={styles.reportDetailInput}
            placeholder="기타 사유를 입력해주세요 (필수)"
            rows={3}
            maxLength={500}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        )}

        {error && (
          <p role="alert" style={{ color: "var(--color-danger, #e53e3e)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {error}
          </p>
        )}

        <footer className={styles.reportFooter}>
          <button type="button" className={styles.reportCancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={styles.reportSubmitBtn}
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

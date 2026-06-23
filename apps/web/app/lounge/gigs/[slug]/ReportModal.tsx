"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import styles from "../../lounge.module.css";

const REPORT_REASONS = [
  "스팸 또는 광고",
  "욕설 / 혐오 표현",
  "개인정보 침해",
  "허위 정보",
  "기타",
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function ReportModal({ isOpen, onClose }: Props) {
  const [selected, setSelected] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      setSelected("");
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

  function handleSubmit() {
    onClose();
  }

  return (
    <dialog ref={dialogRef} className={styles.reportDialog}>
      <div className={styles.reportModal}>
        <header className={styles.reportHeader}>
          <h3>신고하기</h3>
          <button
            type="button"
            className={styles.reportCloseBtn}
            onClick={onClose}
            aria-label="닫기"
          >
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
              key={reason}
              className={`${styles.reportReasonItem} ${selected === reason ? styles.reportReasonSelected : ""}`}
            >
              <input
                type="radio"
                name="report-reason"
                value={reason}
                checked={selected === reason}
                onChange={() => setSelected(reason)}
              />
              <span>{reason}</span>
            </label>
          ))}
        </fieldset>

        <footer className={styles.reportFooter}>
          <button type="button" className={styles.reportCancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={styles.reportSubmitBtn}
            disabled={!selected}
            onClick={handleSubmit}
          >
            신고하기
          </button>
        </footer>
      </div>
    </dialog>
  );
}

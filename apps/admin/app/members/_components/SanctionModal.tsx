"use client";

import { useState } from "react";

// ── 공통 모달 래퍼 ────────────────────────────────────────────────────────────

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--gray-0, #fff)", borderRadius: 8, padding: 24,
          width: 460, maxWidth: "95vw", boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button className="icon-button" onClick={onClose} aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalFooter({ onClose, onConfirm, confirmLabel, danger, disabled }: {
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
      <button className="btn btn-outline" onClick={onClose}>취소</button>
      <button
        className={danger ? "btn btn-danger" : "btn btn-primary"}
        onClick={onConfirm}
        disabled={disabled}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

// ── 이용제한 / 제재 모달 ──────────────────────────────────────────────────────

export interface SanctionModalProps {
  onClose: () => void;
  onConfirm: (type: "warning" | "suspend" | "permaban", reason: string, endsAt: string | null) => void;
}

export function SanctionModal({ onClose, onConfirm }: SanctionModalProps) {
  const [type, setType] = useState<"warning" | "suspend" | "permaban">("warning");
  const [reason, setReason] = useState("");
  const [endsAt, setEndsAt] = useState("");

  return (
    <Modal title="이용제한 / 제재" onClose={onClose}>
      <div className="component-stack">
        <div className="field">
          <span className="field-label">제재 유형</span>
          <div className="choice-row">
            <label className="choice">
              <input type="radio" name="sanctionType" checked={type === "warning"} onChange={() => setType("warning")} />
              경고
            </label>
            <label className="choice">
              <input type="radio" name="sanctionType" checked={type === "suspend"} onChange={() => setType("suspend")} />
              일시정지
            </label>
            <label className="choice">
              <input type="radio" name="sanctionType" checked={type === "permaban"} onChange={() => setType("permaban")} />
              영구정지
            </label>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sanctionReason">사유 <span style={{ color: "var(--danger)" }}>*</span></label>
          <textarea
            className="control"
            id="sanctionReason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="제재 사유를 입력하세요 (필수)"
          />
        </div>

        {type === "suspend" && (
          <div className="field">
            <label className="field-label" htmlFor="sanctionEndsAt">정지 종료일</label>
            <input
              className="control"
              id="sanctionEndsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        )}
      </div>
      <ModalFooter
        onClose={onClose}
        onConfirm={() => onConfirm(type, reason, type === "suspend" && endsAt ? new Date(endsAt).toISOString() : null)}
        confirmLabel="제재 적용"
        danger
        disabled={!reason.trim()}
      />
    </Modal>
  );
}

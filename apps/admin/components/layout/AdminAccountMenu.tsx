"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 상단바 오른쪽 관리자 계정 칩 + 내 정보 수정 모달.
 * - 칩: 아바타 + 이름 + 등급 배지(예: 마스터)를 표기하고, 클릭하면 내 정보 수정 모달을 연다.
 * - 모달: 프로필 사진 / 이메일 / 비밀번호 / 연락처를 수정한다(디자인만, 더미 상태).
 *
 * 모달은 전역 overlay.js(공통 모달 열기 스크립트)가 페이지의 .overlay 를 가로채지 않도록,
 * .overlay 클래스 대신 자체 React 상태 + inline 스타일 백드롭으로 제어한다.
 */

// 현재 로그인한 관리자(더미). 실제로는 세션/API 에서 가져온다.
const ADMIN_ACCOUNT = {
  name: "최고관리자",
  grade: "마스터", // 관리 등급(마스터/운영자)
  email: "master.choi@example.com",
  phone: "010-1234-5678",
  initial: "관",
};

export function AdminAccountMenu() {
  // open(내 정보 수정 모달 열림 여부)
  const [open, setOpen] = useState(false);
  // photoPreview(미리보기용 프로필 사진 data URL) — 선택 시에만 채워진다.
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // mounted(클라이언트 마운트 여부) — 포털 대상 document.body 접근 가드.
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Esc 키로 닫기
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  return (
    <>
      {/* 계정 칩(버튼): 아바타 + 이름 + 등급 배지 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="내 계정 정보 수정"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 40,
          padding: "0 10px 0 6px",
          border: "1px solid var(--gray-200)",
          borderRadius: 999,
          background: "var(--gray-0)",
          cursor: "pointer",
          transition: "140ms ease",
        }}
      >
        <span className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
          {ADMIN_ACCOUNT.initial}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 650, color: "var(--gray-900)", whiteSpace: "nowrap" }}>
            {ADMIN_ACCOUNT.name}
          </span>
          <span className="badge badge-orange">{ADMIN_ACCOUNT.grade}</span>
        </span>
        <i className="ri-arrow-down-s-line" style={{ fontSize: 16, color: "var(--gray-400)" }} />
      </button>

      {/* ===== 내 정보 수정 모달 =====
          .topbar 는 backdrop-filter 를 가져 position:fixed 의 기준이 되므로,
          모달/백드롭은 document.body 로 포털해 화면 전체 기준으로 띄운다. */}
      {mounted && open && createPortal(
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(15, 23, 42, 0.42)",
              backdropFilter: "blur(2px)",
            }}
          />
          <section
            className="modal open"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adminAccountEditTitle"
          >
            <div className="modal-header">
              <div className="modal-title" id="adminAccountEditTitle">내 정보 수정</div>
              <button
                type="button"
                className="icon-button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
              >
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="modal-body">
              <div className="component-stack">
                {/* 프로필 사진 */}
                <div className="field">
                  <span className="field-label">프로필 사진</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoPreview}
                        alt="프로필 미리보기"
                        style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : (
                      <span className="avatar" style={{ width: 64, height: 64, fontSize: 24 }}>
                        {ADMIN_ACCOUNT.initial}
                      </span>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => fileRef.current?.click()}
                      >
                        <i className="ri-image-edit-line" />
                        사진 변경
                      </button>
                      {photoPreview && (
                        <button
                          type="button"
                          className="btn btn-text btn-sm"
                          onClick={() => setPhotoPreview(null)}
                        >
                          기본 이미지로
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handlePhotoPick}
                    />
                  </div>
                </div>

                {/* 이메일 */}
                <div className="field">
                  <label className="field-label" htmlFor="accEmail">이메일</label>
                  <div className="input-icon">
                    <i className="ri-mail-line" />
                    <input
                      className="control"
                      id="accEmail"
                      type="email"
                      defaultValue={ADMIN_ACCOUNT.email}
                      placeholder="admin@example.com"
                    />
                  </div>
                </div>

                {/* 비밀번호 */}
                <div className="field">
                  <label className="field-label" htmlFor="accPassword">새 비밀번호</label>
                  <div className="input-icon">
                    <i className="ri-lock-2-line" />
                    <input
                      className="control"
                      id="accPassword"
                      type="password"
                      placeholder="변경할 비밀번호 (미입력 시 유지)"
                    />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="accPasswordConfirm">새 비밀번호 확인</label>
                  <div className="input-icon">
                    <i className="ri-lock-2-line" />
                    <input
                      className="control"
                      id="accPasswordConfirm"
                      type="password"
                      placeholder="새 비밀번호를 다시 입력"
                    />
                  </div>
                </div>

                {/* 연락처 */}
                <div className="field">
                  <label className="field-label" htmlFor="accPhone">연락처</label>
                  <div className="input-icon">
                    <i className="ri-phone-line" />
                    <input
                      className="control"
                      id="accPhone"
                      type="tel"
                      defaultValue={ADMIN_ACCOUNT.phone}
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
                취소
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
                <i className="ri-save-line" />
                저장
              </button>
            </div>
          </section>
        </>,
        document.body,
      )}
    </>
  );
}

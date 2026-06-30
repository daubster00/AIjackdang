"use client";

/**
 * 공용 시스템 다이얼로그 (확인/알림) — 관리자 전 페이지 공통.
 *
 * 사용자 요청: "관리자 페이지 모든 시스템 알림은 모달을 전부 띄워줘",
 * "삭제하시겠습니까 / 저장되었습니다 같은 시스템 알림은 모달로",
 * "모든 모달 배경은 흰색".
 *
 * window.confirm / window.alert / 중앙 토스트를 대체한다.
 * 어디서든 import 후 await confirmDialog(...) / await notifyDialog(...) 로 호출.
 * 프로바이더로 감쌀 필요 없이 모듈 레벨 이벤트로 동작하며,
 * <DialogHost/> 가 layout 에 한 번만 마운트되어 실제 모달을 렌더한다.
 * 배경은 overlay.css 의 `.modal-backdrop > .modal`(불투명 흰색)을 사용한다.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type DialogKind = "confirm" | "alert";
type DialogTone = "default" | "danger" | "success";

export interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: DialogTone;
}

interface DialogRequest extends DialogOptions {
  id: number;
  kind: DialogKind;
  resolve: (value: boolean) => void;
}

let counter = 0;
let listeners: Array<(req: DialogRequest) => void> = [];

function emit(kind: DialogKind, opts: DialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const req: DialogRequest = { ...opts, id: ++counter, kind, resolve };
    if (listeners.length === 0) {
      // 호스트가 아직 없으면(이론상 거의 없음) 네이티브로 폴백
      if (kind === "confirm") resolve(window.confirm(opts.message));
      else {
        window.alert(opts.message);
        resolve(true);
      }
      return;
    }
    listeners.forEach((l) => l(req));
  });
}

/** 확인(취소/확인) 모달. 확인 시 true, 취소·배경클릭·ESC 시 false. */
export function confirmDialog(opts: DialogOptions | string): Promise<boolean> {
  const o = typeof opts === "string" ? { message: opts } : opts;
  return emit("confirm", { confirmText: "확인", cancelText: "취소", ...o });
}

/** 단순 알림(확인 버튼 1개) 모달. "저장되었습니다" 등 시스템 알림용. */
export function alertDialog(opts: DialogOptions | string): Promise<boolean> {
  const o = typeof opts === "string" ? { message: opts } : opts;
  return emit("alert", { confirmText: "확인", ...o });
}

/** 성공/실패 알림 모달. notifyDialog("저장되었습니다") / (msg, "danger"). */
export function notifyDialog(message: string, tone: DialogTone = "success"): Promise<boolean> {
  return emit("alert", {
    message,
    tone,
    title: tone === "danger" ? "오류" : "알림",
    confirmText: "확인",
  });
}

export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    const listener = (req: DialogRequest) => setQueue((q) => [...q, req]);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") resolveCurrent(false);
      if (e.key === "Enter") resolveCurrent(true);
    }
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  function resolveCurrent(value: boolean) {
    setQueue((q) => {
      const [first, ...rest] = q;
      first?.resolve(value);
      return rest;
    });
  }

  if (!current) return null;

  const tone = current.tone ?? "default";
  const confirmClass =
    tone === "danger" ? "btn btn-danger" : tone === "success" ? "btn btn-primary" : "btn btn-primary";

  return createPortal(
    <div className="modal-backdrop" onClick={() => resolveCurrent(false)}>
      <div
        className="modal"
        style={{ maxWidth: 440 }}
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">{current.title ?? (current.kind === "confirm" ? "확인" : "알림")}</div>
          <button className="icon-button" onClick={() => resolveCurrent(false)} aria-label="닫기">
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, whiteSpace: "pre-line", color: "var(--gray-700)", lineHeight: 1.6 }}>
            {current.message}
          </p>
        </div>
        <div className="modal-footer">
          {current.kind === "confirm" && (
            <button className="btn btn-outline" onClick={() => resolveCurrent(false)}>
              {current.cancelText ?? "취소"}
            </button>
          )}
          <button className={confirmClass} onClick={() => resolveCurrent(true)} autoFocus>
            {current.confirmText ?? "확인"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

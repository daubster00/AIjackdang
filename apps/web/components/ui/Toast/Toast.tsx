"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "../Icon";
import styles from "./Toast.module.css";

export type ToastTone = "success" | "warning" | "danger" | "info";

export interface ToastOptions {
  tone?: ToastTone;
  title: string;
  description?: string;
  /** 자동 닫힘(ms). 기본 4000. 0 이면 자동으로 닫지 않는다. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** 토스트 컨텍스트. 앱 루트에서 한 번 감싼다. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const remove = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const item: ToastItem = { tone: "info", duration: 4000, ...options, id };
    setToasts((items) => [...items, item]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        toasts.length > 0 &&
        createPortal(
          // 모든 알림은 반투명 검은 배경막(overlay) 위에 띄운다. 배경 클릭 시 모두 닫힌다.
          <div className={styles.overlay} onClick={() => setToasts([])}>
            <div
              className={styles.stack}
              role="region"
              aria-label="알림"
              onClick={(e) => e.stopPropagation()}
            >
              {toasts.map((item) => (
                <ToastView key={item.id} item={item} onClose={() => remove(item.id)} />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  useEffect(() => {
    if (!item.duration) return;
    const timer = setTimeout(onClose, item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, onClose]);

  return (
    <div className={styles.toast} role="status">
      {/* X 닫기 버튼 — 우상단 절대 배치 */}
      <button type="button" className={styles.close} aria-label="알림 닫기" onClick={onClose}>
        <Icon name="close-line" />
      </button>

      {/* 제목 — 왼쪽 정렬 */}
      <strong className={styles.title}>{item.title}</strong>

      {/* 설명 — 가운데 정렬 (선택) */}
      {item.description && (
        <p className={styles.description}>{item.description}</p>
      )}

      {/* 확인 버튼 — 항상 표시, 클릭 시 닫힘 */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.confirmBtn}
          aria-label="알림 확인 후 닫기"
          onClick={onClose}
        >
          확인
        </button>
      </div>
    </div>
  );
}

/** 토스트를 띄우는 훅. ToastProvider 내부에서만 사용한다. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast 는 ToastProvider 내부에서 사용해야 합니다.");
  }
  return context;
}

"use client";

/**
 * 권한 매트릭스 클라이언트 컴포넌트 (Story 9.4 AC#8 / Item 24).
 *
 * - GET /api/v1/admin/permissions 에서 roles·matrix·actions 를 동적으로 로드.
 * - 모든 역할(locked 여부 무관)이 컬럼으로 자동 표시된다.
 * - super_admin 컬럼은 항상 전부 true·읽기 전용.
 * - 그 외 역할 체크박스는 토글 가능 → PATCH /api/v1/admin/permissions.
 */

import { useState, useEffect, useCallback } from "react";
import type { AdminAction } from "@/lib/adminPermissions";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4003";

// 표시할 AdminAction 목록 (packages/auth/src/permissions.ts 기준)
const ADMIN_ACTIONS: { key: AdminAction; label: string; description: string }[] = [
  { key: "content:hide",       label: "콘텐츠 숨김",    description: "게시글·댓글을 숨김 처리" },
  { key: "content:delete",     label: "콘텐츠 삭제",    description: "게시글·댓글을 영구 삭제" },
  { key: "report:process",     label: "신고 처리",      description: "신고 내역 확인 및 처리" },
  { key: "member:sanction",    label: "회원 제재",      description: "회원 정지·이용 제한 처리" },
  { key: "member:role-change", label: "역할 변경",      description: "관리자 역할(등급) 변경" },
  { key: "site:settings",      label: "사이트 설정",    description: "전체 사이트 설정 관리" },
  { key: "ads:manage",         label: "광고 관리",      description: "광고 배너·설정 관리" },
  { key: "admin:approve",      label: "관리자 승인",    description: "신규 관리자 계정 승인·반려" },
];

/** GET /admin/permissions 응답 타입 */
interface PermissionsApiResponse {
  matrix: Record<string, Record<string, boolean>>;
  roles: { key: string; name: string; locked: boolean }[];
  actions: string[];
}

/** 토스트 */
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 99999,
        background:
          type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff",
        borderRadius: 8,
        padding: "14px 24px",
        fontSize: 14,
        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 240,
        justifyContent: "center",
      }}
    >
      <i
        className={
          type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"
        }
      />
      {message}
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "#fff",
          cursor: "pointer",
          marginLeft: 8,
        }}
        aria-label="닫기"
      >
        <i className="ri-close-line" />
      </button>
    </div>
  );
}

export function PermissionsMatrix() {
  // 동적 역할 목록 (API에서 로드)
  const [roles, setRoles] = useState<{ key: string; name: string; locked: boolean }[]>([]);
  // 권한 매트릭스: { [roleKey]: { [action]: boolean } }
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // "roleKey:action" 저장 중
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // 권한 매트릭스 로드
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`${API_BASE}/api/v1/admin/permissions`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("권한 정보를 불러오지 못했습니다.");
        return res.json() as Promise<PermissionsApiResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setRoles(data.roles ?? []);
        setMatrix(data.matrix ?? {});
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "서버 오류";
        showToast(msg, "error");
        setMatrix({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  /** 역할 토글 핸들러 (super_admin 은 호출되지 않음) */
  async function handleToggle(roleKey: string, action: string, currentValue: boolean) {
    const savingKey = `${roleKey}:${action}`;
    setSaving(savingKey);
    const newValue = !currentValue;

    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/permissions`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roleKey, action, allowed: newValue }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ?? "저장에 실패했습니다.",
        );
      }

      // 낙관적 로컬 업데이트
      setMatrix((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [roleKey]: { ...(prev[roleKey] ?? {}), [action]: newValue },
        };
      });
      showToast(
        `'${action}' 권한이 ${newValue ? "허용" : "차단"}으로 변경되었습니다.`,
        "success",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "저장에 실패했습니다.";
      showToast(msg, "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      {/* 안내 */}
      <div className="alert alert-info" style={{ marginBottom: "16px" }}>
        <i className="ri-shield-keyhole-line" />
        <div>
          <strong>마스터(super_admin)</strong>는 모든 액션에 대한 권한을 항상 보유하며 변경할 수
          없습니다. 그 외 모든 역할(기본 역할·커스텀 역할)의 권한을 토글하여 DB에 저장할 수
          있습니다.
        </div>
      </div>

      <section className="section">
        <article className="card">
          {/* 권한 매트릭스 테이블 */}
          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
                <i
                  className="ri-loader-4-line"
                  style={{ fontSize: 24, display: "block", marginBottom: 8 }}
                />
                권한 정보를 불러오는 중...
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 200 }}>관리 액션</th>
                    <th style={{ fontSize: 12, color: "var(--gray-500)" }}>설명</th>
                    {roles.map((r) => (
                      <th key={r.key} style={{ width: 160, textAlign: "center" }}>
                        <span className={r.key === "super_admin" ? "badge badge-orange" : "badge badge-blue"}>
                          {r.name}
                        </span>
                        {r.key === "super_admin" && (
                          <div style={{ fontSize: 11, color: "var(--gray-400)", marginTop: 4 }}>
                            읽기 전용
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ADMIN_ACTIONS.map((action) => (
                    <tr key={action.key}>
                      <td>
                        <code
                          style={{
                            fontSize: 12,
                            color: "var(--gray-600)",
                            background: "var(--gray-100)",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {action.key}
                        </code>
                        <span style={{ marginLeft: 8, fontWeight: 500 }}>{action.label}</span>
                      </td>
                      <td style={{ fontSize: 13, color: "var(--gray-500)" }}>{action.description}</td>

                      {roles.map((r) => {
                        const isSuperAdmin = r.key === "super_admin";
                        const checked = isSuperAdmin
                          ? true
                          : (matrix?.[r.key]?.[action.key] ?? false);
                        const savingKey = `${r.key}:${action.key}`;

                        return (
                          <td key={r.key} style={{ textAlign: "center" }}>
                            <label
                              className="switch"
                              aria-label={`${action.label} — ${r.name}`}
                              title={
                                isSuperAdmin
                                  ? "읽기 전용 (마스터는 항상 전체 허용)"
                                  : saving === savingKey
                                  ? "저장 중..."
                                  : "클릭하여 토글"
                              }
                              style={{ cursor: isSuperAdmin || saving ? "default" : "pointer" }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isSuperAdmin || saving !== null}
                                readOnly={isSuperAdmin}
                                onChange={
                                  isSuperAdmin
                                    ? undefined
                                    : () => void handleToggle(r.key, action.key, checked)
                                }
                              />
                              <span className="switch-track" />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div
            style={{
              padding: "16px 18px",
              borderTop: "1px solid var(--gray-200)",
              fontSize: 13,
              color: "var(--gray-500)",
            }}
          >
            <i className="ri-information-line" style={{ marginRight: 6 }} />
            커스텀 역할의 권한은 여기서 수정할 수 있습니다. 마스터(super_admin)는 항상 전체 허용입니다.
          </div>
        </article>
      </section>

      {/* 토스트 — 화면 중앙 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

// adminPermissions.ts 의 ALL_ADMIN_ACTIONS 재노출 (외부 참조 호환 유지)
export { ALL_ADMIN_ACTIONS } from "@/lib/adminPermissions";

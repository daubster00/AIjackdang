"use client";

/**
 * 관리자 역할 CRUD 클라이언트 컴포넌트.
 *
 * - GET  /api/v1/admin/roles          역할 목록 조회
 * - POST /api/v1/admin/roles          역할 추가
 * - PATCH /api/v1/admin/roles/:key   역할 수정 (name·description)
 * - DELETE /api/v1/admin/roles/:key  역할 삭제 (locked=false 만)
 *
 * 확인/알림은 모두 공용 confirmDialog / notifyDialog 사용.
 */

import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/lib/api";
import { confirmDialog, notifyDialog } from "@/lib/dialog";

interface Role {
  key: string;
  name: string;
  description: string | null;
  locked: boolean;
  memberCount: number;
}

interface FormState {
  mode: "add" | "edit";
  editTarget?: Role;
  key: string;
  name: string;
  description: string;
  loading: boolean;
  error: string;
}

export function RolesManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  // ── 목록 조회 ────────────────────────────────────────────────────────────────

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/roles`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } }).error?.message ?? "역할 목록을 불러오지 못했습니다.",
        );
      }
      const data = await res.json() as { roles: Role[] };
      setRoles(data.roles ?? []);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  // ── 모달 열기/닫기 ───────────────────────────────────────────────────────────

  function openAdd() {
    setForm({ mode: "add", key: "", name: "", description: "", loading: false, error: "" });
  }

  function openEdit(role: Role) {
    setForm({
      mode: "edit",
      editTarget: role,
      key: role.key,
      name: role.name,
      description: role.description ?? "",
      loading: false,
      error: "",
    });
  }

  function closeForm() {
    if (form?.loading) return;
    setForm(null);
  }

  // ── 저장 (추가/수정) ─────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!form) return;
    setForm((prev) => (prev ? { ...prev, loading: true, error: "" } : prev));

    try {
      let res: Response;
      if (form.mode === "add") {
        res = await fetch(`${API_BASE_URL}/api/v1/admin/roles`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: form.key.trim(), name: form.name.trim(), description: form.description.trim() }),
        });
      } else {
        res = await fetch(`${API_BASE_URL}/api/v1/admin/roles/${form.editTarget!.key}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: { message?: string } }).error?.message ?? "요청에 실패했습니다.",
        );
      }

      setForm(null);
      void notifyDialog(form.mode === "add" ? "역할이 추가되었습니다." : "역할이 수정되었습니다.");
      void fetchRoles();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "오류가 발생했습니다.";
      setForm((prev) => (prev ? { ...prev, loading: false, error: msg } : prev));
    }
  }

  // ── 삭제 ─────────────────────────────────────────────────────────────────────

  async function handleDelete(role: Role) {
    const ok = await confirmDialog({
      title: "역할 삭제",
      message: `'${role.name}' 역할을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      confirmText: "삭제",
      tone: "danger",
    });
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/roles/${role.key}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: { message?: string } }).error?.message ?? "삭제에 실패했습니다.",
        );
      }
      void notifyDialog("역할이 삭제되었습니다.");
      void fetchRoles();
    } catch (err: unknown) {
      void notifyDialog(err instanceof Error ? err.message : "삭제에 실패했습니다.", "danger");
    }
  }

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  const isAddMode = form?.mode === "add";
  const canSubmit =
    form != null &&
    form.name.trim() !== "" &&
    (form.mode === "edit" || form.key.trim() !== "") &&
    !form.loading;

  return (
    <>
      <section className="section">
        <div className="section-heading">
          <h2 className="section-title">역할 목록</h2>
          <button className="btn btn-primary btn-sm" type="button" onClick={openAdd}>
            <i className="ri-add-line" />
            역할 추가
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--gray-400)" }}>
            불러오는 중…
          </div>
        ) : fetchError ? (
          <div className="alert alert-danger">
            <i className="ri-error-warning-line" />
            <div>{fetchError}</div>
          </div>
        ) : roles.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--gray-400)" }}>
            역할이 없습니다.
          </div>
        ) : (
          <div className="component-stack">
            {roles.map((role) => (
              <article className="card" key={role.key}>
                <div
                  className="card-body"
                  style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span className={`badge ${role.locked ? "badge-orange" : "badge-blue"}`}>
                        {role.name}
                      </span>
                      {role.locked ? (
                        <span className="badge badge-gray" style={{ fontSize: 11 }}>
                          <i className="ri-lock-line" style={{ marginRight: 2 }} />
                          기본 역할
                        </span>
                      ) : (
                        <span className="badge badge-teal" style={{ fontSize: 11 }}>
                          커스텀 역할
                        </span>
                      )}
                      <code
                        style={{
                          fontSize: 12,
                          color: "var(--gray-500)",
                          background: "var(--gray-100)",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {role.key}
                      </code>
                      <span style={{ fontSize: 12, color: "var(--gray-500)" }}>
                        사용 중: {role.memberCount}명
                      </span>
                    </div>
                    {role.description && (
                      <p style={{ fontSize: 14, color: "var(--gray-600)", margin: 0 }}>
                        {role.description}
                      </p>
                    )}
                  </div>

                  {/* locked=false 역할만 수정·삭제 노출 */}
                  {!role.locked && (
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openEdit(role)}
                      >
                        <i className="ri-edit-line" />
                        수정
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleDelete(role)}
                      >
                        <i className="ri-delete-bin-line" />
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ===== 추가 / 수정 모달 ===== */}
      {form && (
        <>
          <div
            className="overlay open"
            onClick={closeForm}
          />
          <section
            className="modal open"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div className="modal-title">
                {isAddMode ? "관리자 역할 추가" : "관리자 역할 수정"}
              </div>
              <button
                className="icon-button"
                aria-label="닫기"
                type="button"
                onClick={closeForm}
              >
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="modal-body">
              <div className="component-stack">
                {/* 추가 모드에서만 key 입력 */}
                {isAddMode && (
                  <div className="field">
                    <label className="field-label" htmlFor="roleKey">
                      역할 키(key){" "}
                      <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <input
                      id="roleKey"
                      className="control"
                      type="text"
                      placeholder="예: content_manager"
                      value={form.key}
                      onChange={(e) =>
                        setForm((prev) => (prev ? { ...prev, key: e.target.value } : prev))
                      }
                    />
                    <p style={{ fontSize: 12, color: "var(--gray-500)", marginTop: 4, marginBottom: 0 }}>
                      2~40자, 영문 소문자로 시작. 영문 소문자·숫자·밑줄(_)만 허용.
                      생성 후 변경 불가.
                    </p>
                  </div>
                )}

                <div className="field">
                  <label className="field-label" htmlFor="roleName">
                    역할 이름{" "}
                    <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    id="roleName"
                    className="control"
                    type="text"
                    placeholder="예: 콘텐츠 관리자"
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                    }
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="roleDescription">
                    설명
                  </label>
                  <textarea
                    id="roleDescription"
                    className="control"
                    placeholder="이 역할의 용도를 간단히 설명하세요."
                    value={form.description}
                    rows={3}
                    onChange={(e) =>
                      setForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                    }
                  />
                </div>

                {form.error && (
                  <div className="alert alert-danger">
                    <i className="ri-error-warning-line" />
                    <div>{form.error}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-outline"
                type="button"
                onClick={closeForm}
                disabled={form.loading}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
              >
                {form.loading ? "저장 중…" : isAddMode ? "추가하기" : "저장하기"}
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}

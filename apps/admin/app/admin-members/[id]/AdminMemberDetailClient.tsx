"use client";

/**
 * 관리회원 상세 클라이언트 컴포넌트 (Story 9.4).
 *
 * - GET /api/v1/admin/admin-members/:id  — 실데이터 단건 조회
 * - GET /api/v1/admin/roles              — 커스텀 역할 옵션 동적 로드
 * - 등급 변경 모달: roleOptions 기반 라디오 버튼 (overlay.js 미사용, React controlled)
 * - 정지 / 재활성 모달
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { notifyDialog } from "@/lib/dialog";
import { UserAvatar } from "@/components/ui/UserAvatar";

// ── 배지 매핑 (기본 역할 폴백; 커스텀 역할은 API 로드 name 사용) ──────────────

const ROLE_BADGE: Record<string, string> = {
  staff: "badge-blue",
  super_admin: "badge-orange",
};
const ROLE_LABEL_FALLBACK: Record<string, string> = {
  staff: "운영자",
  super_admin: "마스터",
};
const STATUS_BADGE: Record<string, string> = {
  active: "badge-green",
  pending: "badge-orange",
  suspended: "badge-red",
  disabled: "badge-gray",
};
const STATUS_LABEL: Record<string, string> = {
  active: "활성",
  pending: "승인대기",
  suspended: "정지",
  disabled: "비활성",
};

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface RoleOption {
  key: string;
  name: string;
}

interface AdminMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

type ModalType = "role" | "suspend" | "activate" | null;

interface ModalState {
  type: ModalType;
  note: string;
  role: string; // 역할 변경 모달에서 선택한 역할 key
  loading: boolean;
  error: string;
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function AdminMemberDetailClient({ memberId }: { memberId: string }) {
  // 관리회원(adminMember) 단건 데이터
  const [member, setMember] = useState<AdminMember | null>(null);
  const [memberLoading, setMemberLoading] = useState(true);
  const [memberError, setMemberError] = useState<string | null>(null);

  // 역할 옵션 (roleOptions) — API에서 동적 로드, 실패 시 기본값 유지
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([
    { key: "staff", name: "운영자" },
    { key: "super_admin", name: "마스터" },
  ]);

  // 모달 상태
  const [modal, setModal] = useState<ModalState>({
    type: null,
    note: "",
    role: "staff",
    loading: false,
    error: "",
  });

  const overlayRef = useRef<HTMLDivElement>(null);

  // ── 역할 목록 조회 (모달 라디오 버튼 구성용) ──────────────────────────────
  // 마운트 시 + 역할 변경 모달을 열 때마다 재조회한다. (다른 페이지에서 커스텀 역할을
  // 추가한 뒤 상세 페이지를 새로고침하지 않아도 최신 역할이 모달에 반영되도록 함)

  const loadRoles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/roles`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as { roles?: RoleOption[] };
      if (data.roles && data.roles.length > 0) {
        setRoleOptions(data.roles);
      }
    } catch {
      // 실패 시 기본값(staff/super_admin) 유지
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  // ── 관리회원 단건 조회 ────────────────────────────────────────────────────

  const fetchMember = useCallback(async () => {
    setMemberLoading(true);
    setMemberError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/admin-members/${memberId}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } })?.error?.message ??
            "관리자 정보를 불러오지 못했습니다.",
        );
      }
      const data = (await res.json()) as AdminMember;
      setMember(data);
    } catch (err: unknown) {
      setMemberError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setMemberLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void fetchMember();
  }, [fetchMember]);

  // ── 역할 key → 표시 이름 변환 ─────────────────────────────────────────────

  function getRoleName(key: string): string {
    const found = roleOptions.find((r) => r.key === key);
    return found?.name ?? ROLE_LABEL_FALLBACK[key] ?? key;
  }

  // ── 모달 열기/닫기 ────────────────────────────────────────────────────────

  function openModal(type: ModalType) {
    const initialRole = member?.role ?? roleOptions[0]?.key ?? "staff";
    setModal({ type, note: "", role: initialRole, loading: false, error: "" });
    // 역할 변경 모달은 열 때마다 최신 역할 목록을 재조회한다.
    if (type === "role") void loadRoles();
  }

  function closeModal() {
    if (modal.loading) return;
    setModal({
      type: null,
      note: "",
      role: roleOptions[0]?.key ?? "staff",
      loading: false,
      error: "",
    });
  }

  // ── 모달 확인 (PATCH API 호출) ────────────────────────────────────────────

  async function handleModalConfirm() {
    if (!modal.type) return;
    // 클로저 안전을 위해 현재 type·memberName 을 미리 캡처
    const currentType = modal.type;
    const memberName = member?.name ?? "";

    let url = `${API_BASE_URL}/api/v1/admin/admin-members/${memberId}`;
    let body: Record<string, string> = { note: modal.note };

    switch (currentType) {
      case "role":
        url += "/role";
        body = { role: modal.role, note: modal.note };
        break;
      case "suspend":
        url += "/suspend";
        break;
      case "activate":
        url += "/activate";
        break;
    }

    setModal((prev) => ({ ...prev, loading: true, error: "" }));

    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          (data as { error?: { message?: string } })?.error?.message ??
            "요청에 실패했습니다.",
        );
      }

      const actionLabel: Record<NonNullable<ModalType>, string> = {
        role: "역할 변경",
        suspend: "정지",
        activate: "재활성화",
      };

      closeModal();
      void notifyDialog(
        `${actionLabel[currentType]} 완료: ${memberName} 계정이 처리되었습니다.`,
      );
      void fetchMember(); // 프로필 카드 갱신
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "오류가 발생했습니다.";
      setModal((prev) => ({ ...prev, loading: false, error: msg }));
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  const isModalOpen = modal.type !== null;
  // 사유(note) 미입력이거나 API 호출 중이면 확인 버튼 비활성
  const confirmDisabled = modal.note.trim() === "" || modal.loading;

  // 로딩 중
  if (memberLoading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--gray-400)" }}>
        불러오는 중…
      </div>
    );
  }

  // 오류 또는 미조회
  if (memberError || !member) {
    return (
      <div className="alert alert-danger" style={{ margin: "16px" }}>
        <i className="ri-error-warning-line" />
        <div>{memberError ?? "관리자 정보를 찾을 수 없습니다."}</div>
      </div>
    );
  }

  return (
    <>
      {/* ── 페이지 헤더 ── */}
      <div className="page-header">
        <div>
          <Link className="btn btn-outline btn-sm" href="/admin-members">
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
        </div>
        <div className="page-actions">
          {/* 활성 상태일 때: 등급 변경 + 정지 처리 */}
          {member.status === "active" && (
            <>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => openModal("role")}
              >
                <i className="ri-shield-line" />
                등급 변경
              </button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => openModal("suspend")}
              >
                <i className="ri-user-forbid-line" />
                정지 처리
              </button>
            </>
          )}
          {/* 정지 상태일 때: 재활성 */}
          {member.status === "suspended" && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => openModal("activate")}
            >
              <i className="ri-user-follow-line" />
              재활성
            </button>
          )}
        </div>
      </div>

      {/* ── 본문 그리드 ── */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "320px 1fr", gap: "24px" }}
      >
        {/* 왼쪽: 프로필 카드 */}
        <aside>
          <article className="card">
            <div className="card-body">
              <div
                className="component-stack"
                style={{ alignItems: "center", textAlign: "center" }}
              >
                <UserAvatar
                  size={72}
                  alt={member.name}
                  defaultAvatarIndex={0}
                  style={{ margin: "0 auto" }}
                />
                <div>
                  <h2 className="section-title" style={{ marginBottom: 4 }}>
                    {member.name}
                  </h2>
                  <p style={{ color: "var(--gray-500)", fontSize: 14 }}>
                    {member.email}
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    className={`badge ${ROLE_BADGE[member.role] ?? "badge-gray"}`}
                  >
                    {getRoleName(member.role)}
                  </span>
                  <span
                    className={`badge ${STATUS_BADGE[member.status] ?? "badge-gray"}`}
                  >
                    {STATUS_LABEL[member.status] ?? member.status}
                  </span>
                </div>
              </div>

              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid var(--gray-200)",
                  margin: "12px 0",
                }}
              />

              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "8px 16px",
                  fontSize: 14,
                }}
              >
                <dt style={{ color: "var(--gray-500)" }}>이메일</dt>
                <dd>{member.email}</dd>
                {member.phone && (
                  <>
                    <dt style={{ color: "var(--gray-500)" }}>연락처</dt>
                    <dd>{member.phone}</dd>
                  </>
                )}
                <dt style={{ color: "var(--gray-500)" }}>가입일</dt>
                <dd>{new Date(member.createdAt).toLocaleDateString("ko-KR")}</dd>
                {member.approvedAt && (
                  <>
                    <dt style={{ color: "var(--gray-500)" }}>승인일</dt>
                    <dd>
                      {new Date(member.approvedAt).toLocaleDateString("ko-KR")}
                    </dd>
                  </>
                )}
                {member.approvedBy && (
                  <>
                    <dt style={{ color: "var(--gray-500)" }}>승인자</dt>
                    <dd>{member.approvedBy}</dd>
                  </>
                )}
              </dl>

              {member.note && (
                <>
                  <hr
                    style={{
                      border: "none",
                      borderTop: "1px solid var(--gray-200)",
                      margin: "12px 0",
                    }}
                  />
                  <div>
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--gray-500)",
                        marginBottom: 4,
                      }}
                    >
                      메모
                    </p>
                    <p style={{ fontSize: 14 }}>{member.note}</p>
                  </div>
                </>
              )}
            </div>
          </article>
        </aside>

        {/* 오른쪽: 처리 이력 — 현재 미구현, 플레이스홀더 */}
        <div className="component-stack">
          <article className="card">
            <div className="card-body">
              <p style={{ color: "var(--gray-400)", fontSize: 14 }}>
                처리 이력은 별도 기능으로 제공 예정입니다.
              </p>
            </div>
          </article>
        </div>
      </div>

      {/* ===== 모달 영역 ===== */}
      {isModalOpen && (
        <>
          {/* 오버레이 — React controlled (overlay.js 미사용) */}
          <div
            ref={overlayRef}
            className="overlay open"
            onClick={closeModal}
          />

          {/* 모달 공통 래퍼 — .open 없으면 opacity:0/pointer-events:none 로 숨겨짐(디자인시스템 overlay.css) */}
          <section
            className="modal open"
            role="dialog"
            aria-modal="true"
            style={{ background: "var(--gray-0, #fff)" }}
          >
            {/* ── 역할 변경 모달 ── */}
            {modal.type === "role" && (
              <>
                <div className="modal-header">
                  <div className="modal-title">역할 변경</div>
                  <button
                    className="icon-button"
                    aria-label="닫기"
                    type="button"
                    onClick={closeModal}
                  >
                    <i className="ri-close-line" />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="component-stack">
                    <div className="alert alert-info">
                      <i className="ri-information-line" />
                      <div>
                        <strong>{member.name}</strong> ({member.email})의 역할을
                        변경합니다. 변경 즉시 해당 관리자의 모든 세션이 만료되고
                        재로그인이 필요합니다.
                      </div>
                    </div>
                    <div className="field">
                      <span className="field-label">새 역할</span>
                      {/* roleOptions 기반 동적 라디오 버튼 — 커스텀 역할 포함 */}
                      <div className="choice-row">
                        {roleOptions.map((r) => (
                          <label key={r.key} className="choice">
                            <input
                              type="radio"
                              name="roleChange"
                              value={r.key}
                              checked={modal.role === r.key}
                              onChange={() =>
                                setModal((p) => ({ ...p, role: r.key }))
                              }
                            />
                            {r.name} ({r.key})
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="roleNote">
                        변경 사유{" "}
                        <span style={{ color: "var(--danger)" }}>*</span>
                      </label>
                      <textarea
                        className="control"
                        id="roleNote"
                        placeholder="역할 변경 사유를 입력하세요 (필수)"
                        value={modal.note}
                        onChange={(e) =>
                          setModal((p) => ({ ...p, note: e.target.value }))
                        }
                        rows={3}
                      />
                    </div>
                    {modal.error && (
                      <div className="alert alert-danger">
                        <i className="ri-error-warning-line" />
                        <div>{modal.error}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={closeModal}
                    disabled={modal.loading}
                  >
                    취소
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => void handleModalConfirm()}
                    disabled={confirmDisabled}
                  >
                    <i className="ri-shield-line" />
                    {modal.loading ? "처리 중…" : "역할 변경"}
                  </button>
                </div>
              </>
            )}

            {/* ── 정지 모달 ── */}
            {modal.type === "suspend" && (
              <>
                <div className="modal-header">
                  <div className="modal-title">관리자 계정 정지</div>
                  <button
                    className="icon-button"
                    aria-label="닫기"
                    type="button"
                    onClick={closeModal}
                  >
                    <i className="ri-close-line" />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="component-stack">
                    <div className="alert alert-danger">
                      <i className="ri-alarm-warning-line" />
                      <div>
                        <strong>{member.name}</strong> ({member.email})을
                        정지합니다. 정지 즉시 해당 관리자의 모든 세션이 만료되고
                        접근이 차단됩니다.
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="suspendNote">
                        정지 사유{" "}
                        <span style={{ color: "var(--danger)" }}>*</span>
                      </label>
                      <textarea
                        className="control"
                        id="suspendNote"
                        placeholder="정지 사유를 입력하세요 (필수)"
                        value={modal.note}
                        onChange={(e) =>
                          setModal((p) => ({ ...p, note: e.target.value }))
                        }
                        rows={3}
                      />
                    </div>
                    {modal.error && (
                      <div className="alert alert-danger">
                        <i className="ri-error-warning-line" />
                        <div>{modal.error}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={closeModal}
                    disabled={modal.loading}
                  >
                    취소
                  </button>
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={() => void handleModalConfirm()}
                    disabled={confirmDisabled}
                  >
                    <i className="ri-user-forbid-line" />
                    {modal.loading ? "처리 중…" : "정지하기"}
                  </button>
                </div>
              </>
            )}

            {/* ── 재활성 모달 ── */}
            {modal.type === "activate" && (
              <>
                <div className="modal-header">
                  <div className="modal-title">계정 재활성화</div>
                  <button
                    className="icon-button"
                    aria-label="닫기"
                    type="button"
                    onClick={closeModal}
                  >
                    <i className="ri-close-line" />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="component-stack">
                    <div className="alert alert-info">
                      <i className="ri-information-line" />
                      <div>
                        <strong>{member.name}</strong> ({member.email})을
                        재활성화합니다. 재활성 후 해당 관리자는 정상적으로 접근할
                        수 있습니다.
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="activateNote">
                        재활성 사유{" "}
                        <span style={{ color: "var(--danger)" }}>*</span>
                      </label>
                      <textarea
                        className="control"
                        id="activateNote"
                        placeholder="재활성 사유를 입력하세요 (필수)"
                        value={modal.note}
                        onChange={(e) =>
                          setModal((p) => ({ ...p, note: e.target.value }))
                        }
                        rows={3}
                      />
                    </div>
                    {modal.error && (
                      <div className="alert alert-danger">
                        <i className="ri-error-warning-line" />
                        <div>{modal.error}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={closeModal}
                    disabled={modal.loading}
                  >
                    취소
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => void handleModalConfirm()}
                    disabled={confirmDisabled}
                  >
                    <i className="ri-user-follow-line" />
                    {modal.loading ? "처리 중…" : "재활성화"}
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}

"use client";

/**
 * 관리회원 목록 클라이언트 컴포넌트 (Story 9.4).
 *
 * - GET /api/v1/admin/admin-members 실제 API 연동
 * - 상태 필터·검색·URL 파라미터·페이지네이션
 * - 승인/반려/정지/재활성/역할변경 모달
 * - 성공 토스트 + 목록 갱신
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { notifyDialog } from "@/lib/dialog";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RowActionMenu, type RowActionItem } from "@/components/ui/RowActionMenu";
import type { AdminSessionUser } from "@/lib/adminSession";
import type { AdminMemberItem } from "@ai-jakdang/contracts";

// ── 배지 매핑 (기본 역할 폴백; 커스텀 역할은 API에서 불러온 name 사용) ────────

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

interface Meta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

type ModalType = "approve" | "reject" | "suspend" | "activate" | "role" | null;

interface ModalState {
  type: ModalType;
  target: AdminMemberItem | null;
  note: string;
  role: string; // 동적 역할 key (staff, super_admin, 커스텀 역할 등)
  loading: boolean;
  error: string;
}

interface RoleOption {
  key: string;
  name: string;
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function AdminMembersClient({ adminUser }: { adminUser: AdminSessionUser | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 파라미터
  const pageParam = Number(searchParams.get("page") ?? "1");
  const statusParam = searchParams.get("status") ?? "";
  const qParam = searchParams.get("q") ?? "";

  // 역할 옵션 (API에서 동적 로드)
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([
    { key: "staff", name: "운영자" },
    { key: "super_admin", name: "마스터" },
  ]);

  // 목록 상태
  const [items, setItems] = useState<AdminMemberItem[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 필터 상태(로컬, 아직 미제출)
  const [searchInput, setSearchInput] = useState(qParam);
  const [statusFilter, setStatusFilter] = useState(statusParam);

  // 모달 상태
  const [modal, setModal] = useState<ModalState>({
    type: null,
    target: null,
    note: "",
    role: "staff",
    loading: false,
    error: "",
  });

  const overlayRef = useRef<HTMLDivElement>(null);

  // ── 역할 목록 조회 (모달 드롭다운용) ─────────────────────────────────────

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/roles`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: { roles?: RoleOption[] }) => {
        if (data.roles && data.roles.length > 0) {
          setRoleOptions(data.roles);
        }
      })
      .catch(() => {
        // 실패 시 기본값(staff/super_admin) 유지
      });
  }, []);

  /** 역할 key → 표시 이름 변환 */
  function getRoleName(key: string): string {
    const found = roleOptions.find((r) => r.key === key);
    return found?.name ?? ROLE_LABEL_FALLBACK[key] ?? key;
  }

  // ── 목록 조회 ─────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ page: String(pageParam), pageSize: "20" });
      if (statusParam) params.set("status", statusParam);
      if (qParam) params.set("q", qParam);

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/admin-members?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "목록 조회에 실패했습니다.");
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setMeta(data.meta);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [pageParam, statusParam, qParam]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  // ── URL 파라미터 업데이트 ──────────────────────────────────────────────────

  function pushParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    // 필터가 바뀌면 1페이지로 리셋
    next.set("page", "1");
    router.push(`/admin-members?${next.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    pushParams({ q: searchInput, status: statusFilter });
  }

  function handleStatusChange(s: string) {
    setStatusFilter(s);
    pushParams({ status: s, q: searchInput });
  }

  function handleReset() {
    setSearchInput("");
    setStatusFilter("");
    router.push("/admin-members");
  }

  function handlePageChange(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/admin-members?${next.toString()}`);
  }

  // ── 모달 열기/닫기 ────────────────────────────────────────────────────────

  function openModal(type: ModalType, target: AdminMemberItem) {
    // approve 모달은 첫 번째 역할로 초기화, 그 외는 대상의 현재 역할
    const initialRole =
      type === "approve" ? (roleOptions[0]?.key ?? "staff") : target.role;
    setModal({ type, target, note: "", role: initialRole, loading: false, error: "" });
  }

  function closeModal() {
    if (modal.loading) return;
    setModal({
      type: null,
      target: null,
      note: "",
      role: roleOptions[0]?.key ?? "staff",
      loading: false,
      error: "",
    });
  }

  // ── 모달 액션 (API 호출) ─────────────────────────────────────────────────

  async function handleModalConfirm() {
    if (!modal.target || !modal.type) return;
    const id = modal.target.id;

    let url = `${API_BASE_URL}/api/v1/admin/admin-members/${id}`;
    let body: Record<string, string> = { note: modal.note };

    switch (modal.type) {
      case "approve": url += "/approve"; body = { role: modal.role, note: modal.note }; break;
      case "reject":  url += "/reject";  break;
      case "suspend": url += "/suspend"; break;
      case "activate": url += "/activate"; break;
      case "role":    url += "/role";    body = { role: modal.role, note: modal.note }; break;
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
        throw new Error(data?.error?.message ?? "요청에 실패했습니다.");
      }

      // 성공
      const actionLabel: Record<NonNullable<ModalType>, string> = {
        approve: "승인",
        reject: "반려",
        suspend: "정지",
        activate: "재활성",
        role: "역할 변경",
      };
      closeModal();
      void notifyDialog(`${actionLabel[modal.type!]} 완료: ${modal.target.name} 계정이 처리되었습니다.`);
      void fetchList(); // 목록 갱신
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "오류가 발생했습니다.";
      setModal((prev) => ({ ...prev, loading: false, error: msg }));
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const totalInFilter = meta.totalItems;
  const isModalOpen = modal.type !== null;
  const confirmDisabled = modal.note.trim() === "" || modal.loading;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">관리회원 관리</h1>
          <p className="page-description">운영진(관리자 계정)의 등급·상태·권한을 확인하고 처리합니다.</p>
        </div>
      </div>

      {/* 필터/검색 섹션 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">관리회원 목록</h2>
            <p className="section-description">상태로 필터하고, 승인 대기 신청은 행 메뉴에서 승인·반려합니다.</p>
          </div>
        </div>

        <article className="card">
          {/* 빠른 상태 탭 */}
          <div className="line-tabs" role="tablist" aria-label="관리 상태">
            {[
              { key: "", label: "전체" },
              { key: "pending", label: "승인대기" },
              { key: "active", label: "활성" },
              { key: "suspended", label: "정지" },
              { key: "disabled", label: "비활성" },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`line-tab${statusFilter === tab.key ? " active" : ""}`}
                role="tab"
                aria-selected={statusFilter === tab.key}
                onClick={() => handleStatusChange(tab.key)}
              >
                {tab.label}
                {tab.key === "pending" && pendingCount > 0 && (
                  <span className="badge badge-orange" style={{ marginLeft: 6 }}>{pendingCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* 검색 패널 */}
          <form className="filter-panel" onSubmit={handleSearch}>
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input
                  className="control"
                  type="search"
                  placeholder="이름 또는 이메일 검색"
                  aria-label="관리회원 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="filter-actions">
                <button className="btn btn-outline" type="button" onClick={handleReset}>
                  <i className="ri-refresh-line" />초기화
                </button>
                <button className="btn btn-primary" type="submit">
                  <i className="ri-search-line" />검색
                </button>
              </div>
            </div>
          </form>

          {/* 툴바 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">
                총 {meta.totalItems}명
                {pendingCount > 0 && ` · 승인 대기 ${pendingCount}명`}
              </span>
            </div>
          </div>

          {/* 테이블 */}
          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--gray-400)" }}>
                불러오는 중…
              </div>
            ) : fetchError ? (
              <div className="alert alert-danger" style={{ margin: "16px" }}>
                <i className="ri-error-warning-line" />
                <div>{fetchError}</div>
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--gray-400)" }}>
                관리회원이 없습니다.
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>이메일</th>
                    <th>연락처</th>
                    <th>역할</th>
                    <th>상태</th>
                    <th>가입일</th>
                    <th>승인일</th>
                    <th>승인자</th>
                    <th style={{ width: "60px" }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => {
                    const isSelf = adminUser?.id === m.id;
                    return (
                      <tr key={m.id}>
                        <td>
                          <Link className="author" href={`/admin-members/${m.id}`}>
                            <UserAvatar size={28} alt={m.name} defaultAvatarIndex={0} />
                            <span>{m.name}</span>
                          </Link>
                        </td>
                        <td>{m.email}</td>
                        <td>{m.phone || "—"}</td>
                        <td>
                          <span className={`badge ${ROLE_BADGE[m.role] ?? "badge-gray"}`}>
                            {getRoleName(m.role)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[m.status] ?? "badge-gray"}`}>
                            {STATUS_LABEL[m.status] ?? m.status}
                          </span>
                        </td>
                        <td className="num">{new Date(m.createdAt).toLocaleDateString("ko-KR")}</td>
                        <td className="num">
                          {m.approvedAt ? new Date(m.approvedAt).toLocaleDateString("ko-KR") : "—"}
                        </td>
                        <td>{m.approvedBy ?? "—"}</td>
                        <td>
                          <RowActionMenu
                            ariaLabel="관리회원 메뉴"
                            items={[
                              { label: "상세보기", icon: "ri-eye-line", href: `/admin-members/${m.id}` },
                              ...(m.status === "pending"
                                ? [
                                    {
                                      label: "승인 처리",
                                      icon: "ri-checkbox-circle-line",
                                      onClick: () => openModal("approve", m),
                                    },
                                    {
                                      label: "반려",
                                      icon: "ri-close-circle-line",
                                      danger: true,
                                      onClick: () => openModal("reject", m),
                                    },
                                  ]
                                : []),
                              ...(m.status === "active"
                                ? [
                                    ...(!isSelf
                                      ? [
                                          {
                                            label: "역할 변경",
                                            icon: "ri-shield-line",
                                            onClick: () => openModal("role", m),
                                          },
                                        ]
                                      : []),
                                    {
                                      label: "정지",
                                      icon: "ri-user-forbid-line",
                                      danger: true,
                                      onClick: () => openModal("suspend", m),
                                    },
                                  ]
                                : []),
                              ...(m.status === "suspended"
                                ? [
                                    {
                                      label: "재활성",
                                      icon: "ri-user-follow-line",
                                      onClick: () => openModal("activate", m),
                                    },
                                  ]
                                : []),
                            ] satisfies RowActionItem[]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 페이지네이션 */}
          {meta.totalPages > 1 && (
            <div className="pagination">
              <div className="page-info">
                {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.totalItems)} / 총 {totalInFilter}명
              </div>
              <div className="page-buttons">
                <button
                  className="page-button"
                  aria-label="이전 페이지"
                  disabled={meta.page <= 1}
                  onClick={() => handlePageChange(meta.page - 1)}
                >
                  <i className="ri-arrow-left-s-line" />
                </button>
                {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`page-button${p === meta.page ? " active" : ""}`}
                    onClick={() => handlePageChange(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="page-button"
                  aria-label="다음 페이지"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => handlePageChange(meta.page + 1)}
                >
                  <i className="ri-arrow-right-s-line" />
                </button>
              </div>
            </div>
          )}
        </article>
      </section>

      {/* ===== 모달 영역 ===== */}
      {isModalOpen && (
        <>
          {/* 오버레이 */}
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
            {/* ── 승인 모달 ── */}
            {modal.type === "approve" && (
              <>
                <div className="modal-header">
                  <div className="modal-title">관리회원 승인 처리</div>
                  <button className="icon-button" aria-label="닫기" onClick={closeModal}><i className="ri-close-line" /></button>
                </div>
                <div className="modal-body">
                  <div className="component-stack">
                    <div className="alert alert-info">
                      <i className="ri-information-line" />
                      <div>
                        <strong>{modal.target?.name}</strong> ({modal.target?.email})을 승인합니다.
                        승인 시 관리자 권한이 즉시 활성화됩니다.
                      </div>
                    </div>
                    <div className="field">
                      <span className="field-label">부여할 역할</span>
                      <div className="choice-row">
                        {roleOptions.map((r) => (
                          <label key={r.key} className="choice">
                            <input
                              type="radio"
                              name="approveRole"
                              value={r.key}
                              checked={modal.role === r.key}
                              onChange={() => setModal((p) => ({ ...p, role: r.key }))}
                            />
                            {r.name} ({r.key})
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="approveNote">
                        승인 사유 <span style={{ color: "var(--danger)" }}>*</span>
                      </label>
                      <textarea
                        className="control"
                        id="approveNote"
                        placeholder="승인 사유를 입력하세요 (필수)"
                        value={modal.note}
                        onChange={(e) => setModal((p) => ({ ...p, note: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    {modal.error && <div className="alert alert-danger"><i className="ri-error-warning-line" /><div>{modal.error}</div></div>}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={closeModal} disabled={modal.loading}>취소</button>
                  <button className="btn btn-primary" onClick={handleModalConfirm} disabled={confirmDisabled}>
                    <i className="ri-checkbox-circle-line" />
                    {modal.loading ? "처리 중…" : "승인하기"}
                  </button>
                </div>
              </>
            )}

            {/* ── 반려 모달 ── */}
            {modal.type === "reject" && (
              <>
                <div className="modal-header">
                  <div className="modal-title">승인 신청 반려</div>
                  <button className="icon-button" aria-label="닫기" onClick={closeModal}><i className="ri-close-line" /></button>
                </div>
                <div className="modal-body">
                  <div className="component-stack">
                    <div className="alert alert-danger">
                      <i className="ri-alarm-warning-line" />
                      <div>
                        <strong>{modal.target?.name}</strong> ({modal.target?.email})의 신청을 반려합니다.
                        반려 시 해당 계정은 로그인할 수 없게 됩니다.
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="rejectNote">
                        반려 사유 <span style={{ color: "var(--danger)" }}>*</span>
                      </label>
                      <textarea
                        className="control"
                        id="rejectNote"
                        placeholder="반려 사유를 입력하세요 (필수)"
                        value={modal.note}
                        onChange={(e) => setModal((p) => ({ ...p, note: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    {modal.error && <div className="alert alert-danger"><i className="ri-error-warning-line" /><div>{modal.error}</div></div>}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={closeModal} disabled={modal.loading}>취소</button>
                  <button className="btn btn-danger" onClick={handleModalConfirm} disabled={confirmDisabled}>
                    <i className="ri-close-circle-line" />
                    {modal.loading ? "처리 중…" : "반려하기"}
                  </button>
                </div>
              </>
            )}

            {/* ── 정지 모달 ── */}
            {modal.type === "suspend" && (
              <>
                <div className="modal-header">
                  <div className="modal-title">관리자 계정 정지</div>
                  <button className="icon-button" aria-label="닫기" onClick={closeModal}><i className="ri-close-line" /></button>
                </div>
                <div className="modal-body">
                  <div className="component-stack">
                    <div className="alert alert-danger">
                      <i className="ri-alarm-warning-line" />
                      <div>
                        <strong>{modal.target?.name}</strong> ({modal.target?.email})을 정지합니다.
                        정지 즉시 해당 관리자의 모든 세션이 만료되고 접근이 차단됩니다.
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="suspendNote">
                        정지 사유 <span style={{ color: "var(--danger)" }}>*</span>
                      </label>
                      <textarea
                        className="control"
                        id="suspendNote"
                        placeholder="정지 사유를 입력하세요 (필수)"
                        value={modal.note}
                        onChange={(e) => setModal((p) => ({ ...p, note: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    {modal.error && <div className="alert alert-danger"><i className="ri-error-warning-line" /><div>{modal.error}</div></div>}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={closeModal} disabled={modal.loading}>취소</button>
                  <button className="btn btn-danger" onClick={handleModalConfirm} disabled={confirmDisabled}>
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
                  <button className="icon-button" aria-label="닫기" onClick={closeModal}><i className="ri-close-line" /></button>
                </div>
                <div className="modal-body">
                  <div className="component-stack">
                    <div className="alert alert-info">
                      <i className="ri-information-line" />
                      <div>
                        <strong>{modal.target?.name}</strong> ({modal.target?.email})을 재활성화합니다.
                        재활성 후 해당 관리자는 정상적으로 접근할 수 있습니다.
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="activateNote">
                        재활성 사유 <span style={{ color: "var(--danger)" }}>*</span>
                      </label>
                      <textarea
                        className="control"
                        id="activateNote"
                        placeholder="재활성 사유를 입력하세요 (필수)"
                        value={modal.note}
                        onChange={(e) => setModal((p) => ({ ...p, note: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    {modal.error && <div className="alert alert-danger"><i className="ri-error-warning-line" /><div>{modal.error}</div></div>}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={closeModal} disabled={modal.loading}>취소</button>
                  <button className="btn btn-primary" onClick={handleModalConfirm} disabled={confirmDisabled}>
                    <i className="ri-user-follow-line" />
                    {modal.loading ? "처리 중…" : "재활성화"}
                  </button>
                </div>
              </>
            )}

            {/* ── 역할 변경 모달 ── */}
            {modal.type === "role" && (
              <>
                <div className="modal-header">
                  <div className="modal-title">역할 변경</div>
                  <button className="icon-button" aria-label="닫기" onClick={closeModal}><i className="ri-close-line" /></button>
                </div>
                <div className="modal-body">
                  <div className="component-stack">
                    <div className="alert alert-info">
                      <i className="ri-information-line" />
                      <div>
                        <strong>{modal.target?.name}</strong> ({modal.target?.email})의 역할을 변경합니다.
                        변경 즉시 해당 관리자의 모든 세션이 만료되고 재로그인이 필요합니다.
                      </div>
                    </div>
                    <div className="field">
                      <span className="field-label">새 역할</span>
                      <div className="choice-row">
                        {roleOptions.map((r) => (
                          <label key={r.key} className="choice">
                            <input
                              type="radio"
                              name="roleChange"
                              value={r.key}
                              checked={modal.role === r.key}
                              onChange={() => setModal((p) => ({ ...p, role: r.key }))}
                            />
                            {r.name} ({r.key})
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="roleNote">
                        변경 사유 <span style={{ color: "var(--danger)" }}>*</span>
                      </label>
                      <textarea
                        className="control"
                        id="roleNote"
                        placeholder="역할 변경 사유를 입력하세요 (필수)"
                        value={modal.note}
                        onChange={(e) => setModal((p) => ({ ...p, note: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    {modal.error && <div className="alert alert-danger"><i className="ri-error-warning-line" /><div>{modal.error}</div></div>}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={closeModal} disabled={modal.loading}>취소</button>
                  <button className="btn btn-primary" onClick={handleModalConfirm} disabled={confirmDisabled}>
                    <i className="ri-shield-line" />
                    {modal.loading ? "처리 중…" : "역할 변경"}
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

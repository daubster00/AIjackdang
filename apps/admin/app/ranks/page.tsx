"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../lib/api";
import type { AdminGrade, AdminBadge } from "@ai-jakdang/contracts";

/**
 * 등급·뱃지 통합 관리 페이지 (Story 9.13).
 * GET /api/v1/admin/grades     — 등급 목록 (인라인 minPoints 편집)
 * GET /api/v1/admin/badges     — 뱃지 목록 (신규 추가, 비활성화 모달)
 */

// 등급 뱃지 이미지(로컬 정적 에셋). DB name 기반이 아닌 level 순서 기반.
const GRADE_BADGE_BY_LEVEL: Record<number, string> = {
  1: "/badges/rookie.png",
  2: "/badges/member.png",
  3: "/badges/practitioner.png",
  4: "/badges/expert.png",
  5: "/badges/master.png",
};

// ── 토스트 컴포넌트 ────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
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
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
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
      <i className={type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} />
      {message}
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8 }}
        aria-label="닫기"
      >
        <i className="ri-close-line" />
      </button>
    </div>
  );
}

// ── 등급 minPoints 인라인 편집 셀 ───────────────────────────────────────────

function InlineMinPointsCell({
  grade,
  onSaved,
  onError,
}: {
  grade: AdminGrade;
  onSaved: (id: string, minPoints: number) => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(grade.minPoints));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function save() {
    const num = parseInt(draft, 10);
    if (isNaN(num) || num < 0) {
      setDraft(String(grade.minPoints));
      setEditing(false);
      return;
    }
    if (num === grade.minPoints) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/grades/${grade.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minPoints: num }),
      });
      if (!res.ok) throw new Error();
      onSaved(grade.id, num);
    } catch {
      onError("등급 기준 저장에 실패했습니다.");
      setDraft(String(grade.minPoints));
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="input-icon" style={{ width: 140 }}>
        <i className="ri-medal-line" />
        <input
          ref={inputRef}
          className="control"
          type="number"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setDraft(String(grade.minPoints)); setEditing(false); }
          }}
          disabled={saving}
          aria-label={`${grade.name} 최소 포인트 입력`}
          style={{ width: "100%" }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(String(grade.minPoints)); setEditing(true); }}
      style={{
        background: "none",
        border: "1px dashed var(--border, #e2e8f0)",
        borderRadius: 6,
        padding: "4px 10px",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 600,
        color: "var(--primary-600, #2563eb)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 80,
      }}
      title="클릭하여 수정"
      aria-label={`${grade.name} 최소 포인트 수정 (현재: ${grade.minPoints})`}
    >
      <i className="ri-pencil-line" style={{ fontSize: 12, opacity: 0.6 }} />
      {grade.minPoints.toLocaleString()}
    </button>
  );
}

// ── 뱃지 신규 추가 모달 ───────────────────────────────────────────────────────

function AddBadgeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (badge: AdminBadge) => void;
}) {
  const [form, setForm] = useState({
    slug: "",
    name: "",
    description: "",
    condition: "",
    isAuto: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slug.trim() || !form.name.trim()) {
      setError("slug 와 이름은 필수입니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/badges`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug.trim(),
          name: form.name.trim(),
          description: form.description.trim(),
          condition: form.condition.trim() || null,
          isAuto: form.isAuto,
        }),
      });
      if (res.status === 409) { setError("동일한 slug 의 뱃지가 이미 존재합니다."); return; }
      if (!res.ok) throw new Error();
      const created = await res.json();
      onCreated(created);
    } catch {
      setError("뱃지 추가에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--surface)", borderRadius: 8, padding: 28,
          width: 460, boxShadow: "0 4px 24px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>새 뱃지 추가</h3>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <i className="ri-close-line" />
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16, fontSize: 13 }}>
            <i className="ri-error-warning-line" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="component-stack">
            <div className="field">
              <label className="field-label" htmlFor="badgeSlug">Slug (영문·숫자·하이픈, 고유값)</label>
              <input
                className="control"
                id="badgeSlug"
                type="text"
                placeholder="예: first-post"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="badgeName">이름</label>
              <input
                className="control"
                id="badgeName"
                type="text"
                placeholder="예: 첫 글 작성자"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="badgeDesc">설명</label>
              <textarea
                className="control"
                id="badgeDesc"
                placeholder="뱃지 설명을 입력하세요"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="badgeCond">수여 조건</label>
              <input
                className="control"
                id="badgeCond"
                type="text"
                placeholder="예: 첫 번째 게시글 작성 시 자동 수여"
                value={form.condition}
                onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
              />
              <div className="field-help">운영자 참고용 조건 설명입니다.</div>
            </div>
            <div className="field">
              <span className="field-label">수여 방식</span>
              <div className="choice-row">
                <label className="choice">
                  <input
                    type="radio"
                    name="isAuto"
                    checked={!form.isAuto}
                    onChange={() => setForm((f) => ({ ...f, isAuto: false }))}
                  />
                  수동 수여
                </label>
                <label className="choice">
                  <input
                    type="radio"
                    name="isAuto"
                    checked={form.isAuto}
                    onChange={() => setForm((f) => ({ ...f, isAuto: true }))}
                  />
                  자동 수여
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "추가 중..." : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 뱃지 비활성화 모달 (super_admin 전용) ────────────────────────────────────

function DeactivateBadgeModal({
  badge,
  onClose,
  onDeactivated,
}: {
  badge: AdminBadge;
  onClose: () => void;
  onDeactivated: (id: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/badges/${badge.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (res.status === 403) { alert("최고 관리자(super_admin) 권한이 필요합니다."); return; }
      if (!res.ok) throw new Error();
      onDeactivated(badge.id);
    } catch {
      alert("비활성화 처리에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--surface)", borderRadius: 8, padding: 28,
          width: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ marginBottom: 8, fontSize: 16, fontWeight: 700 }}>뱃지 비활성화</h3>
        <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 6 }}>
          <strong>{badge.name}</strong> 뱃지를 비활성화합니다.
        </p>
        <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 16 }}>
          기존 보유 회원의 뱃지는 유지되며, 새 수여만 중단됩니다.
        </p>
        <label style={{ fontSize: 12, color: "var(--gray-500)", display: "block", marginBottom: 6 }}>
          비활성화 사유 (필수)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="비활성화 사유를 입력하세요"
          rows={3}
          style={{
            width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
            borderRadius: 6, fontSize: 13, resize: "vertical", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onClose}>취소</button>
          <button
            className="btn btn-danger"
            disabled={!reason.trim() || saving}
            onClick={handleConfirm}
          >
            {saving ? "처리 중..." : "비활성화"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function AdminRanksPage() {
  const [grades, setGrades] = useState<AdminGrade[]>([]);
  const [badges, setBadges] = useState<AdminBadge[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [addBadgeOpen, setAddBadgeOpen] = useState(false);
  const [deactivateBadge, setDeactivateBadge] = useState<AdminBadge | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // 관리자 role 확인
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/admin/auth/session`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d?.user?.role === "super_admin") setIsSuperAdmin(true); })
      .catch(() => {});
  }, []);

  // 등급 목록 조회
  const fetchGrades = useCallback(async () => {
    setLoadingGrades(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/grades`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGrades(data.items ?? []);
    } catch {
      showToast("등급 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoadingGrades(false);
    }
  }, [showToast]);

  // 뱃지 목록 조회
  const fetchBadges = useCallback(async () => {
    setLoadingBadges(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/badges`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBadges(data.items ?? []);
    } catch {
      showToast("뱃지 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoadingBadges(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchGrades();
    fetchBadges();
  }, [fetchGrades, fetchBadges]);

  function handleGradeSaved(id: string, minPoints: number) {
    setGrades((prev) => prev.map((g) => (g.id === id ? { ...g, minPoints } : g)));
    showToast("등급 기준이 저장되었습니다.", "success");
  }

  function handleBadgeCreated(badge: AdminBadge) {
    setBadges((prev) => [...prev, badge]);
    setAddBadgeOpen(false);
    showToast("뱃지가 추가되었습니다.", "success");
  }

  function handleBadgeDeactivated(id: string) {
    setBadges((prev) => prev.map((b) => (b.id === id ? { ...b, isActive: false } : b)));
    setDeactivateBadge(null);
    showToast("뱃지가 비활성화되었습니다.", "success");
  }

  // 운영자는 정적 행(DB에 없음)
  const operatorRow = { label: "운영자", level: 0, note: "관리자 전용 역할" };

  return (
    <AdminShell breadcrumb={["관리자", "등급·뱃지 관리"]} activeKey="ranks">
      <div className="page-header">
        <div>
          <h1 className="page-title">등급·뱃지 관리</h1>
          <p className="page-description">회원 등급 기준과 뱃지를 관리합니다.</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setAddBadgeOpen(true)}
          >
            <i className="ri-add-line" />
            새 뱃지 추가
          </button>
        </div>
      </div>

      {/* 운영 안내 */}
      <div className="alert alert-info" style={{ marginBottom: 18 }}>
        <i className="ri-information-line" />
        <div>
          <strong>자동 부여 등급 체계</strong>
          <br />
          등급은 누적 포인트(작당력)가 기준을 넘으면 <strong>자동으로 부여</strong>됩니다. 필요 포인트를 클릭하면 즉시 수정할 수 있습니다.
        </div>
      </div>

      {/* 1. 등급 목록 — 인라인 minPoints 편집 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">등급 목록</h2>
            <p className="section-description">
              5단계(새내기 → 마스터). 필요 포인트를 클릭하여 기준을 수정합니다.
            </p>
          </div>
        </div>

        <article className="card">
          <div className="table-wrap">
            {loadingGrades ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
                불러오는 중...
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 72 }}>뱃지</th>
                    <th>등급명</th>
                    <th style={{ width: 60 }}>레벨</th>
                    <th style={{ width: 200 }}>필요 포인트 (이상)</th>
                    <th>최대 포인트</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <Image
                          src={GRADE_BADGE_BY_LEVEL[g.level] ?? "/badges/rookie.png"}
                          alt={`${g.name} 뱃지`}
                          width={40}
                          height={40}
                          style={{ borderRadius: 4 }}
                        />
                      </td>
                      <td>
                        <div className="content-title">{g.name}</div>
                      </td>
                      <td>
                        <span className="badge badge-gray">Lv.{g.level}</span>
                      </td>
                      <td>
                        <InlineMinPointsCell
                          grade={g}
                          onSaved={handleGradeSaved}
                          onError={(msg) => showToast(msg, "error")}
                        />
                      </td>
                      <td>
                        {g.maxPoints != null ? (
                          <span style={{ fontSize: 13, color: "var(--gray-600)" }}>
                            {g.maxPoints.toLocaleString()} 미만
                          </span>
                        ) : (
                          <span className="badge badge-gray">제한 없음</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* 운영자 — 정적 비편집 행 */}
                  <tr style={{ background: "var(--gray-50, #f8f9fa)" }}>
                    <td>
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: 4,
                          background: "var(--gray-200)", display: "flex",
                          alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <i className="ri-shield-star-line" style={{ color: "var(--gray-500)" }} />
                      </div>
                    </td>
                    <td>
                      <div className="content-title">{operatorRow.label}</div>
                      <div className="content-meta">{operatorRow.note}</div>
                    </td>
                    <td>
                      <span className="badge badge-blue">관리자</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: "var(--gray-400)" }}>해당 없음</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: "var(--gray-400)" }}>해당 없음</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </article>
      </section>

      {/* 2. 뱃지 목록 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">뱃지 목록</h2>
            <p className="section-description">
              활동 기반 뱃지를 관리합니다. 비활성화는 최고 관리자만 가능합니다.
            </p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            type="button"
            onClick={() => setAddBadgeOpen(true)}
          >
            <i className="ri-add-line" />
            신규 추가
          </button>
        </div>

        <article className="card">
          <div className="table-wrap">
            {loadingBadges ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
                불러오는 중...
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>설명</th>
                    <th>조건</th>
                    <th style={{ width: 80 }}>수여방식</th>
                    <th style={{ width: 80 }}>활성</th>
                    {isSuperAdmin && <th style={{ width: 100 }}>관리</th>}
                  </tr>
                </thead>
                <tbody>
                  {badges.length === 0 ? (
                    <tr>
                      <td colSpan={isSuperAdmin ? 6 : 5} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>
                        뱃지가 없습니다.
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ marginLeft: 12 }}
                          onClick={() => setAddBadgeOpen(true)}
                        >
                          첫 뱃지 추가
                        </button>
                      </td>
                    </tr>
                  ) : (
                    badges.map((b) => (
                      <tr key={b.id} style={!b.isActive ? { opacity: 0.55 } : undefined}>
                        <td>
                          <div className="content-title">{b.name}</div>
                          <div className="content-meta" style={{ fontSize: 11 }}>#{b.slug}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, color: "var(--gray-600)" }}>
                            {b.description || "-"}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, color: "var(--gray-600)" }}>
                            {b.condition || "-"}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${b.isAuto ? "badge-purple" : "badge-blue"}`}>
                            {b.isAuto ? "자동" : "수동"}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${b.isActive ? "badge-green" : "badge-gray"}`}>
                            {b.isActive ? "활성" : "비활성"}
                          </span>
                        </td>
                        {isSuperAdmin && (
                          <td>
                            {b.isActive ? (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => setDeactivateBadge(b)}
                              >
                                <i className="ri-eye-off-line" />
                                비활성화
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--gray-400)" }}>비활성</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </section>

      {/* 모달들 */}
      {addBadgeOpen && (
        <AddBadgeModal
          onClose={() => setAddBadgeOpen(false)}
          onCreated={handleBadgeCreated}
        />
      )}

      {deactivateBadge && (
        <DeactivateBadgeModal
          badge={deactivateBadge}
          onClose={() => setDeactivateBadge(null)}
          onDeactivated={handleBadgeDeactivated}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

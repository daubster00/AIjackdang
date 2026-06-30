"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../lib/api";
import { confirmDialog, notifyDialog } from "@/lib/dialog";
import type { AdminGrade } from "@ai-jakdang/contracts";

/**
 * 등급 관리 페이지 (Story 9.13).
 * GET /api/v1/admin/grades     — 등급 목록 (인라인 minPoints 편집 + 상세 편집 링크)
 * 업적 뱃지(badges/user_badges) 는 수정요청으로 전면 제거됨.
 */

// 등급 뱃지 이미지(로컬 정적 에셋). DB name 기반이 아닌 level 순서 기반.
const GRADE_BADGE_BY_LEVEL: Record<number, string> = {
  1: "/badges/rookie.png",
  2: "/badges/member.png",
  3: "/badges/practitioner.png",
  4: "/badges/expert.png",
  5: "/badges/master.png",
};

// ── 등급 minPoints 인라인 편집 셀 ───────────────────────────────────────────

function InlineMinPointsCell({
  grade,
  onSaved,
}: {
  grade: AdminGrade;
  onSaved: (id: string, minPoints: number) => void;
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
      await notifyDialog("등급 기준 저장에 실패했습니다.", "danger");
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

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function AdminRanksPage() {
  const [grades, setGrades] = useState<AdminGrade[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 등급 목록 조회 (유저 등급 level >= 1 전체 표시)
  const fetchGrades = useCallback(async () => {
    setLoadingGrades(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/grades`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const allItems: AdminGrade[] = data.items ?? [];
      // level >= 1 인 모든 유저 등급 표시 (상한 없음 — 등급 추가 시 5 초과 허용)
      setGrades(allItems.filter((g) => g.level >= 1));
    } catch {
      await notifyDialog("등급 목록을 불러오지 못했습니다.", "danger");
    } finally {
      setLoadingGrades(false);
    }
  }, []);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  async function handleGradeSaved(id: string, minPoints: number) {
    setGrades((prev) => prev.map((g) => (g.id === id ? { ...g, minPoints } : g)));
    await notifyDialog("등급 기준이 저장되었습니다.");
  }

  async function handleDeleteGrade(grade: AdminGrade) {
    if (!(await confirmDialog({ title: "등급 삭제", message: `"${grade.name}" 등급을 삭제하시겠습니까?`, tone: "danger" }))) return;
    setDeletingId(grade.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/grades/${grade.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(d?.error?.message ?? "삭제에 실패했습니다.");
      }
      setGrades((prev) => prev.filter((g) => g.id !== grade.id));
      await notifyDialog("등급이 삭제되었습니다.");
    } catch (err) {
      await notifyDialog(err instanceof Error ? err.message : "삭제에 실패했습니다.", "danger");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminShell breadcrumb={["관리자", "등급 관리"]} activeKey="ranks">
      <div className="page-header">
        <div>
          <h1 className="page-title">등급 관리</h1>
          <p className="page-description">회원 등급 기준을 관리합니다.</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-primary" href="/ranks/new">
            <i className="ri-add-line" />
            새 등급 추가
          </Link>
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

      {/* 등급 목록 — 인라인 minPoints 편집 + 상세 편집 링크 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">등급 목록</h2>
            <p className="section-description">
              5단계(새내기 → 마스터). 필요 포인트를 클릭하여 기준을 수정하거나, 등급명을 클릭하여 상세 설정합니다.
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
                    <th style={{ width: 120 }}>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <img
                          src={g.imageUrl ?? GRADE_BADGE_BY_LEVEL[g.level] ?? "/badges/rookie.png"}
                          alt={`${g.name} 뱃지`}
                          width={40}
                          height={40}
                          style={{ borderRadius: 4 }}
                        />
                      </td>
                      <td>
                        <Link
                          href={`/ranks/${g.id}`}
                          className="content-title"
                          style={{ color: "var(--primary-600, #2563eb)", textDecoration: "none" }}
                        >
                          {g.name}
                        </Link>
                      </td>
                      <td>
                        <span className="badge badge-gray">Lv.{g.level}</span>
                      </td>
                      <td>
                        <InlineMinPointsCell
                          grade={g}
                          onSaved={handleGradeSaved}
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
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Link
                            href={`/ranks/${g.id}`}
                            className="btn btn-outline btn-sm"
                          >
                            <i className="ri-settings-3-line" />
                            설정
                          </Link>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={deletingId === g.id}
                            onClick={() => handleDeleteGrade(g)}
                          >
                            <i className="ri-delete-bin-line" />
                            {deletingId === g.id ? "삭제 중..." : "삭제"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </section>

    </AdminShell>
  );
}

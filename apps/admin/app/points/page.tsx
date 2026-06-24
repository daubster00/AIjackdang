"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../lib/api";
import type { AdminPointRule } from "@ai-jakdang/contracts";

/**
 * 포인트 관리 페이지 (Story 9.13).
 * GET /api/v1/admin/points/rules 실제 API 연동.
 * 포인트 값 클릭 → inline input → blur/Enter 저장 → 성공 토스트.
 */

// 활동 유형별 아이콘·라벨·설명 매핑 (UI 표시용 메타데이터)
const ACTION_META: Record<string, { label: string; icon: string; note: string }> = {
  post_create: { label: "글 작성", icon: "ri-article-line", note: "게시글 1건당" },
  comment_create: { label: "댓글 작성", icon: "ri-chat-1-line", note: "댓글 1건당" },
  answer_helpful: { label: "도움된 답변", icon: "ri-checkbox-circle-line", note: "질문자가 채택 시" },
  resource_upload: { label: "실전자료 등록", icon: "ri-folder-upload-line", note: "자료 승인 시" },
  daily_login: { label: "일일 로그인", icon: "ri-login-box-line", note: "하루 1회" },
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

// ── 인라인 편집 가능 포인트 셀 ────────────────────────────────────────────────

function InlinePointsCell({
  rule,
  onSaved,
  onError,
}: {
  rule: AdminPointRule;
  onSaved: (actionType: string, newPoints: number) => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(rule.points));
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
      setDraft(String(rule.points));
      setEditing(false);
      return;
    }
    if (num === rule.points) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/points/rules/${encodeURIComponent(rule.actionType)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: num }),
        },
      );
      if (!res.ok) throw new Error();
      onSaved(rule.actionType, num);
    } catch {
      onError("포인트 저장에 실패했습니다.");
      setDraft(String(rule.points));
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="input-icon" style={{ width: 120 }}>
        <i className="ri-add-line" />
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
            if (e.key === "Escape") { setDraft(String(rule.points)); setEditing(false); }
          }}
          disabled={saving}
          aria-label={`${rule.actionType} 포인트 입력`}
          style={{ width: "100%" }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(String(rule.points)); setEditing(true); }}
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
      aria-label={`${rule.actionType} 포인트 수정 (현재: ${rule.points})`}
    >
      <i className="ri-pencil-line" style={{ fontSize: 12, opacity: 0.6 }} />
      {rule.points.toLocaleString()}
    </button>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function AdminPointsPage() {
  const [rules, setRules] = useState<AdminPointRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/points/rules`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRules(data.items ?? []);
    } catch {
      showToast("포인트 규칙을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  function handleSaved(actionType: string, newPoints: number) {
    setRules((prev) =>
      prev.map((r) => (r.actionType === actionType ? { ...r, points: newPoints } : r)),
    );
    showToast("포인트 규칙이 저장되었습니다.", "success");
  }

  return (
    <AdminShell breadcrumb={["관리자", "포인트 관리"]} activeKey="points">
      <div className="page-header">
        <div>
          <h1 className="page-title">포인트 관리</h1>
          <p className="page-description">활동별 포인트 규칙과 회원별 내역을 운영합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            내역 내보내기
          </button>
          <button className="btn btn-primary" data-admin-open="pointAdjustModal">
            <i className="ri-hand-coin-line" />
            수동 지급/차감
          </button>
        </div>
      </div>

      {/* 운영 원칙 안내 */}
      <div className="alert alert-info">
        <i className="ri-information-line" />
        <div>
          <strong>운영 원칙</strong>
          <br />
          포인트는 현금성 보상과 연결하지 않으며, 회원 활동 지표(등급·뱃지)로만 사용합니다. 포인트 값을 클릭하면 즉시 수정할 수 있습니다.
        </div>
      </div>

      {/* 포인트 규칙 목록 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">포인트 규칙 설정</h2>
            <p className="section-description">활동별 지급 포인트를 클릭하여 인라인 수정합니다. 수정 후 Enter 또는 포커스 이동 시 자동 저장됩니다.</p>
          </div>
        </div>

        <article className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">활동별 포인트 규칙</h3>
              <div className="card-subtitle">포인트 값을 클릭하면 바로 수정할 수 있습니다.</div>
            </div>
            <span className="badge badge-blue">{rules.length}개 규칙</span>
          </div>

          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
                불러오는 중...
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>활동 유형</th>
                    <th>설명</th>
                    <th style={{ width: "160px" }}>지급 포인트</th>
                    <th style={{ width: "80px" }}>활성</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>
                        규칙이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    rules.map((r) => {
                      const meta = ACTION_META[r.actionType];
                      return (
                        <tr key={r.actionType}>
                          <td>
                            <div className="author">
                              <span className="author-avatar">
                                <i className={meta?.icon ?? "ri-coins-line"} />
                              </span>
                              <div>
                                <div className="content-title">{meta?.label ?? r.actionType}</div>
                                <div className="content-meta">{meta?.note ?? r.actionType}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 13, color: "var(--gray-600)" }}>
                              {r.description || "-"}
                            </span>
                          </td>
                          <td>
                            <InlinePointsCell
                              rule={r}
                              onSaved={handleSaved}
                              onError={(msg) => showToast(msg, "error")}
                            />
                          </td>
                          <td>
                            <span className={`badge ${r.isActive ? "badge-green" : "badge-gray"}`}>
                              {r.isActive ? "활성" : "비활성"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </article>
      </section>

      {/* 회원별 포인트 내역 (정적 — 향후 API 연동) */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">회원별 포인트 내역</h2>
            <p className="section-description">적립·차감 이력과 잔액을 확인합니다.</p>
          </div>
        </div>

        <article className="card">
          <div className="card-body" style={{ textAlign: "center", padding: 32, color: "var(--gray-400)" }}>
            <i className="ri-coins-line" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
            포인트 내역 조회는 다음 단계에서 구현됩니다.
            <br />
            <Link href="/points" style={{ fontSize: 13, color: "var(--primary-600)" }}>
              새로고침
            </Link>
          </div>
        </article>
      </section>

      {/* 공통 오버레이 */}
      <div className="overlay" />

      {/* 수동 지급/차감 모달 */}
      <section className="modal" id="pointAdjustModal" role="dialog" aria-modal="true" aria-labelledby="pointAdjustTitle">
        <div className="modal-header">
          <div className="modal-title" id="pointAdjustTitle">수동 포인트 지급/차감</div>
          <button className="icon-button close-overlay" aria-label="모달 닫기">
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="field">
              <label className="field-label">회원 선택</label>
              <div className="input-icon">
                <i className="ri-user-search-line" />
                <input className="control" type="search" placeholder="닉네임 또는 이메일로 검색" aria-label="회원 검색" />
              </div>
            </div>
            <div className="field">
              <span className="field-label">지급 / 차감 구분</span>
              <div className="choice-row">
                <label className="choice">
                  <input type="radio" name="adjustType" defaultChecked />
                  지급(+)
                </label>
                <label className="choice">
                  <input type="radio" name="adjustType" />
                  차감(-)
                </label>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="adjustPoints">포인트</label>
              <div className="input-icon">
                <i className="ri-coins-line" />
                <input className="control" id="adjustPoints" type="number" min={0} placeholder="예: 100" />
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="adjustReason">사유 메모</label>
              <textarea
                className="control"
                id="adjustReason"
                placeholder="예: 우수 실전자료 기여 보상 / 중복 자료 정리 차감"
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-primary">적용하기</button>
        </div>
      </section>

      {/* 토스트 */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

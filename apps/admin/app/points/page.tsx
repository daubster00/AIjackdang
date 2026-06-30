"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../lib/api";
import type { AdminPointRule } from "@ai-jakdang/contracts";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { notifyDialog, confirmDialog } from "@/lib/dialog";

/**
 * 포인트 관리 페이지 (Story 9.13 + Item 25/26/27).
 *
 * Item 25: 수동 지급/차감 모달에 회원 검색 자동완성 추가.
 * Item 26: 지급(POST)·차감(DELETE) 모달 폼 연동.
 * Item 27: 회원별 포인트 내역 섹션 — GET /admin/members/:id/points-history 연동.
 */

// ── 상수 / 타입 ──────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; icon: string; note: string }> = {
  post_create:     { label: "글 작성",       icon: "ri-article-line",       note: "게시글 1건당" },
  comment_create:  { label: "댓글 작성",     icon: "ri-chat-1-line",        note: "댓글 1건당" },
  answer_helpful:  { label: "도움된 답변",   icon: "ri-checkbox-circle-line", note: "질문자가 채택 시" },
  resource_upload: { label: "실전자료 등록", icon: "ri-folder-upload-line",  note: "자료 승인 시" },
  daily_login:     { label: "일일 로그인",   icon: "ri-login-box-line",      note: "하루 1회" },
};

/** reason → 한국어 라벨 */
const REASON_LABELS: Record<string, string> = {
  "admin.grant":      "관리자 수동 지급",
  "admin.deduct":     "관리자 수동 차감",
  "admin.grade_set":  "등급 조정",
  "post.created":     "글 작성",
  "comment.created":  "댓글 작성",
  "answer.created":   "답변 작성",
  "answer.helpful":   "도움된 답변",
  "resource.created": "실전자료 등록",
  "daily_login":      "일일 로그인",
  "reaction.received":"반응 수신",
  "download.given":   "자료 다운로드",
};

interface MemberSearchResult {
  id: string;
  nickname: string;
  email: string;
  image?: string | null;
  avatarUrl?: string | null;
  defaultAvatarIndex?: number;
  totalPoints: number;
}

interface PointHistoryItem {
  id: string;
  delta: number;
  reason: string;
  sourceType: string;
  createdAt: string;
  balance: number;
}

interface PointHistoryMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
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

// ── 회원 검색 자동완성 컴포넌트 ────────────────────────────────────────────────

function MemberSearchInput({
  value,
  onChange,
  selectedMember,
  onSelect,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  selectedMember: MemberSearchResult | null;
  onSelect: (m: MemberSearchResult | null) => void;
  placeholder: string;
  id: string;
}) {
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchResults(q: string) {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/members?q=${encodeURIComponent(q)}&pageSize=10`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json() as { items: MemberSearchResult[] };
      setResults(data.items ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(v: string) {
    onChange(v);
    onSelect(null); // 입력 변경 시 선택 초기화
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchResults(v), 300);
  }

  function handleSelect(m: MemberSearchResult) {
    onSelect(m);
    onChange(`${m.nickname} (${m.email})`);
    setOpen(false);
    setResults([]);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div className="input-icon">
        <i className={loading ? "ri-loader-4-line" : "ri-user-search-line"} />
        <input
          id={id}
          className="control"
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          autoComplete="off"
          aria-label="회원 검색"
          style={{ color: "var(--gray-900)" }}
        />
      </div>

      {/* 선택된 회원 표시 */}
      {selectedMember && (
        <div style={{
          marginTop: 6,
          padding: "6px 10px",
          background: "var(--primary-50, #eff6ff)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
        }}>
          <i className="ri-user-line" style={{ color: "var(--primary-600)" }} />
          <span style={{ fontWeight: 500 }}>{selectedMember.nickname}</span>
          <span style={{ color: "var(--gray-500)" }}>{selectedMember.email}</span>
          <span style={{ marginLeft: "auto", color: "var(--primary-600)" }}>
            현재 {selectedMember.totalPoints.toLocaleString()}P
          </span>
          <button
            type="button"
            onClick={() => { onSelect(null); onChange(""); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-400)", padding: 0 }}
            aria-label="선택 해제"
          >
            <i className="ri-close-line" />
          </button>
        </div>
      )}

      {/* 검색 결과 드롭다운 */}
      {open && results.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "#fff",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          zIndex: 200,
          maxHeight: 240,
          overflowY: "auto",
          scrollbarWidth: "thin",
        }}>
          {results.map((m) => {
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelect(m)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 12px",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid var(--gray-100)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <UserAvatar
                  size={32}
                  alt={m.nickname}
                  avatarUrl={m.avatarUrl}
                  image={m.image}
                  defaultAvatarIndex={m.defaultAvatarIndex}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.nickname}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.email}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--primary-600)", flexShrink: 0 }}>
                  {m.totalPoints.toLocaleString()}P
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function AdminPointsPage() {
  // 포인트 규칙
  const [rules, setRules] = useState<AdminPointRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  // ── 모달 상태 (Items 25·26) ────────────────────────────────────────────────
  const [modalSearch, setModalSearch] = useState("");
  const [modalMember, setModalMember] = useState<MemberSearchResult | null>(null);
  const [adjustType, setAdjustType] = useState<"grant" | "deduct">("grant");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const modalCloseRef = useRef<HTMLButtonElement>(null);

  // ── 포인트 내역 상태 (Item 27) ────────────────────────────────────────────
  const [histSearch, setHistSearch] = useState("");
  const [histMember, setHistMember] = useState<MemberSearchResult | null>(null);
  const [histItems, setHistItems] = useState<PointHistoryItem[]>([]);
  const [histMeta, setHistMeta] = useState<PointHistoryMeta | null>(null);
  const [histTotalBalance, setHistTotalBalance] = useState(0);
  const [histLoading, setHistLoading] = useState(false);
  const [histPage, setHistPage] = useState(1);

  // ── 포인트 규칙 조회 ───────────────────────────────────────────────────────
  const fetchRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/points/rules`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRules(data.items ?? []);
    } catch {
      void notifyDialog("포인트 규칙을 불러오지 못했습니다.", "danger");
    } finally {
      setLoadingRules(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  function handleSaved(actionType: string, newPoints: number) {
    setRules((prev) =>
      prev.map((r) => (r.actionType === actionType ? { ...r, points: newPoints } : r)),
    );
    void notifyDialog("포인트 규칙이 저장되었습니다.");
  }

  // ── 포인트 지급/차감 제출 (Item 26) ───────────────────────────────────────
  async function handleAdjustSubmit() {
    if (!modalMember) {
      void notifyDialog("회원을 선택하세요.", "danger");
      return;
    }
    const amountNum = parseInt(amount, 10);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      void notifyDialog("포인트는 양수여야 합니다.", "danger");
      return;
    }
    if (adjustType === "deduct" && !reason.trim()) {
      void notifyDialog("차감 사유를 입력하세요.", "danger");
      return;
    }

    const label = adjustType === "grant" ? "지급" : "차감";
    const confirmed = await confirmDialog({
      title: `포인트 ${label}`,
      message: `${modalMember.nickname}님에게 ${amountNum.toLocaleString()}P를 ${label}하시겠습니까?`,
      confirmText: `${label}하기`,
      tone: adjustType === "deduct" ? "danger" : "default",
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const endpoint = `${API_BASE_URL}/api/v1/admin/members/${modalMember.id}/points`;
      const method = adjustType === "grant" ? "POST" : "DELETE";
      const body = adjustType === "grant"
        ? { amount: amountNum, reason: reason.trim() || "admin.grant" }
        : { amount: amountNum, reason: reason.trim() };

      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as { error?: { message?: string } }).error?.message ??
          (adjustType === "grant" ? "포인트 지급에 실패했습니다." : "포인트 차감에 실패했습니다."),
        );
      }

      void notifyDialog(`${modalMember.nickname}님에게 ${amountNum.toLocaleString()}P ${label} 완료`);

      // 모달 닫기
      modalCloseRef.current?.click();

      // 폼 초기화
      setModalSearch("");
      setModalMember(null);
      setAmount("");
      setReason("");
      setAdjustType("grant");

      // 내역 섹션에서 같은 회원을 보고 있으면 새로고침
      if (histMember?.id === modalMember.id) {
        fetchHistory(histMember.id, 1);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "오류가 발생했습니다.";
      void notifyDialog(msg, "danger");
    } finally {
      setSubmitting(false);
    }
  }

  // ── 포인트 내역 조회 (Item 27) ────────────────────────────────────────────
  const fetchHistory = useCallback(async (memberId: string, page: number) => {
    setHistLoading(true);
    setHistPage(page);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/members/${memberId}/points-history?page=${page}&pageSize=20`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("내역을 불러오지 못했습니다.");
      const data = await res.json() as {
        items: PointHistoryItem[];
        totalBalance: number;
        meta: PointHistoryMeta;
      };
      setHistItems(data.items);
      setHistTotalBalance(data.totalBalance);
      setHistMeta(data.meta);
    } catch {
      void notifyDialog("포인트 내역을 불러오지 못했습니다.", "danger");
    } finally {
      setHistLoading(false);
    }
  }, []);

  // 히스토리 회원 선택 시 내역 로드
  useEffect(() => {
    if (histMember) {
      fetchHistory(histMember.id, 1);
    } else {
      setHistItems([]);
      setHistMeta(null);
      setHistTotalBalance(0);
    }
  }, [histMember, fetchHistory]);

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
          포인트는 현금성 보상과 연결하지 않으며, 회원 활동 지표(등급)로만 사용합니다. 포인트 값을 클릭하면 즉시 수정할 수 있습니다.
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
            {loadingRules ? (
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
                              onError={(msg) => void notifyDialog(msg, "danger")}
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

      {/* 회원별 포인트 내역 (Item 27) */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">회원별 포인트 내역</h2>
            <p className="section-description">회원을 검색하여 적립·차감 이력과 잔액을 확인합니다.</p>
          </div>
        </div>

        <article className="card">
          <div className="card-body" style={{ padding: "16px 18px", borderBottom: "1px solid var(--gray-200)" }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label" htmlFor="histMemberSearch">회원 검색</label>
              <MemberSearchInput
                id="histMemberSearch"
                value={histSearch}
                onChange={setHistSearch}
                selectedMember={histMember}
                onSelect={setHistMember}
                placeholder="닉네임 또는 이메일로 검색"
              />
            </div>
          </div>

          {/* 잔액 요약 */}
          {histMember && !histLoading && (
            <div style={{
              padding: "12px 18px",
              background: "var(--primary-50, #eff6ff)",
              borderBottom: "1px solid var(--gray-200)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <i className="ri-coins-line" style={{ color: "var(--primary-600)" }} />
              <strong style={{ fontSize: 13 }}>{histMember.nickname}</strong>
              <span style={{ fontSize: 13, color: "var(--gray-600)" }}>현재 잔액:</span>
              <strong style={{ fontSize: 15, color: "var(--primary-600)" }}>
                {histTotalBalance.toLocaleString()}P
              </strong>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--gray-500)" }}>
                전체 {histMeta?.totalItems ?? 0}건
              </span>
            </div>
          )}

          <div className="table-wrap">
            {!histMember ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
                <i className="ri-coins-line" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                위에서 회원을 검색하여 포인트 내역을 확인하세요.
              </div>
            ) : histLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
                내역 불러오는 중...
              </div>
            ) : histItems.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
                포인트 내역이 없습니다.
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>일시</th>
                    <th>사유</th>
                    <th style={{ textAlign: "right", width: 100 }}>변동</th>
                    <th style={{ textAlign: "right", width: 120 }}>누적 잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {histItems.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontSize: 13, color: "var(--gray-600)", whiteSpace: "nowrap" }}>
                        {new Date(item.createdAt).toLocaleString("ko-KR", {
                          year: "numeric", month: "2-digit", day: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>
                          {REASON_LABELS[item.reason] ?? item.reason}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--gray-400)" }}>
                          {item.sourceType}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>
                        <span style={{ color: item.delta >= 0 ? "var(--success, #16a34a)" : "var(--danger, #dc2626)" }}>
                          {item.delta >= 0 ? "+" : ""}{item.delta.toLocaleString()}P
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontSize: 13, color: "var(--gray-700)", whiteSpace: "nowrap" }}>
                        {item.balance.toLocaleString()}P
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 페이지네이션 */}
          {histMeta && histMeta.totalPages > 1 && (
            <div style={{ padding: "12px 18px", display: "flex", gap: 4, justifyContent: "center" }}>
              <button
                className="btn btn-outline"
                style={{ padding: "4px 10px", fontSize: 12 }}
                disabled={histPage <= 1 || histLoading}
                onClick={() => fetchHistory(histMember!.id, histPage - 1)}
              >
                이전
              </button>
              <span style={{ padding: "4px 12px", fontSize: 12, color: "var(--gray-600)", alignSelf: "center" }}>
                {histPage} / {histMeta.totalPages}
              </span>
              <button
                className="btn btn-outline"
                style={{ padding: "4px 10px", fontSize: 12 }}
                disabled={histPage >= histMeta.totalPages || histLoading}
                onClick={() => fetchHistory(histMember!.id, histPage + 1)}
              >
                다음
              </button>
            </div>
          )}
        </article>
      </section>

      {/* 공통 오버레이 */}
      <div className="overlay" />

      {/* 수동 지급/차감 모달 (Items 25·26) */}
      <section className="modal" id="pointAdjustModal" role="dialog" aria-modal="true" aria-labelledby="pointAdjustTitle">
        <div className="modal-header">
          <div className="modal-title" id="pointAdjustTitle">수동 포인트 지급/차감</div>
          <button
            ref={modalCloseRef}
            className="icon-button close-overlay"
            aria-label="모달 닫기"
          >
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            {/* 회원 검색 (Item 25) */}
            <div className="field">
              <label className="field-label" htmlFor="modalMemberSearch">회원 선택</label>
              <MemberSearchInput
                id="modalMemberSearch"
                value={modalSearch}
                onChange={setModalSearch}
                selectedMember={modalMember}
                onSelect={setModalMember}
                placeholder="닉네임 또는 이메일로 검색"
              />
            </div>

            {/* 지급 / 차감 구분 */}
            <div className="field">
              <span className="field-label">지급 / 차감 구분</span>
              <div className="choice-row">
                <label className="choice">
                  <input
                    type="radio"
                    name="adjustType"
                    checked={adjustType === "grant"}
                    onChange={() => setAdjustType("grant")}
                  />
                  지급(+)
                </label>
                <label className="choice">
                  <input
                    type="radio"
                    name="adjustType"
                    checked={adjustType === "deduct"}
                    onChange={() => setAdjustType("deduct")}
                  />
                  차감(-)
                </label>
              </div>
            </div>

            {/* 포인트 */}
            <div className="field">
              <label className="field-label" htmlFor="adjustPoints">포인트</label>
              <div className="input-icon">
                <i className="ri-coins-line" />
                <input
                  className="control"
                  id="adjustPoints"
                  type="number"
                  min={1}
                  placeholder="예: 100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            {/* 사유 */}
            <div className="field">
              <label className="field-label" htmlFor="adjustReason">
                사유 메모{adjustType === "deduct" && <span style={{ color: "var(--danger)", marginLeft: 4 }}>*</span>}
              </label>
              <textarea
                className="control"
                id="adjustReason"
                placeholder={
                  adjustType === "grant"
                    ? "예: 우수 실전자료 기여 보상 (선택)"
                    : "예: 중복 자료 정리 차감 (필수)"
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay" type="button">취소</button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={submitting || !modalMember}
            onClick={handleAdjustSubmit}
          >
            {submitting
              ? <><i className="ri-loader-4-line" /> 처리 중...</>
              : "적용하기"
            }
          </button>
        </div>
      </section>

    </AdminShell>
  );
}

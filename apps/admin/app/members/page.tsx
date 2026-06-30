"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "../../lib/api";
import { downloadCsv } from "../../lib/csv";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Select } from "@/components/ui/Select";
import { RowActionMenu } from "@/components/ui/RowActionMenu";

// ── 로컬 타입 (contracts/src/admin/members.ts 미노출 시 임시) ─────────────────
interface AdminUserMemberItem {
  id: string;
  nickname: string;
  email: string;
  status: "active" | "suspended" | "withdrawn";
  suspendedUntil: string | null;
  createdAt: string;
  avatarUrl: string | null;
  image: string | null;
  defaultAvatarIndex: number;
  totalPoints: number;
  gradeLevel: number;
  gradeName: string;
  postCount: number;
  reportCount: number;
}

/**
 * 유저 회원 관리 페이지 (Story 9.12).
 * GET /api/v1/admin/members 실제 API 연동.
 * URL 파라미터: page, status, grade, dateFrom, dateTo, q
 */

// 등급(level 1~5) → 배지 색 매핑
const GRADE_BADGE: Record<number, string> = {
  1: "badge-gray",
  2: "badge-blue",
  3: "badge-cyan",
  4: "badge-purple",
  5: "badge-orange",
};

// 상태(status) → 배지 색
function statusBadge(status: string): [string, string] {
  switch (status) {
    case "active": return ["badge-green", "정상"];
    case "suspended": return ["badge-red", "이용제한"];
    case "withdrawn": return ["badge-gray", "탈퇴"];
    default: return ["badge-gray", status];
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

// ── 토스트 ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 99999,
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff", borderRadius: 8, padding: "12px 20px",
        fontSize: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex", alignItems: "center", gap: 10,
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

// ── 메인 콘텐츠 ────────────────────────────────────────────────────────────────

function AdminMembersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const statusParam = searchParams.get("status") ?? "all";
  const gradeParam = searchParams.get("grade") ?? "all";
  const dateFromParam = searchParams.get("dateFrom") ?? "";
  const dateToParam = searchParams.get("dateTo") ?? "";
  const qParam = searchParams.get("q") ?? "";

  const [members, setMembers] = useState<AdminUserMemberItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(qParam);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("pageSize", "20");
      if (statusParam && statusParam !== "all") params.set("status", statusParam);
      if (gradeParam && gradeParam !== "all") params.set("grade", gradeParam);
      if (dateFromParam) params.set("dateFrom", dateFromParam);
      if (dateToParam) params.set("dateTo", dateToParam);
      if (qParam) params.set("q", qParam);

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/members?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = await res.json();
      setMembers(data.items ?? []);
      setMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("회원 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [pageParam, statusParam, gradeParam, dateFromParam, dateToParam, qParam, showToast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "all" && v !== "") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`/members?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/members?${next.toString()}`);
  }

  function handleDownloadCsv() {
    if (members.length === 0) {
      showToast("다운로드할 회원이 없습니다.", "error");
      return;
    }
    downloadCsv("admin-members.csv", members.map((member) => ({
      id: member.id,
      nickname: member.nickname,
      email: member.email,
      status: statusBadge(member.status)[1],
      createdAt: member.createdAt,
      totalPoints: member.totalPoints,
      grade: member.gradeName,
      posts: member.postCount,
      reports: member.reportCount,
    })));
    showToast("CSV 다운로드를 시작했습니다.", "success");
  }

  return (
    <AdminShell breadcrumb={["관리자", "유저 회원 관리"]} activeKey="members">
      <div className="page-header">
        <div>
          <h1 className="page-title">유저 회원 관리</h1>
          <p className="page-description">일반 유저 회원의 활동·등급·상태를 확인하고 처리합니다. 운영진 관리는 관리자 메뉴를 이용하세요.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" type="button" onClick={handleDownloadCsv}>
            <i className="ri-file-excel-2-line" />
            CSV 다운로드
          </button>
        </div>
      </div>

      {/* 필터 + 회원 테이블 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">유저 회원 목록</h2>
            <p className="section-description">검색·필터로 회원을 찾고, 행의 상세보기에서 활동 내역과 처리 액션을 확인합니다.</p>
          </div>
        </div>

        <article className="card">
          {/* 상태별 빠른 탭 */}
          <div className="line-tabs" role="tablist" aria-label="회원 상태">
            {[
              { value: "all", label: "전체 유저" },
              { value: "active", label: "정상" },
              { value: "suspended", label: "이용제한" },
              { value: "withdrawn", label: "탈퇴" },
            ].map((tab) => (
              <button
                key={tab.value}
                className={`line-tab${statusParam === tab.value || (tab.value === "all" && statusParam === "all") ? " active" : ""}`}
                onClick={() => updateParams({ status: tab.value })}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 필터/검색 패널 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input
                  className="control"
                  type="search"
                  placeholder="닉네임 또는 이메일 검색"
                  aria-label="회원 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") updateParams({ q: searchInput }); }}
                />
              </div>

              {/* 등급 셀렉트 (디자인 시스템 커스텀 드롭다운) */}
              <div style={{ minWidth: 150 }}>
                <Select
                  value={gradeParam}
                  onChange={(v) => updateParams({ grade: v })}
                  aria-label="등급 필터"
                  options={[
                    { value: "all", label: "등급: 전체" },
                    { value: "1", label: "새내기 (Lv.1)" },
                    { value: "2", label: "작당원 (Lv.2)" },
                    { value: "3", label: "실전러 (Lv.3)" },
                    { value: "4", label: "고수 (Lv.4)" },
                    { value: "5", label: "마스터 (Lv.5)" },
                  ]}
                />
              </div>

              {/* 기간 필터 */}
              <input
                className="control"
                type="date"
                value={dateFromParam}
                onChange={(e) => updateParams({ dateFrom: e.target.value })}
                aria-label="가입일 시작"
                style={{ width: "auto" }}
              />
              <span style={{ lineHeight: "38px", padding: "0 4px", opacity: 0.5 }}>~</span>
              <input
                className="control"
                type="date"
                value={dateToParam}
                onChange={(e) => updateParams({ dateTo: e.target.value })}
                aria-label="가입일 종료"
                style={{ width: "auto" }}
              />

              <div className="filter-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => { setSearchInput(""); router.push("/members"); }}
                >
                  <i className="ri-refresh-line" />초기화
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => updateParams({ q: searchInput })}
                >
                  <i className="ri-search-line" />검색
                </button>
              </div>
            </div>
          </div>

          {/* 툴바 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 {meta.totalItems}명의 유저 회원</span>
            </div>
          </div>

          {/* 회원 테이블 */}
          <div className="table-wrap">
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gray-400)" }}>
                불러오는 중...
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>닉네임</th>
                    <th>이메일</th>
                    <th>가입일</th>
                    <th>포인트</th>
                    <th>등급</th>
                    <th>작성글</th>
                    <th>신고</th>
                    <th>상태</th>
                    <th style={{ width: 60 }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>
                        회원이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    members.map((m) => {
                      const [statusCls, statusLabel] = statusBadge(m.status);
                      const gradeCls = GRADE_BADGE[m.gradeLevel] ?? "badge-gray";
                      return (
                        <tr key={m.id}>
                          <td>
                            <Link className="author" href={`/members/${m.id}`}>
                              <UserAvatar
                                size={28}
                                alt={m.nickname}
                                avatarUrl={m.avatarUrl}
                                image={m.image}
                                defaultAvatarIndex={m.defaultAvatarIndex}
                              />
                              <span>{m.nickname}</span>
                            </Link>
                          </td>
                          <td>{m.email}</td>
                          <td className="num">{formatDate(m.createdAt)}</td>
                          <td className="num">{m.totalPoints.toLocaleString()}</td>
                          <td>
                            <span className={`badge ${gradeCls}`}>{m.gradeName}</span>
                          </td>
                          <td className="num">{m.postCount.toLocaleString()}</td>
                          <td className="num">
                            {m.reportCount > 0
                              ? <span className="badge badge-red">{m.reportCount}</span>
                              : 0}
                          </td>
                          <td>
                            <span className={`badge ${statusCls}`}>{statusLabel}</span>
                          </td>
                          <td>
                            <RowActionMenu
                              items={[
                                { label: "상세보기", icon: "ri-eye-line", href: `/members/${m.id}` },
                              ]}
                              ariaLabel="회원 관리 메뉴"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* 페이지네이션 */}
          {meta.totalPages > 1 && (
            <div className="pagination">
              <div className="page-info">
                {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.totalItems)} / 총 {meta.totalItems}명
              </div>
              <div className="page-buttons">
                <button
                  className="page-button"
                  aria-label="이전 페이지"
                  disabled={meta.page <= 1}
                  onClick={() => goPage(meta.page - 1)}
                >
                  <i className="ri-arrow-left-s-line" />
                </button>
                {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      className={`page-button${meta.page === p ? " active" : ""}`}
                      onClick={() => goPage(p)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  className="page-button"
                  aria-label="다음 페이지"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => goPage(meta.page + 1)}
                >
                  <i className="ri-arrow-right-s-line" />
                </button>
              </div>
            </div>
          )}
        </article>
      </section>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminShell>
  );
}

export default function AdminMembersPage() {
  return (
    <Suspense>
      <AdminMembersContent />
    </Suspense>
  );
}

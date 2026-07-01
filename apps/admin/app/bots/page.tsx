"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Select } from "@/components/ui/Select";
import { API_BASE_URL } from "../../lib/api";

/**
 * 활동 봇 목록 페이지 (Story 11.14).
 * GET /api/v1/admin/bots — 페르소나 목록·활성 토글.
 * super_admin 전용.
 */

// ── 로컬 타입 ─────────────────────────────────────────────────────────────────

interface AdminBotListItem {
  id: string;
  nickname: string;
  isActive: boolean;
  isAdminPersona: boolean;
  lastActiveAt: string | null;
  postCount: number;
  commentCount: number;
  genProvider: string | null;
  genModel: string | null;
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function formatDatetime(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

/** provider 슬러그 → 표시 라벨 */
const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

function providerLabel(provider: string | null): string {
  if (!provider) return "";
  return PROVIDER_LABEL[provider] ?? provider;
}

// ── 토스트 (화면 중앙 — 메모리 규칙) ────────────────────────────────────────────

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
        padding: "12px 20px",
        fontSize: 14,
        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 240,
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

function BotListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const statusParam = searchParams.get("status") ?? "all";
  const qParam = searchParams.get("q") ?? "";

  const [bots, setBots] = useState<AdminBotListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(qParam);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  const fetchBots = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("pageSize", "20");
      if (statusParam && statusParam !== "all") params.set("status", statusParam);
      if (qParam) params.set("q", qParam);

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("목록 조회 실패");
      const data = await res.json();
      setBots(data.items ?? []);
      setMeta(data.meta ?? { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    } catch {
      showToast("봇 목록을 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [pageParam, statusParam, qParam, showToast]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v && v !== "all" && v !== "") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`/bots?${next.toString()}`);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(p));
    router.push(`/bots?${next.toString()}`);
  }

  async function handleToggle(botId: string) {
    setToggling(botId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/${botId}/toggle`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBots((prev) =>
        prev.map((b) => (b.id === botId ? { ...b, isActive: data.isActive } : b)),
      );
      showToast(`봇이 ${data.isActive ? "활성화" : "비활성화"}되었습니다.`, "success");
    } catch {
      showToast("토글 중 오류가 발생했습니다.", "error");
    } finally {
      setToggling(null);
    }
  }

  return (
    <AdminShell breadcrumb={["관리자", "활동 봇"]} activeKey="bots">
      <div className="page-header">
        <div>
          <h1 className="page-title">활동 봇 관리</h1>
          <p className="page-description">
            시딩 봇 페르소나 목록을 확인하고 활성·비활성을 토글합니다. 상세에서 캐릭터 시트를 편집할 수 있습니다.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">봇 페르소나 목록</h2>
            <p className="section-description">닉네임 검색·상태 필터로 봇을 찾고, 토글로 즉시 활성 여부를 변경합니다.</p>
          </div>
        </div>

        <article className="card">
          {/* 필터·검색 패널 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input
                  className="control"
                  type="search"
                  placeholder="닉네임 검색"
                  aria-label="봇 닉네임 검색"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateParams({ q: searchInput });
                  }}
                />
              </div>

              {/* 상태 필터 — 디자인시스템 커스텀 드롭다운 (native select 금지) */}
              <div style={{ minWidth: 150 }}>
                <Select
                  value={statusParam}
                  onChange={(v) => updateParams({ status: v })}
                  options={[
                    { value: "all", label: "상태: 전체" },
                    { value: "active", label: "활성" },
                    { value: "inactive", label: "비활성" },
                  ]}
                />
              </div>

              <div className="filter-actions">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    router.push("/bots");
                  }}
                >
                  <i className="ri-refresh-line" />초기화
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
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
              <span className="selection-info">총 {meta.totalItems}개 봇 페르소나</span>
            </div>
          </div>

          {/* 봇 테이블 */}
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
                    <th>관리자봇</th>
                    <th>AI 모델</th>
                    <th>상태</th>
                    <th>최근 활동</th>
                    <th className="num">글 수</th>
                    <th className="num">댓글 수</th>
                    <th style={{ width: 90 }}>토글</th>
                    <th style={{ width: 80 }}>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {bots.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--gray-400)" }}>
                        봇 페르소나가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    bots.map((bot) => (
                      <tr key={bot.id}>
                        <td>
                          <Link href={`/bots/${bot.id}`} className="content-title">
                            <i className="ri-robot-line" style={{ marginRight: 6, opacity: 0.6 }} />
                            {bot.nickname}
                          </Link>
                        </td>
                        <td>
                          {bot.isAdminPersona ? (
                            <span className="badge badge-purple">관리자봇</span>
                          ) : (
                            <span className="badge badge-gray">일반봇</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, lineHeight: 1.4 }}>
                          {bot.genModel ? (
                            <>
                              <span style={{ fontWeight: 600 }}>{bot.genModel}</span>
                              {bot.genProvider && (
                                <span style={{ display: "block", color: "var(--gray-400)" }}>
                                  {providerLabel(bot.genProvider)}
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ color: "var(--gray-400)" }}>미배정</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${bot.isActive ? "badge-green" : "badge-orange"}`}>
                            {bot.isActive ? "활성" : "비활성"}
                          </span>
                        </td>
                        <td className="num" style={{ fontSize: 12 }}>
                          {formatDatetime(bot.lastActiveAt)}
                        </td>
                        <td className="num">{bot.postCount.toLocaleString()}</td>
                        <td className="num">{bot.commentCount.toLocaleString()}</td>
                        <td>
                          <button
                            className={`btn btn-sm ${bot.isActive ? "btn-outline" : "btn-primary"}`}
                            type="button"
                            disabled={toggling === bot.id}
                            onClick={() => handleToggle(bot.id)}
                          >
                            {toggling === bot.id ? (
                              <i className="ri-loader-4-line" />
                            ) : bot.isActive ? (
                              "비활성"
                            ) : (
                              "활성화"
                            )}
                          </button>
                        </td>
                        <td>
                          <Link href={`/bots/${bot.id}`} className="btn btn-sm btn-outline">
                            상세
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* 페이지네이션 */}
          {meta.totalPages > 1 && (
            <div className="pagination">
              <div className="page-info">
                {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.totalItems)} / 총{" "}
                {meta.totalItems}개
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

// ── 페이지 (Suspense 필수 — useSearchParams) ─────────────────────────────────

export default function AdminBotsPage() {
  return (
    <Suspense>
      <BotListContent />
    </Suspense>
  );
}

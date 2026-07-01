"use client";

/**
 * 봇 운영 패널 — Story 11.16
 *
 * 킬 스위치·관찰 모드·속도 안전선·비용 상한 설정과 오늘 활동 요약·보류 큐를 한 화면에서 제어.
 *
 * 라우트: /bots/operations (AdminShell 감싸기, super_admin 전용)
 *
 * AC 요약:
 *  - 킬 스위치(bot_master_enabled): 토글 즉시 저장 + 토스트
 *  - 관찰 모드(bot_observation_mode): 토글 즉시 저장
 *  - 속도 안전선(bot_daily_post_limit·bot_daily_comment_limit): 입력 + 저장 버튼
 *  - 비용 상한(bot_daily_cost_limit_usd): 입력 + 저장 버튼
 *  - 일일 리포트 요약: GET /admin/bots/report?date=오늘
 *  - 보류 큐 테이블: GET /admin/bots/hold-queue?decided=false (통과/폐기 버튼)
 *  - 비용 추이 차트: BotCostChart 컴포넌트
 *
 * RSC 경계 주의: 이 파일은 "use client" — next/headers import 금지.
 *
 * [Source: _bmad-output/implementation-artifacts/11-16-operations-panel.md]
 * [Source: apps/admin/app/settings/_components/SettingsTabPanels.tsx — Toast·저장 패턴]
 */

import { useEffect, useState, useCallback } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { confirmDialog } from "@/lib/dialog";
import { API_BASE_URL } from "@/lib/api";
import { BotCostChart } from "./BotCostChart";

// ── 로컬 타입 ─────────────────────────────────────────────────────────────────

interface BotSettings {
  bot_master_enabled?: boolean;
  bot_observation_mode?: boolean;
  bot_daily_post_limit?: number;
  bot_daily_comment_limit?: number;
  bot_daily_cost_limit_usd?: number;
  bot_exclude_from_ranking?: boolean;
  bot_auto_refill_topics?: boolean;
  bot_push_channel?: string;
}

interface DailyReport {
  date: string;
  posts: { published: number; blocked: number; held: number; discarded: number };
  comments: { published: number; blocked: number; held: number; discarded: number };
  holdQueuePending: number;
  totalCostUsd: number;
  status: "ok" | "warning";
}

interface HoldQueueItem {
  id: string;
  jobId: string;
  reason: string;
  decided: boolean;
  draftPreview: string | null;
  personaNickname: string | null;
  createdAt: string;
}

// ── 토스트 ─────────────────────────────────────────────────────────────────────

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
        background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
        color: "#fff",
        borderRadius: 8,
        padding: "14px 24px",
        fontSize: 14,
        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 240,
        pointerEvents: "none",
      }}
    >
      <i className={type === "success" ? "ri-check-line" : "ri-error-warning-line"} />
      {message}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function BotOperationsPage() {
  // ── 설정 상태 ─────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<BotSettings>({});
  const [settingsLoading, setSettingsLoading] = useState(true);

  // 속도·비용 카드 로컬 입력값 (저장 버튼 클릭 시 적용)
  const [postLimit, setPostLimit] = useState<number>(10);
  const [commentLimit, setCommentLimit] = useState<number>(40);
  const [costLimit, setCostLimit] = useState<number>(5.0);

  // ── 일일 리포트 상태 ──────────────────────────────────────────────────────────
  const [report, setReport] = useState<DailyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);

  // ── 보류 큐 상태 ──────────────────────────────────────────────────────────────
  const [holdItems, setHoldItems] = useState<HoldQueueItem[]>([]);
  const [holdLoading, setHoldLoading] = useState(true);

  // ── 토스트 ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // ── 설정 조회 ─────────────────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/settings`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data: BotSettings = await res.json();
      setSettings(data);
      setPostLimit(data.bot_daily_post_limit ?? 10);
      setCommentLimit(data.bot_daily_comment_limit ?? 40);
      setCostLimit(data.bot_daily_cost_limit_usd ?? 5.0);
    } catch {
      // 조용히 무시
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // ── 일일 리포트 조회 ──────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/report?date=${today}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      setReport(data as DailyReport);
    } catch {
      // 조용히 무시 — "집계 대기 중" 표시
    } finally {
      setReportLoading(false);
    }
  }, []);

  // ── 보류 큐 조회 ──────────────────────────────────────────────────────────────
  const fetchHoldQueue = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/hold-queue?decided=false&pageSize=20`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      setHoldItems(data.items ?? []);
    } catch {
      // 조용히 무시
    } finally {
      setHoldLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchReport();
    fetchHoldQueue();
  }, [fetchSettings, fetchReport, fetchHoldQueue]);

  // ── 설정 저장 헬퍼 ────────────────────────────────────────────────────────────
  const patchSettings = useCallback(
    async (patch: Partial<BotSettings>, label?: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          showToast(label ? `${label} 저장 실패` : "설정 저장 실패", "error");
          return false;
        }
        setSettings((prev) => ({ ...prev, ...patch }));
        showToast(label ? `${label} 저장됨` : "설정이 저장되었습니다.", "success");
        return true;
      } catch {
        showToast(label ? `${label} 저장 실패` : "설정 저장 실패", "error");
        return false;
      }
    },
    [showToast],
  );

  // ── 킬 스위치 토글 ────────────────────────────────────────────────────────────
  const handleMasterToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.checked;
    await patchSettings({ bot_master_enabled: newVal }, "킬 스위치");
  };

  // ── 관찰 모드 토글 ────────────────────────────────────────────────────────────
  const handleObservationToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.checked;
    await patchSettings({ bot_observation_mode: newVal }, "관찰 모드");
  };

  // ── 랭킹 제외 토글 ────────────────────────────────────────────────────────────
  const handleRankingExcludeToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.checked;
    await patchSettings({ bot_exclude_from_ranking: newVal }, "랭킹 제외");
  };

  // ── 속도 안전선 저장 ──────────────────────────────────────────────────────────
  const handleRateSave = async () => {
    await patchSettings(
      { bot_daily_post_limit: postLimit, bot_daily_comment_limit: commentLimit },
      "속도 안전선",
    );
  };

  // ── 비용 상한 저장 ────────────────────────────────────────────────────────────
  const handleCostSave = async () => {
    await patchSettings({ bot_daily_cost_limit_usd: costLimit }, "비용 상한");
  };

  // ── 보류 큐 통과 ──────────────────────────────────────────────────────────────
  const handleApprove = async (id: string) => {
    const ok = await confirmDialog({
      title: "보류 항목 통과",
      message: "이 항목을 게시하겠습니까?",
      confirmText: "통과",
      tone: "default",
    });
    if (!ok) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/hold-queue/${id}/approve`,
        { method: "PATCH", credentials: "include" },
      );
      if (!res.ok) {
        showToast("통과 처리 실패", "error");
        return;
      }
      showToast("통과 처리됨", "success");
      await fetchHoldQueue();
    } catch {
      showToast("통과 처리 실패", "error");
    }
  };

  // ── 보류 큐 폐기 ──────────────────────────────────────────────────────────────
  const handleDiscard = async (id: string) => {
    const ok = await confirmDialog({
      title: "보류 항목 폐기",
      message: "이 항목을 영구 폐기하겠습니까? 복구할 수 없습니다.",
      confirmText: "폐기",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/admin/bots/hold-queue/${id}/discard`,
        { method: "PATCH", credentials: "include" },
      );
      if (!res.ok) {
        showToast("폐기 처리 실패", "error");
        return;
      }
      showToast("폐기 처리됨", "success");
      await fetchHoldQueue();
    } catch {
      showToast("폐기 처리 실패", "error");
    }
  };

  // ── 렌더 ──────────────────────────────────────────────────────────────────────

  return (
    <AdminShell breadcrumb={["활동 봇", "운영 패널"]} activeKey="bots" activeSubKey="operations">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="page-header">
        <h1 className="page-title">봇 운영 패널</h1>
        <div className="page-subtitle">킬 스위치·속도·비용·보류 큐를 한 화면에서 제어합니다.</div>
      </div>

      <div style={{ display: "grid", gap: 20 }}>

        {/* ── 컨트롤 카드 행 ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>

          {/* 킬 스위치 카드 */}
          <article className="card">
            <div className="card-header">
              <h2 className="card-title">킬 스위치</h2>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label className="toggle-label" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={settings.bot_master_enabled ?? false}
                    onChange={handleMasterToggle}
                    disabled={settingsLoading}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontWeight: 500 }}>
                    봇 전체 가동 {settings.bot_master_enabled ? "ON" : "OFF"}
                  </span>
                </label>
              </div>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--gray-500, #6b7280)" }}>
                OFF 시 모든 봇 활동이 즉시 중단됩니다.
              </p>
            </div>
          </article>

          {/* 관찰 모드 카드 */}
          <article className="card">
            <div className="card-header">
              <h2 className="card-title">관찰 모드</h2>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label className="toggle-label" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={settings.bot_observation_mode ?? false}
                    onChange={handleObservationToggle}
                    disabled={settingsLoading}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontWeight: 500 }}>
                    관찰 모드 {settings.bot_observation_mode ? "ON" : "OFF"}
                  </span>
                </label>
              </div>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--gray-500, #6b7280)" }}>
                ON 시 모든 봇 글·댓글을 게시 전 보류 큐로 적재합니다.
              </p>
            </div>
          </article>

          {/* 랭킹 제외 카드 */}
          <article className="card">
            <div className="card-header">
              <h2 className="card-title">랭킹 제외</h2>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label className="toggle-label" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={settings.bot_exclude_from_ranking ?? true}
                    onChange={handleRankingExcludeToggle}
                    disabled={settingsLoading}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontWeight: 500 }}>
                    봇 랭킹 제외 {settings.bot_exclude_from_ranking ? "ON" : "OFF"}
                  </span>
                </label>
              </div>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--gray-500, #6b7280)" }}>
                ON 시 봇 활동이 등급·랭킹 집계에서 제외됩니다.
              </p>
            </div>
          </article>
        </div>

        {/* ── 속도 안전선 + 비용 상한 행 ────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>

          {/* 속도 안전선 카드 */}
          <article className="card">
            <div className="card-header">
              <h2 className="card-title">속도 안전선</h2>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                  하루 최대 글 수
                </label>
                <input
                  type="number"
                  min={1}
                  value={postLimit}
                  onChange={(e) => setPostLimit(Number(e.target.value))}
                  className="form-input"
                  style={{ width: "100%", maxWidth: 160 }}
                  disabled={settingsLoading}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                  하루 최대 댓글 수
                </label>
                <input
                  type="number"
                  min={1}
                  value={commentLimit}
                  onChange={(e) => setCommentLimit(Number(e.target.value))}
                  className="form-input"
                  style={{ width: "100%", maxWidth: 160 }}
                  disabled={settingsLoading}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ alignSelf: "flex-start" }}
                onClick={handleRateSave}
                disabled={settingsLoading}
              >
                저장
              </button>
            </div>
          </article>

          {/* 비용 상한 카드 */}
          <article className="card">
            <div className="card-header">
              <h2 className="card-title">비용 상한</h2>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                  일일 비용 상한 (달러)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={costLimit}
                  onChange={(e) => setCostLimit(parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ width: "100%", maxWidth: 160 }}
                  disabled={settingsLoading}
                />
              </div>
              {report && (
                <div style={{ fontSize: 13, color: "var(--gray-600, #4b5563)" }}>
                  오늘 누적 비용:{" "}
                  <strong style={{ color: "var(--primary-700, #1d4ed8)" }}>
                    ${report.totalCostUsd.toFixed(4)}
                  </strong>
                </div>
              )}
              <button
                type="button"
                className="btn btn-primary"
                style={{ alignSelf: "flex-start" }}
                onClick={handleCostSave}
                disabled={settingsLoading}
              >
                저장
              </button>
            </div>
          </article>
        </div>

        {/* ── 일일 리포트 요약 카드 ─────────────────────────────────────── */}
        <article className="card">
          <div className="card-header">
            <h2 className="card-title">오늘 활동 요약</h2>
            <div className="card-subtitle">{new Date().toISOString().slice(0, 10)} 기준</div>
          </div>
          <div className="card-body">
            {reportLoading ? (
              <p style={{ color: "var(--gray-500, #6b7280)", fontSize: 14 }}>집계 중...</p>
            ) : report ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 16,
                }}
              >
                <div className="stat-item">
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--primary-600, #2563eb)" }}>
                    {report.posts.published}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray-500, #6b7280)" }}>발행 글</div>
                </div>
                <div className="stat-item">
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--primary-600, #2563eb)" }}>
                    {report.comments.published}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray-500, #6b7280)" }}>발행 댓글</div>
                </div>
                <div className="stat-item">
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: report.holdQueuePending > 0 ? "var(--warning, #d97706)" : "var(--gray-400, #9ca3af)",
                    }}
                  >
                    {report.holdQueuePending}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray-500, #6b7280)" }}>보류 대기</div>
                </div>
                <div className="stat-item">
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color:
                        report.posts.blocked + report.comments.blocked > 0
                          ? "var(--danger, #dc2626)"
                          : "var(--gray-400, #9ca3af)",
                    }}
                  >
                    {report.posts.blocked + report.comments.blocked}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray-500, #6b7280)" }}>차단</div>
                </div>
                <div className="stat-item">
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gray-700, #374151)" }}>
                    ${report.totalCostUsd.toFixed(4)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray-500, #6b7280)" }}>누적 비용</div>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--gray-500, #6b7280)", fontSize: 14 }}>집계 대기 중</p>
            )}
          </div>
        </article>

        {/* ── 비용 추이 차트 ────────────────────────────────────────────── */}
        <BotCostChart />

        {/* ── 보류 큐 테이블 ────────────────────────────────────────────── */}
        <article className="card">
          <div className="card-header">
            <h2 className="card-title">보류 큐</h2>
            <div className="card-subtitle">결정 대기 중인 봇 콘텐츠</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {holdLoading ? (
              <p style={{ padding: 20, color: "var(--gray-500, #6b7280)", fontSize: 14 }}>
                불러오는 중...
              </p>
            ) : holdItems.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "var(--gray-400, #9ca3af)",
                  fontSize: 14,
                }}
              >
                <i className="ri-inbox-line" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                보류 항목 없음
              </div>
            ) : (
              <div className="data-table-wrap" style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>사유</th>
                      <th>내용 미리보기</th>
                      <th>봇 닉네임</th>
                      <th>보류 시각</th>
                      <th>액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span
                            className="badge badge-warning"
                            style={{ background: "var(--warning-100,#fef3c7)", color: "var(--warning-700,#92400e)", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 500 }}
                          >
                            {item.reason}
                          </span>
                        </td>
                        <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "var(--gray-700, #374151)" }}>
                          {item.draftPreview ?? "(미리보기 없음)"}
                        </td>
                        <td style={{ fontSize: 13 }}>{item.personaNickname ?? "(알 수 없음)"}</td>
                        <td style={{ fontSize: 12, color: "var(--gray-500, #6b7280)", whiteSpace: "nowrap" }}>
                          {new Date(item.createdAt).toLocaleString("ko-KR", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            style={{ marginRight: 6 }}
                            onClick={() => handleApprove(item.id)}
                          >
                            통과
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDiscard(item.id)}
                          >
                            폐기
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </article>

      </div>
    </AdminShell>
  );
}

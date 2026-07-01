"use client";

/**
 * AI 비용 요약 위젯 — Story 11.19 Task 4
 *
 * 메인 대시보드에 삽입되는 AI 비용 카드.
 * 오늘 누적 비용 · 이번 달 누적 비용 · 일일 상한 대비 진행바 · 7일 미니 추이 차트 표시.
 *
 * RSC 경계: "use client" 필수 (createLineChart = DOM 조작). next/headers import 금지.
 * API 오류/404 시 "집계 대기 중" 플레이스홀더 조용히 표시.
 *
 * [Source: .claude/memory/admin-rsc-boundary-build-traps.md]
 * [Source: apps/admin/components/stats/VisitorTrendChart.tsx] — createLineChart 패턴
 */

import { useEffect, useRef, useState } from "react";
import { createLineChart } from "@ai-jakdang/admin-design-system/js/chart.js";
import { API_BASE_URL } from "@/lib/api";
import type { AiUsageReport } from "@ai-jakdang/contracts";

type ChartInstance = ReturnType<typeof createLineChart>;

/** $N.NNNNNN → "$0.0015" 표기 (소수 4자리). */
function fmtUsd(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

/** 진행바 퍼센트 (0 ~ 100, 상한 초과 시 100 클램프). */
function limitPercent(today: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((today / limit) * 100));
}

export function AiCostWidget() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [report7d, setReport7d] = useState<AiUsageReport | null>(null);
  const [reportMonth, setReportMonth] = useState<AiUsageReport | null>(null);
  const [loading, setLoading] = useState(true);

  // ── 데이터 fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [r7d, rMonth] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/admin/ai-usage?range=7d`, { credentials: "include" })
            .then((r) => (r.ok ? (r.json() as Promise<AiUsageReport>) : null))
            .catch(() => null),
          fetch(`${API_BASE_URL}/api/v1/admin/ai-usage?range=month`, { credentials: "include" })
            .then((r) => (r.ok ? (r.json() as Promise<AiUsageReport>) : null))
            .catch(() => null),
        ]);
        if (!cancelled) {
          setReport7d(r7d);
          setReportMonth(rMonth);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  // ── 미니 차트 (7일 일별 추이) ─────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !report7d) return;

    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary-600").trim() || "#2563eb";

    const daily = report7d.daily;

    const chartData = {
      labels: daily.map((d) => d.date.slice(5)), // MM-DD
      series: [
        {
          values: daily.map((d) => d.costUsd),
          color: primary,
          fill: "rgba(37,99,235,0.15)",
        },
      ],
    };

    const placeholder = {
      labels: ["..."],
      series: [{ values: [0], color: primary, fill: "rgba(37,99,235,0.15)" }],
    };

    const initialData = daily.length > 0 ? chartData : placeholder;
    let chart: ChartInstance | null = null;
    let destroyed = false;

    try {
      chart = createLineChart(canvasRef.current, initialData);
    } catch {
      // 캔버스 초기화 실패 시 조용히 무시
    }

    return () => {
      destroyed = true;
      if (chart && !destroyed) {
        try { chart.destroy(); } catch { /* ignore */ }
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      void destroyed;
    };
  }, [report7d]);

  // ── 플레이스홀더 ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <article className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">AI 비용</h2>
            <div className="card-subtitle">로딩 중...</div>
          </div>
        </div>
        <div className="card-body" style={{ minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "var(--gray-400)", fontSize: "0.875rem" }}>데이터를 불러오는 중입니다.</span>
        </div>
      </article>
    );
  }

  if (!report7d && !reportMonth) {
    return (
      <article className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">AI 비용</h2>
            <div className="card-subtitle">AI 사용량 모니터링</div>
          </div>
        </div>
        <div className="card-body" style={{ minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "var(--gray-400)", fontSize: "0.875rem" }}>집계 대기 중</span>
        </div>
      </article>
    );
  }

  const todayCostUsd = report7d?.todayVsLimit.todayCostUsd ?? 0;
  const dailyLimitUsd = report7d?.todayVsLimit.dailyLimitUsd ?? 0;
  const monthCostUsd = reportMonth?.totals.costUsd ?? 0;
  const limitPct = limitPercent(todayCostUsd, dailyLimitUsd);
  const isOverLimit = dailyLimitUsd > 0 && todayCostUsd >= dailyLimitUsd;

  return (
    <article className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">AI 비용</h2>
          <div className="card-subtitle">AI 사용량 모니터링</div>
        </div>
        <a href="/bots/ai-usage" className="btn btn-ghost btn-sm">상세 보기</a>
      </div>
      <div className="card-body">
        {/* 오늘 / 이번 달 요약 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div className="stat-card" style={{ padding: "0.75rem" }}>
            <div className="stat-label" style={{ fontSize: "0.75rem" }}>오늘 누적</div>
            <div className="stat-value" style={{ fontSize: "1.25rem" }}>{fmtUsd(todayCostUsd)}</div>
          </div>
          <div className="stat-card" style={{ padding: "0.75rem" }}>
            <div className="stat-label" style={{ fontSize: "0.75rem" }}>이번 달 누적</div>
            <div className="stat-value" style={{ fontSize: "1.25rem" }}>{fmtUsd(monthCostUsd)}</div>
          </div>
        </div>

        {/* 일일 상한 진행바 */}
        {dailyLimitUsd > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--gray-500)", marginBottom: "0.25rem" }}>
              <span>일일 상한 대비</span>
              <span style={{ color: isOverLimit ? "var(--danger)" : undefined }}>
                {fmtUsd(todayCostUsd)} / {fmtUsd(dailyLimitUsd)} ({limitPct}%)
              </span>
            </div>
            <div style={{ height: 6, background: "var(--gray-100)", borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${limitPct}%`,
                  background: isOverLimit ? "var(--danger)" : limitPct > 80 ? "var(--warning)" : "var(--primary-600)",
                  borderRadius: 4,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        )}

        {/* 7일 미니 차트 */}
        <div style={{ height: 80 }}>
          <canvas ref={canvasRef} aria-label="7일 AI 비용 추이 미니 차트" style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
    </article>
  );
}

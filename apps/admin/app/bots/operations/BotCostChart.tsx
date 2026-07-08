"use client";

/**
 * 7일 봇 비용 추이 차트 — Story 11.16 Task 6
 *
 * createLineChart(디자인 시스템 꺾은선 함수)를 재사용한다. Recharts 금지.
 * GET /api/v1/admin/bots/report?range=7d 호출 — 11.17 미완성(404) 시 플레이스홀더 유지.
 *
 * Story 11.19(AI 사용량)에서 이 컴포넌트를 재사용 예정.
 *
 * [Source: apps/admin/components/stats/VisitorTrendChart.tsx — createLineChart 패턴]
 * [Source: _bmad-output/implementation-artifacts/11-16-operations-panel.md#Task6]
 */

import { useEffect, useRef } from "react";
import { createLineChart } from "@ai-jakdang/admin-design-system/js/chart.js";
import { API_BASE_URL } from "@/lib/api";

type ChartInstance = ReturnType<typeof createLineChart>;

export function BotCostChart() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary-600").trim() || "#2563eb";

    const placeholder = {
      labels: ["..."],
      series: [
        { values: [0], color: primary, fill: "rgba(37,99,235,0.18)" },
      ],
    };

    let chart: ChartInstance = createLineChart(canvasRef.current, placeholder);
    let destroyed = false;

    const loadData = async () => {
      try {
        // 비용(달러) + 환율(달러당 원)을 함께 조회해 원화로 환산 표기
        const [res, rateRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/admin/bots/report?range=7d`, { credentials: "include" }),
          fetch(`${API_BASE_URL}/api/v1/admin/exchange-rate`, { credentials: "include" }).catch(() => null),
        ]);
        if (!res.ok || destroyed) return;
        const data = await res.json();
        if (destroyed) return;

        // 환율(실패 시 폴백 1400)
        let rate = 1400;
        if (rateRes && rateRes.ok) {
          const r = (await rateRes.json()) as { usdKrw?: number };
          if (r.usdKrw && r.usdKrw > 0) rate = r.usdKrw;
        }

        const days: Array<{ date: string; costUsd?: number }> = data.days ?? [];
        if (days.length === 0) return; // 데이터 없으면 플레이스홀더 유지

        chart.setData({
          labels: days.map((d) => d.date.slice(5)), // MM-DD
          series: [
            {
              values: days.map((d) => Math.round((d.costUsd ?? 0) * rate)), // 원화 환산
              color: primary,
              fill: "rgba(37,99,235,0.18)",
            },
          ],
        });
      } catch {
        // 조용히 무시 — 11.17 미구현 404 포함
      }
    };

    loadData();

    return () => {
      destroyed = true;
      chart.destroy();
    };
  }, []);

  return (
    <article className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">7일 비용 추이</h2>
          <div className="card-subtitle">일별 AI API 비용(원화 환산)</div>
        </div>
      </div>
      <div className="card-body">
        <div className="chart-wrap">
          <canvas
            ref={canvasRef}
            aria-label="7일 봇 비용 추이 꺾은선 차트"
          />
        </div>
        <div className="chart-legend">
          <span className="legend-item">
            <span
              className="legend-dot"
              style={{ background: "var(--primary-600)" }}
            />
            일별 비용(원)
          </span>
        </div>
      </div>
    </article>
  );
}

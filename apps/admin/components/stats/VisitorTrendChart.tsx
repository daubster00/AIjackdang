"use client";

import { useEffect, useRef, useState } from "react";
import { createLineChart } from "@ai-jakdang/admin-design-system/js/chart.js";
import { API_BASE_URL } from "@/lib/api";
import type { VisitorTrendResponse, VisitorTrendItem } from "@ai-jakdang/contracts";

/**
 * 접속 통계용 방문자 추이 차트 — page_views 집계 실데이터를 표시한다.
 * 세그먼트(7d/30d/thismonth) 변경 시 API를 재호출해 차트를 갱신한다.
 *
 * a = 고유 방문자 수(visitors), b = 페이지뷰(PV)
 */

/** 세그먼트 키 → { from, to } (UTC 날짜 문자열) */
function getFromTo(range: string): { from: string; to: string } {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  if (range === "thismonth") {
    const from = new Date(now);
    from.setUTCDate(1);
    return { from: fmt(from), to: fmt(now) };
  }

  const days = range === "7d" ? 7 : 30;
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: fmt(from), to: fmt(now) };
}

type ChartInstance = ReturnType<typeof createLineChart>;

/** YYYY-MM-DD → "M월 D일 (요일)" 표기 */
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return iso;
  // 요일 계산은 UTC 기준(집계가 UTC 날짜라 표시도 UTC로 맞춘다)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}월 ${d}일 (${WEEKDAYS[wd]})`;
}

export function VisitorTrendChart() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [items, setItems] = useState<VisitorTrendItem[]>([]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const css     = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary-600").trim() || "#2563eb";
    const accent  = css.getPropertyValue("--brand-accent").trim() || "#06b6d4";

    const toChartData = (data: VisitorTrendResponse) => ({
      labels: data.items.map((it) => it.date.slice(5)),  // MM-DD
      series: [
        { name: "방문자수", values: data.items.map((it) => it.visitors),  color: primary, fill: "rgba(37,99,235,0.18)" },
        { name: "페이지뷰", values: data.items.map((it) => it.pageViews), color: accent,  fill: "rgba(6,182,212,0.13)" },
      ],
    });

    const placeholder = {
      labels: ["..."],
      series: [
        { name: "방문자수", values: [0], color: primary, fill: "rgba(37,99,235,0.18)" },
        { name: "페이지뷰", values: [0], color: accent,  fill: "rgba(6,182,212,0.13)" },
      ],
    };

    let chart: ChartInstance = createLineChart(canvasRef.current, placeholder);
    let destroyed = false;

    const loadData = async (range: string) => {
      try {
        const { from, to } = getFromTo(range);
        const res = await fetch(
          `${API_BASE_URL}/api/v1/admin/analytics/visitor-trend?from=${from}&to=${to}`,
          { credentials: "include" },
        );
        if (!res.ok || destroyed) return;
        const data = (await res.json()) as VisitorTrendResponse;
        if (destroyed) return;
        chart.setData(toChartData(data));
        setItems(data.items);
      } catch {
        // 조용히 무시
      }
    };

    loadData("30d"); // 기본: 30일

    // 디자인 시스템 JS가 세그먼트 클릭 시 발생시키는 이벤트
    const onSegmentChange = (e: Event) => {
      const detail = (e as CustomEvent<{ value: string }>).detail;
      loadData(detail.value);
    };
    document.addEventListener("admin:segment-change", onSegmentChange);

    return () => {
      destroyed = true;
      document.removeEventListener("admin:segment-change", onSegmentChange);
      chart.destroy();
    };
  }, []);

  return (
    <article className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">방문자 추이</h2>
          <div className="card-subtitle">방문자수와 페이지뷰 변화</div>
        </div>
        <div className="segmented" role="tablist" aria-label="추이 기간">
          <button className="segment" data-range="7d">
            7일
          </button>
          <button className="segment active" data-range="30d">
            30일
          </button>
          <button className="segment" data-range="thismonth">
            이번달
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="chart-wrap">
          <canvas ref={canvasRef} aria-label="방문자수·페이지뷰 추이 선 그래프" />
        </div>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "var(--primary-600)" }} />
            방문자수
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "var(--brand-accent)" }} />
            페이지뷰
          </span>
        </div>

        {/* 날짜별 방문자 목록 — 그래프에 표시된 기간과 동일한 데이터, 최신순 */}
        <div className="visitor-trend-table" style={{ marginTop: "1.25rem" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--gray-600)",
              marginBottom: "0.5rem",
            }}
          >
            날짜별 방문자
          </div>
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th style={{ textAlign: "right" }}>방문자수</th>
                  <th style={{ textAlign: "right" }}>페이지뷰</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "var(--gray-400)", padding: "1.5rem" }}>
                      방문 로그가 누적되면 날짜별 방문자 수가 표시됩니다.
                    </td>
                  </tr>
                ) : (
                  [...items].reverse().map((it) => (
                    <tr key={it.date}>
                      <td>{formatDateLabel(it.date)}</td>
                      <td className="num" style={{ textAlign: "right" }}>
                        <strong>{it.visitors.toLocaleString("ko-KR")}</strong>명
                      </td>
                      <td className="num" style={{ textAlign: "right", color: "var(--gray-500)" }}>
                        {it.pageViews.toLocaleString("ko-KR")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </article>
  );
}

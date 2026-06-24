"use client";

/**
 * 기간별 접속 통계 개요 차트 (Story 9.5 AC#3, AC#5).
 *
 * analytics/overview API 응답 데이터를 디자인 시스템 createLineChart로 시각화한다.
 * recharts는 apps/admin에 없으므로 기존 admin-design-system 차트를 사용한다.
 * 신규 가입자(newUsers), 신규 게시글(newPosts), 다운로드(downloads) 3개 시리즈.
 */

import { useEffect, useRef } from "react";
import { createLineChart } from "@ai-jakdang/admin-design-system/js/chart.js";
import type { AnalyticsOverviewItem } from "@ai-jakdang/contracts";

interface AnalyticsOverviewChartProps {
  items: AnalyticsOverviewItem[];
}

export function AnalyticsOverviewChart({ items }: AnalyticsOverviewChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || items.length === 0) return;

    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary-600").trim() || "#2563eb";
    const accent = css.getPropertyValue("--brand-accent").trim() || "#06b6d4";
    const success = css.getPropertyValue("--success").trim() || "#16a34a";

    const chart = createLineChart(canvasRef.current, {
      labels: items.map((item) => item.date.slice(5)), // MM-DD 형식
      series: [
        {
          values: items.map((item) => item.newUsers),
          color: primary,
          fill: "rgba(37,99,235,0.18)",
        },
        {
          values: items.map((item) => item.newPosts),
          color: accent,
          fill: "rgba(6,182,212,0.13)",
        },
        {
          values: items.map((item) => item.downloads),
          color: success,
          fill: "rgba(22,163,74,0.10)",
        },
      ],
    });

    return () => {
      chart.destroy();
    };
  }, [items]);

  return (
    <article className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">기간별 현황</h2>
          <div className="card-subtitle">신규 가입·게시글·다운로드 추이</div>
        </div>
      </div>
      <div className="card-body">
        <div className="chart-wrap">
          <canvas ref={canvasRef} aria-label="기간별 신규 가입·게시글·다운로드 선 그래프" role="img" />
        </div>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "var(--primary-600)" }} />
            신규 가입
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "var(--brand-accent)" }} />
            신규 게시글
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "var(--success)" }} />
            다운로드
          </span>
        </div>

        {/* 접근성 대체 수치 테이블 (UX-DR-A11) — 시각적으로 숨기되 스크린리더에서 읽힘 */}
        <div aria-live="polite" style={{ overflowX: "auto", marginTop: 12 }}>
          <table
            className="admin-table"
            aria-label="기간별 신규 가입·게시글·다운로드 수치 데이터"
            style={{ fontSize: 12 }}
          >
            <caption className="sr-only">
              기간별 일별 신규 가입자 수, 신규 게시글 수, 다운로드 수
            </caption>
            <thead>
              <tr>
                <th scope="col">날짜</th>
                <th scope="col">신규 가입</th>
                <th scope="col">신규 게시글</th>
                <th scope="col">다운로드</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.date}>
                  <td>{item.date}</td>
                  <td className="num">{item.newUsers.toLocaleString("ko-KR")}</td>
                  <td className="num">{item.newPosts.toLocaleString("ko-KR")}</td>
                  <td className="num">{item.downloads.toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}

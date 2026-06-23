"use client";

import { useEffect, useRef } from "react";
import { createLineChart } from "@ai-jakdang/admin-design-system/js/chart.js";

/**
 * 방문자 추이 카드 — 디자인 시스템의 선/면적 차트(createLineChart)와 세그먼트 컨트롤을 묶는다.
 * 세그먼트(7/30/90일) active 전환과 'admin:segment-change' 이벤트는 디자인 시스템 JS(initTabs)가 처리하고,
 * 이 컴포넌트는 그 이벤트를 받아 차트 데이터만 교체한다(데모와 동일한 패턴).
 */

// range(기간, 일 수) 별 더미 데이터: a=신규 방문자, b=재방문자
const DATASET: Record<number, { labels: string[]; a: number[]; b: number[] }> = {
  7: {
    labels: ["6/12", "6/13", "6/14", "6/15", "6/16", "6/17", "6/18"],
    a: [620, 710, 680, 790, 870, 940, 1030],
    b: [260, 320, 300, 350, 420, 450, 510],
  },
  30: {
    labels: ["5/20", "5/24", "5/28", "6/1", "6/5", "6/9", "6/13", "6/18"],
    a: [480, 540, 510, 650, 710, 790, 880, 1030],
    b: [180, 230, 210, 270, 310, 360, 420, 510],
  },
  90: {
    labels: ["3월", "3월말", "4월", "4월말", "5월", "5월말", "6월초", "현재"],
    a: [220, 300, 390, 470, 590, 710, 860, 1030],
    b: [80, 110, 150, 210, 270, 330, 410, 510],
  },
};

export function TrafficChart() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary-600").trim() || "#2563eb";
    const accent = css.getPropertyValue("--brand-accent").trim() || "#06b6d4";

    const seriesFor = (range: number) => {
      const d = DATASET[range] ?? DATASET[30];
      return {
        labels: d.labels,
        series: [
          { values: d.a, color: primary, fill: "rgba(37,99,235,0.18)" },
          { values: d.b, color: accent, fill: "rgba(6,182,212,0.13)" },
        ],
      };
    };

    const chart = createLineChart(canvasRef.current, seriesFor(30));

    const onSegmentChange = (e: Event) => {
      const detail = (e as CustomEvent<{ value: string }>).detail;
      chart.setData(seriesFor(Number(detail.value)));
    };
    document.addEventListener("admin:segment-change", onSegmentChange);

    return () => {
      document.removeEventListener("admin:segment-change", onSegmentChange);
      chart.destroy();
    };
  }, []);

  return (
    <article className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">방문자 추이</h2>
          <div className="card-subtitle">신규 방문자와 재방문자 변화</div>
        </div>
        <div className="segmented" role="tablist" aria-label="통계 기간">
          <button className="segment" data-range="7">
            7일
          </button>
          <button className="segment active" data-range="30">
            30일
          </button>
          <button className="segment" data-range="90">
            90일
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="chart-wrap">
          <canvas ref={canvasRef} aria-label="방문자 추이 선 그래프" />
        </div>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "var(--primary-600)" }} />
            신규 방문자
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "var(--brand-accent)" }} />
            재방문자
          </span>
        </div>
      </div>
    </article>
  );
}

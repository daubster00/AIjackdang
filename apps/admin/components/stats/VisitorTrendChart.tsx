"use client";

import { useEffect, useRef } from "react";
import { createLineChart } from "@ai-jakdang/admin-design-system/js/chart.js";

/**
 * 접속 통계용 방문자 추이 차트 — 디자인 시스템의 선/면적 차트(createLineChart)를 사용한다.
 * 대시보드의 TrafficChart 패턴을 그대로 따르되, 이 페이지는 기간 필터를 세그먼트로 두고
 * 'admin:segment-change' 이벤트(디자인 시스템 JS initTabs가 발생)를 받아 데이터만 교체한다.
 * a = 방문자수(고유 방문자), b = 페이지뷰(PV)
 */

// range(기간 키) 별 더미 데이터. 세그먼트의 data-range 값과 1:1 매칭된다.
const DATASET: Record<string, { labels: string[]; a: number[]; b: number[] }> = {
  // 최근 7일: 일자별 방문자수 / 페이지뷰
  "7d": {
    labels: ["6/12", "6/13", "6/14", "6/15", "6/16", "6/17", "6/18"],
    a: [1180, 1240, 1090, 1360, 1420, 1510, 1284],
    b: [5820, 6010, 5340, 6630, 7020, 7440, 6842],
  },
  // 최근 30일: 약 4일 간격 샘플
  "30d": {
    labels: ["5/20", "5/24", "5/28", "6/1", "6/5", "6/9", "6/13", "6/18"],
    a: [980, 1040, 910, 1150, 1230, 1310, 1290, 1284],
    b: [4480, 4960, 4210, 5470, 5980, 6360, 6420, 6842],
  },
  // 이번 달: 주차별 누적 추세
  thismonth: {
    labels: ["6/1", "6/4", "6/7", "6/10", "6/13", "6/16", "6/18"],
    a: [1150, 1210, 1080, 1240, 1290, 1380, 1284],
    b: [5470, 5710, 5040, 5980, 6420, 6710, 6842],
  },
};

export function VisitorTrendChart() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary-600").trim() || "#2563eb";
    const accent = css.getPropertyValue("--brand-accent").trim() || "#06b6d4";

    const seriesFor = (range: string) => {
      const d = DATASET[range] ?? DATASET["30d"];
      return {
        labels: d.labels,
        series: [
          { values: d.a, color: primary, fill: "rgba(37,99,235,0.18)" },
          { values: d.b, color: accent, fill: "rgba(6,182,212,0.13)" },
        ],
      };
    };

    const chart = createLineChart(canvasRef.current, seriesFor("30d"));

    // 디자인 시스템 JS가 세그먼트 클릭 시 발생시키는 이벤트를 받아 데이터만 교체한다.
    const onSegmentChange = (e: Event) => {
      const detail = (e as CustomEvent<{ value: string }>).detail;
      chart.setData(seriesFor(detail.value));
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
      </div>
    </article>
  );
}

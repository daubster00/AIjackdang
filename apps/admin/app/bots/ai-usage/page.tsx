"use client";

/**
 * AI 사용량·비용 상세 페이지 — Story 11.19 Task 5
 *
 * 기간 토글 (오늘/7일/30일/이번달) + 집계 표시:
 *  - 상단 요약 카드 4종 (총 비용·총 호출·총 토큰·일일 상한 대비)
 *  - 모델별/제공자별/용도별 비용·호출·토큰 표 (data-table, 비용 내림차순)
 *  - 일별 비용 추이 차트 (createLineChart)
 *  - 비용 상한 게이지 (오늘 누적 vs bot_daily_cost_limit_usd)
 *
 * RSC 경계: "use client" 필수. next/headers import 금지.
 * 레거시 table.js 충돌 방지: 정렬은 JS 데이터로 처리, DOM 변형 라이브러리 미사용.
 *
 * [Source: .claude/memory/admin-rsc-boundary-build-traps.md]
 * [Source: .claude/memory/legacy-designsystem-js-vs-react-dom-conflict.md]
 * [Source: .claude/memory/toast-notifications-center.md]
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createLineChart } from "@ai-jakdang/admin-design-system/js/chart.js";
import { AdminShell } from "@/components/layout/AdminShell";
import { API_BASE_URL } from "@/lib/api";
import type { AiUsageReport } from "@ai-jakdang/contracts";

type ChartInstance = ReturnType<typeof createLineChart>;
type Range = "today" | "7d" | "30d" | "month";

const RANGE_LABELS: Record<Range, string> = {
  today: "오늘",
  "7d": "7일",
  "30d": "30일",
  month: "이번 달",
};

// ── AI 제공사 크레딧·충전 메타 ────────────────────────────────────────────────
//
// 잔여 충전 잔액(남은 크레딧 금액)은 세 제공사 모두 표준 API 키로 조회할 수 있는
// 공개 API가 없다(OpenAI 구 billing 엔드포인트는 세션키 필요·폐기, Anthropic·Google은
// 잔액 API 미제공). 따라서 여기서는 우리 봇이 실제로 사용한 비용/호출/토큰(ai_usage_log
// 기반 byProvider 집계)만 보여주고, 잔액 확인·충전은 각 제공사 결제 콘솔로 바로가기 링크를 건다.
//
// provider 키는 ai_usage_log.provider 에 기록되는 값과 일치해야 한다: openai | anthropic | google.

type ProviderMeta = {
  key: string; // ai_usage_log.provider 값
  label: string; // 화면 표기 제공사명
  desc: string; // 어떤 AI인지 짧은 설명
  icon: string; // remixicon 클래스
  color: string; // 브랜드 색 (아이콘/버튼 강조)
  billingUrl: string; // 크레딧 충전·결제 대시보드 URL (새 탭)
  billingLabel: string; // 링크 버튼 라벨
};

const PROVIDER_META: ProviderMeta[] = [
  {
    key: "anthropic",
    label: "Anthropic · Claude",
    desc: "글 작성·검열 등 텍스트 생성",
    icon: "ri-sparkling-2-line",
    color: "#d97757",
    billingUrl: "https://console.anthropic.com/settings/billing",
    billingLabel: "Anthropic 콘솔에서 충전",
  },
  {
    key: "openai",
    label: "OpenAI · ChatGPT",
    desc: "텍스트·이미지(gpt-image) 생성",
    icon: "ri-cpu-line",
    color: "#10a37f",
    billingUrl: "https://platform.openai.com/settings/organization/billing/overview",
    billingLabel: "OpenAI 결제 페이지에서 충전",
  },
  {
    key: "google",
    label: "Google · Gemini",
    desc: "텍스트·이미지(Gemini) 생성",
    icon: "ri-google-line",
    color: "#4285f4",
    billingUrl: "https://console.cloud.google.com/billing",
    billingLabel: "Google Cloud 결제에서 확인",
  },
];

// ── 포맷 헬퍼 ────────────────────────────────────────────────────────────────

function fmtUsd(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.0001) return `$${value.toFixed(6)}`;
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function fmtNum(value: number): string {
  return value.toLocaleString("ko-KR");
}

function limitPercent(today: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((today / limit) * 100));
}

// ── 집계 표 컴포넌트 ──────────────────────────────────────────────────────────

type UsageGroup = {
  key: string;
  costUsd: number;
  callCount: number;
  inputTokens: number;
  outputTokens: number;
};

function UsageTable({
  title,
  keyLabel,
  rows,
}: {
  title: string;
  keyLabel: string;
  rows: UsageGroup[];
}) {
  return (
    <article className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title" style={{ fontSize: "0.9375rem" }}>{title}</h3>
        </div>
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{keyLabel}</th>
              <th style={{ textAlign: "right" }}>비용</th>
              <th style={{ textAlign: "right" }}>호출 수</th>
              <th style={{ textAlign: "right" }}>입력 토큰</th>
              <th style={{ textAlign: "right" }}>출력 토큰</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--gray-400)", padding: "2rem" }}>
                  데이터 없음
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <span className="badge badge-gray" style={{ fontFamily: "monospace" }}>{row.key}</span>
                  </td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>{fmtUsd(row.costUsd)}</td>
                  <td className="num" style={{ textAlign: "right" }}>{fmtNum(row.callCount)}</td>
                  <td className="num" style={{ textAlign: "right" }}>{fmtNum(row.inputTokens)}</td>
                  <td className="num" style={{ textAlign: "right" }}>{fmtNum(row.outputTokens)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

// ── AI 제공사 크레딧·충전 섹션 ────────────────────────────────────────────────

/**
 * 제공사별 카드: 선택 기간 우리 앱 사용액 + 충전 대시보드 바로가기 버튼.
 * byProvider 집계에서 해당 provider 행을 찾아 사용액을 표시한다(없으면 0).
 */
function ProviderCreditSection({
  byProvider,
  rangeLabel,
}: {
  byProvider: UsageGroup[];
  rangeLabel: string;
}) {
  // provider 키 → 집계 행 (대소문자 무시 매칭)
  const usageByKey = new Map<string, UsageGroup>();
  for (const row of byProvider) {
    usageByKey.set(row.key.toLowerCase(), row);
  }

  return (
    <article className="card" style={{ marginBottom: "1.5rem" }}>
      <div className="card-header">
        <div>
          <h2 className="card-title">AI 제공사 크레딧 · 충전</h2>
          <div className="card-subtitle">
            {rangeLabel} 기준 제공사별 사용액입니다. 남은 잔액은 각 제공사 결제 콘솔에서 확인·충전하세요.
          </div>
        </div>
      </div>
      <div className="card-body">
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {PROVIDER_META.map((p) => {
            const usage = usageByKey.get(p.key);
            const costUsd = usage?.costUsd ?? 0;
            const callCount = usage?.callCount ?? 0;
            const tokens = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
            return (
              <div
                key={p.key}
                style={{
                  border: "1px solid var(--gray-200, #e5e7eb)",
                  borderRadius: 10,
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {/* 헤더: 아이콘 + 제공사명 */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 38,
                      height: 38,
                      borderRadius: 9,
                      background: `${p.color}1a`, // 색 + 10% 투명
                      color: p.color,
                      fontSize: "1.125rem",
                      flexShrink: 0,
                    }}
                  >
                    <i className={p.icon} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{p.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--gray-500)" }}>{p.desc}</div>
                  </div>
                </div>

                {/* 사용액 */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", marginBottom: "0.125rem" }}>
                    {rangeLabel} 사용액
                  </div>
                  <div style={{ fontSize: "1.375rem", fontWeight: 700, color: p.color }}>
                    {fmtUsd(costUsd)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", marginTop: "0.125rem" }}>
                    호출 {fmtNum(callCount)}회 · 토큰 {fmtNum(tokens)}
                  </div>
                </div>

                {/* 잔액 안내 */}
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--gray-500)",
                    background: "var(--gray-50, #f9fafb)",
                    borderRadius: 6,
                    padding: "0.5rem 0.625rem",
                    lineHeight: 1.5,
                  }}
                >
                  <i className="ri-information-line" style={{ marginRight: "0.25rem" }} />
                  남은 충전 잔액은 API로 조회할 수 없어, 아래 버튼으로 제공사 콘솔에서 직접 확인하세요.
                </div>

                {/* 충전 바로가기 버튼 */}
                <a
                  href={p.billingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ justifyContent: "center", marginTop: "auto" }}
                >
                  <i className="ri-external-link-line" style={{ marginRight: "0.375rem" }} />
                  {p.billingLabel}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function AiUsagePage() {
  const [range, setRange] = useState<Range>("7d");
  const [report, setReport] = useState<AiUsageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartInstance | null>(null);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async (r: Range) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ai-usage?range=${r}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setError(`데이터 조회 실패 (${res.status})`);
        setReport(null);
      } else {
        const data = (await res.json()) as AiUsageReport;
        setReport(data);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport(range);
  }, [range, fetchReport]);

  // ── 차트 업데이트 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary-600").trim() || "#2563eb";

    if (!report || report.daily.length === 0) {
      // 빈 플레이스홀더
      if (!chartRef.current) {
        try {
          chartRef.current = createLineChart(canvasRef.current, {
            labels: ["..."],
            series: [{ values: [0], color: primary, fill: "rgba(37,99,235,0.15)" }],
          });
        } catch { /* ignore */ }
      }
      return;
    }

    const chartData = {
      labels: report.daily.map((d) => d.date.slice(5)), // MM-DD
      series: [
        {
          values: report.daily.map((d) => d.costUsd),
          color: primary,
          fill: "rgba(37,99,235,0.15)",
        },
      ],
    };

    if (chartRef.current) {
      try {
        chartRef.current.setData(chartData);
      } catch {
        // 차트 재생성
        try { chartRef.current.destroy(); } catch { /* ignore */ }
        chartRef.current = null;
        try {
          if (canvasRef.current) {
            chartRef.current = createLineChart(canvasRef.current, chartData);
          }
        } catch { /* ignore */ }
      }
    } else {
      try {
        chartRef.current = createLineChart(canvasRef.current, chartData);
      } catch { /* ignore */ }
    }
  }, [report]);

  // 컴포넌트 언마운트 시 차트 정리
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        try { chartRef.current.destroy(); } catch { /* ignore */ }
        chartRef.current = null;
      }
    };
  }, []);

  // ── 데이터 추출 ──────────────────────────────────────────────────────────
  const totals = report?.totals ?? { costUsd: 0, callCount: 0, inputTokens: 0, outputTokens: 0 };
  const todayCostUsd = report?.todayVsLimit.todayCostUsd ?? 0;
  const dailyLimitUsd = report?.todayVsLimit.dailyLimitUsd ?? 0;
  const limitPct = limitPercent(todayCostUsd, dailyLimitUsd);
  const isOverLimit = dailyLimitUsd > 0 && todayCostUsd >= dailyLimitUsd;
  const totalTokens = totals.inputTokens + totals.outputTokens;

  return (
    <AdminShell breadcrumb={["관리자", "활동 봇", "AI 사용량"]} activeKey="bots" activeSubKey="ai-usage">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI 사용량</h1>
          <p className="page-description">모델·제공자·용도별 AI 호출 비용·토큰 사용량을 확인합니다.</p>
        </div>
      </div>

      {/* 기간 토글 */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div className="line-tabs" role="tablist" aria-label="조회 기간">
          {(Object.entries(RANGE_LABELS) as [Range, string][]).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={range === key}
              className={`line-tab${range === key ? " active" : ""}`}
              onClick={() => setRange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 로딩 / 오류 상태 */}
      {loading && (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--gray-400)" }}>
          데이터를 불러오는 중입니다...
        </div>
      )}
      {error && !loading && (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {/* 요약 카드 4종 */}
      {!loading && (
        <section className="grid stats-grid" aria-label="AI 사용 요약" style={{ marginBottom: "1.5rem" }}>
          <article className="stat-card">
            <div className="stat-head">
              <span className="stat-label">총 비용</span>
              <span className="stat-icon green"><i className="ri-money-dollar-circle-line" /></span>
            </div>
            <div className="stat-value">{fmtUsd(totals.costUsd)}</div>
            <div className="stat-foot"><span>{RANGE_LABELS[range]} 누적</span></div>
          </article>
          <article className="stat-card">
            <div className="stat-head">
              <span className="stat-label">총 호출 수</span>
              <span className="stat-icon blue"><i className="ri-cpu-line" /></span>
            </div>
            <div className="stat-value">{fmtNum(totals.callCount)}</div>
            <div className="stat-foot"><span>AI 모델 호출 횟수</span></div>
          </article>
          <article className="stat-card">
            <div className="stat-head">
              <span className="stat-label">총 토큰</span>
              <span className="stat-icon purple"><i className="ri-text-wrap" /></span>
            </div>
            <div className="stat-value">{fmtNum(totalTokens)}</div>
            <div className="stat-foot">
              <span>입력 {fmtNum(totals.inputTokens)} / 출력 {fmtNum(totals.outputTokens)}</span>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-head">
              <span className="stat-label">일일 상한 대비</span>
              <span className="stat-icon" style={{ background: isOverLimit ? "var(--danger-bg)" : "var(--success-bg)", color: isOverLimit ? "var(--danger)" : "var(--success)" }}>
                <i className={isOverLimit ? "ri-alarm-warning-line" : "ri-shield-check-line"} />
              </span>
            </div>
            <div className="stat-value" style={{ color: isOverLimit ? "var(--danger)" : undefined }}>
              {dailyLimitUsd > 0 ? `${limitPct}%` : "미설정"}
            </div>
            <div className="stat-foot">
              <span>
                {dailyLimitUsd > 0
                  ? `오늘 ${fmtUsd(todayCostUsd)} / 상한 ${fmtUsd(dailyLimitUsd)}`
                  : "bot_daily_cost_limit_usd 미설정"}
              </span>
            </div>
          </article>
        </section>
      )}

      {/* AI 제공사 크레딧·충전 (제공자별 사용액 + 충전 대시보드 바로가기) */}
      {!loading && report && (
        <ProviderCreditSection byProvider={report.byProvider} rangeLabel={RANGE_LABELS[range]} />
      )}

      {/* 비용 상한 게이지 */}
      {!loading && dailyLimitUsd > 0 && (
        <article className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">일일 비용 상한 게이지</h2>
              <div className="card-subtitle">오늘 누적 AI 비용 vs 일일 상한 ({fmtUsd(dailyLimitUsd)})</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "var(--gray-500)", marginBottom: "0.5rem" }}>
              <span>오늘 누적: <strong style={{ color: isOverLimit ? "var(--danger)" : "inherit" }}>{fmtUsd(todayCostUsd)}</strong></span>
              <span><strong style={{ color: isOverLimit ? "var(--danger)" : undefined }}>{limitPct}%</strong> 사용</span>
            </div>
            <div style={{ height: 12, background: "var(--gray-100)", borderRadius: 6, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${limitPct}%`,
                  background: isOverLimit
                    ? "var(--danger)"
                    : limitPct > 80
                    ? "var(--warning)"
                    : "var(--primary-600)",
                  borderRadius: 6,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            {isOverLimit && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.8125rem", color: "var(--danger)", fontWeight: 600 }}>
                ⚠ 일일 상한 초과. 신규 AI 호출이 차단될 수 있습니다.
              </p>
            )}
          </div>
        </article>
      )}

      {/* 일별 추이 차트 */}
      {!loading && (
        <article className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">일별 비용 추이</h2>
              <div className="card-subtitle">{RANGE_LABELS[range]} KST 날짜 기준 일별 AI 호출 비용</div>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-wrap" style={{ height: 200 }}>
              <canvas ref={canvasRef} aria-label="일별 AI 비용 추이 선 그래프" />
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: "var(--primary-600)" }} />
                AI 비용 (USD)
              </span>
            </div>
          </div>
        </article>
      )}

      {/* 집계 표 3종 */}
      {!loading && report && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <UsageTable
            title="제공자별 집계"
            keyLabel="AI 제공자"
            rows={report.byProvider}
          />
          <UsageTable
            title="모델별 집계"
            keyLabel="모델명"
            rows={report.byModel}
          />
          <UsageTable
            title="용도별 집계"
            keyLabel="호출 용도"
            rows={report.byPurpose}
          />
        </div>
      )}

      {/* 데이터 없음 */}
      {!loading && !error && report && report.totals.callCount === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--gray-400)" }}>
          <i className="ri-bar-chart-2-line" style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }} />
          <div>아직 AI 사용 기록이 없습니다.</div>
          <div style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>봇이 AI를 호출하면 여기에 통계가 표시됩니다.</div>
        </div>
      )}
    </AdminShell>
  );
}

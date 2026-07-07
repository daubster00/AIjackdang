import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { AdminShell } from "@/components/layout/AdminShell";
import { VisitorTrendChart } from "@/components/stats/VisitorTrendChart";
import { StatsDateFilter } from "@/components/stats/StatsDateFilter";
import { AnalyticsOverviewChart } from "@/components/stats/AnalyticsOverviewChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { StatsTopExportButtons, StatsKeywordCsvButton } from "./StatsExportButtons";
import { ContentPerformanceTable } from "./ContentPerformanceTable";
import type {
  AnalyticsOverviewResponse,
  ReferrersResponse,
  KeywordsResponse,
  PostPerformanceResponse,
  ResourcePerformanceResponse,
  PageDwellTimeResponse,
} from "@ai-jakdang/contracts";

/**
 * 접속 통계 페이지 (Story 9.5).
 * 목업 상수를 모두 제거하고 실제 API 데이터를 사용한다.
 *
 * 유입 경로(referrers), 검색 키워드(keywords), 콘텐츠 성과(post-performance +
 * resource-performance 통합), 페이지별 체류시간(page-dwell-time)은 서버에서 fetch.
 * 방문자 추이(visitor-trend)는 VisitorTrendChart 내부에서 클라이언트 fetch.
 */

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
}

// ── 공통 fetch 헬퍼 ──────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, cookieHeader: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Cookie: cookieHeader }, cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch { return null; }
}

// ── 날짜 헬퍼 ────────────────────────────────────────────────────────────────

function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function daysAgoStr(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function thisMonthStartStr(): string { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }
function lastMonthRange(): { from: string; to: string } {
  const d     = new Date();
  const year  = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const month = d.getMonth() === 0 ? 12 : d.getMonth();
  const from  = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to    = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

// ── 유입 경로 아이콘 매핑 ─────────────────────────────────────────────────────

function sourceIcon(source: string): { icon: string; style: Record<string, string> } {
  switch (source) {
    case "검색엔진": return { icon: "ri-search-line",    style: { background: "var(--primary-50)",   color: "var(--primary-600)" } };
    case "SNS":      return { icon: "ri-instagram-line", style: { background: "var(--warning-bg)",   color: "var(--warning)" } };
    case "직접":     return { icon: "ri-cursor-line",    style: { background: "var(--success-bg)",   color: "var(--success)" } };
    case "내부 이동": return { icon: "ri-links-line",     style: { background: "var(--primary-50)",   color: "var(--primary-500)" } };
    default:         return { icon: "ri-more-line",      style: { background: "var(--gray-100)",     color: "var(--gray-500)" } };
  }
}

// ── 체류시간 포맷 ─────────────────────────────────────────────────────────────

function fmtDwell(avgMs: number): string {
  const totalSec = Math.round(avgMs / 1000);
  if (totalSec <= 0) return "—";
  if (totalSec < 60) return `${totalSec}초`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}분 ${sec}초` : `${min}분`;
}

// ── 페이지 props ──────────────────────────────────────────────────────────────

interface StatsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminStatsPage({ searchParams }: StatsPageProps) {
  const params       = await searchParams;
  const cookieHeader = await getCookieHeader();

  const range      = (typeof params.range === "string" ? params.range : null) ?? "7days";
  const customFrom = typeof params.from   === "string" ? params.from : null;
  const customTo   = typeof params.to     === "string" ? params.to   : null;
  const kwPage     = Math.max(1, parseInt(typeof params.kwPage === "string" ? params.kwPage : "1", 10) || 1);

  const today     = todayStr();
  const lastMonth = lastMonthRange();

  let from: string;
  let to:   string;
  switch (range) {
    case "today":     from = today;              to = today;          break;
    case "yesterday": const y = daysAgoStr(1); from = y; to = y;     break;
    case "30days":    from = daysAgoStr(29);    to = today;           break;
    case "thismonth": from = thisMonthStartStr(); to = today;         break;
    case "lastmonth": from = lastMonth.from;    to = lastMonth.to;    break;
    case "custom":    from = customFrom ?? daysAgoStr(6); to = customTo ?? today; break;
    default:          from = daysAgoStr(6);     to = today;           break;
  }

  const base = `${API_BASE}/api/v1/admin/analytics`;

  // 병렬 fetch (게시글·실전자료 모두 limit=10, 체류시간은 기간 무관 전체 집계)
  const [overview, referrers, keywords, postPerf, resourcePerf, dwellTime] = await Promise.all([
    apiFetch<AnalyticsOverviewResponse>(
      `${API_BASE}/api/v1/admin/analytics/overview?from=${from}&to=${to}`,
      cookieHeader,
    ),
    apiFetch<ReferrersResponse>(
      `${base}/referrers?from=${from}&to=${to}`,
      cookieHeader,
    ),
    apiFetch<KeywordsResponse>(
      `${base}/keywords?from=${from}&to=${to}&page=${kwPage}&pageSize=10`,
      cookieHeader,
    ),
    apiFetch<PostPerformanceResponse>(
      `${base}/post-performance?from=${from}&to=${to}&limit=10`,
      cookieHeader,
    ),
    apiFetch<ResourcePerformanceResponse>(
      `${base}/resource-performance?from=${from}&to=${to}&limit=10`,
      cookieHeader,
    ),
    apiFetch<PageDwellTimeResponse>(
      `${base}/page-dwell-time`,
      cookieHeader,
    ),
  ]);

  // ── overview ──
  const items        = overview?.items ?? [];
  const hasData      = items.length > 0 && items.some((item) => item.newUsers > 0 || item.newPosts > 0 || item.downloads > 0);
  const totalNewUsers  = items.reduce((s, it) => s + it.newUsers,  0);
  const totalNewPosts  = items.reduce((s, it) => s + it.newPosts,  0);
  const totalDownloads = items.reduce((s, it) => s + it.downloads, 0);

  // ── referrers ──
  const sourceItems = referrers?.items ?? [];
  const sourceTotal = referrers?.total ?? 0;

  // ── keywords ──
  const kwItems = keywords?.items ?? [];
  const kwTotal = keywords?.total ?? 0;
  const kwTotalPages = Math.max(1, Math.ceil(kwTotal / 10));
  const kwStart = (kwPage - 1) * 10 + 1;
  const kwEnd   = Math.min(kwPage * 10, kwTotal);

  // ── 페이지네이션 URL 생성 헬퍼 ──
  const buildKwUrl = (page: number) => {
    const sp = new URLSearchParams();
    if (range  !== "7days") sp.set("range", range);
    if (customFrom) sp.set("from", from);
    if (customTo)   sp.set("to", to);
    if (page !== 1) sp.set("kwPage", String(page));
    const qs = sp.toString();
    return `/stats${qs ? `?${qs}` : ""}`;
  };

  // ── post-performance / resource-performance (통합 테이블에 전달) ──
  const postItems     = postPerf?.items     ?? [];
  const resourceItems = resourcePerf?.items ?? [];

  // ── page-dwell-time ──
  const dwellItems = dwellTime?.items ?? [];

  return (
    <AdminShell breadcrumb={["관리자", "접속 통계"]} activeKey="stats">
      <div className="page-header">
        <div>
          <h1 className="page-title">접속 통계</h1>
          <p className="page-description">방문유입검색콘텐츠 성과를 기간별로 분석합니다.</p>
        </div>
        <div className="page-actions">
          <StatsTopExportButtons overviewItems={items} from={from} to={to} />
        </div>
      </div>

      <StatsDateFilter currentRange={range} currentFrom={from} currentTo={to} />

      <Suspense fallback={<section className="grid stats-grid">{[0,1,2].map((i) => <SkeletonCard key={i} />)}</section>}>
        <section className="grid stats-grid" aria-label="기간 집계">
          <article className="stat-card">
            <div className="stat-head"><span className="stat-label">신규 가입자</span><span className="stat-icon green"><i className="ri-user-add-line" /></span></div>
            <div className="stat-value">{totalNewUsers.toLocaleString("ko-KR")}</div>
            <div className="stat-foot"><span>선택 기간 합산</span></div>
          </article>
          <article className="stat-card">
            <div className="stat-head"><span className="stat-label">신규 게시글</span><span className="stat-icon blue"><i className="ri-file-text-line" /></span></div>
            <div className="stat-value">{totalNewPosts.toLocaleString("ko-KR")}</div>
            <div className="stat-foot"><span>선택 기간 합산</span></div>
          </article>
          <article className="stat-card">
            <div className="stat-head"><span className="stat-label">다운로드</span><span className="stat-icon purple"><i className="ri-folder-download-line" /></span></div>
            <div className="stat-value">{totalDownloads.toLocaleString("ko-KR")}</div>
            <div className="stat-foot"><span>실전자료 누적</span></div>
          </article>
        </section>
      </Suspense>

      {/* 기간별 현황 차트 + 유입 경로 */}
      <section className="grid dashboard-grid">
        {hasData ? (
          <AnalyticsOverviewChart items={items} />
        ) : (
          <article className="card">
            <div className="card-header"><div><h2 className="card-title">기간별 현황</h2><div className="card-subtitle">신규 가입게시글다운로드 추이</div></div></div>
            <div className="card-body"><EmptyState message="선택한 기간에 데이터가 없습니다" description="다른 기간을 선택하거나 조회 기간을 늘려보세요." /></div>
          </article>
        )}

        {/* 유입 경로 분석 */}
        <article className="card">
          <div className="card-header">
            <div><h2 className="card-title">유입 경로 분석</h2><div className="card-subtitle">방문자수 기준 채널 비율</div></div>
          </div>
          <div className="card-body">
            {sourceItems.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--gray-400)", padding: "2rem" }}>
                데이터 없음 — 방문 로그가 누적되면 표시됩니다.
              </div>
            ) : (
              <div className="operation-list">
                {sourceItems.map((src) => {
                  const { icon, style } = sourceIcon(src.source);
                  return (
                    <div className="operation-item" key={src.source}>
                      <span className="operation-icon" style={style}><i className={icon} /></span>
                      <div className="operation-copy">
                        <div className="operation-title">
                          {src.source} <span className="badge badge-gray">{src.percent}%</span>
                        </div>
                        <div className="operation-desc">전체 {sourceTotal.toLocaleString("ko-KR")}건 중 {src.count.toLocaleString("ko-KR")}건</div>
                      </div>
                      <span className="operation-count">{src.count.toLocaleString("ko-KR")}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <p style={{ marginTop: "0.85rem", fontSize: 12, lineHeight: 1.6, color: "var(--gray-400)" }}>
              방문 시 브라우저가 전달하는 이전 페이지 주소(referrer)로 분류합니다.
              <strong>검색엔진</strong>(네이버·구글 등) · <strong>SNS</strong> · <strong>직접</strong>(주소 직접 입력·북마크 등 referrer 없음) ·
              <strong>내부 이동</strong>(사이트 내 페이지 이동) · <strong>기타</strong>(위에 해당하지 않는 외부 사이트).
            </p>
          </div>
        </article>
      </section>

      {/* 방문자 추이 차트 (클라이언트 컴포넌트, 자체 fetch) */}
      <section className="grid dashboard-grid" style={{ marginTop: 0 }}>
        <VisitorTrendChart />
      </section>

      {/* 검색 키워드 분석 */}
      <section className="section">
        <div className="section-heading">
          <div><h2 className="section-title">검색 키워드 분석</h2><p className="section-description">사이트 내부 검색 유입어별 방문 수입니다.</p></div>
        </div>
        <article className="card">
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">
                {kwTotal > 0 ? `상위 검색어 총 ${kwTotal.toLocaleString("ko-KR")}개` : "데이터 없음"}
              </span>
            </div>
            <div className="toolbar-right">
              <StatsKeywordCsvButton kwItems={kwItems} from={from} to={to} />
            </div>
          </div>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>유입 검색어</th><th>방문 수</th></tr>
              </thead>
              <tbody>
                {kwItems.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: "center", color: "var(--gray-400)", padding: "2rem" }}>
                      검색 키워드 데이터가 없습니다. 방문 로그가 누적되면 표시됩니다.
                    </td>
                  </tr>
                ) : (
                  kwItems.map((k) => (
                    <tr key={k.keyword}>
                      <td>
                        <div className="content-title">
                          <i className="ri-search-line" style={{ color: "var(--gray-400)", marginRight: 6 }} />
                          {k.keyword}
                        </div>
                      </td>
                      <td className="num">{k.count.toLocaleString("ko-KR")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {kwTotal > 0 && (
            <div className="pagination">
              <div className="page-info">
                {kwStart}-{kwEnd} / 총 {kwTotal.toLocaleString("ko-KR")}개
              </div>
              <div className="page-buttons">
                {kwPage > 1 ? (
                  <Link href={buildKwUrl(kwPage - 1)} className="page-button" aria-label="이전 페이지">
                    <i className="ri-arrow-left-s-line" />
                  </Link>
                ) : (
                  <button className="page-button" disabled aria-label="이전 페이지">
                    <i className="ri-arrow-left-s-line" />
                  </button>
                )}
                {/* 최대 5페이지 번호 표시 */}
                {Array.from({ length: Math.min(kwTotalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <Link key={p} href={buildKwUrl(p)} className={`page-button${p === kwPage ? " active" : ""}`}>
                      {p}
                    </Link>
                  );
                })}
                {kwPage < kwTotalPages ? (
                  <Link href={buildKwUrl(kwPage + 1)} className="page-button" aria-label="다음 페이지">
                    <i className="ri-arrow-right-s-line" />
                  </Link>
                ) : (
                  <button className="page-button" disabled aria-label="다음 페이지">
                    <i className="ri-arrow-right-s-line" />
                  </button>
                )}
              </div>
            </div>
          )}
        </article>
      </section>

      {/* 콘텐츠별 성과 (게시글 + 실전자료 통합, 정렬 가능) */}
      <ContentPerformanceTable postItems={postItems} resourceItems={resourceItems} />

      {/* 페이지별 머문시간 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">페이지별 머문시간</h2>
            <p className="section-description">
              체류시간이 기록된 방문 기준 평균 체류시간입니다. (전체 누적, 상위 15개 경로)
            </p>
          </div>
        </div>
        <article className="card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>경로</th>
                  <th>평균 체류시간</th>
                  <th>조회수</th>
                </tr>
              </thead>
              <tbody>
                {dwellItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "var(--gray-400)", padding: "2rem" }}>
                      체류시간 데이터가 없습니다. 방문 로그가 누적되면 표시됩니다.
                    </td>
                  </tr>
                ) : (
                  dwellItems.map((d) => (
                    <tr key={d.path}>
                      <td>
                        <div className="content-title" style={{ fontFamily: "monospace", fontSize: 13 }}>
                          {d.path}
                        </div>
                      </td>
                      <td className="num">
                        <strong>{fmtDwell(d.avgDwellMs)}</strong>
                      </td>
                      <td className="num">{d.views.toLocaleString("ko-KR")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}

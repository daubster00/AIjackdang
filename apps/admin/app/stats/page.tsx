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
import type {
  AnalyticsOverviewResponse,
  ReferrersResponse,
  KeywordsResponse,
  PostPerformanceResponse,
  ResourcePerformanceResponse,
} from "@ai-jakdang/contracts";

/**
 * 접속 통계 페이지 (Story 9.5).
 * 목업 상수를 모두 제거하고 실제 API 데이터를 사용한다.
 *
 * 유입 경로(referrers), 검색 키워드(keywords), 게시글 성과(post-performance),
 * 실전자료 성과(resource-performance)는 서버에서 fetch.
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
    default:         return { icon: "ri-more-line",      style: { background: "var(--gray-100)",     color: "var(--gray-500)" } };
  }
}

// ── 게시글 유형·상태 뱃지 ─────────────────────────────────────────────────────

function boardLabel(board: string): string {
  // board slug → 표시명 (필요 시 확장)
  const MAP: Record<string, string> = {
    automation: "자동화", lounge: "라운지", monetize: "수익화",
    "vibe-coding": "바이브코딩", notice: "공지",
  };
  return MAP[board] ?? board;
}

function statusBadge(status: string): { cls: string; label: string } {
  switch (status) {
    case "published": return { cls: "badge-green",  label: "공개" };
    case "draft":     return { cls: "badge-gray",   label: "초안" };
    case "hidden":    return { cls: "badge-orange", label: "숨김" };
    default:          return { cls: "badge-gray",   label: status };
  }
}

// ── 날짜 표시 ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
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

  // 병렬 fetch
  const [overview, referrers, keywords, postPerf, resourcePerf] = await Promise.all([
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
      `${base}/post-performance?from=${from}&to=${to}&limit=20`,
      cookieHeader,
    ),
    apiFetch<ResourcePerformanceResponse>(
      `${base}/resource-performance?from=${from}&to=${to}&limit=20`,
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

  // ── post-performance ──
  const postItems = postPerf?.items ?? [];

  // ── resource-performance ──
  const resourceItems = resourcePerf?.items ?? [];

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

      {/* 게시글별 성과 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">게시글별 성과</h2>
            <p className="section-description">콘텐츠별 조회·댓글·좋아요·신고 지표입니다. (조회수 기준 정렬)</p>
          </div>
        </div>
        <article className="card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>게시글</th><th>게시판</th><th>작성자</th><th>상태</th><th>조회수</th><th>댓글</th><th>좋아요</th><th>신고</th><th>등록일</th></tr>
              </thead>
              <tbody>
                {postItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "var(--gray-400)", padding: "2rem" }}>
                      선택한 기간에 게시글 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  postItems.map((p) => {
                    const { cls: stCls, label: stLabel } = statusBadge(p.status);
                    return (
                      <tr key={p.id}>
                        <td><div className="content-title">{p.title}</div></td>
                        <td><span className="badge badge-blue">{boardLabel(p.board)}</span></td>
                        <td>{p.authorNickname ?? <span style={{ color: "var(--gray-400)" }}>(탈퇴)</span>}</td>
                        <td><span className={`badge ${stCls}`}>{stLabel}</span></td>
                        <td className="num">{p.viewCount.toLocaleString("ko-KR")}</td>
                        <td className="num">{p.commentCount.toLocaleString("ko-KR")}</td>
                        <td className="num">{p.likeCount.toLocaleString("ko-KR")}</td>
                        <td className="num">
                          {p.reportCount > 0
                            ? <span className="badge badge-red">{p.reportCount}</span>
                            : <span>0</span>}
                        </td>
                        <td className="num">{fmtDate(p.createdAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {/* 실전자료별 성과 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">실전자료별 성과</h2>
            <p className="section-description">
              자료별 다운로드·평점·후기·신고 지표입니다.{" "}
              <strong>다운로드 전환율 = 다운로드수 / 조회수</strong>.
            </p>
          </div>
        </div>
        <article className="card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>실전자료</th><th>유형</th><th>조회수</th><th>다운로드수</th><th>다운로드 전환율</th><th>평점</th><th>후기</th><th>신고</th></tr>
              </thead>
              <tbody>
                {resourceItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "var(--gray-400)", padding: "2rem" }}>
                      선택한 기간에 실전자료 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  resourceItems.map((r) => {
                    const convTone =
                      r.conversionRate >= 30 ? "badge-green"
                      : r.conversionRate >= 15 ? "badge-cyan"
                      : "badge-orange";
                    return (
                      <tr key={r.id}>
                        <td><div className="content-title">{r.title}</div><div className="content-meta">{r.resourceType}</div></td>
                        <td><span className="badge badge-cyan">{r.resourceType}</span></td>
                        <td className="num">{r.viewCount.toLocaleString("ko-KR")}</td>
                        <td className="num">{r.downloadCount.toLocaleString("ko-KR")}</td>
                        <td className="num"><span className={`badge ${convTone}`}>{r.conversionRate}%</span></td>
                        <td className="num">
                          <i className="ri-star-fill" style={{ color: "var(--warning)", marginRight: 4 }} />
                          {r.avgRating.toFixed(1)}
                        </td>
                        <td className="num">{r.ratingCount.toLocaleString("ko-KR")}</td>
                        <td className="num">
                          {r.reportCount > 0
                            ? <span className="badge badge-red">{r.reportCount}</span>
                            : <span>0</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}

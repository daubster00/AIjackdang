import { Suspense } from "react";
import { cookies } from "next/headers";
import { AdminShell } from "@/components/layout/AdminShell";
import { VisitorTrendChart } from "@/components/stats/VisitorTrendChart";
import { StatsDateFilter } from "@/components/stats/StatsDateFilter";
import { AnalyticsOverviewChart } from "@/components/stats/AnalyticsOverviewChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import type { AnalyticsOverviewResponse } from "@ai-jakdang/contracts";

/**
 * 접속 통계 페이지 (Story 9.5 AC#3, AC#4, AC#5).
 * 기간 선택 UI + URL 파라미터 반영 + analytics/overview API 연동.
 * @ai-jakdang/admin-design-system 의 마크업/토큰으로 구성한다.
 */

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
}

async function fetchAnalyticsOverview(
  from: string,
  to: string,
  cookieHeader: string,
): Promise<AnalyticsOverviewResponse | null> {
  try {
    const url = `${API_BASE}/api/v1/admin/analytics/overview?from=${from}&to=${to}`;
    const res = await fetch(url, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<AnalyticsOverviewResponse>;
  } catch {
    return null;
  }
}

/** YYYY-MM-DD 형식 오늘 날짜 */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** n일 전 YYYY-MM-DD */
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** 이번달 1일 */
function thisMonthStartStr(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

/** 지난달 시작/끝 */
function lastMonthRange(): { from: string; to: string } {
  const d = new Date();
  const year = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const month = d.getMonth() === 0 ? 12 : d.getMonth();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

// 어제
function yesterdayStr(): string {
  return daysAgoStr(1);
}

// 유입 경로 분석(더미) — 이후 GA/로그 연동으로 대체
const SOURCES = [
  { icon: "ri-search-line", style: { background: "var(--primary-50)", color: "var(--primary-600)" }, title: "검색엔진", desc: "네이버 · 구글 · 다음 자연 유입", visits: "14,210", ratio: "37.0%" },
  { icon: "ri-cursor-line", style: { background: "var(--success-bg)", color: "var(--success)" }, title: "직접 유입", desc: "URL 직접 입력 · 북마크", visits: "8,640", ratio: "22.5%" },
  { icon: "ri-instagram-line", style: { background: "var(--warning-bg)", color: "var(--warning)" }, title: "SNS", desc: "인스타 · 유튜브 · 스레드", visits: "5,920", ratio: "15.4%" },
  { icon: "ri-links-line", style: { background: "var(--primary-50)", color: "var(--primary-600)" }, title: "외부 링크", desc: "블로그 · 커뮤니티 레퍼럴", visits: "3,810", ratio: "9.9%" },
  { icon: "ri-megaphone-line", style: { background: "var(--danger-bg)", color: "var(--danger)" }, title: "광고", desc: "메타 · 구글 애즈 캠페인", visits: "3,180", ratio: "8.3%" },
  { icon: "ri-robot-2-line", style: { background: "var(--warning-bg)", color: "var(--warning)" }, title: "AI 검색(추정)", desc: "ChatGPT · Perplexity 인용 추정", visits: "1,820", ratio: "4.7%" },
  { icon: "ri-more-line", style: { background: "var(--gray-100)", color: "var(--gray-500)" }, title: "기타", desc: "분류 불가 · 미식별", visits: "840", ratio: "2.2%" },
] as const;

// 검색 키워드 분석(더미)
const KEYWORDS = [
  { kw: "claude code 사용법", visits: "3,420", pv: "11,280", signups: "182", downloads: "640", stay: "5분 48초" },
  { kw: "n8n 자동화 예제", visits: "2,810", pv: "8,940", signups: "146", downloads: "512", stay: "6분 02초" },
  { kw: "ai 외주 단가", visits: "2,140", pv: "5,670", signups: "98", downloads: "210", stay: "3분 51초" },
  { kw: "바이브코딩 뜻", visits: "1,960", pv: "4,210", signups: "71", downloads: "88", stay: "2분 44초" },
  { kw: "gpt api 수익화", visits: "1,540", pv: "4,880", signups: "63", downloads: "194", stay: "4분 33초" },
  { kw: "claude skill 만들기", visits: "1,210", pv: "3,920", signups: "57", downloads: "276", stay: "5분 12초" },
  { kw: "php 레거시 리팩토링", visits: "980", pv: "2,640", signups: "29", downloads: "131", stay: "4분 05초" },
] as const;

// 게시글별 성과(더미)
const POST_PERF = [
  { title: "Claude Code로 기존 PHP 프로젝트 분석하는 방법", meta: "바이브코딩 가이드", type: ["badge-blue", "게시글"], views: "12,840", stay: "6분 21초", comments: "84", likes: "412", reports: "0", organic: "3,210", signups: "146" },
  { title: "n8n으로 Gmail 문의 자동 분류 워크플로 만들기", meta: "AI 자동화 · 실습", type: ["badge-purple", "묻고답하기"], views: "9,460", stay: "5분 47초", comments: "61", likes: "298", reports: "1", organic: "2,640", signups: "118" },
  { title: "AI 자동화 외주 견적을 잡을 때 꼭 확인할 것", meta: "외주·판매 팁", type: ["badge-blue", "게시글"], views: "8,210", stay: "4분 12초", comments: "53", likes: "187", reports: "4", organic: "1,980", signups: "72" },
  { title: "GPT API로 월 300 버는 자동화 봇 구조", meta: "AI 수익화 사례", type: ["badge-blue", "게시글"], views: "7,330", stay: "5분 09초", comments: "47", likes: "264", reports: "0", organic: "1,540", signups: "98" },
] as const;

// 실전자료별 성과(더미)
const RESOURCE_PERF = [
  { title: "PHP Legacy Code Review Skill", meta: "Claude Code Skill", views: "8,420", downloads: "3,180", conv: "37.8%", tone: "badge-green", rating: "4.8", reviews: "212", reports: "1" },
  { title: "n8n 문의 자동분류 워크플로 템플릿", meta: "n8n Template", views: "6,210", downloads: "2,040", conv: "32.8%", tone: "badge-green", rating: "4.7", reviews: "168", reports: "0" },
  { title: "GPT 수익화 봇 보일러플레이트", meta: "Node.js 스타터", views: "5,840", downloads: "1,520", conv: "26.0%", tone: "badge-cyan", rating: "4.5", reviews: "131", reports: "2" },
  { title: "AI 외주 견적·계약서 양식 패키지", meta: "문서 템플릿", views: "4,110", downloads: "624", conv: "15.2%", tone: "badge-orange", rating: "4.2", reviews: "57", reports: "0" },
] as const;

interface StatsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminStatsPage({ searchParams }: StatsPageProps) {
  const params = await searchParams;
  const cookieHeader = await getCookieHeader();

  // URL 파라미터에서 기간 결정
  const range = (typeof params.range === "string" ? params.range : null) ?? "7days";
  const customFrom = typeof params.from === "string" ? params.from : null;
  const customTo = typeof params.to === "string" ? params.to : null;

  let from: string;
  let to: string;
  const today = todayStr();
  const yesterday = yesterdayStr();
  const lastMonth = lastMonthRange();

  switch (range) {
    case "today":
      from = today; to = today; break;
    case "yesterday":
      from = yesterday; to = yesterday; break;
    case "30days":
      from = daysAgoStr(29); to = today; break;
    case "thismonth":
      from = thisMonthStartStr(); to = today; break;
    case "lastmonth":
      from = lastMonth.from; to = lastMonth.to; break;
    case "custom":
      from = customFrom ?? daysAgoStr(6); to = customTo ?? today; break;
    default: // 7days
      from = daysAgoStr(6); to = today; break;
  }

  const overview = await fetchAnalyticsOverview(from, to, cookieHeader);
  const items = overview?.items ?? [];
  const hasData = items.length > 0 && items.some((item) => item.newUsers > 0 || item.newPosts > 0 || item.downloads > 0);

  // 기간별 집계 합산
  const totalNewUsers = items.reduce((sum, item) => sum + item.newUsers, 0);
  const totalNewPosts = items.reduce((sum, item) => sum + item.newPosts, 0);
  const totalDownloads = items.reduce((sum, item) => sum + item.downloads, 0);

  return (
    <AdminShell breadcrumb={["관리자", "접속 통계"]} activeKey="stats">
      <div className="page-header">
        <div>
          <h1 className="page-title">접속 통계</h1>
          <p className="page-description">방문·유입·검색·콘텐츠 성과를 기간별로 분석합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            CSV 다운로드
          </button>
          <button className="btn btn-primary">
            <i className="ri-download-2-line" />
            리포트 내보내기
          </button>
        </div>
      </div>

      {/* 기간 필터 — 클라이언트 컴포넌트 */}
      <StatsDateFilter currentRange={range} currentFrom={from} currentTo={to} />

      {/* 핵심 집계 카드 */}
      <Suspense
        fallback={
          <section className="grid stats-grid" aria-label="통계 로딩 중">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </section>
        }
      >
        <section className="grid stats-grid" aria-label="기간 집계">
          <article className="stat-card">
            <div className="stat-head">
              <span className="stat-label">신규 가입자</span>
              <span className="stat-icon green">
                <i className="ri-user-add-line" />
              </span>
            </div>
            <div className="stat-value">{totalNewUsers.toLocaleString("ko-KR")}</div>
            <div className="stat-foot">
              <span>선택 기간 합산</span>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-head">
              <span className="stat-label">신규 게시글</span>
              <span className="stat-icon blue">
                <i className="ri-file-text-line" />
              </span>
            </div>
            <div className="stat-value">{totalNewPosts.toLocaleString("ko-KR")}</div>
            <div className="stat-foot">
              <span>선택 기간 합산</span>
            </div>
          </article>
          <article className="stat-card">
            <div className="stat-head">
              <span className="stat-label">다운로드</span>
              <span className="stat-icon purple">
                <i className="ri-folder-download-line" />
              </span>
            </div>
            <div className="stat-value">{totalDownloads.toLocaleString("ko-KR")}</div>
            <div className="stat-foot">
              <span>실전자료 누적</span>
            </div>
          </article>
        </section>
      </Suspense>

      {/* 방문자 추이 차트 + 유입 경로 분석 */}
      <section className="grid dashboard-grid">
        {hasData ? (
          <AnalyticsOverviewChart items={items} />
        ) : (
          <article className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">기간별 현황</h2>
                <div className="card-subtitle">신규 가입·게시글·다운로드 추이</div>
              </div>
            </div>
            <div className="card-body">
              <EmptyState
                message="선택한 기간에 데이터가 없습니다"
                description="다른 기간을 선택하거나 조회 기간을 늘려보세요."
              />
            </div>
          </article>
        )}

        <article className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">유입 경로 분석</h2>
              <div className="card-subtitle">방문자수 기준 채널 비율</div>
            </div>
          </div>
          <div className="card-body">
            <div className="operation-list">
              {SOURCES.map((src) => (
                <div className="operation-item" key={src.title}>
                  <span className="operation-icon" style={src.style}>
                    <i className={src.icon} />
                  </span>
                  <div className="operation-copy">
                    <div className="operation-title">
                      {src.title} <span className="badge badge-gray">{src.ratio}</span>
                    </div>
                    <div className="operation-desc">{src.desc}</div>
                  </div>
                  <span className="operation-count">{src.visits}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      {/* 방문자 추이(디자인 시스템 차트) */}
      <section className="grid dashboard-grid" style={{ marginTop: 0 }}>
        <VisitorTrendChart />
      </section>

      {/* 검색 키워드 분석 테이블 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">검색 키워드 분석</h2>
            <p className="section-description">유입 검색어별 방문·전환·체류 지표입니다.</p>
          </div>
        </div>

        <article className="card">
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">상위 검색어 {KEYWORDS.length}개</span>
            </div>
            <div className="toolbar-right">
              <button className="btn btn-outline btn-sm">
                <i className="ri-file-excel-2-line" />
                CSV 다운로드
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>유입 검색어</th>
                  <th>방문수</th>
                  <th>페이지뷰</th>
                  <th>가입수</th>
                  <th>다운로드수</th>
                  <th>평균 체류시간</th>
                </tr>
              </thead>
              <tbody>
                {KEYWORDS.map((k) => (
                  <tr key={k.kw}>
                    <td>
                      <div className="content-title">
                        <i className="ri-search-line" style={{ color: "var(--gray-400)", marginRight: 6 }} />
                        {k.kw}
                      </div>
                    </td>
                    <td className="num">{k.visits}</td>
                    <td className="num">{k.pv}</td>
                    <td className="num">{k.signups}</td>
                    <td className="num">{k.downloads}</td>
                    <td className="num">{k.stay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <div className="page-info">1–7 / 총 248개</div>
            <div className="page-buttons">
              <button className="page-button" aria-label="이전 페이지">
                <i className="ri-arrow-left-s-line" />
              </button>
              <button className="page-button active">1</button>
              <button className="page-button">2</button>
              <button className="page-button">3</button>
              <button className="page-button" aria-label="다음 페이지">
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          </div>
        </article>
      </section>

      {/* 게시글별 성과 테이블 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">게시글별 성과</h2>
            <p className="section-description">콘텐츠별 참여·검색유입·가입전환 지표입니다.</p>
          </div>
        </div>

        <article className="card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>게시글</th>
                  <th>유형</th>
                  <th>조회수</th>
                  <th>체류시간</th>
                  <th>댓글</th>
                  <th>좋아요</th>
                  <th>신고</th>
                  <th>검색유입</th>
                  <th>가입전환</th>
                </tr>
              </thead>
              <tbody>
                {POST_PERF.map((p) => (
                  <tr key={p.title}>
                    <td>
                      <div className="content-title">{p.title}</div>
                      <div className="content-meta">{p.meta}</div>
                    </td>
                    <td>
                      <span className={`badge ${p.type[0]}`}>{p.type[1]}</span>
                    </td>
                    <td className="num">{p.views}</td>
                    <td className="num">{p.stay}</td>
                    <td className="num">{p.comments}</td>
                    <td className="num">{p.likes}</td>
                    <td className="num">
                      {p.reports === "0" ? (
                        <span>0</span>
                      ) : (
                        <span className="badge badge-red">{p.reports}</span>
                      )}
                    </td>
                    <td className="num">{p.organic}</td>
                    <td className="num">{p.signups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {/* 실전자료별 성과 테이블 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">실전자료별 성과</h2>
            <p className="section-description">
              자료별 다운로드·평점·후기 지표입니다. <strong>다운로드 전환율 = 다운로드수 / 조회수</strong>.
            </p>
          </div>
        </div>

        <article className="card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>실전자료</th>
                  <th>조회수</th>
                  <th>다운로드수</th>
                  <th>다운로드 전환율</th>
                  <th>평점</th>
                  <th>후기</th>
                  <th>신고</th>
                </tr>
              </thead>
              <tbody>
                {RESOURCE_PERF.map((r) => (
                  <tr key={r.title}>
                    <td>
                      <div className="content-title">{r.title}</div>
                      <div className="content-meta">{r.meta}</div>
                    </td>
                    <td className="num">{r.views}</td>
                    <td className="num">{r.downloads}</td>
                    <td className="num">
                      <span className={`badge ${r.tone}`}>{r.conv}</span>
                    </td>
                    <td className="num">
                      <i className="ri-star-fill" style={{ color: "var(--warning)", marginRight: 4 }} />
                      {r.rating}
                    </td>
                    <td className="num">{r.reviews}</td>
                    <td className="num">
                      {r.reports === "0" ? (
                        <span>0</span>
                      ) : (
                        <span className="badge badge-red">{r.reports}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}

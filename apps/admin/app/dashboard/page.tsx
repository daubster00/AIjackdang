import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { TrafficChart } from "@/components/dashboard/TrafficChart";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import type {
  DashboardKpiResponse,
  DashboardAlertsResponse,
  RecentContentResponse,
} from "@ai-jakdang/contracts";

/**
 * 관리자 대시보드 (Story 9.5).
 * 서버 컴포넌트에서 KPI + 운영 알림 + 최근 콘텐츠 API를 fetch하여 실제 수치 표시.
 */

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4003";

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
}

async function fetchKpi(cookieHeader: string): Promise<DashboardKpiResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/dashboard/kpi`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<DashboardKpiResponse>;
  } catch {
    return null;
  }
}

async function fetchAlerts(cookieHeader: string): Promise<DashboardAlertsResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/dashboard/alerts`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<DashboardAlertsResponse>;
  } catch {
    return null;
  }
}

async function fetchRecentContent(cookieHeader: string): Promise<RecentContentResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/dashboard/recent-content?limit=8`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<RecentContentResponse>;
  } catch {
    return null;
  }
}

/** 콘텐츠 유형 → 뱃지 클래스 */
function typeBadge(type: "post" | "resource" | "question") {
  switch (type) {
    case "post":     return { cls: "badge-blue",   label: "게시글" };
    case "resource": return { cls: "badge-cyan",   label: "실전자료" };
    case "question": return { cls: "badge-purple", label: "묻고답하기" };
  }
}

/** 상태 → 뱃지 클래스 */
function statusBadge(status: string) {
  switch (status) {
    case "published": return { cls: "badge-green",  label: "공개" };
    case "draft":     return { cls: "badge-gray",   label: "초안" };
    case "hidden":    return { cls: "badge-orange", label: "숨김" };
    case "deleted":   return { cls: "badge-red",    label: "삭제" };
    default:          return { cls: "badge-gray",   label: status };
  }
}

/** YYYY-MM-DDTHH:mm:ss.sssZ → YYYY.MM.DD */
function fmtDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ".");
}

export default async function AdminDashboardPage() {
  const cookieHeader = await getCookieHeader();
  const [kpi, alerts, recentContent] = await Promise.all([
    fetchKpi(cookieHeader),
    fetchAlerts(cookieHeader),
    fetchRecentContent(cookieHeader),
  ]);

  const totalUsers    = kpi?.totalUsers    ?? 0;
  const todayNewUsers = kpi?.todayNewUsers ?? 0;
  const totalPosts    = kpi?.totalPosts    ?? 0;
  const todayNewPosts = kpi?.todayNewPosts ?? 0;
  const totalDownloads  = kpi?.totalDownloads  ?? 0;
  const pendingReports  = kpi?.pendingReports  ?? 0;

  const STATS = [
    { label: "전체 회원",    value: totalUsers.toLocaleString("ko-KR"),     icon: "ri-user-3-line",       tone: "blue",   dir: "up" as const, delta: `+${todayNewUsers}`, note: "오늘 신규" },
    { label: "전체 게시글",  value: totalPosts.toLocaleString("ko-KR"),     icon: "ri-file-text-line",    tone: "purple", dir: "up" as const, delta: `+${todayNewPosts}`, note: "오늘 신규" },
    { label: "전체 다운로드", value: totalDownloads.toLocaleString("ko-KR"), icon: "ri-download-2-line",   tone: "green",  dir: "up" as const, delta: "",                  note: "누적 실전자료" },
    { label: "미처리 신고",  value: pendingReports.toLocaleString("ko-KR"), icon: "ri-alarm-warning-line", tone: pendingReports > 0 ? "danger" : "green", dir: pendingReports > 0 ? ("up" as const) : ("down" as const), delta: pendingReports > 0 ? `${pendingReports}건` : "없음", note: pendingReports > 0 ? "확인 필요" : "이상 없음" },
  ];

  const alertReports     = alerts?.reports      ?? pendingReports;
  const alertQna         = alerts?.pendingQna   ?? 0;
  const alertNewResources = alerts?.newResources ?? 0;

  const OPERATIONS = [
    { icon: "ri-question-line",        style: { background: "var(--warning-bg)", color: "var(--warning)" },                                                                                              title: "답변대기 질문",  desc: "미해결 질문이 있습니다.",              count: alertQna.toLocaleString("ko-KR"),         href: "/qna",      isDanger: false },
    { icon: "ri-alarm-warning-line",   style: alertReports > 0 ? { background: "var(--danger-bg)", color: "var(--danger)" } : { background: "var(--success-bg)", color: "var(--success)" },            title: "미처리 신고",    desc: alertReports > 0 ? "운영자 확인이 필요합니다." : "모든 신고가 처리됐습니다.", count: alertReports.toLocaleString("ko-KR"),    href: "/reports",  isDanger: alertReports > 0 },
    { icon: "ri-folder-download-line", style: { background: "var(--primary-50)", color: "var(--primary-600)" },                                                                                          title: "오늘 신규 자료", desc: "오늘 새로 등록된 자료입니다.",          count: alertNewResources.toLocaleString("ko-KR"), href: "/resources", isDanger: false },
  ];

  const recentItems = recentContent?.items ?? [];

  return (
    <AdminShell breadcrumb={["관리자", "대시보드"]} activeKey="dashboard" pendingReportsCount={pendingReports}>
      <div className="page-header">
        <div>
          <h1 className="page-title">관리자 대시보드</h1>
          <p className="page-description">AI작당 운영 현황을 한눈에 확인합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-download-2-line" />
            리포트 내보내기
          </button>
          <Link href="/posts/new" className="btn btn-primary">
            <i className="ri-add-line" />
            새 게시글
          </Link>
        </div>
      </div>

      <Suspense fallback={<section className="grid stats-grid" aria-label="핵심 통계 로딩 중">{[0,1,2,3].map((i) => (<SkeletonCard key={i} />))}</section>}>
        <section className="grid stats-grid" aria-label="핵심 통계">
          {STATS.map((s) => (
            <article className="stat-card" key={s.label}>
              <div className="stat-head">
                <span className="stat-label">{s.label}</span>
                <span className={`stat-icon ${s.tone}`}><i className={s.icon} /></span>
              </div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-foot">
                {s.delta && (<span className={`trend ${s.dir}`}><i className={s.dir === "up" ? "ri-arrow-up-line" : "ri-arrow-down-line"} />{s.delta}</span>)}
                <span>{s.note}</span>
              </div>
            </article>
          ))}
        </section>
      </Suspense>

      <section className="grid dashboard-grid">
        <TrafficChart />
        <article className="card">
          <div className="card-header">
            <div><h2 className="card-title">운영 확인</h2><div className="card-subtitle">지금 확인이 필요한 항목</div></div>
            <Link href="/reports" className="btn btn-ghost btn-sm">전체 보기</Link>
          </div>
          <div className="card-body">
            <div className="operation-list">
              {OPERATIONS.map((op) => (
                <Link key={op.title} href={op.href} className="operation-item" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="operation-icon" style={op.style}><i className={op.icon} /></span>
                  <div className="operation-copy">
                    <div className="operation-title">{op.title}</div>
                    <div className="operation-desc">{op.desc}</div>
                  </div>
                  <span className="operation-count" style={op.isDanger ? { color: "var(--danger)", fontWeight: 700 } : undefined}>{op.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="section">
        <div className="section-heading">
          <div><h2 className="section-title">최근 콘텐츠</h2><p className="section-description">최근 등록·신고된 콘텐츠입니다.</p></div>
        </div>
        <Suspense fallback={<article className="card"><div className="card-body"><SkeletonTable rows={4} /></div></article>}>
          <article className="card">
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>콘텐츠</th><th>유형</th><th>작성자</th><th>상태</th><th>조회</th><th>등록일</th></tr>
                </thead>
                <tbody>
                  {recentItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--gray-400)", padding: "2rem" }}>
                        등록된 콘텐츠가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    recentItems.map((r) => {
                      const { cls: typeCls, label: typeLabel } = typeBadge(r.type);
                      const { cls: stCls, label: stLabel }    = statusBadge(r.status);
                      const avatarLetter = r.authorNickname?.[0] ?? "?";
                      return (
                        <tr key={`${r.type}-${r.title}-${r.createdAt}`}>
                          <td>
                            <div className="content-title">{r.title}</div>
                            {r.board && <div className="content-meta">{r.board}</div>}
                          </td>
                          <td><span className={`badge ${typeCls}`}>{typeLabel}</span></td>
                          <td>
                            <div className="author">
                              <span className="author-avatar">{avatarLetter}</span>
                              <span>{r.authorNickname ?? "(탈퇴)"}</span>
                            </div>
                          </td>
                          <td><span className={`badge ${stCls}`}>{stLabel}</span></td>
                          <td className="num">{r.views.toLocaleString("ko-KR")}</td>
                          <td className="num">{fmtDate(r.createdAt)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </Suspense>
      </section>
    </AdminShell>
  );
}

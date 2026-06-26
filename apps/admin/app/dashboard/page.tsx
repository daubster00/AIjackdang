import { Suspense } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { TrafficChart } from "@/components/dashboard/TrafficChart";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import type { DashboardKpiResponse, DashboardAlertsResponse } from "@ai-jakdang/contracts";

/**
 * 관리자 대시보드 (Story 9.5).
 * 서버 컴포넌트에서 KPI + 운영 알림 API를 fetch하여 실제 수치 표시.
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

const RECENT = [
  { title: "Claude Code로 기존 PHP 프로젝트 분석하는 방법", meta: "바이브코딩 가이드", type: ["badge-blue", "게시글"], author: ["김", "김개발"], status: ["badge-green", "공개"], views: "1,284", date: "2026.06.18" },
  { title: "n8n으로 Gmail 문의 자동 분류가 가능한가요?", meta: "묻고답하기 답변 3개", type: ["badge-purple", "묻고답하기"], author: ["박", "박자동"], status: ["badge-cyan", "답변있음"], views: "846", date: "2026.06.18" },
  { title: "AI 자동화 외주 견적을 잡을 때 꼭 확인할 것", meta: "외주판매 팁", type: ["badge-blue", "게시글"], author: ["최", "최대표"], status: ["badge-red", "신고 있음"], views: "2,194", date: "2026.06.17" },
  { title: "PHP Legacy Code Review Skill", meta: "Claude Code Skill 다운로드 320", type: ["badge-cyan", "실전자료"], author: ["이", "이코딩"], status: ["badge-green", "공개"], views: "734", date: "2026.06.16" },
] as const;

export default async function AdminDashboardPage() {
  const cookieHeader = await getCookieHeader();
  const [kpi, alerts] = await Promise.all([
    fetchKpi(cookieHeader),
    fetchAlerts(cookieHeader),
  ]);

  const totalUsers = kpi?.totalUsers ?? 0;
  const todayNewUsers = kpi?.todayNewUsers ?? 0;
  const totalPosts = kpi?.totalPosts ?? 0;
  const todayNewPosts = kpi?.todayNewPosts ?? 0;
  const totalDownloads = kpi?.totalDownloads ?? 0;
  const pendingReports = kpi?.pendingReports ?? 0;

  const STATS = [
    { label: "전체 회원", value: totalUsers.toLocaleString("ko-KR"), icon: "ri-user-3-line", tone: "blue", dir: "up" as const, delta: `+${todayNewUsers}`, note: "오늘 신규" },
    { label: "전체 게시글", value: totalPosts.toLocaleString("ko-KR"), icon: "ri-file-text-line", tone: "purple", dir: "up" as const, delta: `+${todayNewPosts}`, note: "오늘 신규" },
    { label: "전체 다운로드", value: totalDownloads.toLocaleString("ko-KR"), icon: "ri-download-2-line", tone: "green", dir: "up" as const, delta: "", note: "누적 실전자료" },
    { label: "미처리 신고", value: pendingReports.toLocaleString("ko-KR"), icon: "ri-alarm-warning-line", tone: pendingReports > 0 ? "danger" : "green", dir: pendingReports > 0 ? ("up" as const) : ("down" as const), delta: pendingReports > 0 ? `${pendingReports}건` : "없음", note: pendingReports > 0 ? "확인 필요" : "이상 없음" },
  ];

  const alertReports = alerts?.reports ?? pendingReports;
  const alertQna = alerts?.pendingQna ?? 0;
  const alertNewResources = alerts?.newResources ?? 0;

  const OPERATIONS = [
    { icon: "ri-question-line", style: { background: "var(--warning-bg)", color: "var(--warning)" }, title: "답변대기 질문", desc: "미해결 질문이 있습니다.", count: alertQna.toLocaleString("ko-KR"), href: "/qna", isDanger: false },
    { icon: "ri-alarm-warning-line", style: alertReports > 0 ? { background: "var(--danger-bg)", color: "var(--danger)" } : { background: "var(--success-bg)", color: "var(--success)" }, title: "미처리 신고", desc: alertReports > 0 ? "운영자 확인이 필요합니다." : "모든 신고가 처리됐습니다.", count: alertReports.toLocaleString("ko-KR"), href: "/reports", isDanger: alertReports > 0 },
    { icon: "ri-folder-download-line", style: { background: "var(--primary-50)", color: "var(--primary-600)" }, title: "오늘 신규 자료", desc: "오늘 새로 등록된 자료입니다.", count: alertNewResources.toLocaleString("ko-KR"), href: "/resources", isDanger: false },
  ];

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
                <thead><tr><th>콘텐츠</th><th>유형</th><th>작성자</th><th>상태</th><th>조회</th><th>등록일</th></tr></thead>
                <tbody>
                  {RECENT.map((r) => (
                    <tr key={r.title}>
                      <td><div className="content-title">{r.title}</div><div className="content-meta">{r.meta}</div></td>
                      <td><span className={`badge ${r.type[0]}`}>{r.type[1]}</span></td>
                      <td><div className="author"><span className="author-avatar">{r.author[0]}</span><span>{r.author[1]}</span></div></td>
                      <td><span className={`badge ${r.status[0]}`}>{r.status[1]}</span></td>
                      <td className="num">{r.views}</td>
                      <td className="num">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </Suspense>
      </section>
    </AdminShell>
  );
}

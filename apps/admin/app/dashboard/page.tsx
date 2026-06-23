import { AdminShell } from "@/components/layout/AdminShell";
import { TrafficChart } from "@/components/dashboard/TrafficChart";

/**
 * 관리자 대시보드.
 * @ai-jakdang/admin-design-system 의 마크업/토큰으로 구성한다(관리자 전용, 사용자 사이트와 독립).
 * 통계 수치는 현재 더미 값이며, 이후 단계에서 API(@ai-jakdang/api) 와 연동한다.
 */

// 상단 핵심 지표 카드 데이터(더미). trend: 전일 대비 추세.
const STATS = [
  { label: "오늘 방문자", value: "1,284", icon: "ri-user-3-line", tone: "blue", dir: "up", delta: "12.4%", note: "전일 대비" },
  { label: "오늘 페이지뷰", value: "6,842", icon: "ri-eye-line", tone: "purple", dir: "up", delta: "8.1%", note: "전일 대비" },
  { label: "신규 회원", value: "48", icon: "ri-user-add-line", tone: "green", dir: "up", delta: "5.7%", note: "전일 대비" },
  { label: "미처리 신고", value: "12", icon: "ri-alarm-warning-line", tone: "orange", dir: "down", delta: "3건", note: "어제보다 증가" },
] as const;

// "운영 확인" 목록(더미): 지금 운영자가 확인해야 하는 항목.
const OPERATIONS = [
  {
    icon: "ri-question-line",
    style: { background: "var(--warning-bg)", color: "var(--warning)" },
    title: "답변대기 질문",
    desc: "24시간 이상 답변이 없습니다.",
    count: "18",
  },
  {
    icon: "ri-alarm-warning-line",
    style: { background: "var(--danger-bg)", color: "var(--danger)" },
    title: "미처리 신고",
    desc: "운영자 확인이 필요합니다.",
    count: "12",
  },
  {
    icon: "ri-folder-download-line",
    style: { background: "var(--primary-50)", color: "var(--primary-600)" },
    title: "신규 실전자료",
    desc: "오늘 새로 등록된 자료입니다.",
    count: "7",
  },
] as const;

// 최근 콘텐츠 테이블(더미).
const RECENT = [
  { title: "Claude Code로 기존 PHP 프로젝트 분석하는 방법", meta: "바이브코딩 가이드", type: ["badge-blue", "게시글"], author: ["김", "김개발"], status: ["badge-green", "공개"], views: "1,284", date: "2026.06.18" },
  { title: "n8n으로 Gmail 문의 자동 분류가 가능한가요?", meta: "묻고답하기 · 답변 3개", type: ["badge-purple", "묻고답하기"], author: ["박", "박자동"], status: ["badge-cyan", "답변있음"], views: "846", date: "2026.06.18" },
  { title: "AI 자동화 외주 견적을 잡을 때 꼭 확인할 것", meta: "외주·판매 팁", type: ["badge-blue", "게시글"], author: ["최", "최대표"], status: ["badge-red", "신고 있음"], views: "2,194", date: "2026.06.17" },
  { title: "PHP Legacy Code Review Skill", meta: "Claude Code Skill · 다운로드 320", type: ["badge-cyan", "실전자료"], author: ["이", "이코딩"], status: ["badge-green", "공개"], views: "734", date: "2026.06.16" },
] as const;

export default function AdminDashboardPage() {
  return (
    <AdminShell breadcrumb={["관리자", "대시보드"]} activeKey="dashboard">
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
          <button className="btn btn-primary">
            <i className="ri-add-line" />
            새 게시글
          </button>
        </div>
      </div>

      <section className="grid stats-grid" aria-label="핵심 통계">
        {STATS.map((s) => (
          <article className="stat-card" key={s.label}>
            <div className="stat-head">
              <span className="stat-label">{s.label}</span>
              <span className={`stat-icon ${s.tone}`}>
                <i className={s.icon} />
              </span>
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-foot">
              <span className={`trend ${s.dir}`}>
                <i className={s.dir === "up" ? "ri-arrow-up-line" : "ri-arrow-down-line"} />
                {s.delta}
              </span>
              <span>{s.note}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid dashboard-grid">
        <TrafficChart />

        <article className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">운영 확인</h2>
              <div className="card-subtitle">지금 확인이 필요한 항목</div>
            </div>
            <button className="btn btn-ghost btn-sm">전체 보기</button>
          </div>
          <div className="card-body">
            <div className="operation-list">
              {OPERATIONS.map((op) => (
                <div className="operation-item" key={op.title}>
                  <span className="operation-icon" style={op.style}>
                    <i className={op.icon} />
                  </span>
                  <div className="operation-copy">
                    <div className="operation-title">{op.title}</div>
                    <div className="operation-desc">{op.desc}</div>
                  </div>
                  <span className="operation-count">{op.count}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">최근 콘텐츠</h2>
            <p className="section-description">최근 등록·신고된 콘텐츠입니다.</p>
          </div>
        </div>

        <article className="card">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>콘텐츠</th>
                  <th>유형</th>
                  <th>작성자</th>
                  <th>상태</th>
                  <th>조회</th>
                  <th>등록일</th>
                </tr>
              </thead>
              <tbody>
                {RECENT.map((r) => (
                  <tr key={r.title}>
                    <td>
                      <div className="content-title">{r.title}</div>
                      <div className="content-meta">{r.meta}</div>
                    </td>
                    <td>
                      <span className={`badge ${r.type[0]}`}>{r.type[1]}</span>
                    </td>
                    <td>
                      <div className="author">
                        <span className="author-avatar">{r.author[0]}</span>
                        <span>{r.author[1]}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${r.status[0]}`}>{r.status[1]}</span>
                    </td>
                    <td className="num">{r.views}</td>
                    <td className="num">{r.date}</td>
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

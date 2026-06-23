import { AdminShell } from "@/components/layout/AdminShell";
import { VisitorTrendChart } from "@/components/stats/VisitorTrendChart";

/**
 * 접속 통계 페이지.
 * @ai-jakdang/admin-design-system 의 마크업/토큰으로 구성한다(관리자 전용).
 * 모든 수치는 더미(정적 상수)이며, 이후 단계에서 API(@ai-jakdang/api)·GA 연동으로 대체한다.
 */

// 핵심 지표 카드(더미). delta: 직전 동일기간 대비 증감. dir: 추세 방향(up=증가, down=감소).
const STATS = [
  { label: "방문자수", value: "38,420", icon: "ri-user-3-line", tone: "blue", dir: "up", delta: "12.4%", note: "지난 기간 대비" },
  { label: "페이지뷰", value: "204,118", icon: "ri-eye-line", tone: "purple", dir: "up", delta: "9.2%", note: "지난 기간 대비" },
  { label: "세션수", value: "52,910", icon: "ri-window-line", tone: "blue", dir: "up", delta: "7.8%", note: "지난 기간 대비" },
  { label: "신규 방문자", value: "21,640", icon: "ri-user-add-line", tone: "green", dir: "up", delta: "5.1%", note: "지난 기간 대비" },
  { label: "재방문자", value: "16,780", icon: "ri-user-follow-line", tone: "purple", dir: "up", delta: "3.6%", note: "지난 기간 대비" },
  { label: "평균 체류시간", value: "4분 12초", icon: "ri-time-line", tone: "blue", dir: "up", delta: "18초", note: "지난 기간 대비" },
  { label: "이탈률", value: "41.3%", icon: "ri-logout-box-r-line", tone: "orange", dir: "down", delta: "2.1%p", note: "낮을수록 좋음" },
  { label: "회원가입 전환수", value: "1,284", icon: "ri-user-star-line", tone: "green", dir: "up", delta: "14.7%", note: "방문 대비 전환" },
] as const;

// 유입 경로 분석(더미). 방문자수 기준 비율. tone: 아이콘 색상 토큰 배경.
const SOURCES = [
  { icon: "ri-search-line", style: { background: "var(--primary-50)", color: "var(--primary-600)" }, title: "검색엔진", desc: "네이버 · 구글 · 다음 자연 유입", visits: "14,210", ratio: "37.0%" },
  { icon: "ri-cursor-line", style: { background: "var(--success-bg)", color: "var(--success)" }, title: "직접 유입", desc: "URL 직접 입력 · 북마크", visits: "8,640", ratio: "22.5%" },
  { icon: "ri-instagram-line", style: { background: "var(--warning-bg)", color: "var(--warning)" }, title: "SNS", desc: "인스타 · 유튜브 · 스레드", visits: "5,920", ratio: "15.4%" },
  { icon: "ri-links-line", style: { background: "var(--primary-50)", color: "var(--primary-600)" }, title: "외부 링크", desc: "블로그 · 커뮤니티 레퍼럴", visits: "3,810", ratio: "9.9%" },
  { icon: "ri-megaphone-line", style: { background: "var(--danger-bg)", color: "var(--danger)" }, title: "광고", desc: "메타 · 구글 애즈 캠페인", visits: "3,180", ratio: "8.3%" },
  { icon: "ri-robot-2-line", style: { background: "var(--warning-bg)", color: "var(--warning)" }, title: "AI 검색(추정)", desc: "ChatGPT · Perplexity 인용 추정", visits: "1,820", ratio: "4.7%" },
  { icon: "ri-more-line", style: { background: "var(--gray-100)", color: "var(--gray-500)" }, title: "기타", desc: "분류 불가 · 미식별", visits: "840", ratio: "2.2%" },
] as const;

// 검색 키워드 분석(더미): 유입검색어별 방문/PV/가입/다운로드/평균체류.
const KEYWORDS = [
  { kw: "claude code 사용법", visits: "3,420", pv: "11,280", signups: "182", downloads: "640", stay: "5분 48초" },
  { kw: "n8n 자동화 예제", visits: "2,810", pv: "8,940", signups: "146", downloads: "512", stay: "6분 02초" },
  { kw: "ai 외주 단가", visits: "2,140", pv: "5,670", signups: "98", downloads: "210", stay: "3분 51초" },
  { kw: "바이브코딩 뜻", visits: "1,960", pv: "4,210", signups: "71", downloads: "88", stay: "2분 44초" },
  { kw: "gpt api 수익화", visits: "1,540", pv: "4,880", signups: "63", downloads: "194", stay: "4분 33초" },
  { kw: "claude skill 만들기", visits: "1,210", pv: "3,920", signups: "57", downloads: "276", stay: "5분 12초" },
  { kw: "php 레거시 리팩토링", visits: "980", pv: "2,640", signups: "29", downloads: "131", stay: "4분 05초" },
] as const;

// 게시글별 성과(더미): 조회/체류/댓글/좋아요/신고/검색유입/가입전환.
const POST_PERF = [
  { title: "Claude Code로 기존 PHP 프로젝트 분석하는 방법", meta: "바이브코딩 가이드", type: ["badge-blue", "게시글"], views: "12,840", stay: "6분 21초", comments: "84", likes: "412", reports: "0", organic: "3,210", signups: "146" },
  { title: "n8n으로 Gmail 문의 자동 분류 워크플로 만들기", meta: "AI 자동화 · 실습", type: ["badge-purple", "묻고답하기"], views: "9,460", stay: "5분 47초", comments: "61", likes: "298", reports: "1", organic: "2,640", signups: "118" },
  { title: "AI 자동화 외주 견적을 잡을 때 꼭 확인할 것", meta: "외주·판매 팁", type: ["badge-blue", "게시글"], views: "8,210", stay: "4분 12초", comments: "53", likes: "187", reports: "4", organic: "1,980", signups: "72" },
  { title: "GPT API로 월 300 버는 자동화 봇 구조", meta: "AI 수익화 사례", type: ["badge-blue", "게시글"], views: "7,330", stay: "5분 09초", comments: "47", likes: "264", reports: "0", organic: "1,540", signups: "98" },
] as const;

// 실전자료별 성과(더미): 조회/다운로드/다운로드전환율/평점/후기/신고.
// conv(다운로드 전환율) = 다운로드수 / 조회수. tone: 전환율 강조 배지 색상.
const RESOURCE_PERF = [
  { title: "PHP Legacy Code Review Skill", meta: "Claude Code Skill", views: "8,420", downloads: "3,180", conv: "37.8%", tone: "badge-green", rating: "4.8", reviews: "212", reports: "1" },
  { title: "n8n 문의 자동분류 워크플로 템플릿", meta: "n8n Template", views: "6,210", downloads: "2,040", conv: "32.8%", tone: "badge-green", rating: "4.7", reviews: "168", reports: "0" },
  { title: "GPT 수익화 봇 보일러플레이트", meta: "Node.js 스타터", views: "5,840", downloads: "1,520", conv: "26.0%", tone: "badge-cyan", rating: "4.5", reviews: "131", reports: "2" },
  { title: "AI 외주 견적·계약서 양식 패키지", meta: "문서 템플릿", views: "4,110", downloads: "624", conv: "15.2%", tone: "badge-orange", rating: "4.2", reviews: "57", reports: "0" },
] as const;

export default function AdminStatsPage() {
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

      {/* 기간 필터: 세그먼트(오늘~지난달) + 사용자지정 날짜 입력 */}
      <article className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="filter-row">
            <div className="segmented" role="tablist" aria-label="통계 기간">
              <button className="segment" data-range="today">
                오늘
              </button>
              <button className="segment" data-range="yesterday">
                어제
              </button>
              <button className="segment active" data-range="7days">
                최근 7일
              </button>
              <button className="segment" data-range="30days">
                최근 30일
              </button>
              <button className="segment" data-range="thismonth">
                이번달
              </button>
              <button className="segment" data-range="lastmonth">
                지난달
              </button>
              <button className="segment" data-range="custom">
                사용자지정
              </button>
            </div>
            <div className="input-icon">
              <i className="ri-calendar-line" />
              <input className="control" type="text" defaultValue="2026.06.12 - 2026.06.18" aria-label="사용자지정 기간" />
            </div>
            <div className="filter-actions">
              <button className="btn btn-primary">
                <i className="ri-search-line" />
                조회
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* 핵심 지표 카드 */}
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

      {/* 방문자 추이 차트 + 유입 경로 분석 */}
      <section className="grid dashboard-grid">
        <VisitorTrendChart />

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

      {/* 실전자료별 성과 테이블 — 다운로드 전환율 강조 */}
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

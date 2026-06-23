import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 신고 관리 페이지 — 통합 신고 화면.
 * 회원이 게시글/댓글/질문/답변/실전자료/후기/회원프로필에 대해 접수한 신고를
 * 운영자가 한 곳에서 확인·처리한다.
 * 데이터는 전부 더미(정적 상수)이며, 이후 단계에서 @ai-jakdang/api 와 연동한다.
 *
 * 운영 원칙: 신고가 들어왔다고 무조건 삭제하지 않는다.
 * 대상·사유를 확인한 뒤 숨김/삭제/반려 중 하나로 처리한다.
 */

// 처리 상태 탭(.line-tabs). count = 해당 상태의 미처리/누적 건수.
// data-tab 값은 아래 REPORTS 행의 data-status 와 맞물려 필터링된다.
const STATUS_TABS = [
  { key: "all", label: "전체", count: 38 }, // 모든 신고 건수 합계
  { key: "received", label: "접수", count: 12 }, // 아직 운영자가 열어보지 않은 신규 신고
  { key: "reviewing", label: "확인중", count: 5 }, // 운영자가 검토 진행 중
  { key: "resolved", label: "처리완료", count: 18 }, // 숨김/삭제/제재 등 조치가 끝남
  { key: "rejected", label: "반려", count: 3 }, // 신고가 타당하지 않아 기각함
] as const;

// 신고 대상 유형 필터(커스텀 셀렉트). data-value 가 REPORTS 행의 data-target 과 일치.
const TARGET_OPTIONS = [
  { value: "all", label: "대상 유형: 전체" },
  { value: "post", label: "게시글" },
  { value: "comment", label: "댓글" },
  { value: "question", label: "질문" },
  { value: "answer", label: "답변" },
  { value: "resource", label: "실전자료" },
  { value: "review", label: "후기" },
  { value: "profile", label: "회원프로필" },
] as const;

// 신고 사유 필터(커스텀 셀렉트). data-value 가 REPORTS 행의 data-reason 과 일치.
const REASON_OPTIONS = [
  { value: "all", label: "신고 사유: 전체" },
  { value: "spam", label: "스팸·광고" },
  { value: "abuse", label: "욕설·비방" },
  { value: "inappropriate", label: "부적절한 내용" },
  { value: "copyright", label: "저작권" },
  { value: "malware", label: "악성파일 의심" },
  { value: "mismatch", label: "설명과 다른 자료" },
  { value: "privacy", label: "개인정보 노출" },
  { value: "etc", label: "기타" },
] as const;

// 상단 요약 통계 카드(더미). 신고 처리 현황을 한눈에 보여준다.
const STATS = [
  { label: "오늘 접수 신고", value: "12", icon: "ri-flag-2-line", tone: "orange", dir: "up", delta: "4건", note: "어제보다 증가" },
  { label: "확인중", value: "5", icon: "ri-search-eye-line", tone: "purple", dir: "up", delta: "1건", note: "전일 대비" },
  { label: "오늘 처리완료", value: "9", icon: "ri-shield-check-line", tone: "green", dir: "up", delta: "23%", note: "처리율 상승" },
  { label: "누적 미처리", value: "17", icon: "ri-alarm-warning-line", tone: "blue", dir: "down", delta: "2건", note: "어제보다 감소" },
] as const;

/**
 * 신고 테이블 행(더미). 한 행 = 하나의 신고 건.
 * - target: 신고 대상 유형(필터 data-target 과 매칭)
 * - targetBadge: 대상 유형 배지 [클래스, 라벨]
 * - summary / meta: 신고 대상 콘텐츠 요약과 위치
 * - reason: 신고 사유 코드(필터 data-reason 과 매칭)
 * - reasonBadge: 사유 배지 [클래스, 라벨]
 * - reporter: 신고자(신고를 접수한 회원)
 * - author: 작성자(신고 대상 콘텐츠를 만든 회원)
 * - date: 신고일
 * - count: 같은 대상에 누적된 신고 수
 * - status: 처리 상태 코드(탭 data-tab 과 매칭)
 * - statusBadge: 상태 배지 [클래스, 라벨]
 */
const REPORTS = [
  {
    id: "r-1001", // 신고 건 식별자(상세 페이지 경로 /reports/{id} 에 사용)
    target: "post",
    targetBadge: ["badge-blue", "게시글"],
    summary: "무료 자동화 강의 신청하면 100만원 환급! 지금 링크 클릭",
    meta: "AI 수익화 게시판",
    reason: "spam",
    reasonBadge: ["badge-orange", "스팸·광고"],
    reporter: ["정", "정클린"],
    author: ["광", "광고왕"],
    date: "2026.06.18",
    count: "7",
    status: "received",
    statusBadge: ["badge-gray", "접수"],
  },
  {
    id: "r-1002",
    target: "comment",
    targetBadge: ["badge-purple", "댓글"],
    summary: "이런 것도 모르면서 글을 쓰냐 한심하다 진짜",
    meta: "바이브코딩 가이드 글의 댓글",
    reason: "abuse",
    reasonBadge: ["badge-red", "욕설·비방"],
    reporter: ["김", "김개발"],
    author: ["악", "악플러99"],
    date: "2026.06.18",
    count: "3",
    status: "received",
    statusBadge: ["badge-gray", "접수"],
  },
  {
    id: "r-1003",
    target: "resource",
    targetBadge: ["badge-cyan", "실전자료"],
    summary: "n8n 자동화 워크플로우 템플릿 모음.zip",
    meta: "실전자료 · 다운로드 142",
    reason: "malware",
    reasonBadge: ["badge-red", "악성파일 의심"],
    reporter: ["이", "이코딩"],
    author: ["배", "배포자"],
    date: "2026.06.17",
    count: "2",
    status: "reviewing",
    statusBadge: ["badge-purple", "확인중"],
  },
  {
    id: "r-1004",
    target: "resource",
    targetBadge: ["badge-cyan", "실전자료"],
    summary: "ChatGPT 프롬프트 200선 PDF",
    meta: "실전자료 · 유료 9,900원",
    reason: "mismatch",
    reasonBadge: ["badge-orange", "설명과 다른 자료"],
    reporter: ["박", "박자동"],
    author: ["판", "판매자K"],
    date: "2026.06.17",
    count: "4",
    status: "reviewing",
    statusBadge: ["badge-purple", "확인중"],
  },
  {
    id: "r-1005",
    target: "question",
    targetBadge: ["badge-blue", "질문"],
    summary: "여기 제 카톡 오픈채팅 링크인데 들어오세요 (개인정보 노출)",
    meta: "묻고답하기",
    reason: "privacy",
    reasonBadge: ["badge-gray", "개인정보 노출"],
    reporter: ["한", "한사용"],
    author: ["초", "초보질문"],
    date: "2026.06.16",
    count: "1",
    status: "received",
    statusBadge: ["badge-gray", "접수"],
  },
  {
    id: "r-1006",
    target: "answer",
    targetBadge: ["badge-purple", "답변"],
    summary: "제 블로그에 정답 있으니 보세요 (반복 도배성 답변)",
    meta: "묻고답하기 답변",
    reason: "spam",
    reasonBadge: ["badge-orange", "스팸·광고"],
    reporter: ["최", "최대표"],
    author: ["도", "도배봇"],
    date: "2026.06.16",
    count: "5",
    status: "resolved",
    statusBadge: ["badge-green", "처리완료"],
  },
  {
    id: "r-1007",
    target: "review",
    targetBadge: ["badge-gray", "후기"],
    summary: "돈만 받고 환불 안 해주는 사기꾼입니다 (근거 없는 비방)",
    meta: "실전자료 후기",
    reason: "abuse",
    reasonBadge: ["badge-red", "욕설·비방"],
    reporter: ["판", "판매자K"],
    author: ["불", "불만러"],
    date: "2026.06.15",
    count: "2",
    status: "rejected",
    statusBadge: ["badge-blue", "반려"],
  },
  {
    id: "r-1008",
    target: "profile",
    targetBadge: ["badge-green", "회원프로필"],
    summary: "프로필 소개에 불법 도박 사이트 광고 문구 기재",
    meta: "회원 프로필 · @gambling_ad",
    reason: "inappropriate",
    reasonBadge: ["badge-orange", "부적절한 내용"],
    reporter: ["정", "정클린"],
    author: ["계", "계정정지대상"],
    date: "2026.06.15",
    count: "6",
    status: "resolved",
    statusBadge: ["badge-green", "처리완료"],
  },
  {
    id: "r-1009",
    target: "post",
    targetBadge: ["badge-blue", "게시글"],
    summary: "유명 강사 PDF 강의자료 무단 전재해서 올린 글",
    meta: "바이브 코딩 게시판",
    reason: "copyright",
    reasonBadge: ["badge-purple", "저작권"],
    reporter: ["이", "이코딩"],
    author: ["복", "복붙맨"],
    date: "2026.06.14",
    count: "3",
    status: "reviewing",
    statusBadge: ["badge-purple", "확인중"],
  },
  {
    id: "r-1010",
    target: "comment",
    targetBadge: ["badge-purple", "댓글"],
    summary: "기타 사유로 신고된 댓글 (운영자 확인 필요)",
    meta: "AI 자동화 게시판 댓글",
    reason: "etc",
    reasonBadge: ["badge-gray", "기타"],
    reporter: ["한", "한사용"],
    author: ["익", "익명회원"],
    date: "2026.06.14",
    count: "1",
    status: "resolved",
    statusBadge: ["badge-green", "처리완료"],
  },
] as const;

export default function AdminReportsPage() {
  return (
    <AdminShell breadcrumb={["관리자", "신고 관리"]} activeKey="reports">
      <div className="page-header">
        <div>
          <h1 className="page-title">신고 관리</h1>
          <p className="page-description">회원이 접수한 신고를 한 곳에서 확인하고 처리합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            CSV 다운로드
          </button>
          <button className="btn btn-outline">
            <i className="ri-history-line" />
            처리 이력
          </button>
        </div>
      </div>

      {/* 운영 원칙 안내 — 신고 처리 시 반드시 지켜야 하는 원칙 */}
      <div className="alert alert-warning" role="note" style={{ marginBottom: "20px" }}>
        <i className="ri-alert-line" />
        <div>
          <strong>처리 원칙</strong>
          <br />
          신고가 들어왔다고 무조건 삭제하지 않습니다. 신고 대상과 사유를 먼저 확인한 뒤
          숨김 · 삭제 · 반려 중 적절한 조치를 선택하세요.
        </div>
      </div>

      <section className="grid stats-grid" aria-label="신고 처리 현황">
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

      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">신고 목록</h2>
            <p className="section-description">처리 상태 · 대상 유형 · 사유로 좁혀 확인할 수 있습니다.</p>
          </div>
        </div>

        <article className="card">
          {/* 처리 상태 탭 — 각 탭에 미처리/누적 건수 배지 */}
          <div className="line-tabs" role="tablist" aria-label="처리 상태">
            {STATUS_TABS.map((t, i) => (
              <button
                key={t.key}
                className={`line-tab${i === 0 ? " active" : ""}`}
                data-tab={t.key}
              >
                {t.label}
                <span className="badge badge-gray" style={{ marginLeft: "6px" }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* 필터: 검색 + 대상 유형 + 사유 + 기간 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input className="control" type="search" placeholder="대상 내용 또는 신고자/작성자 검색" aria-label="신고 검색" />
              </div>

              <div className="custom-select" data-select="target">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>대상 유형: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {TARGET_OPTIONS.map((o, i) => (
                    <button
                      key={o.value}
                      className={`select-option${i === 0 ? " selected" : ""}`}
                      data-value={o.value}
                    >
                      {o.label}
                      {i === 0 ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-select" data-select="reason">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>신고 사유: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {REASON_OPTIONS.map((o, i) => (
                    <button
                      key={o.value}
                      className={`select-option${i === 0 ? " selected" : ""}`}
                      data-value={o.value}
                    >
                      {o.label}
                      {i === 0 ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-icon">
                <i className="ri-calendar-line" />
                <input className="control" type="text" defaultValue="2026.06.01 - 2026.06.18" aria-label="신고 기간" />
              </div>

              <div className="filter-actions">
                <button className="btn btn-outline">
                  <i className="ri-refresh-line" />
                  초기화
                </button>
                <button className="btn btn-primary">
                  <i className="ri-search-line" />
                  검색
                </button>
              </div>
            </div>

            {/* 현재 적용된 필터 칩(더미) */}
            <div className="active-filters">
              <span className="filter-chip">
                미처리(접수)
                <button aria-label="필터 제거">
                  <i className="ri-close-line" />
                </button>
              </span>
              <span className="filter-chip">
                최근 18일
                <button aria-label="필터 제거">
                  <i className="ri-close-line" />
                </button>
              </span>
            </div>
          </div>

          {/* 툴바: 선택 정보 + 일괄 반려 / 일괄 숨김 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 {REPORTS.length}건의 신고</span>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>
                선택 반려
              </button>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>
                선택 숨김
              </button>
            </div>
            <div className="toolbar-right">
              {/* 처리 이력 보기(디자인만). 개별 신고 처리는 행의 상세보기로 이동한다. */}
              <button className="btn btn-outline btn-sm">
                <i className="ri-history-line" />
                처리 이력
              </button>
            </div>
          </div>

          {/* 신고 테이블 */}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "44px" }}>
                    <input className="check" data-admin-select-all type="checkbox" aria-label="전체 선택" />
                  </th>
                  <th>신고 대상</th>
                  <th>신고 사유</th>
                  <th>신고자</th>
                  <th>작성자</th>
                  <th>신고일</th>
                  <th>누적 신고</th>
                  <th>처리 상태</th>
                  <th style={{ width: "60px" }}>처리</th>
                </tr>
              </thead>
              <tbody>
                {REPORTS.map((r) => (
                  <tr
                    key={r.id}
                    data-target={r.target}
                    data-reason={r.reason}
                    data-status={r.status}
                  >
                    <td>
                      <input className="check row-check" type="checkbox" aria-label="행 선택" />
                    </td>
                    <td>
                      {/* 신고 대상 제목 클릭 시 상세 페이지로 이동(드로어 대신) */}
                      <Link className="content-title" href={`/reports/${r.id}`}>
                        {r.summary}
                      </Link>
                      <div className="content-meta">
                        <span className={`badge ${r.targetBadge[0]}`}>{r.targetBadge[1]}</span>
                        {" "}
                        {r.meta}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${r.reasonBadge[0]}`}>{r.reasonBadge[1]}</span>
                    </td>
                    <td>
                      <div className="author">
                        <span className="author-avatar">{r.reporter[0]}</span>
                        <span>{r.reporter[1]}</span>
                      </div>
                    </td>
                    <td>
                      <div className="author">
                        <span className="author-avatar">{r.author[0]}</span>
                        <span>{r.author[1]}</span>
                      </div>
                    </td>
                    <td className="num">{r.date}</td>
                    <td className="num">{r.count}</td>
                    <td>
                      <span className={`badge ${r.statusBadge[0]}`}>{r.statusBadge[1]}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button row-action-button" aria-label="행 메뉴">
                          <i className="ri-more-2-fill" />
                        </button>
                        <div className="action-menu">
                          {/* 상세보기 → 신고 상세 페이지로 이동(드로어 제거) */}
                          <Link href={`/reports/${r.id}`}>
                            <i className="ri-eye-line" />
                            상세보기
                          </Link>
                          <button>
                            <i className="ri-eye-off-line" />
                            대상 숨김
                          </button>
                          <button>
                            <i className="ri-close-circle-line" />
                            신고 반려
                          </button>
                          <button className="danger">
                            <i className="ri-delete-bin-line" />
                            대상 삭제
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div className="page-info">1–{REPORTS.length} / 총 38건</div>
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
    </AdminShell>
  );
}

import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 묻고답하기 관리.
 * @ai-jakdang/admin-design-system 의 마크업/토큰으로 구성한다(관리자 전용).
 * 질문 목록을 상태별로 필터링하고, 행 액션으로 숨김/삭제/복구/상태강제변경을 처리하며,
 * 우측 드로어에서 질문 상세 + 답변 목록(답변 보기/숨김/삭제)을 확인한다.
 * 수치는 전부 더미이며, 이후 단계에서 API(@ai-jakdang/api) 와 연동한다.
 *
 * 주의: 운영자는 "도움된 답변 지정"을 하지 않는다. 도움된답변 여부는 배지로 "표시"만 한다.
 */

// 상단 핵심 지표 카드(더미). 묻고답하기 운영 현황 요약.
const STATS = [
  { label: "전체 질문", value: "1,842", icon: "ri-question-answer-line", tone: "blue", dir: "up", delta: "23건", note: "오늘 신규" },
  { label: "답변대기", value: "37", icon: "ri-time-line", tone: "orange", dir: "down", delta: "5건", note: "24h 이상 미답변" },
  { label: "신고 누적", value: "9", icon: "ri-alarm-warning-line", tone: "purple", dir: "up", delta: "2건", note: "운영자 확인 필요" },
  { label: "해결된 질문", value: "1,204", icon: "ri-checkbox-circle-line", tone: "green", dir: "up", delta: "65.3%", note: "전체 대비 해결율" },
] as const;

// 상태 필터 탭(.line-tabs). 첫 번째가 기본 활성(active).
// 운영 맥락: 답변대기/신고있음은 즉시 확인 필요, 도움된답변있음은 양질의 답변이 달린 질문 모음.
const TABS = [
  { key: "all", label: "전체" },
  { key: "waiting", label: "답변대기" },
  { key: "answered", label: "답변있음" },
  { key: "resolved", label: "해결됨" },
  { key: "reported", label: "신고있음" },
  { key: "helpful", label: "도움된답변있음" },
] as const;

/**
 * 질문 목록(더미). 각 필드 의미:
 * - status: [배지클래스, 표시문구] — 질문의 현재 상태(공개/숨김 등 운영 상태가 아닌 Q&A 진행 상태)
 * - rowStatus: 필터 탭 매칭용 상태 키(answered/waiting/resolved/reported)
 * - answers: 달린 답변 수
 * - views: 조회수 / likes: 좋아요수 / reports: 신고수
 * - helpful: 도움된 답변(질문자가 채택한 답변)이 존재하는지 — 운영자는 지정하지 않고 표시만 한다
 * - hidden: 운영자가 숨김 처리했는지(true면 행을 흐리게 표시하고 복구 액션을 노출)
 * - detail: 드로어에 표시할 상세(작성자 이메일/본문 요약)
 * - replies: 드로어에 표시할 답변 목록(답변자/요약/숨김여부/도움됨여부)
 */
const QUESTIONS = [
  {
    id: "q1",
    title: "n8n으로 Gmail 문의를 자동으로 분류·라벨링할 수 있나요?",
    meta: "AI 자동화 · 워크플로우",
    author: ["박", "박자동", "auto.park@example.com"],
    date: "2026.06.18",
    status: ["badge-cyan", "답변있음"],
    rowStatus: "answered",
    answers: 3,
    views: "846",
    likes: 41,
    reports: 0,
    helpful: true,
    hidden: false,
    body: "Gmail로 들어오는 외주 문의가 많아 라벨로 자동 분류하고 싶습니다. n8n 트리거 구성이 가능한지 궁금합니다.",
    replies: [
      { author: ["김", "김자동"], summary: "Gmail Trigger + Switch 노드로 키워드 분기하면 됩니다. 예시 워크플로우 첨부합니다.", hidden: false, helpful: true },
      { author: ["이", "이코딩"], summary: "OpenAI 노드로 본문을 분류 카테고리로 요약시키면 정확도가 더 좋아집니다.", hidden: false, helpful: false },
      { author: ["광", "광고봇"], summary: "[외부링크 도배성 답변]", hidden: true, helpful: false },
    ],
  },
  {
    id: "q2",
    title: "Claude Code로 레거시 PHP 코드를 안전하게 리팩터링하는 순서가 있을까요?",
    meta: "바이브 코딩 · 리팩터링",
    author: ["최", "최대표", "ceo.choi@example.com"],
    date: "2026.06.18",
    status: ["badge-orange", "답변대기"],
    rowStatus: "waiting",
    answers: 0,
    views: "312",
    likes: 7,
    reports: 0,
    helpful: false,
    hidden: false,
    body: "테스트 코드가 거의 없는 PHP 프로젝트입니다. Claude Code에게 어떤 순서로 작업을 시키는 게 안전한지 모르겠습니다.",
    replies: [],
  },
  {
    id: "q3",
    title: "GPTs와 Claude Projects 중 사내 지식봇은 뭐가 더 낫나요?",
    meta: "AI 활용 · 비교",
    author: ["한", "한사용", "user.han@example.com"],
    date: "2026.06.17",
    status: ["badge-green", "해결됨"],
    rowStatus: "resolved",
    answers: 5,
    views: "1,932",
    likes: 88,
    reports: 0,
    helpful: true,
    hidden: false,
    body: "사내 문서 50여 개를 올려두고 직원들이 질의응답할 수 있게 하려고 합니다. 보안·정확도 측면에서 추천 부탁드립니다.",
    replies: [
      { author: ["정", "정엔지"], summary: "사내 보안이 중요하면 Projects가 낫습니다. 데이터 보존 정책이 명확합니다.", hidden: false, helpful: true },
      { author: ["윤", "윤기획"], summary: "비개발자 배포가 쉬운 건 GPTs입니다. 링크만 공유하면 되니까요.", hidden: false, helpful: false },
    ],
  },
  {
    id: "q4",
    title: "이 자동화 강의 환불해주세요 / 사기 아닌가요?",
    meta: "AI 수익화 · 후기 (신고 누적)",
    author: ["불", "불만러", "angry.user@example.com"],
    date: "2026.06.17",
    status: ["badge-red", "신고있음"],
    rowStatus: "reported",
    answers: 2,
    views: "2,210",
    likes: 3,
    reports: 6,
    helpful: false,
    hidden: false,
    body: "특정 판매자를 비방하는 내용이 반복 신고되었습니다. 운영자 확인 후 처리가 필요합니다.",
    replies: [
      { author: ["판", "판매자A"], summary: "환불 규정은 페이지 하단에 명시되어 있습니다. 메일로 접수 부탁드립니다.", hidden: false, helpful: false },
      { author: ["익", "익명123"], summary: "[타 회원 비방·욕설 포함 신고된 답변]", hidden: true, helpful: false },
    ],
  },
  {
    id: "q5",
    title: "Supabase RLS 정책이 적용이 안 되는데 어디를 봐야 하나요?",
    meta: "바이브 코딩 · 백엔드",
    author: ["서", "서버리스", "dev.seo@example.com"],
    date: "2026.06.16",
    status: ["badge-cyan", "답변있음"],
    rowStatus: "answered",
    answers: 4,
    views: "1,108",
    likes: 52,
    reports: 0,
    helpful: true,
    hidden: false,
    body: "RLS를 켰는데도 다른 유저 데이터가 보입니다. service_role 키를 클라이언트에서 쓰고 있는 건 아닌지 확인이 필요해 보입니다.",
    replies: [
      { author: ["오", "오백엔"], summary: "service_role 키는 서버에서만 쓰세요. 클라이언트는 anon 키여야 RLS가 적용됩니다.", hidden: false, helpful: true },
      { author: ["남", "남디비"], summary: "정책에 auth.uid() = user_id 조건이 빠졌을 가능성도 있습니다.", hidden: false, helpful: false },
    ],
  },
  {
    id: "q6",
    title: "[중복/스팸] 무료로 자동화 봇 만들어드립니다 연락주세요",
    meta: "AI 자동화 (운영자 숨김 처리)",
    author: ["스", "스팸계정", "spam.bot@example.com"],
    date: "2026.06.15",
    status: ["badge-gray", "숨김"],
    rowStatus: "reported",
    answers: 0,
    views: "64",
    likes: 0,
    reports: 3,
    helpful: false,
    hidden: true,
    body: "외부 연락처 유도 + 도배성 게시물로 운영자가 숨김 처리했습니다. 필요 시 복구할 수 있습니다.",
    replies: [],
  },
] as const;

export default function AdminQnaPage() {
  return (
    <AdminShell breadcrumb={["관리자", "묻고답하기 관리"]} activeKey="qna">
      <div className="page-header">
        <div>
          <h1 className="page-title">묻고답하기 관리</h1>
          <p className="page-description">질문과 답변을 상태별로 점검하고 숨김·삭제·복구를 처리합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            CSV 다운로드
          </button>
          <Link className="btn btn-primary" href="/qna/new">
            <i className="ri-add-line" />
            새 질문
          </Link>
        </div>
      </div>

      <section className="grid stats-grid" aria-label="묻고답하기 통계">
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
            <h2 className="section-title">질문 목록</h2>
            <p className="section-description">상태 탭으로 좁힌 뒤 행 메뉴에서 개별 처리합니다.</p>
          </div>
        </div>

        <article className="card">
          {/* 상태 필터 탭 — 첫 항목(전체)이 기본 활성 */}
          <div className="line-tabs" role="tablist" aria-label="질문 상태">
            {TABS.map((t, i) => (
              <button
                key={t.key}
                className={`line-tab${i === 0 ? " active" : ""}`}
                data-tab={t.key}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 검색 + 게시판/도움된답변 필터 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input className="control" type="search" placeholder="질문 제목 또는 작성자 검색" aria-label="질문 검색" />
              </div>
              <div className="custom-select" data-select="board">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>게시판: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">게시판: 전체<i className="ri-check-line" /></button>
                  <button className="select-option" data-value="vibe">바이브 코딩</button>
                  <button className="select-option" data-value="automation">AI 자동화</button>
                  <button className="select-option" data-value="monetization">AI 수익화</button>
                </div>
              </div>
              <div className="custom-select" data-select="helpful">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>도움된답변: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">도움된답변: 전체<i className="ri-check-line" /></button>
                  <button className="select-option" data-value="yes">있음</button>
                  <button className="select-option" data-value="no">없음</button>
                </div>
              </div>
              <div className="input-icon">
                <i className="ri-calendar-line" />
                <input className="control" type="text" defaultValue="2026.06.01 - 2026.06.18" aria-label="기간" />
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
            <div className="active-filters">
              <span className="filter-chip">답변대기<button aria-label="필터 제거"><i className="ri-close-line" /></button></span>
              <span className="filter-chip">최근 18일<button aria-label="필터 제거"><i className="ri-close-line" /></button></span>
            </div>
          </div>

          {/* 일괄 처리 툴바 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 6개의 질문</span>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>선택 숨김</button>
              <button className="btn btn-danger btn-sm" data-admin-requires-selection disabled>선택 삭제</button>
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
                  <th style={{ width: "44px" }}>
                    <input className="check" data-admin-select-all type="checkbox" aria-label="전체 선택" />
                  </th>
                  <th>질문 제목</th>
                  <th>작성자</th>
                  <th>작성일</th>
                  <th>상태</th>
                  <th>답변</th>
                  <th>조회</th>
                  <th>좋아요</th>
                  <th>신고</th>
                  <th>도움된답변</th>
                  <th style={{ width: "60px" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {QUESTIONS.map((q) => (
                  <tr
                    key={q.id}
                    data-status={q.rowStatus}
                    data-helpful={q.helpful ? "yes" : "no"}
                    style={q.hidden ? { opacity: 0.55 } : undefined}
                  >
                    <td>
                      <input className="check row-check" type="checkbox" />
                    </td>
                    <td>
                      {/* 요구 3: 제목 클릭 시 드로어가 아니라 상세 페이지로 이동 */}
                      <Link className="content-title" href={`/qna/${q.id}`}>{q.title}</Link>
                      <div className="content-meta">{q.meta}</div>
                    </td>
                    <td>
                      <div className="author">
                        <span className="author-avatar">{q.author[0]}</span>
                        <span>{q.author[1]}</span>
                      </div>
                    </td>
                    <td className="num">{q.date}</td>
                    <td>
                      <span className={`badge ${q.status[0]}`}>{q.status[1]}</span>
                    </td>
                    <td className="num">{q.answers}</td>
                    <td className="num">{q.views}</td>
                    <td className="num">{q.likes}</td>
                    <td className="num">{q.reports}</td>
                    <td>
                      {/* 도움된답변 여부는 표시만 — 운영자가 지정하지 않는다 */}
                      {q.helpful ? (
                        <span className="badge badge-purple">
                          <i className="ri-medal-line" /> 있음
                        </span>
                      ) : (
                        <span className="badge badge-gray">없음</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button row-action-button" aria-label="행 메뉴">
                          <i className="ri-more-2-fill" />
                        </button>
                        <div className="action-menu">
                          {/* 요구 3: 보기/답변 관리는 드로어가 아니라 상세 페이지 링크로 이동 */}
                          <Link href={`/qna/${q.id}`}>
                            <i className="ri-eye-line" />
                            질문 보기
                          </Link>
                          {/* 행 액션 "수정" → edit 라우트 링크 */}
                          <Link href={`/qna/${q.id}/edit`}>
                            <i className="ri-edit-line" />
                            질문 수정
                          </Link>
                          <Link href={`/qna/${q.id}`}>
                            <i className="ri-chat-3-line" />
                            답변 관리
                          </Link>
                          {/* 숨김 상태면 복구, 아니면 숨김 노출(디자인만) */}
                          {q.hidden ? (
                            <button type="button">
                              <i className="ri-arrow-go-back-line" />
                              질문 복구
                            </button>
                          ) : (
                            <button type="button">
                              <i className="ri-eye-off-line" />
                              질문 숨김
                            </button>
                          )}
                          <button className="danger" type="button">
                            <i className="ri-delete-bin-line" />
                            질문 삭제
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
            <div className="page-info">1–6 / 총 1,842개</div>
            <div className="page-buttons">
              <button className="page-button" aria-label="이전 페이지"><i className="ri-arrow-left-s-line" /></button>
              <button className="page-button active">1</button>
              <button className="page-button">2</button>
              <button className="page-button">3</button>
              <button className="page-button" aria-label="다음 페이지"><i className="ri-arrow-right-s-line" /></button>
            </div>
          </div>
        </article>
      </section>
    </AdminShell>
  );
}

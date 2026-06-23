import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 댓글·후기 통합 관리 페이지.
 * 일반 게시판 댓글 / 묻고답하기 답변 / 실전자료 후기를 한 화면에서 관리한다.
 * 운영자는 댓글 내용을 직접 "수정"하지 않는다 — 숨김·삭제·복구 중심으로 처리한다.
 * 데이터는 전부 더미(정적 상수)이며, 이후 단계에서 API(@ai-jakdang/api)와 연동한다.
 */

// 상단 핵심 지표 카드(더미). 운영자가 댓글·후기 영역에서 바로 봐야 하는 수치.
const STATS = [
  { label: "오늘 작성 댓글", value: "342", icon: "ri-chat-3-line", tone: "blue", dir: "up", delta: "9.2%", note: "전일 대비" },
  { label: "신고된 댓글", value: "8", icon: "ri-flag-2-line", tone: "orange", dir: "up", delta: "2건", note: "어제보다 증가" },
  { label: "숨김 처리", value: "23", icon: "ri-eye-off-line", tone: "purple", dir: "down", delta: "4건", note: "최근 7일" },
  { label: "후기 평균 평점", value: "4.6", icon: "ri-star-line", tone: "green", dir: "up", delta: "0.2점", note: "지난달 대비" },
] as const;

/**
 * 댓글·후기 목록(더미).
 * - kind: 댓글 유형 라벨(배지). type: 필터 키(일반댓글/답변/후기).
 * - status: 공개/숨김/삭제 상태(배지). statusKey: 필터 키.
 * - reports: 신고 누적 수. rating: 후기일 때 별점(1~5), 그 외 0.
 * - target: 댓글이 달린 관련 게시글 제목. board: 관련 게시판.
 */
const COMMENTS = [
  {
    excerpt: "이 방식으로 PHP 레거시도 충분히 분석됩니다. Claude Code 컨텍스트 설정만 잘 잡으면 됩니다.",
    type: "general", kind: ["badge-blue", "일반댓글"],
    author: ["김", "김개발"],
    date: "2026.06.18",
    target: "Claude Code로 기존 PHP 프로젝트 분석하는 방법",
    board: "바이브 코딩",
    reports: 0,
    status: ["badge-green", "공개"], statusKey: "public",
    rating: 0,
  },
  {
    excerpt: "n8n의 IMAP 트리거를 쓰면 됩니다. 분류 규칙은 Switch 노드에서 키워드 매칭으로 처리하세요.",
    type: "answer", kind: ["badge-purple", "답변"],
    author: ["박", "박자동"],
    date: "2026.06.18",
    target: "n8n으로 Gmail 문의 자동 분류가 가능한가요?",
    board: "AI 자동화",
    reports: 0,
    status: ["badge-cyan", "채택됨"], statusKey: "public",
    rating: 0,
  },
  {
    excerpt: "윈도우 환경에서 경로 구분자 때문에 막혔는데, 이 스킬 그대로 적용하니 바로 동작했습니다. 강추합니다.",
    type: "review", kind: ["badge-orange", "후기"],
    author: ["한", "한사용"],
    date: "2026.06.17",
    target: "PHP Legacy Code Review Skill",
    board: "실전자료",
    reports: 0,
    status: ["badge-green", "공개"], statusKey: "public",
    rating: 5,
  },
  {
    excerpt: "광고성 외부 링크가 포함되어 있어 신고합니다. 본문과 무관한 홍보 글입니다.",
    type: "general", kind: ["badge-blue", "일반댓글"],
    author: ["익", "익명123"],
    date: "2026.06.17",
    target: "AI 자동화 외주 견적을 잡을 때 꼭 확인할 것",
    board: "AI 수익화",
    reports: 4,
    status: ["badge-red", "숨김"], statusKey: "hidden",
    rating: 0,
  },
  {
    excerpt: "자료는 좋은데 설명이 너무 짧아서 초보자는 따라하기 어려울 것 같습니다.",
    type: "review", kind: ["badge-orange", "후기"],
    author: ["정", "정뉴비"],
    date: "2026.06.16",
    target: "Gmail 자동 분류 n8n 워크플로우 템플릿",
    board: "실전자료",
    reports: 1,
    status: ["badge-green", "공개"], statusKey: "public",
    rating: 3,
  },
  {
    excerpt: "비방·욕설이 포함되어 운영자가 삭제 처리한 댓글입니다.",
    type: "general", kind: ["badge-blue", "일반댓글"],
    author: ["탈", "탈퇴회원"],
    date: "2026.06.15",
    target: "AI 수익화 첫 달 정산 후기 공유합니다",
    board: "AI 수익화",
    reports: 7,
    status: ["badge-gray", "삭제됨"], statusKey: "deleted",
    rating: 0,
  },
  {
    excerpt: "이 부분은 Claude 4.5 기준으로 동작이 달라졌습니다. 최신 버전에서는 system prompt 위치를 확인하세요.",
    type: "answer", kind: ["badge-purple", "답변"],
    author: ["이", "이코딩"],
    date: "2026.06.15",
    target: "Claude API 토큰이 갑자기 두 배로 나오는 이유?",
    board: "묻고답하기",
    reports: 0,
    status: ["badge-green", "공개"], statusKey: "public",
    rating: 0,
  },
  {
    excerpt: "후기 작성 이벤트 보고 남깁니다. 실무에 바로 쓸 수 있어서 만족도가 높습니다.",
    type: "review", kind: ["badge-orange", "후기"],
    author: ["서", "서대표"],
    date: "2026.06.14",
    target: "외주 견적 산정 자동화 시트",
    board: "실전자료",
    reports: 0,
    status: ["badge-green", "공개"], statusKey: "public",
    rating: 4,
  },
] as const;

// 별점(1~5)을 채워진/빈 별 아이콘 5개로 렌더. rating 0(후기 아님)이면 대시(–) 표기.
// 채워진 별은 경고(주황) 토큰 색을 쓰고, 빈 별은 옅은 회색 토큰을 쓴다(색 하드코딩 대신 var 토큰 사용).
function Stars({ rating }: { rating: number }) {
  if (!rating) return <span className="content-meta">–</span>;
  return (
    <span aria-label={`5점 만점에 ${rating}점`} style={{ display: "inline-flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          className={n <= rating ? "ri-star-fill" : "ri-star-line"}
          style={{ color: n <= rating ? "var(--warning)" : "var(--gray-300)" }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default function AdminCommentsPage() {
  return (
    <AdminShell breadcrumb={["관리자", "댓글·후기 관리"]} activeKey="comments">
      <div className="page-header">
        <div>
          <h1 className="page-title">댓글·후기 관리</h1>
          <p className="page-description">일반 댓글 · 묻고답하기 답변 · 실전자료 후기를 한 곳에서 관리합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            CSV 다운로드
          </button>
          <button className="btn btn-primary" type="button">
            <i className="ri-flag-2-line" />
            신고 대기열 보기
          </button>
        </div>
      </div>

      <section className="grid stats-grid" aria-label="댓글·후기 핵심 통계">
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
            <h2 className="section-title">댓글·후기 목록</h2>
            <p className="section-description">유형 탭과 필터로 좁힌 뒤, 행 메뉴에서 숨김·삭제·복구를 처리합니다.</p>
          </div>
        </div>

        <article className="card">
          {/* 댓글 유형 탭: 전체 / 일반댓글 / 답변 / 후기 */}
          <div className="line-tabs" role="tablist" aria-label="댓글 유형">
            <button className="line-tab active" data-tab="all">전체</button>
            <button className="line-tab" data-tab="general">일반댓글</button>
            <button className="line-tab" data-tab="answer">답변</button>
            <button className="line-tab" data-tab="review">후기</button>
          </div>

          {/* 추가 필터: 내용/작성자 검색, 상태, 관련 게시판, 신고 여부, 작성일 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input className="control" type="search" placeholder="댓글 내용 또는 작성자 검색" aria-label="댓글 검색" />
              </div>
              <div className="custom-select" data-select="status">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>상태: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">상태: 전체<i className="ri-check-line" /></button>
                  <button className="select-option" data-value="public">공개</button>
                  <button className="select-option" data-value="hidden">숨김</button>
                  <button className="select-option" data-value="deleted">삭제됨</button>
                </div>
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
                  <button className="select-option" data-value="qna">묻고답하기</button>
                  <button className="select-option" data-value="resource">실전자료</button>
                </div>
              </div>
              <div className="custom-select" data-select="report">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>신고: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">신고: 전체<i className="ri-check-line" /></button>
                  <button className="select-option" data-value="reported">신고 있음</button>
                  <button className="select-option" data-value="clean">신고 없음</button>
                </div>
              </div>
              <div className="input-icon">
                <i className="ri-calendar-line" />
                <input className="control" type="text" defaultValue="2026.06.01 - 2026.06.18" aria-label="작성일 기간" />
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
              <span className="filter-chip">신고 있음<button aria-label="필터 제거"><i className="ri-close-line" /></button></span>
              <span className="filter-chip">최근 18일<button aria-label="필터 제거"><i className="ri-close-line" /></button></span>
            </div>
          </div>

          {/* 일괄 처리 툴바: 운영자는 수정하지 않으므로 숨김/삭제 중심 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 {COMMENTS.length}개의 댓글·후기</span>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>숨김 처리</button>
              <button className="btn btn-danger btn-sm" data-admin-requires-selection disabled>삭제</button>
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
                  <th>댓글 내용</th>
                  <th>유형</th>
                  <th>작성자</th>
                  <th>관련 게시글</th>
                  <th>신고</th>
                  <th>상태</th>
                  <th>작성일</th>
                  <th style={{ width: "60px" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {COMMENTS.map((c, idx) => (
                  <tr key={c.excerpt} data-type={c.type} data-status={c.statusKey}>
                    <td>
                      <input className="check row-check" type="checkbox" aria-label="행 선택" />
                    </td>
                    <td>
                      {/* 요구 3: 댓글 내용 클릭 시 모달이 아니라 상세 페이지로 이동 */}
                      <Link className="content-title" href={`/comments/${idx + 1}`}>{c.excerpt}</Link>
                      {/* 후기 행은 별점을 함께 노출 */}
                      {c.type === "review" ? (
                        <div className="content-meta">
                          <Stars rating={c.rating} />
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge ${c.kind[0]}`}>{c.kind[1]}</span>
                    </td>
                    <td>
                      <div className="author">
                        <span className="author-avatar">{c.author[0]}</span>
                        <span>{c.author[1]}</span>
                      </div>
                    </td>
                    <td>
                      <div className="content-title">{c.target}</div>
                      <div className="content-meta">{c.board}</div>
                    </td>
                    <td className="num">
                      {c.reports > 0 ? (
                        <span className="badge badge-red">{c.reports}</span>
                      ) : (
                        <span className="content-meta">0</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${c.status[0]}`}>{c.status[1]}</span>
                    </td>
                    <td className="num">{c.date}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button row-action-button" aria-label="행 메뉴">
                          <i className="ri-more-2-fill" />
                        </button>
                        {/* 행 액션: 요구 3에 따라 원문/신고 내역 보기는 상세 페이지 링크로 이동. 수정 액션은 의도적으로 제외 */}
                        <div className="action-menu">
                          <Link href={`/comments/${idx + 1}`}>
                            <i className="ri-file-text-line" />원문 보기
                          </Link>
                          <button type="button">
                            <i className="ri-external-link-line" />관련 게시글로 이동
                          </button>
                          <Link href={`/comments/${idx + 1}`}>
                            <i className="ri-flag-2-line" />신고 내역 보기
                          </Link>
                          <button type="button">
                            <i className="ri-eye-off-line" />댓글 숨김
                          </button>
                          <button type="button">
                            <i className="ri-arrow-go-back-line" />댓글 복구
                          </button>
                          <button className="danger" type="button">
                            <i className="ri-delete-bin-line" />댓글 삭제
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
            <div className="page-info">1–{COMMENTS.length} / 총 412개</div>
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

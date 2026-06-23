import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 게시글 관리 페이지.
 * @ai-jakdang/admin-design-system 의 마크업/토큰으로 구성한다(관리자 전용).
 * 모든 데이터는 더미(정적 상수)이며, 이후 단계에서 API(@ai-jakdang/api) 와 연동한다.
 * 인터랙션(커스텀 셀렉트/행 액션 메뉴/전체선택/일괄버튼)은 AdminShell 의 AdminInteractions 가 전역 연결한다.
 */

// 게시판 목록(더미). value = 필터 식별자, label = 화면 표기.
// AI작당의 실제 게시판 구성(바이브코딩/자동화/외주/수익화/창작/AI제품)을 반영한다.
const BOARDS = [
  { value: "all", label: "게시판: 전체" },
  { value: "vibe-guide", label: "바이브코딩 가이드" },
  { value: "vibe-tip", label: "바이브코딩 팁" },
  { value: "auto-guide", label: "자동화 가이드" },
  { value: "auto-case", label: "자동화 사례" },
  { value: "auto-tip", label: "자동화 팁" },
  { value: "outsource-tip", label: "외주·판매 팁" },
  { value: "money-case", label: "수익화 사례" },
  { value: "ai-art", label: "AI 창작마당" },
  { value: "ai-product", label: "내가 만든 AI 제품" },
] as const;

// 상태 필터(더미). public=공개, hidden=숨김, deleted=삭제, reported=신고있음.
const STATUSES = [
  { value: "all", label: "상태: 전체" },
  { value: "public", label: "공개" },
  { value: "hidden", label: "숨김" },
  { value: "deleted", label: "삭제" },
  { value: "reported", label: "신고 있음" },
] as const;

// 속성 필터(더미). 공지/추천/메인노출 등 게시글 부가 속성으로 거르는 셀렉트.
const FLAGS = [
  { value: "all", label: "속성: 전체" },
  { value: "notice", label: "공지글만" },
  { value: "pinned", label: "상단고정만" },
  { value: "featured", label: "추천글만" },
  { value: "main", label: "메인노출만" },
] as const;

/**
 * 게시글 테이블 행(더미).
 * id=게시글 식별자(상세 링크용), slug=게시판 URL 식별 영문 키(/posts/{slug}/{id} 링크용),
 * board=게시판 라벨, badge=게시판 색상 배지, status=[배지클래스, 상태표기],
 * views=조회수, comments=댓글수, likes=좋아요수, reports=신고수(0이면 정상),
 * flags=부가 속성(공지/고정/추천/메인노출) 아이콘 표기 여부.
 */
const POSTS = [
  {
    id: 101,
    slug: "vibe-guide",
    title: "Claude Code로 기존 PHP 프로젝트 한 번에 분석시키는 프롬프트",
    board: "바이브코딩 가이드",
    badge: "badge-blue",
    author: ["김", "김개발"],
    date: "2026.06.18",
    views: "3,284",
    comments: "42",
    likes: "187",
    reports: 0,
    status: ["badge-green", "공개"],
    flags: { notice: true, pinned: true, featured: true, main: true },
  },
  {
    id: 102,
    slug: "auto-case",
    title: "n8n + Gmail로 문의 메일 자동 분류·라벨링 워크플로우 공유",
    board: "자동화 사례",
    badge: "badge-purple",
    author: ["박", "박자동"],
    date: "2026.06.18",
    views: "2,142",
    comments: "31",
    likes: "204",
    reports: 0,
    status: ["badge-green", "공개"],
    flags: { notice: false, pinned: true, featured: true, main: false },
  },
  {
    id: 103,
    slug: "outsource-tip",
    title: "AI 자동화 외주 견적, 이 5가지 빼먹으면 무조건 적자 납니다",
    board: "외주·판매 팁",
    badge: "badge-cyan",
    author: ["최", "최대표"],
    date: "2026.06.17",
    views: "5,961",
    comments: "88",
    likes: "412",
    reports: 4,
    status: ["badge-red", "신고 있음"],
    flags: { notice: false, pinned: false, featured: true, main: false },
  },
  {
    id: 104,
    slug: "money-case",
    title: "GPT 래퍼 SaaS 첫 달 매출 320만원 찍은 과정 전부 공개",
    board: "수익화 사례",
    badge: "badge-orange",
    author: ["이", "이수익"],
    date: "2026.06.17",
    views: "8,470",
    comments: "126",
    likes: "693",
    reports: 0,
    status: ["badge-green", "공개"],
    flags: { notice: false, pinned: false, featured: true, main: true },
  },
  {
    id: 105,
    slug: "ai-art",
    title: "Midjourney + Runway로 만든 30초 광고 영상 (제작 과정 첨부)",
    board: "AI 창작마당",
    badge: "badge-purple",
    author: ["한", "한창작"],
    date: "2026.06.16",
    views: "1,938",
    comments: "27",
    likes: "152",
    reports: 0,
    status: ["badge-green", "공개"],
    flags: { notice: false, pinned: false, featured: false, main: false },
  },
  {
    id: 106,
    slug: "ai-product",
    title: "제가 만든 회의록 자동 요약 AI 제품 베타 테스터 모집합니다",
    board: "내가 만든 AI 제품",
    badge: "badge-blue",
    author: ["정", "정메이커"],
    date: "2026.06.16",
    views: "1,204",
    comments: "19",
    likes: "98",
    reports: 1,
    status: ["badge-gray", "숨김"],
    flags: { notice: false, pinned: false, featured: false, main: false },
  },
  {
    id: 107,
    slug: "vibe-tip",
    title: "[공지] 게시판 운영 정책 및 광고성 글 제재 기준 안내",
    board: "바이브코딩 팁",
    badge: "badge-blue",
    author: ["관", "운영자"],
    date: "2026.06.15",
    views: "6,720",
    comments: "13",
    likes: "240",
    reports: 0,
    status: ["badge-green", "공개"],
    flags: { notice: true, pinned: true, featured: false, main: false },
  },
  {
    id: 108,
    slug: "auto-tip",
    title: "도배성 외부 링크 홍보글 (운영자 삭제 처리됨)",
    board: "자동화 팁",
    badge: "badge-cyan",
    author: ["스", "스팸계정"],
    date: "2026.06.14",
    views: "312",
    comments: "0",
    likes: "1",
    reports: 9,
    status: ["badge-gray", "삭제"],
    flags: { notice: false, pinned: false, featured: false, main: false },
  },
] as const;

export default function AdminPostsPage() {
  return (
    <AdminShell breadcrumb={["관리자", "게시글 관리"]} activeKey="posts">
      <div className="page-header">
        <div>
          <h1 className="page-title">게시글 관리</h1>
          <p className="page-description">전체 게시판의 게시글을 검색·필터하고 공지·추천·노출·삭제를 관리합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            CSV 내보내기
          </button>
          <Link className="btn btn-primary" href="/posts/vibe-guide/new">
            <i className="ri-add-line" />
            새 게시글
          </Link>
        </div>
      </div>

      <section className="section" aria-label="게시글 목록">
        <article className="card">
          {/* 필터 패널: 검색 + 게시판/상태/속성 셀렉트 + 작성자 검색 + 작성일 기간 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input className="control" type="search" placeholder="제목·본문 검색" aria-label="게시글 검색" />
              </div>

              {/* 게시판별 필터 */}
              <div className="custom-select" data-select="board">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>게시판: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {BOARDS.map((b) => (
                    <button
                      key={b.value}
                      className={`select-option${b.value === "all" ? " selected" : ""}`}
                      data-value={b.value}
                    >
                      {b.label}
                      {b.value === "all" ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              {/* 상태 필터(공개/숨김/삭제/신고있음) */}
              <div className="custom-select" data-select="status">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>상태: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      className={`select-option${s.value === "all" ? " selected" : ""}`}
                      data-value={s.value}
                    >
                      {s.label}
                      {s.value === "all" ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              {/* 공지/추천/메인노출 속성 필터 */}
              <div className="custom-select" data-select="flag">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>속성: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {FLAGS.map((f) => (
                    <button
                      key={f.value}
                      className={`select-option${f.value === "all" ? " selected" : ""}`}
                      data-value={f.value}
                    >
                      {f.label}
                      {f.value === "all" ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="filter-row">
              {/* 작성자 검색 */}
              <div className="input-icon">
                <i className="ri-user-3-line" />
                <input className="control" type="search" placeholder="작성자(닉네임·아이디) 검색" aria-label="작성자 검색" />
              </div>

              {/* 작성일 기간 */}
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

            {/* 현재 적용 중인 필터 칩(더미) */}
            <div className="active-filters">
              <span className="filter-chip">
                공개 게시글
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

          {/* 툴바: 선택 정보 + 일괄 처리 버튼(선택 시 활성) */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 128개의 게시글</span>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>
                <i className="ri-eye-off-line" />
                숨김 처리
              </button>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>
                <i className="ri-star-line" />
                추천 지정
              </button>
              <button className="btn btn-danger btn-sm" data-admin-requires-selection disabled>
                <i className="ri-delete-bin-line" />
                일괄 삭제
              </button>
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
                  <th style={{ width: 44 }}>
                    <input className="check" data-admin-select-all type="checkbox" aria-label="전체 선택" />
                  </th>
                  <th>제목</th>
                  <th>게시판</th>
                  <th>작성자</th>
                  <th>작성일</th>
                  <th>조회</th>
                  <th>댓글</th>
                  <th>좋아요</th>
                  <th>신고</th>
                  <th>상태</th>
                  <th style={{ width: 60 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {POSTS.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input className="check row-check" type="checkbox" aria-label="행 선택" />
                    </td>
                    <td>
                      <div className="content-title">
                        {/* 공지/상단고정/추천/메인노출은 제목 옆 아이콘 배지로 표현 */}
                        {p.flags.notice ? (
                          <span className="badge badge-red" title="공지글">공지</span>
                        ) : null}
                        {p.flags.pinned ? (
                          <i className="ri-pushpin-2-fill" title="상단 고정" style={{ color: "var(--primary-600)" }} />
                        ) : null}
                        {p.flags.featured ? (
                          <i className="ri-star-fill" title="추천글" style={{ color: "var(--warning)" }} />
                        ) : null}
                        {p.flags.main ? (
                          <i className="ri-home-4-fill" title="메인 노출" style={{ color: "var(--brand-accent)" }} />
                        ) : null}
                        {/* 제목 클릭 시 해당 게시판 기준 상세 페이지로 이동(모달 아님) */}
                        <Link
                          href={`/posts/${p.slug}/${p.id}`}
                          style={{ marginLeft: p.flags.notice || p.flags.pinned || p.flags.featured || p.flags.main ? 6 : 0 }}
                        >
                          {p.title}
                        </Link>
                      </div>
                      <div className="content-meta">{p.board}</div>
                    </td>
                    <td>
                      <span className={`badge ${p.badge}`}>{p.board}</span>
                    </td>
                    <td>
                      <div className="author">
                        <span className="author-avatar">{p.author[0]}</span>
                        <span>{p.author[1]}</span>
                      </div>
                    </td>
                    <td className="num">{p.date}</td>
                    <td className="num">{p.views}</td>
                    <td className="num">{p.comments}</td>
                    <td className="num">{p.likes}</td>
                    <td className="num">
                      {p.reports > 0 ? (
                        <span className="badge badge-red">{p.reports}</span>
                      ) : (
                        <span style={{ color: "var(--gray-400)" }}>0</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${p.status[0]}`}>{p.status[1]}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button row-action-button" aria-label="행 메뉴">
                          <i className="ri-more-2-fill" />
                        </button>
                        <div className="action-menu">
                          {/* "보기"는 게시판 기준 상세 페이지로 이동하는 링크(요구 3·4) */}
                          <Link className="view-detail" href={`/posts/${p.slug}/${p.id}`}>
                            <i className="ri-eye-line" />
                            보기
                          </Link>
                          <Link href={`/posts/${p.slug}/${p.id}/edit`}>
                            <i className="ri-edit-line" />
                            수정
                          </Link>
                          <button>
                            <i className="ri-megaphone-line" />
                            {p.flags.notice ? "공지 해제" : "공지 설정"}
                          </button>
                          <button>
                            <i className="ri-pushpin-2-line" />
                            {p.flags.pinned ? "상단고정 해제" : "상단고정 설정"}
                          </button>
                          <button>
                            <i className="ri-star-line" />
                            {p.flags.featured ? "추천 해제" : "추천 지정"}
                          </button>
                          <button>
                            <i className="ri-home-4-line" />
                            {p.flags.main ? "메인노출 해제" : "메인노출 설정"}
                          </button>
                          <button>
                            <i className="ri-eye-off-line" />
                            숨김
                          </button>
                          {p.status[1] === "삭제" ? (
                            <button>
                              <i className="ri-arrow-go-back-line" />
                              복구
                            </button>
                          ) : (
                            <button className="danger">
                              <i className="ri-delete-bin-line" />
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div className="page-info">1–8 / 총 128개</div>
            <div className="page-buttons">
              <button className="page-button" aria-label="이전 페이지">
                <i className="ri-arrow-left-s-line" />
              </button>
              <button className="page-button active">1</button>
              <button className="page-button">2</button>
              <button className="page-button">3</button>
              <button className="page-button">4</button>
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

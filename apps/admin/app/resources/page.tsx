import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 실전자료 관리 페이지.
 * @ai-jakdang/admin-design-system 의 마크업/토큰만 사용한다(관리자 전용).
 * 실전자료 = AI작당에서 회원이 올리는 Claude Code Skill / n8n 워크플로우 / 프롬프트팩 등
 * "바로 갖다 쓰는" 다운로드형 자료. 수치는 전부 더미이며 이후 단계에서 API 와 연동한다.
 *
 * 의도적 제외(운영 책임 회피): 검수됨/공식자료/운영자인증/안전성보증/자동보안검사 같은
 * "보증성" 기능은 넣지 않는다. 관리자는 신고·숨김·삭제 같은 사후 조치만 한다.
 */

// 필터: 자료유형 옵션. value 는 행의 data-type 과 매칭하는 식별자.
const TYPE_OPTIONS = [
  { value: "all", label: "자료유형: 전체" },
  { value: "skill", label: "Claude Code Skill" }, // Claude Code 용 스킬 패키지
  { value: "workflow", label: "n8n 워크플로우" }, // n8n 자동화 워크플로우 JSON
  { value: "promptpack", label: "프롬프트팩" }, // 프롬프트 묶음 자료
  { value: "template", label: "코드 템플릿" }, // 보일러플레이트/스타터 코드
  { value: "dataset", label: "데이터셋" }, // 학습/예제용 데이터 모음
] as const;

// 필터: 지원환경 옵션(자료가 동작하는 실행 환경).
const ENV_OPTIONS = [
  { value: "all", label: "지원환경: 전체" },
  { value: "claude-code", label: "Claude Code" },
  { value: "n8n", label: "n8n" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "cursor", label: "Cursor" },
  { value: "cross", label: "환경 무관" }, // 특정 툴에 종속되지 않음
] as const;

// 필터: 난이도 옵션(자료를 활용하는 데 필요한 숙련도).
const LEVEL_OPTIONS = [
  { value: "all", label: "난이도: 전체" },
  { value: "beginner", label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" },
] as const;

// 필터: 상태 옵션(공개/숨김/삭제).
const STATUS_OPTIONS = [
  { value: "all", label: "상태: 전체" },
  { value: "public", label: "공개" },
  { value: "hidden", label: "숨김" },
  { value: "deleted", label: "삭제됨" },
] as const;

// 필터: 신고 여부 옵션.
const REPORT_OPTIONS = [
  { value: "all", label: "신고: 전체" },
  { value: "reported", label: "신고 있음" },
  { value: "clean", label: "신고 없음" },
] as const;

// 상단 요약 지표 카드(더미). 실전자료 운영 현황 한눈에 보기.
const STATS = [
  { label: "전체 자료", value: "342", icon: "ri-folder-download-line", tone: "blue", dir: "up", delta: "7건", note: "오늘 신규 등록" },
  { label: "이번 달 다운로드", value: "18,420", icon: "ri-download-2-line", tone: "purple", dir: "up", delta: "9.3%", note: "전월 대비" },
  { label: "평균 평점", value: "4.6", icon: "ri-star-line", tone: "green", dir: "up", delta: "0.1", note: "전월 대비" },
  { label: "신고된 자료", value: "5", icon: "ri-flag-line", tone: "orange", dir: "down", delta: "2건", note: "확인 필요" },
] as const;

/**
 * 실전자료 테이블 한 행(더미).
 * 컬럼 = 자료명 / 자료유형 / 지원환경 / 작성자 / 등록일 / 업데이트일 /
 *        다운로드 수 / 평점 / 후기 수 / 신고 수 / 상태 / 대표 첨부파일.
 * dataType·dataEnv·dataStatus·dataReport 는 필터 매칭용 키(행에 data-* 로 부착).
 */
const RESOURCES = [
  {
    title: "PHP Legacy Code Review Skill",
    desc: "레거시 PHP를 Claude Code로 점진 분석하는 스킬",
    typeBadge: ["badge-blue", "Claude Code Skill"],
    dataType: "skill",
    env: "Claude Code",
    dataEnv: "claude-code",
    level: ["badge-gray", "중급"],
    author: ["이", "이코딩"],
    createdAt: "2026.06.16",
    updatedAt: "2026.06.17",
    downloads: "1,204",
    rating: "4.8",
    reviews: "37",
    reports: "0",
    status: ["badge-green", "공개"],
    dataStatus: "public",
    dataReport: "clean",
    file: ["ri-folder-zip-line", "php-review-skill.zip"], // 대표 첨부파일(아이콘 + 파일명)
  },
  {
    title: "Gmail 문의 자동 분류 n8n 워크플로우",
    desc: "수신 메일을 라벨·우선순위별로 자동 분류",
    typeBadge: ["badge-purple", "n8n 워크플로우"],
    dataType: "workflow",
    env: "n8n",
    dataEnv: "n8n",
    level: ["badge-gray", "입문"],
    author: ["박", "박자동"],
    createdAt: "2026.06.14",
    updatedAt: "2026.06.15",
    downloads: "2,860",
    rating: "4.7",
    reviews: "54",
    reports: "0",
    status: ["badge-green", "공개"],
    dataStatus: "public",
    dataReport: "clean",
    file: ["ri-file-code-line", "gmail-classifier.json"],
  },
  {
    title: "외주 견적 작성 프롬프트팩 (40종)",
    desc: "AI 자동화 외주 상담·견적·계약 단계별 프롬프트",
    typeBadge: ["badge-cyan", "프롬프트팩"],
    dataType: "promptpack",
    env: "ChatGPT",
    dataEnv: "chatgpt",
    level: ["badge-gray", "입문"],
    author: ["최", "최대표"],
    createdAt: "2026.06.12",
    updatedAt: "2026.06.13",
    downloads: "3,512",
    rating: "4.9",
    reviews: "88",
    reports: "1",
    status: ["badge-green", "공개"],
    dataStatus: "public",
    dataReport: "reported",
    file: ["ri-file-text-line", "outsourcing-prompts.pdf"],
  },
  {
    title: "Next.js + Supabase SaaS 스타터 템플릿",
    desc: "인증·결제·대시보드가 포함된 보일러플레이트",
    typeBadge: ["badge-orange", "코드 템플릿"],
    dataType: "template",
    env: "Cursor",
    dataEnv: "cursor",
    level: ["badge-gray", "고급"],
    author: ["정", "정풀스택"],
    createdAt: "2026.06.10",
    updatedAt: "2026.06.16",
    downloads: "1,733",
    rating: "4.5",
    reviews: "29",
    reports: "0",
    status: ["badge-green", "공개"],
    dataStatus: "public",
    dataReport: "clean",
    file: ["ri-folder-zip-line", "saas-starter.zip"],
  },
  {
    title: "유튜브 쇼츠 대량 생성 자동화 워크플로우",
    desc: "신고 누적 — 저작권 소지 음원 포함 가능성",
    typeBadge: ["badge-purple", "n8n 워크플로우"],
    dataType: "workflow",
    env: "n8n",
    dataEnv: "n8n",
    level: ["badge-gray", "고급"],
    author: ["강", "강자동화"],
    createdAt: "2026.06.08",
    updatedAt: "2026.06.09",
    downloads: "942",
    rating: "3.9",
    reviews: "21",
    reports: "4",
    status: ["badge-orange", "숨김"],
    dataStatus: "hidden",
    dataReport: "reported",
    file: ["ri-file-code-line", "shorts-factory.json"],
  },
  {
    title: "Cursor 룰셋: 한국어 커밋 컨벤션",
    desc: "팀용 .cursorrules 와 커밋 메시지 가이드",
    typeBadge: ["badge-blue", "Claude Code Skill"],
    dataType: "skill",
    env: "환경 무관",
    dataEnv: "cross",
    level: ["badge-gray", "입문"],
    author: ["한", "한사용"],
    createdAt: "2026.06.05",
    updatedAt: "2026.06.05",
    downloads: "611",
    rating: "4.3",
    reviews: "12",
    reports: "0",
    status: ["badge-green", "공개"],
    dataStatus: "public",
    dataReport: "clean",
    file: ["ri-file-list-3-line", "cursor-rules.md"],
  },
  {
    title: "프롬프트 인젝션 테스트 데이터셋",
    desc: "작성자 요청으로 삭제 처리됨",
    typeBadge: ["badge-gray", "데이터셋"],
    dataType: "dataset",
    env: "환경 무관",
    dataEnv: "cross",
    level: ["badge-gray", "고급"],
    author: ["윤", "윤리서치"],
    createdAt: "2026.06.02",
    updatedAt: "2026.06.04",
    downloads: "488",
    rating: "4.1",
    reviews: "9",
    reports: "0",
    status: ["badge-red", "삭제됨"],
    dataStatus: "deleted",
    dataReport: "clean",
    file: ["ri-file-excel-2-line", "injection-samples.csv"],
  },
] as const;

// 첨부파일/후기/신고내역 더미는 자료 상세 페이지(app/resources/[id]/page.tsx)로 이전됨.

export default function AdminResourcesPage() {
  return (
    <AdminShell breadcrumb={["관리자", "실전자료 관리"]} activeKey="resources">
      <div className="page-header">
        <div>
          <h1 className="page-title">실전자료 관리</h1>
          <p className="page-description">회원이 올린 Claude Code Skill·n8n 워크플로우·프롬프트팩 등 다운로드형 자료를 점검합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            CSV 다운로드
          </button>
          <Link className="btn btn-primary" href="/resources/new">
            <i className="ri-add-line" />
            자료 등록
          </Link>
        </div>
      </div>

      <section className="grid stats-grid" aria-label="실전자료 요약 지표">
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
            <h2 className="section-title">자료 목록</h2>
            <p className="section-description">유형·지원환경·난이도·상태·신고 여부로 좁혀 점검하세요.</p>
          </div>
        </div>

        <article className="card">
          {/* 필터 패널: 검색 + 자료유형/지원환경/난이도/상태/신고 셀렉트 + 작성자·기간·정렬 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input className="control" type="search" placeholder="자료명 또는 작성자 검색" aria-label="자료 검색" />
              </div>

              <div className="custom-select" data-select="resourceType">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{TYPE_OPTIONS[0].label}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {TYPE_OPTIONS.map((o, i) => (
                    <button key={o.value} className={`select-option${i === 0 ? " selected" : ""}`} data-value={o.value}>
                      {o.label}
                      {i === 0 ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-select" data-select="resourceEnv">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{ENV_OPTIONS[0].label}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {ENV_OPTIONS.map((o, i) => (
                    <button key={o.value} className={`select-option${i === 0 ? " selected" : ""}`} data-value={o.value}>
                      {o.label}
                      {i === 0 ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-select" data-select="resourceLevel">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{LEVEL_OPTIONS[0].label}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {LEVEL_OPTIONS.map((o, i) => (
                    <button key={o.value} className={`select-option${i === 0 ? " selected" : ""}`} data-value={o.value}>
                      {o.label}
                      {i === 0 ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-select" data-select="resourceStatus">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{STATUS_OPTIONS[0].label}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {STATUS_OPTIONS.map((o, i) => (
                    <button key={o.value} className={`select-option${i === 0 ? " selected" : ""}`} data-value={o.value}>
                      {o.label}
                      {i === 0 ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-select" data-select="resourceReport">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>{REPORT_OPTIONS[0].label}</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  {REPORT_OPTIONS.map((o, i) => (
                    <button key={o.value} className={`select-option${i === 0 ? " selected" : ""}`} data-value={o.value}>
                      {o.label}
                      {i === 0 ? <i className="ri-check-line" /> : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 두 번째 줄: 작성자 / 등록일 기간 / 정렬(다운로드 수·평점) */}
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-user-line" />
                <input className="control" type="text" placeholder="작성자" aria-label="작성자 필터" />
              </div>
              <div className="input-icon">
                <i className="ri-calendar-line" />
                <input className="control" type="text" defaultValue="2026.06.01 - 2026.06.17" aria-label="등록일 기간" />
              </div>

              <div className="custom-select" data-select="resourceSort">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>정렬: 다운로드 많은순</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="downloads">
                    다운로드 많은순
                    <i className="ri-check-line" />
                  </button>
                  <button className="select-option" data-value="rating">평점 높은순</button>
                  <button className="select-option" data-value="reports">신고 많은순</button>
                  <button className="select-option" data-value="recent">최신 등록순</button>
                </div>
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

            {/* 현재 적용된 필터 칩(더미 표시) */}
            <div className="active-filters">
              <span className="filter-chip">
                공개 자료
                <button aria-label="필터 제거"><i className="ri-close-line" /></button>
              </span>
              <span className="filter-chip">
                최근 30일
                <button aria-label="필터 제거"><i className="ri-close-line" /></button>
              </span>
            </div>
          </div>

          {/* 툴바: 선택 정보 + 일괄 숨김/삭제, 우측 CSV/등록 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 7개의 자료</span>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>
                <i className="ri-eye-off-line" />
                숨김 처리
              </button>
              <button className="btn btn-danger btn-sm" data-admin-requires-selection disabled>
                <i className="ri-delete-bin-line" />
                삭제
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
                  <th style={{ width: "44px" }}>
                    <input className="check" data-admin-select-all type="checkbox" aria-label="전체 선택" />
                  </th>
                  <th>자료명</th>
                  <th>자료유형</th>
                  <th>지원환경</th>
                  <th>작성자</th>
                  <th>등록일</th>
                  <th>업데이트일</th>
                  <th>다운로드</th>
                  <th>평점</th>
                  <th>후기</th>
                  <th>신고</th>
                  <th>상태</th>
                  <th>대표 첨부파일</th>
                  <th style={{ width: "60px" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map((r, idx) => (
                  <tr
                    key={r.title}
                    data-type={r.dataType}
                    data-env={r.dataEnv}
                    data-status={r.dataStatus}
                    data-report={r.dataReport}
                  >
                    <td>
                      <input className="check row-check" type="checkbox" aria-label={`${r.title} 선택`} />
                    </td>
                    <td>
                      {/* 요구 3: 자료명 클릭 시 드로어가 아니라 상세 페이지로 이동 */}
                      <Link className="content-title" href={`/resources/${idx + 1}`}>{r.title}</Link>
                      <div className="content-meta">{r.desc}</div>
                    </td>
                    <td>
                      <span className={`badge ${r.typeBadge[0]}`}>{r.typeBadge[1]}</span>
                    </td>
                    <td>{r.env}</td>
                    <td>
                      <div className="author">
                        <span className="author-avatar">{r.author[0]}</span>
                        <span>{r.author[1]}</span>
                      </div>
                    </td>
                    <td className="num">{r.createdAt}</td>
                    <td className="num">{r.updatedAt}</td>
                    <td className="num">{r.downloads}</td>
                    <td className="num">
                      <i className="ri-star-fill" style={{ color: "var(--warning)" }} aria-hidden="true" /> {r.rating}
                    </td>
                    <td className="num">{r.reviews}</td>
                    <td className="num">
                      {Number(r.reports) > 0 ? (
                        <span className="badge badge-red">{r.reports}</span>
                      ) : (
                        <span style={{ color: "var(--gray-400)" }}>0</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${r.status[0]}`}>{r.status[1]}</span>
                    </td>
                    <td>
                      <span className="content-meta">
                        <i className={r.file[0]} aria-hidden="true" /> {r.file[1]}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button row-action-button" aria-label="행 메뉴">
                          <i className="ri-more-2-fill" />
                        </button>
                        {/* 행 액션 메뉴: 요구 3에 따라 상세 보기류는 상세 페이지 링크로 이동 */}
                        <div className="action-menu">
                          <Link href={`/resources/${idx + 1}`}>
                            <i className="ri-eye-line" />
                            자료 상세 보기
                          </Link>
                          {/* 행 액션 "수정" → edit 라우트 링크 */}
                          <Link href={`/resources/${idx + 1}/edit`}>
                            <i className="ri-edit-line" />
                            자료 수정
                          </Link>
                          <button type="button">
                            <i className="ri-eye-off-line" />
                            숨김
                          </button>
                          <button type="button">
                            <i className="ri-arrow-go-back-line" />
                            복구
                          </button>
                          <Link href={`/resources/${idx + 1}`}>
                            <i className="ri-attachment-2" />
                            첨부파일 확인
                          </Link>
                          <Link href={`/resources/${idx + 1}`}>
                            <i className="ri-chat-3-line" />
                            후기 댓글 관리
                          </Link>
                          <Link href={`/resources/${idx + 1}`}>
                            <i className="ri-flag-line" />
                            신고 내역 확인
                          </Link>
                          <button className="danger" type="button">
                            <i className="ri-delete-bin-line" />
                            삭제
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
            <div className="page-info">1–7 / 총 342개</div>
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

import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 포인트 관리 페이지.
 * @ai-jakdang/admin-design-system 의 마크업/토큰으로만 구성한다(관리자 전용).
 * 적립/차감 규칙, 회원별 포인트 내역, 수동 지급/차감을 한 화면에서 운영한다.
 * 모든 수치는 더미이며, 이후 단계에서 API(@ai-jakdang/api) 와 연동한다.
 *
 * AI작당 초기 운영 원칙: 포인트는 현금성 보상과 연결하지 않고
 * 활동 지표(등급/뱃지)로만 사용한다 → 화면 상단 alert.alert-info 로 명시.
 */

// 상단 핵심 지표 카드(더미). 포인트 운영 현황 요약.
const STATS = [
  { label: "누적 지급 포인트", value: "1,284,500", icon: "ri-coins-line", tone: "blue", dir: "up", delta: "8.2%", note: "지난주 대비" },
  { label: "이번 주 적립", value: "42,300", icon: "ri-add-circle-line", tone: "green", dir: "up", delta: "12.1%", note: "지난주 대비" },
  { label: "이번 주 차감", value: "3,150", icon: "ri-indeterminate-circle-line", tone: "orange", dir: "down", delta: "2.4%", note: "지난주 대비" },
  { label: "수동 처리 건수", value: "17", icon: "ri-hand-coin-line", tone: "purple", dir: "up", delta: "5건", note: "이번 주" },
] as const;

// 포인트 적립 규칙(더미). points: 지급 포인트, active: 활성 여부(스위치 기본 상태).
// icon: 규칙 아이콘, note: 보조 설명(언제·얼마나 지급되는지).
const EARN_RULES = [
  { key: "signup", label: "회원가입", icon: "ri-user-add-line", points: 100, note: "가입 완료 1회 지급", active: true },
  { key: "post", label: "글 작성", icon: "ri-article-line", points: 10, note: "게시글 1건당", active: true },
  { key: "comment", label: "댓글 작성", icon: "ri-chat-1-line", points: 2, note: "댓글 1건당 (일 10회 한도)", active: true },
  { key: "question", label: "질문 작성", icon: "ri-question-line", points: 5, note: "묻고답하기 질문 1건당", active: true },
  { key: "answer", label: "답변 작성", icon: "ri-question-answer-line", points: 8, note: "묻고답하기 답변 1건당", active: true },
  { key: "best-answer", label: "도움된 답변 표시됨", icon: "ri-checkbox-circle-line", points: 30, note: "질문자가 채택 시", active: true },
  { key: "resource", label: "실전자료 등록", icon: "ri-folder-upload-line", points: 50, note: "자료 승인 시", active: true },
  { key: "download", label: "다운로드 발생", icon: "ri-download-cloud-line", points: 3, note: "내 자료가 다운로드될 때", active: true },
  { key: "review", label: "후기 작성", icon: "ri-star-smile-line", points: 5, note: "실전자료 후기 1건당", active: true },
  { key: "liked", label: "좋아요 받음", icon: "ri-thumb-up-line", points: 1, note: "내 글/댓글이 좋아요 1회", active: true },
  { key: "report-ok", label: "신고 정상처리", icon: "ri-shield-check-line", points: 15, note: "내 신고가 위반 확정될 때", active: false },
] as const;

// 포인트 차감 규칙(더미). points 는 양수로 두고 화면에서 "-" 로 표기한다.
const DEDUCT_RULES = [
  { key: "violation", label: "신고 누적 후 위반확정", icon: "ri-error-warning-line", points: 50, note: "위반 확정 1건당 차감", active: true },
  { key: "delete-content", label: "부적절한 글/댓글/자료 삭제", icon: "ri-delete-bin-line", points: 30, note: "운영자 삭제 처리 시", active: true },
  { key: "manual-deduct", label: "운영자 수동 차감", icon: "ri-hand-coin-line", points: 0, note: "사유 입력 후 임의 차감(고정값 없음)", active: true },
] as const;

// 회원별 포인트 내역(더미). delta 부호로 적립(+)/차감(-) 구분.
// reason: 사유(규칙명 또는 수동 메모), balance: 변동 후 잔액, handler: 처리자.
// id: 거래 식별자(상세 페이지 경로 /points/{id} 에 사용)
const LEDGER = [
  { id: "tx-50118", name: "김개발", initial: "김", reason: "실전자료 등록 — PHP Legacy Review Skill", delta: 50, balance: 1820, date: "2026.06.18 14:22", handler: "시스템 자동" },
  { id: "tx-50117", name: "박자동", initial: "박", reason: "도움된 답변 채택 — n8n 자동 분류", delta: 30, balance: 2640, date: "2026.06.18 11:05", handler: "시스템 자동" },
  { id: "tx-50116", name: "최대표", initial: "최", reason: "신고 누적 후 위반확정", delta: -50, balance: 410, date: "2026.06.17 19:48", handler: "최고관리자" },
  { id: "tx-50115", name: "이코딩", initial: "이", reason: "수동 지급 — 우수 자료 기여 보상", delta: 200, balance: 3120, date: "2026.06.17 16:30", handler: "최고관리자" },
  { id: "tx-50114", name: "한사용", initial: "한", reason: "후기 작성 — 실전자료 후기", delta: 5, balance: 285, date: "2026.06.17 09:12", handler: "시스템 자동" },
  { id: "tx-50113", name: "정데브", initial: "정", reason: "부적절한 댓글 삭제", delta: -30, balance: 640, date: "2026.06.16 22:01", handler: "운영자2" },
  { id: "tx-50112", name: "오토메", initial: "오", reason: "회원가입 보너스", delta: 100, balance: 100, date: "2026.06.16 13:40", handler: "시스템 자동" },
  { id: "tx-50111", name: "윤프롬", initial: "윤", reason: "수동 차감 — 중복 자료 정리", delta: -40, balance: 980, date: "2026.06.15 17:55", handler: "최고관리자" },
] as const;

export default function AdminPointsPage() {
  return (
    <AdminShell breadcrumb={["관리자", "포인트 관리"]} activeKey="points">
      <div className="page-header">
        <div>
          <h1 className="page-title">포인트 관리</h1>
          <p className="page-description">적립·차감 규칙과 회원별 포인트 내역을 운영합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            내역 내보내기
          </button>
          {/* 수동 지급/차감 모달 열기 (overlay.js 가 data-admin-open 으로 인식) */}
          <button className="btn btn-primary" data-admin-open="pointAdjustModal">
            <i className="ri-hand-coin-line" />
            수동 지급/차감
          </button>
        </div>
      </div>

      {/* 초기 운영 원칙 안내 */}
      <div className="alert alert-info">
        <i className="ri-information-line" />
        <div>
          <strong>운영 원칙</strong>
          <br />
          포인트는 현금성 보상과 연결하지 않으며, 회원 활동 지표(등급·뱃지)로만 사용합니다. 적립/차감 규칙 변경은 저장 즉시 반영됩니다.
        </div>
      </div>

      <section className="grid stats-grid" aria-label="포인트 핵심 통계">
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

      {/* 적립 규칙 + 차감 규칙 (2단 그리드) */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">포인트 규칙 설정</h2>
            <p className="section-description">활동별 지급/차감 포인트와 활성 여부를 설정합니다.</p>
          </div>
          <button className="btn btn-primary btn-sm">
            <i className="ri-save-line" />
            규칙 저장
          </button>
        </div>

        <div className="grid component-grid">
          {/* 적립 규칙 카드 */}
          <article className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">포인트 적립 규칙</h3>
                <div className="card-subtitle">긍정적 활동에 지급되는 포인트</div>
              </div>
              <span className="badge badge-green">적립</span>
            </div>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>활동</th>
                    <th style={{ width: "140px" }}>지급 포인트</th>
                    <th style={{ width: "80px" }}>활성</th>
                  </tr>
                </thead>
                <tbody>
                  {EARN_RULES.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <div className="author">
                          <span className="author-avatar">
                            <i className={r.icon} />
                          </span>
                          <div>
                            <div className="content-title">{r.label}</div>
                            <div className="content-meta">{r.note}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="input-icon">
                          <i className="ri-add-line" />
                          <input
                            className="control"
                            type="number"
                            min={0}
                            defaultValue={r.points}
                            aria-label={`${r.label} 지급 포인트`}
                          />
                        </div>
                      </td>
                      <td>
                        <label className="switch" aria-label={`${r.label} 활성화`}>
                          <input type="checkbox" defaultChecked={r.active} />
                          <span className="switch-track" />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          {/* 차감 규칙 카드 */}
          <article className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">포인트 차감 규칙</h3>
                <div className="card-subtitle">위반·삭제 시 회수되는 포인트</div>
              </div>
              <span className="badge badge-red">차감</span>
            </div>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>활동</th>
                    <th style={{ width: "140px" }}>차감 포인트</th>
                    <th style={{ width: "80px" }}>활성</th>
                  </tr>
                </thead>
                <tbody>
                  {DEDUCT_RULES.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <div className="author">
                          <span className="author-avatar">
                            <i className={r.icon} />
                          </span>
                          <div>
                            <div className="content-title">{r.label}</div>
                            <div className="content-meta">{r.note}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="input-icon">
                          <i className="ri-subtract-line" />
                          <input
                            className="control"
                            type="number"
                            min={0}
                            defaultValue={r.points}
                            disabled={r.key === "manual-deduct"}
                            aria-label={`${r.label} 차감 포인트`}
                          />
                        </div>
                      </td>
                      <td>
                        <label className="switch" aria-label={`${r.label} 활성화`}>
                          <input type="checkbox" defaultChecked={r.active} />
                          <span className="switch-track" />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-body">
              <div className="alert alert-warning">
                <i className="ri-alert-line" />
                <div>
                  <strong>주의</strong>
                  <br />
                  차감은 회원 신뢰와 직결됩니다. 위반 확정 등 명확한 근거가 있을 때만 적용하세요.
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* 회원별 포인트 내역 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">회원별 포인트 내역</h2>
            <p className="section-description">적립·차감 이력과 잔액을 확인합니다.</p>
          </div>
        </div>

        <article className="card">
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input className="control" type="search" placeholder="회원 또는 사유 검색" aria-label="내역 검색" />
              </div>
              <div className="custom-select" data-select="pointType">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>구분: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">
                    구분: 전체
                    <i className="ri-check-line" />
                  </button>
                  <button className="select-option" data-value="earn">적립(+)</button>
                  <button className="select-option" data-value="deduct">차감(-)</button>
                </div>
              </div>
              <div className="custom-select" data-select="pointHandler">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>처리자: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">
                    처리자: 전체
                    <i className="ri-check-line" />
                  </button>
                  <button className="select-option" data-value="system">시스템 자동</button>
                  <button className="select-option" data-value="admin">운영자 수동</button>
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
              <span className="filter-chip">
                최근 18일
                <button aria-label="필터 제거">
                  <i className="ri-close-line" />
                </button>
              </span>
            </div>
          </div>

          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 8건의 내역</span>
            </div>
            <div className="toolbar-right">
              <button className="btn btn-outline btn-sm">
                <i className="ri-file-excel-2-line" />
                CSV 다운로드
              </button>
              <button className="btn btn-primary btn-sm" data-admin-open="pointAdjustModal">
                <i className="ri-hand-coin-line" />
                수동 지급/차감
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>회원</th>
                  <th>사유</th>
                  <th style={{ width: "110px" }}>변동</th>
                  <th>잔액</th>
                  <th>일시</th>
                  <th>처리자</th>
                </tr>
              </thead>
              <tbody>
                {LEDGER.map((row) => {
                  const earn = row.delta >= 0; // 적립이면 true(초록), 차감이면 false(빨강)
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="author">
                          <span className="author-avatar">{row.initial}</span>
                          <span>{row.name}</span>
                        </div>
                      </td>
                      <td>
                        {/* 사유 클릭 시 거래 상세 페이지로 이동 */}
                        <Link className="content-title" href={`/points/${row.id}`}>
                          {row.reason}
                        </Link>
                      </td>
                      <td>
                        <span className={`trend ${earn ? "up" : "down"}`}>
                          <i className={earn ? "ri-arrow-up-line" : "ri-arrow-down-line"} />
                          {earn ? "+" : "-"}
                          {Math.abs(row.delta).toLocaleString()}
                        </span>
                      </td>
                      <td className="num">{row.balance.toLocaleString()}</td>
                      <td className="num">{row.date}</td>
                      <td>
                        <span className={`badge ${row.handler === "시스템 자동" ? "badge-gray" : "badge-blue"}`}>
                          {row.handler}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div className="page-info">1–8 / 총 2,341건</div>
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

      {/* 공통 오버레이 뒷배경 (overlay.js 가 .overlay 하나를 토글) */}
      <div className="overlay" />

      {/* 수동 지급/차감 모달 */}
      <section className="modal" id="pointAdjustModal" role="dialog" aria-modal="true" aria-labelledby="pointAdjustTitle">
        <div className="modal-header">
          <div className="modal-title" id="pointAdjustTitle">수동 포인트 지급/차감</div>
          <button className="icon-button close-overlay" aria-label="모달 닫기">
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="field">
              <label className="field-label">회원 선택</label>
              <div className="input-icon">
                <i className="ri-user-search-line" />
                <input className="control" type="search" placeholder="닉네임 또는 이메일로 검색" aria-label="회원 검색" />
              </div>
              <div className="field-help">정확한 회원을 선택해야 포인트가 올바르게 반영됩니다.</div>
            </div>

            <div className="field">
              <span className="field-label">지급 / 차감 구분</span>
              <div className="choice-row">
                <label className="choice">
                  <input type="radio" name="adjustType" defaultChecked />
                  지급(+)
                </label>
                <label className="choice">
                  <input type="radio" name="adjustType" />
                  차감(-)
                </label>
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="adjustPoints">포인트</label>
              <div className="input-icon">
                <i className="ri-coins-line" />
                <input className="control" id="adjustPoints" type="number" min={0} placeholder="예: 100" />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="adjustReason">사유 메모</label>
              <textarea
                className="control"
                id="adjustReason"
                placeholder="예: 우수 실전자료 기여 보상 / 중복 자료 정리 차감"
              />
              <div className="field-help">사유는 회원별 내역에 그대로 기록됩니다.</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-primary">적용하기</button>
        </div>
      </section>
    </AdminShell>
  );
}

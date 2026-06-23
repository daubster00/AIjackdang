import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 쪽지 관리 페이지(라우트 /messages).
 * 회원 간 1:1 쪽지(개인 메시지)를 운영자가 모니터링하고, 스팸·사기·욕설 등 신고된 쪽지를
 * 숨김·삭제·발신 제한으로 처리한다.
 * 카드 상단에 .line-tabs(상태 탭)로 전체/정상/신고됨/숨김/삭제됨을 구분해 볼 수 있다.
 * 데이터는 전부 더미(정적 상수)이며, 이후 단계에서 API(@ai-jakdang/api)와 연동한다.
 * 인터랙션(셀렉트/행 메뉴/전체선택/탭)은 AdminShell 의 AdminInteractions 가 전역 연결한다.
 */

// STATS(핵심 지표 카드 더미). 운영자가 쪽지 영역에서 바로 봐야 하는 수치.
const STATS = [
  { label: "오늘 발송 쪽지", value: "1,284", icon: "ri-mail-send-line", tone: "blue", dir: "up", delta: "6.4%", note: "전일 대비" },
  { label: "신고된 쪽지", value: "14", icon: "ri-flag-2-line", tone: "orange", dir: "up", delta: "5건", note: "어제보다 증가" },
  { label: "스팸 의심", value: "37", icon: "ri-spam-2-line", tone: "purple", dir: "up", delta: "12건", note: "최근 7일" },
  { label: "발신 제한 회원", value: "6", icon: "ri-user-forbid-line", tone: "green", dir: "down", delta: "2명", note: "최근 7일" },
] as const;

/**
 * MESSAGES(쪽지 목록 더미).
 * - excerpt: 쪽지 본문 미리보기. sender/receiver: 보낸·받는 회원([이니셜, 닉네임]).
 * - reports: 신고 누적 수(0이면 정상). spam: 스팸 의심 자동 탐지 여부.
 * - status: 정상/신고됨/숨김/삭제 상태(배지). statusKey: 필터 키(data-status 속성값).
 * - datetime: 보낸 시각.
 */
const MESSAGES = [
  {
    excerpt: "안녕하세요! 올려주신 n8n 자동화 워크플로우 관련해서 따로 여쭤볼 게 있어서 쪽지 드립니다.",
    sender: ["박", "박자동"],
    receiver: ["김", "김개발"],
    datetime: "2026.06.18 14:22",
    reports: 0,
    spam: false,
    status: ["badge-green", "정상"], statusKey: "normal",
  },
  {
    excerpt: "외주 작업 가능하실까요? 단가 협의해서 진행하고 싶습니다. 연락처는 아래로 부탁드려요.",
    sender: ["최", "최대표"],
    receiver: ["이", "이수익"],
    datetime: "2026.06.18 11:05",
    reports: 0,
    spam: false,
    status: ["badge-green", "정상"], statusKey: "normal",
  },
  {
    excerpt: "💰 단기 고수익 부업 모집합니다! 하루 30분 투자로 월 300 보장. 지금 바로 링크 클릭 → bit.ly/xxxx",
    sender: ["스", "스팸계정01"],
    receiver: ["한", "한창작"],
    datetime: "2026.06.18 09:47",
    reports: 6,
    spam: true,
    status: ["badge-red", "신고됨"], statusKey: "reported",
  },
  {
    excerpt: "제 제품 베타테스터로 참여해주셔서 감사합니다. 피드백 주신 부분 반영해서 업데이트했어요!",
    sender: ["정", "정메이커"],
    receiver: ["서", "서대표"],
    datetime: "2026.06.17 19:30",
    reports: 0,
    spam: false,
    status: ["badge-green", "정상"], statusKey: "normal",
  },
  {
    excerpt: "[자동 탐지] 동일 내용을 24시간 내 18명에게 반복 발송한 쪽지입니다. 스팸 의심으로 분류되었습니다.",
    sender: ["광", "광고봇"],
    receiver: ["다", "다수 회원"],
    datetime: "2026.06.17 16:12",
    reports: 2,
    spam: true,
    status: ["badge-orange", "신고됨"], statusKey: "reported",
  },
  {
    excerpt: "지난번에 알려주신 Claude Code 스킬 설정 덕분에 잘 해결했습니다. 정말 감사드려요 :)",
    sender: ["한", "한사용"],
    receiver: ["이", "이코딩"],
    datetime: "2026.06.17 13:08",
    reports: 0,
    spam: false,
    status: ["badge-green", "정상"], statusKey: "normal",
  },
  {
    excerpt: "비방·욕설이 포함되어 운영자가 숨김 처리한 쪽지입니다.",
    sender: ["익", "익명777"],
    receiver: ["정", "정뉴비"],
    datetime: "2026.06.16 22:51",
    reports: 4,
    spam: false,
    status: ["badge-gray", "숨김"], statusKey: "hidden",
  },
  {
    excerpt: "허위 투자 권유로 신고 누적되어 삭제 처리된 쪽지입니다.",
    sender: ["사", "사기의심"],
    receiver: ["박", "박투자"],
    datetime: "2026.06.15 08:19",
    reports: 9,
    spam: true,
    status: ["badge-gray", "삭제됨"], statusKey: "deleted",
  },
] as const;

// STATUSES(상태 필터 옵션). all=전체, normal=정상, reported=신고됨, hidden=숨김, deleted=삭제됨.
const STATUSES = [
  { value: "all", label: "상태: 전체" },
  { value: "normal", label: "정상" },
  { value: "reported", label: "신고됨" },
  { value: "hidden", label: "숨김" },
  { value: "deleted", label: "삭제됨" },
] as const;

// STATUS_TABS(상태 탭 정의). label: 탭 표시 문구, value: data-tab 속성값(line-tabs 규약).
const STATUS_TABS = [
  { label: "전체", value: "all" },
  { label: "정상", value: "normal" },
  { label: "신고됨", value: "reported" },
  { label: "숨김", value: "hidden" },
  { label: "삭제됨", value: "deleted" },
] as const;

export default function AdminMessagesPage() {
  return (
    <AdminShell breadcrumb={["관리자", "쪽지 관리"]} activeKey="messages">
      <div className="page-header">
        <div>
          <h1 className="page-title">쪽지 관리</h1>
          <p className="page-description">회원 간 1:1 쪽지를 모니터링하고 스팸·사기·욕설 쪽지를 숨김·삭제·발신 제한으로 처리합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" type="button">
            <i className="ri-file-excel-2-line" />
            CSV 다운로드
          </button>
          <button className="btn btn-primary" type="button">
            <i className="ri-flag-2-line" />
            신고 대기열 보기
          </button>
        </div>
      </div>

      <section className="grid stats-grid" aria-label="쪽지 핵심 통계">
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
            <h2 className="section-title">쪽지 목록</h2>
            <p className="section-description">상태 탭으로 좁힌 뒤, 행 메뉴에서 수정·숨김·삭제·발신 제한을 처리합니다.</p>
          </div>
        </div>

        <article className="card">
          {/*
            .line-tabs(상태별 탭 내비게이션): AdminInteractions 의 line-tabs JS 가
            탭 클릭 시 .line-tab.active 이동 + 'admin:tab-change'(detail.value = data-tab) 이벤트를 발행한다.
            각 행에 data-status 속성이 있으므로 이벤트를 받아 JS로 필터링할 수 있다(디자인용 마크업).
          */}
          <div className="line-tabs" style={{ padding: "0 16px" }} aria-label="쪽지 상태 탭">
            {STATUS_TABS.map((tab, i) => (
              <button
                key={tab.value}
                className={`line-tab${i === 0 ? " active" : ""}`}
                data-tab={tab.value}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 필터: 내용/회원 검색, 상태 셀렉트, 신고 여부, 보낸 날짜 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input className="control" type="search" placeholder="쪽지 내용 또는 보낸/받는 회원 검색" aria-label="쪽지 검색" />
              </div>

              {/* 상태 필터 셀렉트(탭과 독립, 정교한 필터링 시 병용) */}
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

              {/* 신고 여부 필터 */}
              <div className="custom-select" data-select="report">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>신고: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">신고: 전체<i className="ri-check-line" /></button>
                  <button className="select-option" data-value="reported">신고 있음</button>
                  <button className="select-option" data-value="spam">스팸 의심</button>
                  <button className="select-option" data-value="clean">신고 없음</button>
                </div>
              </div>

              {/* 보낸 날짜 기간 */}
              <div className="input-icon">
                <i className="ri-calendar-line" />
                <input className="control" type="text" defaultValue="2026.06.01 - 2026.06.18" aria-label="보낸 날짜 기간" />
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

          {/* 일괄 처리 툴바: 숨김/삭제/발신 제한 중심 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 {MESSAGES.length}개의 쪽지</span>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>
                <i className="ri-eye-off-line" />
                숨김 처리
              </button>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>
                <i className="ri-user-forbid-line" />
                발신 제한
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
                  <th>쪽지 내용</th>
                  <th>보낸 회원</th>
                  <th>받는 회원</th>
                  <th>신고</th>
                  <th>상태</th>
                  <th>보낸 시각</th>
                  <th style={{ width: "60px" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {MESSAGES.map((m, idx) => (
                  // data-status(상태 키): 탭 필터링 JS 가 이 속성으로 행 표시/숨김을 결정한다.
                  <tr key={m.excerpt} data-status={m.statusKey}>
                    <td>
                      <input className="check row-check" type="checkbox" aria-label="행 선택" />
                    </td>
                    <td>
                      {/* 쪽지 내용 클릭 시 상세 페이지(/messages/[id])로 이동 */}
                      <Link className="content-title" href={`/messages/${idx + 1}`}>
                        {m.spam ? <span className="badge badge-purple" title="스팸 의심" style={{ marginRight: 6 }}>스팸</span> : null}
                        {m.excerpt}
                      </Link>
                    </td>
                    <td>
                      <div className="author">
                        <span className="author-avatar">{m.sender[0]}</span>
                        <span>{m.sender[1]}</span>
                      </div>
                    </td>
                    <td>
                      <div className="author">
                        <span className="author-avatar">{m.receiver[0]}</span>
                        <span>{m.receiver[1]}</span>
                      </div>
                    </td>
                    <td className="num">
                      {m.reports > 0 ? (
                        <span className="badge badge-red">{m.reports}</span>
                      ) : (
                        <span className="content-meta">0</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${m.status[0]}`}>{m.status[1]}</span>
                    </td>
                    <td className="num">{m.datetime}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button row-action-button" aria-label="행 메뉴">
                          <i className="ri-more-2-fill" />
                        </button>
                        {/* 행 액션 메뉴: 상세 보기 / 수정 / 숨김 처리 / 발신 제한 / 삭제 */}
                        <div className="action-menu">
                          <Link href={`/messages/${idx + 1}`}>
                            <i className="ri-eye-line" />상세 보기
                          </Link>
                          {/* "수정": 상세 페이지의 수정과 동일 맥락 — 목록에서도 바로 접근 가능하도록 */}
                          <Link href={`/messages/${idx + 1}`}>
                            <i className="ri-edit-line" />수정
                          </Link>
                          <button type="button">
                            <i className="ri-flag-2-line" />신고 내역 보기
                          </button>
                          <button type="button">
                            <i className="ri-alarm-warning-line" />발신자 경고
                          </button>
                          {m.statusKey === "hidden" ? (
                            <button type="button">
                              <i className="ri-eye-line" />숨김 해제
                            </button>
                          ) : (
                            <button type="button">
                              <i className="ri-eye-off-line" />쪽지 숨김
                            </button>
                          )}
                          <button type="button">
                            <i className="ri-user-forbid-line" />발신자 쪽지 제한
                          </button>
                          {m.statusKey === "deleted" ? (
                            <button type="button">
                              <i className="ri-arrow-go-back-line" />복구
                            </button>
                          ) : (
                            <button className="danger" type="button">
                              <i className="ri-delete-bin-line" />쪽지 삭제
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
            <div className="page-info">1–{MESSAGES.length} / 총 1,284개</div>
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

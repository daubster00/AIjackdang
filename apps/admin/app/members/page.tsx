import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 유저 회원 관리 페이지.
 * @ai-jakdang/admin-design-system 의 마크업/토큰으로 구성한다(관리자 전용).
 * 모든 수치/목록은 더미 값이며, 이후 단계에서 API(@ai-jakdang/api) 와 연동한다.
 *
 * 인터랙션(셀렉트/드로어/모달/테이블 선택/탭)은 AdminShell 안의 AdminInteractions 가
 * initAdminUI() 로 전역 연결한다. 이 페이지는 규약 클래스/data-* 속성을 가진 마크업만 그린다.
 *
 * 권한(role)/운영자 관련 UI 는 관리자 메뉴(/admin-members)로 분리되어 이 페이지에서 제거됨.
 */

// 상단 요약 통계 카드(더미). tone(아이콘 색), dir(추세 화살표 방향).
const STATS = [
  { label: "전체 유저 회원", value: "8,421", icon: "ri-group-line", tone: "blue", dir: "up", delta: "3.2%", note: "전월 대비" },
  { label: "오늘 신규 가입", value: "48", icon: "ri-user-add-line", tone: "green", dir: "up", delta: "12명", note: "어제보다 증가" },
  { label: "이용제한 회원", value: "37", icon: "ri-user-forbid-line", tone: "orange", dir: "down", delta: "5명", note: "지난주보다 감소" },
  { label: "신고 누적 회원", value: "14", icon: "ri-flag-line", tone: "red", dir: "up", delta: "2명", note: "이번 주 증가" },
] as const;

// 등급(grade) → 배지 색 매핑. 5등급.
const GRADE_BADGE: Record<string, string> = {
  "새내기": "badge-gray",
  "작당원": "badge-blue",
  "실전러": "badge-cyan",
  "고수": "badge-purple",
  "마스터": "badge-orange",
};

// 상태(status) → 배지 색. 정상 → green, 이용제한 → red, 탈퇴 → gray.
const STATUS_BADGE: Record<string, string> = {
  "정상": "badge-green",
  "이용제한": "badge-red",
  "탈퇴": "badge-gray",
};

/**
 * 유저 회원 목록(더미). 권한(role) 컬럼 제거됨.
 * 운영자/최고관리자 계정은 관리자 메뉴에서 별도 관리.
 */
const MEMBERS = [
  {
    initial: "박",
    nickname: "박자동",
    email: "park.auto@example.com",
    joinedAt: "2026.01.15",
    lastLogin: "2026.06.18",
    posts: 64,
    comments: 201,
    points: 7820,
    grade: "고수",
    reports: 1,
    status: "정상",
  },
  {
    initial: "최",
    nickname: "최대표",
    email: "ceo.choi@example.com",
    joinedAt: "2025.09.21",
    lastLogin: "2026.06.17",
    posts: 51,
    comments: 96,
    points: 24050,
    grade: "마스터",
    reports: 4,
    status: "이용제한",
  },
  {
    initial: "이",
    nickname: "이코딩",
    email: "lee.coding@example.com",
    joinedAt: "2026.03.08",
    lastLogin: "2026.06.18",
    posts: 28,
    comments: 73,
    points: 3140,
    grade: "실전러",
    reports: 0,
    status: "정상",
  },
  {
    initial: "한",
    nickname: "한사용",
    email: "han.user@example.com",
    joinedAt: "2026.05.30",
    lastLogin: "2026.06.16",
    posts: 6,
    comments: 21,
    points: 640,
    grade: "작당원",
    reports: 0,
    status: "정상",
  },
  {
    initial: "정",
    nickname: "정뉴비",
    email: "jung.newbie@example.com",
    joinedAt: "2026.06.17",
    lastLogin: "2026.06.18",
    posts: 1,
    comments: 3,
    points: 80,
    grade: "새내기",
    reports: 0,
    status: "정상",
  },
  {
    initial: "노",
    nickname: "노쇼러",
    email: "nshow.spam@example.com",
    joinedAt: "2026.02.11",
    lastLogin: "2026.04.02",
    posts: 14,
    comments: 5,
    points: 0,
    grade: "새내기",
    reports: 7,
    status: "이용제한",
  },
  {
    initial: "송",
    nickname: "송탈퇴",
    email: "song.left@example.com",
    joinedAt: "2025.12.04",
    lastLogin: "2026.05.10",
    posts: 33,
    comments: 88,
    points: 0,
    grade: "작당원",
    reports: 1,
    status: "탈퇴",
  },
  {
    initial: "오",
    nickname: "오참여",
    email: "oh.active@example.com",
    joinedAt: "2026.04.12",
    lastLogin: "2026.06.18",
    posts: 19,
    comments: 44,
    points: 2310,
    grade: "실전러",
    reports: 0,
    status: "정상",
  },
] as const;

// 포인트 조정 모달에 현재 보유 포인트를 표시할 대표 회원(더미).
const DETAIL = MEMBERS[1]; // 최대표 — 이용제한 + 신고 누적 사례

export default function AdminMembersPage() {
  return (
    <AdminShell breadcrumb={["관리자", "유저 회원 관리"]} activeKey="members">
      <div className="page-header">
        <div>
          <h1 className="page-title">유저 회원 관리</h1>
          <p className="page-description">일반 유저 회원의 활동·등급·상태를 확인하고 처리합니다. 운영진 관리는 관리자 메뉴를 이용하세요.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            CSV 다운로드
          </button>
          <button className="btn btn-primary" data-admin-open="memberMessage">
            <i className="ri-mail-send-line" />
            쪽지 발송
          </button>
        </div>
      </div>

      {/* 1. 상단 요약 통계 카드 */}
      <section className="grid stats-grid" aria-label="유저 회원 통계">
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

      {/* 2~3. 필터/검색 + 회원 테이블 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">유저 회원 목록</h2>
            <p className="section-description">검색·필터로 회원을 찾고, 행의 상세보기에서 활동 내역과 처리 액션을 확인합니다.</p>
          </div>
        </div>

        <article className="card">
          {/* 상태별 빠른 탭 — 운영진 탭 제거됨 */}
          <div className="line-tabs" role="tablist" aria-label="회원 상태">
            <button className="line-tab active" data-tab="all">전체 유저</button>
            <button className="line-tab" data-tab="active">정상</button>
            <button className="line-tab" data-tab="restricted">이용제한</button>
            <button className="line-tab" data-tab="left">탈퇴</button>
          </div>

          {/* 2. 필터/검색 패널 — 권한 필터 제거됨 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input className="control" type="search" placeholder="닉네임 또는 이메일 검색" aria-label="회원 검색" />
              </div>
              <div className="custom-select" data-select="memberStatus">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>상태: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">상태: 전체<i className="ri-check-line" /></button>
                  <button className="select-option" data-value="active">정상</button>
                  <button className="select-option" data-value="restricted">이용제한</button>
                  <button className="select-option" data-value="left">탈퇴</button>
                </div>
              </div>
              <div className="custom-select" data-select="memberGrade">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>등급: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">등급: 전체<i className="ri-check-line" /></button>
                  <button className="select-option" data-value="newbie">새내기</button>
                  <button className="select-option" data-value="member">작당원</button>
                  <button className="select-option" data-value="practical">실전러</button>
                  <button className="select-option" data-value="expert">고수</button>
                  <button className="select-option" data-value="master">마스터</button>
                </div>
              </div>
              <div className="filter-actions">
                <button className="btn btn-outline"><i className="ri-refresh-line" />초기화</button>
                <button className="btn btn-primary"><i className="ri-search-line" />검색</button>
              </div>
            </div>
            <div className="active-filters">
              <span className="filter-chip">이용제한 회원<button aria-label="필터 제거"><i className="ri-close-line" /></button></span>
              <span className="filter-chip">신고 1건 이상<button aria-label="필터 제거"><i className="ri-close-line" /></button></span>
            </div>
          </div>

          {/* 일괄 처리 툴바 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 8,421명의 유저 회원</span>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>이용제한</button>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>포인트 지급</button>
            </div>
            <div className="toolbar-right">
              <button className="btn btn-outline btn-sm"><i className="ri-file-excel-2-line" />CSV 다운로드</button>
            </div>
          </div>

          {/* 3. 유저 회원 테이블 — 권한(role) 컬럼 제거됨 */}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "44px" }}>
                    <input className="check" data-admin-select-all type="checkbox" aria-label="전체 선택" />
                  </th>
                  <th>닉네임</th>
                  <th>이메일</th>
                  <th>가입일</th>
                  <th>최근 로그인</th>
                  <th>작성글</th>
                  <th>댓글</th>
                  <th>포인트</th>
                  <th>등급</th>
                  <th>신고</th>
                  <th>상태</th>
                  <th style={{ width: "60px" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {MEMBERS.map((m) => (
                  <tr key={m.email}>
                    <td>
                      <input className="check row-check" type="checkbox" aria-label={`${m.nickname} 선택`} />
                    </td>
                    <td>
                      {/* 닉네임 클릭 시 유저 회원 상세 페이지로 이동. id(식별자)는 이메일 사용 */}
                      <Link className="author" href={`/members/${encodeURIComponent(m.email)}`}>
                        <span className="author-avatar">{m.initial}</span>
                        <span>{m.nickname}</span>
                      </Link>
                    </td>
                    <td>{m.email}</td>
                    <td className="num">{m.joinedAt}</td>
                    <td className="num">{m.lastLogin}</td>
                    <td className="num">{m.posts.toLocaleString()}</td>
                    <td className="num">{m.comments.toLocaleString()}</td>
                    <td className="num">{m.points.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${GRADE_BADGE[m.grade]}`}>{m.grade}</span>
                    </td>
                    <td className="num">{m.reports > 0 ? <span className="badge badge-red">{m.reports}</span> : 0}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[m.status]}`}>{m.status}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button row-action-button" aria-label="행 메뉴">
                          <i className="ri-more-2-fill" />
                        </button>
                        <div className="action-menu">
                          {/* 상세보기 → 유저 회원 상세 페이지로 이동 */}
                          <Link href={`/members/${encodeURIComponent(m.email)}`}><i className="ri-eye-line" />상세보기</Link>
                          <button data-admin-open="memberPoint"><i className="ri-coin-line" />포인트 조정</button>
                          <button data-admin-open="memberMessage"><i className="ri-mail-send-line" />쪽지 발송</button>
                          <button className="danger"><i className="ri-user-forbid-line" />이용제한</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <div className="page-info">1–8 / 총 8,421명</div>
            <div className="page-buttons">
              <button className="page-button" aria-label="이전 페이지"><i className="ri-arrow-left-s-line" /></button>
              <button className="page-button active">1</button>
              <button className="page-button">2</button>
              <button className="page-button">3</button>
              <button className="page-button">4</button>
              <button className="page-button" aria-label="다음 페이지"><i className="ri-arrow-right-s-line" /></button>
            </div>
          </div>
        </article>
      </section>

      {/* ===== 오버레이 영역 ===== */}
      <div className="overlay" />

      {/* 포인트 수동 지급/차감 모달 */}
      <section className="modal" id="memberPoint" role="dialog" aria-modal="true" aria-labelledby="memberPointTitle">
        <div className="modal-header">
          <div className="modal-title" id="memberPointTitle">포인트 조정</div>
          <button className="icon-button close-overlay" aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="alert alert-info"><i className="ri-information-line" /><div>현재 보유 포인트: <strong>{DETAIL.points.toLocaleString()} P</strong></div></div>
            <div className="field">
              <span className="field-label">조정 유형</span>
              <div className="choice-row">
                <label className="choice"><input type="radio" name="pointType" defaultChecked />지급(+)</label>
                <label className="choice"><input type="radio" name="pointType" />차감(-)</label>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="pointAmount">포인트 수량</label>
              <input className="control" id="pointAmount" type="number" placeholder="예: 500" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="pointReason">사유</label>
              <textarea className="control" id="pointReason" placeholder="이벤트 보상, 우수 답변 등 조정 사유를 남기세요" />
              <div className="field-help">조정 내역은 회원에게 알림으로 안내됩니다.</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-primary">적용하기</button>
        </div>
      </section>

      {/* 쪽지 발송 모달 */}
      <section className="modal" id="memberMessage" role="dialog" aria-modal="true" aria-labelledby="memberMessageTitle">
        <div className="modal-header">
          <div className="modal-title" id="memberMessageTitle">쪽지 발송</div>
          <button className="icon-button close-overlay" aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="field">
              <label className="field-label" htmlFor="msgRecipient">받는 회원</label>
              <div className="input-icon">
                <i className="ri-user-search-line" />
                <input
                  className="control"
                  id="msgRecipient"
                  type="search"
                  placeholder="닉네임 또는 이메일로 검색"
                />
              </div>
              {/* 검색 결과 미리보기(더미) */}
              <div className="field-help">예: 최대표 (ceo.choi@example.com)</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="msgSubject">제목</label>
              <input className="control" id="msgSubject" type="text" placeholder="쪽지 제목을 입력하세요" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="msgBody">내용</label>
              <textarea
                className="control"
                id="msgBody"
                rows={5}
                placeholder="쪽지 내용을 입력하세요"
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-primary">
            <i className="ri-mail-send-line" />
            보내기
          </button>
        </div>
      </section>
    </AdminShell>
  );
}

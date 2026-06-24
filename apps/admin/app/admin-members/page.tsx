import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { getAdminSession } from "@/lib/adminSession";
import { PermissionDenied } from "@/components/ui/PermissionDenied";

/**
 * 관리회원 관리 목록 페이지.
 * 운영진(관리자 계정)을 조회하고, 등급·상태·권한을 확인하며 처리 액션(디자인만)을 제공한다.
 * 모든 수치/목록은 더미 값이며, 이후 단계에서 API 와 연동한다.
 */

// 상단 요약 통계 카드(더미). tone(강조 색상)은 stat-icon 색.
const STATS = [
  { label: "전체 관리자", value: "9", icon: "ri-shield-user-line", tone: "purple", dir: "up", delta: "1명", note: "이번 달 추가" },
  { label: "마스터", value: "2", icon: "ri-vip-crown-line", tone: "orange", dir: "neutral", delta: "변동 없음", note: "" },
  { label: "승인 대기", value: "2", icon: "ri-user-follow-line", tone: "orange", dir: "up", delta: "2건", note: "처리 필요" },
  { label: "정지된 관리자", value: "0", icon: "ri-user-forbid-line", tone: "red", dir: "neutral", delta: "정상", note: "이상 없음" },
] as const;

// 관리 등급(adminGrade) → 배지 색 매핑.
const ADMIN_GRADE_BADGE: Record<string, string> = {
  "마스터": "badge-orange",
  "운영자": "badge-blue",
};

// 상태(status) → 배지 색.
const STATUS_BADGE: Record<string, string> = {
  "활성": "badge-green",
  "정지": "badge-red",
  "승인대기": "badge-orange",
};

// 관리회원 목록(더미). 승인대기 2명 + 활성/정지 운영진.
// status 가 "승인대기" 인 행은 lastLogin 대신 신청일(requestedAt)을 가지며,
// 행 액션과 일괄 처리에서 "승인/반려" 대상이 된다.
const ADMIN_MEMBERS = [
  {
    id: "p1",
    initial: "정",
    name: "정신규",
    email: "jung.new@example.com",
    adminGrade: "운영자",
    status: "승인대기",
    assignedArea: "게시글·댓글(신청)",
    lastLogin: "—",
    joinedAt: "2026.06.21",
  },
  {
    id: "p2",
    initial: "윤",
    name: "윤대기",
    email: "yoon.wait@example.com",
    adminGrade: "운영자",
    status: "승인대기",
    assignedArea: "신고·쪽지(신청)",
    lastLogin: "—",
    joinedAt: "2026.06.20",
  },
  {
    id: "1",
    initial: "최",
    name: "최마스터",
    email: "master.choi@example.com",
    adminGrade: "마스터",
    status: "활성",
    assignedArea: "전체",
    lastLogin: "2026.06.22",
    joinedAt: "2025.08.01",
  },
  {
    id: "2",
    initial: "김",
    name: "김개발",
    email: "kim.dev@example.com",
    adminGrade: "마스터",
    status: "활성",
    assignedArea: "전체",
    lastLogin: "2026.06.22",
    joinedAt: "2025.09.15",
  },
  {
    id: "3",
    initial: "박",
    name: "박운영",
    email: "park.op@example.com",
    adminGrade: "운영자",
    status: "활성",
    assignedArea: "게시글·댓글",
    lastLogin: "2026.06.21",
    joinedAt: "2025.11.02",
  },
  {
    id: "4",
    initial: "이",
    name: "이콘텐츠",
    email: "lee.content@example.com",
    adminGrade: "운영자",
    status: "활성",
    assignedArea: "묻고답하기·실전자료",
    lastLogin: "2026.06.20",
    joinedAt: "2026.01.10",
  },
  {
    id: "5",
    initial: "한",
    name: "한신고",
    email: "han.report@example.com",
    adminGrade: "운영자",
    status: "활성",
    assignedArea: "신고·쪽지",
    lastLogin: "2026.06.19",
    joinedAt: "2026.02.28",
  },
  {
    id: "6",
    initial: "송",
    name: "송회원",
    email: "song.member@example.com",
    adminGrade: "운영자",
    status: "정지",
    assignedArea: "유저 회원",
    lastLogin: "2026.05.30",
    joinedAt: "2026.03.15",
  },
] as const;

export default async function AdminMembersListPage() {
  const session = await getAdminSession();
  if (session?.role !== "super_admin") {
    return (
      <AdminShell
        breadcrumb={["관리자", "관리회원 관리", "관리회원"]}
        activeKey="admin-members"
        activeSubKey=""
        adminUser={session}
      >
        <PermissionDenied />
      </AdminShell>
    );
  }
  return (
    <AdminShell
      breadcrumb={["관리자", "관리회원 관리", "관리회원"]}
      activeKey="admin-members"
      activeSubKey=""
      adminUser={session}
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">관리회원 관리</h1>
          <p className="page-description">운영진(관리자 계정)의 등급·상태·권한을 확인하고 처리합니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">
            <i className="ri-file-excel-2-line" />
            CSV 다운로드
          </button>
        </div>
      </div>

      {/* 1. 상단 요약 통계 카드 */}
      <section className="grid stats-grid" aria-label="관리회원 통계">
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
              {s.dir !== "neutral" ? (
                <span className={`trend ${s.dir}`}>
                  <i className={s.dir === "up" ? "ri-arrow-up-line" : "ri-arrow-down-line"} />
                  {s.delta}
                </span>
              ) : (
                <span>{s.delta}</span>
              )}
              {s.note ? <span>{s.note}</span> : null}
            </div>
          </article>
        ))}
      </section>

      {/* 2~3. 필터/검색 + 관리회원 테이블 */}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2 className="section-title">관리회원 목록</h2>
            <p className="section-description">등급·상태로 필터하고, 승인 대기 신청은 선택 후 승인 처리하거나 행 메뉴에서 승인·반려합니다.</p>
          </div>
        </div>

        <article className="card">
          {/* 상태/등급별 빠른 탭 */}
          <div className="line-tabs" role="tablist" aria-label="관리 상태·등급">
            <button className="line-tab active" data-tab="all">전체</button>
            <button className="line-tab" data-tab="pending">
              승인대기
              <span className="badge badge-orange" style={{ marginLeft: 6 }}>2</span>
            </button>
            <button className="line-tab" data-tab="master">마스터</button>
            <button className="line-tab" data-tab="operator">운영자</button>
            <button className="line-tab" data-tab="suspended">정지</button>
          </div>

          {/* 필터/검색 패널 */}
          <div className="filter-panel">
            <div className="filter-row">
              <div className="input-icon">
                <i className="ri-search-line" />
                <input className="control" type="search" placeholder="이름 또는 이메일 검색" aria-label="관리회원 검색" />
              </div>
              <div className="custom-select" data-select="adminGrade">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>등급: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">등급: 전체<i className="ri-check-line" /></button>
                  <button className="select-option" data-value="master">마스터</button>
                  <button className="select-option" data-value="operator">운영자</button>
                </div>
              </div>
              <div className="custom-select" data-select="adminStatus">
                <button className="select-trigger" type="button" aria-expanded="false">
                  <span>상태: 전체</span>
                  <i className="ri-arrow-down-s-line" />
                </button>
                <div className="select-menu">
                  <button className="select-option selected" data-value="all">상태: 전체<i className="ri-check-line" /></button>
                  <button className="select-option" data-value="pending">승인대기</button>
                  <button className="select-option" data-value="active">활성</button>
                  <button className="select-option" data-value="suspended">정지</button>
                </div>
              </div>
              <div className="filter-actions">
                <button className="btn btn-outline"><i className="ri-refresh-line" />초기화</button>
                <button className="btn btn-primary"><i className="ri-search-line" />검색</button>
              </div>
            </div>
          </div>

          {/* 일괄 처리 툴바 */}
          <div className="table-toolbar">
            <div className="toolbar-left">
              <span className="selection-info">총 8명 · 승인 대기 2명</span>
              <button className="btn btn-primary btn-sm" data-admin-requires-selection data-admin-open="adminMemberApprove" disabled>
                <i className="ri-checkbox-circle-line" />
                승인 처리
              </button>
              <button className="btn btn-outline btn-sm" data-admin-requires-selection disabled>정지 처리</button>
            </div>
            <div className="toolbar-right">
              <button className="btn btn-outline btn-sm"><i className="ri-file-excel-2-line" />CSV 다운로드</button>
            </div>
          </div>

          {/* 관리회원 테이블 */}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "44px" }}>
                    <input className="check" data-admin-select-all type="checkbox" aria-label="전체 선택" />
                  </th>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>관리 등급</th>
                  <th>담당 영역</th>
                  <th>상태</th>
                  <th>최근 로그인</th>
                  <th>등록일</th>
                  <th style={{ width: "60px" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {ADMIN_MEMBERS.map((m) => (
                  <tr key={m.email}>
                    <td>
                      <input className="check row-check" type="checkbox" aria-label={`${m.name} 선택`} />
                    </td>
                    <td>
                      {/* 이름 클릭 시 관리회원 상세 페이지로 이동 */}
                      <Link className="author" href={`/admin-members/${m.id}`}>
                        <span className="author-avatar">{m.initial}</span>
                        <span>{m.name}</span>
                      </Link>
                    </td>
                    <td>{m.email}</td>
                    <td>
                      <span className={`badge ${ADMIN_GRADE_BADGE[m.adminGrade]}`}>{m.adminGrade}</span>
                    </td>
                    <td>{m.assignedArea}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[m.status]}`}>{m.status}</span>
                    </td>
                    <td className="num">{m.lastLogin}</td>
                    <td className="num">{m.joinedAt}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button row-action-button" aria-label="행 메뉴">
                          <i className="ri-more-2-fill" />
                        </button>
                        <div className="action-menu">
                          <Link href={`/admin-members/${m.id}`}><i className="ri-eye-line" />상세보기</Link>
                          {m.status === "승인대기" ? (
                            <>
                              <button data-admin-open="adminMemberApprove"><i className="ri-checkbox-circle-line" />승인 처리</button>
                              <button className="danger" data-admin-open="adminMemberReject"><i className="ri-close-circle-line" />반려</button>
                            </>
                          ) : (
                            <>
                              <Link href={`/admin-members/permissions`}><i className="ri-key-2-line" />권한 보기</Link>
                              <button className="danger"><i className="ri-user-forbid-line" />정지 처리</button>
                            </>
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
            <div className="page-info">1–8 / 총 8명</div>
            <div className="page-buttons">
              <button className="page-button" aria-label="이전 페이지"><i className="ri-arrow-left-s-line" /></button>
              <button className="page-button active">1</button>
              <button className="page-button" aria-label="다음 페이지"><i className="ri-arrow-right-s-line" /></button>
            </div>
          </div>
        </article>
      </section>

      {/* ===== 오버레이 영역 ===== */}
      <div className="overlay" />

      {/* 승인 처리 모달 */}
      <section className="modal" id="adminMemberApprove" role="dialog" aria-modal="true" aria-labelledby="adminMemberApproveTitle">
        <div className="modal-header">
          <div className="modal-title" id="adminMemberApproveTitle">관리회원 승인 처리</div>
          <button className="icon-button close-overlay" aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="alert alert-info">
              <i className="ri-information-line" />
              <div>선택한 승인 대기 신청을 승인합니다. 승인 시 관리자 권한이 즉시 활성화되고 안내 메일이 발송됩니다.</div>
            </div>
            <div className="field">
              <span className="field-label">부여할 등급</span>
              <div className="choice-row">
                <label className="choice"><input type="radio" name="approveGrade" defaultChecked />운영자</label>
                <label className="choice"><input type="radio" name="approveGrade" />마스터</label>
              </div>
              <div className="field-help">신청 시 요청한 등급이 기본 선택됩니다. 필요 시 변경 후 승인하세요.</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="approveArea">담당 영역</label>
              <input className="control" id="approveArea" type="text" placeholder="예: 게시글·댓글" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="approveMemo">승인 메모(선택)</label>
              <textarea className="control" id="approveMemo" placeholder="승인 사유나 인수인계 사항을 남길 수 있습니다" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-primary"><i className="ri-checkbox-circle-line" />승인하기</button>
        </div>
      </section>

      {/* 반려 모달 */}
      <section className="modal" id="adminMemberReject" role="dialog" aria-modal="true" aria-labelledby="adminMemberRejectTitle">
        <div className="modal-header">
          <div className="modal-title" id="adminMemberRejectTitle">승인 신청 반려</div>
          <button className="icon-button close-overlay" aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="alert alert-danger">
              <i className="ri-alarm-warning-line" />
              <div>이 승인 신청을 반려합니다. 반려 시 신청자는 관리자 권한을 받지 못하며, 사유가 신청자에게 전달됩니다.</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="rejectReason">반려 사유</label>
              <textarea className="control" id="rejectReason" placeholder="반려 사유를 입력하세요" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-danger"><i className="ri-close-circle-line" />반려하기</button>
        </div>
      </section>
    </AdminShell>
  );
}

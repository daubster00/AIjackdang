import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminHistoryLog, type HistoryEntry } from "@/components/admin-members/AdminHistoryLog";

/**
 * 관리회원 상세 페이지 — 목록의 이름/상세보기 클릭 시 이동.
 * 관리자 프로필 + 등급 + 처리 이력(항목 클릭 시 상세 모달) + 처리 액션(등급 변경·정지, 디자인만)을 제공한다.
 * 데이터는 더미(정적)이며, 이후 단계에서 params.id 로 API 조회한다.
 * Next 15+ 규약: params 는 Promise<{ id: string }> 로 타입 선언 후 await 한다.
 */

// 관리 등급(adminGrade) → 배지 색 매핑.
const ADMIN_GRADE_BADGE: Record<string, string> = {
  "마스터": "badge-orange",
  "운영자": "badge-blue",
};

// 상태(status) → 배지 색.
const STATUS_BADGE: Record<string, string> = {
  "활성": "badge-green",
  "정지": "badge-red",
};

// 대표 더미 관리자 프로필. 실제로는 params.id 로 조회된 관리자 데이터로 채워진다.
const DETAIL = {
  id: "3",
  initial: "박",
  name: "박운영",
  email: "park.op@example.com",
  adminGrade: "운영자",
  status: "활성",
  assignedArea: "게시글·댓글",
  lastLogin: "2026.06.21",
  joinedAt: "2025.11.02",
  memo: "게시글·댓글 분야 전담 운영자. 스팸 처리 및 게시판 운영 담당.",
};

// 처리 이력(더미). 각 항목은 리스트에 한 줄로 보이고, 클릭하면 fields/reason 이 모달에 상세 표기된다.
const HISTORY: HistoryEntry[] = [
  {
    id: "h5",
    date: "2026.06.10",
    time: "14:32",
    actor: "최마스터",
    actionType: "권한 변경",
    summary: "신고 관리 페이지 ‘삭제’ 권한 부여",
    fields: [
      { label: "대상 페이지", value: "신고 관리" },
      { label: "권한 항목", value: "삭제" },
      { label: "변경 전", value: "비활성 (권한 없음)" },
      { label: "변경 후", value: "활성 (권한 부여)" },
      { label: "처리 방식", value: "권한 설정 페이지에서 개별 토글" },
    ],
    reason: "신고 처리 업무량 증가로 스팸 게시글 직접 삭제 권한이 필요하여 부여함.",
  },
  {
    id: "h4",
    date: "2026.04.15",
    time: "09:18",
    actor: "최마스터",
    actionType: "담당 변경",
    summary: "담당 영역 변경 — 묻고답하기 → 게시글·댓글",
    fields: [
      { label: "변경 전", value: "묻고답하기·실전자료" },
      { label: "변경 후", value: "게시글·댓글" },
      { label: "처리 방식", value: "관리회원 상세 → 담당 영역 수정" },
    ],
    reason: "게시글·댓글 영역 운영 인력 보강을 위해 담당을 재배치함.",
  },
  {
    id: "h3",
    date: "2026.03.20",
    time: "16:05",
    actor: "김개발",
    actionType: "정지 해제",
    summary: "임시 정지 해제 — 정상 활성 전환",
    fields: [
      { label: "변경 전", value: "정지" },
      { label: "변경 후", value: "활성" },
      { label: "정지 기간", value: "2026.03.18 ~ 2026.03.20 (2일)" },
      { label: "처리 방식", value: "관리회원 상세 → 정지 해제" },
    ],
    reason: "로그인 이상 징후 점검 완료, 본인 확인되어 정지를 해제함.",
  },
  {
    id: "h2",
    date: "2026.03.18",
    time: "11:47",
    actor: "김개발",
    actionType: "정지",
    summary: "보안 점검을 위한 임시 정지",
    fields: [
      { label: "변경 전", value: "활성" },
      { label: "변경 후", value: "정지" },
      { label: "감지 내역", value: "해외 IP 다중 로그인 시도 (3회)" },
      { label: "처리 방식", value: "관리회원 상세 → 정지 처리" },
    ],
    reason: "비정상 로그인 시도가 감지되어 계정 보호를 위해 임시 정지함.",
  },
  {
    id: "h1",
    date: "2025.11.02",
    time: "10:00",
    actor: "최마스터",
    actionType: "등록",
    summary: "운영자 등급으로 신규 등록",
    fields: [
      { label: "초기 등급", value: "운영자" },
      { label: "담당 영역", value: "묻고답하기·실전자료" },
      { label: "초대 방식", value: "이메일 초대 (park.op@example.com)" },
      { label: "승인자", value: "최마스터" },
    ],
    reason: "묻고답하기 게시판 운영 담당으로 신규 운영자를 등록함.",
  },
];

export default async function AdminMemberDetailPage({
  params,
}: {
  /** Next 15+ 규약: params(경로 파라미터)는 Promise 로 전달된다. */
  params: Promise<{ id: string }>;
}) {
  // id(관리회원 고유 식별자)를 await 로 언래핑.
  const { id } = await params;
  void id; // 더미 데이터 사용 중 — 실제 구현 시 API 조회에 사용

  return (
    <AdminShell
      breadcrumb={["관리자", "관리회원 관리", "관리회원", DETAIL.name]}
      activeKey="admin-members"
      activeSubKey=""
    >
      <div className="page-header">
        <div>
          <Link className="btn btn-outline btn-sm" href="/admin-members">
            <i className="ri-arrow-left-line" />
            목록으로
          </Link>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" data-admin-open="adminGradeChange">
            <i className="ri-award-line" />
            등급 변경
          </button>
          <button className="btn btn-danger" data-admin-open="adminSuspend">
            <i className="ri-user-forbid-line" />
            정지 처리
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "320px 1fr", gap: "24px" }}>
        {/* 왼쪽: 프로필 카드 */}
        <aside>
          <article className="card">
            <div className="card-body">
            <div className="component-stack" style={{ alignItems: "center", textAlign: "center" }}>
              <div
                className="avatar"
                style={{ width: 72, height: 72, fontSize: 28, margin: "0 auto" }}
              >
                {DETAIL.initial}
              </div>
              <div>
                <h2 className="section-title" style={{ marginBottom: 4 }}>{DETAIL.name}</h2>
                <p style={{ color: "var(--gray-500)", fontSize: 14 }}>{DETAIL.email}</p>
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                <span className={`badge ${ADMIN_GRADE_BADGE[DETAIL.adminGrade]}`}>{DETAIL.adminGrade}</span>
                <span className={`badge ${STATUS_BADGE[DETAIL.status]}`}>{DETAIL.status}</span>
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--gray-200)", margin: "12px 0" }} />

            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: 14 }}>
              <dt style={{ color: "var(--gray-500)" }}>담당 영역</dt>
              <dd>{DETAIL.assignedArea}</dd>
              <dt style={{ color: "var(--gray-500)" }}>등록일</dt>
              <dd>{DETAIL.joinedAt}</dd>
              <dt style={{ color: "var(--gray-500)" }}>최근 로그인</dt>
              <dd>{DETAIL.lastLogin}</dd>
            </dl>

            {DETAIL.memo && (
              <>
                <hr style={{ border: "none", borderTop: "1px solid var(--gray-200)", margin: "12px 0" }} />
                <div>
                  <p style={{ fontSize: 13, color: "var(--gray-500)", marginBottom: 4 }}>메모</p>
                  <p style={{ fontSize: 14 }}>{DETAIL.memo}</p>
                </div>
              </>
            )}
            </div>
          </article>
        </aside>

        {/* 오른쪽: 처리 이력 (항목 클릭 시 상세 모달) */}
        <div className="component-stack">
          <AdminHistoryLog entries={HISTORY} />
        </div>
      </div>

      {/* ===== 오버레이 영역 ===== */}
      <div className="overlay" />

      {/* 등급 변경 모달 */}
      <section className="modal" id="adminGradeChange" role="dialog" aria-modal="true" aria-labelledby="adminGradeChangeTitle">
        <div className="modal-header">
          <div className="modal-title" id="adminGradeChangeTitle">등급 변경</div>
          <button className="icon-button close-overlay" aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="alert alert-info">
              <i className="ri-information-line" />
              <div>현재 등급: <strong>{DETAIL.adminGrade}</strong></div>
            </div>
            <div className="field">
              <span className="field-label">변경할 등급</span>
              <div className="choice-row">
                <label className="choice"><input type="radio" name="newAdminGrade" defaultChecked />운영자</label>
                <label className="choice"><input type="radio" name="newAdminGrade" />마스터</label>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="gradeChangeReason">사유</label>
              <textarea className="control" id="gradeChangeReason" placeholder="등급 변경 사유를 입력하세요" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-primary">변경하기</button>
        </div>
      </section>

      {/* 정지 처리 모달 */}
      <section className="modal" id="adminSuspend" role="dialog" aria-modal="true" aria-labelledby="adminSuspendTitle">
        <div className="modal-header">
          <div className="modal-title" id="adminSuspendTitle">관리자 정지 처리</div>
          <button className="icon-button close-overlay" aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="alert alert-danger">
              <i className="ri-alarm-warning-line" />
              <div><strong>{DETAIL.name}</strong> 관리자의 접근을 정지합니다. 이 작업은 즉시 적용됩니다.</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="suspendReason">정지 사유</label>
              <textarea className="control" id="suspendReason" placeholder="정지 사유를 입력하세요" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-danger">정지 처리</button>
        </div>
      </section>
    </AdminShell>
  );
}

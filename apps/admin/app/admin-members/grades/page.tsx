import { AdminShell } from "@/components/layout/AdminShell";

/**
 * 관리 등급 설정 페이지.
 * 마스터·운영자 등 관리자 등급을 조회하고, 새 등급 추가/편집/삭제(디자인만)를 제공한다.
 * 마스터(masterGrade)는 개발자/최고 권한으로 삭제 불가. 모든 수치는 더미.
 */

// 관리 등급 목록(더미). locked(잠금 여부)=true 이면 삭제 불가.
const GRADES = [
  {
    id: "master",
    name: "마스터",
    description: "개발자/최고 권한 — 마스터 계정으로만 모든 관리 항목에 접근할 수 있습니다.",
    memberCount: 2,
    locked: true, // 기본 등급, 삭제 불가
    badgeClass: "badge-orange",
  },
  {
    id: "operator",
    name: "운영자",
    description: "일반 운영진. 담당 영역별 접근·작성·수정·삭제 권한을 권한 설정에서 조정합니다.",
    memberCount: 7,
    locked: true, // 기본 등급, 삭제 불가(편집만 가능)
    badgeClass: "badge-blue",
  },
  {
    id: "moderator",
    name: "모더레이터",
    description: "커뮤니티 중재자. 댓글·신고 처리 권한을 보유합니다.",
    memberCount: 0,
    locked: false,
    badgeClass: "badge-cyan",
  },
] as const;

export default function AdminMembersGradesPage() {
  return (
    <AdminShell
      breadcrumb={["관리자", "관리회원 관리", "등급 설정"]}
      activeKey="admin-members"
      activeSubKey="grades"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">등급 설정</h1>
          <p className="page-description">관리자 등급을 추가·편집·삭제합니다. 마스터는 기본 등급으로 삭제할 수 없습니다.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" data-admin-open="adminGradeAdd">
            <i className="ri-add-line" />
            새 등급 추가
          </button>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: "16px" }}>
        <i className="ri-shield-keyhole-line" />
        <div>
          <strong>마스터 등급</strong>은 모든 관리 항목에 대한 전체 권한이 고정 부여됩니다.
          마스터 계정만 모든 메뉴와 기능에 접근할 수 있으며, 등급을 삭제하거나 권한을 제한할 수 없습니다.
        </div>
      </div>

      {/* 등급 목록 */}
      <section className="section">
        <div className="section-heading">
          <h2 className="section-title">등급 목록</h2>
        </div>

        <div className="component-stack">
          {GRADES.map((g) => (
            <article className="card" key={g.id}>
              <div className="card-body" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <span className={`badge ${g.badgeClass}`}>{g.name}</span>
                    {g.locked && (
                      <span className="badge badge-gray" style={{ fontSize: 11 }}>
                        <i className="ri-lock-line" style={{ marginRight: 2 }} />
                        기본 등급
                      </span>
                    )}
                    <span style={{ fontSize: 13, color: "var(--gray-500)" }}>
                      소속 관리자 {g.memberCount}명
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--gray-500)" }}>{g.description}</p>
                </div>

                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    data-admin-open={`adminGradeEdit-${g.id}`}
                    disabled={g.id === "master"}
                    aria-label={`${g.name} 편집`}
                  >
                    <i className="ri-pencil-line" />
                    편집
                  </button>
                  {!g.locked && (
                    <button
                      className="btn btn-danger btn-sm"
                      data-admin-open={`adminGradeDelete-${g.id}`}
                      aria-label={`${g.name} 삭제`}
                    >
                      <i className="ri-delete-bin-line" />
                      삭제
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ===== 오버레이 영역 ===== */}
      <div className="overlay" />

      {/* 새 등급 추가 모달 */}
      <section className="modal" id="adminGradeAdd" role="dialog" aria-modal="true" aria-labelledby="adminGradeAddTitle">
        <div className="modal-header">
          <div className="modal-title" id="adminGradeAddTitle">새 등급 추가</div>
          <button className="icon-button close-overlay" aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="field">
              <label className="field-label" htmlFor="newGradeName">등급명</label>
              <input className="control" id="newGradeName" type="text" placeholder="예: 모더레이터, 서포터 등" />
              <div className="field-help">다른 등급과 중복되지 않는 이름을 사용하세요.</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="newGradeDesc">설명</label>
              <textarea
                className="control"
                id="newGradeDesc"
                placeholder="이 등급의 역할과 책임을 설명하세요"
                rows={3}
              />
            </div>
            <div className="alert alert-info">
              <i className="ri-information-line" />
              <div>새 등급의 세부 권한은 생성 후 <strong>권한 설정</strong> 페이지에서 조정할 수 있습니다.</div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-primary">추가하기</button>
        </div>
      </section>

      {/* 등급 편집 모달(운영자 예시) */}
      <section className="modal" id="adminGradeEdit-operator" role="dialog" aria-modal="true" aria-labelledby="adminGradeEditTitle">
        <div className="modal-header">
          <div className="modal-title" id="adminGradeEditTitle">등급 편집 — 운영자</div>
          <button className="icon-button close-overlay" aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="field">
              <label className="field-label" htmlFor="editGradeName">등급명</label>
              <input className="control" id="editGradeName" type="text" defaultValue="운영자" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="editGradeDesc">설명</label>
              <textarea
                className="control"
                id="editGradeDesc"
                defaultValue="일반 운영진. 담당 영역별 접근·작성·수정·삭제 권한을 권한 설정에서 조정합니다."
                rows={3}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-primary">저장하기</button>
        </div>
      </section>

      {/* 등급 삭제 확인 모달(모더레이터 예시) */}
      <section className="modal" id="adminGradeDelete-moderator" role="dialog" aria-modal="true" aria-labelledby="adminGradeDeleteTitle">
        <div className="modal-header">
          <div className="modal-title" id="adminGradeDeleteTitle">등급 삭제</div>
          <button className="icon-button close-overlay" aria-label="닫기"><i className="ri-close-line" /></button>
        </div>
        <div className="modal-body">
          <div className="component-stack">
            <div className="alert alert-danger">
              <i className="ri-alarm-warning-line" />
              <div>
                <strong>모더레이터</strong> 등급을 삭제합니다.
                이 등급에 소속된 관리자가 있으면 삭제할 수 없습니다.
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline close-overlay">취소</button>
          <button className="btn btn-danger">삭제하기</button>
        </div>
      </section>
    </AdminShell>
  );
}

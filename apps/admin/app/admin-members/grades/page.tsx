import { AdminShell } from "@/components/layout/AdminShell";
import { getAdminSession } from "@/lib/adminSession";
import { PermissionDenied } from "@/components/ui/PermissionDenied";

/**
 * 관리 등급 설정 페이지 (Story 9.4 AC#7).
 * staff/super_admin 역할 정의를 정적으로 렌더 (DB 쿼리 없음).
 * super_admin만 접근 가능.
 */

// 관리 등급 목록 — DB 쿼리 없이 정적 상수로 렌더링.
// locked=true 이면 기본 등급(삭제 불가).
const GRADES = [
  {
    id: "super_admin",
    name: "마스터",
    description: "최고 관리자. 모든 관리 항목에 대한 전체 권한이 고정 부여됩니다. 다른 관리자 계정 승인·역할 변경·사이트 설정 등 모든 기능에 접근 가능합니다.",
    locked: true,
    badgeClass: "badge-orange",
    permissions: [
      "게시글 중재(숨김·삭제)",
      "신고 처리",
      "회원 제재",
      "관리자 승인·역할 변경",
      "사이트 설정",
      "광고 관리",
      "콘텐츠 삭제",
    ],
  },
  {
    id: "staff",
    name: "운영자",
    description: "일반 운영진. 게시글 중재, 신고 처리, 회원 제재 권한을 보유합니다. 관리자 계정 관리·사이트 설정은 접근할 수 없습니다.",
    locked: true,
    badgeClass: "badge-blue",
    permissions: [
      "게시글 중재(숨김)",
      "신고 처리",
      "회원 제재",
    ],
  },
] as const;

export default async function AdminMembersGradesPage() {
  const session = await getAdminSession();

  if (session?.role !== "super_admin") {
    return (
      <AdminShell
        breadcrumb={["관리자", "관리회원 관리", "등급 설정"]}
        activeKey="admin-members"
        activeSubKey="grades"
        adminUser={session}
      >
        <PermissionDenied />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      breadcrumb={["관리자", "관리회원 관리", "등급 설정"]}
      activeKey="admin-members"
      activeSubKey="grades"
      adminUser={session}
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">등급 설정</h1>
          <p className="page-description">관리자 등급(역할)과 각 등급에 고정 부여되는 권한을 확인합니다.</p>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: "16px" }}>
        <i className="ri-shield-keyhole-line" />
        <div>
          <strong>마스터(super_admin)</strong> 등급은 모든 관리 항목에 대한 전체 권한이 고정 부여됩니다.
          등급은 시스템에서 <code>staff</code>와 <code>super_admin</code> 두 가지만 지원하며,
          각 관리자의 역할은 관리회원 목록에서 변경할 수 있습니다.
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
              <div className="card-body" style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <span className={`badge ${g.badgeClass}`}>{g.name}</span>
                    <span className="badge badge-gray" style={{ fontSize: 11 }}>
                      <i className="ri-lock-line" style={{ marginRight: 2 }} />
                      기본 등급
                    </span>
                    <code style={{ fontSize: 12, color: "var(--gray-500)", background: "var(--gray-100)", padding: "2px 6px", borderRadius: 4 }}>
                      {g.id}
                    </code>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--gray-600)", marginBottom: 12 }}>{g.description}</p>

                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>포함된 권한</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {g.permissions.map((perm) => (
                        <span
                          key={perm}
                          style={{
                            fontSize: 12,
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: "var(--gray-100)",
                            color: "var(--gray-700)",
                          }}
                        >
                          <i className="ri-check-line" style={{ marginRight: 4, color: "var(--success-500)" }} />
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}

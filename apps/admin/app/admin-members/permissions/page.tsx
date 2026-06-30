import { AdminShell } from "@/components/layout/AdminShell";
import { getAdminSession } from "@/lib/adminSession";
import { PermissionDenied } from "@/components/ui/PermissionDenied";
import { PermissionsMatrix } from "./PermissionsMatrix";

/**
 * 권한 설정 페이지 (Story 9.4 AC#8).
 *
 * - 서버 컴포넌트: super_admin 접근 체크 + AdminShell 래핑.
 * - 실제 매트릭스는 PermissionsMatrix(클라이언트)에서 렌더.
 * - hasAdminPermission 정적 권한맵 기반 읽기 전용 체크박스 그리드.
 * - super_admin 전용 (AC#8).
 */

export default async function AdminMembersPermissionsPage() {
  const session = await getAdminSession();

  if (!session || session.role !== "super_admin") {
    return (
      <AdminShell
        breadcrumb={["관리자", "관리회원 관리", "권한 설정"]}
        activeKey="admin-members"
        activeSubKey="permissions"
        adminUser={session}
      >
        <PermissionDenied />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      breadcrumb={["관리자", "관리회원 관리", "권한 설정"]}
      activeKey="admin-members"
      activeSubKey="permissions"
      adminUser={session}
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">권한 설정</h1>
          <p className="page-description">
            각 역할의 관리 액션별 권한을 토글하여 DB에 저장할 수 있습니다.
            마스터(super_admin)는 모든 권한을 항상 보유하며 변경할 수 없습니다.
            커스텀 역할을 추가하면 이 매트릭스에 자동으로 컬럼이 추가됩니다.
          </p>
        </div>
      </div>

      <PermissionsMatrix />
    </AdminShell>
  );
}

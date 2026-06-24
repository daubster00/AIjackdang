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
            각 관리 액션에 대한 역할별 권한을 확인합니다.
            권한은 시스템에 고정 정의되어 있으며 변경할 수 없습니다.
          </p>
        </div>
      </div>

      <PermissionsMatrix />
    </AdminShell>
  );
}

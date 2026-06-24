import { Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { getAdminSession } from "@/lib/adminSession";
import { PermissionDenied } from "@/components/ui/PermissionDenied";
import { AdminMembersClient } from "./AdminMembersClient";

/**
 * 관리회원 관리 목록 페이지 (Story 9.4).
 * 서버 컴포넌트: super_admin 권한 체크 + AdminShell 래핑.
 * 실제 목록/모달/필터/API 호출은 AdminMembersClient(클라이언트)에서 처리.
 * super_admin 전용 (AC#1, #6).
 */

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
      <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "var(--gray-400)" }}>불러오는 중…</div>}>
        <AdminMembersClient adminUser={session} />
      </Suspense>
    </AdminShell>
  );
}

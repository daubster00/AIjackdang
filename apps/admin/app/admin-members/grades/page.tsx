import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { getAdminSession } from "@/lib/adminSession";
import { PermissionDenied } from "@/components/ui/PermissionDenied";
import { RolesManager } from "./RolesManager";

/**
 * 관리자 역할 설정 페이지 (Story 9.4 AC#7).
 * super_admin만 접근 가능. 역할 목록을 API에서 동적으로 불러와 CRUD를 제공한다.
 *
 * ⚠️ 이 페이지는 "관리자 계정의 역할(role)" 관리 전용이다.
 * 일반 회원의 등급(레벨/랭크) 관리는 /ranks 페이지에서 수행한다.
 */

export default async function AdminMembersGradesPage() {
  const session = await getAdminSession();

  if (session?.role !== "super_admin") {
    return (
      <AdminShell
        breadcrumb={["관리자", "관리회원 관리", "관리자 역할"]}
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
      breadcrumb={["관리자", "관리회원 관리", "관리자 역할"]}
      activeKey="admin-members"
      activeSubKey="grades"
      adminUser={session}
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">관리자 역할</h1>
          <p className="page-description">
            관리자 계정에 부여되는 역할(role)을 추가·수정·삭제하고 각 역할의 권한을 관리합니다.
          </p>
        </div>
      </div>

      {/* 회원 등급 관리 안내 — 사용자 혼동 방지 */}
      <div className="alert alert-warning" style={{ marginBottom: "16px" }}>
        <i className="ri-information-line" />
        <div style={{ flex: 1 }}>
          <strong>일반 회원 등급(랭크) 관리를 찾고 계신가요?</strong>
          <br />
          이 페이지는 <strong>관리자 계정의 역할(마스터/운영자 등)</strong>만 다룹니다.
          새내기·정회원·실전가·전문가·마스터 등{" "}
          <strong>일반 회원 등급 추가·수정·삭제</strong>는 아래 버튼을 눌러 이동하세요.
        </div>
        <Link
          href="/ranks"
          className="btn btn-primary btn-sm"
          style={{ whiteSpace: "nowrap", alignSelf: "center" }}
        >
          <i className="ri-medal-line" />
          회원 등급 관리
        </Link>
      </div>

      {/* 관리자 역할 안내 */}
      <div className="alert alert-info" style={{ marginBottom: "16px" }}>
        <i className="ri-shield-keyhole-line" />
        <div>
          <strong>마스터(super_admin)</strong>와 <strong>운영자(staff)</strong>는 시스템 기본
          역할로 삭제·키 변경이 불가합니다.
          그 외에 커스텀 역할을 자유롭게 추가하고, 권한 설정 페이지에서 역할별 액션
          권한을 세밀하게 조정할 수 있습니다.
          각 관리자의 역할 배정은 관리회원 목록에서 변경할 수 있습니다.
        </div>
      </div>

      {/* 역할 CRUD — 클라이언트 컴포넌트 */}
      <RolesManager />
    </AdminShell>
  );
}

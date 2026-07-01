import { AdminShell } from "@/components/layout/AdminShell";
import { SettingsTabPanels } from "./_components/SettingsTabPanels";
import { getAdminSession } from "@/lib/adminSession";
import { PermissionDenied } from "@/components/ui/PermissionDenied";

/**
 * 사이트 설정 — Story 9.15.
 *
 * super_admin 전용. staff 접근 시 PermissionDenied.
 * 실제 설정값은 SettingsTabPanels(client) 가 GET /api/v1/admin/settings 로 로드하고
 * 탭별 저장 버튼 → PATCH /api/v1/admin/settings 로 저장한다.
 *
 * 탭 전환: .line-tabs JS 는 active 클래스 토글 + 'admin:tab-change' 이벤트만 담당한다.
 * SettingsTabPanels 내부에서 이벤트를 수신해 data-tab-panel 패널 표시를 토글한다.
 */

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (session?.role !== "super_admin") {
    return (
      <AdminShell breadcrumb={["관리자", "사이트 설정"]} activeKey="settings" adminUser={session}>
        <PermissionDenied />
      </AdminShell>
    );
  }
  return (
    <AdminShell breadcrumb={["관리자", "사이트 설정"]} activeKey="settings" adminUser={session}>
      <div className="page-header">
        <div>
          <h1 className="page-title">사이트 설정</h1>
          <p className="page-description">AI작당 사이트 운영에 필요한 기본 정책을 관리합니다.</p>
        </div>
      </div>

      <article className="card">
        {/* 4개 설정 그룹 탭 */}
        <div className="line-tabs" role="tablist" aria-label="설정 그룹">
          <button className="line-tab active" data-tab="basic">기본 설정</button>
          <button className="line-tab" data-tab="business">사업자 정보</button>
          <button className="line-tab" data-tab="content">콘텐츠 설정</button>
          <button className="line-tab" data-tab="file">파일 설정</button>
          <button className="line-tab" data-tab="report">신고 설정</button>
        </div>

        <div className="card-body component-stack">
          {/*
           * SettingsTabPanels:
           * - GET /api/v1/admin/settings 에서 실제 DB 값을 로드해 각 패널 필드를 채운다.
           * - 탭별 저장 버튼 → PATCH /api/v1/admin/settings → 성공/실패 토스트.
           * - admin:tab-change 이벤트를 수신해 data-tab-panel 패널 show/hide 토글.
           */}
          <SettingsTabPanels />
        </div>
      </article>
    </AdminShell>
  );
}

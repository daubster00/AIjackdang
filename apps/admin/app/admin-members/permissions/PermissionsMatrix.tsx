"use client";

/**
 * 권한 매트릭스 클라이언트 컴포넌트 (Story 9.4 AC#8).
 * hasAdminPermission 기반 읽기 전용 체크박스 그리드.
 */

import { hasAdminPermission } from "@ai-jakdang/auth";
import type { AdminAction, AdminRole } from "@ai-jakdang/auth";

// 표시할 AdminAction 목록 (packages/auth/src/permissions.ts 기준)
const ADMIN_ACTIONS: { key: AdminAction; label: string; description: string }[] = [
  { key: "content:hide",       label: "콘텐츠 숨김",    description: "게시글·댓글을 숨김 처리" },
  { key: "content:delete",     label: "콘텐츠 삭제",    description: "게시글·댓글을 영구 삭제" },
  { key: "report:process",     label: "신고 처리",      description: "신고 내역 확인 및 처리" },
  { key: "member:sanction",    label: "회원 제재",      description: "회원 정지·이용 제한 처리" },
  { key: "member:role-change", label: "역할 변경",      description: "관리자 역할(등급) 변경" },
  { key: "site:settings",      label: "사이트 설정",    description: "전체 사이트 설정 관리" },
  { key: "ads:manage",         label: "광고 관리",      description: "광고 배너·설정 관리" },
  { key: "admin:approve",      label: "관리자 승인",    description: "신규 관리자 계정 승인·반려" },
];

// 비교할 역할 목록
const ROLES: { key: AdminRole; label: string; badgeClass: string }[] = [
  { key: "staff",       label: "운영자 (staff)",       badgeClass: "badge-blue" },
  { key: "super_admin", label: "마스터 (super_admin)", badgeClass: "badge-orange" },
];

export function PermissionsMatrix() {
  return (
    <>
      {/* 마스터 고정 안내 */}
      <div className="alert alert-info" style={{ marginBottom: "16px" }}>
        <i className="ri-shield-keyhole-line" />
        <div>
          권한은 <strong>코드 수준(permissions.ts)</strong>에서 고정 정의됩니다.
          <strong>마스터(super_admin)</strong>는 모든 액션에 대한 권한을 보유하며,
          <strong>운영자(staff)</strong>는 콘텐츠 중재·신고·회원 제재만 수행할 수 있습니다.
        </div>
      </div>

      <section className="section">
        <article className="card">
          {/* 권한 매트릭스 테이블 */}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>관리 액션</th>
                  <th style={{ fontSize: 12, color: "var(--gray-500)" }}>설명</th>
                  {ROLES.map((r) => (
                    <th key={r.key} style={{ width: 160, textAlign: "center" }}>
                      <span className={`badge ${r.badgeClass}`}>{r.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ADMIN_ACTIONS.map((action) => (
                  <tr key={action.key}>
                    <td>
                      <code style={{
                        fontSize: 12,
                        color: "var(--gray-600)",
                        background: "var(--gray-100)",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}>
                        {action.key}
                      </code>
                      <span style={{ marginLeft: 8, fontWeight: 500 }}>{action.label}</span>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--gray-500)" }}>{action.description}</td>
                    {ROLES.map((r) => {
                      const allowed = hasAdminPermission(r.key, action.key);
                      return (
                        <td key={r.key} style={{ textAlign: "center" }}>
                          <label
                            className="switch"
                            aria-label={`${action.label} — ${r.label}`}
                            title="읽기 전용 (변경 불가)"
                          >
                            <input
                              type="checkbox"
                              checked={allowed}
                              disabled
                              readOnly
                            />
                            <span className="switch-track" />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            padding: "16px 18px",
            borderTop: "1px solid var(--gray-200)",
            fontSize: 13,
            color: "var(--gray-500)",
          }}>
            <i className="ri-information-line" style={{ marginRight: 6 }} />
            권한은 시스템에 고정 정의됩니다. 역할 변경은 관리회원 목록에서 처리하세요.
          </div>
        </article>
      </section>
    </>
  );
}

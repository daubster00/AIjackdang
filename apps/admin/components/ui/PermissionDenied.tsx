import Link from "next/link";

/**
 * 권한 거부 화면.
 * super_admin 전용 페이지에 staff 등급으로 접근했을 때 표시한다.
 */
export function PermissionDenied() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
        gap: "16px",
        textAlign: "center",
      }}
    >
      <i className="ri-lock-line" style={{ fontSize: "48px", color: "var(--danger-500)" }} />
      <h2>접근 권한이 없습니다</h2>
      <p style={{ color: "var(--gray-600)" }}>이 페이지는 최고관리자만 접근할 수 있습니다.</p>
      <Link href="/dashboard" className="btn btn-primary">
        대시보드로 돌아가기
      </Link>
    </div>
  );
}

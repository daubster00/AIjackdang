/**
 * EmptyState 컴포넌트 (Story 9.5 AC#4).
 *
 * 데이터가 없을 때 표시하는 빈 상태 UI.
 * 아이콘, 메시지, 설명, 액션 버튼을 조합해 사용한다.
 */

type EmptyStateProps = {
  message?: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({
  message = "데이터가 없습니다",
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        border: "1px dashed var(--gray-300)",
        background: "var(--gray-25)",
        minHeight: "238px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        borderRadius: "8px",
        padding: "32px",
      }}
    >
      <div
        style={{
          width: "50px",
          height: "50px",
          background: "var(--gray-100)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <i
          className="ri-inbox-line"
          style={{ fontSize: "24px", color: "var(--gray-400)" }}
        />
      </div>
      <p style={{ fontWeight: 600, color: "var(--gray-700)", margin: 0 }}>{message}</p>
      {description && (
        <p style={{ color: "var(--gray-500)", fontSize: "14px", margin: 0, textAlign: "center" }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

/**
 * Skeleton 로딩 컴포넌트 (Story 9.5 AC#2).
 *
 * 데이터 로딩 중 표시하는 플레이스홀더 UI.
 * aria-hidden="true"로 스크린리더에서 숨긴다.
 */

/** 통계 카드 스켈레톤 */
export function SkeletonCard() {
  return (
    <div
      className="skeleton skeleton-card"
      aria-hidden="true"
      style={{
        height: "112px",
        borderRadius: "12px",
        background: "var(--gray-100)",
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

/** 테이블 스켈레톤 */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton skeleton-table" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-row"
          style={{
            height: "48px",
            borderRadius: "6px",
            background: "var(--gray-100)",
            marginBottom: "8px",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

/** 통계 그리드 스켈레톤 (카드 4개) */
export function SkeletonStatsGrid({ count = 4 }: { count?: number }) {
  return (
    <section
      className="grid stats-grid"
      aria-hidden="true"
      aria-label="로딩 중"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </section>
  );
}

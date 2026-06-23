/** 숫자 유틸리티 (비시각적 공유 코드) */

/** 조회수·다운로드수 등을 1.2천 / 3.4만 형태로 축약한다. */
export function formatCompactCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 10000) return `${trimZero(value / 1000)}천`;
  return `${trimZero(value / 10000)}만`;
}

function trimZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

/** value 를 [min, max] 범위로 제한한다. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 전체 항목 수와 페이지 크기로 총 페이지 수를 계산한다(최소 1). */
export function totalPages(totalItems: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

/** 문자열 유틸리티 (비시각적 공유 코드) */

/** 앞뒤 공백을 제거하고 연속 공백을 하나로 줄인다. */
export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * 게시글 제목 등을 URL 친화적인 슬러그로 변환한다.
 * 한글은 유지하고, 공백은 하이픈으로, 허용되지 않는 기호는 제거한다.
 */
export function slugify(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** maxLength 를 넘으면 말줄임표(…)를 붙여 자른다. */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** 빈 문자열·공백만 있는 문자열 여부 */
export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

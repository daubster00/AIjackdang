/** 날짜 유틸리티 (비시각적 공유 코드) */

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

/**
 * 기준 시각(now) 대비 상대 시간을 한국어로 표현한다.
 * 예: "방금 전", "3분 전", "어제", "2일 전"
 */
export function formatRelativeTime(target: Date, now: Date = new Date()): string {
  const diffSeconds = Math.floor((now.getTime() - target.getTime()) / 1000);
  if (diffSeconds < 0) return "방금 전";
  if (diffSeconds < MINUTE) return "방금 전";
  if (diffSeconds < HOUR) return `${Math.floor(diffSeconds / MINUTE)}분 전`;
  if (diffSeconds < DAY) return `${Math.floor(diffSeconds / HOUR)}시간 전`;
  const days = Math.floor(diffSeconds / DAY);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return formatDate(target);
}

/** YYYY-MM-DD 형식으로 포맷한다. */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** ISO 문자열을 Date 로 안전하게 파싱한다(실패 시 null). */
export function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

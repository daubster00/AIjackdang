/**
 * 알림의 targetType + targetId → URL 매핑 헬퍼 (Story 7.2)
 *
 * targetType 별 매핑:
 * - "post"      → null (게시글은 board+slug 정보가 추가로 필요하므로, body의 URL을 사용)
 * - "question"  → /questions/{targetId}
 * - "resource"  → /resources/{targetId}
 * - "message"   → /messages
 * - null/기타   → null (클릭 이동 없음)
 *
 * NOTE: post 타입은 board slug 없이는 URL 구성이 불가능하다.
 * 알림 body에 URL이 포함된 경우 그 값을 우선 사용하는 것을 권장한다.
 */
export function resolveNotificationUrl(
  targetType: string | null,
  targetId: string | null,
): string | null {
  if (!targetType || !targetId) return null;

  switch (targetType) {
    case "question":
      return `/questions/${targetId}`;
    case "resource":
      return `/resources/${targetId}`;
    case "message":
      return "/messages";
    case "post":
      // post는 board+slug 정보가 별도 필요. null 반환 → 상위에서 body URL 파싱 시도
      return null;
    default:
      return null;
  }
}

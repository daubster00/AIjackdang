/**
 * 알림의 targetType + targetId → URL 매핑 헬퍼 (Story 7.2)
 *
 * targetType 별 매핑:
 * - "post"      → targetId (게시글 알림은 API가 상세 상대경로 "/board/slug"를 targetId에 저장)
 * - "question"  → /questions/{targetId}
 * - "resource"  → /resources/{targetId}
 * - "message"   → /messages
 * - null/기타   → null (클릭 이동 없음)
 *
 * NOTE: post 타입은 board+slug 없이는 URL을 구성할 수 없어, 알림 발행 시점에
 * API(buildPostDetailPath)가 상세 상대경로를 만들어 targetId에 저장한다.
 * 구버전 알림(UUID가 저장된 행)은 "/"로 시작하지 않으므로 이동 링크를 띄우지 않는다.
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
    case "inquiry":
      return `/inquiries/${targetId}`;
    case "post":
      // API가 저장한 상세 상대경로("/board/slug")면 그대로 이동. 구버전 UUID는 이동 안 함.
      return targetId.startsWith("/") ? targetId : null;
    default:
      return null;
  }
}

/**
 * 콘텐츠 크로스 링크 유틸 (Story 9.9).
 *
 * 댓글·신고의 targetType + targetId 를 어드민 관리 화면 URL 로 변환한다.
 * Story 9.10(신고 관리)에서도 재사용.
 *
 * 매핑:
 *   post      → /posts/{boardSlug}/{postId}   (board 인수 없으면 /posts?highlight=:id 폴백)
 *   question  → /qna/:id
 *   answer    → /qna/:id   (answerId 기준 — QnA 스레드로 이동)
 *   resource  → /resources/:id
 *   comment   → /comments/:id
 */

import { dbBoardToAdminSlug } from "./boards";

export type ContentTargetType = "post" | "question" | "answer" | "resource" | "comment";

/**
 * targetType + targetId 를 받아 어드민 관리 화면 URL 을 반환한다.
 * - board: DB posts.board 값 (e.g. "vibe-coding-guide"). 게시글 상세 URL 구성에 필요.
 *   제공하지 않으면 게시글은 목록+하이라이트 폴백으로 이동한다.
 * 매핑이 없는 targetType 이면 null 을 반환한다.
 */
export function getCrossLink(
  targetType: ContentTargetType | string,
  targetId: string,
  board?: string | null,
): string | null {
  switch (targetType) {
    case "post":
      if (board) {
        return `/posts/${dbBoardToAdminSlug(board)}/${targetId}`;
      }
      // board 정보가 없으면 목록 페이지에서 하이라이트
      return `/posts?highlight=${targetId}`;
    case "question":
    case "answer":
      return `/qna/${targetId}`;
    case "resource":
      return `/resources/${targetId}`;
    case "comment":
      return `/comments/${targetId}`;
    default:
      return null;
  }
}

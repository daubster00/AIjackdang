/**
 * 게시글 상세 URL(상대경로) 빌더 — 알림 이동 링크용
 *
 * 게시글 상세 페이지는 board(게시판)별로 라우트가 다르다.
 * BOARDS[board].urlPath 는 목록 경로이며, 하위 게시판은 쿼리스트링(?board=...)을 갖는다.
 * 상세 베이스 경로는 그 쿼리스트링을 제거한 값과 같다.
 *   예) talk        urlPath="/lounge/talk"                → 상세 "/lounge/talk/{slug}"
 *       ai-products urlPath="/lounge/products"            → 상세 "/lounge/products/{slug}"
 *       vibe-coding-tips urlPath="/vibe-coding?board=..." → 상세 "/vibe-coding/{slug}"
 *
 * 알림(notifications.target_id)에는 이 상대경로를 저장해, 클릭 시 글로 바로 이동한다.
 */

import { BOARDS } from "@ai-jakdang/contracts";

/**
 * board + slug → 게시글 상세 상대경로. 알 수 없는 board거나 slug가 없으면 null.
 */
export function buildPostDetailPath(
  board: string | null | undefined,
  slug: string | null | undefined,
): string | null {
  if (!board || !slug) return null;
  const meta = BOARDS[board];
  if (!meta) return null;
  const base = meta.urlPath.split("?")[0];
  return `${base}/${slug}`;
}

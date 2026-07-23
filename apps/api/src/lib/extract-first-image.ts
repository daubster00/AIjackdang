/**
 * Tiptap JSON 본문에서 첫 번째 이미지 URL을 추출한다.
 *
 * Tiptap doc 노드를 재귀적으로 탐색하여
 * type === "image" 인 첫 번째 노드의 attrs.src 를 반환한다.
 * 이미지가 없으면 null 반환.
 *
 * ⭐ 유튜브 임베드(type === "youtube") 노드도 인식한다.
 *    본문에 이미지가 없더라도 유튜브 영상을 퍼온 글(작당 수다방·AI 창작마당 큐레이션)은
 *    영상의 썸네일(i.ytimg.com)을 게시글 썸네일로 잡아 목록 카드에 그림이 나오게 한다.
 *    (이미지 노드가 유튜브 노드보다 앞서면 이미지 우선 — 본문 등장 순서대로.)
 *
 * 용도: post/resource 저장 시 thumbnail_url 자동 세팅.
 * 크롭·리사이징은 웹 표시 시 CSS object-fit:cover 로 처리하며
 * sharp 등 네이티브 이미지 라이브러리를 설치하지 않는다.
 */

/** Tiptap 노드의 최소 타입 정의 */
interface TiptapNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

/**
 * Tiptap JSON doc 에서 첫 번째 이미지 URL 을 재귀 탐색으로 추출한다.
 *
 * @param contentJson - Tiptap doc 루트 객체 (Record<string, unknown> 또는 TiptapNode)
 * @returns 첫 번째 이미지 src URL, 없으면 null
 */
export function extractFirstImageUrl(contentJson: unknown): string | null {
  if (!contentJson || typeof contentJson !== "object") return null;
  return walkNode(contentJson as TiptapNode);
}

function walkNode(node: TiptapNode): string | null {
  // 현재 노드가 이미지인지 확인
  if (node.type === "image") {
    const src = node.attrs?.src;
    if (typeof src === "string" && src.trim().length > 0) {
      return src.trim();
    }
  }

  // 유튜브 임베드 → 영상 썸네일을 게시글 썸네일로 사용
  if (node.type === "youtube") {
    const src = node.attrs?.src;
    if (typeof src === "string") {
      const thumb = youtubeThumbnailUrl(src);
      if (thumb) return thumb;
    }
  }

  // 자식 노드 재귀 탐색
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const result = walkNode(child);
      if (result !== null) return result;
    }
  }

  return null;
}

/**
 * 유튜브 watch/embed/단축 URL에서 videoId를 뽑아 썸네일 이미지 URL로 변환한다.
 * 인식 실패 시 null.
 *
 * 지원 형태:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube-nocookie.com/embed/VIDEO_ID
 *   - https://m.youtube.com/watch?v=VIDEO_ID
 *   - https://www.youtube.com/shorts/VIDEO_ID
 *
 * hqdefault(480×360)는 모든 영상에 항상 존재하므로 안정적이다
 * (maxresdefault는 없는 영상이 있어 깨진 이미지가 될 수 있음).
 */
function youtubeThumbnailUrl(rawUrl: string): string | null {
  const videoId = extractYoutubeVideoId(rawUrl);
  if (!videoId) return null;
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** 유튜브 URL에서 videoId를 추출한다(형식 검증 포함). 실패 시 null. */
function extractYoutubeVideoId(rawUrl: string): string | null {
  let candidate: string | null = null;
  try {
    const u = new URL(rawUrl.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      candidate = u.pathname.slice(1).split("/")[0] ?? null;
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      candidate = u.searchParams.get("v");
      if (!candidate) {
        const m = u.pathname.match(/^\/(?:embed|v|shorts)\/([^/?#]+)/);
        candidate = m?.[1] ?? null;
      }
    }
  } catch {
    return null;
  }
  // 유튜브 videoId 형식(영숫자·_·-)만 통과 — 오탐 방지
  if (candidate && /^[A-Za-z0-9_-]{6,}$/.test(candidate)) return candidate;
  return null;
}

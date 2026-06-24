/**
 * Tiptap JSON에서 외부 URL 추출 유틸리티 — Story 8.6
 *
 * link 마크(type="link")를 재귀 순회하여 href를 수집한다.
 * text 노드 내 bare URL은 추출하지 않는다.
 * 자사 도메인(SITE_URL) 동일 hostname은 필터링한다.
 * 중복 URL은 Set으로 제거한다.
 */

interface TiptapNode {
  type?: string;
  text?: string;
  marks?: Array<{
    type: string;
    attrs?: {
      href?: string;
      [key: string]: unknown;
    };
  }>;
  content?: TiptapNode[];
  attrs?: Record<string, unknown>;
}

/**
 * Tiptap JSON을 재귀 순회하여 외부 링크 URL 목록을 반환한다.
 *
 * @param contentJson - Tiptap JSON (any depth)
 * @param siteUrl - 자사 도메인 URL (예: "https://www.ai-jakdang.com")
 * @returns 중복 제거된 외부 URL 배열
 */
export function extractExternalUrls(contentJson: unknown, siteUrl: string): string[] {
  const urls = new Set<string>();

  let siteHostname: string | null = null;
  try {
    siteHostname = new URL(siteUrl).hostname;
  } catch {
    // siteUrl 파싱 실패 시 자사 도메인 필터 없이 진행
  }

  function traverse(node: TiptapNode): void {
    // link 마크 처리
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === "link" && mark.attrs?.href) {
          const href = mark.attrs.href as string;
          try {
            const parsed = new URL(href);
            // http/https 프로토콜만 수집
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
            // 자사 도메인 필터링
            if (siteHostname && parsed.hostname === siteHostname) continue;
            urls.add(href);
          } catch {
            // 잘못된 URL 무시
          }
        }
      }
    }

    // 자식 노드 재귀
    if (node.content) {
      for (const child of node.content) {
        traverse(child);
      }
    }
  }

  if (contentJson && typeof contentJson === "object") {
    traverse(contentJson as TiptapNode);
  }

  return Array.from(urls);
}

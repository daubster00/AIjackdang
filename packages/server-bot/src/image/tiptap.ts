/**
 * Tiptap JSON 문서에 이미지 노드를 맨 앞에 삽입하는 헬퍼 (Story 11.8 AC #5).
 *
 * 삽입된 이미지 노드는 createPost() 내부의 extractFirstImageUrl()이
 * 자동으로 썸네일 URL로 추출한다.
 *
 * 썸네일 자동 처리 흐름:
 *   prependImageToTiptapDoc(doc, imageUrl)
 *     → contentJson.content[0] = { type: 'image', attrs: { src: imageUrl } }
 *     → createPost() 내부 extractFirstImageUrl(contentJson) 호출
 *     → posts.thumbnail_url = imageUrl (자동 저장)
 *
 * [Source: apps/api/src/lib/extract-first-image.ts]
 * [Source: apps/api/src/routes/v1/posts/service.ts#createPost]
 */

/**
 * Tiptap JSON doc의 content 배열 맨 앞에 이미지 노드를 삽입한다.
 *
 * ⚠️ attrs.src는 반드시 string이어야 extractFirstImageUrl()이 썸네일로 추출한다.
 *   (extractFirstImageUrl: node.type === 'image' && typeof node.attrs?.src === 'string')
 *
 * @param doc    Tiptap JSON 문서 객체
 * @param imageUrl  삽입할 이미지 URL (반드시 string)
 * @param altText   이미지 대체 텍스트 (선택)
 * @returns      맨 앞에 이미지 노드가 삽입된 새 doc 객체
 */
export function prependImageToTiptapDoc(
  doc: Record<string, unknown>,
  imageUrl: string,
  altText?: string,
): Record<string, unknown> {
  const imageNode = {
    type: "image",
    attrs: { src: imageUrl, alt: altText ?? null, title: null },
  };
  const existingContent = Array.isArray(doc.content) ? doc.content : [];
  return { ...doc, content: [imageNode, ...existingContent] };
}

/** 이미지 출처 표기 옵션. */
export interface ImageSourceCaption {
  /** 대체 텍스트. */
  alt?: string | null;
  /** 출처 라벨(예: "anthropic.com", "Unsplash"). */
  sourceLabel?: string | null;
  /** 출처 원본 페이지 URL(있으면 캡션에 함께 표기). */
  sourceUrl?: string | null;
}

/**
 * 이미지 노드 + 출처 캡션 문단을 문서 맨 앞에 삽입한다.
 *
 * 타사 이미지를 "검색해서 퍼올" 때 출처를 반드시 밝히기 위한 헬퍼.
 * 캡션은 링크 마크 없이 평문 문단으로 넣어(에디터 스키마 안전) 렌더 깨짐을 피한다.
 *
 * @param doc      Tiptap JSON 문서
 * @param imageUrl 삽입할 이미지 URL(반드시 string — 썸네일 자동 추출 대상)
 * @param caption  출처 표기 옵션
 */
export function prependImageWithSourceToTiptapDoc(
  doc: Record<string, unknown>,
  imageUrl: string,
  caption: ImageSourceCaption,
): Record<string, unknown> {
  const imageNode = {
    type: "image",
    attrs: { src: imageUrl, alt: caption.alt ?? null, title: null },
  };

  const nodes: Array<Record<string, unknown>> = [imageNode];

  const label = caption.sourceLabel?.trim();
  const url = caption.sourceUrl?.trim();
  if (label || url) {
    // "이미지 출처: anthropic.com (https://...)"
    const parts = ["이미지 출처:"];
    if (label) parts.push(label);
    if (url && url !== label) parts.push(`(${url})`);
    const captionText = parts.join(" ");
    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: captionText }],
    });
  }

  const existingContent = Array.isArray(doc.content) ? doc.content : [];
  return { ...doc, content: [...nodes, ...existingContent] };
}

// ── 인라인 마커 이미지 삽입 (가이드 강의 시리즈) ─────────────────────────────────
// 강의 글은 "맨 위 1장"이 아니라, 설명 문단 옆에 정확한 이미지가 여러 장 와야 한다.
// 생성 모델이 본문에 `[[IMG:assetKey]]`를 한 줄로 넣으면(마크다운 파서가 그 줄을
// 단독 문단으로 만든다), 그 자리를 실제 이미지 노드(+캡션)로 치환한다.

/** assetKey → 실제 자산(버킷 업로드 결과) 매핑 1건. */
export interface GuideAssetManifestEntry {
  /** 버킷에 업로드된 이미지 URL. */
  url: string;
  /** 본문 캡션(설명). */
  caption?: string | null;
  /** 대체 텍스트. */
  alt?: string | null;
  /** 출처 라벨(예: "Make 공식 도움말"). 있으면 캡션에 덧붙인다. */
  sourceLabel?: string | null;
  /** 출처 원본 페이지 URL. */
  sourceUrl?: string | null;
}

/** assetKey → 자산 매핑 전체. */
export type GuideAssetManifest = Record<string, GuideAssetManifestEntry>;

/** 문단 노드의 순수 텍스트를 이어붙여 반환(간단 추출). */
function paragraphText(node: Record<string, unknown>): string {
  if (node.type !== "paragraph" || !Array.isArray(node.content)) return "";
  return node.content
    .map((c) =>
      c && typeof c === "object" && typeof (c as { text?: unknown }).text === "string"
        ? (c as { text: string }).text
        : "",
    )
    .join("");
}

/** manifest 1건으로 이미지 노드(+캡션 문단)를 만든다. */
function buildImageNodes(
  entry: GuideAssetManifestEntry,
): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [
    {
      type: "image",
      attrs: { src: entry.url, alt: entry.alt ?? entry.caption ?? null, title: null },
    },
  ];

  const captionParts: string[] = [];
  const caption = entry.caption?.trim();
  if (caption) captionParts.push(caption);
  const label = entry.sourceLabel?.trim();
  const url = entry.sourceUrl?.trim();
  if (label) {
    captionParts.push(url ? `(출처: ${label} — ${url})` : `(출처: ${label})`);
  } else if (url) {
    captionParts.push(`(출처: ${url})`);
  }
  if (captionParts.length > 0) {
    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: captionParts.join(" ") }],
    });
  }
  return nodes;
}

/**
 * 본문 Tiptap doc의 `[[IMG:assetKey]]` 마커를 실제 이미지 노드로 치환한다.
 *
 * 마커 위치를 가리지 않는다(모델이 단독 줄로 넣지 않고 문단 끝·중간에 붙이는 경우가 잦음):
 *  - 마커가 든 문단은 텍스트를 마커 기준으로 분할해, [앞 텍스트 문단] → [이미지+캡션]
 *    → [뒤 텍스트 문단] 순으로 재구성한다(문단당 마커 여러 개도 처리).
 *  - manifest에 없는 키는 이미지 없이 건너뛴다(원시 마커가 렌더되지 않게).
 *  - 최상위 content만 순회. 분할 시 인라인 마크(볼드 등)는 평문으로 단순화된다
 *    (강의 본문 마커 주변은 대개 평문이라 실사용 영향 없음).
 *
 * @returns { doc, usedKeys } — 치환된 새 doc과 실제 사용된 assetKey 목록.
 */
export function insertInlineImagesByMarker(
  doc: Record<string, unknown>,
  manifest: GuideAssetManifest,
): { doc: Record<string, unknown>; usedKeys: string[] } {
  const content = Array.isArray(doc.content) ? doc.content : [];
  const out: Array<Record<string, unknown>> = [];
  const usedKeys: string[] = [];
  const seen = new Set<string>(); // 같은 assetKey 중복 삽입 방지(모델이 마커를 두 번 낼 때).

  for (const raw of content) {
    const node = raw as Record<string, unknown>;
    const text = paragraphText(node);

    // 마커 없는 노드(문단 포함)는 그대로 통과.
    if (node.type !== "paragraph" || !text.includes("[[IMG:")) {
      out.push(node);
      continue;
    }

    // 문단 텍스트를 마커 기준으로 분할해 순서대로 재구성.
    const re = /\[\[IMG:([a-zA-Z0-9_-]+)\]\]/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const before = text.slice(lastIndex, m.index).trim();
      if (before) {
        out.push({ type: "paragraph", content: [{ type: "text", text: before }] });
      }
      const key = m[1]!;
      const entry = manifest[key];
      if (entry?.url && !seen.has(key)) {
        out.push(...buildImageNodes(entry));
        usedKeys.push(key);
        seen.add(key);
      }
      lastIndex = m.index + m[0].length;
    }
    const tail = text.slice(lastIndex).trim();
    if (tail) {
      out.push({ type: "paragraph", content: [{ type: "text", text: tail }] });
    }
  }

  return { doc: { ...doc, content: out }, usedKeys };
}

/** 유튜브 영상 임베드 출처 옵션. */
export interface YoutubeSourceCaption {
  /** 채널·게시자명(예: "OpenAI"). */
  channel?: string | null;
  /** 원본 영상 페이지 URL. */
  sourceUrl?: string | null;
}

/**
 * 유튜브 영상 노드 + 출처 캡션을 문서 맨 앞에 삽입한다("퍼온 영상 소개"용).
 *
 * `youtube` 노드는 게시판 렌더러(tiptap-renderer.ts)가 youtube iframe으로 변환하고
 * sanitize가 youtube 도메인만 허용하므로 안전하게 임베드된다.
 * src에는 watch URL을 그대로 넣으면 확장이 임베드 URL로 자동 변환한다.
 *
 * @param doc         Tiptap JSON 문서
 * @param youtubeUrl  유튜브 watch URL
 * @param caption     출처 표기 옵션(채널·원본 링크)
 */
export function prependYoutubeToTiptapDoc(
  doc: Record<string, unknown>,
  youtubeUrl: string,
  caption: YoutubeSourceCaption = {},
): Record<string, unknown> {
  const youtubeNode = {
    type: "youtube",
    attrs: { src: youtubeUrl, start: 0 },
  };

  const nodes: Array<Record<string, unknown>> = [youtubeNode];

  const channel = caption.channel?.trim();
  const url = caption.sourceUrl?.trim();
  if (channel || url) {
    const parts = ["영상 출처:"];
    if (channel) parts.push(channel);
    if (url) parts.push(`(${url})`);
    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: parts.join(" ") }],
    });
  }

  const existingContent = Array.isArray(doc.content) ? doc.content : [];
  return { ...doc, content: [...nodes, ...existingContent] };
}

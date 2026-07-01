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

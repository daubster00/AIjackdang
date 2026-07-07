/**
 * 에디터 노드 화이트리스트 (AR-8, FR-2.5).
 *
 * 이 상수는 서버(sanitize-html)와 클라이언트(Tiptap) 양쪽이 공유하는
 * 단일 진실 공급원(Single Source of Truth)이다.
 * - 클라이언트: apps/web/features/editor/ 가 이 목록으로 허용 익스텐션을 결정한다.
 * - 서버: apps/api 의 sanitize-html 빌더(Story 2.6에서 추가)가
 *   buildSanitizeOptions() 를 통해 이 목록을 HTML 화이트리스트로 변환한다.
 *
 * 표·복잡 레이아웃·자유 글자크기·자유 색상은 포함하지 않는다.
 */

/** 허용 노드 타입 하나를 표현하는 타입. */
export type AllowedNode = {
  /** ProseMirror/Tiptap 노드·마크 이름. */
  type: string;
  /** 허용하는 속성 이름 목록. 빈 배열 또는 미지정이면 속성 없이 허용. */
  attrs?: string[];
};

/**
 * full preset 에서 허용하는 노드·마크 목록.
 * 굵게·H2/H3·목록·링크·이미지·코드블록·인용·제한색상·형광펜 포함.
 * 표·자유 글자크기·자유 색상 미포함.
 */
export const FULL_ALLOWED_NODES: AllowedNode[] = [
  { type: "doc" },
  // 문단/제목에 좌·가운데·우 정렬(textAlign) 허용 — text-align style 로 렌더됨
  { type: "paragraph", attrs: ["textAlign"] },
  // 캡션(이미지 설명·출처 등) — <p class="caption"> 시맨틱 문단. class 허용은 sanitize.ts.
  { type: "caption" },
  { type: "text" },
  { type: "hardBreak" },
  // 인라인 서식
  { type: "bold" },
  { type: "italic" },
  // 제목 (H2, H3만 허용 — H1·H4 이하 제외)
  { type: "heading", attrs: ["level", "textAlign"] },
  // 목록
  { type: "bulletList" },
  { type: "orderedList" },
  { type: "listItem" },
  // 링크
  { type: "link", attrs: ["href", "target", "rel"] },
  // 이미지 — alt 필수 강제는 에디터 레벨(EditorToolbar)에서 처리
  { type: "image", attrs: ["src", "alt", "title"] },
  // 코드 (lowlight 하이라이팅은 Story 2.6에서 추가)
  { type: "codeBlock", attrs: ["language"] },
  { type: "code" },
  // 인용
  { type: "blockquote" },
  // 색상·글자크기 — textStyle 확장이 두 속성을 함께 처리한다
  { type: "textStyle", attrs: ["color", "fontSize"] },
  { type: "color" },
  // 형광펜 — 버튼은 제거됐으나 기존 콘텐츠 렌더 위해 화이트리스트는 유지
  { type: "highlight", attrs: ["color"] },
  // 동영상 — YouTube 임베드 (iframe). src 호스트는 서버 sanitize 에서 youtube 도메인만 허용.
  { type: "youtube", attrs: ["src", "start", "width", "height"] },
];

/**
 * lite preset 에서 허용하는 노드·마크 목록.
 * 짧은 본문(답변·댓글)용으로 단순 구조만 허용한다.
 */
export const LITE_ALLOWED_NODES: AllowedNode[] = [
  { type: "doc" },
  { type: "paragraph" },
  { type: "text" },
  { type: "hardBreak" },
  // 링크
  { type: "link", attrs: ["href", "target", "rel"] },
  // 이미지 — alt 필수 강제는 에디터 레벨에서 처리
  { type: "image", attrs: ["src", "alt", "title"] },
  // 코드블록
  { type: "codeBlock", attrs: ["language"] },
  { type: "code" },
];

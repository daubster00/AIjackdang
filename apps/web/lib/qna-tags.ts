/**
 * 대메뉴(또는 하위메뉴) → Q&A 자동 부착 태그 매핑 테이블 — Story 3.4
 *
 * 각 대메뉴에서 [질문하기] 버튼 클릭 시 /questions/write?tags=<slug> 형태로
 * 쿼리 파라미터를 전달하고, 작성 페이지에서 이 값을 초기 태그로 prefill한다.
 * 태그 값은 kebab-case 소문자로 통일하며, createQuestionSchema.tags 배열과 호환된다.
 */

export const QNA_AUTO_TAG_MAP: Record<string, string[]> = {
  /** 바이브 코딩 대메뉴 */
  "vibe-coding": ["vibe-coding"],

  /** AI 자동화 대메뉴 */
  automation: ["automation"],

  /** AI 수익화 대메뉴 */
  monetize: ["monetization"],

  /** 작당 라운지 대메뉴 (AI 창작마당) */
  lounge: ["ai-creation"],

  /** 작당 라운지 → 내가 만든 AI 제품 */
  "lounge/products": ["ai-product"],

  /** 작당 라운지 → 작당 수다방 */
  "lounge/talk": ["lounge-talk"],

  /** 작당 라운지 → 작당 의뢰소 */
  "lounge/gigs": ["lounge-gig"],
};

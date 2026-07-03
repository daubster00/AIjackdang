/**
 * 이미지 전략 결정 (Story 11.8 AC #3).
 *
 * decideImageStrategy(persona, board, postKind) → ImageStrategy
 * 아래 우선순위를 순서대로 적용한다.
 *
 * 우선순위 표:
 * 1. board === 'ai-creation'                        → 'ai'
 * 2. persona.is_admin_persona === true              → 'ai'
 * 3. postKind === 'qna' | 'comment' | 'reply'     → 'none'
 * 4. persona.info_ratio < 20 (너무 짧은 잡담)        → 'none'
 * 5. persona.nickname === '냉장고털이' (밈 특화)      → 'meme'
 * 6. persona.info_ratio < 15 && board === 'talk'   → 'meme'
 * 7. persona.info_ratio >= 30 (정보형 글)            → preferWeb면 'web'(검색 이미지+출처), 아니면 'stock'
 * 8. 기본값                                         → 'none'
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md#6-이미지-엔진]
 */

/** 페르소나 컨텍스트 (이미지 전략 판단에 필요한 필드). */
export interface PersonaContext {
  /** 화면 닉네임 (예: 냉장고털이). */
  nickname: string;
  /** 관리자 캐릭터(AI작당지기) 여부. */
  is_admin_persona: boolean;
  /** 정보형 vs 잡담형 비율 (0~100). */
  info_ratio: number;
}

/** 이미지 조달 전략. */
export type ImageStrategy = "stock" | "ai" | "none" | "meme" | "web";

/** 글 종류. */
export type PostKind = "post" | "qna" | "comment" | "reply";

/** decideImageStrategy 추가 옵션. */
export interface ImageStrategyOptions {
  /**
   * true면 정보형 글에서 스톡 대신 '웹 검색 이미지(출처 표기)'를 우선한다.
   * 검색 주도 발굴로 실제 다룰 소재(제품/기능)가 있을 때 파이프라인이 켠다.
   */
  preferWeb?: boolean;
}

/**
 * 페르소나·게시판·글 종류를 바탕으로 이미지 조달 전략을 결정한다.
 * 규칙은 반드시 아래 순서대로 적용한다 (첫 매치 즉시 반환).
 */
export function decideImageStrategy(
  persona: PersonaContext,
  board: string,
  postKind: PostKind,
  opts?: ImageStrategyOptions,
): ImageStrategy {
  // 1. AI 창작마당 → 무조건 AI 생성
  if (board === "ai-creation") return "ai";

  // 2. 관리자 페르소나 → 고품질 AI 생성 (가이드 표지·도식)
  if (persona.is_admin_persona) return "ai";

  // 3. 댓글·질문·답글 → 이미지 불자연스러움
  if (
    postKind === "qna" ||
    postKind === "comment" ||
    postKind === "reply"
  ) {
    return "none";
  }

  // 4. 너무 짧은 잡담 → 이미지 없는 게 자연스러움
  if (persona.info_ratio < 20) return "none";

  // 5. 밈 특화 캐릭터
  if (persona.nickname === "냉장고털이") return "meme";

  // 6. 짧은 잡담 + 토크 게시판
  if (persona.info_ratio < 15 && board === "talk") return "meme";

  // 7. 정보형 글 → 실제 소재가 있으면 웹 검색 이미지(출처 표기), 아니면 무료 스톡
  if (persona.info_ratio >= 30) return opts?.preferWeb ? "web" : "stock";

  // 8. 기본값 (잡담형·짧은 후기 등)
  return "none";
}

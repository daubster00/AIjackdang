/**
 * reaction-randomizer — Story 11.10
 *
 * 댓글 생성 잡의 랜덤 파라미터 결정 순수 함수.
 *
 *  - randomReactionType(): 5종 반응 종류 중 균등 확률 랜덤 선택
 *  - randomDelayMs(): 즉답 금지(5분~4시간), 드물게 일 단위
 *  - shouldSkipComment(): 30% 확률로 댓글 건너뜀 (댓글 0 게시글 자연스럽게 유지)
 *
 * 순수 함수만 — DB·네트워크·env 접근 금지.
 * [Source: docs/seeding-bot/EPICS-AND-STORIES.md Story 11.10 AC#1]
 */

import type { ReactionType } from "./context-types";

/** 5종 반응 종류 배열 (균등 확률 선택 기반). */
const REACTION_TYPES: ReactionType[] = [
  "agreement",
  "question",
  "rebuttal",
  "humor",
  "reaction",
];

/**
 * 댓글 건너뜀 기본 확률 (30%).
 * 향후 bot_settings.bot_comment_skip_probability 키로 운영 중 조정 가능.
 * 이 스토리에서는 상수 처리.
 */
const COMMENT_SKIP_PROBABILITY = 0.3;

/** 5분 (밀리초) — 즉답 금지 하한 */
const MIN_DELAY_MS = 5 * 60 * 1000; // 300_000 ms

/** 4시간 (밀리초) — 기본 지연 상한 */
const MAX_DELAY_MS = 4 * 60 * 60 * 1000; // 14_400_000 ms

/** 12시간 (밀리초) — 일 단위 하한 */
const DAY_UNIT_MIN_MS = 12 * 60 * 60 * 1000; // 43_200_000 ms

/** 36시간 (밀리초) — 일 단위 상한 */
const DAY_UNIT_MAX_MS = 36 * 60 * 60 * 1000; // 129_600_000 ms

/** 일 단위 발생 확률 (10%) */
const DAY_UNIT_PROBABILITY = 0.1;

/**
 * 5종 반응 종류 중 균등 확률로 하나를 선택한다.
 *
 * @returns `ReactionType` — 'agreement' | 'question' | 'rebuttal' | 'humor' | 'reaction'
 */
export function randomReactionType(): ReactionType {
  const index = Math.floor(Math.random() * REACTION_TYPES.length);
  return REACTION_TYPES[index]!;
}

/**
 * 랜덤 지연 시간(밀리초)을 반환한다.
 *
 * - 기본: 5분(300,000ms) ~ 4시간(14,400,000ms) 균등 랜덤.
 * - `allowDayUnit=true` 이면 10% 확률로 12~36시간 범위에서 선택.
 * - 즉답(1분 미만) 절대 금지.
 *
 * @param opts.allowDayUnit - true 이면 드물게 일 단위 지연 허용 (기본 false)
 * @returns 밀리초 단위 지연 시간
 */
export function randomDelayMs(opts?: { allowDayUnit?: boolean }): number {
  // 10% 확률로 일 단위 지연 (allowDayUnit=true 인 경우만)
  if (opts?.allowDayUnit && Math.random() < DAY_UNIT_PROBABILITY) {
    return (
      DAY_UNIT_MIN_MS + Math.floor(Math.random() * (DAY_UNIT_MAX_MS - DAY_UNIT_MIN_MS))
    );
  }

  // 기본: 5분 ~ 4시간
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

/**
 * 이 게시글에 댓글을 달지 않을지 확률적으로 결정한다.
 *
 * - 기본 30% 확률로 `true` (댓글 달지 않음).
 * - `probability` 파라미터로 확률 조정 가능.
 * - 댓글 0 게시글이 자연스럽게 유지되도록 설계.
 *
 * @param probability - 건너뜀 확률 (0~1, 기본 0.30)
 * @returns true이면 댓글 건너뜀
 */
export function shouldSkipComment(probability = COMMENT_SKIP_PROBABILITY): boolean {
  return Math.random() < probability;
}

/** 묻고답하기 도메인 규칙 (비시각적 공유 코드) */

/** 질문 상태. 디자인 시스템의 상태 배지(답변대기/답변있음/해결됨)와 연결된다. */
export type QuestionStatus = "waiting" | "answered" | "resolved";

export interface QuestionState {
  /** 등록된 답변 수 */
  answerCount: number;
  /** 질문자가 채택한 답변 ID (없으면 null) */
  acceptedAnswerId: string | null;
}

/**
 * 질문의 현재 상태를 도출한다.
 * - 채택된 답변이 있으면 "해결됨"
 * - 답변이 하나 이상이면 "답변있음"
 * - 그 외에는 "답변대기"
 *
 * @important 호출자 책임:
 *   `answerCount` 는 **공개(published) 상태인 답변만** 카운트한 값을 전달해야 한다.
 *   삭제(deleted) 또는 숨김(hidden) 처리된 답변은 카운트에서 제외한 뒤 호출한다.
 *   이 함수는 카운트 필터링을 직접 수행하지 않는다.
 *
 * @example DB 쿼리 측 예시
 *   const answerCount = answers.filter(a => a.status === 'published').length;
 *   const status = deriveQuestionStatus({ answerCount, acceptedAnswerId });
 */
export function deriveQuestionStatus(state: QuestionState): QuestionStatus {
  if (state.acceptedAnswerId !== null) return "resolved";
  if (state.answerCount > 0) return "answered";
  return "waiting";
}

/** 상태별 한국어 라벨. UI 배지 텍스트로 사용한다. */
export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  waiting: "답변대기",
  answered: "답변있음",
  resolved: "해결됨",
};

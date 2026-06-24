/**
 * moderation — Story 9.10 신고 처리 판단 순수 함수.
 *
 * 의존성 없음(순수 함수). 단위 테스트(moderation.test.ts)에서 검증.
 */

/**
 * 신고 누적 수(reportCount)와 임계치(threshold)를 받아
 * 자동 숨김 여부를 반환한다.
 *
 * - threshold <= 0 : 자동 숨김 미설정 → 항상 queue_only
 * - reportCount >= threshold : auto_hide (임계치 초과·도달)
 * - reportCount < threshold  : queue_only (아직 임계치 미달)
 *
 * @param reportCount 현재 신고 누적 건수
 * @param threshold   자동 숨김 발동 임계치 (site_settings 에서 조회)
 * @returns 'auto_hide' | 'queue_only'
 */
export function deriveReportAction(
  reportCount: number,
  threshold: number,
): "auto_hide" | "queue_only" {
  if (threshold <= 0) return "queue_only"; // 임계치 미설정
  return reportCount >= threshold ? "auto_hide" : "queue_only";
}

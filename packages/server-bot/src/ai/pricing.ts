/**
 * AI 프로바이더별 비용 추정 (Story 11.6 — AC #5).
 *
 * PRICE_TABLE은 2026-06 기준 USD per 1M 토큰 참고값이다.
 * 실제 청구 금액과 다를 수 있으며, 운영 정밀도가 필요하면
 * bot_model_assignments 테이블에 price_input_per_m / price_output_per_m 컬럼을 추가하는 방식으로 대체한다.
 *
 * 알 수 없는 모델이면 0을 반환 — fail-safe (차단 안 함, ARCHITECTURE §11).
 * 모델명은 callModel이 DB에서 읽어 전달하며, 여기서 하드코딩하지 않는다.
 */

/** 알려진 모델별 가격 (USD per 1M 토큰). 모델 라인업 변경 시 이 맵만 갱신. */
const PRICE_TABLE: Record<string, { input: number; output: number }> = {
  // ── OpenAI ─────────────────────────────────────────────────────────────────
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  // ── Anthropic ──────────────────────────────────────────────────────────────
  "claude-haiku-4-5": { input: 0.8, output: 4.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-opus-4-5": { input: 15.0, output: 75.0 },
  // ── Google Gemini ──────────────────────────────────────────────────────────
  "gemini-2.0-flash": { input: 0.075, output: 0.3 },
  "gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
};

/**
 * 입력·출력 토큰 수 기반 비용 추정 (USD).
 *
 * @param _provider - 현재 미사용 (향후 프로바이더별 분기 대비 보존)
 * @param model     - 모델 ID (bot_model_assignments.model 값)
 * @returns 추정 비용(달러). 알 수 없는 모델이면 0 반환 (fail-safe).
 */
export function estimateCostUsd(
  _provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICE_TABLE[model];
  if (!price) return 0; // 알 수 없는 모델 — 차단 안 함 (ARCHITECTURE §11 fail-safe)
  return (price.input * inputTokens + price.output * outputTokens) / 1_000_000;
}

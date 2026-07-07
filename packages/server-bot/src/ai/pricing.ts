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

/** 알려진 모델별 가격 (USD per 1M 토큰). 2026-07 기준. 모델 라인업 변경 시 이 맵만 갱신. */
const PRICE_TABLE: Record<string, { input: number; output: number }> = {
  // ── OpenAI ─────────────────────────────────────────────────────────────────
  // 최신 GPT-5 계열
  "gpt-5.5": { input: 5.0, output: 30.0 },
  "gpt-5.5-pro": { input: 30.0, output: 180.0 },
  "gpt-5.4": { input: 2.5, output: 15.0 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
  // 구형 GPT-4 계열 (하위호환)
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  // ── Anthropic ──────────────────────────────────────────────────────────────
  // 최신 Claude 계열
  "claude-fable-5": { input: 10.0, output: 50.0 },
  "claude-opus-4-8": { input: 5.0, output: 25.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  // 구형 Claude 계열 (하위호환)
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-opus-4-5": { input: 15.0, output: 75.0 },
  // ── Google Gemini ──────────────────────────────────────────────────────────
  // 최신 Gemini 3 계열
  "gemini-3.5-flash": { input: 1.5, output: 9.0 },
  "gemini-3.1-pro-preview": { input: 2.0, output: 12.0 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  // 구형 Gemini 2 계열 (하위호환)
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

/**
 * AI 프로바이더 크레딧/쿼터 소진 에러 분류 (사용자 요청: 크레딧 소진 시 텔레그램 알림).
 *
 * 세 어댑터(anthropic·openai·gemini)의 비정상 응답(HTTP status + body)을 이 헬퍼로 분류한다.
 * 크레딧 잔액 부족·청구 한도 도달·쿼터 초과로 판단되면 ProviderCreditExhaustedError를 던지고
 * 텔레그램 알림을 1회(쿨다운) 발송한다. 그 외 오류는 일반 Error로 처리한다.
 */

import { notifyCreditExhausted } from "../alert/credit-alert";

/** callModel/어댑터가 다루는 프로바이더 식별자. */
export type AiProviderName = "openai" | "anthropic" | "google";

/** 프로바이더 크레딧/쿼터 소진(잔액부족·청구한도·quota초과)을 나타내는 전용 에러. */
export class ProviderCreditExhaustedError extends Error {
  readonly provider: AiProviderName;
  readonly model: string;
  readonly status: number;
  /** 프로바이더 원본 응답 본문(진단용). */
  readonly detail: string;

  constructor(provider: AiProviderName, model: string, status: number, detail: string) {
    super(`[ai/${provider}] 크레딧/쿼터 소진 (HTTP ${status}): ${detail}`);
    this.name = "ProviderCreditExhaustedError";
    this.provider = provider;
    this.model = model;
    this.status = status;
    this.detail = detail;
  }
}

/**
 * 프로바이더 응답이 크레딧/쿼터 소진인지 판정한다.
 * 소진이면 true, 일시적 오류(5xx·일반 4xx)이면 false.
 *
 * 각 프로바이더의 크레딧/청구/쿼터 시그널:
 *  - openai   : 429 + insufficient_quota / exceeded your current quota / billing_hard_limit_reached
 *  - anthropic: 400 + "credit balance is too low" / billing
 *  - google   : 429 + RESOURCE_EXHAUSTED / quota exceeded / billing
 *  - 공통      : HTTP 402 Payment Required
 */
export function isCreditExhaustion(status: number, body: string): boolean {
  if (status === 402) return true; // Payment Required — 공통 청구 신호
  const b = body.toLowerCase();
  return (
    b.includes("insufficient_quota") ||
    b.includes("exceeded your current quota") ||
    b.includes("billing_hard_limit_reached") ||
    b.includes("credit balance is too low") ||
    b.includes("credit balance") ||
    b.includes("resource_exhausted") ||
    (b.includes("quota") && b.includes("exceed")) ||
    b.includes("billing")
  );
}

/**
 * 비정상 응답(res.ok=false)을 분류해 적절한 에러를 던진다.
 * - 크레딧/쿼터 소진: 텔레그램 알림(쿨다운) 발송 후 ProviderCreditExhaustedError throw.
 * - 그 외: 기존과 동일한 일반 Error throw.
 *
 * res.ok=true면 아무 것도 하지 않는다(정상).
 */
export async function assertProviderOk(
  res: Response,
  provider: AiProviderName,
  model: string,
  tag: string,
): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => "(응답 본문 읽기 실패)");
  if (isCreditExhaustion(res.status, body)) {
    notifyCreditExhausted({ provider, model, purpose: tag, detail: body });
    throw new ProviderCreditExhaustedError(provider, model, res.status, body);
  }
  throw new Error(`[ai/${provider}/${tag}] API 오류 ${res.status}: ${body}`);
}

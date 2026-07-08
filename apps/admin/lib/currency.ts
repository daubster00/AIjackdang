/**
 * 관리자 금액 표기 유틸 — 달러(USD) 원본 값을 원화(KRW)로 환산해 표기.
 *
 * AI 제공사는 달러로 과금하므로 내부 저장값(비용·상한)은 USD 그대로 두고,
 * 화면에 보일 때만 이 유틸로 원화 환산한다. 환율은 한국수출입은행 매매기준율
 * (GET /api/v1/admin/exchange-rate · AiUsageReport.exchangeRate)에서 받는다.
 */

/** USD → KRW 숫자 환산. rate = 달러당 원. */
export function usdToKrw(usd: number, rate: number): number {
  return usd * rate;
}

/** KRW → USD 숫자 환산(비용 상한 입력값을 달러로 되돌릴 때). rate<=0이면 0. */
export function krwToUsd(krw: number, rate: number): number {
  if (!rate || rate <= 0) return 0;
  return krw / rate;
}

/**
 * 달러 금액을 원화 문자열로 포맷한다. 예: 0.0015달러·환율 1320 → "₩2".
 * - 0원 → "₩0"
 * - 10원 미만(소액 AI 비용) → 소수 2자리까지 (예: ₩1.98)
 * - 그 외 → 정수 + 천단위 콤마 (예: ₩1,742)
 */
export function formatKrwFromUsd(usd: number, rate: number): string {
  return formatKrw(usdToKrw(usd, rate));
}

/** 원화 숫자를 표기 문자열로. (formatKrwFromUsd 내부용 + 원화 직접값 표기용) */
export function formatKrw(krw: number): string {
  if (!Number.isFinite(krw) || krw === 0) return "₩0";
  const abs = Math.abs(krw);
  if (abs < 10) {
    // 소액: 소수점 2자리까지 (반올림 뒤 0이면 정수)
    const rounded = Math.round(krw * 100) / 100;
    return `₩${rounded.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
  }
  return `₩${Math.round(krw).toLocaleString("ko-KR")}`;
}

/**
 * 환율 기준 안내 문구. 예: "환율 ₩1,320/$ · 2026-07-08 기준".
 * stale(오늘자 갱신 실패)이면 안내에 표기.
 */
export function formatRateNote(rate: number, baseDate: string | null, stale?: boolean): string {
  const base = `환율 ₩${Math.round(rate).toLocaleString("ko-KR")}/$`;
  const date = baseDate ? ` · ${baseDate} 기준` : "";
  const staleTag = stale ? " (최신 환율 미수신, 최근값 사용)" : "";
  return `${base}${date}${staleTag}`;
}

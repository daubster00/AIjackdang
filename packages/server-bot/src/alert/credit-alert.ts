/**
 * AI 프로바이더 크레딧/쿼터 소진 텔레그램 알림 (사용자 요청).
 *
 * 제미나이·클로드(·OpenAI)의 크레딧/쿼터가 소진돼 봇 자동 생성이 멈추면
 * 운영자에게 텔레그램으로 즉시 알린다.
 *
 * 설계 의도:
 *  - 부가 기능이므로 어떤 경우에도 throw 하지 않는다(fire-and-forget).
 *  - TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 시 graceful skip.
 *  - 재시도(MAX_REGEN)·다봇 배치로 동일 소진이 연속 감지돼도 프로바이더별 30분에 1회만 전송(스팸 방지).
 */

import { env } from "@ai-jakdang/config";
import type { AiProviderName } from "../ai/errors";

const TELEGRAM_API = "https://api.telegram.org";

/** 프로바이더별 마지막 알림 시각(ms) — 재시도·배치로 인한 중복 전송 방지. */
const lastAlertAt = new Map<string, number>();
/** 동일 프로바이더 재알림 최소 간격(30분). */
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

/** 프로바이더 → 사람이 읽는 라벨. */
const PROVIDER_LABEL: Record<AiProviderName, string> = {
  openai: "OpenAI (ChatGPT)",
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
};

/** HTML parse_mode 안전 처리(<>& 이스케이프). */
function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 텔레그램 sendMessage 호출 — 실패해도 throw 하지 않는다. */
async function sendTelegram(text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // 미설정 — graceful skip

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[credit-alert] 텔레그램 API 오류 (${res.status}): ${body}`);
    }
  } catch (err) {
    console.error("[credit-alert] 텔레그램 네트워크 오류:", (err as Error).message);
  }
}

/**
 * 프로바이더 크레딧/쿼터 소진을 텔레그램으로 알린다(fire-and-forget·throw 금지).
 * 동일 프로바이더는 30분에 1회만 전송(재시도·다봇 배치 스팸 방지).
 */
export function notifyCreditExhausted(input: {
  provider: AiProviderName;
  model: string;
  /** 발생 지점: 'chat/completions' | 'generateContent' | 'image' 등. */
  purpose?: string;
  /** 프로바이더 원본 에러 본문(진단용). */
  detail?: string;
}): void {
  const now = Date.now();
  const last = lastAlertAt.get(input.provider) ?? 0;
  if (now - last < ALERT_COOLDOWN_MS) return; // 쿨다운 내 — skip
  lastAlertAt.set(input.provider, now);

  const label = PROVIDER_LABEL[input.provider] ?? input.provider;
  const purposeLine = input.purpose ? `\n발생: <code>${esc(input.purpose)}</code>` : "";
  const detailLine = input.detail ? `\n<code>${esc(input.detail.slice(0, 300))}</code>` : "";
  const text =
    `🚨 <b>${esc(label)} 크레딧/쿼터 소진</b>\n` +
    `모델: <code>${esc(input.model)}</code>${purposeLine}\n` +
    `봇 자동 생성이 중단될 수 있습니다. 크레딧/결제 상태를 확인하세요.` +
    detailLine;

  void sendTelegram(text);
}

/**
 * Anthropic REST API 어댑터 (Story 11.6 — AC #1, #2).
 *
 * Node 전역 fetch를 사용하여 @anthropic-ai/sdk 의존성 없이 직접 호출한다.
 * ARCHITECTURE §4: tools 파라미터 전달 절대 금지.
 * Anthropic은 이미지 생성 미지원 — generateImage 미구현 (AiProvider 선택 메서드).
 * 키 미설정 시 호출 시점에 명확한 에러를 throw (부팅은 차단하지 않음).
 */

import { env } from "@ai-jakdang/config";
import type { AiProvider, AiTextRequest, AiTextResponse } from "../types";
import { estimateCostUsd } from "../pricing";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_API_VERSION = "2023-06-01";

// ── REST 응답 내부 타입 ───────────────────────────────────────────────────────

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicMessagesResponse {
  content: AnthropicContentBlock[];
  usage: AnthropicUsage;
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function requireApiKey(): string {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("[ai/anthropic] ANTHROPIC_API_KEY 미설정 — env에 키를 추가하세요");
  }
  return env.ANTHROPIC_API_KEY;
}

async function assertOk(res: Response, tag: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "(응답 본문 읽기 실패)");
    throw new Error(`[ai/anthropic/${tag}] API 오류 ${res.status}: ${body}`);
  }
}

// ── 어댑터 구현 ───────────────────────────────────────────────────────────────

export const anthropicAdapter: AiProvider = {
  async generateText(req: AiTextRequest): Promise<AiTextResponse> {
    const apiKey = requireApiKey();

    const res = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens ?? 2000,
        temperature: req.temperature ?? 0.7,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        // tools 파라미터 절대 추가 금지 (ARCHITECTURE §4 — 생성 모델 격리)
      }),
    });

    await assertOk(res, "messages");
    const json = (await res.json()) as AnthropicMessagesResponse;

    const firstBlock = json.content[0];
    const text = firstBlock?.type === "text" ? (firstBlock.text ?? "") : "";
    const { input_tokens, output_tokens } = json.usage;

    return {
      text,
      usage: { inputTokens: input_tokens, outputTokens: output_tokens },
      costUsd: estimateCostUsd("anthropic", req.model, input_tokens, output_tokens),
    };
  },

  // generateImage 미구현 — Anthropic은 텍스트 전용 모델만 제공
};

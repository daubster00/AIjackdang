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
import { assertProviderOk } from "../errors";

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

/**
 * 최신 세대 Claude 모델(Opus/Sonnet/Haiku 4.x 이상, Fable 5)은 `temperature`
 * 파라미터를 폐기(deprecated)했다 — 전달하면 400 invalid_request_error
 * ("`temperature` is deprecated for this model.")로 호출이 실패한다.
 * (GPT-5 계열이 temperature 커스텀값을 거부하는 것과 동일한 규약 변경.)
 *
 * 이 계열에는 temperature 를 아예 보내지 않는다(모델 기본값 사용).
 * 구세대(claude-3, claude-3-5 등)는 기존대로 temperature 를 전달한다.
 * temperature 는 모든 Claude 모델에서 선택 파라미터이므로, 신세대에 생략해도
 * 무해하고 구세대에 보내도 무해하다 — 다만 신세대는 보내면 하드 400이라 분기한다.
 */
function deprecatesTemperature(model: string): boolean {
  return /^claude-(opus|sonnet|haiku)-[4-9]/i.test(model) || /^claude-fable-/i.test(model);
}

// ── 어댑터 구현 ───────────────────────────────────────────────────────────────

export const anthropicAdapter: AiProvider = {
  async generateText(req: AiTextRequest): Promise<AiTextResponse> {
    const apiKey = requireApiKey();

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? 2000,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
      // tools 파라미터 절대 추가 금지 (ARCHITECTURE §4 — 생성 모델 격리)
    };
    // 신세대 모델은 temperature 폐기 → 전달 시 400. 이 계열에만 생략한다.
    if (!deprecatesTemperature(req.model)) {
      body.temperature = req.temperature ?? 0.7;
    }

    const res = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    await assertProviderOk(res, "anthropic", req.model, "messages");
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

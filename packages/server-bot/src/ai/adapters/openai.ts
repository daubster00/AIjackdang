/**
 * OpenAI REST API 어댑터 (Story 11.6 — AC #1, #2).
 *
 * Node 전역 fetch를 사용하여 openai SDK 의존성 없이 직접 호출한다.
 * ARCHITECTURE §4: tools/functions/tool_choice 파라미터 전달 절대 금지.
 * 키 미설정 시 호출 시점에 명확한 에러를 throw (부팅은 차단하지 않음).
 */

import { env } from "@ai-jakdang/config";
import type { AiProvider, AiTextRequest, AiTextResponse, AiImageRequest, AiImageResponse } from "../types";
import { estimateCostUsd } from "../pricing";
import { assertProviderOk } from "../errors";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

// ── REST 응답 내부 타입 ───────────────────────────────────────────────────────

interface OpenAiChatChoice {
  message: { content: string | null };
}

interface OpenAiUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

interface OpenAiChatResponse {
  choices: OpenAiChatChoice[];
  usage: OpenAiUsage;
}

interface OpenAiImageData {
  url?: string;
}

interface OpenAiImagesResponse {
  data: OpenAiImageData[];
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function requireApiKey(): string {
  if (!env.OPENAI_API_KEY) {
    throw new Error("[ai/openai] OPENAI_API_KEY 미설정 — env에 키를 추가하세요");
  }
  return env.OPENAI_API_KEY;
}

// ── 어댑터 구현 ───────────────────────────────────────────────────────────────

export const openAiAdapter: AiProvider = {
  async generateText(req: AiTextRequest): Promise<AiTextResponse> {
    const apiKey = requireApiKey();

    const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: req.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        max_tokens: req.maxTokens ?? 2000,
        temperature: req.temperature ?? 0.7,
        // tools 파라미터 절대 추가 금지 (ARCHITECTURE §4 — 생성 모델 격리)
      }),
    });

    await assertProviderOk(res, "openai", req.model, "chat/completions");
    const json = (await res.json()) as OpenAiChatResponse;
    const text = json.choices[0]?.message.content ?? "";
    const { prompt_tokens, completion_tokens } = json.usage;

    return {
      text,
      usage: { inputTokens: prompt_tokens, outputTokens: completion_tokens },
      costUsd: estimateCostUsd("openai", req.model, prompt_tokens, completion_tokens),
    };
  },

  async generateImage(req: AiImageRequest): Promise<AiImageResponse> {
    const apiKey = requireApiKey();

    const res = await fetch(`${OPENAI_BASE_URL}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: req.model,
        prompt: req.prompt,
        n: req.n ?? 1,
        size: req.size ?? "1024x1024",
        response_format: "url",
      }),
    });

    await assertProviderOk(res, "openai", req.model, "images/generations");
    const json = (await res.json()) as OpenAiImagesResponse;

    return {
      url: json.data[0]?.url,
      costUsd: 0, // 이미지 비용은 토큰 기반이 아님 — 별도 측정 필요 시 파이프라인에서 처리
    };
  },
};

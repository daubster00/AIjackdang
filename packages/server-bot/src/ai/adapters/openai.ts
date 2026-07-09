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

/**
 * GPT-5 계열 추론 여유분(reasoning reserve).
 *
 * GPT-5 계열은 추론 토큰(reasoning tokens — 답을 내기 전 '속으로 생각'하는 데 쓰는 토큰)이
 * max_completion_tokens 예산을 본문 토큰과 함께 나눠 쓴다. 추론이 예산을 다 삼키면
 * message.content가 빈 문자열로 반환된다(finish_reason="length"). 이를 막기 위해
 *  1) reasoning_effort를 낮춰 추론 소비를 줄이고,
 *  2) 파이프라인이 요청한 maxTokens(본문 목표 길이)에 이 여유분을 더해 상한을 잡아
 *     본문 몫이 추론에 잠식되지 않게 한다.
 */
const GPT5_REASONING_TOKEN_RESERVE = 2000;

// ── REST 응답 내부 타입 ───────────────────────────────────────────────────────

interface OpenAiChatChoice {
  message: { content: string | null };
  /** "stop" | "length" | "content_filter" 등 — 빈 응답 진단에 사용 */
  finish_reason?: string;
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

/**
 * GPT-5 계열(및 o-시리즈 추론 모델)은 chat/completions 파라미터 규약이 다르다:
 *  - max_tokens → max_completion_tokens (구 파라미터 전달 시 400 unsupported_parameter)
 *  - temperature 는 기본값(1)만 허용 — 0.7 등 커스텀값 전달 시 400 unsupported_value
 * 따라서 이 계열은 max_completion_tokens 를 쓰고 temperature 는 아예 보내지 않는다.
 * gpt-4o·gpt-4.1 등 구형 모델은 기존대로 max_tokens + temperature 를 사용한다.
 */
function usesNewCompletionParams(model: string): boolean {
  return /^(gpt-5|o[0-9])/i.test(model);
}

export const openAiAdapter: AiProvider = {
  async generateText(req: AiTextRequest): Promise<AiTextResponse> {
    const apiKey = requireApiKey();

    const body: Record<string, unknown> = {
      model: req.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      // tools 파라미터 절대 추가 금지 (ARCHITECTURE §4 — 생성 모델 격리)
    };

    if (usesNewCompletionParams(req.model)) {
      // GPT-5 계열: max_completion_tokens 사용, temperature 미전달(기본 1만 허용).
      // 추론 토큰이 본문 예산을 삼켜 빈 응답이 나오던 문제를 막기 위해
      //  ① reasoning_effort를 "low"로 낮추고(추론 소비 절감),
      //  ② 상한에 추론 여유분을 더해 본문 몫(maxTokens)을 보존한다.
      body.reasoning_effort = "low";
      body.max_completion_tokens =
        (req.maxTokens ?? 2000) + GPT5_REASONING_TOKEN_RESERVE;
      if (req.temperature !== undefined && req.temperature === 1) {
        body.temperature = 1;
      }
    } else {
      body.max_tokens = req.maxTokens ?? 2000;
      body.temperature = req.temperature ?? 0.7;
    }

    const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    await assertProviderOk(res, "openai", req.model, "chat/completions");
    const json = (await res.json()) as OpenAiChatResponse;
    const choice = json.choices[0];
    const text = choice?.message.content ?? "";
    const { prompt_tokens, completion_tokens } = json.usage;

    // 빈 응답 가드: 추론 토큰이 상한을 소진해 본문이 안 나온 경우(finish_reason="length"),
    // 조용히 ""를 반환하면 파이프라인이 빈 글로 진행해 검열에서 전량 fail 한다.
    // 명시적으로 throw 하여 호출자가 재생성/폐기로 처리하게 한다.
    if (!text.trim() && choice?.finish_reason === "length") {
      throw new Error(
        `[ai/openai] 빈 응답 — 추론 토큰이 max_completion_tokens(${String(body.max_completion_tokens)})를 소진해 본문이 생성되지 않음 (model=${req.model}, completion_tokens=${completion_tokens}). reasoning_effort를 낮추거나 상한을 올리세요.`,
      );
    }

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

/**
 * Google Gemini REST API 어댑터 (Story 11.6 — AC #1, #2).
 *
 * Node 전역 fetch를 사용하여 @google/genai SDK 의존성 없이 직접 호출한다.
 * ARCHITECTURE §4: tools 파라미터 전달 절대 금지.
 * 주의: 구버전 @google/generative-ai 와 혼동 금지.
 * 키 미설정 시 호출 시점에 명확한 에러를 throw (부팅은 차단하지 않음).
 */

import { env } from "@ai-jakdang/config";
import type { AiProvider, AiTextRequest, AiTextResponse } from "../types";
import { estimateCostUsd } from "../pricing";
import { assertProviderOk } from "../errors";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// ── REST 응답 내부 타입 ───────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
}

interface GeminiContent {
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function requireApiKey(): string {
  if (!env.GEMINI_API_KEY) {
    throw new Error("[ai/gemini] GEMINI_API_KEY 미설정 — env에 키를 추가하세요");
  }
  return env.GEMINI_API_KEY;
}

// ── 어댑터 구현 ───────────────────────────────────────────────────────────────

export const geminiAdapter: AiProvider = {
  async generateText(req: AiTextRequest): Promise<AiTextResponse> {
    const apiKey = requireApiKey();

    // URL: /v1beta/models/{model}:generateContent?key={apiKey}
    const url = `${GEMINI_BASE_URL}/${encodeURIComponent(req.model)}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: req.user }],
          },
        ],
        systemInstruction: {
          parts: [{ text: req.system }],
        },
        generationConfig: {
          maxOutputTokens: req.maxTokens ?? 2000,
          temperature: req.temperature ?? 0.7,
          // tools 파라미터 절대 추가 금지 (ARCHITECTURE §4 — 생성 모델 격리)
        },
      }),
    });

    await assertProviderOk(res, "google", req.model, "generateContent");
    const json = (await res.json()) as GeminiGenerateContentResponse;

    const firstCandidate = json.candidates?.[0];
    const text = firstCandidate?.content.parts[0]?.text ?? "";
    const inputTokens = json.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      text,
      usage: { inputTokens, outputTokens },
      costUsd: estimateCostUsd("google", req.model, inputTokens, outputTokens),
    };
  },

  // generateImage: Google Imagen 통합이 필요하면 별도 어댑터로 구현
};

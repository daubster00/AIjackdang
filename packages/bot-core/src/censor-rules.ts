/**
 * 검열 규칙 빌더·파서 — Story 11.9 (bot-core 순수 함수).
 *
 * 자기검열 AI 호출을 위한 시스템·유저 프롬프트 조립과
 * 응답 JSON 파싱(fail-safe)을 담당한다.
 * DB·네트워크 접근 금지.
 */

import type { CensorUserPromptOptions } from "./context-types.js";

// ── 공개 타입 ─────────────────────────────────────────────────────────────────

export type CensorStrictness = "strict" | "normal" | "loose";

export type CensorItemKey =
  | "factuality"
  | "ai_tone"
  | "persona"
  | "safety"
  | "duplicate"
  | "context";

export type CensorItemResult = "pass" | "fail" | "ambiguous";

export interface CensorResultItem {
  key: CensorItemKey;
  result: CensorItemResult;
  reason: string;
}

export interface CensorResult {
  items: CensorResultItem[];
  overall: CensorItemResult;
}

// ── 내부 상수 ─────────────────────────────────────────────────────────────────

const ALL_KEYS: CensorItemKey[] = [
  "factuality",
  "ai_tone",
  "persona",
  "safety",
  "duplicate",
  "context",
];

const VALID_RESULTS: CensorItemResult[] = ["pass", "fail", "ambiguous"];

// ── 공개 함수 ─────────────────────────────────────────────────────────────────

/**
 * 검열관 시스템 프롬프트 조립.
 * strictness에 따라 검열 강도를 차등 적용한다.
 */
export function buildCensorSystemPrompt(strictness: CensorStrictness): string {
  const base = `당신은 온라인 커뮤니티 글 검열관입니다. 다음 6항목을 판정하고 JSON으로만 응답하세요.

항목:
1. factuality — 사실성 (확인 불가 수치·이름·날짜 단정 포함 여부)
2. ai_tone — AI 티 (이모지·상투어·균일 문단 등 AI 작성 징후)
3. persona — 페르소나 일관성 (캐릭터 말투·성격 유지 여부)
4. safety — 안전·위험 (혐오·폭력·불법 내용 포함 여부)
5. duplicate — 중복성 (원래 주제나 기존 글과 동일한 내용 여부)
6. context — 게시판 맥락 적합 (게시판 성격에 맞는 글인지)

결과값: "pass" | "fail" | "ambiguous"

응답 형식 (JSON만, 설명·markdown 절대 없음):
{ "items": [ { "key": "factuality", "result": "pass", "reason": "..." }, ... ] }`;

  let strictnessGuide: string;
  if (strictness === "strict") {
    strictnessGuide = `
검열 강도: strict (엄격)
- factuality: 확인 불가 수치·이름·날짜 단정이 하나라도 있으면 fail
- ai_tone: AI 티 징후 1건만 있어도 fail
- 전반적으로 기준을 높게 적용하며 의심되면 ambiguous 처리`;
  } else if (strictness === "normal") {
    strictnessGuide = `
검열 강도: normal (보통)
- factuality: 명백한 거짓 사실만 fail, 약간의 불확실성은 ambiguous
- ai_tone: 이모지·상투어가 명확히 반복될 때만 fail`;
  } else {
    strictnessGuide = `
검열 강도: loose (느슨) — 잡담·밈류
- factuality: 잡담이므로 사실성은 사실상 면제 (극단적 허위만 fail)
- ai_tone: 이모지·딱딱한 상투어가 눈에 띄게 많을 때만 fail
- 전반적으로 기준을 낮게 적용`;
  }

  return base + "\n" + strictnessGuide.trim();
}

/**
 * 검열관 유저 프롬프트 조립.
 * 생성된 초안과 원래 주제·페르소나 정보를 함께 제공한다.
 */
export function buildCensorUserPrompt(options: CensorUserPromptOptions): string {
  const { draft, personaName, tone, titleSeed, facts, board } = options;

  const factsSection =
    facts.facts.length > 0
      ? `\n참고 사실 요약 (사실성 판정 기준):\n${facts.facts
          .slice(0, 5)
          .map((f, i) => `${i + 1}. ${f}`)
          .join("\n")}`
      : "";

  return `캐릭터: ${personaName}
말투: ${tone}
게시판: ${board}
원래 주제: ${titleSeed}
${factsSection}

검열 대상 글:
---
${draft}
---

위 글을 6항목(factuality, ai_tone, persona, safety, duplicate, context)으로 판정하세요.
JSON만 응답하세요.`.trim();
}

/**
 * 검열관 응답 JSON 파싱 (fail-safe).
 *
 * 파싱 실패·예외 시 → overall='ambiguous' 반환 (ARCHITECTURE §11 fail-safe).
 * overall 결정 규칙: fail 하나라도 있으면 fail, ambiguous 있으면 ambiguous, 전부 pass면 pass.
 */
export function parseCensorResult(response: string): CensorResult {
  try {
    // 응답에 설명이 붙는 경우를 대비해 JSON 블록만 추출
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON block found");

    const parsed = JSON.parse(jsonMatch[0]) as {
      items?: Array<{ key?: unknown; result?: unknown; reason?: unknown }>;
    };

    if (!Array.isArray(parsed.items)) throw new Error("items is not an array");

    const items: CensorResultItem[] = parsed.items
      .filter(
        (item): item is { key: CensorItemKey; result: unknown; reason: unknown } =>
          ALL_KEYS.includes(item.key as CensorItemKey),
      )
      .map((item) => ({
        key: item.key,
        result: VALID_RESULTS.includes(item.result as CensorItemResult)
          ? (item.result as CensorItemResult)
          : "ambiguous",
        reason: typeof item.reason === "string" ? item.reason : "",
      }));

    // overall: fail > ambiguous > pass
    let overall: CensorItemResult = "pass";
    for (const item of items) {
      if (item.result === "fail") {
        overall = "fail";
        break;
      }
      if (item.result === "ambiguous") {
        overall = "ambiguous";
      }
    }

    return { items, overall };
  } catch {
    // 파싱 실패 시 전 항목 ambiguous 폴백 (ARCHITECTURE §11)
    return {
      items: ALL_KEYS.map((key) => ({
        key,
        result: "ambiguous" as CensorItemResult,
        reason: "파싱 실패",
      })),
      overall: "ambiguous",
    };
  }
}

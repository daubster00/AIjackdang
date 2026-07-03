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
  | "context"
  | "insight";

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
  "insight",
];

const VALID_RESULTS: CensorItemResult[] = ["pass", "fail", "ambiguous"];

// ── 공개 함수 ─────────────────────────────────────────────────────────────────

/**
 * 검열관 시스템 프롬프트 조립.
 * strictness에 따라 검열 강도를 차등 적용한다.
 */
export function buildCensorSystemPrompt(
  strictness: CensorStrictness,
  options?: { allowObvious?: boolean },
): string {
  // insight(내용 비범함) 항목은 정보성 글(strict·normal)에서만 판정한다.
  // loose(잡담·밈)는 정보 전달이 목적이 아니므로 제외.
  // allowObvious(가이드 글): 초보자용 교과서적 설명이 정당하므로 insight 면제.
  const enforceInsight = strictness !== "loose" && !options?.allowObvious;

  const items = [
    "1. factuality — 사실성 (확인 불가 수치·이름·날짜 단정 포함 여부)",
    "2. ai_tone — AI 티 (이모지 사용, '저는 AI/언어모델' 류 자기언급, '결론적으로·정리하자면·마무리하며·~해드립니다' 같은 기계적 상투어. ※글이 정돈되어 있거나 정보가 구조적·논리적인 것 자체는 AI 티가 절대 아님. 사람도 정보글은 구조적으로 쓴다)",
    "3. persona — 페르소나 일관성 (캐릭터 말투·성격 유지 여부)",
    "4. safety — 안전·위험 (혐오·폭력·불법 내용 포함 여부)",
    "5. duplicate — 중복성 (원래 주제나 기존 글과 동일한 내용 여부)",
    "6. context — 게시판 맥락 적합 (게시판 성격에 맞는 글인지)",
  ];
  if (enforceInsight) {
    items.push(
      "7. insight — 내용 비범함 (남들도 다 아는 뻔한 일반론·당연한 소리뿐이면 fail. 실제로 유용한 구체적 디테일·수치·함정·새 소식이 하나라도 있으면 pass)",
    );
  }

  const base = `당신은 온라인 커뮤니티 글 검열관입니다. 다음 ${items.length}항목을 판정하고 JSON으로만 응답하세요.

항목:
${items.join("\n")}

결과값: "pass" | "fail" | "ambiguous"

응답 형식 (JSON만, 설명·markdown 절대 없음):
{ "items": [ { "key": "factuality", "result": "pass", "reason": "..." }, ... ] }`;

  let strictnessGuide: string;
  if (strictness === "strict") {
    strictnessGuide = `
검열 강도: strict (엄격) — 관리자 공식 가이드 전용
- factuality: 아래 '참고 사실 요약'에 근거가 있으면 pass. 근거 없이 지어낸 수치·이름·날짜 단정만 fail (검색으로 확인된 최신 기능·수치는 통과).
- ai_tone: 이모지·AI 자기언급·금지 상투어(결론적으로·정리하자면 등)가 명확히 반복될 때만 fail. 정보 전달 글의 자연스러운 구조·정돈은 fail 아님(구조적인 게 정상).
- insight: 뻔한 일반론·교과서적 조언만 있고 구체적 노하우·수치·함정·새 정보가 하나도 없으면 fail
- 사실성·안전은 엄격히, 그러나 근거 있는 최신 정보를 과잉 차단하지 말 것`;
  } else if (strictness === "normal") {
    strictnessGuide = `
검열 강도: normal (보통)
- factuality: 명백한 거짓 사실만 fail, 약간의 불확실성은 ambiguous
- ai_tone: 이모지나 금지 상투어(결론적으로·정리하자면·~해드립니다 등)나 AI 자기언급이 실제로 있을 때만 fail. 잘 정리된 정보글이 구조적이라는 이유로는 절대 fail 주지 말 것(정보글은 원래 구조적이다).
- insight: 글 전체가 누구나 아는 뻔한 소리뿐이면 fail, 유용한 포인트가 하나라도 있으면 pass`;
  } else {
    strictnessGuide = `
검열 강도: loose (느슨) — 잡담·밈류
- factuality: 잡담이므로 사실성은 사실상 면제 (극단적 허위만 fail)
- ai_tone: 이모지·딱딱한 상투어가 눈에 띄게 많을 때만 fail
- 전반적으로 기준을 낮게 적용 (insight 항목은 판정하지 않음)`;
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

위 글을 시스템 프롬프트에 명시된 항목으로 판정하세요.
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

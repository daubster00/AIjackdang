/**
 * 자기검열 서비스 — Story 11.9
 *
 * runSelfCensor: 생성 모델과 분리된 검열관 모델로 6항목을 판정한다.
 * 중복 1차 필터(jaccardSimilarity) → 검열관 AI 호출 → parseCensorResult.
 * DB 상태 업데이트는 파이프라인(post-pipeline.ts)의 책임 — 이 파일은 하지 않는다.
 *
 * [Source: docs/seeding-bot/ARCHITECTURE.md §7 글 생성 파이프라인 — 자기검열]
 * [Source: docs/seeding-bot/PRD.md FR-SB-8.1~8.7]
 */

import { getDb } from "@ai-jakdang/database";
import { callModel, getModelAssignment } from "@ai-jakdang/server-bot/ai";
import {
  buildCensorSystemPrompt,
  buildCensorUserPrompt,
  parseCensorResult,
  isTooSimilar,
  type CensorResult,
} from "@ai-jakdang/bot-core";
import type { FactSummary } from "@ai-jakdang/bot-core";

// ── 공개 타입 ─────────────────────────────────────────────────────────────────

export type { CensorResult };

export interface SelfCensorPersona {
  personaName: string;
  tone: string;
  /** info_ratio (0~100) — 검열 강도 결정에 사용 */
  infoRatio: number;
  /** is_admin_persona — 관리자 페르소나이면 강도 strict 강제 */
  isAdminPersona: boolean;
  /** bot_model_assignments 조회 키 */
  personaId: string;
}

export interface SelfCensorInput {
  jobId: string;
  personaId: string;
  /** 생성된 평문 텍스트 (Tiptap에서 추출) */
  draft: string;
  titleSeed: string;
  persona: SelfCensorPersona;
  facts: FactSummary;
  board: string;
  /** 최근 자기 글 텍스트 (중복 1차 필터용, 선택) */
  existingPostTexts?: string[];
  /**
   * 가이드 글이면 true — 초보자용 교과서적/일반론 설명을 허용(insight 축 면제).
   * (사용자 정책: 바이브코딩·자동화 가이드는 뻔한 기본 설명도 정당)
   */
  allowObvious?: boolean;
  /**
   * 커리큘럼 강의 편이면 true — ai_tone·duplicate 축을 비차단으로 완화한다.
   * 공식 가이드 연재는 본래 교육적(didactic) 문체라 "잡담 AI 티" 기준이 맞지 않고,
   * 약한 검열 모델이 존재하지 않는 상투어를 지어내 반복 오탐하는 문제가 있어,
   * 이 두 축의 fail을 pass로 내린다(safety·factuality·persona·context는 그대로 강제).
   */
  allowDidacticTone?: boolean;
}

/** 항목들로부터 overall을 재계산: fail 있으면 fail, ambiguous 있으면 ambiguous, 아니면 pass. */
function recomputeOverall(
  items: CensorResult["items"],
): CensorResult["overall"] {
  if (items.some((i) => i.result === "fail")) return "fail";
  if (items.some((i) => i.result === "ambiguous")) return "ambiguous";
  return "pass";
}

export interface SelfCensorOutput {
  censorResult: CensorResult;
  /** 검열관 호출 비용 (달러) */
  costUsd: number;
}

// ── 검열 강도 결정 ────────────────────────────────────────────────────────────

type CensorStrictness = "strict" | "normal" | "loose";

function decideCensorStrictness(persona: SelfCensorPersona): CensorStrictness {
  // strict는 관리자(공식 가이드) 페르소나에만 적용한다.
  // 과거 infoRatio>=70도 strict였는데, 진짜 유용한 최신 정보 글까지
  // "검증 불가"로 3회 탈락→discarded 되는 문제가 커서 normal로 완화한다.
  if (persona.isAdminPersona) return "strict";
  if (persona.infoRatio >= 40) return "normal";
  return "loose";
}

// ── runSelfCensor ─────────────────────────────────────────────────────────────

/**
 * 자기검열을 수행하고 결과와 비용을 반환한다.
 *
 * 1. 검열 강도 결정 (isAdminPersona·infoRatio 기반)
 * 2. jaccardSimilarity로 중복 1차 확인 (초과 시 callModel 없이 fail 단락 처리)
 * 3. 검열관 모델 할당 조회 (없으면 ambiguous 폴백)
 * 4. callModel → parseCensorResult
 *
 * DB 상태 업데이트는 호출자(파이프라인)의 책임.
 */
export async function runSelfCensor(input: SelfCensorInput): Promise<SelfCensorOutput> {
  const { draft, persona, facts, board, titleSeed, existingPostTexts, allowObvious } =
    input;

  const strictness = decideCensorStrictness(persona);

  // 1. 중복 1차 필터 (jaccardSimilarity) — 임계 초과 시 callModel 생략으로 비용 절약
  if (existingPostTexts && existingPostTexts.length > 0) {
    if (isTooSimilar(draft, existingPostTexts, 0.6)) {
      return {
        censorResult: {
          items: [
            {
              key: "duplicate",
              result: "fail",
              reason: "기존 글과 60% 이상 유사 (자카드 유사도 1차 필터)",
            },
            { key: "factuality", result: "pass", reason: "중복 필터 단락" },
            { key: "ai_tone", result: "pass", reason: "중복 필터 단락" },
            { key: "persona", result: "pass", reason: "중복 필터 단락" },
            { key: "safety", result: "pass", reason: "중복 필터 단락" },
            { key: "context", result: "pass", reason: "중복 필터 단락" },
            { key: "insight", result: "pass", reason: "중복 필터 단락" },
          ],
          overall: "fail",
        },
        costUsd: 0,
      };
    }
  }

  // 2. 검열관 모델 할당 조회
  const db = getDb();
  const censorAssignment = await getModelAssignment(db, persona.personaId, "censor");
  if (!censorAssignment) {
    console.warn(
      `[censor] 검열관 모델 미할당 (personaId=${persona.personaId}) — ambiguous 폴백`,
    );
    return {
      censorResult: {
        items: [
          {
            key: "factuality",
            result: "ambiguous",
            reason: "검열관 모델 미할당",
          },
          { key: "ai_tone", result: "ambiguous", reason: "검열관 모델 미할당" },
          { key: "persona", result: "ambiguous", reason: "검열관 모델 미할당" },
          { key: "safety", result: "ambiguous", reason: "검열관 모델 미할당" },
          { key: "duplicate", result: "ambiguous", reason: "검열관 모델 미할당" },
          { key: "context", result: "ambiguous", reason: "검열관 모델 미할당" },
          { key: "insight", result: "ambiguous", reason: "검열관 모델 미할당" },
        ],
        overall: "ambiguous",
      },
      costUsd: 0,
    };
  }

  // 3. 검열 프롬프트 조립 및 callModel
  const systemPrompt = buildCensorSystemPrompt(strictness, { allowObvious });
  const userPrompt = buildCensorUserPrompt({
    draft,
    personaName: persona.personaName,
    tone: persona.tone,
    titleSeed,
    facts,
    board,
  });

  let responseText: string;
  let costUsd = 0;

  try {
    const response = await callModel(
      censorAssignment,
      { system: systemPrompt, user: userPrompt, maxTokens: 800 },
      { personaId: persona.personaId, jobId: input.jobId },
    );
    responseText = response.text;
    costUsd = response.costUsd;
  } catch (err) {
    // callModel 실패 → ambiguous 폴백 (ARCHITECTURE §11 fail-safe)
    console.error("[censor] callModel 실패 — ambiguous 폴백:", (err as Error).message);
    return {
      censorResult: parseCensorResult(""), // 빈 응답 → ambiguous
      costUsd: 0,
    };
  }

  // 4. 응답 파싱
  const censorResult = parseCensorResult(responseText);

  // 4-b. 가이드 강의 편: ai_tone·duplicate 축을 비차단으로 완화(오탐 방지).
  if (input.allowDidacticTone) {
    for (const item of censorResult.items) {
      if (
        (item.key === "ai_tone" || item.key === "duplicate") &&
        item.result === "fail"
      ) {
        item.result = "pass";
        item.reason = `[가이드 완화] ${item.reason}`;
      }
    }
    censorResult.overall = recomputeOverall(censorResult.items);
  }

  return { censorResult, costUsd };
}

/**
 * 커리큘럼 플랜 AI 자동 생성 — 관리자 "AI 자동 생성" 버튼 전용.
 *
 * 주제·게시판·도구·챕터 수를 받아 AI에게 강의 시리즈 구성을 생성시킨다.
 * 반환값은 CurriculumPlanCreate(시리즈 + 챕터 + 이미지 슬롯) — 곧바로 createCurriculumPlan에 넣는다.
 *
 * 설계 원칙:
 *  - 이 단계는 "플랜(뼈대)"만 만든다. 챕터 본문 초안은 draftCurriculumChapter(13.3)가,
 *    이미지 실제 조달은 슬롯 생성/업로드(13.4)가 담당한다.
 *  - 슬롯은 기본 ai_diagram(자동 도식) — 사람 개입 없이 파이프라인이 이미지까지 채울 수 있는 형태를 선호.
 *  - 모델은 게시판의 관리자 페르소나 generation 배정을 우선 사용, 없으면 임의 활성 generation 배정.
 */

import { getDb, schema } from "@ai-jakdang/database";
import { and, eq } from "drizzle-orm";
import { callModel } from "@ai-jakdang/server-bot/ai";
import type { CallModelAssignment } from "@ai-jakdang/server-bot/ai";
import type { CurriculumAutoGenerate, CurriculumPlanCreate } from "@ai-jakdang/contracts";
import { curriculumPlanCreateSchema } from "@ai-jakdang/contracts";

function makeError(message: string, code: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

// ── 모델 배정 조회 ────────────────────────────────────────────────────────────

/**
 * 플랜 생성에 쓸 텍스트 생성 모델을 고른다.
 * 1순위: 게시판의 관리자 페르소나 generation 배정.
 * 2순위: 임의 활성 generation 배정.
 */
async function resolveGenerationModel(board: string): Promise<CallModelAssignment> {
  const db = getDb();
  const { botPersonas, botPersonaBoards, botModelAssignments } = schema;

  // 1순위 — 게시판의 관리자 페르소나 generation 배정
  const adminRows = await db
    .select({
      provider: botModelAssignments.provider,
      model: botModelAssignments.model,
    })
    .from(botPersonaBoards)
    .innerJoin(botPersonas, eq(botPersonaBoards.personaId, botPersonas.id))
    .innerJoin(
      botModelAssignments,
      and(
        eq(botModelAssignments.personaId, botPersonas.id),
        eq(botModelAssignments.purpose, "generation"),
        eq(botModelAssignments.isActive, true),
      ),
    )
    .where(
      and(
        eq(botPersonaBoards.board, board),
        eq(botPersonas.isAdminPersona, true),
      ),
    )
    .limit(1);

  if (adminRows[0]) {
    return { provider: adminRows[0].provider, model: adminRows[0].model };
  }

  // 2순위 — 임의 활성 generation 배정
  const anyRows = await db
    .select({
      provider: botModelAssignments.provider,
      model: botModelAssignments.model,
    })
    .from(botModelAssignments)
    .where(
      and(
        eq(botModelAssignments.purpose, "generation"),
        eq(botModelAssignments.isActive, true),
      ),
    )
    .limit(1);

  if (anyRows[0]) {
    return { provider: anyRows[0].provider, model: anyRows[0].model };
  }

  throw makeError(
    "생성 모델 배정이 없습니다. 관리자 > 활동 봇 > AI 모델에서 generation 모델을 먼저 배정하세요.",
    "NO_GENERATION_MODEL",
  );
}

// ── 프롬프트 ─────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return [
    "당신은 한국어 온라인 커뮤니티의 '강의 커리큘럼 설계자'다.",
    "입문자가 개념 → 도구 선택/설치 → 첫 실습 → 실전 워크플로우 → 함정/안전장치 순으로",
    "무리 없이 따라올 수 있는 강의 시리즈의 '뼈대(플랜)'를 설계한다.",
    "본문 원고는 쓰지 않는다. 각 편의 제목·학습목표·다룰 소주제·본문에 넣을 이미지 자리만 설계한다.",
    "반드시 유효한 JSON 하나만 출력한다. 코드펜스·설명·주석 금지.",
  ].join("\n");
}

function buildUserPrompt(input: CurriculumAutoGenerate): string {
  const audience = input.audience?.trim() || "입문자";
  const titleHint = input.title?.trim()
    ? `시리즈 제목 힌트(참고): "${input.title.trim()}"`
    : "시리즈 제목은 네가 매력적으로 지어라.";

  return [
    `주제: ${input.topic}`,
    `주력 도구: ${input.tool}`,
    `대상 독자: ${audience}`,
    `챕터(편) 수: 정확히 ${input.chapterCount}편`,
    titleHint,
    "",
    "아래 JSON 스키마를 정확히 따르라:",
    "{",
    '  "title": string,   // 시리즈 전체 제목',
    '  "intro": string,   // 시리즈 한 줄 소개(1~2문장)',
    '  "chapters": [      // 정확히 위에서 지정한 편 수만큼',
    "    {",
    '      "title": string,          // 편 소제목',
    '      "goal": string,           // 이 편의 학습목표(2~3문장, 다룰 범위 명시)',
    '      "outline": string[],      // 이 편에서 순서대로 다룰 소주제 3~5개',
    '      "slots": [                // 본문에 넣을 이미지 자리(편당 1개 권장)',
    "        {",
    '          "assetKey": string,       // 전역 유일 키. 영문 소문자-하이픈. 예: "vibe-concept-flow"',
    '          "caption": string,        // 본문에 표시할 한국어 캡션',
    '          "alt": string,            // 한국어 대체 텍스트',
    '          "sourceKind": "ai_diagram",  // 항상 "ai_diagram"',
    '          "diagramPrompt": string   // 영문 이미지 생성 프롬프트. 개념/흐름을 나타내는 깔끔한 플랫 인포그래픽. 한국어 라벨은 정확히 렌더하도록 지시.',
    "        }",
    "      ]",
    "    }",
    "  ]",
    "}",
    "",
    "규칙:",
    `- chapters 배열 길이는 정확히 ${input.chapterCount}.`,
    "- 모든 assetKey는 시리즈 전체에서 유일해야 한다(편 번호나 주제 접두어 활용).",
    "- slots는 편당 1개를 기본으로 하되, 개념 설명에 도움되면 넣고 불필요하면 빈 배열도 허용.",
    "- diagramPrompt는 영문으로 쓰되 한국어 라벨은 그대로 렌더하도록 'render this Korean precisely, do NOT translate' 지시를 포함.",
    "- 실제 스크린샷이 필요한 UI 조작 화면은 만들지 말고 개념/흐름 도식으로 대체.",
    "- JSON 외 텍스트를 절대 출력하지 마라.",
  ].join("\n");
}

// ── JSON 파싱 ────────────────────────────────────────────────────────────────

/** 모델 응답에서 첫 번째 JSON 오브젝트를 추출해 파싱한다(코드펜스·잡텍스트 방어). */
function extractJson(text: string): unknown {
  let s = text.trim();
  // 코드펜스 제거
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw makeError("AI 응답에서 JSON을 찾지 못했습니다.", "AUTOGEN_PARSE_FAILED");
  }
  const jsonStr = s.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    throw makeError("AI 응답 JSON 파싱에 실패했습니다.", "AUTOGEN_PARSE_FAILED");
  }
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

/**
 * AI에게 커리큘럼 플랜을 생성시켜 CurriculumPlanCreate로 정규화해 반환한다.
 * (DB 저장은 호출측 createCurriculumPlan이 담당.)
 */
export async function generateCurriculumPlanDraft(
  input: CurriculumAutoGenerate,
): Promise<CurriculumPlanCreate> {
  const assignment = await resolveGenerationModel(input.board);

  let text: string;
  try {
    const res = await callModel(
      assignment,
      { system: buildSystemPrompt(), user: buildUserPrompt(input), maxTokens: 4000 },
      { usageContext: { feature: "curriculum", purpose: "auto-plan" } },
    );
    text = res.text;
  } catch (err) {
    throw makeError(
      `AI 생성 모델 호출 실패: ${(err as Error).message}`,
      "AUTOGEN_MODEL_ERROR",
    );
  }

  const raw = extractJson(text) as {
    title?: unknown;
    intro?: unknown;
    chapters?: unknown;
  };

  // board·tool·isActive는 관리자 입력을 신뢰(AI 값 무시). title은 힌트 우선.
  const candidate = {
    title: input.title?.trim() || String(raw.title ?? "").trim() || input.topic.trim(),
    board: input.board,
    tool: input.tool,
    intro: String(raw.intro ?? "").trim() || `${input.tool} 입문 강의 시리즈`,
    isActive: true,
    chapters: Array.isArray(raw.chapters) ? raw.chapters : [],
  };

  // 계약 스키마로 최종 검증(형식 불일치 시 400).
  const parsed = curriculumPlanCreateSchema.safeParse(candidate);
  if (!parsed.success) {
    throw makeError(
      `AI가 생성한 플랜 구조가 유효하지 않습니다: ${parsed.error.issues[0]?.message ?? "형식 오류"}`,
      "AUTOGEN_INVALID_STRUCTURE",
    );
  }

  return parsed.data;
}

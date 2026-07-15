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
    '          "diagramPrompt": string   // 이미지 생성 프롬프트(한국어). 이 편의 핵심 개념이 \'실제로 벌어지는 구체적인 한 장면\'을 연출해 묘사한다(주체·소품·화면/상황·행동/분위기·조명·색감/구도). 편마다 장면이 서로 달라야 하고 "사람이 책상에서 코딩" 같은 뻔한 기본 컷 반복은 금지. 실사 또는 실사에 가까운 3D/일러스트, 3~4문장 250~500자. 도식은 흐름이 정말 핵심일 때만 미니멀하게.',
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
    "- diagramPrompt는 한국어로 쓰되, 이미지 안 글자는 넣지 않는다(도식에 꼭 필요한 짧은 한국어 라벨만 큰따옴표로 감싸고 'render this Korean precisely, do NOT translate' 지시를 포함).",
    "- 각 편의 diagramPrompt는 그 편의 핵심 개념이 '실제로 벌어지는 구체적 상황·순간'을 한 장면으로 연출한다. 무엇이 보이는지·어떤 행동/상황인지·분위기·조명·색감·구도까지 구체적으로 묘사한다.",
    "- 다양성 필수: 편마다 장면이 서로 달라야 한다. '사람이 책상에서 코딩하는 모습'처럼 뻔한 기본 컷을 여러 편에 반복하지 말고, 각 편 주제만의 고유한 상황을 찾아라.",
    "- 스타일은 세련된 실사 또는 실사에 가까운 3D/일러스트로 완성도 높게. 단계·흐름·비교가 그 편의 핵심일 때만 미니멀한 도식을 쓰되 요소 3~4개 이내·넉넉한 여백. 여러 설명·라벨이 난무하는 복잡하고 정보 과밀한 인포그래픽은 금지한다.",
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

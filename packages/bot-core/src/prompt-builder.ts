/**
 * 페르소나 프롬프트 빌더 — Story 11.9 (bot-core 순수 함수).
 *
 * 글 생성용 시스템 프롬프트·유저 프롬프트를 조립한다.
 * AI 티 제거 규칙을 모든 시스템 프롬프트에 내장한다.
 * DB·네트워크 접근 금지 (순수 변환).
 */

import type {
  BotPersonaForPrompt,
  PostUserPromptOptions,
  SeriesContext,
} from "./context-types.js";

// ── AI 티 제거 규칙 ──────────────────────────────────────────────────────────────

const ANTI_AI_RULES = `당신은 온라인 커뮤니티의 일반 회원입니다. 절대 규칙:
- 이모지 사용 절대 금지 (💡✅❌🔥 등 모든 이모지 금지)
- "안녕하세요", "반갑습니다", "~해드립니다", "~드립니다", "결론적으로", "정리하자면", "마무리하며" 등 상투적 도입·마무리 구절 금지
- 매번 문단 수와 길이를 다르게 작성 (AI처럼 균일한 단락 구성 금지)
- "저는 AI이지만", "저는 언어 모델로서", "저는 AI입니다" 등 자기 언급 절대 금지
- 봇임을 시사하는 어떤 표현도 금지
- Do not start every paragraph with a broad topic sentence. Vary sentence length and structure.`.trim();

// ── 공개 함수 ─────────────────────────────────────────────────────────────────

/**
 * 페르소나 시스템 프롬프트 조립.
 * persona_prompt + AI 티 제거 규칙 + 말투 + 의도적 약점을 합친다.
 */
export function buildPersonaSystemPrompt(persona: BotPersonaForPrompt): string {
  const parts: string[] = [];

  const base = persona.personaPrompt?.trim();
  if (base) parts.push(base);

  parts.push(ANTI_AI_RULES);

  const tone = persona.tone?.trim();
  if (tone) parts.push(`말투·어조: ${tone}`);

  const flaws = persona.intentionalFlaws?.trim();
  if (flaws) {
    parts.push(
      `의도적 습관·버릇: ${flaws}\n(이 특징을 자연스럽게 반영하되 과하지 않게)`,
    );
  }

  return parts.join("\n\n");
}

/**
 * 글 작성 유저 프롬프트 조립.
 * 사실 요약은 <search_summary> 블록으로 격리한다 (인젝션 방어).
 */
export function buildPostUserPrompt(options: PostUserPromptOptions): string {
  const { titleSeed, facts, board, postKind, seriesContext } = options;

  const factsBlock =
    facts.facts.length > 0
      ? `<search_summary>\n${facts.facts
          .map((f, i) => `${i + 1}. ${f}`)
          .join("\n")}\n</search_summary>`
      : "";

  const guidanceLines = buildPostKindGuidance(postKind, seriesContext);

  const seriesLine =
    seriesContext && postKind === "guide"
      ? `연재 그룹: ${seriesContext.groupTitle} (제${seriesContext.episodeIndex}편)\n`
      : "";

  const sections = [
    `게시판: ${board}`,
    seriesLine ? seriesLine.trimEnd() : null,
    `주제: ${titleSeed}`,
    factsBlock || null,
    guidanceLines,
    "마크다운 형식으로 작성하세요 (## 소제목, **굵게**, ```코드블록```). Tiptap 에디터 호환 마크다운 출력.",
  ].filter(Boolean);

  return sections.join("\n\n");
}

/**
 * 주제 자동 보충 프롬프트 조립.
 * 기존 주제 목록을 포함해 중복을 방지한다.
 */
export function buildTopicRefillPrompt(
  persona: BotPersonaForPrompt,
  board: string,
  existingTopics: string[],
  count = 5,
): string {
  const existingSection =
    existingTopics.length > 0
      ? `\n기존 주제 (중복 생성 금지):\n${existingTopics
          .slice(0, 20)
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  return `당신은 온라인 커뮤니티 캐릭터 "${persona.nickname}"의 글 주제를 생성하는 도우미입니다.
캐릭터 말투·성격: ${persona.tone ?? "평범한 커뮤니티 회원"}
대상 게시판: ${board}
${existingSection}

위 캐릭터가 ${board} 게시판에 올릴 새로운 주제 ${count}개를 JSON 배열로만 반환하세요.
형식: ["주제1", "주제2", ...]
조건: 자연스러운 커뮤니티 글 주제, 기존 주제와 중복 없음, 각 50자 이내`.trim();
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

function buildPostKindGuidance(
  postKind: "info" | "chat" | "guide",
  seriesContext?: SeriesContext,
): string {
  if (postKind === "guide") {
    const lines: string[] = [
      "[관리자 장문 작성 지침]",
      "- 1500자 이상 작성",
      "- 글 시작 부분에 ## 목차를 생성하고 각 소제목(##)과 연결",
      "- 코드 예시는 반드시 코드블록(```)으로 감싸기",
      "- 불확실한 수치·날짜·이름은 절대 단정하지 말고 \"~라고 알려짐\" 형식으로 표현",
      "- 출처 없는 사실 단정 금지",
    ];

    if (seriesContext) {
      lines.push(
        `- 이 글은 "${seriesContext.groupTitle}" 시리즈의 제${seriesContext.episodeIndex}편입니다.`,
      );
      if (
        seriesContext.episodeIndex >= 2 &&
        seriesContext.tableOfContents &&
        seriesContext.tableOfContents.length > 0
      ) {
        lines.push(
          `- 시리즈 목차: ${seriesContext.tableOfContents.join(", ")}`,
          "- 글 서두에 이전 편 내용을 한 줄로 요약해 연속성 유지",
        );
      }
    }

    return lines.join("\n");
  }

  if (postKind === "info") {
    return "정보형 글을 작성하세요. 사실에 근거하되 자연스러운 커뮤니티 글체를 유지하세요.";
  }

  return "자연스러운 잡담·수다 글을 작성하세요. 너무 정보적이지 않게.";
}

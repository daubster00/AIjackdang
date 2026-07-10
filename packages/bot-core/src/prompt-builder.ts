/**
 * 페르소나 프롬프트 빌더 — Story 11.9 (bot-core 순수 함수).
 *
 * 글 생성용 시스템 프롬프트·유저 프롬프트를 조립한다.
 * AI 티 제거 규칙을 모든 시스템 프롬프트에 내장한다.
 * DB·네트워크 접근 금지 (순수 변환).
 */

import type {
  BotPersonaForPrompt,
  CurationContext,
  FactSummary,
  GuideChapterContext,
  PostUserPromptOptions,
  ResourceCurationContext,
  RevisionContext,
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
  const {
    titleSeed,
    facts,
    board,
    postKind,
    seriesContext,
    curation,
    resourceCuration,
    guideChapter,
    revision,
  } = options;

  // 고정 커리큘럼 강의 편: 커리큘럼이 주제·범위·이미지 자리를 정하므로 전용 지침으로 전환.
  if (guideChapter) {
    return appendRevisionBlock(buildGuideChapterUserPrompt(guideChapter, facts), revision);
  }

  // 실전자료 큐레이션(실물 자료 소개): 봇이 자료를 창작하지 않고, 검색으로 찾은
  // 실제로 널리 쓰이는 자료를 출처와 함께 소개하는 글을 쓰도록 전용 지침으로 전환한다.
  // (resource: 작성 분기보다 먼저 판정해야 큐레이션이 우선한다.)
  if (resourceCuration) {
    return appendRevisionBlock(
      buildResourceCurationUserPrompt(resourceCuration, facts),
      revision,
    );
  }

  // 큐레이션(퍼오기) 소개글: 미디어는 파이프라인이 본문 위에 자동 첨부하므로,
  // 여기서는 "그 소재를 소개하는 짧은 글"만 쓰도록 전용 지침으로 전환한다.
  if (curation) {
    return appendRevisionBlock(buildCurationUserPrompt(curation, board), revision);
  }

  // 실전자료(resource:<유형>): "~하는 방법" 칼럼이 아니라, 남이 바로 복붙해 쓰는 실물 자료를
  // 만들도록 유형별 전용 지침으로 전환한다. (board 예: "resource:prompt")
  if (board.startsWith("resource:")) {
    return appendRevisionBlock(buildResourceUserPrompt(board, titleSeed, facts), revision);
  }

  const factsBlock =
    facts.facts.length > 0
      ? `<search_summary>\n${facts.facts
          .map((f, i) => `${i + 1}. ${f}`)
          .join("\n")}\n</search_summary>`
      : "";

  const guidanceLines = buildPostKindGuidance(postKind, board, seriesContext);

  const seriesLine =
    seriesContext && postKind === "guide"
      ? `연재 그룹: ${seriesContext.groupTitle} (제${seriesContext.episodeIndex}편)\n`
      : "";

  // 형식 지시: 관리자 장문(guide)만 소제목·목차를 쓰고,
  // 일반 커뮤니티 글(chat·info)은 소제목 없이 자연스러운 줄글로 작성한다.
  const formatLine =
    postKind === "guide"
      ? "마크다운 형식으로 작성하세요 (## 소제목, **굵게**, ```코드블록```). Tiptap 에디터 호환 마크다운 출력."
      : [
          "마크다운 문단으로만 작성하세요.",
          "- 소제목(#, ##)이나 목차로 챕터를 나누지 마세요. 실제 커뮤니티 글처럼 제목 없이 자연스럽게 이어지는 줄글로 씁니다.",
          "- 문단과 문단 사이는 반드시 빈 줄 하나로 띄웁니다. 한 문단은 2~4문장 정도로, 벽돌처럼 다 붙여 쓰지 마세요.",
          "- 굵게(**)는 정말 강조할 때만 아주 드물게. 코드가 꼭 필요할 때만 ```코드블록```을 씁니다.",
        ].join("\n");

  const sections = [
    `게시판: ${board}`,
    seriesLine ? seriesLine.trimEnd() : null,
    `주제: ${titleSeed}`,
    factsBlock || null,
    guidanceLines,
    formatLine,
  ].filter(Boolean);

  return appendRevisionBlock(sections.join("\n\n"), revision);
}

/**
 * 검열 항목 키 → 재작성 시 그 항목을 어떻게 고쳐야 하는지에 대한 한국어 지침.
 * 검열관이 반환하는 CensorItemKey와 1:1 대응한다.
 */
const CENSOR_ITEM_FIX_GUIDE: Record<string, string> = {
  factuality:
    "사실성 — 근거 없이 지어낸 수치·이름·날짜 단정을 빼거나 \"~로 알려짐\" 형태로 완화하세요.",
  ai_tone:
    "AI 티 — 이모지, 자기언급(\"저는 AI/언어모델\"), 기계적 상투어(결론적으로·정리하자면·마무리하며·~해드립니다)를 제거하세요.",
  persona: "페르소나 — 캐릭터의 말투·성격을 처음부터 끝까지 일관되게 유지하세요.",
  safety: "안전 — 혐오·폭력·불법을 시사하는 표현을 삭제하세요.",
  duplicate: "중복 — 기존 글과 겹치는 부분을 다른 관점·소재로 새로 쓰세요.",
  context: "게시판 맥락 — 이 게시판 성격에 맞는 내용으로 조정하세요.",
  insight:
    "내용 비범함 — 뻔한 일반론을 빼고, 직접 해봐야 아는 구체적 디테일(설정값·수치·단축키·함정·최신 소식) 중 하나 이상을 실제로 넣으세요.",
};

/**
 * 재작성(부분 수정) 지시 블록을 기존 프롬프트 뒤에 덧붙인다.
 *
 * revision이 없거나 걸린 항목이 없으면(=최초 생성) 원본 프롬프트를 그대로 반환한다.
 * 있으면 직전 초안 전문 + "걸린 항목만" 지적을 실어, 통과한 부분은 살리고
 * 지적된 부분만 고쳐 글 전체를 다시 출력하도록 지시한다.
 */
function appendRevisionBlock(base: string, revision?: RevisionContext): string {
  if (!revision || revision.failedItems.length === 0) return base;

  const fixLines = revision.failedItems.map((item) => {
    const guide = CENSOR_ITEM_FIX_GUIDE[item.key] ?? item.key;
    const reason = item.reason?.trim();
    return reason ? `- ${guide}\n  (검열 지적: ${reason})` : `- ${guide}`;
  });

  const block = [
    "[재작성 지시 — 매우 중요]",
    "아래는 직전에 당신이 쓴 글인데, 검열에서 일부 항목이 걸려 반려되었습니다.",
    "처음부터 완전히 새로 쓰지 말고, 통과한 부분은 최대한 그대로 살린 채 아래에 지적된 문제 부분만 고쳐서 글 전체를 다시 출력하세요.",
    "",
    "이번에 반드시 고쳐야 할 부분(이 항목들만 수정):",
    ...fixLines,
    "",
    "직전 초안:",
    "---",
    revision.previousDraft.trim(),
    "---",
    "",
    "위 지적 사항만 반영해 수정한 글 전문을 출력하세요(설명·머리말 없이 본문만).",
  ].join("\n");

  return `${base}\n\n${block}`;
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

/**
 * 큐레이션(퍼오기) 소개글 유저 프롬프트.
 * 영상/이미지 자체는 파이프라인이 본문 맨 위에 자동 첨부하므로,
 * 봇은 "왜 볼 만한지" 짧게 소개하는 줄글만 쓴다.
 */
function buildCurationUserPrompt(
  curation: CurationContext,
  board: string,
): string {
  const subjectLines: string[] = [];
  if (curation.title) subjectLines.push(`제목: ${curation.title}`);
  if (curation.channel) subjectLines.push(`출처/채널: ${curation.channel}`);
  const subjectBlock =
    subjectLines.length > 0 ? `<소재>\n${subjectLines.join("\n")}\n</소재>` : "";

  const mediaWord = curation.kind === "youtube" ? "유튜브 AI 영상" : "AI 밈/이미지";
  const attachWord = curation.kind === "youtube" ? "영상" : "이미지";

  const guidance = [
    `아래 <소재>의 ${mediaWord}를 커뮤니티에 소개하는 짧은 글을 쓰세요.`,
    `- ${attachWord} 자체는 글 맨 위에 자동으로 첨부됩니다. 본문에 링크나 "아래 ${attachWord}"라는 표현을 넣지 마세요.`,
    "- 2~4문단, 각 문단 2~3문장. 왜 흥미로운지·어떤 점이 볼 만한지 본인 감상처럼 가볍게.",
    "- 직접 다 본 것처럼 세세한 줄거리를 지어내지 마세요(모르면 단정 금지). 제목/출처에서 알 수 있는 선에서만.",
    "- 뻔한 인사말·마무리 구절 금지. 이모지 금지.",
    "- 문단 사이는 빈 줄 하나로 띄웁니다.",
  ].join("\n");

  return [`게시판: ${board}`, subjectBlock || null, guidance]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * 고정 커리큘럼 "강의 편" 유저 프롬프트.
 *
 * 강의 챕터처럼: 앞 편 요약으로 이어받고 → 이번 편 학습목표·소주제를 순서대로 → 정해진
 * 자리에 이미지 마커([[IMG:key]])를 넣게 한다. 이미지 실물은 파이프라인이 치환한다.
 *
 * curriculum-staging.ts(Story 13.3)에서 직접 호출하므로 export.
 * index.ts가 이미 `export * from "./prompt-builder.js"` 로 재수출하므로
 * index.ts는 건드리지 않아도 된다.
 */
export function buildGuideChapterUserPrompt(
  gc: GuideChapterContext,
  facts: FactSummary,
): string {
  const prevBlock =
    gc.previousChapters.length > 0
      ? [
          "이전 편 요약(중복 설명 금지·자연스럽게 이어받기):",
          ...gc.previousChapters.map(
            (p) => `- ${p.order}강 "${p.title}": ${p.summary}`,
          ),
        ].join("\n")
      : "이 편이 시리즈의 첫 편입니다. 시리즈가 무엇을 다루는지 한두 문장으로만 짧게 안내하고 본론으로 들어가세요.";

  const outlineBlock = [
    "이번 편에서 순서대로 다룰 내용:",
    ...gc.outline.map((o, i) => `${i + 1}. ${o}`),
  ].join("\n");

  const imageBlock =
    gc.imageSlots.length > 0
      ? [
          "이미지 배치(중요):",
          "- 아래 각 이미지를 본문에서 그 이미지가 설명하는 문장 바로 다음 줄에, 마커만 단독으로 한 줄에 넣으세요.",
          "- 마커 형식은 정확히 `[[IMG:키]]` 입니다(대괄호 두 개). 마커 외 다른 표현(예: '아래 그림')은 쓰지 마세요.",
          "- 실제 이미지는 시스템이 그 자리에 자동으로 넣습니다. 본문에 URL이나 이미지 설명 캡션을 직접 쓰지 마세요.",
          ...gc.imageSlots.map((s) => `- [[IMG:${s.assetKey}]] → ${s.caption}`),
        ].join("\n")
      : "";

  const factsBlock =
    facts.facts.length > 0
      ? `참고 사실(있으면 자연스럽게 녹이되, 없는 내용은 지어내지 마세요):\n${facts.facts
          .map((f, i) => `${i + 1}. ${f}`)
          .join("\n")}`
      : "";

  const format = [
    "작성 형식:",
    "- 강의 한 챕터처럼 개념→구체 순으로 차분하게. 소제목(##)으로 흐름을 나누세요.",
    "- 실제 명령어·설정 값·코드는 반드시 ```코드블록```으로 정확히 제시(가짜로 지어내지 말 것).",
    "- 불확실한 수치·버전은 단정하지 말고 \"~로 알려짐\" 형식.",
    "- 분량은 1200자 이상. 이번 편 학습목표 범위를 벗어나 다음 편 내용까지 앞서 다루지 마세요.",
    "",
    "[말투 절대 규칙 — 어기면 반려됨]",
    "- 다음 상투적 강의 도입·마무리 표현을 절대 쓰지 마세요: \"이번 편에서는\", \"안내드립니다\", \"살펴보겠습니다\", \"알아보겠습니다\", \"~해보겠습니다\", \"정리하자면\", \"마무리하며\", \"지금까지\".",
    "- 인사말 없이 첫 문장부터 곧바로 내용(설명·예시·핵심)으로 들어가세요.",
    "- \"저는\", \"제가 안내\" 같은 자기언급 금지. 이모지 금지.",
    "- 사람이 자기 경험으로 설명하듯 자연스럽게. 매 문단을 같은 구조로 시작하지 마세요.",
  ].join("\n");

  return [
    `당신은 커뮤니티 공식 가이드 연재 "${gc.seriesTitle}"를 쓰는 운영진입니다. 주력 도구: ${gc.tool}.`,
    `시리즈 소개: ${gc.seriesIntro}`,
    `이번 편: ${gc.order}강 / 총 ${gc.totalChapters}강 — "${gc.chapterTitle}"`,
    `이번 편 학습목표: ${gc.goal}`,
    prevBlock,
    outlineBlock,
    factsBlock || null,
    imageBlock || null,
    format,
    `글 제목은 쓰지 말고 본문만 출력하세요(제목은 시스템이 "${gc.seriesTitle} ${gc.order}강. ${gc.chapterTitle}"로 붙입니다).`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── 실전자료(resource) 유형별 생성 지침 ───────────────────────────────────────

/**
 * 실전자료 5개 유형별 "이 글의 주인공이 되는 산출물"이 무엇인지 정의한다.
 * - label: 사람이 읽는 유형 이름
 * - artifact: 코드블록에 통째로 넣어야 하는 실물 산출물
 * - extra: 그 유형에서 추가로 꼭 적어야 하는 실무 정보(경로·명령·환경변수 등)
 */
const RESOURCE_TYPE_GUIDE: Record<
  string,
  { label: string; artifact: string; extra: string }
> = {
  prompt: {
    label: "프롬프트",
    artifact: "실제로 복사해서 바로 쓸 수 있는 프롬프트 전문",
    extra: "프롬프트 안에서 사용자가 바꿔 넣어야 하는 부분은 [대괄호 자리표시자]로 표시하세요.",
  },
  "claude-code-skill": {
    label: "Claude Code 스킬",
    artifact:
      "Claude Code에 바로 넣어 쓸 수 있는 스킬 정의 전문(예: SKILL.md 본문 또는 명령/설정 블록)",
    extra: "어느 폴더·파일에 넣고 어떻게 호출하는지 실제 경로·명령을 함께 적으세요.",
  },
  mcp: {
    label: "MCP 서버",
    artifact:
      "그대로 붙여 쓸 수 있는 MCP 서버 설정 전문(예: mcp.json 또는 설정 블록)과 연결 명령",
    extra: "필요한 설치 명령·환경변수·키는 실제 값 자리표시자와 함께 적으세요.",
  },
  "rules-config": {
    label: "규칙·설정 파일",
    artifact:
      "그대로 저장해 쓸 수 있는 규칙/설정 파일 전문(예: .cursorrules, CLAUDE.md, 설정 블록)",
    extra: "어느 파일명으로 어디에 저장하는지 명시하세요.",
  },
  "template-checklist": {
    label: "템플릿·체크리스트",
    artifact: "복사해서 채워 쓰는 템플릿 또는 체크리스트 전문",
    extra: "각 항목을 언제·어떻게 채우는지 짧게 덧붙이세요.",
  },
};

/** 실전자료 유형 코드 → 한국어 라벨. */
const RESOURCE_TYPE_LABEL_KO: Record<string, string> = {
  prompt: "프롬프트",
  "claude-code-skill": "Claude Code 스킬",
  mcp: "MCP 서버",
  "rules-config": "규칙·설정",
  "template-checklist": "템플릿·체크리스트",
};

/**
 * 실전자료 큐레이션(실물 자료 소개) 유저 프롬프트.
 *
 * 봇이 자료를 지어내지 않고, 검색으로 찾은 실제로 널리 쓰이는 자료 하나를
 * "출처와 함께 소개"하는 글을 쓰게 한다. 미디어 큐레이션(유튜브/밈)과 달리
 * 출처 링크가 글의 핵심이므로 본문에 링크를 명시하게 한다.
 */
function buildResourceCurationUserPrompt(
  rc: ResourceCurationContext,
  facts: FactSummary,
): string {
  const typeLabel = RESOURCE_TYPE_LABEL_KO[rc.resourceType] ?? "자료";

  const subjectLines = [
    `이름: ${rc.name}`,
    `유형: ${typeLabel}`,
    `출처: ${rc.sourceLabel} — ${rc.sourceUrl}`,
  ];
  if (rc.whyPopular) subjectLines.push(`왜 유명한지: ${rc.whyPopular}`);
  const subjectBlock = `<소개 대상>\n${subjectLines.join("\n")}\n</소개 대상>`;

  const factsBlock =
    facts.facts.length > 0
      ? `<search_summary>\n${facts.facts
          .map((f, i) => `${i + 1}. ${f}`)
          .join("\n")}\n</search_summary>`
      : "";

  const rules = [
    `[실전자료 큐레이션 지침 — ${typeLabel}]`,
    "이 글은 커뮤니티 '실전자료' 게시판에, 실제로 존재하고 많은 사람이 쓰는 자료를 발굴해 소개하는 글입니다.",
    "당신이 자료를 새로 지어내거나 창작하는 글이 아닙니다. 위 <소개 대상>의 실제 자료를 소개만 하세요.",
    "",
    "반드시 아래 구성을 지키세요:",
    "1. 도입(2~3문장): 이 자료가 무엇이고 어떤 상황에서 쓰는지, 왜 소개할 만한지.",
    "2. 왜 널리 쓰이는지: 신뢰·인기의 근거(공식·스타 수·자주 언급됨 등)를 <search_summary>에 근거해 구체적으로.",
    "3. 무엇이 들어있는지: 이 자료가 담고 있는 것/핵심 기능을 검색으로 확인된 선에서 소개. 모르는 내용은 지어내지 마세요.",
    "4. 쓰는 법 요약: 어디서 받고 어떻게 시작하는지 간단히.",
    `5. 출처: 본문 안에 실제 링크(${rc.sourceUrl})를 반드시 명시하세요. 독자가 바로 찾아갈 수 있게.`,
    "",
    "금지: 검색 근거에 없는 기능·수치·별점을 지어내기, 자료 내용을 통째로 베껴 옮기기(소개·요약만), 자료를 직접 만든 것처럼 쓰기.",
    "실제로 확인된 사실만 쓰고, 불확실하면 \"~로 알려짐\" 형식으로 완화하세요.",
  ].join("\n");

  const format = [
    "마크다운 문단으로 작성하세요. 소제목(##)은 꼭 필요할 때만 최소한으로.",
    "출처 링크는 마크다운 링크나 URL 그대로 본문에 노출하세요.",
    "문단과 문단 사이는 빈 줄 하나로 띄웁니다.",
    "이모지·상투적 인사말 금지. 글 제목은 쓰지 마세요(제목은 시스템이 붙입니다).",
  ].join("\n");

  return [`실전자료 소개 (${typeLabel})`, subjectBlock, factsBlock || null, rules, format]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * 실전자료(resource:<유형>) 전용 유저 프롬프트.
 *
 * 실전자료는 "프롬프트를 이렇게 써라" 같은 방법론/팁 칼럼이 아니라,
 * 남이 그대로 가져다 쓰는 실물 자료여야 한다. 유형별로 코드블록에 들어갈
 * 산출물(프롬프트/스킬/MCP설정/규칙파일/템플릿 전문)을 글의 중심에 두도록 강제한다.
 */
function buildResourceUserPrompt(
  board: string,
  titleSeed: string,
  facts: FactSummary,
): string {
  const type = board.slice("resource:".length);
  const g = RESOURCE_TYPE_GUIDE[type] ?? RESOURCE_TYPE_GUIDE.prompt!;

  const factsBlock =
    facts.facts.length > 0
      ? `<search_summary>\n${facts.facts
          .map((f, i) => `${i + 1}. ${f}`)
          .join("\n")}\n</search_summary>`
      : "";

  const rules = [
    `[실전자료 작성 지침 — ${g.label} 유형]`,
    `이 글은 커뮤니티 "실전자료" 게시판에 올라가는 재사용 자료입니다. "~하는 방법"을 설명하는 팁·칼럼이 아니라, 남이 바로 가져다 쓸 수 있는 실물 자료여야 합니다.`,
    "",
    "반드시 아래 구성을 지키세요:",
    "1. 도입(2~3문장): 이 자료가 무엇이고 어떤 상황·문제에서 쓰는지. 방법론 설명은 금지.",
    `2. 핵심 — ${g.artifact}을(를) 코드블록(\`\`\`)에 통째로 넣으세요. 이 산출물이 글의 주인공입니다. 설명보다 산출물이 먼저·크게 와야 합니다.`,
    `   ${g.extra}`,
    "3. 사용법: 위 산출물을 실제로 어떻게 적용·실행하는지 단계로. 자리표시자를 무엇으로 바꾸는지 예시.",
    "4. 효과·예시: 이 자료를 쓰면 어떤 결과가 나오는지 입력→출력 예시를 하나. 가능하면 짧은 실제 예시 출력까지.",
    "5. 팁·주의(선택): 1~2줄.",
    "",
    "금지: '프롬프트란 이렇게 써야 한다'식의 일반 작성 노하우 나열, 소제목·목차만 크고 정작 복붙할 산출물이 없는 글, '상황에 따라 다르다'로 끝나는 맹탕.",
    "코드블록 안의 산출물은 그대로 복사해도 동작·사용 가능할 만큼 완결적으로 작성하세요.",
  ].join("\n");

  const format = [
    "마크다운으로 작성하세요 (## 소제목, 코드블록 ```). Tiptap 에디터 호환.",
    "산출물(프롬프트/설정/템플릿 전문)은 반드시 코드블록으로 감싸세요.",
    "문단과 문단 사이는 빈 줄 하나로 띄웁니다.",
    "글 제목은 쓰지 마세요(제목은 시스템이 붙입니다).",
  ].join("\n");

  return [
    `실전자료 유형: ${g.label}`,
    `주제: ${titleSeed}`,
    factsBlock || null,
    rules,
    format,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/**
 * 게시판 슬러그가 "팁/노하우"성 게시판인지 판정한다.
 * (tips·guide 계열 → 남들이 잘 모르는 실전 노하우를 더 강하게 요구)
 */
function isTipsBoard(board: string): boolean {
  return (
    board.endsWith("-tips") ||
    board.endsWith("-guide") ||
    board.startsWith("resource:")
  );
}

/**
 * "뻔한 글 금지" 공통 규칙.
 * 정보형(info)·가이드(guide) 글에서 남들이 이미 다 아는 일반론을 배제하고
 * 실제로 유용한 숨은 정보를 담도록 강제한다.
 */
const NON_OBVIOUS_RULES = [
  "[내용 품질 절대 규칙 — 가장 중요]",
  "- 누구나 아는 뻔한 일반론·교과서적 조언은 절대 쓰지 마세요. (예: \"AI 코드는 사람이 검토해야 한다\", \"백업은 중요하다\" 같은 당연한 소리 금지)",
  "- 직접 해보지 않으면 모르는 구체적인 디테일을 최소 하나 담으세요: 실제 설정값·수치·단축키·옵션 이름·버전·함정·예외 케이스·비교 결과 중 하나 이상.",
  "- \"남들은 잘 모르지만 알면 유용한\" 관점 하나를 중심에 두세요. 검색으로 알게 된 최신 소식·새 기능·업데이트가 있으면 그것을 소재로 삼으세요.",
  "- 아래 <search_summary>에 사실이 있으면 그중 최소 1개를 글에 실제로 녹여 쓰세요(막연한 요약 말고 구체적으로).",
  "- 결론이 \"결국 상황에 따라 다르다\"로 끝나는 맹탕 글 금지. 본인만의 판단·기준·경험을 분명히 제시하세요.",
].join("\n");

function buildPostKindGuidance(
  postKind: "info" | "chat" | "guide",
  board: string,
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
      "",
      NON_OBVIOUS_RULES,
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
    const lines: string[] = [
      "정보형 글을 작성하세요. 사실에 근거하되 자연스러운 커뮤니티 글체를 유지하세요.",
      NON_OBVIOUS_RULES,
    ];
    if (isTipsBoard(board)) {
      lines.push(
        "이 게시판은 '팁·노하우' 성격입니다. 검색해 보면 다 나오는 기본 설명이 아니라, 실제로 써 보고 삽질해 봐야 아는 실전 노하우 하나를 콕 집어 공유하세요.",
      );
    }
    return lines.join("\n\n");
  }

  return "자연스러운 잡담·수다 글을 작성하세요. 너무 정보적이지 않게. 다만 뻔한 인사말·교과서적 설명은 빼고, 실제로 겪은 일이나 최근에 본 흥미로운 소식 하나를 가볍게 풀어 쓰세요.";
}

/**
 * 사후 이미지 플래너 (Story 13.7).
 *
 * 완성된 글 본문을 LLM에게 분석시켜
 * "몇 개의 이미지를, 어느 자리에, 어떤 내용으로" 넣을지 계획을 반환한다.
 *
 * 패키지 경계:
 *   - parseMarkdownLines는 apps/api 내부 함수 →
 *     PlanImagesOptions.markdownToTiptapFn 콜백으로 주입(경계 위반 없이).
 *   - uploadImage·genImage·fetchBotImage는 호출자(post-pipeline)가 처리.
 *
 * 도식 라벨 함정(§10):
 *   Gemini 이미지 모델은 프롬프트에 명시적 한국어 라벨이 없으면 영어 라벨을 생성하거나
 *   글자가 깨진다. PLANNER_SYSTEM_PROMPT와 buildPlannerUserPrompt 양쪽에
 *   "한국어 라벨을 쌍따옴표로 명시·은유 금지·모든 텍스트 한국어" 규칙을 포함한다.
 *
 * [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#7-사후-이미지-플래너]
 * [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#10-현재-구현-상태]
 */

import type { CallModelAssignment, AiTextResponse } from '../ai/index.js';
import { tiptapDocToMarkdown } from '@ai-jakdang/bot-core';

// ── 공개 타입 ─────────────────────────────────────────────────────────────────

/** 이미지 계획 1건 — 마커 키, 종류, 생성 지시 또는 검색어. */
export interface ImagePlanItem {
  /** 본문 마커 키 (예: "planned-0"). [[IMG:planned-0]] 형태로 본문에 삽입됨. */
  key: string;
  /** 이미지 종류. */
  kind: 'ai_diagram' | 'stock' | 'web';
  /**
   * AI 도식용 생성 프롬프트.
   * 반드시 한국어 라벨을 쌍따옴표로 명시, 은유 금지, "모든 텍스트 한국어"로 지시.
   * kind='ai_diagram'일 때 필수.
   */
  diagramPrompt?: string;
  /** 스톡/웹 이미지 검색어 (kind='stock'|'web'일 때 사용). */
  searchQuery?: string;
  /** 이미지가 들어갈 위치 앞 문단의 핵심 텍스트 (맥락 참조용, 선택). */
  positionHint?: string;
}

/** planImagesForPost 반환값. */
export interface PostImagePlan {
  /** [[IMG:planned-N]] 마커가 삽입된 수정된 Tiptap JSON 본문. */
  bodyWithMarkers: Record<string, unknown>;
  /** 각 마커에 대한 이미지 계획 (0건 가능). */
  items: ImagePlanItem[];
  /** 플래너 LLM 1회 호출 비용 (USD). */
  plannerCostUsd: number;
}

/** planImagesForPost 옵션. */
export interface PlanImagesOptions {
  /** 최대 이미지 수 (기본값: 3). */
  maxImages?: number;
  /** 도식 우선 안내 여부 (기본값: true). */
  preferDiagram?: boolean;
  /**
   * 마크다운 → Tiptap JSON 변환 함수.
   * apps/api의 parseMarkdownLines를 post-pipeline이 주입한다(패키지 경계 준수).
   * 미주입 시 bodyMarkdown을 단순 paragraph 1개 doc으로 처리한다.
   */
  markdownToTiptapFn?: (markdown: string) => Record<string, unknown>;
}

// ── 내부 타입 ─────────────────────────────────────────────────────────────────

/** LLM 이 반환하는 items 항목 1건 (파싱 전 raw 타입). */
interface RawPlanItem {
  key?: unknown;
  kind?: unknown;
  diagramPrompt?: unknown;
  searchQuery?: unknown;
  positionHint?: unknown;
}

/** LLM 응답 JSON 최상위 스키마. */
interface PlannerJsonResponse {
  bodyMarkdown?: unknown;
  items?: unknown;
}

const VALID_KINDS: ReadonlySet<string> = new Set(['ai_diagram', 'stock', 'web']);

// ── 시스템 프롬프트 ───────────────────────────────────────────────────────────

/**
 * 플래너 LLM 시스템 프롬프트.
 *
 * 역할·출력 스키마·kind 선택 규칙·도식 라벨 규칙(§10 함정 방지)·개수 제한을 명시한다.
 */
export const PLANNER_SYSTEM_PROMPT = `당신은 봇 글의 이미지 배치 전문가입니다.

역할:
완성된 글 본문을 분석해 이미지가 독자 이해에 도움될 자리를 찾고,
그 자리에 [[IMG:planned-N]] 마커를 삽입한 수정 본문과 각 마커의 이미지 스펙을 반환한다.

출력 형식 — 반드시 아래 JSON 코드 블록만 반환한다:
\`\`\`json
{
  "bodyMarkdown": "마커가 삽입된 수정 본문(마크다운 문자열 그대로)",
  "items": [
    {
      "key": "planned-0",
      "kind": "ai_diagram",
      "diagramPrompt": "도식 생성 지시문",
      "positionHint": "이 이미지 앞 문단 핵심 텍스트(선택)"
    }
  ]
}
\`\`\`

kind 선택 규칙:
- "ai_diagram" : 단계·흐름·비교·구조를 도식으로 설명 → 기본 선택.
- "stock"      : 분위기·배경 이미지가 필요할 때.
- "web"        : 특정 제품·서비스 UI 스크린샷이 필요할 때.

AI 도식(ai_diagram) 필수 규칙 — 반드시 준수:
1. diagramPrompt에 한국어 라벨을 쌍따옴표로 감싸 정확히 명시한다.
   ✅ 올바름: 상자1: "파일 열기", 상자2: "설정 확인", 화살표로 연결.
   ❌ 금지: "a diagram showing the workflow steps"
2. 은유·상징 아이콘 사용 금지 — 빗자루=청소, 자물쇠=보안 같은 추상 표현은 글자가 깨진다.
3. diagramPrompt 끝에 "모든 텍스트는 한국어로. 영어 없음."을 반드시 포함한다.
4. 번호 붙은 단계·흐름도·표 형식을 우선 사용한다.
5. 라벨 없는 추상 도식·아이콘만 있는 그림은 만들지 않는다.

개수 규칙:
- 사용자 요청의 maxImages를 초과하지 않는다.
- 글이 짧거나 설명이 단순하면 items를 빈 배열([])로 반환한다(0개 정상).
- 억지로 이미지를 끼워 넣지 않는다.

마커 삽입 위치:
- 해당 내용을 설명하는 문단 끝에 [[IMG:planned-N]]을 한 줄로 삽입한다.
- N은 0부터 시작한다.

본문 보존 규칙 — 반드시 준수:
- bodyMarkdown은 입력 본문을 "글자 그대로" 유지하고, 마커만 추가한다.
  문장을 다시 쓰거나 요약·삭제·합치지 않는다.
- 문단과 문단 사이의 빈 줄(빈 줄 하나)을 그대로 보존한다. 문단을 붙여 쓰지 않는다.
- ## 소제목, 목록, 코드블록 등 원문의 구조를 그대로 둔다.`;

// ── 유저 프롬프트 빌더 ────────────────────────────────────────────────────────

/**
 * 플래너 LLM에 전달할 유저 프롬프트를 생성한다.
 *
 * @param bodyText  본문 평문 텍스트 (extractTextFromTiptap으로 추출)
 * @param titleSeed 글 제목 힌트
 * @param maxImages 최대 이미지 수
 */
export function buildPlannerUserPrompt(
  bodyText: string,
  titleSeed: string,
  maxImages: number,
): string {
  return `다음 글 본문을 분석해 이미지 배치 계획을 반환하라.

제목 힌트: ${titleSeed}
최대 이미지 수: ${maxImages}개

본문:
---
${bodyText}
---

지시:
1. 본문을 읽고 이미지가 독자 이해에 도움될 자리를 최대 ${maxImages}개 찾는다.
   이미지가 필요 없으면 items는 빈 배열, bodyMarkdown은 원본 그대로 반환한다.
2. 찾은 자리에 [[IMG:planned-0]], [[IMG:planned-1]], ... 마커를 삽입한 수정 본문을 만든다.
3. 각 마커의 kind와 이미지 스펙을 JSON으로 반환한다.
   ai_diagram: diagramPrompt에 한국어 라벨을 쌍따옴표로 명시.
               "모든 텍스트는 한국어로. 영어 없음."을 반드시 포함.
   stock/web : searchQuery에 검색어 입력.

반드시 JSON 코드 블록으로만 응답한다.`;
}

// ── LLM 응답 파싱 ─────────────────────────────────────────────────────────────

/**
 * 플래너 LLM 응답 텍스트를 파싱해 bodyWithMarkers와 items를 반환한다.
 *
 * - JSON 블록 추출: ```json ... ``` → ``` ... ``` → 직접 JSON 순서로 시도
 * - kind가 알 수 없는 값이면 'ai_diagram'으로 강제
 * - maxImages 초과 항목은 잘라낸다
 * - 파싱 실패 시 { bodyWithMarkers: originalBody, items: [] } 반환(게시 차단 금지)
 *
 * @param responseText       LLM 응답 텍스트
 * @param originalBody       파싱 실패 시 폴백할 원본 Tiptap JSON
 * @param markdownToTiptapFn 마크다운→Tiptap 변환 함수 (post-pipeline 주입)
 * @param maxImages          최대 이미지 수 (초과 항목 잘라내기)
 */
export function parsePlannerResponse(
  responseText: string,
  originalBody: Record<string, unknown>,
  markdownToTiptapFn?: (markdown: string) => Record<string, unknown>,
  maxImages?: number,
): { bodyWithMarkers: Record<string, unknown>; items: ImagePlanItem[] } {
  const emptyResult = { bodyWithMarkers: originalBody, items: [] as ImagePlanItem[] };

  try {
    // JSON 블록 추출: ```json ... ``` → ``` ... ``` → 직접 JSON
    let jsonStr: string | null = null;

    const jsonFenced = responseText.match(/```json\s*([\s\S]*?)```/);
    if (jsonFenced?.[1]) {
      jsonStr = jsonFenced[1].trim();
    } else {
      const plainFenced = responseText.match(/```\s*([\s\S]*?)```/);
      if (plainFenced?.[1]) {
        jsonStr = plainFenced[1].trim();
      } else {
        const trimmed = responseText.trim();
        if (trimmed.startsWith('{')) jsonStr = trimmed;
      }
    }

    if (!jsonStr) return emptyResult;

    const parsed = JSON.parse(jsonStr) as PlannerJsonResponse;

    // items 파싱 및 검증
    const rawItems = Array.isArray(parsed.items) ? (parsed.items as RawPlanItem[]) : [];
    const limit = maxImages ?? 3;

    const items: ImagePlanItem[] = rawItems
      .slice(0, limit)
      .map((raw, idx) => {
        const key =
          typeof raw.key === 'string' && raw.key ? raw.key : `planned-${idx}`;
        const rawKind = typeof raw.kind === 'string' ? raw.kind : '';
        // kind가 알 수 없는 값이면 'ai_diagram'으로 강제
        const kind: ImagePlanItem['kind'] = VALID_KINDS.has(rawKind)
          ? (rawKind as ImagePlanItem['kind'])
          : 'ai_diagram';

        const item: ImagePlanItem = { key, kind };
        if (typeof raw.diagramPrompt === 'string' && raw.diagramPrompt)
          item.diagramPrompt = raw.diagramPrompt;
        if (typeof raw.searchQuery === 'string' && raw.searchQuery)
          item.searchQuery = raw.searchQuery;
        if (typeof raw.positionHint === 'string' && raw.positionHint)
          item.positionHint = raw.positionHint;
        return item;
      });

    // bodyMarkdown → Tiptap JSON 변환
    let bodyWithMarkers: Record<string, unknown> = originalBody;
    if (typeof parsed.bodyMarkdown === 'string' && parsed.bodyMarkdown.trim()) {
      if (markdownToTiptapFn) {
        bodyWithMarkers = markdownToTiptapFn(parsed.bodyMarkdown);
      } else {
        // 주입 함수 없음 → 단순 paragraph 1개 doc
        bodyWithMarkers = {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: parsed.bodyMarkdown }] },
          ],
        };
      }
    }

    return { bodyWithMarkers, items };
  } catch {
    return emptyResult;
  }
}

// ── 메인 함수 ─────────────────────────────────────────────────────────────────

/**
 * 완성된 Tiptap JSON 본문을 LLM에게 분석시켜 이미지 배치 계획을 반환한다.
 *
 * 실패 시 { bodyWithMarkers: body, items: [], plannerCostUsd: 0 }을 반환한다(게시 차단 금지).
 *
 * @param body            완성된 Tiptap JSON 본문
 * @param titleSeed       글 제목 힌트 (topic.titleSeed)
 * @param modelAssignment 호출할 LLM 모델 할당
 * @param callModelFn     LLM 호출 함수 (post-pipeline이 callModel을 주입)
 * @param opts            최대 이미지 수·마크다운 변환 함수 등
 */
export async function planImagesForPost(
  body: Record<string, unknown>,
  titleSeed: string,
  modelAssignment: CallModelAssignment,
  callModelFn: (
    assignment: CallModelAssignment,
    prompt: { system: string; user: string; maxTokens?: number },
  ) => Promise<AiTextResponse>,
  opts?: PlanImagesOptions,
): Promise<PostImagePlan> {
  const maxImages = opts?.maxImages ?? 3;
  const markdownToTiptapFn = opts?.markdownToTiptapFn;

  try {
    // 1. 본문을 "구조 보존" 마크다운으로 직렬화.
    //    ⚠️ extractTextFromTiptap(공백 뭉치기)를 쓰면 문단·빈 줄 구분이 사라져
    //    재파싱 시 빈 문단(줄 간격)이 전멸한다 → tiptapDocToMarkdown으로 블록
    //    사이 빈 줄을 유지해야 원문 간격이 보존된다.
    const bodyText = tiptapDocToMarkdown(body);

    // 2. 유저 프롬프트 생성
    const userPrompt = buildPlannerUserPrompt(bodyText, titleSeed, maxImages);

    // 3. LLM 1회 호출
    const response = await callModelFn(modelAssignment, {
      system: PLANNER_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 800,
    });

    // 4. 응답 파싱
    const { bodyWithMarkers, items } = parsePlannerResponse(
      response.text,
      body,
      markdownToTiptapFn,
      maxImages,
    );

    return { bodyWithMarkers, items, plannerCostUsd: response.costUsd };
  } catch {
    // 플래너 자체 실패 → 원본 본문 + 빈 계획(게시 차단 금지)
    return { bodyWithMarkers: body, items: [], plannerCostUsd: 0 };
  }
}

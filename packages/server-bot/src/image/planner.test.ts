/**
 * 사후 이미지 플래너 단위 테스트 — Story 13.7 Task 4.4.
 *
 * parsePlannerResponse는 순수 함수이므로 LLM 모킹 없이 직접 검증한다.
 * 4가지 케이스: 파싱 성공 / 파싱 실패 / maxImages 초과 잘라내기 / kind 강제.
 */

import { describe, it, expect } from 'vitest';
import { parsePlannerResponse } from './planner.js';

// ── 픽스처 ─────────────────────────────────────────────────────────────────────

const baseDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: '원본 본문 텍스트' }] }],
};

/** 테스트용 마크다운→Tiptap 변환 스텁 (단순 paragraph 1개로 감쌈). */
function simpleMarkdownToTiptap(md: string): Record<string, unknown> {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: md }] }],
  };
}

// ── 테스트 ─────────────────────────────────────────────────────────────────────

describe('parsePlannerResponse', () => {
  // ── 케이스 1: 파싱 성공 ───────────────────────────────────────────────────────

  it('정상 JSON 블록 → items 와 변환된 bodyWithMarkers 반환', () => {
    const llmResponse = `\`\`\`json
{
  "bodyMarkdown": "설명 문단입니다. [[IMG:planned-0]]",
  "items": [
    {
      "key": "planned-0",
      "kind": "ai_diagram",
      "diagramPrompt": "흐름도: 상자1: \\"1단계\\", 상자2: \\"2단계\\". 모든 텍스트는 한국어로. 영어 없음.",
      "positionHint": "설명 문단"
    }
  ]
}
\`\`\``;

    const result = parsePlannerResponse(llmResponse, baseDoc, simpleMarkdownToTiptap, 3);

    // items 검증
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      key: 'planned-0',
      kind: 'ai_diagram',
    });
    expect(result.items[0]?.diagramPrompt).toContain('한국어');
    expect(result.items[0]?.positionHint).toBe('설명 문단');

    // bodyWithMarkers: markdownToTiptapFn이 호출됨 → 마커 포함 텍스트
    const body = result.bodyWithMarkers as {
      type: string;
      content: Array<{ type: string; content: Array<{ text: string }> }>;
    };
    expect(body.type).toBe('doc');
    expect(body.content[0]?.content[0]?.text).toContain('[[IMG:planned-0]]');
  });

  // ── 케이스 2: 파싱 실패(깨진 JSON) ──────────────────────────────────────────

  it('깨진 JSON 응답 → { items: [], bodyWithMarkers: 원본 } 반환', () => {
    const badResponse = 'LLM이 이상한 텍스트를 반환했습니다. { broken : json here }';

    const result = parsePlannerResponse(badResponse, baseDoc, simpleMarkdownToTiptap, 3);

    expect(result.items).toEqual([]);
    expect(result.bodyWithMarkers).toEqual(baseDoc);
  });

  // ── 케이스 3: maxImages 초과 → 잘라내기 ─────────────────────────────────────

  it('items 4건이지만 maxImages=2 → 앞 2건만 반환', () => {
    const llmResponse = `\`\`\`json
{
  "bodyMarkdown": "본문 [[IMG:planned-0]] [[IMG:planned-1]] [[IMG:planned-2]] [[IMG:planned-3]]",
  "items": [
    { "key": "planned-0", "kind": "ai_diagram", "diagramPrompt": "도식0. 모든 텍스트는 한국어로. 영어 없음." },
    { "key": "planned-1", "kind": "ai_diagram", "diagramPrompt": "도식1. 모든 텍스트는 한국어로. 영어 없음." },
    { "key": "planned-2", "kind": "stock", "searchQuery": "검색어2" },
    { "key": "planned-3", "kind": "web", "searchQuery": "검색어3" }
  ]
}
\`\`\``;

    const result = parsePlannerResponse(llmResponse, baseDoc, simpleMarkdownToTiptap, 2);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.key).toBe('planned-0');
    expect(result.items[1]?.key).toBe('planned-1');
  });

  // ── 케이스 4: 알 수 없는 kind → ai_diagram 강제 ─────────────────────────────

  it('kind가 알 수 없는 값이면 ai_diagram으로 강제한다', () => {
    const llmResponse = `\`\`\`json
{
  "bodyMarkdown": "본문 [[IMG:planned-0]]",
  "items": [
    { "key": "planned-0", "kind": "screenshot", "searchQuery": "화면 캡처 이미지" }
  ]
}
\`\`\``;

    const result = parsePlannerResponse(llmResponse, baseDoc, simpleMarkdownToTiptap, 3);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe('ai_diagram');
    // searchQuery는 그대로 보존
    expect(result.items[0]?.searchQuery).toBe('화면 캡처 이미지');
  });
});

/**
 * 사후 이미지 플래너 단위 테스트 — Story 13.7 Task 4.4.
 *
 * parsePlannerResponse는 순수 함수이므로 LLM 모킹 없이 직접 검증한다.
 * B안(코드가 결정적으로 마커 삽입) 이후: LLM은 items만 반환하고, bodyWithMarkers는
 * parse 내부에서 positionHint 기준으로 코드가 [[IMG:key]]를 꽂아 만든다.
 */

import { describe, it, expect } from 'vitest';
import { parsePlannerResponse } from './planner.js';

// ── 픽스처 ─────────────────────────────────────────────────────────────────────

const baseDoc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: '첫 문단 도입입니다.' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '설명 문단입니다. 이 자리에 이미지가 필요합니다.' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '마지막 정리 문단입니다.' }] },
  ],
};

/** doc 안의 모든 문단 텍스트를 이어붙여 반환(마커 삽입 검증용). */
function allParagraphText(doc: unknown): string {
  const content = (doc as { content?: Array<Record<string, unknown>> }).content ?? [];
  return content
    .map((n) => {
      const inner = (n as { content?: Array<{ text?: string }> }).content ?? [];
      return inner.map((c) => c.text ?? '').join('');
    })
    .join('\n');
}

/** doc 안의 [[IMG:...]] 마커 개수. */
function countMarkers(doc: unknown): number {
  return (allParagraphText(doc).match(/\[\[IMG:[a-zA-Z0-9_-]+\]\]/g) ?? []).length;
}

// ── 테스트 ─────────────────────────────────────────────────────────────────────

describe('parsePlannerResponse', () => {
  // ── 케이스 1: 파싱 성공 + positionHint 매칭 삽입 ──────────────────────────────

  it('정상 JSON(items만) → items 반환 + positionHint 문단 뒤에 마커 삽입', () => {
    const llmResponse = `\`\`\`json
{
  "items": [
    {
      "key": "planned-0",
      "kind": "ai_diagram",
      "diagramPrompt": "흐름도: 상자1: \\"1단계\\", 상자2: \\"2단계\\". 모든 텍스트는 한국어로. 영어 없음.",
      "positionHint": "설명 문단입니다"
    }
  ]
}
\`\`\``;

    const result = parsePlannerResponse(llmResponse, baseDoc, 3);

    // items 검증
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ key: 'planned-0', kind: 'ai_diagram' });
    expect(result.items[0]?.diagramPrompt).toContain('한국어');
    expect(result.items[0]?.positionHint).toBe('설명 문단입니다');

    // bodyWithMarkers: 코드가 [[IMG:planned-0]] 마커를 정확히 1개 삽입
    expect(countMarkers(result.bodyWithMarkers)).toBe(1);
    expect(allParagraphText(result.bodyWithMarkers)).toContain('[[IMG:planned-0]]');
    // 매칭 문단("설명 문단...") 바로 뒤에 삽입됐는지 확인
    const content = (result.bodyWithMarkers as { content: Array<Record<string, unknown>> }).content;
    const markerIdx = content.findIndex(
      (n) =>
        (n as { content?: Array<{ text?: string }> }).content?.[0]?.text === '[[IMG:planned-0]]',
    );
    expect(markerIdx).toBe(2); // 원본 index 1(설명 문단) 바로 뒤
  });

  // ── 케이스 2: 파싱 실패(깨진 JSON) ──────────────────────────────────────────

  it('깨진 JSON 응답 → { items: [], bodyWithMarkers: 원본 } 반환', () => {
    const badResponse = 'LLM이 이상한 텍스트를 반환했습니다. { broken : json here }';

    const result = parsePlannerResponse(badResponse, baseDoc, 3);

    expect(result.items).toEqual([]);
    expect(result.bodyWithMarkers).toEqual(baseDoc);
  });

  // ── 케이스 3: maxImages 초과 → 잘라내기 + 마커도 그 수만큼 ────────────────────

  it('items 4건이지만 maxImages=2 → 앞 2건만 반환하고 마커도 2개', () => {
    const llmResponse = `\`\`\`json
{
  "items": [
    { "key": "planned-0", "kind": "ai_diagram", "diagramPrompt": "도식0. 모든 텍스트는 한국어로. 영어 없음.", "positionHint": "첫 문단 도입" },
    { "key": "planned-1", "kind": "ai_diagram", "diagramPrompt": "도식1. 모든 텍스트는 한국어로. 영어 없음.", "positionHint": "마지막 정리" },
    { "key": "planned-2", "kind": "stock", "searchQuery": "검색어2" },
    { "key": "planned-3", "kind": "web", "searchQuery": "검색어3" }
  ]
}
\`\`\``;

    const result = parsePlannerResponse(llmResponse, baseDoc, 2);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.key).toBe('planned-0');
    expect(result.items[1]?.key).toBe('planned-1');
    expect(countMarkers(result.bodyWithMarkers)).toBe(2);
  });

  // ── 케이스 4: 알 수 없는 kind → ai_diagram 강제 ─────────────────────────────

  it('kind가 알 수 없는 값이면 ai_diagram으로 강제한다', () => {
    const llmResponse = `\`\`\`json
{
  "items": [
    { "key": "planned-0", "kind": "screenshot", "searchQuery": "화면 캡처 이미지" }
  ]
}
\`\`\``;

    const result = parsePlannerResponse(llmResponse, baseDoc, 3);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe('ai_diagram');
    // searchQuery는 그대로 보존
    expect(result.items[0]?.searchQuery).toBe('화면 캡처 이미지');
  });

  // ── 케이스 5: positionHint가 안 맞아도(또는 없어도) 마커는 반드시 삽입된다 ────

  it('positionHint가 본문과 안 맞아도 모든 item에 마커가 1개씩 삽입된다(유실 방지 보장)', () => {
    const llmResponse = `\`\`\`json
{
  "items": [
    { "key": "planned-0", "kind": "ai_diagram", "diagramPrompt": "도식0.", "positionHint": "본문에 전혀 없는 문구 XYZ" },
    { "key": "planned-1", "kind": "ai_diagram", "diagramPrompt": "도식1." }
  ]
}
\`\`\``;

    const result = parsePlannerResponse(llmResponse, baseDoc, 3);

    expect(result.items).toHaveLength(2);
    // 매칭 실패/힌트 없음이라도 균등 분배로 2개 모두 삽입 — 생성 이미지 유실 없음
    expect(countMarkers(result.bodyWithMarkers)).toBe(2);
    expect(allParagraphText(result.bodyWithMarkers)).toContain('[[IMG:planned-0]]');
    expect(allParagraphText(result.bodyWithMarkers)).toContain('[[IMG:planned-1]]');
  });
});

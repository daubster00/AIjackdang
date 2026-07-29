/**
 * ai-video 단위 테스트 — 감상용 AI 창작 영상 큐레이션.
 *
 * - searchYoutubeVideoCandidates(Brave 영상 검색)는 vi.mock으로 대체.
 * - callModel(LLM)은 주입 스텁으로 대체(검색어 생성 1회 + 후보 선택 1회).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { BotModelAssignment } from '@ai-jakdang/contracts';
import type { CallModelFn } from './index';

const { mockSearchCandidates } = vi.hoisted(() => ({
  mockSearchCandidates: vi.fn(),
}));

vi.mock('./brave', () => ({
  BRAVE_SEARCH_COST_PER_QUERY_USD: 0,
}));
vi.mock('./brave-video', () => ({
  searchYoutubeVideoCandidates: mockSearchCandidates,
}));

import { discoverAiCreativeVideo, isRejectedVideoTitle } from './ai-video';

const assignment = { provider: 'google', model: 'gemini', purpose: 'generation' } as unknown as BotModelAssignment;

/** callModel 스텁: 1번째 호출=검색어 생성, 2번째 호출=후보 선택. */
function makeCallModel(queryJson: string, selectJson: string): CallModelFn {
  return vi
    .fn()
    .mockResolvedValueOnce({ text: queryJson, usage: { inputTokens: 0, outputTokens: 0 }, costUsd: 0 })
    .mockResolvedValueOnce({ text: selectJson, usage: { inputTokens: 0, outputTokens: 0 }, costUsd: 0 });
}

beforeEach(() => {
  mockSearchCandidates.mockReset();
});

describe('isRejectedVideoTitle', () => {
  it('툴 비교·리뷰·튜토리얼·종료서비스 제목은 거부', () => {
    expect(isRejectedVideoTitle('Sora vs Kling vs Runway comparison')).toBe(true);
    expect(isRejectedVideoTitle('Best AI video tool review 2026')).toBe(true);
    expect(isRejectedVideoTitle('How to make AI video tutorial')).toBe(true);
    expect(isRejectedVideoTitle('Top 10 AI animations')).toBe(true);
    // 종료 서비스명(sora) 단독 포함도 거부
    expect(isRejectedVideoTitle('Amazing Sora animation short')).toBe(true);
  });

  it('순수 감상용 창작물 제목은 통과', () => {
    expect(isRejectedVideoTitle('AI generated music video — Neon Dreams')).toBe(false);
    expect(isRejectedVideoTitle('A short animated film made with AI')).toBe(false);
  });
});

describe('discoverAiCreativeVideo', () => {
  const goodCandidate = {
    url: 'https://youtube.com/watch?v=abc',
    title: 'AI music video — Neon Dreams',
    channel: 'AI Studio',
    pageUrl: 'https://youtube.com/watch?v=abc',
  };

  it('후보 확보 후 LLM이 감상용 영상을 고르면 video+titleSeed 반환', async () => {
    mockSearchCandidates.mockResolvedValue([goodCandidate]);
    const callModel = makeCallModel(
      '{"queries":["AI music video","AI short film","AI animation"]}',
      '{"chosenIndex":0,"titleSeed":"네온빛 꿈속을 걷다","reason":"AI 뮤직비디오 창작물"}',
    );

    const result = await discoverAiCreativeVideo({ modelAssignment: assignment, callModel });

    expect(result).not.toBeNull();
    expect(result!.video.url).toBe(goodCandidate.url);
    expect(result!.titleSeed).toBe('네온빛 꿈속을 걷다');
  });

  it('LLM이 chosenIndex=-1(감상용 없음)이면 null', async () => {
    mockSearchCandidates.mockResolvedValue([goodCandidate]);
    const callModel = makeCallModel(
      '{"queries":["AI music video"]}',
      '{"chosenIndex":-1,"reason":"감상용 창작물 없음"}',
    );

    const result = await discoverAiCreativeVideo({ modelAssignment: assignment, callModel });
    expect(result).toBeNull();
  });

  it('하드 프리필터가 비교/종료서비스 후보를 전부 걸러 후보 0건이면 null(선택 LLM 미호출)', async () => {
    mockSearchCandidates.mockResolvedValue([
      { url: 'https://youtube.com/watch?v=1', title: 'Sora vs Kling comparison', channel: null, pageUrl: 'x' },
      { url: 'https://youtube.com/watch?v=2', title: 'Runway review 2026', channel: null, pageUrl: 'y' },
    ]);
    const callModel = vi
      .fn()
      .mockResolvedValueOnce({ text: '{"queries":["AI short film"]}', usage: { inputTokens: 0, outputTokens: 0 }, costUsd: 0 });

    const result = await discoverAiCreativeVideo({
      modelAssignment: assignment,
      callModel: callModel as unknown as CallModelFn,
    });

    expect(result).toBeNull();
    // 검색어 생성 1회만 호출되고, 후보가 0건이라 선택 LLM은 호출되지 않아야 함.
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  it('비용 상한(onCostAccumulated throw) 도달 시 null', async () => {
    mockSearchCandidates.mockResolvedValue([goodCandidate]);
    // 검색어 생성에 비용(0.01)이 발생 → onCostAccumulated 호출 → throw로 상한 도달 재현.
    const callModel = vi
      .fn()
      .mockResolvedValueOnce({ text: '{"queries":["AI music video"]}', usage: { inputTokens: 0, outputTokens: 0 }, costUsd: 0.01 })
      .mockResolvedValueOnce({ text: '{"chosenIndex":0,"titleSeed":"x"}', usage: { inputTokens: 0, outputTokens: 0 }, costUsd: 0 }) as unknown as CallModelFn;
    const onCostAccumulated = vi.fn().mockRejectedValue(new Error('daily cap'));

    const result = await discoverAiCreativeVideo({
      modelAssignment: assignment,
      callModel,
      onCostAccumulated,
    });
    expect(result).toBeNull();
  });
});

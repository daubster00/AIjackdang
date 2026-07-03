/**
 * groundTopic + summarizeFacts 단위 테스트 (Story 11.7 / Task 5.3).
 *
 * - searchBrave, searchNaver는 vi.mock으로 대체.
 * - callModel은 GroundTopicOptions.callModel 주입으로 mock.
 * - 실제 외부 API 호출 없음.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { BotModelAssignment } from '@ai-jakdang/contracts';
import type { CallModelFn } from './index';

// ── 어댑터 mock ───────────────────────────────────────────────────────────────
const mockSearchBrave = vi.hoisted(() => vi.fn());
const mockSearchNaver = vi.hoisted(() => vi.fn());

vi.mock('./brave', () => ({
  searchBrave: mockSearchBrave,
  BRAVE_SEARCH_COST_PER_QUERY_USD: 0,
}));

vi.mock('./google', () => ({
  searchGoogle: vi.fn(),
  GOOGLE_SEARCH_COST_PER_QUERY_USD: 0.005,
  // SearchResult은 타입 — 런타임 export 불필요
}));

vi.mock('./naver', () => ({
  searchNaver: mockSearchNaver,
  NAVER_SEARCH_COST_PER_QUERY_USD: 0,
}));

import { groundTopic } from './index';

// ── 테스트 픽스처 ─────────────────────────────────────────────────────────────

const mockModelAssignment: BotModelAssignment = {
  id: 'assign-uuid-1234',
  personaId: 'persona-uuid-1234',
  provider: 'anthropic',
  model: 'claude-3-5-haiku-20241022',
  purpose: 'generation',
  isActive: true,
  note: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockSearchResults = [
  {
    title: 'GPT-5 released by OpenAI',
    snippet: 'OpenAI has reportedly released GPT-5 with advanced reasoning capabilities.',
    url: 'https://openai.com/gpt5',
    source: 'naver' as const,
  },
];

// ── 테스트 ───────────────────────────────────────────────────────────────────

describe('groundTopic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchBrave.mockResolvedValue([]);
    mockSearchNaver.mockResolvedValue([]);
  });

  describe("intensity='none': 검색 없이 null 반환 (AC #3)", () => {
    it("intensity='none'이면 null을 반환한다", async () => {
      const result = await groundTopic('잡담 주제', 'none');

      expect(result).toBeNull();
    });

    it("intensity='none'이면 searchBrave, searchNaver 호출이 없다", async () => {
      await groundTopic('잡담 주제', 'none');

      expect(mockSearchBrave).not.toHaveBeenCalled();
      expect(mockSearchNaver).not.toHaveBeenCalled();
    });
  });

  describe("intensity='light': Naver만 호출, Brave 없음 (AC #3)", () => {
    it("intensity='light'이면 searchBrave를 호출하지 않는다", async () => {
      await groundTopic('트렌드 주제', 'light');

      expect(mockSearchBrave).not.toHaveBeenCalled();
    });

    it("intensity='light'이면 searchNaver를 2회 호출한다 (news + blog)", async () => {
      await groundTopic('트렌드 주제', 'light');

      expect(mockSearchNaver).toHaveBeenCalledTimes(2);
      expect(mockSearchNaver).toHaveBeenCalledWith('트렌드 주제', 'news', 5);
      expect(mockSearchNaver).toHaveBeenCalledWith('트렌드 주제', 'blog', 3);
    });

    it("intensity='light', 결과 없음+모델 없음이면 null 반환", async () => {
      mockSearchNaver.mockResolvedValue([]);

      const result = await groundTopic('트렌드 주제', 'light');

      expect(result).toBeNull();
    });

    it("intensity='light', 결과 있음+모델 없음이면 최소 FactGrounding 반환 (AI 없음)", async () => {
      mockSearchNaver.mockResolvedValueOnce(mockSearchResults).mockResolvedValueOnce([]);

      const result = await groundTopic('트렌드 주제', 'light');

      expect(result).not.toBeNull();
      expect(result!.facts).toEqual([]);
      expect(result!.confidence).toBe('low');
      expect(result!.rawSnippetCount).toBe(1);
    });
  });

  describe("intensity='full': Brave + Naver 2종 호출 (AC #3)", () => {
    it("intensity='full'이면 searchBrave, searchNaver(news), searchNaver(webkr)을 호출한다", async () => {
      await groundTopic('AI 주제', 'full');

      expect(mockSearchBrave).toHaveBeenCalledTimes(1);
      expect(mockSearchNaver).toHaveBeenCalledWith('AI 주제', 'news', 5);
      expect(mockSearchNaver).toHaveBeenCalledWith('AI 주제', 'webkr', 5);
    });

    it("intensity='full', englishQuery 제공 시 searchBrave에 영어 쿼리가 전달된다", async () => {
      await groundTopic('AI 최신 소식', 'full', { englishQuery: 'AI latest news' });

      expect(mockSearchBrave).toHaveBeenCalledWith(
        'AI latest news',
        8,
        { country: 'US', searchLang: 'en' },
      );
    });

    it("intensity='full', englishQuery 없으면 원 토픽으로 Brave 검색한다", async () => {
      await groundTopic('AI 최신 소식', 'full');

      expect(mockSearchBrave).toHaveBeenCalledWith(
        'AI 최신 소식',
        8,
        { country: 'US', searchLang: 'en' },
      );
    });

    it('Brave 결과가 Naver 결과보다 앞에 정렬된다', async () => {
      const braveResult = { ...mockSearchResults[0]!, source: 'brave' as const, url: 'https://openai.com/g' };
      const naverResult = { ...mockSearchResults[0]!, source: 'naver' as const, url: 'https://naver.com/n' };

      mockSearchBrave.mockResolvedValue([braveResult]);
      mockSearchNaver.mockResolvedValue([naverResult]);

      const result = await groundTopic('AI 주제', 'full');

      expect(result!.sourceUrls[0]).toBe('https://openai.com/g');
      expect(result!.sourceUrls[1]).toBe('https://naver.com/n');
    });
  });

  describe('비용 누적 콜백 (AC #5)', () => {
    it('onCostAccumulated가 검색 비용으로 호출된다', async () => {
      const onCostAccumulated = vi.fn().mockResolvedValue(undefined);
      mockSearchNaver.mockResolvedValue(mockSearchResults);

      await groundTopic('트렌드 주제', 'light', {
        onCostAccumulated,
      });

      expect(onCostAccumulated).toHaveBeenCalledWith(0); // Naver 비용 = 0
    });

    it('onCostAccumulated가 throw하면 null 반환 (비용 상한 도달)', async () => {
      const onCostAccumulated = vi.fn().mockRejectedValue(new Error('비용 상한 초과'));

      const result = await groundTopic('주제', 'light', { onCostAccumulated });

      expect(result).toBeNull();
    });
  });

  describe('callModel 주입으로 summarizeFacts AI 요약 (AC #4)', () => {
    it('callModel이 있으면 AI 요약을 호출하고 FactGrounding을 반환한다', async () => {
      mockSearchNaver.mockResolvedValue(mockSearchResults);

      const mockCallModel: CallModelFn = vi.fn().mockResolvedValue({
        text: JSON.stringify({ facts: ['GPT-5가 출시됐다고 알려짐'], confidence: 'medium' }),
        usage: { inputTokens: 100, outputTokens: 50 },
        costUsd: 0.001,
      });

      const result = await groundTopic('GPT-5 출시', 'light', {
        modelAssignment: mockModelAssignment,
        callModel: mockCallModel,
      });

      expect(result).not.toBeNull();
      expect(result!.facts).toEqual(['GPT-5가 출시됐다고 알려짐']);
      expect(result!.confidence).toBe('medium');
      expect(mockCallModel).toHaveBeenCalledTimes(1);
    });

    it("callModel에 <untrusted_search_content> 태그가 포함된 user 메시지가 전달된다 (AC #4 인젝션 방어)", async () => {
      mockSearchNaver.mockResolvedValue(mockSearchResults);

      let capturedPrompt: { system: string; user: string } | undefined;

      const mockCallModel: CallModelFn = vi.fn().mockImplementation(
        (_assignment, prompt) => {
          capturedPrompt = prompt;
          return Promise.resolve({
            text: JSON.stringify({ facts: [], confidence: 'low' }),
            usage: { inputTokens: 50, outputTokens: 10 },
            costUsd: 0.0005,
          });
        },
      );

      await groundTopic('AI 주제', 'light', {
        modelAssignment: mockModelAssignment,
        callModel: mockCallModel,
      });

      expect(capturedPrompt).toBeDefined();
      expect(capturedPrompt!.user).toContain('<untrusted_search_content>');
      expect(capturedPrompt!.user).toContain('</untrusted_search_content>');
    });

    it('callModel JSON 파싱 실패 시 confidence=low, facts=[] 폴백 (throw 없음)', async () => {
      mockSearchNaver.mockResolvedValue(mockSearchResults);

      const mockCallModel: CallModelFn = vi.fn().mockResolvedValue({
        text: 'invalid json <<<',
        usage: { inputTokens: 50, outputTokens: 5 },
        costUsd: 0.0005,
      });

      const result = await groundTopic('AI 주제', 'light', {
        modelAssignment: mockModelAssignment,
        callModel: mockCallModel,
      });

      expect(result).not.toBeNull();
      expect(result!.facts).toEqual([]);
      expect(result!.confidence).toBe('low');
    });

    it('callModel이 없으면 AI 요약 없이 최소 FactGrounding 반환', async () => {
      mockSearchNaver.mockResolvedValue(mockSearchResults);

      const result = await groundTopic('AI 주제', 'light', {
        modelAssignment: mockModelAssignment,
        // callModel 미주입
      });

      expect(result).not.toBeNull();
      expect(result!.facts).toEqual([]);
      expect(result!.confidence).toBe('low');
      expect(result!.rawSnippetCount).toBe(1);
    });

    it('비용이 검색 + AI 요약 합산으로 계산된다 (AC #5)', async () => {
      mockSearchNaver.mockResolvedValue(mockSearchResults);

      const mockCallModel: CallModelFn = vi.fn().mockResolvedValue({
        text: JSON.stringify({ facts: ['사실 1'], confidence: 'high' }),
        usage: { inputTokens: 100, outputTokens: 50 },
        costUsd: 0.002,
      });

      const result = await groundTopic('AI 주제', 'light', {
        modelAssignment: mockModelAssignment,
        callModel: mockCallModel,
      });

      // light 검색 비용 = NAVER * 2 = 0 + 0 = 0, AI 비용 = 0.002
      expect(result!.costUsd).toBe(0 + 0.002);
    });
  });

  describe('URL 탈중복', () => {
    it('중복 URL 결과는 제거된다', async () => {
      const duplicate = { ...mockSearchResults[0]!, url: 'https://same.com' };
      mockSearchNaver
        .mockResolvedValueOnce([duplicate])
        .mockResolvedValueOnce([duplicate]);

      const result = await groundTopic('AI 주제', 'light');

      expect(result!.rawSnippetCount).toBe(1);
    });
  });
});

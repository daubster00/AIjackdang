/**
 * Google 검색 어댑터 단위 테스트 (Story 11.7 / Task 5.1).
 *
 * 실제 외부 API 호출 없음 — fetch를 vi.stubGlobal로 mock.
 * 환경변수는 vi.hoisted + vi.mock으로 제어.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── 환경변수 mock ─────────────────────────────────────────────────────────────
// vi.hoisted: vi.mock 팩토리보다 먼저 실행되므로 팩토리 안에서 참조 가능.
const mockEnv = vi.hoisted(() => ({
  GOOGLE_SEARCH_API_KEY: 'test-api-key' as string | undefined,
  GOOGLE_SEARCH_CX: 'test-cx-id' as string | undefined,
}));

vi.mock('@ai-jakdang/config', () => ({ env: mockEnv }));

import { searchGoogle } from './google';

// ── fetch mock 헬퍼 ──────────────────────────────────────────────────────────

function mockFetchSuccess(items: Array<{ title: string; snippet: string; link: string }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items }),
    }),
  );
}

function mockFetchError(status: number, statusText = 'Error') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText,
    }),
  );
}

// ── 테스트 ───────────────────────────────────────────────────────────────────

describe('searchGoogle', () => {
  beforeEach(() => {
    // 각 테스트 전 키를 기본값으로 복원
    mockEnv.GOOGLE_SEARCH_API_KEY = 'test-api-key';
    mockEnv.GOOGLE_SEARCH_CX = 'test-cx-id';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('AC #1: 키 미설정 시 graceful skip', () => {
    it('GOOGLE_SEARCH_API_KEY가 없으면 [] 반환 (fetch 미호출)', async () => {
      mockEnv.GOOGLE_SEARCH_API_KEY = undefined;
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const result = await searchGoogle('AI trends');

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('GOOGLE_SEARCH_CX가 없으면 [] 반환 (fetch 미호출)', async () => {
      mockEnv.GOOGLE_SEARCH_CX = undefined;
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const result = await searchGoogle('AI trends');

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('두 키 모두 없으면 [] 반환', async () => {
      mockEnv.GOOGLE_SEARCH_API_KEY = undefined;
      mockEnv.GOOGLE_SEARCH_CX = undefined;

      const result = await searchGoogle('AI trends');

      expect(result).toEqual([]);
    });
  });

  describe('fetch 성공 시 SearchResult[] 올바른 구조 반환', () => {
    it('items를 SearchResult[] 형태로 파싱한다', async () => {
      mockFetchSuccess([
        { title: 'OpenAI GPT-5 released', snippet: 'OpenAI has released GPT-5', link: 'https://openai.com/gpt5' },
        { title: 'Anthropic Claude 4', snippet: 'Anthropic announces Claude 4', link: 'https://anthropic.com/claude4' },
      ]);

      const result = await searchGoogle('GPT-5 release');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        title: 'OpenAI GPT-5 released',
        snippet: 'OpenAI has released GPT-5',
        url: 'https://openai.com/gpt5',
        source: 'google',
      });
      expect(result[1]).toEqual({
        title: 'Anthropic Claude 4',
        snippet: 'Anthropic announces Claude 4',
        url: 'https://anthropic.com/claude4',
        source: 'google',
      });
    });

    it('모든 결과의 source가 "google"이다', async () => {
      mockFetchSuccess([
        { title: 'Test', snippet: 'snippet', link: 'https://example.com' },
      ]);

      const result = await searchGoogle('test query');

      expect(result[0]!.source).toBe('google');
    });

    it('응답에 items가 없으면 [] 반환', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        }),
      );

      const result = await searchGoogle('no results');

      expect(result).toEqual([]);
    });

    it('lang=en 시 요청 URL에 lr=lang_en, gl=US가 포함된다', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await searchGoogle('AI trends', 5, 'en');

      const calledUrl = (fetchSpy.mock.calls[0]?.[0] as string) ?? '';
      expect(calledUrl).toContain('lr=lang_en');
      expect(calledUrl).toContain('gl=US');
    });

    it('lang=ko 시 요청 URL에 lr=lang_ko, gl=KR이 포함된다', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await searchGoogle('AI 트렌드', 5, 'ko');

      const calledUrl = (fetchSpy.mock.calls[0]?.[0] as string) ?? '';
      expect(calledUrl).toContain('lr=lang_ko');
      expect(calledUrl).toContain('gl=KR');
    });

    it('lang=any 시 lr/gl 파라미터가 없다', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await searchGoogle('AI trends', 5, 'any');

      const calledUrl = (fetchSpy.mock.calls[0]?.[0] as string) ?? '';
      expect(calledUrl).not.toContain('lr=');
      expect(calledUrl).not.toContain('gl=');
    });

    it('maxResults가 10을 초과해도 num=10으로 cap된다', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await searchGoogle('test', 99);

      const calledUrl = (fetchSpy.mock.calls[0]?.[0] as string) ?? '';
      expect(calledUrl).toContain('num=10');
    });
  });

  describe('HTTP 오류·타임아웃 시 [] 반환 (throw 없음)', () => {
    it('fetch가 500을 반환하면 [] 반환 (throw 없음)', async () => {
      mockFetchError(500, 'Internal Server Error');

      await expect(searchGoogle('test')).resolves.toEqual([]);
    });

    it('fetch가 403을 반환하면 [] 반환', async () => {
      mockFetchError(403, 'Forbidden');

      await expect(searchGoogle('test')).resolves.toEqual([]);
    });

    it('fetch가 네트워크 에러(reject)를 던져도 [] 반환', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error')),
      );

      await expect(searchGoogle('test')).resolves.toEqual([]);
    });
  });
});

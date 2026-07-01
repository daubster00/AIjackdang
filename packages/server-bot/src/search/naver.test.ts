/**
 * Naver 검색 어댑터 단위 테스트 (Story 11.7 / Task 5.2).
 *
 * 실제 외부 API 호출 없음 — fetch를 vi.stubGlobal로 mock.
 * 환경변수는 vi.hoisted + vi.mock으로 제어.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── 환경변수 mock ─────────────────────────────────────────────────────────────
const mockEnv = vi.hoisted(() => ({
  NAVER_SEARCH_CLIENT_ID: 'test-client-id' as string | undefined,
  NAVER_SEARCH_CLIENT_SECRET: 'test-client-secret' as string | undefined,
}));

vi.mock('@ai-jakdang/config', () => ({ env: mockEnv }));

import { searchNaver } from './naver';

// ── fetch mock 헬퍼 ──────────────────────────────────────────────────────────

interface NaverItem {
  title: string;
  description: string;
  link?: string;
  originallink?: string;
}

function mockNaverSuccess(items: NaverItem[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items }),
    }),
  );
}

function mockNaverError(status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText: 'Error',
    }),
  );
}

// ── 테스트 ───────────────────────────────────────────────────────────────────

describe('searchNaver', () => {
  beforeEach(() => {
    mockEnv.NAVER_SEARCH_CLIENT_ID = 'test-client-id';
    mockEnv.NAVER_SEARCH_CLIENT_SECRET = 'test-client-secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('AC #2: 키 미설정 시 graceful skip', () => {
    it('NAVER_SEARCH_CLIENT_ID가 없으면 [] 반환 (fetch 미호출)', async () => {
      mockEnv.NAVER_SEARCH_CLIENT_ID = undefined;
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const result = await searchNaver('AI 트렌드');

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('NAVER_SEARCH_CLIENT_SECRET이 없으면 [] 반환 (fetch 미호출)', async () => {
      mockEnv.NAVER_SEARCH_CLIENT_SECRET = undefined;
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const result = await searchNaver('AI 트렌드');

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('HTML 태그 제거 (AC #2)', () => {
    it('<b>태그</b>를 제거해 title을 정규화한다', async () => {
      mockNaverSuccess([
        {
          title: '<b>AI</b> 트렌드 분석',
          description: '<b>인공지능</b> 관련 최신 소식',
          link: 'https://example.com/1',
        },
      ]);

      const result = await searchNaver('AI 트렌드');

      expect(result[0]!.title).toBe('AI 트렌드 분석');
      expect(result[0]!.snippet).toBe('인공지능 관련 최신 소식');
    });

    it('중첩 태그도 모두 제거한다', async () => {
      mockNaverSuccess([
        {
          title: '<span><b>GPT</b></span> 모델 출시',
          description: '<b>OpenAI</b>가 <em>새 모델</em>을 발표',
          link: 'https://example.com/2',
        },
      ]);

      const result = await searchNaver('GPT');

      expect(result[0]!.title).toBe('GPT 모델 출시');
      expect(result[0]!.snippet).toBe('OpenAI가 새 모델을 발표');
    });

    it('태그 없는 텍스트는 그대로 유지한다', async () => {
      mockNaverSuccess([
        {
          title: 'AI 뉴스',
          description: '인공지능 소식입니다',
          link: 'https://example.com/3',
        },
      ]);

      const result = await searchNaver('AI');

      expect(result[0]!.title).toBe('AI 뉴스');
      expect(result[0]!.snippet).toBe('인공지능 소식입니다');
    });
  });

  describe('엔드포인트 URL 확인 (type 분기)', () => {
    it("type='blog' 시 /search/blog.json 엔드포인트를 호출한다", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await searchNaver('AI 블로그', 'blog');

      const calledUrl = (fetchSpy.mock.calls[0]?.[0] as string) ?? '';
      expect(calledUrl).toContain('/search/blog.json');
    });

    it("type='news' 시 /search/news.json 엔드포인트를 호출한다", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await searchNaver('AI 뉴스', 'news');

      const calledUrl = (fetchSpy.mock.calls[0]?.[0] as string) ?? '';
      expect(calledUrl).toContain('/search/news.json');
    });

    it("type='webkr' 시 /search/webkr.json 엔드포인트를 호출한다", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await searchNaver('AI 문서', 'webkr');

      const calledUrl = (fetchSpy.mock.calls[0]?.[0] as string) ?? '';
      expect(calledUrl).toContain('/search/webkr.json');
    });

    it('요청 헤더에 X-Naver-Client-Id, X-Naver-Client-Secret이 포함된다', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await searchNaver('테스트');

      const calledOptions = fetchSpy.mock.calls[0]?.[1] as { headers?: Record<string, string> };
      expect(calledOptions.headers?.['X-Naver-Client-Id']).toBe('test-client-id');
      expect(calledOptions.headers?.['X-Naver-Client-Secret']).toBe('test-client-secret');
    });
  });

  describe('originallink 우선 사용', () => {
    it('originallink가 있으면 link 대신 originallink를 url로 사용한다', async () => {
      mockNaverSuccess([
        {
          title: '테스트',
          description: '내용',
          link: 'https://news.naver.com/article/123',
          originallink: 'https://original.example.com/article',
        },
      ]);

      const result = await searchNaver('테스트');

      expect(result[0]!.url).toBe('https://original.example.com/article');
    });

    it('originallink가 없으면 link를 url로 사용한다', async () => {
      mockNaverSuccess([
        {
          title: '테스트',
          description: '내용',
          link: 'https://news.naver.com/article/456',
        },
      ]);

      const result = await searchNaver('테스트');

      expect(result[0]!.url).toBe('https://news.naver.com/article/456');
    });

    it('모든 결과의 source가 "naver"이다', async () => {
      mockNaverSuccess([
        { title: '뉴스1', description: '내용1', link: 'https://a.com' },
        { title: '뉴스2', description: '내용2', link: 'https://b.com' },
      ]);

      const result = await searchNaver('테스트');

      expect(result.every((r) => r.source === 'naver')).toBe(true);
    });
  });

  describe('HTTP 오류·타임아웃 시 [] 반환 (throw 없음)', () => {
    it('fetch가 500을 반환하면 [] 반환', async () => {
      mockNaverError(500);

      await expect(searchNaver('테스트')).resolves.toEqual([]);
    });

    it('fetch가 네트워크 에러를 던져도 [] 반환', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error')),
      );

      await expect(searchNaver('테스트')).resolves.toEqual([]);
    });
  });
});

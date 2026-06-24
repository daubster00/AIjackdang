# Story 8.5: 메인 홈 페이지(/) — 6섹션 SSR

Status: done

## Story

As a 방문자,
I want 메인 홈 페이지(/)에서 커뮤니티의 핵심 콘텐츠를 한눈에 볼 수 있기를,
so that 사이트에서 무엇을 할 수 있는지 즉시 파악하고 관심 있는 섹션으로 이동할 수 있다.

## Acceptance Criteria

1. `GET /` SSR 로드 시 6개 섹션이 순서대로 렌더링된다: ①소개(H1·설명·CTA) ②실전 인기글 탭 ③묻고답하기 최신 ④AI 수익화 인기글 ⑤실전자료 ⑥작당 라운지(FR-6.1).
2. `generateMetadata()`가 고유 `title`, `description`, `WebSite JSON-LD` (potentialAction: SearchAction) + `Organization JSON-LD`를 반환한다.
3. ②실전 인기글 탭 섹션은 바이브코딩/자동화/수익화/라운지 4개 탭(`role="tablist"`)을 렌더링하고, 활성 탭의 인기글 5개(7일 기준 조회수+좋아요 합산)를 표시한다. Redis 캐시(TTL 1h) 적용, URL 앵커 `#popular-tab={tab}`으로 딥링크 지원(UX-DR-U2, UX-DR-U6).
4. ②의 인기글 데이터는 Redis 캐시 hit 시 즉시 반환되고, miss 시 `posts` 테이블 집계 후 저장된다. 조회수(`view_count`)·좋아요(`like_count`)는 Epic 5·6에서 저장된 값을 읽기만 한다.
5. ③묻고답하기 최신 섹션은 `questions` 테이블에서 `status != 'deleted'` 조건으로 최신 5건을 가져와 상태 배지·제목·답변수(`comment_count`)·작성일을 표시하고 "더 보기" 링크는 `/qna`로 연결된다.
6. ④AI 수익화 인기글 섹션은 `category = 'ai-monetization'` 조건으로 최근 30일 인기글 5건(Redis 캐시)을 표시하고 "더 보기" 링크는 `/monetization/`으로 연결된다.
7. ⑤실전자료 섹션은 다운로드 수(`download_count`) 기준 인기 자료 4건(Redis 캐시)을 카드 형태로 표시하고 "더 보기" 링크는 `/resources`로 연결된다.
8. ⑥작당 라운지 섹션은 `board IN ('ai-creation', 'ai-products', 'free')` 조건으로 최신 5건을 가져와 표시하고 "더 보기" 링크는 `/lounge/`로 연결된다.
9. 6개 섹션 데이터 패치는 `Promise.all`로 병렬 처리되며, 특정 섹션 패치 실패 시 해당 섹션만 `EmptyState`로 렌더링되고 나머지는 정상 표시된다.
10. Epic 2에서 생성된 공지(`notices` 테이블)가 존재하면 ①소개 섹션 하단에 최대 1건의 공지 배너를 표시한다(FR-15.2, 읽기 전용).

## Tasks / Subtasks

- [ ] Task 1: 신규 API 엔드포인트 추가 (AC: #3, #4, #6, #7, #8, #10)
  - [ ] 1.1: `apps/api/src/routes/v1/posts/` 디렉터리 확인/생성
    - `GET /api/v1/posts/popular` 핸들러 구현
    - 쿼리 파라미터: `category` (선택, 없으면 전체), `period` ('7d'|'30d', 기본 '7d'), `board` (선택), `limit` (기본 5 max 20)
    - Redis 캐시 키: `main:popular:{category}:{period}` 또는 `main:lounge:latest` (board 기반) — `apps/api/src/lib/cache.ts`에 상수 추가 (AR-17)
    - 캐시 hit → 즉시 반환; miss → DB 집계(`view_count + like_count` 합산 DESC) → `SETEX {key} 3600 <json>` 저장 후 반환
    - 응답: `{ items: PopularPostItem[] }` (단일 객체, 페이지네이션 없음)
  - [ ] 1.2: `GET /api/v1/posts/popular?board=ai-creation,ai-products,free&sort=latest&limit=5` — 라운지 최신 5건
    - `board IN (...)` + `status = 'published'` 조건, `created_at DESC`
    - Redis 캐시 키: `main:lounge:latest` (TTL 1h)
  - [ ] 1.3: `apps/api/src/routes/v1/questions/` 디렉터리 확인/생성
    - `GET /api/v1/questions?limit=5&sort=latest&status=published` 핸들러 구현 (이미 부분 존재 가능, 확인 필수)
    - `status != 'deleted'` 필터, `created_at DESC`, limit 5
    - 응답: `{ items: QuestionItem[] }` (`{ id, title, status, commentCount, createdAt }`)
  - [ ] 1.4: `apps/api/src/routes/v1/resources/` 디렉터리 확인/생성
    - `GET /api/v1/resources/popular?limit=4` 핸들러 구현
    - `download_count DESC` 정렬, limit 4
    - Redis 캐시 키: `main:resources:popular` (TTL 1h)
    - 응답: `{ items: ResourceItem[] }` (`{ id, title, description, downloadCount, avgRating, meta }`)
  - [ ] 1.5: `apps/api/src/routes/v1/notices/` 디렉터리 확인/생성
    - `GET /api/v1/notices/pinned?limit=1` 핸들러 구현 (Epic 2 notices 테이블 읽기 전용)
    - `is_pinned = true AND status = 'published'` 조건, `created_at DESC LIMIT 1`
    - 응답: 단일 공지 객체 또는 `null`
  - [ ] 1.6: `apps/api/src/routes/v1/index.ts`에 위 신규 라우트 등록

- [ ] Task 2: `packages/contracts/src/`에 홈 페이지용 Zod 스키마 추가 (AC: #3~#10)
  - [ ] 2.1: `packages/contracts/src/home.ts` 신규 생성
    - `popularPostItemSchema`: id, title, description, category, board, viewCount, likeCount, commentCount, createdAt, tags
    - `questionItemSchema`: id, title, status, commentCount, createdAt
    - `resourceItemSchema`: id, title, description, downloadCount, avgRating, meta, tone
    - `noticeBannerSchema`: id, title, content, url (선택)
  - [ ] 2.2: `packages/contracts/src/index.ts`에 re-export 추가

- [ ] Task 3: `apps/api/src/lib/cache.ts` 업데이트 — 홈 페이지 캐시 키 상수 추가 (AC: #3, #4, #6, #7, #8)
  - [ ] 3.1: 다음 상수 추가 (AR-17 규약: 모든 캐시 키는 이 파일에서만 정의)
    ```typescript
    MAIN_POPULAR_ALL_7D     = 'main:popular:all:7d'
    MAIN_POPULAR_MONETIZATION_30D = 'main:popular:monetization:30d'
    MAIN_RESOURCES_POPULAR  = 'main:resources:popular'
    MAIN_LOUNGE_LATEST      = 'main:lounge:latest'
    ```

- [ ] Task 4: 홈 페이지 서버 컴포넌트 데이터 패치 레이어 생성 (AC: #1, #9)
  - [ ] 4.1: `apps/web/lib/home.ts` 신규 생성 — 각 섹션별 fetch 함수 (서버 전용)
    - `fetchPopularPosts(tab: string): Promise<PopularPostItem[]>` — `GET /api/v1/posts/popular?category={tab}&period=7d&limit=5`
    - `fetchLatestQuestions(): Promise<QuestionItem[]>` — `GET /api/v1/questions?limit=5&sort=latest&status=published`
    - `fetchMonetizationPosts(): Promise<PopularPostItem[]>` — `GET /api/v1/posts/popular?category=ai-monetization&period=30d&limit=5`
    - `fetchPopularResources(): Promise<ResourceItem[]>` — `GET /api/v1/resources/popular?limit=4`
    - `fetchLoungeLatest(): Promise<PopularPostItem[]>` — `GET /api/v1/posts/popular?board=ai-creation,ai-products,free&sort=latest&limit=5`
    - `fetchPinnedNotice(): Promise<NoticeBanner | null>` — `GET /api/v1/notices/pinned?limit=1`
    - 모든 함수: try/catch 내부에서 실패 시 빈 배열 또는 null 반환 (AC #9: graceful degradation)
    - Next.js fetch `{ next: { revalidate: 60 } }` 적용 (목록 페이지 TTL 규약)
    - API_BASE_URL: `process.env.INTERNAL_API_URL ?? 'http://localhost:4003'` (SSR은 내부 직접 연결)

- [ ] Task 5: `apps/web/app/page.tsx` 업데이트 — 실제 API 데이터로 교체 (AC: #1~#10)
  - [ ] 5.1: 파일 상단 하드코딩 데이터 상수(`popularPosts`, `resources`, `questions`, `creativePosts`) 제거
  - [ ] 5.2: `export default async function HomePage()` 로 async 전환
  - [ ] 5.3: 탭 파라미터 처리
    - `{ searchParams }: { searchParams: Promise<{ 'popular-tab'?: string }> }` props 추가
    - `const params = await searchParams`
    - `const activeTab = params['popular-tab'] ?? 'vibe-coding'` (기본: 바이브코딩)
  - [ ] 5.4: 데이터 패치 — `Promise.all` 병렬 실행
    ```typescript
    const [popularPosts, questions, monetizationPosts, resources, loungePosts, pinnedNotice] =
      await Promise.all([
        fetchPopularPosts(activeTab),
        fetchLatestQuestions(),
        fetchMonetizationPosts(),
        fetchPopularResources(),
        fetchLoungeLatest(),
        fetchPinnedNotice(),
      ]);
    ```
  - [ ] 5.5: ①소개 섹션 — 공지 배너 조건부 렌더링
    - `pinnedNotice` 존재 시 소개 섹션 하단에 공지 배너 컴포넌트 렌더링 (FR-15.2)
    - 공지 배너: 배경 강조 블록, 제목 + 선택적 URL 링크
  - [ ] 5.6: ②실전 인기글 탭 섹션 구현
    - 탭 목록: `[{ id: 'vibe-coding', label: '바이브코딩' }, { id: 'ai-automation', label: '자동화' }, { id: 'ai-monetization', label: '수익화' }, { id: 'lounge', label: '라운지' }]`
    - `<nav role="tablist">` 렌더링, 각 탭은 `<Link href="/?popular-tab={id}#popular-tab" role="tab" aria-selected={activeTab === id}>`
    - 앵커 id: `id="popular-tab"` (UX-DR-U2, UX-DR-U6 딥링크)
    - `popularPosts`가 빈 배열이면 `<EmptyState />` 표시
  - [ ] 5.7: ③묻고답하기 최신 섹션
    - `questions` 데이터로 질문 목록 렌더링 (상태 배지, 제목, `comment_count`, 작성일)
    - 빈 배열이면 `<EmptyState />`
    - "더 보기" `href="/qna"`
  - [ ] 5.8: ④AI 수익화 인기글 섹션
    - `monetizationPosts` 데이터로 카드 렌더링
    - 빈 배열이면 `<EmptyState />`
    - "더 보기" `href="/monetization/"`
  - [ ] 5.9: ⑤실전자료 섹션
    - `resources` 데이터로 카드 렌더링 (title, description, downloadCount, avgRating)
    - 빈 배열이면 `<EmptyState />`
    - "더 보기" `href="/resources"`
  - [ ] 5.10: ⑥작당 라운지 섹션
    - `loungePosts` 데이터로 카드 렌더링
    - 빈 배열이면 `<EmptyState />`
    - "더 보기" `href="/lounge/"`
  - [ ] 5.11: 기존 CSS 클래스(`styles.*`) 최대한 유지. 데이터 구조 변화로 필요한 경우만 `page.module.css` 수정.

- [ ] Task 6: `generateMetadata()` 추가 (AC: #2)
  - [ ] 6.1: `apps/web/app/page.tsx`에 `export async function generateMetadata()` 추가
    - `title`: `'AI작당 — 실전 AI 커뮤니티'`
    - `description`: `'바이브 코딩, AI 자동화, AI 수익화를 실제로 시도하는 사람들의 커뮤니티. 경험과 자료를 함께 쌓아가세요.'`
    - `openGraph`: title, description, url, siteName
  - [ ] 6.2: `apps/web/app/layout.tsx` 또는 별도 파일에 JSON-LD script 태그 삽입
    - `WebSite` JSON-LD: `potentialAction.SearchAction` (target URL: `/tags/{search_term_string}`)
    - `Organization` JSON-LD: name 'AI작당', url

- [ ] Task 7: `EmptyState` 컴포넌트 확인/생성 (AC: #9)
  - [ ] 7.1: `apps/web/components/ui/EmptyState.tsx` 존재 여부 확인
  - [ ] 7.2: 없으면 신규 생성 — 아이콘 + 메시지 텍스트 prop을 받는 단순 컴포넌트
  - [ ] 7.3: 홈 페이지 각 섹션에서 빈 배열 시 `<EmptyState message="잠시 후 다시 시도해주세요." />` 사용

- [ ] Task 8: 검증 (AC: #1~#10)
  - [ ] 8.1: Playwright로 `http://localhost:3003` 캡처 — 6개 섹션 모두 콘텐츠 렌더링 확인 (디자인 검수 필수, 레이아웃 버그 캡처 기반 검증)
  - [ ] 8.2: `?popular-tab=ai-automation` URL로 접근 시 자동화 탭이 활성화되고 해당 데이터 표시 확인
  - [ ] 8.3: `#popular-tab` 앵커로 스크롤 이동 확인
  - [ ] 8.4: API 서버 다운 시뮬레이션(포트 차단) 후 페이지 로드 시 EmptyState 렌더링 확인 (graceful degradation)
  - [ ] 8.5: HTML `<head>`에 JSON-LD script 태그 포함 여부 확인
  - [ ] 8.6: "더 보기" 링크들이 올바른 경로(`/qna`, `/monetization/`, `/resources`, `/lounge/`)로 연결 확인

## Dev Notes

### 아키텍처 규칙 준수 사항

- **SSR 우선(NFR-1)**: `apps/web/app/page.tsx`는 서버 컴포넌트(`async` 함수). 클라이언트 컴포넌트는 탭 인터랙션에만 허용.
- **데이터 패치**: 서버 컴포넌트에서 `fetch()`로 API 직접 호출. 내부 통신은 `INTERNAL_API_URL` 사용.
- **캐시 전략**: Next.js fetch `revalidate: 60` (목록), API 측 Redis TTL 1h (AR-17). 이중 캐시 적용.
- **DB 접근 금지**: `apps/web`에서 Drizzle 직접 임포트 절대 금지.
- **캐시 키 상수**: `apps/api/src/lib/cache.ts`에서만 정의 (AR-17).
- **응답 형식**: 단일 컬렉션 응답은 `{ items: [...] }`, 단일 객체는 직접 payload, 오류는 `{ error: { code, message } }`.

### 탭 SSR 딥링크 설계

홈 페이지 탭(②실전 인기글)은 URL searchParam `?popular-tab={id}` 기반으로 SSR에서 활성 탭을 결정한다. 클라이언트 JavaScript 없이도 딥링크가 동작한다. 탭 클릭 시 `<Link>`로 URL을 변경하면 서버가 해당 탭 데이터를 새로 패치하여 렌더링한다.

```typescript
// apps/web/app/page.tsx — 탭 링크 예시
<Link
  href={`/?popular-tab=${tab.id}#popular-tab`}
  role="tab"
  aria-selected={activeTab === tab.id}
>
  {tab.label}
</Link>
```

### Promise.all 패턴 (graceful degradation)

```typescript
// apps/web/lib/home.ts — 모든 fetch 함수는 에러 시 빈값 반환
async function fetchPopularPosts(tab: string): Promise<PopularPostItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/posts/popular?category=${tab}&period=7d&limit=5`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}
```

### 기존 page.tsx 구조 보존 원칙

현재 `apps/web/app/page.tsx`는 하드코딩 데이터를 사용하지만 HTML 구조와 CSS 클래스는 완성된 상태다. 이 스토리의 목표는 **데이터만 실제 API로 교체**하는 것이다. UI 레이아웃 변경은 최소화한다. 구체적인 변경 대상:

- 삭제: `popularPosts` 상수 (L5-33), `resources` 상수 (L35-57), `questions` 상수 (L59-63), `creativePosts` 상수 (L65-90)
- 변경: `export default function HomePage()` → `export default async function HomePage({ searchParams })`
- 추가: 탭 네비게이션 JSX (기존 고정 popularPosts 3개 표시 구조 교체)
- 유지: 모든 CSS 클래스 참조, 섹션 구조, `<main>` 태그

### section별 데이터 구조 매핑

| 섹션 | API 엔드포인트 | 응답 필드 | 기존 하드코딩 |
|------|---------------|-----------|-------------|
| ②인기글 탭 | `/api/v1/posts/popular?category={tab}&period=7d&limit=5` | id, title, description, tags, viewCount, likeCount | `popularPosts` 상수 3개 |
| ③묻고답하기 | `/api/v1/questions?limit=5&sort=latest` | id, title, status, commentCount, createdAt | `questions` 상수 |
| ⑤실전자료 | `/api/v1/resources/popular?limit=4` | id, title, description, downloadCount, avgRating | `resources` 상수 |
| ⑥라운지 | `/api/v1/posts/popular?board=ai-creation,...&sort=latest&limit=5` | id, title, description, likeCount, viewCount, commentCount | `creativePosts` 상수 (이미지 없음) |

### 주의: 라운지 섹션 이미지

기존 `creativePosts` 상수에는 `/lounge/ai-creative-1.png` 등 정적 이미지가 있다. 실제 API 데이터에는 `thumbnail_url` 필드가 있을 수 있다. 이 스토리에서는 `thumbnail_url`이 없으면 placeholder 이미지 또는 아이콘으로 대체하거나 이미지 없이 텍스트 카드로 렌더링한다. `resources` 테이블에 `thumbnail_url`이 없으면 `avg_rating` 표시로 대체.

### Project Structure Notes

```
apps/
  api/src/
    lib/
      cache.ts          [UPDATE]  — MAIN_POPULAR_*, MAIN_RESOURCES_POPULAR, MAIN_LOUNGE_LATEST 추가
      redis.ts          [CHECK]   — Story 8.4에서 생성, 재사용
    routes/v1/
      posts/
        index.ts        [NEW]     — GET /posts/popular
      questions/
        index.ts        [NEW or CHECK] — GET /questions (부분 존재 가능)
      resources/
        index.ts        [NEW]     — GET /resources/popular
      notices/
        index.ts        [NEW]     — GET /notices/pinned
      index.ts          [UPDATE]  — 위 라우트 등록
  web/
    app/
      page.tsx          [UPDATE]  — async SSR, Promise.all 데이터 패치, 탭 SSR
    lib/
      home.ts           [NEW]     — 섹션별 fetch 함수
    components/ui/
      EmptyState.tsx    [CHECK or NEW] — 빈 상태 컴포넌트
packages/
  contracts/src/
    home.ts             [NEW]     — popularPostItemSchema, questionItemSchema 등
    index.ts            [UPDATE]  — home.ts re-export
```

### References

- FR-6.1 (홈 페이지 6섹션 구조)
- FR-15.2 (공지 배너: 최대 1건, 소개 섹션 하단)
- NFR-1 (SSR 우선)
- AR-17 (Redis 캐싱: popular TTL 1h, list revalidate 60, detail revalidate 300)
- UX-DR-U2, UX-DR-U6 (탭 앵커 딥링크)
- `apps/web/app/page.tsx`: L92-289 — 교체 대상 전체 구조 (6섹션 기존 목업)
- `packages/contracts/src/common.ts`: `errorResponseSchema`, `paginatedResponseSchema` — 응답 규격 참조
- `packages/contracts/src/post.ts`: `postCategorySchema` — 'vibe-coding'|'ai-automation'|'ai-monetization'|'lounge' 카테고리 값

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- `packages/contracts/src/index.ts` 편집 금지 규칙으로 `packages/contracts/package.json`에 `"./home": "./src/home.ts"` export를 추가하여 하위 경로 import 가능하게 처리
- `deriveQuestionStatus` 인터페이스: `acceptedAnswerId` 사용 (isResolved=true 시 non-null 값 전달)
- 기존 api 에러 (link-preview, sitemap, search): Story 8.5 무관한 사전 존재 에러, 본 스토리에서 수정 불필요

### Completion Notes List
- Task 1~7 전부 완료. Task 8(Playwright 검증)은 dev 서버 실행 환경 필요 — 별도 수행 권장
- `packages/contracts/src/index.ts`는 수정하지 않음; 대신 `package.json` exports에 `./home` 경로 추가
- 라운지 섹션: 실제 API 데이터에 `thumbnail_url` 없음 → 텍스트 카드로 렌더링(Dev Notes 명시 내용)

### File List
- `packages/contracts/src/home.ts` [NEW]
- `packages/contracts/package.json` [UPDATE] — exports에 `./home` 추가
- `apps/api/src/lib/cache.ts` [NEW]
- `apps/api/src/routes/v1/posts/popular.route.ts` [NEW]
- `apps/api/src/routes/v1/posts/routes.ts` [UPDATE] — popular.route.ts 등록
- `apps/api/src/routes/v1/questions/index.ts` [NEW]
- `apps/api/src/routes/v1/resources/popular.route.ts` [NEW]
- `apps/api/src/routes/v1/resources/routes.ts` [UPDATE] — popular.route.ts 등록
- `apps/api/src/routes/v1/notices/index.ts` [NEW]
- `apps/web/lib/home.ts` [NEW]
- `apps/web/app/page.tsx` [UPDATE] — async SSR, Promise.all, 6섹션 실데이터
- `apps/web/app/page.module.css` [UPDATE] — 탭 네비게이션·공지 배너·질문 메타 CSS 추가

# Story 8.6: 링크 OG 자동수집 Worker & 카드 렌더

Status: ready-for-dev

## Story

As a 독자,
I want 게시글 본문 속 외부 링크 아래에 OG(Open Graph) 미리보기 카드가 자동으로 표시되기를,
so that 링크를 클릭하지 않아도 대상 페이지의 내용을 파악할 수 있고, 글의 신뢰도와 가독성이 높아진다.

## Acceptance Criteria

1. `POST /api/v1/posts` 및 `PATCH /api/v1/posts/:id`, `POST /api/v1/qna`, `PATCH /api/v1/qna/:id` 처리 시, 서비스 레이어가 `content_json`(Tiptap JSON)에서 외부 URL(자사 도메인 제외)을 추출하고, BullMQ `og-fetch` 큐에 `og.fetch` 잡 `{ targetType, targetId, urls }` 형태로 발행한다. (AR-16 준수)
2. `apps/worker/src/processors/og-fetch.ts`의 `og.fetch` 처리기가 실행되면, 각 URL에 대해 OG 메타태그(`og:title`, `og:description`, `og:image`, `og:url`, `og:site_name`)를 수집하고 `link_previews` 테이블에 upsert한다. 실패 시 `error_at`을 기록하고 잡은 완료(에러 없이 resolve)한다. 최대 재시도 횟수는 2회이며, 실패가 본문 노출에 영향을 주지 않는다.
3. 게시글·QnA 상세 API 응답에 `linkPreviews: { [url: string]: { title, description, imageUrl, siteName } }` 맵이 포함된다. `packages/contracts/src/link-preview.ts`에 해당 Zod 스키마가 정의된다.
4. 상세 페이지(`apps/web/app/vibe-coding/[slug]/page.tsx`, `apps/web/app/automation/[slug]/page.tsx`) 렌더 시, `linkPreviews`에 데이터가 있는 외부 링크 아래에 `OgLinkCard` 컴포넌트가 표시된다. 카드에는 제목·도메인·설명(최대 2줄)·이미지 또는 파비콘/플레이스홀더가 포함된다. (FR-11.7, UX-DR-U16)
5. OG 수집이 완료되지 않은 링크는 일반 텍스트 링크로 표시되며 레이아웃이 깨지지 않는다.
6. OG 이미지 표시 시 `<img alt="{title} 링크 미리보기">` 속성을 반드시 포함하고, 이미지 로드 실패 시 플레이스홀더(파비콘 또는 기본 아이콘)로 대체한다. (NFR-5 접근성)

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 — `link_previews` 테이블 추가 (AC: #2)
  - [ ] `packages/database/src/schema/link-previews.ts` NEW
    - `linkPreviews` 테이블: `url`(text, PK) · `title`(text nullable) · `description`(text nullable) · `image_url`(text nullable) · `site_name`(text nullable) · `fetched_at`(timestamptz nullable) · `error_at`(timestamptz nullable)
    - Drizzle ORM 0.38 `pgTable` 사용
    - Row 타입(`LinkPreview`) export
  - [ ] `packages/database/src/schema/index.ts` UPDATE: `link-previews` 모듈 re-export 추가
  - [ ] `pnpm drizzle-kit generate` 후 `pnpm drizzle-kit migrate` 실행하여 테이블 생성 확인

- [ ] Task 2: Contracts 스키마 정의 (AC: #3)
  - [ ] `packages/contracts/src/link-preview.ts` NEW
    - `linkPreviewItemSchema`: `z.object({ title: z.string().nullable(), description: z.string().nullable(), imageUrl: z.string().url().nullable(), siteName: z.string().nullable() })`
    - `linkPreviewMapSchema`: `z.record(z.string().url(), linkPreviewItemSchema)` — API 응답용 맵 타입
    - `type LinkPreviewItem`, `type LinkPreviewMap` export
  - [ ] `packages/contracts/src/index.ts` UPDATE: `link-preview` 모듈 re-export 추가
  - [ ] `pnpm typecheck` 전 워크스페이스 통과 확인

- [ ] Task 3: BullMQ 큐 이름 상수 추가 (AC: #1)
  - [ ] `apps/worker/src/connection.ts` UPDATE
    - `QUEUE_NAMES` 상수에 `ogFetch: "og-fetch"` 추가
  - [ ] `apps/api/src/lib/queues.ts` NEW (또는 기존 큐 설정 파일 UPDATE)
    - `ogFetchQueue`: `new Queue("og-fetch", { connection })` 생성 및 export
    - BullMQ `Queue` 인스턴스는 API 서버 기동 시 싱글턴으로 관리

- [ ] Task 4: URL 추출 유틸리티 구현 (AC: #1)
  - [ ] `apps/api/src/lib/extract-urls.ts` NEW
    - `extractExternalUrls(contentJson: unknown, siteUrl: string): string[]` 함수
    - Tiptap JSON을 재귀 순회하여 `link` 마크(`{ type: "link", attrs: { href } }`)에서 URL 추출
    - `text` 노드 내 bare URL은 추출하지 않음 (link 마크 기준)
    - `siteUrl`과 동일 호스트인 URL 필터링 (자사 도메인 제외)
    - 중복 URL 제거 (`Set` 사용)
    - `process.env.NEXT_PUBLIC_SITE_URL` 대신 API 환경의 `process.env.SITE_URL` 사용

- [ ] Task 5: posts 서비스에 OG 잡 발행 로직 추가 (AC: #1)
  - [ ] `apps/api/src/routes/v1/posts/service.ts` UPDATE
    - 게시글 저장(create/update) 후 `extractExternalUrls(contentJson, SITE_URL)` 호출
    - 추출된 URL 배열이 비어있지 않으면 `ogFetchQueue.add("og.fetch", { targetType: "post", targetId: postId, urls })` 발행
    - 잡 발행 실패가 게시글 저장 응답을 막지 않도록 try/catch로 감싸고 오류는 로깅만 수행
    - 잡 옵션: `{ attempts: 2, backoff: { type: "fixed", delay: 5000 } }`

- [ ] Task 6: qna 서비스에 OG 잡 발행 로직 추가 (AC: #1)
  - [ ] `apps/api/src/routes/v1/qna/service.ts` UPDATE
    - Task 5와 동일한 패턴으로 `targetType: "question"` 설정하여 잡 발행

- [ ] Task 7: og-fetch Worker 처리기 구현 (AC: #2)
  - [ ] `apps/worker/src/processors/og-fetch.ts` NEW
    - `ogFetchProcessor(job: Job<OgFetchJobData>): Promise<void>` 함수
    - `OgFetchJobData`: `{ targetType: "post" | "question", targetId: string, urls: string[] }`
    - 각 URL에 대해 `fetchOgMeta(url)` 호출 (병렬, `Promise.allSettled`)
    - `fetchOgMeta(url)`:
      - `fetch(url, { signal: AbortSignal.timeout(3000) })` — 3초 타임아웃
      - 응답 HTML에서 `<meta property="og:*">` 및 `<meta name="description">` 파싱
      - HTML 파싱: `node-html-parser` 또는 직접 정규식으로 `<meta>` 태그 추출 (`cheerio` 사용 가능하나 번들 크기 고려)
      - 성공: `{ title, description, imageUrl, siteName }` 반환
    - 각 URL 처리 결과로 Drizzle ORM으로 `link_previews` upsert
      - 성공: `fetched_at = now()`, `error_at = null`
      - 실패: `error_at = now()`, 나머지 필드는 기존 값 유지 (onConflictDoUpdate)
    - 개별 URL 실패가 전체 잡 실패로 이어지지 않도록 `Promise.allSettled` 사용
    - 처리기 함수 자체는 항상 resolve (잡 완료 처리)
  - [ ] `apps/worker/src/index.ts` UPDATE
    - `og-fetch` 큐에 `ogFetchProcessor`를 연결하는 Worker 인스턴스 추가
    - `QUEUE_NAMES.ogFetch` 상수 사용
    - `ready`/`failed` 이벤트 핸들러 등록

- [ ] Task 8: 상세 API 응답에 linkPreviews 포함 (AC: #3)
  - [ ] `apps/api/src/routes/v1/posts/service.ts` UPDATE
    - `getPostDetail(slug)` 함수에서 `link_previews` 테이블을 LEFT JOIN 또는 별도 쿼리로 조회
    - `content_json`에서 외부 URL 목록을 추출 → 해당 URL들의 `link_previews` 레코드를 `WHERE url = ANY(...)` 로 조회
    - `error_at IS NOT NULL` 또는 레코드 없는 URL은 맵에서 제외
    - 응답에 `linkPreviews: LinkPreviewMap` 필드 추가
  - [ ] 동일 패턴으로 QnA 상세 서비스도 UPDATE

- [ ] Task 9: OgLinkCard 컴포넌트 구현 (AC: #4, #5, #6)
  - [ ] `apps/web/components/ui/OgLinkCard/OgLinkCard.tsx` NEW
    - Props: `url: string`, `title: string | null`, `description: string | null`, `imageUrl: string | null`, `siteName: string | null`
    - 레이아웃: 카드 전체가 `<a href={url} target="_blank" rel="noopener noreferrer">` 링크
    - 이미지 영역: `imageUrl` 있으면 `<img src={imageUrl} alt="{title} 링크 미리보기">`, 없으면 파비콘(`https://{domain}/favicon.ico`) 또는 기본 플레이스홀더 아이콘
    - 이미지 `onError` 핸들러로 플레이스홀더로 폴백
    - 텍스트 영역: 제목(1줄 ellipsis) · 도메인 표시 · 설명(최대 2줄 line-clamp)
    - 도메인 추출: `new URL(url).hostname` (www 제거)
  - [ ] `apps/web/components/ui/OgLinkCard/OgLinkCard.module.css` NEW
    - 카드 스타일: border, border-radius, padding, hover 효과
    - 설명 2줄 제한: `-webkit-line-clamp: 2`
    - 이미지: 고정 크기(예: 80×80) 또는 썸네일 비율
  - [ ] `apps/web/components/ui/OgLinkCard/index.ts` NEW — default export 재export
  - [ ] `apps/web/components/ui/index.ts` UPDATE — `OgLinkCard` export 추가

- [ ] Task 10: 상세 페이지에 OgLinkCard 연동 (AC: #4, #5)
  - [ ] `apps/web/app/vibe-coding/[slug]/page.tsx` UPDATE
    - API에서 받은 `linkPreviews` 데이터를 props/state로 관리
    - 본문 렌더 후 `linkPreviews` 맵을 순회하여 외부 링크별로 `OgLinkCard` 표시
    - `content_json`의 link 마크 URL 목록을 순서대로 본문 아래에 카드 표시
    - `linkPreviews`에 해당 URL 데이터가 없거나 `null`이면 카드 미표시 (일반 링크 유지)
    - SSR에서 `linkPreviews`를 fetch하여 HTML에 포함 (revalidate=300 — AR-17 상세 캐시 정책)
  - [ ] `apps/web/app/automation/[slug]/page.tsx` UPDATE — 동일 패턴 적용
  - [ ] `pnpm typecheck` 전 워크스페이스 통과 확인

## Dev Notes

### 아키텍처 패턴

- **AR-16 BullMQ 큐 규칙**: 큐 이름은 kebab-case(`og-fetch`), 잡 이름은 `domain.action` 형식(`og.fetch`). 워커 처리기는 반드시 idempotent해야 한다. `link_previews` upsert는 동일 URL에 대해 중복 실행되어도 안전하게 설계한다.
- **AR-17 SSR 캐시**: 상세 페이지는 `revalidate=300`. OG 수집 완료 전 요청은 `linkPreviews`가 빈 맵(`{}`)으로 응답되며, 다음 revalidate 주기에 카드가 노출된다. 이는 의도된 동작이다.
- **DB 접근 규칙**: DB 쿼리는 `apps/api` 및 `apps/worker`에서만 허용. `apps/web`은 반드시 API 호출로 데이터를 가져온다.
- **잡 실패 전략**: 재시도 2회 후에도 실패 시 `error_at` 기록 후 잡을 완료(resolve)한다. BullMQ failed 큐에 쌓이지 않도록 하여 워커 안정성을 유지한다.

### URL 추출 — Tiptap JSON 구조

```typescript
// Tiptap JSON link 마크 예시
{
  "type": "text",
  "text": "링크 텍스트",
  "marks": [
    {
      "type": "link",
      "attrs": { "href": "https://example.com", "target": "_blank" }
    }
  ]
}
```

재귀 순회 시 `node.marks` 배열에서 `type === "link"`인 항목의 `attrs.href`를 추출한다.

### og-fetch 처리기 — 네트워크 타임아웃

```typescript
// 3초 타임아웃 패턴
const response = await fetch(url, {
  signal: AbortSignal.timeout(3000),
  headers: { "User-Agent": "AI작당-OGBot/1.0" },
});
```

`AbortSignal.timeout`은 Node.js 17.3+ 에서 지원. 버전이 낮으면 `AbortController` + `setTimeout` 패턴으로 대체.

### 자사 도메인 필터링

`process.env.SITE_URL`(예: `https://www.ai-jakdang.com`)의 `hostname`과 추출 URL의 `hostname`을 비교한다. `www` 제거 없이 정확히 비교하여 서브도메인도 자사 도메인으로 취급할지 여부는 `SITE_URL`과 동일한 정확한 hostname 비교로 처리한다.

### NFR-5 접근성

OG 이미지 `<img>` 에 `alt="{title} 링크 미리보기"` 필수. `title`이 null이면 `alt="링크 미리보기"` 사용. 플레이스홀더 이미지에도 `aria-hidden="true"` 또는 동일한 alt 패턴 적용.

### 외부 npm 패키지

`node-html-parser` (경량 HTML 파서) 또는 `cheerio` 사용. OG 스크래퍼 전용 라이브러리(`open-graph-scraper`)도 가능하나, 의존성 최소화 목적으로 직접 `<meta>` 태그 파싱 권장. `apps/worker/package.json`에 의존성 추가 필요.

### Project Structure Notes

```
packages/
  database/src/schema/
    link-previews.ts          NEW — link_previews 테이블 스키마
    index.ts                  UPDATE — re-export 추가
  contracts/src/
    link-preview.ts           NEW — linkPreviewItemSchema, linkPreviewMapSchema
    index.ts                  UPDATE — re-export 추가

apps/
  api/src/
    lib/
      extract-urls.ts         NEW — Tiptap JSON URL 추출 유틸
      queues.ts               NEW (또는 기존 파일 UPDATE) — ogFetchQueue
    routes/v1/posts/
      service.ts              UPDATE — OG 잡 발행 + 상세 응답에 linkPreviews 추가
    routes/v1/qna/
      service.ts              UPDATE — OG 잡 발행 + 상세 응답에 linkPreviews 추가
  worker/src/
    connection.ts             UPDATE — QUEUE_NAMES.ogFetch 추가
    processors/
      og-fetch.ts             NEW — og.fetch 잡 처리기
    index.ts                  UPDATE — og-fetch Worker 등록
  web/
    components/ui/OgLinkCard/
      OgLinkCard.tsx          NEW
      OgLinkCard.module.css   NEW
      index.ts                NEW
    components/ui/index.ts    UPDATE — OgLinkCard export 추가
    app/vibe-coding/[slug]/
      page.tsx                UPDATE — linkPreviews 연동 + OgLinkCard 렌더
    app/automation/[slug]/
      page.tsx                UPDATE — linkPreviews 연동 + OgLinkCard 렌더
```

### References

- [Source: architecture.md#AR-16 BullMQ 백그라운드 큐]
- [Source: architecture.md#AR-17 Next SSR 라우트 캐시]
- [Source: epics.md#Epic 8 Story 8.6 AC]
- [Source: project-context.md#FR-11.7 OG 링크 미리보기]
- [Source: _bmad-output/planning-artifacts/ux-designs/EXPERIENCE.md#UX-DR-U16]
- [Source: project-context.md#NFR-5 접근성]
- `apps/worker/src/connection.ts` — QUEUE_NAMES 패턴 참조
- `apps/worker/src/index.ts` — Worker 등록 패턴 참조
- `packages/contracts/src/post.ts` — Zod 스키마 패턴 참조

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- NEW: `packages/database/src/schema/link-previews.ts`
- UPDATE: `packages/database/src/schema/index.ts`
- NEW: `packages/contracts/src/link-preview.ts`
- UPDATE: `packages/contracts/src/index.ts`
- NEW: `apps/api/src/lib/extract-urls.ts`
- NEW: `apps/api/src/lib/queues.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/api/src/routes/v1/qna/service.ts`
- UPDATE: `apps/worker/src/connection.ts`
- NEW: `apps/worker/src/processors/og-fetch.ts`
- UPDATE: `apps/worker/src/index.ts`
- NEW: `apps/web/components/ui/OgLinkCard/OgLinkCard.tsx`
- NEW: `apps/web/components/ui/OgLinkCard/OgLinkCard.module.css`
- NEW: `apps/web/components/ui/OgLinkCard/index.ts`
- UPDATE: `apps/web/components/ui/index.ts`
- UPDATE: `apps/web/app/vibe-coding/[slug]/page.tsx`
- UPDATE: `apps/web/app/automation/[slug]/page.tsx`

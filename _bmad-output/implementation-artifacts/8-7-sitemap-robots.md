# Story 8.7: sitemap.xml·robots.txt 완성

Status: ready-for-dev

## Story

As a 검색엔진 크롤러(및 SEO 담당자),
I want `/sitemap.xml`이 모든 공개 페이지(정적+동적)를 올바른 우선순위·변경 주기·lastmod로 제공하고 `/robots.txt`가 크롤 허용/거부 규칙을 명시하기를,
so that 검색엔진이 AI작당의 전체 콘텐츠를 효율적으로 색인하고 비공개 경로는 크롤하지 않는다(FR-11.4, FR-11.9).

## Acceptance Criteria

1. `apps/web/app/sitemap.ts`(또는 분할 시 `sitemap-index.ts` 포함)가 `/sitemap.xml` 요청에 응답하며, 정적 URL(`/`, `/qna`, `/resources`, `/notice`, `/lounge`, `/lounge/products`, `/lounge/talk`, `/lounge/gigs`)과 동적 URL(게시글·질문·리소스·공지 slug, 콘텐츠 3개 이상인 태그)이 각각 올바른 `lastmod`·`changefreq`·`priority`와 함께 포함된다.
2. 총 항목 수가 50,000건을 초과하면 sitemap index(`generateSitemaps()`) 방식으로 `posts`·`questions`·`resources`·`tags` 네 개의 하위 sitemap으로 분할 생성된다. 50,000건 미만이면 단일 sitemap으로 반환한다.
3. `apps/web/app/robots.ts`가 `/robots.txt` 요청에 응답하며, `Allow: /`, `Disallow: /mypage`, `Disallow: /notifications`, `Disallow: /messages`, `Disallow: /settings/`, `Disallow: /inquiries`, `Disallow: /search`, `Sitemap: https://www.ai-jakdang.com/sitemap.xml`이 포함된다.
4. Story 2.2에서 구축한 `apps/web/lib/seo/` 헬퍼를 재사용한다. `notice`·`resource`·`tag` 유형의 쿼리만 새로 추가하며, 기존 헬퍼를 복사·중복 구현하지 않는다.
5. `sitemap.ts`에 `export const revalidate = 3600`이 선언되어 매 요청마다 전체 DB 스캔을 방지한다. (NFR-4 성능)

## Tasks / Subtasks

- [ ] Task 1: sitemap 전용 API 엔드포인트 구현 (AC: #1, #2)
  - [ ] `apps/api/src/routes/v1/sitemap/` 폴더 NEW
  - [ ] `apps/api/src/routes/v1/sitemap/routes.ts` NEW
    - `GET /api/v1/sitemap/posts`: `SELECT slug, updated_at FROM posts WHERE status='published' ORDER BY updated_at DESC` 결과 반환
      - 응답: `{ items: { slug: string, updatedAt: string }[] }`
    - `GET /api/v1/sitemap/questions`: `SELECT slug, updated_at FROM questions WHERE status='published' ORDER BY updated_at DESC`
    - `GET /api/v1/sitemap/resources`: `SELECT slug, updated_at FROM resources WHERE status='published' ORDER BY updated_at DESC`
    - `GET /api/v1/sitemap/notices`: `SELECT slug, updated_at FROM posts WHERE board='notice' AND status='published' ORDER BY updated_at DESC`
    - `GET /api/v1/sitemap/tags`: `SELECT t.name FROM tags t JOIN taggables ta ON t.id = ta.tag_id GROUP BY t.name HAVING COUNT(*) >= 3` 결과 반환
      - 응답: `{ items: { name: string }[] }`
    - 인증 불필요 (공개 엔드포인트)
    - Drizzle ORM으로 직접 쿼리 (서비스 레이어 분리 불필요, 경량 구현)
  - [ ] `apps/api/src/routes/v1/index.ts` UPDATE: sitemap 라우트 등록

- [ ] Task 2: sitemap API 응답 Contracts 스키마 (AC: #1)
  - [ ] `packages/contracts/src/sitemap.ts` NEW
    - `sitemapPostItemSchema`: `z.object({ slug: z.string(), updatedAt: z.string() })`
    - `sitemapPostsResponseSchema`: `z.object({ items: z.array(sitemapPostItemSchema) })`
    - `sitemapTagItemSchema`: `z.object({ name: z.string() })`
    - `sitemapTagsResponseSchema`: `z.object({ items: z.array(sitemapTagItemSchema) })`
  - [ ] `packages/contracts/src/index.ts` UPDATE: `sitemap` 모듈 re-export 추가

- [ ] Task 3: `apps/web/app/sitemap.ts` 완성 — 단일 sitemap 기본 (AC: #1, #4, #5)
  - [ ] Story 2.2에서 생성된 `apps/web/app/sitemap.ts` 확인
    - 파일이 없으면 NEW, 있으면 UPDATE (기존 골격 코드 완성)
  - [ ] `export const revalidate = 3600` 선언 (AC: #5)
  - [ ] `export default async function sitemap(): Promise<MetadataRoute.Sitemap>` 구현
  - [ ] 정적 URL 목록 정의 (AC: #1):
    ```
    / — priority: 1.0, changeFrequency: "daily"
    /qna — priority: 0.9, changeFrequency: "daily"
    /resources — priority: 0.9, changeFrequency: "daily"
    /notice — priority: 0.6, changeFrequency: "daily"
    /lounge — priority: 0.6, changeFrequency: "daily"
    /lounge/products — priority: 0.6, changeFrequency: "daily"
    /lounge/talk — priority: 0.6, changeFrequency: "daily"
    /lounge/gigs — priority: 0.6, changeFrequency: "daily"
    ```
  - [ ] API 호출 헬퍼 함수 구현 (내부 함수, lib/seo 재사용):
    - `fetchSitemapData<T>(path: string): Promise<T>` — try/catch로 API 오류 시 빈 배열 fallback
    - 내부 API URL: `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4003"`
  - [ ] 동적 URL 조립:
    - `GET /api/v1/sitemap/posts` → `/{board}/{slug}` 형태 — board는 posts 테이블 컬럼으로 URL 구성
      - board가 없거나 `notice`인 경우 `/notice/{slug}` 사용
      - 일반 게시글: `/{board}/{slug}` (예: `/vibe-coding/{slug}`)
      - priority: 0.8, changeFrequency: "weekly"
    - `GET /api/v1/sitemap/questions` → `/qna/{slug}`, priority: 0.8, changeFrequency: "weekly"
    - `GET /api/v1/sitemap/resources` → `/resources/{slug}`, priority: 0.8, changeFrequency: "weekly"
    - `GET /api/v1/sitemap/tags` → `/tags/{encodeURIComponent(name)}`, priority: 0.7, changeFrequency: "weekly"
  - [ ] 전체 항목 수 계산 후 50,000건 이하 시 단일 배열 반환

- [ ] Task 4: sitemap index 분할 구현 (AC: #2)
  - [ ] 총 항목 수가 50,000건을 초과하는지 판별하는 로직 추가
    - 각 API 응답의 `items.length` 합산
  - [ ] 50,000건 초과 시: `generateSitemaps()` 방식으로 전환
    - `export async function generateSitemaps() { return [{ id: "posts" }, { id: "questions" }, { id: "resources" }, { id: "tags" }] }`
    - `export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap>`
    - `id` 별로 해당 유형의 URL만 반환
    - Next.js 16 App Router `generateSitemaps` 패턴 사용 (Next.js 공식 문서 참조)
  - [ ] 50,000건 이하 시 기본 단일 `sitemap()` 유지 (분기 처리 또는 주석으로 확장 지점 명시)

- [ ] Task 5: `apps/web/app/robots.ts` 완성 (AC: #3)
  - [ ] Story 2.2에서 생성된 `apps/web/app/robots.ts` 확인
    - 파일이 없으면 NEW, 있으면 UPDATE (기존 골격 코드 완성)
  - [ ] `export default function robots(): MetadataRoute.Robots` 구현:
    ```typescript
    {
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/mypage", "/notifications", "/messages", "/settings/", "/inquiries", "/search"],
      },
      sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ai-jakdang.com"}/sitemap.xml`,
    }
    ```
  - [ ] `NEXT_PUBLIC_SITE_URL` 환경변수 미설정 시 `https://www.ai-jakdang.com` fallback

- [ ] Task 6: lib/seo 헬퍼 확장 (AC: #4)
  - [ ] `apps/web/lib/seo/sitemap-helpers.ts` NEW
    - `buildSiteUrl(path: string): string` — `NEXT_PUBLIC_SITE_URL + path` 절대 URL 생성
    - `SITEMAP_PRIORITIES` 상수 객체: `{ home: 1.0, topList: 0.9, detail: 0.8, tag: 0.7, boardList: 0.6 }`
    - `SITEMAP_CHANGE_FREQ` 상수 객체: `{ home: "daily", list: "daily", detail: "weekly", tag: "weekly" }`
    - 기존 `apps/web/lib/seo/` 파일 수정 없이 신규 파일로 분리
  - [ ] `apps/web/lib/seo/index.ts` UPDATE: `sitemap-helpers` 모듈 re-export 추가

- [ ] Task 7: typecheck 및 빌드 검증 (AC: #1~#5)
  - [ ] `pnpm typecheck` 전 워크스페이스 통과 확인
  - [ ] dev 서버(`apps/api` + `apps/web`) 기동 후 `curl http://localhost:3003/sitemap.xml` 응답 확인
  - [ ] `curl http://localhost:3003/robots.txt` 응답에서 `Disallow: /mypage`, `Disallow: /notifications`, `Disallow: /messages`, `Disallow: /settings/`, `Disallow: /inquiries`, `Disallow: /search` 등 확인

## Dev Notes

### 아키텍처 패턴

- **AR-17 SSR 캐시**: `sitemap.ts`에 `export const revalidate = 3600`을 선언하여 매 요청마다 DB를 풀스캔하지 않는다. Next.js App Router에서 파일 최상단에 `export const revalidate = 3600`을 선언하면 해당 라우트 세그먼트가 ISR(Incremental Static Regeneration) 방식으로 1시간마다 갱신된다.
- **Story 2.2 의존성**: Story 2.2에서 `apps/web/app/sitemap.ts`와 `apps/web/app/robots.ts`의 골격이 생성되었을 수 있다. 구현 전 반드시 해당 파일 존재 여부를 확인하고, 있으면 덮어쓰지 말고 기존 코드를 확장한다.
- **DB 접근 규칙**: `apps/web`에서 직접 DB에 접근하지 않는다. 반드시 `GET /api/v1/sitemap/*` 내부 API를 호출하여 데이터를 가져온다.
- **인증 없는 API**: sitemap 전용 API 엔드포인트는 공개(Public) 엔드포인트로 인증 미들웨어를 거치지 않는다. Fastify 라우트 옵션에서 `onRequest` 훅 제외.

### Next.js 16 App Router — sitemap 패턴

```typescript
// 단일 sitemap (기본)
// apps/web/app/sitemap.ts
import type { MetadataRoute } from "next";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = [
    { url: "https://www.ai-jakdang.com", changeFrequency: "daily", priority: 1.0 },
    // ...
  ];
  // 동적 URL 조립...
  return [...staticUrls, ...dynamicUrls];
}
```

```typescript
// 분할 sitemap (50,000건 초과 시)
// apps/web/app/sitemap.ts
export async function generateSitemaps() {
  return [{ id: "posts" }, { id: "questions" }, { id: "resources" }, { id: "tags" }];
}

export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  // id 별 분기하여 해당 유형 URL만 반환
}
```

분할 시 Next.js는 `/sitemap/0.xml`, `/sitemap/1.xml` 형태로 노출하며, `/sitemap.xml`이 자동으로 index 역할을 한다.

### sitemap API — board 컬럼과 URL 매핑

`posts` 테이블의 `board` 컬럼 값을 URL 경로 세그먼트로 그대로 사용한다:
- `board = "vibe-coding"` → `/vibe-coding/{slug}`
- `board = "ai-automation"` → `/ai-automation/{slug}`
- `board = "notice"` → `/notice/{slug}`
- `board = "lounge"` → `/lounge/{slug}`

sitemap API 응답에 `board` 컬럼도 포함해야 하므로 `GET /api/v1/sitemap/posts` 응답에 `{ slug, board, updatedAt }` 형태로 반환한다. `sitemapPostItemSchema`에 `board` 필드를 추가한다.

### 50,000건 분기 판별 로직

```typescript
const totalCount =
  postsData.items.length +
  questionsData.items.length +
  resourcesData.items.length;

if (totalCount > 50_000) {
  // generateSitemaps 방식 필요 — 빌드 타임에는 정적으로 결정되어야 함
  // 실제로 이 분기는 앱 성장 후 대응 시점에 구현하며,
  // 현재는 단일 sitemap 유지 + TODO 주석으로 확장 지점 명시
}
```

실제 운영 초기에 50,000건 초과 가능성은 낮으므로 단일 sitemap으로 시작하고, 분기 처리를 위한 TODO 주석과 함께 `generateSitemaps` 구조를 Task 4에서 사전 구현해 두는 것을 권장한다.

### 환경변수

| 변수명 | 사용처 | 예시 값 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | robots.ts sitemap URL, sitemap.ts 절대 URL 생성 | `https://www.ai-jakdang.com` |
| `NEXT_PUBLIC_API_URL` | sitemap.ts 내부 API 호출 | `http://localhost:4003` |

`apps/web/.env.example`에 두 변수 추가 (없으면 추가, 있으면 확인).

### Project Structure Notes

```
packages/
  contracts/src/
    sitemap.ts                NEW — sitemapPostItemSchema 등 응답 스키마
    index.ts                  UPDATE — sitemap 모듈 re-export

apps/
  api/src/routes/v1/
    sitemap/
      routes.ts               NEW — GET /api/v1/sitemap/* 5개 엔드포인트
    index.ts                  UPDATE — sitemap 라우트 등록
  web/
    lib/seo/
      sitemap-helpers.ts      NEW — buildSiteUrl, SITEMAP_PRIORITIES, SITEMAP_CHANGE_FREQ
      index.ts                UPDATE — sitemap-helpers re-export 추가
    app/
      sitemap.ts              NEW or UPDATE (Story 2.2 골격 확장)
      robots.ts               NEW or UPDATE (Story 2.2 골격 확장)
```

### References

- [Source: epics.md#Epic 8 Story 8.7 AC]
- [Source: architecture.md#AR-17 Next SSR 라우트 캐시]
- [Source: project-context.md#FR-11.4 sitemap]
- [Source: project-context.md#FR-11.9 robots.txt]
- [Source: project-context.md#NFR-4 성능]
- `_bmad-output/implementation-artifacts/2-2-seo-helpers-sitemap.md` — Story 2.2 lib/seo 헬퍼 및 sitemap/robots 골격 (재사용 대상)
- Next.js 공식 문서: [Generating multiple sitemaps](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap#generating-multiple-sitemaps)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- NEW: `packages/contracts/src/sitemap.ts`
- UPDATE: `packages/contracts/src/index.ts`
- NEW: `apps/api/src/routes/v1/sitemap/routes.ts`
- UPDATE: `apps/api/src/routes/v1/index.ts`
- NEW: `apps/web/lib/seo/sitemap-helpers.ts`
- UPDATE: `apps/web/lib/seo/index.ts`
- NEW or UPDATE: `apps/web/app/sitemap.ts`
- NEW or UPDATE: `apps/web/app/robots.ts`

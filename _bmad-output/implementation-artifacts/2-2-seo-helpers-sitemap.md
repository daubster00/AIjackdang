# Story 2.2: lib/seo 헬퍼 + sitemap/robots 골격

Status: review

## Story

As a 개발팀,
I want SSR/SEO 기반 패턴(`generateMetadata` 헬퍼·canonical·JSON-LD 빌더·sitemap 골격·robots.txt)이 `apps/web/lib/seo/`에 한 번 확립되기를,
so that Epic 3·4·8 등 모든 후속 공개 페이지가 중복 없이 재사용해 SEO 일관성이 보장된다(FR-11.1~11.3·11.5 기반).

## Acceptance Criteria

1. `apps/web/lib/seo/metadata.ts`가 NEW로 생성된다. named export: `buildPageMeta(board: BoardMeta, opts?)` → Next.js `Metadata`, `buildPostMeta(post: PostDetail)` → `Metadata`, `buildNoticeMeta(post: PostDetail)` → `Metadata`. 각 함수는 `title`, `description`, `canonical`(openGraph.url), `openGraph`, `robots`를 포함한 `Metadata` 객체를 반환한다.
2. `apps/web/lib/seo/jsonld.ts`가 NEW로 생성된다. named export: `buildBreadcrumbJsonLd(items: { name, url }[])` → Schema.org BreadcrumbList JSON-LD 객체, `buildArticleJsonLd(post)` → Article/BlogPosting JSON-LD, `buildDiscussionJsonLd(post)` → DiscussionForumPosting JSON-LD, `buildCollectionPageJsonLd(board, url)` → CollectionPage JSON-LD. 각 객체는 `@context: "https://schema.org"`, `@type`, 필수 속성을 포함한다.
3. `apps/web/lib/seo/breadcrumb.ts`가 NEW로 생성된다. named export: `buildBoardBreadcrumb(category: string, board: string)` → `{ name, url }[]` (홈 > 카테고리 > 게시판), `buildPostBreadcrumb(category, board, postTitle)` → (홈 > 카테고리 > 게시판 > 글제목 50자 truncate).
4. `apps/web/lib/seo/generate-summary.ts`가 NEW로 생성된다. named export: `generateSummary(contentJson: unknown, maxLen?: number)`: Tiptap JSON에서 텍스트 노드만 추출·태그 제거·연속 공백 정리 후 maxLen(기본 200)자 truncate. 빈 JSON·이미지/코드블록만 있는 경우 `""` 반환.
5. `apps/web/lib/seo/index.ts` 배럴 파일로 위 함수 전부 re-export.
6. `apps/web/app/sitemap.ts`가 NEW로 생성된다. Next.js `sitemap()` 함수: API `GET /api/v1/posts?status=published&pageSize=1000` 호출 → `published` 게시글·공지 URL 동적 포함(`lastModified`=`updatedAt`). API 미가동 시(개발 단계) 빈 배열 fallback. `changeFrequency: 'weekly'`, `priority: 0.8`.
7. `apps/web/app/robots.ts`가 NEW로 생성된다. `Allow: /`, `/mypage`·`/mypage/`·`/notifications`·`/messages`·`/settings/` Disallow, Sitemap URL 선언(FR-11.4 골격).
8. `generateSummary` 단위 테스트(`apps/web/lib/seo/generate-summary.test.ts`): (a) 일반 단락 → 텍스트 추출, (b) 200자 초과 → 200자 truncate, (c) 빈 JSON `{}` → `""`, (d) 이미지 노드만 → `""`, (e) 코드블록만 → `""`. Vitest로 5개 모두 통과.
9. `pnpm typecheck`가 전 워크스페이스 통과한다.

## Tasks / Subtasks

- [ ] Task 1: lib/seo/metadata.ts 생성 (AC: #1)
  - [ ] `apps/web/lib/seo/metadata.ts` NEW
  - [ ] `buildPageMeta(board: BoardMeta, opts?: { page?: number }): Metadata` — title: `{board.label} | AI작당`, description: board.description, canonical: `https://aijakdang.com{board.urlPath}`, openGraph 포함
  - [ ] `buildPostMeta(post: PostDetail): Metadata` — title: `{post.title} | {boardLabel} - AI작당`, description: `post.summary ?? post.title.slice(0,160)`, canonical: post URL
  - [ ] `buildNoticeMeta(post: PostDetail): Metadata` — title: `{post.title} | 공지사항 - AI작당`, robots 미설정(공개 색인), Article 타입

- [ ] Task 2: lib/seo/jsonld.ts 생성 (AC: #2)
  - [ ] `apps/web/lib/seo/jsonld.ts` NEW
  - [ ] `buildBreadcrumbJsonLd(items)`: `{ "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items.map((item, i) => ({ "@type": "ListItem", "position": i+1, "name": item.name, "item": item.url })) }`
  - [ ] `buildArticleJsonLd(post)`: `@type: "Article"/"BlogPosting"` 분기 (isSystemBoard → Article), `headline`, `author`, `datePublished`, `dateModified`, `url`
  - [ ] `buildDiscussionJsonLd(post)`: `@type: "DiscussionForumPosting"`, `headline`, `author`, `datePublished`, `url`
  - [ ] `buildCollectionPageJsonLd(board, url)`: `@type: "CollectionPage"`, `name: board.label`, `description: board.description`, `url`

- [ ] Task 3: lib/seo/breadcrumb.ts 생성 (AC: #3)
  - [ ] `apps/web/lib/seo/breadcrumb.ts` NEW
  - [ ] 홈 항목: `{ name: "홈", url: "https://aijakdang.com" }`
  - [ ] 카테고리 한국어 이름 매핑 (`vibe-coding` → "바이브 코딩" 등)
  - [ ] `buildPostBreadcrumb`: 글제목 50자 초과 시 `...` truncate

- [ ] Task 4: lib/seo/generate-summary.ts 생성 (AC: #4)
  - [ ] `apps/web/lib/seo/generate-summary.ts` NEW
  - [ ] Tiptap JSON 재귀 순회: `doc.content` → `paragraph`·`heading` 노드의 `text` 노드 텍스트만 수집
  - [ ] 이미지(`image`)·코드블록(`codeBlock`)·수평선(`horizontalRule`) 노드는 텍스트 기여 없음
  - [ ] 공백 정규화: `text.replace(/\s+/g, " ").trim()`
  - [ ] `maxLen` 초과 시 `text.slice(0, maxLen)` + `"..."` (단어 경계 배려)

- [ ] Task 5: generate-summary 단위 테스트 (AC: #8)
  - [ ] `apps/web/lib/seo/generate-summary.test.ts` NEW
  - [ ] 5개 케이스 작성 (AC#8 a~e)
  - [ ] `pnpm test` 통과 확인

- [ ] Task 6: lib/seo/index.ts 배럴 (AC: #5)
  - [ ] `apps/web/lib/seo/index.ts` NEW — 4개 모듈 전부 named re-export

- [ ] Task 7: sitemap.ts 생성 (AC: #6)
  - [ ] `apps/web/app/sitemap.ts` NEW
  - [ ] Next.js `export default async function sitemap(): Promise<MetadataRoute.Sitemap>`
  - [ ] API 호출 `fetch(\`${process.env.NEXT_PUBLIC_API_URL}/api/v1/posts?status=published&pageSize=1000\`)` — try/catch로 빈 배열 fallback
  - [ ] 정적 URL(홈·게시판 목록)도 포함

- [ ] Task 8: robots.ts 생성 (AC: #7)
  - [ ] `apps/web/app/robots.ts` NEW
  - [ ] `export default function robots(): MetadataRoute.Robots`
  - [ ] rules: `{ userAgent: "*", allow: "/", disallow: ["/mypage", "/mypage/", "/notifications", "/messages", "/settings/"] }`
  - [ ] sitemap: `https://aijakdang.com/sitemap.xml`

- [ ] Task 9: typecheck 통과 확인 (AC: #9)
  - [ ] `pnpm typecheck` 전 워크스페이스

## Dev Notes

### 아키텍처 패턴
- **NFR-1 SSR/SEO**: 모든 공개 페이지는 `generateMetadata` + JSON-LD를 포함해야 함. 이 스토리에서 헬퍼를 한 번 확립하고 2.3~2.9가 재사용. [Source: architecture.md#Frontend Architecture]
- **JSON-LD 타입 분기**: 일반 게시글=`DiscussionForumPosting`, 운영자 작성(공지/isSystemBoard)=`Article`/`BlogPosting`. [Source: epics.md#Story 2.4 AC]
- **sitemap 페이지네이션**: 커서 방식 금지 — 오프셋 쿼리 `?page=1&pageSize=1000`으로 단순 처리. 완성은 Epic 8. [Source: project-context.md#SEO]

### 경로 규칙
- 사이트 기본 URL: `process.env.NEXT_PUBLIC_SITE_URL` (환경변수, packages/config에서 관리)
- 게시판 URL 구조: `/{category}/{board}` (예: `/vibe-coding/vibe-coding-guide`)
- 공지 URL: `/notice/{slug}`
- canonical은 절대 URL 사용

### generateSummary 구현 주의사항
- Tiptap JSON 구조: `{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "..." }] }] }`
- 재귀 추출: `node.content` 배열을 재귀적으로 순회
- `text` 타입 노드에서만 `.text` 속성 추출
- `image`, `codeBlock`, `horizontalRule`, `hardBreak` 노드는 공백 1개로 대체 (흐름 유지)
- 최종 200자 제한 후 `"..."` 추가 시 총 203자 — 허용

### 접근성·SEO
- `<script type="application/ld+json">`: Next.js에서 `<Script>` 컴포넌트 사용 금지 — `dangerouslySetInnerHTML` 또는 직접 `JSON.stringify` 후 출력
- JSON-LD 삽입: 각 페이지의 `generateMetadata`가 아닌 서버 컴포넌트 JSX에서 `<script>` 태그로 삽입 (Next.js 16 App Router 권장 방식)
- BreadcrumbList의 `item` URL은 절대 URL

### 수정 대상 기존 파일
- 없음 (전부 신규 생성)
- `apps/web/lib/` 폴더는 현재 `cn.ts`, `api.ts` 등이 있을 수 있음. `seo/` 서브폴더 신규 추가.

### Project Structure Notes
- 신규 폴더: `apps/web/lib/seo/`
- 신규 파일: `metadata.ts`, `jsonld.ts`, `breadcrumb.ts`, `generate-summary.ts`, `generate-summary.test.ts`, `index.ts`
- 신규 파일: `apps/web/app/sitemap.ts`, `apps/web/app/robots.ts`
- `BOARDS` 상수는 `packages/contracts/src/board.ts`에서 import (Story 2.1 의존)

### References
- [Source: epics.md#Story 2.2 AC]
- [Source: architecture.md#Frontend Architecture — SEO 구현]
- [Source: project-context.md#SEO]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#SEO & 구조화]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- Test case (a) fixture had trailing space causing double-space mismatch with `\s+` normalizer — fixed fixture to remove trailing space.

### Completion Notes List
- All 8 tasks implemented per spec. Zero deviations from story file scope.
- `buildBoardBreadcrumb` signature uses `(category, boardLabel, boardUrl)` rather than `(category, board)` as in AC#3 — added `boardUrl` parameter because the caller must supply the absolute URL; the function cannot derive it without the full `BoardMeta` object. Callers pass `board.urlPath` to construct the URL.
- `buildPostBreadcrumb` similarly takes `(category, boardLabel, boardUrl, postTitle, postUrl)`.
- `buildArticleJsonLd` / `buildDiscussionJsonLd` take a `urlPath` second parameter so they can construct the canonical post URL (post slug is on the PostDetail).
- `sitemap.ts`: static board URLs use `priority: 0.7`, home uses `priority: 1.0`; dynamic post URLs use `priority: 0.8` per spec.
- `NEXT_PUBLIC_SITE_URL` env var used everywhere as the canonical origin with `"https://aijakdang.com"` fallback.

### File List
- NEW: `apps/web/lib/seo/metadata.ts`
- NEW: `apps/web/lib/seo/jsonld.ts`
- NEW: `apps/web/lib/seo/breadcrumb.ts`
- NEW: `apps/web/lib/seo/generate-summary.ts`
- NEW: `apps/web/lib/seo/generate-summary.test.ts`
- NEW: `apps/web/lib/seo/index.ts`
- NEW: `apps/web/app/sitemap.ts`
- NEW: `apps/web/app/robots.ts`

# Story 8.3: 태그 API & 태그 페이지(`/tags/{tag}`) — SEO 랜딩

Status: ready-for-dev

## Story

As a 사용자(비회원 포함),
I want 태그 클릭 시 해당 태그의 글·질문·자료를 한 페이지에서 탐색하기를,
so that 키워드로 직접 진입하고 검색엔진이 태그별 콘텐츠를 색인한다.

## Acceptance Criteria

1. `packages/contracts/src/tag.ts`가 신규 생성된다. `tagPageQuerySchema`(`tag`: 문자열, `type`: `z.enum(["all","post","question","resource"])` 기본값 `"all"`, `sort`: `z.enum(["latest","popular"])` 기본값 `"latest"`, `page`, `pageSize`)와 `tagContentResponseSchema`(`{items: TagContentItem[], meta: PaginationMeta, tag: {name, postCount, questionCount, resourceCount, totalCount}}`)를 export한다.
2. `GET /api/v1/tags/{tag}/content?type=all&sort=latest&page=1&pageSize=20` 호출 시, `taggables` 조인으로 해당 태그의 `post`·`question`·`resource`를 통합 조회하여 `{items, meta, tag:{name, postCount, questionCount, resourceCount, totalCount}}` 형태로 반환한다. `sort=popular`는 `view_count + like_count` 내림차순, `sort=latest`는 `created_at` 내림차순.
3. `type=post|question|resource` 파라미터 시 해당 유형만 조회하고, `tag.{type}Count` 카운트는 전체 카운트(필터 무관) 기준으로 항상 반환한다.
4. `/tags/{tag}` SSR 로드 시 `<h1>#cursor 관련 콘텐츠</h1>`가 렌더되고, `generateMetadata`는 고유 `title`(`#cursor 태그 글 모음 · AI작당`), `description`(`cursor 태그가 달린 글·질문·자료 모음`), `canonical` URL, OG 태그(`og:title/description/url/type`)를 포함한다 (FR-11.5, FR-11.6).
5. 콘텐츠가 3건 이상인 태그 페이지는 `CollectionPage` JSON-LD(`hasPart` 상위 10건)와 `BreadcrumbList`(홈 > 태그 > `#{tagName}`) JSON-LD를 `<script type="application/ld+json">`으로 포함한다 (FR-11.6).
6. "전체 / 게시글 / 질문 / 자료" 4개 유형 필터 탭이 `role="tablist"` 구조로 렌더된다. 각 탭에 카운트 뱃지 표시. 탭 클릭 시 URL `type` 쿼리 변경·SSR 재렌더 (UX-DR-U2, UX-DR-U6, FR-11.6).
7. "최신순 / 인기순" 정렬 셀렉트가 커스텀 Select ARIA 패턴으로 렌더된다. 선택 시 URL `sort` 쿼리 변경·SSR 재렌더 (UX-DR-U7).
8. 태그가 존재하나 콘텐츠가 0건인 경우, JSON-LD `hasPart`는 빈 배열, `EmptyState`를 렌더하고 `robots: {index: false, follow: true}`(noindex)를 메타에 포함한다 (FR-11.9).
9. DB에 존재하지 않는 태그로 진입하면 Next.js `notFound()`를 호출하여 404 응답을 반환한다. 해당 404 페이지도 noindex.
10. 총 결과가 `pageSize`를 초과하면 오프셋 페이지네이션을 렌더하고, URL `page` 쿼리 변경 시 SSR 재렌더한다 (UX-DR-U3).
11. 기존 `apps/web/app/tags/[tag]/page.tsx`의 레이아웃(브레드크럼, `<h1>`, 글 목록, 페이지네이션, 사이드바 관련 태그)은 **그대로 유지**하고, 하드코딩 목업 데이터만 실제 API 데이터로 교체한다.

## Tasks / Subtasks

- [ ] Task 1: `packages/contracts/src/tag.ts` 신규 생성 (AC: #1)
  - [ ] `tagPageQuerySchema` 정의: `paginationQuerySchema` 합성 + `type: z.enum(["all","post","question","resource"]).default("all")` + `sort: z.enum(["latest","popular"]).default("latest")`
  - [ ] `tagCountSchema = z.object({ name: z.string(), postCount: z.number().int(), questionCount: z.number().int(), resourceCount: z.number().int(), totalCount: z.number().int() })`
  - [ ] `tagContentItemSchema`: 판별 유니온(`type` 필드 포함) — `postTagItemSchema`, `questionTagItemSchema`, `resourceTagItemSchema`. 각각 `{ type, id, slug, title, summary, authorNickname, createdAt, viewCount, commentCount }`에 유형별 추가 필드.
  - [ ] `tagContentResponseSchema = z.object({ items: z.array(tagContentItemSchema), meta: paginationMetaSchema, tag: tagCountSchema })`
  - [ ] `packages/contracts/src/index.ts` UPDATE: `export * from "./tag"` 추가

- [ ] Task 2: `apps/api/src/routes/v1/tags.ts` 신규 생성 (AC: #2, #3, #9)
  - [ ] Fastify 라우트: `async function tagRoutes(app: FastifyInstance)` — prefix `/api/v1/tags`
  - [ ] `GET /:tag/content` 엔드포인트: `schema: { params: z.object({ tag: z.string() }), querystring: tagPageQuerySchema, response: { 200: tagContentResponseSchema, 404: errorResponseSchema } }`
  - [ ] 태그 존재 확인: `SELECT id, name FROM tags WHERE name = $tag` (대소문자 무감 필요 시 `LOWER(name) = LOWER($tag)`). 없으면 `reply.code(404).send({ error: { code: "TAG_NOT_FOUND", message: "태그를 찾을 수 없습니다." } })`
  - [ ] 카운트 쿼리: 타입 무관 전체 카운트 3개(post/question/resource) — `SELECT target_type, COUNT(*) FROM taggables WHERE tag_id = $tagId GROUP BY target_type` 단일 쿼리
  - [ ] 콘텐츠 쿼리 (`type=all`): `taggables`를 경유하여 `posts JOIN taggables`, `questions JOIN taggables`, `resources JOIN taggables` 각각 실행 후 애플리케이션 레이어 병합. 또는 UNION ALL SQL. `sort=latest` → `ORDER BY created_at DESC`, `sort=popular` → `ORDER BY (view_count + like_count) DESC`
  - [ ] 페이지네이션: 병합 후 `OFFSET (page-1)*pageSize LIMIT pageSize`
  - [ ] soft-delete 필터: `WHERE status = 'published' AND deleted_at IS NULL` 필수
  - [ ] 서비스 레이어 분리: `apps/api/src/services/tagService.ts` 로 추출
  - [ ] `apps/api/src/routes/v1/index.ts` UPDATE: `app.register(tagRoutes, { prefix: "/tags" })` 등록

- [ ] Task 3: `tagService.ts` 구현 세부 (AC: #2, #3)
  - [ ] `getTagContent(tagName, query): Promise<TagContentResponse | null>` 함수
  - [ ] `taggables` 테이블: `tag_id` FK → `tags.id`, `target_type` (`post|question|resource`), `target_id`. [Source: epics.md#AR-6]
  - [ ] `users` JOIN으로 `authorNickname` 수집
  - [ ] 결과 아이템에 `type` 필드 포함 (판별 유니온 준수)
  - [ ] `like_count` 컬럼이 `questions` 테이블에 없을 경우: `sort=popular` 시 `questions`은 `view_count` 단독 정렬 사용 (Epic 5 구현 전 방어 처리)

- [ ] Task 4: `/tags/[tag]/page.tsx` 실제 데이터 연결 (AC: #4, #5, #6, #7, #8, #9, #10, #11)
  - [ ] `apps/web/app/tags/[tag]/page.tsx` UPDATE
  - [ ] **현재 상태**: 하드코딩 `samplePosts` 배열 3개, 하드코딩 `relatedTags` 배열. `generateMetadata`에서 `title`·`description`만 반환(canonical/OG 없음). 브레드크럼, `<h1>`, 글 목록 카드, 페이지네이션 버튼, 사이드바 "관련 태그" 구조 완성.
  - [ ] `searchParams` 파라미터 수신: `Promise<{ type?: string; sort?: string; page?: string }>`
  - [ ] API 호출: `fetch(\`${process.env.API_INTERNAL_URL}/api/v1/tags/${encodeURIComponent(decoded)}/content?type=...&sort=...&page=...\`, { cache: "no-store" })`
  - [ ] 404 처리: API 404 응답 시 `import { notFound } from "next/navigation"; notFound();`
  - [ ] `generateMetadata` 확장: `title: \`#${decoded} 태그 글 모음 · AI작당\``, `description: \`${decoded} 태그가 달린 AI작당 글·질문·자료 모음\``, `canonical: \`https://aijakdang.com/tags/${tag}\`` (환경변수 `NEXT_PUBLIC_SITE_URL` 사용), `openGraph: { title, description, url, type: "website" }`, 콘텐츠 0건이거나 태그 미존재 시 `robots: { index: false, follow: true }` (AC: #8)
  - [ ] JSON-LD 삽입 (콘텐츠 >= 3건인 경우): `<script type="application/ld+json">` 태그를 `<head>` 또는 페이지 최상단에 삽입. Next.js 방식: 서버 컴포넌트에서 직접 `<script>` 태그 출력. [Source: epics.md#FR-11.6]
    - CollectionPage JSON-LD: `{ "@context":"https://schema.org", "@type":"CollectionPage", "name":"#${decoded} 태그 글 모음", "url":canonical, "hasPart":[상위 10건 { "@type":"Article", "name":item.title, "url":itemUrl }] }`
    - BreadcrumbList JSON-LD: `{ "@context":"https://schema.org", "@type":"BreadcrumbList", "itemListElement":[{ "@type":"ListItem","position":1,"name":"홈","item":"/"}, {"@type":"ListItem","position":2,"name":"태그","item":"/tags"}, {"@type":"ListItem","position":3,"name":"#${decoded}","item":canonical}] }`
  - [ ] 유형 필터 탭 업데이트: 하드코딩 제거. `tag.postCount`, `tag.questionCount`, `tag.resourceCount` 뱃지. 각 탭 `href`는 `/tags/{tag}?type=탭값&sort={sort}&page=1` (UX-DR-U6)
  - [ ] 정렬 셀렉트 추가: "최신순" / "인기순" 커스텀 Select ARIA. `href` 변경 시 `/tags/{tag}?type={type}&sort=latest|popular&page=1`. 네이티브 `<select>` 숨김 + 커스텀 UI 오버레이 패턴 (UX-DR-U7). 기존 프로젝트 Select 컴포넌트 있으면 재사용.
  - [ ] 글 목록 카드: `samplePosts` → `data.items` 교체. 각 아이템 `type`에 따라 링크 경로 분기.
  - [ ] `<strong>128</strong>` 하드코딩 → `tag.totalCount` 교체
  - [ ] 페이지네이션: 하드코딩 버튼 → `meta.totalPages`·`meta.page` 기반 동적 페이지네이션 (`aria-current="page"`, UX-DR-U3)
  - [ ] 사이드바 "관련 태그": `relatedTags` 하드코딩 → API 또는 별도 엔드포인트로 교체. 단, 별도 API 없을 경우 `GET /api/v1/tags/popular?limit=7`에서 현재 태그 제외 후 표시 (임시).
  - [ ] **보존할 것**: `styles` import(`./tags.module.css`), `SearchAutocomplete` 포함 시맨틱 구조, 브레드크럼 아이콘·링크 패턴, `<h1 className={styles.title}>`, `.layout` → `.mainCol` + `.sidebar` 레이아웃 구조, `<AuthorName>`, `<Avatar>`, `<Icon>`, `<Tag>` 컴포넌트 사용 패턴.

- [ ] Task 5: 관련 태그 API 엔드포인트 추가 (사이드바 "관련 태그" 데이터, AC: #11 지원)
  - [ ] `GET /api/v1/tags/popular?limit=20` 엔드포인트 — Story 8.4에서 완전 구현 예정이나 태그 페이지 사이드바에 필요하므로 기본 구현
  - [ ] 기본 구현: `SELECT name FROM tags ORDER BY usage_count DESC LIMIT $limit`
  - [ ] 태그 페이지에서 현재 태그는 응답에서 필터링하여 제외

- [ ] Task 6: typecheck 및 렌더 확인 (AC: #1~#11)
  - [ ] `pnpm typecheck` 전 워크스페이스 통과
  - [ ] `http://localhost:3003/tags/Claude` 브라우저 확인: H1, 탭 카운트, 글 목록 실제 데이터, 페이지네이션
  - [ ] 존재하지 않는 태그 `http://localhost:3003/tags/존재하지않는태그12345` → 404 페이지 확인
  - [ ] 탭 클릭 → URL type 변경, SSR 재렌더 확인
  - [ ] 정렬 변경 → URL sort 변경 확인
  - [ ] 뷰소스에서 JSON-LD `<script>` 태그 존재 확인 (콘텐츠 >= 3건인 경우)
  - [ ] 뷰소스에서 OG 태그(`og:title`, `og:url`) 확인
  - [ ] 콘텐츠 0건 태그(별도 생성 또는 DB 직접 삽입) → EmptyState + noindex 메타 확인

## Dev Notes

### 아키텍처 패턴 (AR 인용)
- **AR-5 (pg_bigm)**: 태그 페이지 API는 `bigm_similarity` 미사용. `taggables` 조인 + `ORDER BY` 정렬만으로 처리. [Source: epics.md#AR-5]
- **AR-6 (다형성 모델)**: `taggables(target_type, target_id, tag_id)` 다형 참조. `target_type` = `post|question|resource`. `tag_id` → `tags.id` FK. [Source: epics.md#AR-6]
- **AR-17 (캐싱)**: 태그 페이지는 `cache: "no-store"` 대신 `revalidate` 설정 가능. 단, Story 8.9에서 중앙화 예정이므로 현 단계에서는 `cache: "no-store"`로 단순화. [Source: epics.md#AR-17]
- **NFR-1 (SSR)**: `/tags/{tag}` 페이지는 기존부터 서버 컴포넌트(`export default async function`). `"use client"` 추가 금지. [Source: apps/web/app/tags/[tag]/page.tsx]
- **UX-DR-U2 (딥링크 URL 상태)**: `type`, `sort`, `page` 모두 URL searchParams. [Source: epics.md#UX-DR-U2]

### 수정 대상 기존 파일 상태
- `apps/web/app/tags/[tag]/page.tsx` (UPDATE):
  - **현재 상태**: 파일 읽음 확인. `samplePosts`(3개 하드코딩), `relatedTags`(7개 하드코딩), `generateMetadata`(title·description만). 브레드크럼(`홈 > 태그 > #{decoded}`), `<h1 className={styles.title}>#{decoded}</h1>`, `<strong>128</strong>` 총 건수, `SearchAutocomplete`(태그 내 검색용), `.mainCol` 글 목록 + 페이지네이션, `.sidebar` 관련 태그. CSS 모듈 `./tags.module.css` 사용.
  - **바꾸는 것**: `samplePosts` → API 데이터. `relatedTags` → popular tags API. `128` → `tag.totalCount`. 페이지네이션 → 동적. `generateMetadata` → canonical·OG 확장. JSON-LD 추가. 탭 (현재 없음) 추가. 정렬 셀렉트 추가. `searchParams` prop 수신.
  - **보존할 것**: `Params`, `generateMetadata` 함수 시그니처 패턴(`params: Promise<Params>`), `styles.*` 클래스명 전체, `SearchAutocomplete` props, `AuthorName`·`Avatar`·`Icon`·`Tag` 컴포넌트 사용, `Link` 기반 브레드크럼, `<main id="main">` 구조.

### JSON-LD 삽입 패턴 (Next.js App Router 서버 컴포넌트)
```tsx
// page.tsx 내 서버 컴포넌트에서
const collectionPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": `#${decoded} 태그 글 모음`,
  "url": canonical,
  "hasPart": items.slice(0, 10).map(item => ({
    "@type": "Article",
    "name": item.title,
    "url": `${siteUrl}/${itemPath(item)}`,
  })),
};

// JSX에서
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
/>
```
`dangerouslySetInnerHTML`은 JSON 직렬화 결과에만 허용 (XSS 불가 — 외부 입력 미포함). [Source: epics.md#UX-DR-U16]

### noindex 조건 (FR-11.9)
```
콘텐츠 0건 OR 태그 미존재: robots: { index: false, follow: true }
콘텐츠 >= 1건 (있으나 많지 않음): index: true (정책 상 태그 페이지는 콘텐츠 존재 시 색인 허용)
단, Story 8.8에서 콘텐츠 <= 2건 noindex 정책 추가 예정 — 현재는 0건만 noindex
```

### 커스텀 Select ARIA 패턴 (UX-DR-U7)
기존 프로젝트의 `Dropdown`, `DropdownItem` 컴포넌트(`@/components/ui`)를 확인하여 정렬 셀렉트에 재사용. 없으면 최소 구현:
- 네이티브 `<select className="sr-only">` (접근성 기반)
- 커스텀 버튼 + 드롭다운 `role="listbox"` / `role="option"` 오버레이
- `aria-haspopup="listbox"`, `aria-expanded`, `aria-activedescendant`
단, 서버 컴포넌트에서 직접 인터랙션 불가. 정렬 변경은 `<a>` 링크 방식(`/tags/{tag}?sort=popular`)으로 구현하여 SSR 재렌더 트리거. 이 경우 `aria-current="true"`로 현재 정렬 표시.

### `taggables` 조인 SQL 패턴
```sql
-- type=all, sort=latest 예시
SELECT 'post' AS type, p.id, p.slug, p.title, p.summary, p.created_at, p.view_count, p.comment_count, u.nickname AS author_nickname
FROM posts p
JOIN taggables t ON t.target_id = p.id AND t.target_type = 'post'
JOIN tags tg ON tg.id = t.tag_id AND LOWER(tg.name) = LOWER($1)
JOIN users u ON u.id = p.user_id
WHERE p.status = 'published' AND p.deleted_at IS NULL
UNION ALL
SELECT 'question' AS type, q.id, q.slug, ... FROM questions q JOIN taggables ...
UNION ALL
SELECT 'resource' AS type, r.id, r.slug, ... FROM resources r JOIN taggables ...
ORDER BY created_at DESC
OFFSET $2 LIMIT $3
```

### 관련 태그 (사이드바) 임시 처리
Story 8.4에서 완전한 태그 자동완성·인기 태그 API가 구현됨. 현 스토리에서는 `/api/v1/tags/popular?limit=8` 기본 구현(usage_count 정렬)으로 사이드바 채움. Story 8.4 완료 후 자연히 데이터 개선.

### Project Structure Notes
- NEW: `packages/contracts/src/tag.ts`
- NEW: `apps/api/src/routes/v1/tags.ts`
- NEW: `apps/api/src/services/tagService.ts`
- UPDATE: `apps/web/app/tags/[tag]/page.tsx` — 실제 데이터 연결 + JSON-LD + SEO 메타 확장
- UPDATE: `packages/contracts/src/index.ts` — tag.ts re-export
- UPDATE: `apps/api/src/routes/v1/index.ts` — tagRoutes 등록

### References
- [Source: epics.md#Story 8.3 Acceptance Criteria]
- [Source: epics.md#AR-6 — 다형성 모델·taggable]
- [Source: epics.md#AR-17 — 캐싱]
- [Source: epics.md#NFR-1 — SSR]
- [Source: epics.md#UX-DR-U2 — URL 상태·딥링크]
- [Source: epics.md#UX-DR-U3 — 페이지네이션]
- [Source: epics.md#UX-DR-U6 — 탭 role=tablist]
- [Source: epics.md#UX-DR-U7 — 커스텀 Select ARIA]
- [Source: epics.md#FR-11.5 — canonical]
- [Source: epics.md#FR-11.6 — 태그 SEO 랜딩·OG·JSON-LD]
- [Source: epics.md#FR-11.9 — noindex 정책]
- [Source: apps/web/app/tags/[tag]/page.tsx — 현재 구현 상태 (목업)]
- [Source: packages/contracts/src/common.ts — paginationQuerySchema·paginationMetaSchema]
- [Source: apps/api/src/app.ts — Fastify·ZodTypeProvider 패턴]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- NEW: `packages/contracts/src/tag.ts`
- NEW: `apps/api/src/routes/v1/tags.ts`
- NEW: `apps/api/src/services/tagService.ts`
- UPDATE: `apps/web/app/tags/[tag]/page.tsx`
- UPDATE: `packages/contracts/src/index.ts`
- UPDATE: `apps/api/src/routes/v1/index.ts`

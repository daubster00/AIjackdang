# Story 5.10: 관련글 추천 + 작성자 다른 글

Status: ready-for-dev

## Story

As a 방문자,
I want 상세 하단에서 관련 콘텐츠·작성자 다른 글을 보기를,
so that 탐색을 이어가고 체류 시간이 늘어난다.

## Acceptance Criteria

1. 상세 하단 SSR 렌더 시 "관련 글" 섹션에 태그 1개 이상 겹치는 동일 target_type 최대 5건(최신순)이 표시된다.
2. 상세 하단 SSR 렌더 시 "작성자의 다른 글" 섹션에 동일 작성자 최근 3건(현재 글 제외)이 표시된다.
3. 관련/작성자 글이 없으면 해당 섹션을 미표시(EmptyState 불필요).
4. 각 항목은 제목·작성일·조회수와 `<a>` 링크로 렌더(SEO 크롤 가능, Next `<Link>`).
5. 관련글 쿼리는 N+1 없이 단일/최대 2회 쿼리로 처리(AR-2).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 — related posts (AC: #1, #2, #5) [NEW]
  - [ ] `apps/api/src/routes/v1/related.ts` 생성
  - [ ] `GET /api/v1/related?targetType=post&targetId={id}`: 현재 콘텐츠 tags 조회 → 동일 target_type에서 해당 tags ARRAY 겹치는 것 최대 5건(최신순, 현재 글 제외). 단일 쿼리로 처리(`WHERE tags && $tags AND id != $id ORDER BY created_at DESC LIMIT 5`). 응답: `{ relatedPosts: RelatedItem[], authorPosts: RelatedItem[] }`
  - [ ] `authorPosts`: 동일 `author_id` 최근 3건(현재 글 제외, `ORDER BY created_at DESC LIMIT 3`). 동일 요청에서 2번째 쿼리로 처리.
  - [ ] `target_type` 지원: `'post'`·`'question'`·`'resource'`. 각 테이블별 쿼리(posts/questions/resources)
  - [ ] `RelatedItem` 타입: `{ id, title, createdAt, viewCount, href }` — `href`는 API가 아닌 프론트 URL이라 별도 생성(target_type + slug)
  - [ ] 응답 스키마: `packages/contracts/src/engagement.ts`에 `relatedItemSchema` 추가 또는 inline Zod
- [ ] Task 2: 프론트 — 상세 페이지 하단 관련글 섹션 (AC: #1, #2, #3, #4) [UPDATE]
  - [ ] 각 상세 `page.tsx` 서버 컴포넌트에서 `GET /api/v1/related?targetType=post&targetId={id}` 호출
  - [ ] `RelatedPosts` 컴포넌트 생성 (`apps/web/components/board/RelatedPosts.tsx` NEW): `relatedPosts`·`authorPosts` props 받아 렌더
  - [ ] "관련 글" 섹션: `<section>` + `<h2>관련 글</h2>` + `<ul>` 항목(제목·날짜·조회수·`<Link href>`)
  - [ ] "작성자의 다른 글" 섹션: 동일 구조
  - [ ] 각 섹션은 항목이 없으면 미렌더(조건부)
  - [ ] `<a>` 링크는 Next `<Link>` 사용(SEO 크롤)
  - [ ] 각 상세 `page.tsx` 하단에 `<RelatedPosts>` 삽입 (vibe-coding, automation, monetize, lounge, 질문 상세, 자료 상세 등)
- [ ] Task 3: 검증 (AC: #1~5)
  - [ ] `pnpm typecheck` 통과
  - [ ] `pnpm lint` 통과
  - [ ] 관련글 없는 경우 섹션 미표시 확인

## Dev Notes

- **태그 저장 방식**: `posts`/`questions`/`resources` 테이블에 `tags text[]` 컬럼으로 저장 가정(또는 별도 `post_tags` 테이블). 스키마 확인 후 쿼리 방식 결정.
  - `text[]` 컬럼이면: `WHERE tags && $1::text[] AND id != $2` (PostgreSQL array overlap 연산자 `&&`)
  - 별도 테이블이면: JOIN + IN 쿼리
- **Drizzle 0.38 array overlap**: `sql\`"tags" && ${sql.param(currentTags)}::text[]\`` 형태로 raw SQL 사용.
- **href 생성**: target_type별 prefix + slug. `post` → `/vibe-coding/{slug}`, `question` → `/questions/{slug}`, `resource` → `/resources/{slug}`. API에서 href까지 계산 vs 프론트에서 조립 중 택1 — 프론트에서 slug만 받아 조립 권장(관심사 분리).
- **N+1 방지(AR-2)**: 관련글(1쿼리) + 작성자 글(1쿼리) = 최대 2쿼리. 각 쿼리는 LIMIT 적용.
- **SSR**: 서버 컴포넌트에서 fetch. 캐시 전략: `{ cache: 'force-cache', next: { revalidate: 300 } }` (5분 캐시) 가능.
- **RelatedPosts 컴포넌트**: `components/board/` 폴더에 신규 생성. CSS Modules(`RelatedPosts.module.css`). 토큰 변수 사용, 픽셀 하드코딩 금지.
- **빈 상태**: `relatedPosts.length === 0`이면 "관련 글" `<section>` 전체 미렌더. EmptyState 컴포넌트 사용 안 함(AC #3).
- **SEO**: `<Link>` = `<a>` 출력이므로 크롤 가능. JSON-LD 추가 불필요.

### Project Structure Notes

```
apps/
  api/src/routes/v1/
    related.ts        ← NEW
    index.ts          ← UPDATE
  web/
    components/board/
      RelatedPosts.tsx          ← NEW
      RelatedPosts.module.css   ← NEW
    app/vibe-coding/[slug]/page.tsx   ← UPDATE (RelatedPosts 삽입)
    app/automation/[slug]/page.tsx    ← UPDATE
    app/monetize/[slug]/page.tsx      ← UPDATE
    app/lounge/[slug]/page.tsx        ← UPDATE
    (기타 상세 page.tsx 동일)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.10 AC]
- [Source: _bmad-output/project-context.md#응답 & 데이터 포맷]
- [Source: _bmad-output/project-context.md#SEO — SSR 공개 페이지]
- [AR-2: N+1 쿼리 금지 — 최대 2회 쿼리]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

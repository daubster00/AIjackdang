# Story 2.10: 게시판 URL 라우팅 완결 + 에픽 통합 검증

Status: ready-for-dev

## Story

As a 개발팀,
I want Epic 2 모든 게시판·공지 경로가 URL 안정성 규칙대로 연결되고 SEO 헬퍼가 전 페이지에 일관 적용됨을 검증하기를,
so that 검색 유입이 보호되고 이후 에픽이 안심하고 `lib/seo` 패턴을 재사용할 수 있다(NFR-8·FR-11.1~11.3·11.5 기반 완결).

## Acceptance Criteria

1. 모든 board 경로(vibe-coding/automation/monetization 계열 + `/lounge/ai-creation|ai-products|talk|gigs` + `/notice`)에서 비회원 curl 포함 GET 200 응답. SSR HTML에 `<h1>` 정확히 1개·`<title>`·canonical URL 일치. 미존재 board는 404.
2. slug 불변 확인: 글 수정(2.8) 후 기존 slug로 접근 시 200 유지(NFR-8).
3. JSON-LD 스냅샷 검증: 목록=CollectionPage+BreadcrumbList, 상세=Article 또는 DiscussionForumPosting+BreadcrumbList, 공지=Article+BreadcrumbList. 각 JSON이 유효 Schema.org 구조(`@context`·`@type`·`name`/`headline`). Vitest 스냅샷 테스트 통과.
4. `generateSummary`가 2.7·2.9에서 호출되어 새 글·공지 등록 시 `posts.summary`가 null 아닌 ≤200자. 상세 meta description에 반영(FR-11.3).
5. 비회원이 `/lounge/talk`·`/lounge/ai-creation` 접근 시 공통 게시판 구조 정상 렌더(SSR). [글쓰기] 클릭 시 로그인 유도 모달(FR-5.1 완결).
6. `pnpm turbo run typecheck lint test` 실행 결과: 타입 오류 0·린트 경고 0. `seo.test.ts`·`sanitize.test.ts`·`jsonld.test.ts` 포함 전 테스트 통과. contracts(editor/post/board) 순환 의존 없음.

## Tasks / Subtasks

- [ ] Task 1: board 경로 전체 라우팅 감사 (AC: #1)
  - [ ] BOARDS 상수의 모든 `urlPath`에 대해 Next.js 라우팅이 매핑되어 있는지 확인
  - [ ] 누락된 경로 추가: lounge 하위 보드들이 모두 동적 라우트(`[category]/[board]`)에서 처리되는지 확인
  - [ ] `BOARDS` 상수에 있는데 페이지 파일이 없는 경로 → `(content)/[category]/[board]/page.tsx`가 처리하는지 확인
  - [ ] 미존재 board(슬러그 불일치) → `notFound()` 404 반환 확인

- [ ] Task 2: H1 중복 감사 (AC: #1)
  - [ ] 각 페이지 컴포넌트에서 `<h1>` 태그 개수 확인 (전 Epic 2 페이지)
  - [ ] `<h2>` 사용한 기존 mock 페이지(예: `vibe-coding/[slug]/page.tsx`의 `<h2>{post.title}</h2>`) → `<h1>` 교체 여부 확인
  - [ ] BoardHero 컴포넌트 내부에 `<h1>` 있으면 상세 페이지와 충돌 가능 → 확인 필수

- [ ] Task 3: JSON-LD 단위 테스트 생성 (AC: #3)
  - [ ] `apps/web/lib/seo/jsonld.test.ts` NEW
  - [ ] 목록 CollectionPage 스냅샷: `buildCollectionPageJsonLd(board, url)` → `@context`, `@type: "CollectionPage"`, `name`, `url` 포함 검증
  - [ ] 상세 DiscussionForumPosting 스냅샷: `buildDiscussionJsonLd(mockPost)` → `@type: "DiscussionForumPosting"`, `headline`, `author`, `datePublished` 검증
  - [ ] Article 스냅샷: `buildArticleJsonLd(mockPost)` → `@type: "Article"`, `headline` 검증
  - [ ] BreadcrumbList 스냅샷: `buildBreadcrumbJsonLd([{name:"홈",url:"/"},{name:"바이브 코딩",url:"/vibe-coding"}])` → `@type: "BreadcrumbList"`, `itemListElement[0].position: 1` 검증
  - [ ] `pnpm test` 통과

- [ ] Task 4: seo 통합 테스트 (AC: #4)
  - [ ] `apps/web/lib/seo/seo.test.ts` NEW (또는 기존 generate-summary.test.ts 확장)
  - [ ] `generateSummary` ≤200자 검증 (이미 2.2에서 단위 테스트 있음)
  - [ ] `buildPostMeta(mockPost).description` === `mockPost.summary` 검증

- [ ] Task 5: 순환 의존 검사 (AC: #6)
  - [ ] `packages/contracts/src/editor.ts` → `packages/contracts/src/post.ts` → `packages/contracts/src/board.ts` 순환 없음 확인
  - [ ] 각 contracts 파일 간 상호 import 없이 독립적임을 확인
  - [ ] `pnpm --filter packages/contracts build` 또는 typecheck로 순환 감지

- [ ] Task 6: 비회원 글쓰기 게이팅 완결 (AC: #5)
  - [ ] `/lounge/talk` 목록 비회원 접근: SSR 렌더 확인 (curl 200)
  - [ ] [글쓰기] 버튼 존재 확인 (비회원도 버튼 보임)
  - [ ] 버튼 클릭 시 로그인 유도 모달 표시 (기존 패턴 확인)
  - [ ] `redirectTo` 파라미터가 `?redirectTo=/lounge/talk/write`로 전달됨 확인

- [ ] Task 7: lint + typecheck + test 전체 (AC: #6)
  - [ ] `pnpm typecheck` 전 워크스페이스
  - [ ] `pnpm lint` 전 워크스페이스
  - [ ] `pnpm test` 전 워크스페이스 (jsonld.test.ts, sanitize.test.ts, generate-summary.test.ts 포함)
  - [ ] 오류 0 확인

- [ ] Task 8: canonical URL 정합성 확인 (AC: #1)
  - [ ] 각 페이지 `canonical` 메타가 실제 URL과 일치하는지 확인
  - [ ] `/lounge/ai-creation` → canonical `https://aijakdang.com/lounge/ai-creation`
  - [ ] `/notice/sample-slug` → canonical `https://aijakdang.com/notice/sample-slug`
  - [ ] OG URL도 동일하게 설정됨 확인

## Dev Notes

### 검증 전략 (이 스토리는 구현보다 검증·수정이 핵심)
이 스토리는 새 기능 추가보다 **2.1~2.9에서 구축한 기반의 정합성 검증 및 누락 수정**이 목적.
- 각 AC를 순서대로 확인하고 문제 발견 시 해당 스토리의 파일을 수정.
- 수정 범위: Epic 2 파일 전체(apps/web, apps/api, packages/contracts, packages/utilities).

### H1 충돌 주의사항
현재 기존 mock 페이지들에 `<h2>` 사용 패턴 확인됨(`vibe-coding/[slug]/page.tsx`의 `<h2>{post.title}</h2>`).
SEO 규칙상 공개 페이지는 H1 1개 필수. 2.4 상세 페이지 구현 시 교체됐어야 함.
- `BoardHero` 컴포넌트 내부에 H1이 있으면 상세 페이지의 게시글 제목 H1과 충돌.
- `BoardHero` 읽기 필수: 만약 H1을 포함하면 상세 페이지에서는 `aria-hidden` 처리 또는 H2로 강등.

### board URL 구조
```
/vibe-coding/vibe-coding-guide  (category=vibe-coding, board=vibe-coding-guide)
/vibe-coding/vibe-coding-tips
/automation/automation-guide
/automation/automation-cases
/automation/automation-tips
/monetization/monetization-tips
/monetization/monetization-cases
/lounge/ai-creation
/lounge/ai-products
/lounge/talk
/lounge/gigs
/notice  (category 없음, 독립 경로)
```
현재 기존 정적 파일(`/vibe-coding/page.tsx`, `/lounge/page.tsx` 등)과 `(content)/[category]/[board]/page.tsx` 동적 라우트 간 충돌 확인 필요.

### lounge 하위 보드 URL 주의
현재 기존 파일 구조:
- `apps/web/app/lounge/page.tsx` — lounge 홈(AI 창작마당 mock)
- `apps/web/app/lounge/talk/page.tsx` — 작당 수다방
- `apps/web/app/lounge/products/` — 내가 만든 AI 제품
- `apps/web/app/lounge/gigs/` — 작당 의뢰소
Epic 2의 `(content)/[category]/[board]/` 동적 라우트가 이들과 충돌할 수 있음 → 확인 후 처리.

### Project Structure Notes
이 스토리에서 NEW 파일은 테스트 파일뿐:
- NEW: `apps/web/lib/seo/jsonld.test.ts`
- NEW: `apps/web/lib/seo/seo.test.ts` (선택, generate-summary.test.ts와 통합 가능)
나머지는 2.1~2.9 파일 UPDATE (버그 수정·누락 기능 추가).

### References
- [Source: epics.md#Story 2.10 AC]
- [Source: project-context.md#SEO]
- [Source: architecture.md#Frontend Architecture — SEO 구현]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#SEO & 구조화]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- NEW: `apps/web/lib/seo/jsonld.test.ts`
- UPDATE (검증·수정 대상): 2.1~2.9에서 생성된 Epic 2 전체 파일

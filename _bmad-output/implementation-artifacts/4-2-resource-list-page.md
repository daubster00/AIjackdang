# Story 4.2: 실전자료 목록 페이지 (4개 독립 페이지 + 카드형 목록 + 필터 + SSR)

Status: ready-for-dev

## Story

As a 방문자(비회원 포함),
I want 실전자료를 유형별 독립 페이지에서 카드형으로 탐색하고 필터·정렬로 좁혀보기를,
So that 원하는 자료를 빠르게 발견한다.

## Acceptance Criteria

1. `/resources/prompts`, `/resources/mcp-skills`, `/resources/rules`, `/resources/templates` 각각 진입 시(비회원 포함) SSR 렌더되어 해당 유형의 published 자료 카드 목록이 파싱 가능 HTML로 제공된다. `generateMetadata`로 각 페이지의 고유 title·description·canonical URL이 생성된다(FR-11.1·NFR-1).
2. 각 독립 페이지는 자기 자료유형으로 필터된 카드형 목록을 표시한다. 필터 영역(지원환경 칩 다중 선택, 난이도 Select, 정렬 Select)과 검색 변경 시 URL 쿼리 반영·목록 갱신·활성 필터칩 강조(UX-DR-U6·FR-4.2).
3. 모바일(<768px)에서 필터 아코디언 접힘, 카드에 [다운로드]·[상세보기] 2버튼, 카드 전체 링크와 내부 버튼 클릭 충돌 없음(UX-DR-U14·U5).
4. 카드에 유형 배지·자료명·한줄설명·지원환경·난이도·업데이트일·태그·평점(별+숫자)·다운로드수·후기수(Epic 5 전 항상 0)·[다운로드]·[상세보기]가 렌더된다(UX-DR-U13·FR-4.1).
5. published 자료 없음 상태에서 `EmptyState` 컴포넌트 + [등록하기] 버튼이 표시된다(UX-DR-U11).
6. 페이지네이션에 `aria-current=page`, 모바일 축약형이 적용되며 무한스크롤 미사용(UX-DR-U3·AR-13).
7. `GET /api/v1/resources` API가 `listResourcesQuerySchema`를 쿼리 파라미터로 받아 `{items: ResourceCard[], meta: PaginationMeta}` 형식으로 응답한다. `type` 파라미터로 자료유형 필터링을 지원한다(AR-13).
8. 각 페이지의 서버 컴포넌트에서 API를 호출(type 파라미터 고정)하여 SSR로 데이터를 렌더한다. 필터·정렬은 URL searchParams 기반 서버 컴포넌트 렌더링으로 처리한다(NFR-1·AR-13).
9. `/resources`(인덱스/랜딩)는 기존 구조대로 유지하며, 유형별 진입은 4개 독립 페이지를 사용한다. 통합 탭 재편 금지.

## Tasks / Subtasks

- [ ] Task 1: API 엔드포인트 구현 (AC: #7)
  - [ ] `apps/api/src/routes/v1/resources/` 디렉토리 신규 생성 (NEW)
  - [ ] `apps/api/src/routes/v1/resources/index.ts` — 라우트 플러그인 등록 (NEW)
  - [ ] `apps/api/src/routes/v1/resources/resource.service.ts` — service 레이어 (NEW)
    - `listResources(query: ListResourcesQuery)` 함수: Drizzle로 resources 테이블 조회
    - `status='published'` 필터, type/environment/difficulty 필터, sort 처리
    - `type` 파라미터: `'prompt'|'claude-code-skill'|'mcp'|'rules-config'|'template-checklist'` — 각 독립 페이지가 자기 유형 값을 고정해서 전달
    - `avg_rating` 기반 정렬은 `orderBy(desc(resources.avgRating))`, downloads는 `orderBy(desc(resources.downloadCount))`
    - `commentCount: 0` 하드코딩 (`// TODO: Epic 5 활성화`)
    - Drizzle `with` 절로 user 닉네임·avatar 조인(N+1 방지)
    - tag는 추후 taggable 다형 테이블에서 JOIN(4.1 스키마에 없으면 임시 빈 배열)
    - 오프셋 페이지네이션: `limit(pageSize).offset((page-1)*pageSize)`
  - [ ] `apps/api/src/routes/v1/resources/resource.route.ts` — GET /api/v1/resources 라우트 (NEW)
    - `fastify-type-provider-zod`로 `listResourcesQuerySchema` 적용
    - 응답 스키마: `paginatedResponseSchema(resourceCardSchema)`
  - [ ] `apps/api/src/routes/v1/index.ts` UPDATE: resources 라우트 플러그인 등록

- [ ] Task 2: 4개 독립 페이지 API 연결 및 SSR 리팩터링 (AC: #1, #2, #3, #4, #5, #6, #8)
  - [ ] **기존 코드 완독 필수**: `apps/web/app/resources/prompts/page.tsx`, `mcp-skills/page.tsx`, `rules/page.tsx`, `templates/page.tsx` 각각 읽어 현재 UI 상태 파악
  - [ ] 현재 구조: 4개 하위 경로(`/resources/prompts`, `/resources/mcp-skills`, `/resources/rules`, `/resources/templates`)로 이미 분리되어 있음 — **이 구조 유지 필수(통합 재편 금지)**
  - [ ] 각 페이지별 서버 컴포넌트 SSR 전환:
    - `apps/web/app/resources/prompts/page.tsx` UPDATE: 서버 컴포넌트로 전환, `searchParams` 수신, `type='prompt'` 고정하여 API 호출
    - `apps/web/app/resources/mcp-skills/page.tsx` UPDATE: `type='mcp'` 고정 API 호출
    - `apps/web/app/resources/rules/page.tsx` UPDATE: `type='rules-config'` 고정 API 호출
    - `apps/web/app/resources/templates/page.tsx` UPDATE: `type='template-checklist'` 고정 API 호출
    - 각 페이지 `generateMetadata`: 유형명 포함 고유 title, canonical은 해당 페이지 URL(`/resources/prompts` 등)
    - API 호출: `fetch('/api/v1/resources?type={type}&...')` (쿠키 포워딩 포함)
  - [ ] `apps/web/app/resources/ResourceCard.tsx` 신규 생성 (NEW) — 4개 페이지 공통 재사용
    - 카드 전체 래퍼 `<article>` + 내부 `<Link href={/resources/{pageType}/{slug}}>` (상세보기)
    - [다운로드] 버튼: `<button>` (게이팅, 4.6에서 연결)
    - 카드 클릭 충돌 방지: 버튼/링크에 `e.stopPropagation()` 사용하지 말고 CSS pointer-events 활용
    - 평점 별(RatingStars) + 숫자, 다운로드수, 후기수(0 고정)
    - 유형 배지, 환경 칩, 난이도 배지
    - 태그: `<Tag href="/tags/{tag}">` (기존 Tag 컴포넌트 재사용)
    - 작성자: `<AuthorName>` 컴포넌트 재사용 (쪽지/팔로우 메뉴 포함)
  - [ ] `apps/web/app/resources/ResourceFilterClient.tsx` 신규 생성 (NEW) — 4개 페이지 공통 필터 클라이언트 컴포넌트
    - 필터 아코디언(모바일): `<details>/<summary>` 또는 controlled state
    - 지원환경 칩(다중): `environment` 쿼리 배열
    - 정렬/난이도 Select: 기존 `@/components/ui` `Select` 컴포넌트 재사용
    - 필터 변경 시 `router.push` URL 갱신 (해당 페이지 내 URL만 변경, 다른 페이지로 이동 없음)
  - [ ] `apps/web/app/resources/ResourcePagination.tsx` 신규 생성 (NEW) — `aria-current="page"` 적용
  - [ ] EmptyState: `@/components/ui` `EmptyState` 컴포넌트 재사용

- [ ] Task 3: 기존 UI 계약 보존 확인 (AC: #1, #9)
  - [ ] 기존 `/resources/prompts`, `/resources/mcp-skills`, `/resources/rules`, `/resources/templates` 경로 유지 — 변경 금지
  - [ ] 각 페이지의 `BoardHero` 컴포넌트 사용 유지 (`menu="resources"`, `currentSub={유형명}`)
  - [ ] 각 페이지의 카드 레이아웃·버튼 구성·필터 위치 등 기존 UI 계약 보존
  - [ ] `/resources`(인덱스/랜딩)는 그대로 유지, 유형 탭으로 재편하지 않음

- [ ] Task 4: 타입체크 및 빌드 검증
  - [ ] `pnpm typecheck` 통과
  - [ ] `pnpm --filter @ai-jakdang/web build` 통과

## Dev Notes

### 기존 코드 상태 & 보존해야 할 것

**현재 기존 파일 (`apps/web/app/resources/prompts/page.tsx` 등):**
- 4개 하위 메뉴가 각각 독립 페이지로 구현됨 (prompts / mcp-skills / rules / templates) — **이 구조가 정규 구조. 통합 재편 금지.**
- 목업 데이터(하드코딩 배열)로 렌더 중 — API 연결로 교체
- UI 계약(카드 레이아웃·버튼 구성·필터 위치)은 이미 확정됨 — 변경 금지
- `BoardHero` 컴포넌트(`components/board/BoardHero`)를 사용 중 — 그대로 유지
- `SearchAutocomplete`, `Select`, `Tag`, `AuthorName`, `Avatar`, `Icon` — 기존 components/ui 재사용

**UI 계약 (기존 코드에서 추출, 유지 필수):**
- 카드: `article` 태그, 상단 유형배지+평점칩, 제목 h3, 요약 p, 태그행, 메타(작성자·날짜), 하단 파일정보+다운로드수+버튼
- 툴바: 좌측 유형필터칩, 우측 정렬셀렉트+검색
- 레이아웃: `listLayout > listHeader(통계+등록버튼) | mainCol(resourceGrid+pagination)`

**4개 독립 페이지 구조 (정규 규칙):**
- `/resources/prompts` → `type='prompt'` 고정
- `/resources/mcp-skills` → `type='mcp'` 고정
- `/resources/rules` → `type='rules-config'` 고정
- `/resources/templates` → `type='template-checklist'` 고정
- 각 페이지의 [등록하기] 버튼은 `/resources/new`(4.4 통합 폼)로 연결

### 아키텍처 가드레일

- **4개 독립 페이지 유지 (규칙⑧)**: 통합 `/resources` + 유형 탭 재편 금지. 각 페이지는 자기 자료유형으로 필터된 카드형 목록.
- **SSR 필수 (NFR-1)**: 각 `page.tsx`는 서버 컴포넌트. `searchParams`를 props로 받아 API 호출. 클라이언트 필터 변경은 URL 갱신 → 서버 re-render.
- **URL 상태 (AR-13)**: 필터·정렬 = URL searchParams. URL 변경 = Next.js router.push. 딥링크·SEO 동작.
- **오프셋 페이지네이션 (AR-13)**: `page`, `pageSize`. 커서/무한스크롤 절대 금지.
- **contracts 재사용**: `listResourcesQuerySchema`, `resourceCardSchema`를 API와 프론트 모두 재사용.
- **N+1 방지**: 자료 목록 조회 시 user join은 `innerJoin(users, eq(resources.userId, users.id))` 또는 `with` 절로 배치.
- **`commentCount: 0`**: `resourceCardSchema`에 포함, 서비스에서 하드코딩 0 반환 + TODO 주석.

### API 경로 구조

```
apps/api/src/routes/v1/
└── resources/
    ├── index.ts          (플러그인 등록)
    ├── resource.route.ts (라우트 핸들러)
    └── resource.service.ts (DB 조회 로직)
```

### 메타데이터 규칙

```typescript
// 각 독립 페이지별 고유 title 및 canonical
// /resources/prompts
{ title: '프롬프트 자료 — AI작당', alternates: { canonical: 'https://aijakdang.com/resources/prompts' } }
// /resources/mcp-skills
{ title: 'MCP Skill 자료 — AI작당', alternates: { canonical: 'https://aijakdang.com/resources/mcp-skills' } }
// /resources/rules
{ title: 'Rules·설정 자료 — AI작당', alternates: { canonical: 'https://aijakdang.com/resources/rules' } }
// /resources/templates
{ title: '템플릿·체크리스트 자료 — AI작당', alternates: { canonical: 'https://aijakdang.com/resources/templates' } }
// 필터 URL (?difficulty=beginner 등)의 canonical은 필터 없는 해당 페이지 URL — 중복 색인 방지 (FR-11.1)
```

### 보안·성능

- `@fastify/rate-limit` 목록 API 적용(읽기이므로 너그럽게 — 분당 100건 수준)
- Next SSR route 캐시: `revalidate = 60`(목록은 1분 캐시, AR-17)

### Project Structure Notes

- 기존 `apps/web/app/resources/prompts/`, `mcp-skills/`, `rules/`, `templates/` 독립 페이지 구조 유지
- 공통 컴포넌트(`ResourceCard`, `ResourceFilterClient`, `ResourcePagination`)는 `apps/web/app/resources/` 루트에 신규 추가
- 각 유형별 page.tsx는 UPDATE(SSR 전환 + API 연결), 페이지 경로 변경 없음
- `apps/api/src/routes/v1/index.ts` UPDATE: `app.register(resourceRoutes, { prefix: '/resources' })`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2] — AC 원문
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#Component Patterns] — 자료 카드·필터 행동 규칙
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#Responsive & Platform] — 모바일 필터 아코디언
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — SSR, URL 상태, 서버 컴포넌트 패턴
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — 오프셋 페이지네이션
- [Source: apps/web/app/resources/prompts/page.tsx] — 현재 UI 계약(카드 구조·필터 레이아웃)
- [Source: _STORY-CORRECTION-SPEC.md#규칙⑧] — 4개 독립 페이지 유지, 통합 탭 재편 금지

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

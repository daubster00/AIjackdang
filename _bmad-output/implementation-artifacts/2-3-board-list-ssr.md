# Story 2.3: 게시판 목록 SSR 페이지

Status: review

## Story

As a 방문자(비회원 포함),
I want 게시판 목록이 서버 렌더링으로 즉시 노출되고 정렬·필터가 URL에 반영되기를,
so that 검색엔진이 본문을 즉시 파싱하고 나는 뒤로가기·딥링크로 탐색을 이어갈 수 있다(FR-2.1·NFR-1·UX-DR-U2).

## Acceptance Criteria

1. `app/(content)/[category]/[board]/page.tsx` 서버 컴포넌트가 구현된다. `/vibe-coding/vibe-coding-guide`, `/lounge/talk` 등 모든 board URL에서 비회원 포함 접근 시 200 반환. SSR HTML에 게시판명·설명·글 목록·페이지네이션이 포함되어 `curl`로 게시글 제목이 확인된다.
2. `generateMetadata`가 `buildPageMeta(board)` 호출 → `<title>{board.label} | AI작당`, meta description, canonical `/[category]/[board]`, H1 1개, CollectionPage + BreadcrumbList JSON-LD가 DOM에 존재한다(FR-11.1·11.2·11.5).
3. API `GET /api/v1/posts?board=&sort=&page=&pageSize=20`이 구현된다(apps/api). 응답: `{ items: PostCard[], meta: { page, pageSize, totalItems, totalPages } }`. `PostCard`는 `id·slug·title·summary·board·authorNickname·createdAt·viewCount·commentCount(0)·likeCount(0)·hasAttachment·tags[]`. `commentCount`·`likeCount` 는 현재 0 고정(Epic 5 활성화 전).
4. 정렬 탭(전체/인기/최신/댓글많은)이 URL 쿼리 `?sort=popular|latest|most-comments`에 반영되어 서버 재렌더된다. `role=tablist`·`aria-selected`, 모바일 가로스크롤(UX-DR-U6).
5. 글 목록 아이템: 썸네일 없이 제목·summary·태그·작성자·작성일·조회수·댓글수·좋아요수·첨부 아이콘. 제목 클릭=상세 이동. 모바일에서 우측 통계가 제목 아래로(UX-DR-U4).
6. 빈 게시판: `EmptyState`(원인+다음행동 "첫 글 작성"), 비회원 [글쓰기] 클릭 시 로그인 유도 모달(UX-DR-U11). `pnpm typecheck` 통과.
7. 페이지네이션: totalPages > 1 시 `aria-current=page`·이전/다음. 모바일 축약형(UX-DR-U3).
8. 기존 게시판 페이지(vibe-coding, automation, monetize, lounge 등)의 **정적 mock 데이터가 API 연동으로 교체**된다. 기존 컴포넌트 레이아웃(BoardHero, BoardSidebar, PostWriteForm 경로 등)은 유지한다.

## Tasks / Subtasks

- [ ] Task 1: API 라우트 구현 (AC: #3)
  - [ ] `apps/api/src/routes/v1/posts/routes.ts` NEW
  - [ ] `apps/api/src/routes/v1/posts/service.ts` NEW
  - [ ] `GET /api/v1/posts` 쿼리 파라미터: `board` varchar, `sort` enum(`latest|popular|most-comments`), `page`, `pageSize` (paginationQuerySchema 사용)
  - [ ] service: Drizzle `select` from `posts` WHERE `status='published'` AND `board=board` AND `deleted_at IS NULL` ORDER BY `sort`에 따른 컬럼. `user_id` join → `authorNickname`. `view_count` 포함. `commentCount=0`, `likeCount=0` (Epic 5 이전 고정).
  - [ ] 응답 스키마: `paginatedResponseSchema(postCardSchema)`
  - [ ] `apps/api/src/routes/v1/index.ts` UPDATE: posts 라우트 등록

- [ ] Task 2: (content) route group + [category]/[board]/page.tsx 생성 (AC: #1, #2)
  - [ ] `apps/web/app/(content)/` 폴더 NEW (Next.js route group)
  - [ ] `apps/web/app/(content)/[category]/[board]/page.tsx` NEW 서버 컴포넌트
  - [ ] 서버 컴포넌트에서 `searchParams`(sort, page) + `params`(category, board) 수신
  - [ ] `BOARDS` 상수에서 board 정보 조회. 없으면 `notFound()`
  - [ ] `fetch(\`${API_URL}/api/v1/posts?board=\${board}&sort=\${sort}&page=\${page}\`, { headers: { cookie } })` 쿠키 포워딩
  - [ ] `export async function generateMetadata({ params, searchParams })`: `buildPageMeta(boardMeta)` 호출
  - [ ] JSON-LD: `buildCollectionPageJsonLd` + `buildBreadcrumbJsonLd` → `<script type="application/ld+json">` 태그

- [ ] Task 3: 기존 게시판 페이지 → (content) route group으로 이관 (AC: #8)
  - [ ] 현재 `apps/web/app/vibe-coding/page.tsx`, `apps/web/app/automation/page.tsx`, `apps/web/app/monetize/page.tsx`, `apps/web/app/lounge/page.tsx` 등은 mock 데이터 정적 렌더
  - [ ] **기존 파일을 직접 수정**하여 API 연동으로 교체 (레이아웃·컴포넌트 구조 유지)
  - [ ] 또는 새 `(content)/[category]/[board]/page.tsx`가 모든 board를 처리하고 기존 정적 파일은 `notFound()` fallback으로 대체 (경로 충돌 주의)
  - [ ] 결정 방법: `BOARDS` 상수의 `urlPath`를 Next.js dynamic route로 처리하는 방식 선택. 기존 `vibe-coding/page.tsx` 등은 삭제하거나 redirect 처리

- [ ] Task 4: 정렬 탭 클라이언트 컴포넌트 (AC: #4)
  - [ ] `apps/web/app/(content)/[category]/[board]/SortTabs.tsx` NEW (`'use client'`)
  - [ ] `useRouter`·`useSearchParams`로 `?sort=` URL 업데이트
  - [ ] `role=tablist`, `aria-selected`, 모바일 가로스크롤 CSS

- [ ] Task 5: 빈 상태 + 로그인 유도 (AC: #6)
  - [ ] 빈 목록 시 기존 `EmptyState` 컴포넌트 사용 (`components/ui/EmptyState`)
  - [ ] [글쓰기] 버튼: 비회원은 로그인 유도 모달 (기존 로그인 모달 컴포넌트 활용)

- [ ] Task 6: 페이지네이션 컴포넌트 연동 (AC: #7)
  - [ ] 기존 `Pagination` UI 컴포넌트 (있을 경우) 재사용
  - [ ] `aria-current=page`, 이전/다음 aria-label

- [ ] Task 7: typecheck + 통합 확인 (AC: #6)
  - [ ] `pnpm typecheck` 전 워크스페이스
  - [ ] `curl http://localhost:3003/vibe-coding/vibe-coding-guide` 응답에 `<h1>` 포함 확인

## Dev Notes

### 아키텍처 패턴
- **NFR-1 SSR**: 서버 컴포넌트 우선. `'use client'`는 SortTabs처럼 순수 인터랙션에만. [Source: architecture.md#Frontend Architecture]
- **DB 접근 격리**: `apps/web` 서버 컴포넌트는 Drizzle 직접 import 절대 금지. API fetch 경유. [Source: project-context.md#패키지 경계]
- **페이지네이션**: 오프셋 고정(`page`/`pageSize`). 커서·무한스크롤 금지. [Source: project-context.md#응답 & 데이터 포맷]
- **API 응답 포맷**: 목록 = `{ items, meta }`. `paginatedResponseSchema(postCardSchema)` 사용. [Source: project-context.md#응답 & 데이터 포맷]

### 기존 코드 분석 (프론트 선구현 — 필수 완독)
현재 `apps/web/app/vibe-coding/page.tsx` 구조 (실제 파일 확인):
- `BoardHero`, `BoardSidebar`, `SearchAutocomplete`, `Select`, `Button`, `AuthorName`, `Avatar`, `Icon`, `Tag` 컴포넌트 사용
- 정적 `posts` 배열 mock 데이터 → **API 응답 `PostCard[]`로 교체**
- `BoardHero menu="vibe-coding" currentSub="바이브코딩 가이드"` — board별 설정 필요
- 사이드바 `recentPosts`, `userRankings` — 사이드바는 별도 API 또는 임시 유지
- **보존할 것**: 레이아웃 클래스(`styles.page`, `styles.listLayout`, `styles.mainCol`), 컴포넌트 구성, 정렬 셀렉트 UI
- **바꾸는 것**: mock `posts` 배열 → API fetch 결과, 정렬을 URL 쿼리 기반으로 변경

현재 `apps/web/app/lounge/page.tsx` 구조:
- 비슷한 패턴. `menu="lounge"`

**경로 전략 결정**: 새 `(content)/[category]/[board]/page.tsx` dynamic route를 생성하고, 기존 정적 경로(`/vibe-coding`, `/automation`, `/monetize`, `/lounge`)와 Next.js route 우선순위 충돌이 없도록 처리. 기존 파일들은 그대로 두되 `(content)` group이 우선 매칭되도록 폴더 구조 조정. 또는 기존 page.tsx를 직접 교체.

**권장 접근**: 기존 `/vibe-coding/page.tsx` 등을 직접 수정하여 API 연동. `(content)` route group은 새 경로용으로만 사용. 이렇게 하면 기존 slug 상세 페이지(2.4에서 교체)와의 충돌을 피할 수 있음.

### API 구현 주의사항
- `GET /api/v1/posts` 쿼리: `board` 필수, `sort` 선택(기본 `latest`), `page` 선택(기본 1), `pageSize` 선택(기본 20)
- sort 로직: `latest` → `created_at DESC`, `popular` → `view_count DESC`, `most-comments` → `comment_count DESC` (2.4 이전에는 comment_count 컬럼 없음 → 임시 `created_at DESC`)
- `status = 'published'` AND `deleted_at IS NULL` 필터 필수
- N+1 방지: 작성자 닉네임은 LEFT JOIN users. 태그는 별도 `inArray` 배치 쿼리 또는 LEFT JOIN taggable + tags.

### UX 규칙
- 빈 목록 EmptyState: "아직 글이 없어요. 첫 글을 작성해 보세요." + [글쓰기] primary 버튼 1개
- 비회원 [글쓰기] 클릭: 로그인 유도 모달 (`redirectTo=/[category]/[board]/write`)
- 탭 4개↑ 모바일: CSS `overflow-x: auto; white-space: nowrap`

### Project Structure Notes
- NEW: `apps/web/app/(content)/[category]/[board]/page.tsx`
- NEW: `apps/web/app/(content)/[category]/[board]/SortTabs.tsx`
- UPDATE: `apps/web/app/vibe-coding/page.tsx` (mock → API)
- UPDATE: `apps/web/app/automation/page.tsx` (mock → API)
- UPDATE: `apps/web/app/monetize/page.tsx` (mock → API)
- UPDATE: `apps/web/app/lounge/page.tsx` (mock → API)
- NEW: `apps/api/src/routes/v1/posts/routes.ts`
- NEW: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/api/src/routes/v1/index.ts`
- Story 2.1 의존: `packages/contracts/src/post.ts`(postCardSchema), `packages/contracts/src/board.ts`(BOARDS)
- Story 2.2 의존: `apps/web/lib/seo/`(buildPageMeta, buildCollectionPageJsonLd, buildBreadcrumbJsonLd)

### References
- [Source: epics.md#Story 2.3 AC]
- [Source: architecture.md#Frontend Architecture]
- [Source: project-context.md#통신 패턴 — 낙관적 업데이트 제외, 이 스토리는 읽기 전용]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#Component Patterns]

## Dev Agent Record

### Agent Model Used
sonnet (claude-sonnet-4-6)

### Debug Log References
- API typecheck: pre-existing errors in users.ts (image field) — not from this story. All new posts/* files typecheck clean.
- Web typecheck: 3 issues found and fixed (unused Button import, BoardHeroKey type cast, unused formattedDate in lounge/page.tsx). Final run: 0 errors.
- API endpoint verified with curl: GET /api/v1/posts?board=vibe-coding-guide → {"items":[],"meta":{"page":1,"pageSize":20,"totalItems":0,"totalPages":1}} (DB empty — expected). Invalid board returns 404 with BOARD_NOT_FOUND code.

### Completion Notes List
1. API `GET /api/v1/posts` implemented: board(required), sort(latest|popular|most-comments, default latest), page, pageSize(default 20). N+1 防止: author LEFT JOIN users, tags via inArray batch query on taggable+tags.
2. sort=most-comments 폴백: comment_count 컬럼 없음(Epic 5 이전) → created_at DESC로 폴백. 주석에 명시.
3. hasAttachment: Epic 4 이전 첨부 테이블 없음 → false 고정. 주석 명시.
4. (content)/[category]/[board]/page.tsx 생성: SSR, generateMetadata(buildPageMeta), CollectionPage+BreadcrumbList JSON-LD, SortTabs, BoardPagination, WriteButton(비회원 → LoginGatingModal), EmptyState.
5. WriteButton은 localStorage aijakdang.mockUser 확인 — Epic 5 실 세션 교체 전 임시.
6. 기존 4개 카테고리 페이지(vibe-coding, automation, monetize, lounge) → API fetch로 교체, 레이아웃 유지.
7. ROUTING MISMATCH (Story 2.10 필요): BOARDS.urlPath는 /vibe-coding/guide, /automation/guide, /monetization/tips 등이나, 앱 라우터의 물리 경로는 /vibe-coding, /automation, /monetize. (content)/[category]/[board] 동적 라우트는 /vibe-coding/vibe-coding-guide 형태로 board 슬러그를 직접 받음 — urlPath와 다름. Story 2.10에서 조정 필요.

### File List
- NEW: `apps/web/app/(content)/[category]/[board]/page.tsx`
- NEW: `apps/web/app/(content)/[category]/[board]/SortTabs.tsx`
- NEW: `apps/web/app/(content)/[category]/[board]/SortTabs.module.css`
- NEW: `apps/web/app/(content)/[category]/[board]/BoardPagination.tsx`
- NEW: `apps/web/app/(content)/[category]/[board]/WriteButton.tsx`
- NEW: `apps/web/app/(content)/[category]/[board]/board-list.module.css`
- UPDATE: `apps/web/app/vibe-coding/page.tsx`
- UPDATE: `apps/web/app/automation/page.tsx`
- UPDATE: `apps/web/app/monetize/page.tsx`
- UPDATE: `apps/web/app/lounge/page.tsx`
- NEW: `apps/api/src/routes/v1/posts/routes.ts`
- NEW: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/api/src/routes/v1/index.ts`

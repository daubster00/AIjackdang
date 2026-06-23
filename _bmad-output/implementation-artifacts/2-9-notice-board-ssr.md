# Story 2.9: 독립 공지 게시판 (운영자 작성 전용 + SSR/SEO)

Status: ready-for-dev

## Story

As a 방문자(비회원 포함),
I want 운영자가 작성한 공지를 `/notice`에서 서버 렌더링으로 열람하기를,
so that 중요한 서비스 공지를 검색엔진을 통해서도 찾고 색인 결과에서 바로 볼 수 있다(FR-15.1~15.3·AR-6).

## Acceptance Criteria

1. `/notice`(목록)와 `/notice/[slug]`(상세) 페이지가 구현된다. 목록은 2.3 컴포넌트 재사용, 상세는 2.4 흐름 재사용. **[글쓰기] 버튼 미노출**(운영자만, FR-15.1).
2. `/notice/[slug]` SSR 시 `buildNoticeMeta` → 고유 title·canonical·**Article JSON-LD**·BreadcrumbList(홈>공지사항>글). noindex 미적용(공개·색인, FR-15.3).
3. `GET /api/v1/posts?board=notice`는 published 공지만 반환. `POST /api/v1/posts`에서 `board='notice'` 요청은 **관리자 세션(`admin_sessions`, Epic 9 Story 9.1에서 확립) 없으면 403**. 본 스토리는 **API 게이트만 구현**(공지 작성 UI는 Epic 9 Story 9.17).
4. `is_pinned=true` 공지가 목록 최상단 정렬·핀 아이콘(`aria-label="상단 고정"`). 핀 설정 API는 존재하나 UI는 Epic 9 소유.
5. 헤더·푸터에 "공지사항" 링크(`/notice`) `<a>` 노출(FR-15.2).
6. `sitemap.ts`가 published 공지 URL 포함(2.2 기반 UPDATE).
7. `pnpm typecheck` 통과.

## Tasks / Subtasks

- [ ] Task 1: API 공지 게이팅 구현 (AC: #3)
  - [ ] `apps/api/src/routes/v1/posts/routes.ts` UPDATE: POST `/api/v1/posts` 핸들러
  - [ ] `board='notice'` 요청 시 관리자 세션 검증 로직 추가
    - 세션 쿠키 `aj_admin_session` 확인 (Epic 9 이전: 토큰 없으면 무조건 403)
    - `{ error: { code: 'FORBIDDEN', message: '공지 작성은 운영자만 가능합니다.' } }` 반환
  - [ ] `is_pinned=true` 핀 설정 API: `PATCH /api/v1/posts/{id}/pin` (관리자 전용, Epic 9 UI 연동 준비)
  - [ ] `GET /api/v1/posts?board=notice`: 기존 posts 목록 API에서 `board` 파라미터로 자동 처리됨 (추가 구현 불필요, pinned 정렬 확인)

- [ ] Task 2: 목록 정렬에 is_pinned 반영 (AC: #4)
  - [ ] `apps/api/src/routes/v1/posts/service.ts` UPDATE: `getPosts` 쿼리
    - ORDER BY: `is_pinned DESC, created_at DESC` (핀된 글 최상단)
  - [ ] 응답 `PostCard`에 `isPinned: boolean` 필드 추가 (postCardSchema UPDATE)

- [ ] Task 3: /notice 목록 페이지 (AC: #1)
  - [ ] `apps/web/app/notice/page.tsx` NEW 서버 컴포넌트
  - [ ] `generateMetadata`: `buildPageMeta(BOARDS['notice'])` → title "공지사항 | AI작당"
  - [ ] API fetch: `GET /api/v1/posts?board=notice&sort=latest`
  - [ ] 기존 게시판 목록 컴포넌트 재사용 (2.3에서 구축한 패턴)
  - [ ] **[글쓰기] 버튼 미노출** (FR-15.1) — 회원/비회원 무관
  - [ ] 핀된 글: 아이콘 + 시각적 강조, `aria-label="상단 고정"`
  - [ ] CollectionPage JSON-LD + BreadcrumbList(홈>공지사항)
  - [ ] H1: "공지사항"

- [ ] Task 4: /notice/[slug] 상세 페이지 (AC: #2)
  - [ ] `apps/web/app/notice/[slug]/page.tsx` NEW 서버 컴포넌트
  - [ ] `generateMetadata`: `buildNoticeMeta(post)` (2.2 구현)
  - [ ] JSON-LD: `buildArticleJsonLd(post)` (Article 타입, isSystemBoard=true) + BreadcrumbList(홈>공지사항>글)
  - [ ] SSR 본문 렌더: 2.4 상세 패턴 재사용
  - [ ] [글쓰기]/[수정]/[삭제] 버튼 미노출 (공지는 운영자 전용, Epic 9)
  - [ ] 참여 슬롯(좋아요·댓글): Epic 5 슬롯 placeholder 동일 적용

- [ ] Task 5: 헤더·푸터 공지 링크 추가 (AC: #5)
  - [ ] 헤더 컴포넌트 경로 확인: `apps/web/components/site/Header.tsx` (또는 유사)
  - [ ] 해당 파일 완독 후 "공지사항" `<a href="/notice">` 추가 위치 결정
  - [ ] 푸터 컴포넌트도 동일

- [ ] Task 6: sitemap UPDATE (AC: #6)
  - [ ] `apps/web/app/sitemap.ts` UPDATE (2.2 생성): 공지 URL도 포함됨 확인
  - [ ] 공지는 `board='notice'`로 기존 posts 쿼리에 포함 → 추가 구현 불필요 또는 별도 쿼리 추가

- [ ] Task 7: BOARDS 상수 notice 항목 확인 (AC: #1)
  - [ ] `packages/contracts/src/board.ts`의 `notice` 항목: `{ label: "공지사항", isSystemBoard: true, urlPath: "/notice", category: "system" }` 확인/추가

- [ ] Task 8: typecheck 통과 (AC: #7)
  - [ ] `pnpm typecheck` 전 워크스페이스

## Dev Notes

### 아키텍처 패턴
- **FR-15.1 공지 게이팅**: API 레이어에서 `board='notice'` + `aj_admin_session` 쿠키 검증. Epic 9(admin Better Auth) 이전에는 `aj_admin_session` 없으면 무조건 403. 이 방식으로 공지 작성 CLI나 직접 DB 삽입은 허용하되 API 레이어는 막음. [Source: epics.md#Story 2.9 AC]
- **ADR-0003 관리자 신원 분리**: 관리자 세션 쿠키 = `aj_admin_session` (유저 세션 `aj_session`과 별개). [Source: docs/adr/ADR-0003]
- **AR-6 공지 = post 도메인**: `board='notice'`, `category='system'`, `isSystemBoard:true`. 별도 테이블 아님. [Source: architecture.md#Data Architecture]
- **JSON-LD 분기**: 공지는 `Article`(isSystemBoard=true). 일반 게시글은 `DiscussionForumPosting`. [Source: epics.md#Story 2.9 AC]

### 기존 코드 분석 (프론트 선구현 — 필수 완독)
헤더 컴포넌트 `apps/web/components/site/Header.tsx` (경로 확인 후 완독):
- 현재 상단 메뉴 6개: 바이브 코딩 / AI 자동화 / AI 수익화 / 묻고답하기 / 실전자료 / 작당 라운지
- "공지사항" 링크는 헤더 보조 영역(우측) 또는 푸터에 추가
- **보존**: 기존 메뉴 구조 변경 없이 공지 링크만 추가

푸터 컴포넌트 경로 확인 필수.

### 핀된 글 정렬
```sql
ORDER BY is_pinned DESC, created_at DESC
```
Drizzle 표현: `orderBy(desc(posts.isPinned), desc(posts.createdAt))`

### 공지 목록 컴포넌트 재사용 전략
2.3에서 구축한 `(content)/[category]/[board]/page.tsx`를 재사용하되:
- `/notice`는 별도 파일(`app/notice/page.tsx`)로 구현
- 이유: BOARDS 상수의 `notice` urlPath가 `/notice` (단일 경로, category 없음)
- 공통 로직은 `features/board/` 또는 `components/board/` 컴포넌트로 추출

### Project Structure Notes
- NEW: `apps/web/app/notice/page.tsx`
- NEW: `apps/web/app/notice/[slug]/page.tsx`
- UPDATE: `apps/web/components/site/Header.tsx` (공지 링크 추가)
- UPDATE: `apps/web/components/site/Footer.tsx` (공지 링크 추가)
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts` (notice 게이팅)
- UPDATE: `apps/api/src/routes/v1/posts/service.ts` (is_pinned 정렬)
- UPDATE: `apps/web/app/sitemap.ts` (공지 포함 확인)
- UPDATE: `packages/contracts/src/post.ts` (postCardSchema에 isPinned 추가)
- Story 2.2 의존: buildNoticeMeta, buildArticleJsonLd
- Story 2.3 의존: 게시판 목록 컴포넌트 패턴
- Story 2.4 의존: 상세 SSR 패턴

### References
- [Source: epics.md#Story 2.9 AC]
- [Source: architecture.md#Data Architecture — 공지(시스템 보드)]
- [Source: docs/adr/ADR-0003-admin-identity-and-approval.md]
- [Source: project-context.md#보안 — 관리자 신원 완전 분리]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#IA — 공지사항]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- NEW: `apps/web/app/notice/page.tsx`
- NEW: `apps/web/app/notice/[slug]/page.tsx`
- UPDATE: `apps/web/components/site/Header.tsx`
- UPDATE: `apps/web/components/site/Footer.tsx`
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/web/app/sitemap.ts`
- UPDATE: `packages/contracts/src/post.ts`

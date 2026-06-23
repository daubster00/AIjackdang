# Story 2.4: 게시글 상세 SSR 페이지 (참여 슬롯 + 조회수 인프라)

Status: review

## Story

As a 방문자(비회원 포함),
I want 게시글 상세가 서버 렌더링으로 본문·메타·breadcrumb과 함께 즉시 노출되기를,
so that 검색엔진이 전체 콘텐츠를 파싱하고 나는 딥링크로 특정 글을 바로 열람할 수 있다(FR-2.2·FR-2.3·NFR-1).

## Acceptance Criteria

1. `app/(content)/[category]/[board]/[slug]/page.tsx` 서버 컴포넌트가 구현된다. 유효한 slug로 비회원 포함 접근 시 제목·작성자·작성일·조회수·본문 HTML·태그·breadcrumb이 SSR HTML에 포함되어 `curl`로 확인된다.
2. `generateMetadata`가 `buildPostMeta(post)` 호출 → 고유 title·description(summary)·canonical·H1 1개·JSON-LD(회원 글=DiscussionForumPosting, 운영자글/isSystemBoard=Article/BlogPosting)·BreadcrumbList(홈>카테고리>게시판>글)(FR-11.1~11.3·11.5).
3. API `GET /api/v1/posts/{slug}`가 구현된다(apps/api). 응답: `PostDetail`(`contentHtml`·`contentJson`·`authorNickname`·`authorGrade`·`isOwner`·`isPinned`·`tags[]`·`viewCount` 등). `contentHtml`은 service 레이어에서 Tiptap JSON→HTML 후 `sanitize-html` 통과(2.6 완성 전: placeholder 텍스트 렌더). 존재하지 않거나 `status≠published` slug는 404.
4. 조회수 인프라: 상세 진입 시 `apps/api`에서 Redis `view:post:{id}` INCR(동일 세션/IP 30분 dedup TTL 설정). `view-flush` BullMQ 큐 + `apps/worker/src/processors/view.flush.ts`가 주기적으로 DB `posts.view_count`에 flush한다(AR-16·AR-17).
5. 존재하지 않는/삭제된(`status='deleted'`) slug 접근 시 404 + noindex(FR-11.9) 반환.
6. 참여 기능 슬롯: 본문 하단에 `data-slot="reactions"`, `data-slot="comments"`, `data-slot="report"` 속성을 가진 placeholder div가 존재하고 "Epic 5에서 활성화" 안내(disabled 상태)가 표시된다.
7. 작성자 본인(로그인 상태 + `isOwner=true`) 시 [수정]·[삭제] 버튼 노출. 비회원·타인 미노출. [공유] 버튼: URL 클립보드 복사 + 토스트.
8. 기존 상세 페이지(`vibe-coding/[slug]/page.tsx` 등)의 mock 데이터가 API 연동으로 교체된다. 기존 `ReactionBar`, `CommentForm`, `CommentItem` 컴포넌트는 슬롯 placeholder로 대체(미삭제, 구조만 유지).

## Tasks / Subtasks

- [ ] Task 1: API `GET /api/v1/posts/{slug}` 구현 (AC: #3)
  - [ ] `apps/api/src/routes/v1/posts/routes.ts` UPDATE: GET `/:slug` 라우트 추가
  - [ ] `apps/api/src/routes/v1/posts/service.ts` UPDATE: `getPostBySlug(slug, currentUserId?)` 함수 추가
  - [ ] Drizzle: `posts` + `users(nickname, grade)` LEFT JOIN. `status='published'` 또는 본인글(`user_id=currentUserId`) 조회
  - [ ] `isOwner`: `post.user_id === currentUserId`
  - [ ] `contentHtml`: 2.6 이전에는 `contentJson`의 텍스트 단순 변환(Tiptap JSON→plain text fallback). 2.6 완성 후 sanitize-html 연동
  - [ ] 삭제/비공개/미존재 slug: `reply.notFound()`
  - [ ] 응답 스키마: `postDetailSchema` (packages/contracts)

- [ ] Task 2: 상세 SSR 페이지 컴포넌트 (AC: #1, #2, #6, #7)
  - [ ] `apps/web/app/(content)/[category]/[board]/[slug]/page.tsx` NEW 서버 컴포넌트
  - [ ] `generateMetadata`: `buildPostMeta(post)` 호출, JSON-LD 분기(isOwner? 무관, isSystemBoard? → Article : DiscussionForumPosting)
  - [ ] BreadcrumbList JSON-LD: `buildPostBreadcrumb(category, board, post.title)` 후 `buildBreadcrumbJsonLd`
  - [ ] H1: `<h1>{post.title}</h1>` — 페이지당 1개
  - [ ] 본문 렌더: `<div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />`
  - [ ] 참여 슬롯: `<div data-slot="reactions" aria-label="좋아요·북마크 (Epic 5에서 활성화)">` (disabled 표시)
  - [ ] [공유] 버튼: `'use client'` 분리 컴포넌트 `ShareButton.tsx`

- [ ] Task 3: 조회수 Redis INCR (AC: #4)
  - [ ] `apps/api/src/routes/v1/posts/service.ts` UPDATE: slug 조회 성공 시 Redis INCR
  - [ ] Redis key: `view:post:{postId}`, TTL dedup: `SET view:post:{postId}:{sessionOrIp} 1 EX 1800 NX` 후 NX 반환 시에만 INCR
  - [ ] Redis 클라이언트: `apps/api/src/lib/redis.ts` (ioredis, 기존 있으면 재사용, 없으면 NEW)

- [ ] Task 4: view-flush BullMQ 큐 + worker processor (AC: #4)
  - [ ] `apps/worker/src/processors/view.flush.ts` NEW
  - [ ] `apps/worker/src/queues/view-flush.ts` NEW: BullMQ Queue 정의 (`view-flush` 큐명)
  - [ ] processor: `SCAN view:post:* COUNT 100` → 각 키의 값(조회수 증분) 읽기 → `UPDATE posts SET view_count = view_count + {delta}` → 키 삭제. 멱등 처리(재시도 안전).
  - [ ] 주기: BullMQ `repeat: { every: 60000 }` (1분마다)
  - [ ] `apps/worker/src/index.ts` UPDATE: view.flush processor 등록

- [ ] Task 5: 기존 상세 페이지 API 연동 전환 (AC: #8)
  - [ ] `apps/web/app/vibe-coding/[slug]/page.tsx` UPDATE: mock posts → API fetch
  - [ ] `apps/web/app/automation/[slug]/page.tsx` UPDATE
  - [ ] `apps/web/app/monetize/[slug]/page.tsx` UPDATE
  - [ ] `apps/web/app/lounge/[slug]/page.tsx` UPDATE
  - [ ] 기존 `ReactionBar`, `CommentForm`, `CommentItem` import 제거 또는 슬롯으로 감싸기
  - [ ] **보존**: `BoardHero`, `AttachmentList`, 헤더 meta 행(작성자·날짜·조회수), 푸터 [수정]·[삭제]·[목록으로] 버튼 레이아웃

- [ ] Task 6: 404 + noindex (AC: #5)
  - [ ] 미존재/삭제 slug: `notFound()` 호출 → Next.js 404 페이지
  - [ ] `apps/web/app/not-found.tsx`: `<meta name="robots" content="noindex">` 포함 (또는 generateMetadata에서 `robots: { index: false }`)

- [ ] Task 7: typecheck 통과
  - [ ] `pnpm typecheck` 전 워크스페이스

## Dev Notes

### 아키텍처 패턴
- **AR-16·AR-17 조회수 인프라**: Redis 버퍼(INCR) + BullMQ worker flush. 직접 DB UPDATE 금지. Epic 5가 재사용. [Source: epics.md#Story 2.4 AC]
- **BullMQ 패턴**: 큐명 `view-flush`, job명 `view.flush`, worker는 멱등 처리(재시도 시 동일 결과). [Source: project-context.md#통신 패턴]
- **sanitize-html**: 2.6에서 완성. 현재는 Tiptap JSON→텍스트 추출 fallback 사용 가능. [Source: project-context.md#응답 & 데이터 포맷]

### 기존 코드 분석 (프론트 선구현 — 필수 완독)
현재 `apps/web/app/vibe-coding/[slug]/page.tsx` 구조:
- `posts` 정적 객체 + `comments` 정적 배열 mock
- `CommentItem`, `CommentForm`, `ReactionBar` import 사용
- `AttachmentList`, `BoardHero` 재사용
- `<h2>{post.title}</h2>` — **Story에서 `<h1>`으로 변경 필요** (SEO 규칙: H1 1개)
- `<footer>` 안 [수정]·[삭제] 버튼(기능 없는 button)
- `<div className={styles.articleBody}>` + 본문 단락 렌더

현재 `apps/web/app/lounge/[slug]/page.tsx` 구조:
- `creativeSpec` 유무에 따른 레이아웃 분기(`.detailWithSpec` vs `.detailLayout`)
- `CreativeSpecPanel` 컴포넌트 — 2.11에서 API 연동. 현재는 mock 유지 가능

**보존할 것**: 레이아웃 분기 로직, CSS 클래스, `CreativeSpecPanel`(mock 그대로)
**바꾸는 것**: 정적 mock → API fetch, H2→H1, `ReactionBar`·`CommentForm`·`CommentItem` → 슬롯 placeholder

### 조회수 dedup 전략
- Redis key: `view:post:{postId}:{fingerprint}` — fingerprint = `sessionId` (쿠키 있으면) or `ip:userAgent hash` (없으면)
- `SET ... NX EX 1800`: NX = 없을 때만 SET. 반환값 `null` = 이미 있음(dedup). `"OK"` = 새 조회 → INCR
- INCR key: `view:post:{postId}` (집계용, TTL 없음)

### worker flush 로직
```
SCAN view:post:* COUNT 100
for each key:
  value = GET key
  if value > 0:
    UPDATE posts SET view_count = view_count + value WHERE id = extractId(key)
    DEL key
```
Lua 스크립트로 원자적 GET+DEL 처리 권장.

### 참여 슬롯 구조 (예시)
```html
<div data-slot="reactions" class="participation-slot participation-slot--disabled">
  <span class="slot-hint">좋아요·북마크 기능은 곧 활성화됩니다 (Epic 5)</span>
</div>
<div data-slot="comments" class="participation-slot participation-slot--disabled">
  <span class="slot-hint">댓글 기능은 곧 활성화됩니다 (Epic 5)</span>
</div>
```
→ CSS로 회색 처리, aria-disabled 적용.

### Project Structure Notes
- NEW: `apps/web/app/(content)/[category]/[board]/[slug]/page.tsx`
- NEW: `apps/web/app/(content)/[category]/[board]/[slug]/ShareButton.tsx`
- NEW: `apps/worker/src/processors/view.flush.ts`
- NEW: `apps/worker/src/queues/view-flush.ts`
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/web/app/vibe-coding/[slug]/page.tsx`
- UPDATE: `apps/web/app/automation/[slug]/page.tsx`
- UPDATE: `apps/web/app/monetize/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/[slug]/page.tsx`
- UPDATE: `apps/worker/src/index.ts`
- Story 2.2 의존: `lib/seo/` (buildPostMeta, buildBreadcrumbJsonLd, buildPostBreadcrumb)
- Story 2.1 의존: `packages/contracts/post.ts` (postDetailSchema)

### References
- [Source: epics.md#Story 2.4 AC]
- [Source: architecture.md#Data Architecture — 캐싱]
- [Source: project-context.md#통신 패턴 — BullMQ]
- [Source: architecture.md#Backend — BullMQ worker]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
(none)

### Completion Notes List
1. `contentHtml` 임시 구현: `extractTextFromTiptapJson` 헬퍼로 Tiptap JSON → `<p>` 단락 플레인텍스트 변환. Story 2.6에서 `apps/api/src/lib/tiptap-renderer.ts` + `sanitize-html`로 교체 예정. 마킹: `// TODO(Story 2.6): replace with sanitize-html pipeline`.
2. Redis URL 기본값: `redis://localhost:6380` (프로젝트 규정 포트). API service와 worker 모두 동일.
3. `apps/web/app/(content)/[category]/[board]/[slug]/page.tsx` — 기존 board별 상세 페이지(vibe-coding/automation/monetize/lounge)와 병렬 라우팅 가능. 두 라우팅이 모두 유효하므로 주의: Story 2.10 라우팅 확정 시 board별 구 페이지는 (content) 공통으로 통합 고려 가능.
4. 기존 board별 상세 페이지에서 `vibe-coding.module.css` 등 board별 CSS 스타일 그대로 유지. `data-slot` participation placeholder는 CSS `style` prop으로 인라인 처리(기존 CSS에 `.participationSlot` 클래스 없음).
5. lounge 페이지: `CreativeSpecPanel`은 mock 유지 (story 2.11에서 API 연동). API에서 가져온 post에는 `creativeSpec` 필드 없으므로 `spec={undefined}` 전달.
6. `apps/worker/src/connection.ts`에 `viewFlush: "view-flush"` 추가.
7. `apps/worker/package.json`에 `@ai-jakdang/database` 의존성 추가 (processor에서 Drizzle DB 접근).
8. `apps/web/app/not-found.tsx` 신규 생성: `robots: { index: false, follow: false }` noindex.

### File List
- NEW: `apps/web/app/(content)/[category]/[board]/[slug]/page.tsx`
- NEW: `apps/web/app/(content)/[category]/[board]/[slug]/ShareButton.tsx`
- NEW: `apps/web/app/(content)/[category]/[board]/[slug]/detail.module.css`
- NEW: `apps/web/app/vibe-coding/[slug]/ShareButton.tsx`
- NEW: `apps/web/app/automation/[slug]/ShareButton.tsx`
- NEW: `apps/web/app/monetize/[slug]/ShareButton.tsx`
- NEW: `apps/web/app/lounge/[slug]/ShareButton.tsx`
- NEW: `apps/web/app/not-found.tsx`
- NEW: `apps/worker/src/processors/view.flush.ts`
- NEW: `apps/worker/src/queues/view-flush.ts`
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/web/app/vibe-coding/[slug]/page.tsx`
- UPDATE: `apps/web/app/automation/[slug]/page.tsx`
- UPDATE: `apps/web/app/monetize/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/[slug]/page.tsx`
- UPDATE: `apps/web/app/vibe-coding/vibe-coding.module.css`
- UPDATE: `apps/web/app/automation/automation.module.css`
- UPDATE: `apps/web/app/monetize/monetize.module.css`
- UPDATE: `apps/web/app/lounge/lounge.module.css`
- UPDATE: `apps/worker/src/index.ts`
- UPDATE: `apps/worker/src/connection.ts`
- UPDATE: `apps/worker/package.json`

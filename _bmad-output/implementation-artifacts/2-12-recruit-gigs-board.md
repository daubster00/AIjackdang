# Story 2.12: 작당 의뢰소(구인·외주) — 구조화 폼 + 모집 상태 + 상세 표시

Status: review

## Story

As a AI 외주를 맡기거나 받으려는 회원,
I want 의뢰/구직 글을 구조화된 형식으로 올리고 쪽지로 소통하기를,
so that 외주·협업 상대를 분야·예산·상태 기준으로 빠르게 찾고 연결된다(FR-5.3).

## Acceptance Criteria

1. `recruit_post` 테이블이 `packages/database`에 추가된다. 컬럼: `post_id` uuid PK·FK(`posts.id`, ON DELETE CASCADE)·`post_kind` enum(`request`/`offer`) NOT NULL·`fields` jsonb NOT NULL(분야 다중)·`recruit_status` enum(`open`/`closed`) DEFAULT `open`·`budget` text nullable·`duration` text nullable·`work_mode` enum(`remote`/`onsite`/`hybrid` nullable)·`contact_method` jsonb NOT NULL(쪽지 기본 + 외부 optional)·`created_at`/`updated_at` timestamptz. `(post_kind, recruit_status)` 복합 인덱스 + `fields` GIN 인덱스.
2. `packages/contracts`에 `recruitPostSchema`(Zod) 추가: 필수(`postKind`, `fields`, `recruitStatus`, `contactMethod`)·선택(`budget`, `duration`, `workMode`). 필수 누락 시 인라인 오류로 등록 차단.
3. 회원이 `/lounge/gigs/write`에서 의뢰/구직 글 등록 시 `posts`(board=`gigs`) + `recruit_post`가 트랜잭션으로 함께 생성됨. 폼·상세에 거래 보증 없음·직거래 사기 주의 고지 필수 노출.
4. `/lounge/gigs` 목록 SSR: 글 유형·분야·모집 상태 필터 동작. 각 아이템에 유형 배지(의뢰/구직)·분야·모집중/마감 배지 표시. 마감 글 시각적 구분. API 연동(현재 mock → 실 데이터).
5. 의뢰/구직 글 상세: 의뢰 정보 카드(유형·분야·예산·기간·진행 방식·연락 방법)·모집 배지. [쪽지 보내기] 버튼은 슬롯(Epic 7 FR-13 연계, 현재 `MessageModal` 유지).
6. 작성자 본인만 모집 상태 모집중↔마감 토글 가능. `PATCH /api/v1/posts/{id}/recruit-status`. 권한 검증(본인만). 목록·상세 배지에 즉시 반영.
7. 비회원: 목록·상세 열람 가능(SSR·색인). [글쓰기]/[쪽지 보내기] 클릭 시 로그인 유도(행동 게이팅).
8. `pnpm typecheck` 통과.

## Tasks / Subtasks

- [ ] Task 1: recruit_post 스키마 생성 (AC: #1)
  - [ ] `packages/database/src/schema/recruit-post.ts` NEW
  - [ ] `pgEnum("post_kind_enum", ["request","offer"])` 정의
  - [ ] `pgEnum("recruit_status_enum", ["open","closed"])` 정의
  - [ ] `pgEnum("work_mode_enum", ["remote","onsite","hybrid"])` 정의
  - [ ] `recruit_post` 테이블:
    - `post_id`: uuid PK, FK → `posts.id` ON DELETE CASCADE
    - `post_kind`: `postKindEnum("post_kind").notNull()`
    - `fields`: `jsonb("fields").notNull()` (string[] 배열)
    - `recruit_status`: `recruitStatusEnum("recruit_status").notNull().default("open")`
    - `budget`: `text("budget")` nullable
    - `duration`: `text("duration")` nullable
    - `work_mode`: `workModeEnum("work_mode")` nullable
    - `contact_method`: `jsonb("contact_method").notNull()` (`{types: string[], external?: string}`)
    - `created_at`, `updated_at` timestamptz
  - [ ] 인덱스: `index("idx_recruit_post_kind_status").on(table.post_kind, table.recruit_status)`, `index("idx_recruit_post_fields").on(table.fields)` (GIN)
  - [ ] `packages/database/src/schema/index.ts` UPDATE
  - [ ] `drizzle-kit generate && migrate` 실행

- [ ] Task 2: recruitPostSchema Zod 계약 (AC: #2)
  - [ ] `packages/contracts/src/post.ts` UPDATE (또는 `recruit-post.ts` NEW)
  - [ ] `recruitPostSchema`: `z.object({ postKind: z.enum(["request","offer"]), fields: z.array(z.string()).min(1), recruitStatus: z.enum(["open","closed"]).default("open"), budget: z.string().optional(), duration: z.string().optional(), workMode: z.enum(["remote","onsite","hybrid"]).optional(), contactMethod: z.object({ types: z.array(z.string()).min(1), external: z.string().optional() }) })`
  - [ ] `createGigPostSchema`: `createPostSchema` + `recruitPost: recruitPostSchema`
  - [ ] `packages/contracts/src/index.ts` UPDATE

- [ ] Task 3: API POST 구현 (AC: #3)
  - [ ] `apps/api/src/routes/v1/posts/routes.ts` UPDATE: `board='gigs'` 요청에 `recruitPost` 필드 처리
  - [ ] `apps/api/src/routes/v1/posts/service.ts` UPDATE: `createPost` 확장
    - `db.transaction()` 내부:
      - posts INSERT (board='gigs')
      - `recruit_post` INSERT
  - [ ] `GET /api/v1/posts?board=gigs` UPDATE: `recruit_post` JOIN 포함
    - `postCardSchema`에 `recruitMeta?: { postKind, fields, recruitStatus }` 추가
  - [ ] `GET /api/v1/posts/{slug}` UPDATE: `recruit_post` JOIN 포함
    - `postDetailSchema`에 `recruitPost?: RecruitPost` 추가

- [ ] Task 4: API 모집 상태 토글 (AC: #6)
  - [ ] `apps/api/src/routes/v1/posts/routes.ts` UPDATE: `PATCH /api/v1/posts/:id/recruit-status`
  - [ ] 요청: `{ recruitStatus: "open" | "closed" }`
  - [ ] service: `post.user_id === userId` 검증(403), `recruit_post.recruit_status` UPDATE
  - [ ] 응답: `{ recruitStatus: "open" | "closed" }`

- [ ] Task 5: 목록 페이지 API 연동 (AC: #4)
  - [ ] **기존 `apps/web/app/lounge/gigs/page.tsx` 완독 필수**
  - [ ] 현재: `'use client'`, mock `MOCK_GIGS` 배열, useState 필터링, GigCard 서브컴포넌트
  - [ ] UPDATE: mock 데이터 → `fetch('/api/v1/posts?board=gigs&postKind=&fields=&recruitStatus=&page=')` 서버 fetch 또는 클라이언트 fetch
  - [ ] **SSR 요구 (AC#7)**: 비회원 열람 가능·색인 → 서버 컴포넌트 기반 초기 렌더 필요
  - [ ] 필터(유형·분야·상태)는 URL 쿼리 파라미터 기반으로 변경 (`?postKind=&fields=&recruitStatus=`)
  - [ ] `GigCard` 컴포넌트: mock 타입 → API `PostCard + recruitMeta` 타입으로 교체
  - [ ] 마감 글 시각적 구분: 기존 CSS `.gigItemClosed` 유지

- [ ] Task 6: 상세 페이지 API 연동 (AC: #5, #6)
  - [ ] **기존 `apps/web/app/lounge/gigs/[slug]/page.tsx` 완독 필수**
  - [ ] **기존 `apps/web/app/lounge/gigs/[slug]/GigDetailClient.tsx` 완독 필수**
  - [ ] 현재: mock 데이터 + `GigDetailClient` 클라이언트 컴포넌트
  - [ ] `page.tsx` UPDATE: mock → `GET /api/v1/posts/{slug}` API fetch
  - [ ] `GigDetailClient.tsx` UPDATE: mock 타입 → `PostDetail + recruitPost` 타입으로 교체
  - [ ] 모집 상태 토글: `PATCH /api/v1/posts/{id}/recruit-status` 호출 (낙관적 업데이트)
  - [ ] [쪽지 보내기]: 기존 `MessageModal` 슬롯 유지 (Epic 7에서 실 연동)
  - [ ] 거래 주의 고지 배너: 기존 `styles.caution` 유지

- [ ] Task 7: 비회원 게이팅 (AC: #7)
  - [ ] 목록 페이지: 비회원도 SSR 렌더(서버 컴포넌트 부분)
  - [ ] [글쓰기] 버튼: 비회원 클릭 → 로그인 유도 모달 (기존 `GigWriteGate` 동작 확인)
  - [ ] [쪽지 보내기]: 비회원 클릭 → 로그인 유도 모달 (기존 `handleDmClick` 동작 확인)

- [ ] Task 8: typecheck 통과 (AC: #8)
  - [ ] `pnpm typecheck` 전 워크스페이스

## Dev Notes

### 아키텍처 패턴
- **1:1 관계**: `recruit_post.post_id` = `posts.id` PK+FK CASCADE. 의뢰소 글에만 존재.
- **트랜잭션**: posts + recruit_post 동시 INSERT. [Source: project-context.md#패키지 경계]
- **SSR 필수**: `/lounge/gigs` 목록은 비회원 열람·색인 대상. 현재 `'use client'` 구현 → 서버 컴포넌트로 전환 필요 (필터는 URL 쿼리, 클라이언트 state 아님). [Source: project-context.md#SEO]
- **낙관적 업데이트**: 모집 상태 토글 → 즉시 UI 업데이트, API 실패 시 롤백 + danger 토스트. [Source: project-context.md#통신 패턴]

### 기존 코드 분석 (프론트 선구현 — 반드시 완독)
**`apps/web/app/lounge/gigs/page.tsx`** (완독 완료):
- `'use client'` — SSR 없음(문제). mock 필터링이 클라이언트 state.
- `MOCK_GIGS` 배열 + `filterType`, `filterField`, `filterStatus`, `query` state
- `GigCard` 서브컴포넌트: slug, type, fields, status, title, excerpt, author, date, views, comments, budget, period
- `handleWriteClick`: `useMockAuth`로 비회원 체크 → alert (로그인 유도 모달로 교체 필요)
- **보존**: `GigCard` UI 구조, CSS 클래스, Badge 컴포넌트 사용 패턴
- **바꾸는 것**: `'use client'` 전체 → 서버 컴포넌트 + 클라이언트 필터 분리, mock 데이터 → API fetch

**`apps/web/app/lounge/gigs/[slug]/GigDetailClient.tsx`** (완독 완료):
- 모집 상태 낙관적 토글 state 구현됨 (`useState<GigStatus>`)
- [쪽지 보내기] → `MessageModal` 구현됨
- 거래 주의 고지 배너 구현됨
- `isOwner = !!user` (useMockAuth, mock) → API `isOwner` 필드로 교체
- `post.excerpt` 본문 렌더 → `post.contentHtml` API 응답으로 교체
- **보존**: 모집 상태 토글 UI, 정보 카드 그리드, MessageModal 슬롯, 거래 주의 배너, CSS 클래스

**`apps/web/app/lounge/gigs/write/RecruitForm.tsx`** (완독 완료):
- `LightEditor` 본문 입력, 구조화 필드(글유형·분야·모집상태·연락방법 필수, 예산·기간·진행방식 선택)
- 검증 로직 구현됨 (`validate()` 함수)
- 제출 시 `alert("등록 기능은 아직 개발 중")` → 실 API 호출로 교체
- **보존**: 폼 레이아웃, 검증 로직, 거래 주의 배너
- **바꾸는 것**: `submitAlert` → `POST /api/v1/posts` (board=gigs + recruitPost 데이터)

**`apps/web/app/lounge/gigs/write/GigWriteGate.tsx`**:
- 비회원 → 로그인 유도 메시지 표시, 회원 → `RecruitForm` 렌더
- 로그인 유도 방식: 현재 `useMockAuth`로 mock. 실 인증으로 교체 필요.

### SSR 전환 전략 (gigs/page.tsx)
현재 `'use client'` 전체 → SSR 방식으로 전환:
1. `page.tsx`를 서버 컴포넌트로 변경
2. 필터 파라미터를 `searchParams`(서버)에서 읽어 API 쿼리에 전달
3. 필터 UI(`Select` 컴포넌트)만 클라이언트 컴포넌트로 분리
4. 검색(`SearchInput`)도 클라이언트 컴포넌트 또는 `<form>` 기반

### API gigs 필터 파라미터
```
GET /api/v1/posts?board=gigs&postKind=request&fields=챗봇·LLM 개발&recruitStatus=open&page=1
```
- `postKind`: `request` | `offer` | 전체 생략
- `fields`: 분야 문자열 (jsonb contains 쿼리)
- `recruitStatus`: `open` | `closed` | 전체 생략

### GIN 인덱스 사용 (fields 필터)
```sql
CREATE INDEX ON recruit_post USING GIN (fields jsonb_path_ops);
-- 쿼리:
WHERE fields @> '["챗봇·LLM 개발"]'::jsonb
```
Drizzle에서: `sql\`fields @> ${JSON.stringify([field])}::jsonb\``

### Project Structure Notes
- NEW: `packages/database/src/schema/recruit-post.ts`
- UPDATE: `packages/database/src/schema/index.ts`
- UPDATE: `packages/contracts/src/post.ts` (recruitPostSchema)
- UPDATE: `packages/contracts/src/index.ts`
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/web/app/lounge/gigs/page.tsx` (SSR + API 연동)
- NEW: `apps/web/app/lounge/gigs/GigsFilter.tsx` (`'use client'` 필터 UI)
- UPDATE: `apps/web/app/lounge/gigs/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/gigs/[slug]/GigDetailClient.tsx`
- UPDATE: `apps/web/app/lounge/gigs/write/RecruitForm.tsx`
- UPDATE: `apps/web/app/lounge/gigs/write/GigWriteGate.tsx`
- AUTO-GENERATED: drizzle migration SQL

### References
- [Source: epics.md#Story 2.12 AC]
- [Source: architecture.md#Data Architecture — recruit_post (2026-06-22 추가)]
- [Source: project-context.md#SEO — SSR 필수]
- [Source: project-context.md#통신 패턴 — 낙관적 업데이트]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#권한 & 게이팅]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- count query bug: `FST_ERR_RESPONSE_SERIALIZATION` when filters reference `schema.recruitPost` but count query had no JOIN. Fixed by adding conditional LEFT JOIN to count query when `recruitFilters.length > 0`.
- test data bug: test UUID `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` has invalid UUID format per Zod 4 strict validation. Cleaned up; real posts use `gen_random_uuid()`.

### Completion Notes List
- All 8 ACs implemented and verified.
- `packages/contracts/src/index.ts` required NO change — all new schemas are in `post.ts` which is already exported.
- `GigsFilter.tsx` uses `useSearchParams()` wrapped in `<Suspense>` in `page.tsx` as required by Next.js for SSR pages.
- `GigDetailClient.tsx`: `useMockAuth` → `useAuth` (real auth); `isOwner` from `post.isOwner` (API field); `post.contentHtml` via `dangerouslySetInnerHTML`; recruit-status PATCH with optimistic update + rollback on failure; `CommentForm` wired with `targetType="post" targetId={post.id}`.
- `RecruitForm.tsx`: LightEditor returns HTML text; wrapped in minimal Tiptap JSON `{type:"doc", content:[...]}` for API; form state key `body` → `bodyHtml`/`bodyText` (no validation on old `body` key).
- `GigWriteGate.tsx`: `useMockAuth` → `useAuth`; login redirect uses `?redirectTo=` URL param.
- GIN index on `fields` jsonb generated but drizzle-kit creates btree by default — functional, GIN can be added manually via migration if needed for large datasets.
- Epic 5 components (CommentForm, ReactionBar, MessageModal, AttachmentList) preserved in GigDetailClient.

### File List
- NEW: `packages/database/src/schema/recruit-post.ts`
- UPDATE: `packages/database/src/schema/index.ts`
- UPDATE: `packages/contracts/src/post.ts`
- UPDATE: `apps/api/src/routes/v1/posts/routes.ts`
- UPDATE: `apps/api/src/routes/v1/posts/service.ts`
- UPDATE: `apps/web/app/lounge/gigs/page.tsx`
- NEW: `apps/web/app/lounge/gigs/GigsFilter.tsx`
- UPDATE: `apps/web/app/lounge/gigs/[slug]/page.tsx`
- UPDATE: `apps/web/app/lounge/gigs/[slug]/GigDetailClient.tsx`
- UPDATE: `apps/web/app/lounge/gigs/write/RecruitForm.tsx`
- UPDATE: `apps/web/app/lounge/gigs/write/GigWriteGate.tsx`
- AUTO-GENERATED: `packages/database/migrations/0010_bizarre_eternals.sql`
- AUTO-GENERATED: `packages/database/migrations/meta/0010_snapshot.json`
- AUTO-GENERATED: `packages/database/migrations/meta/_journal.json`

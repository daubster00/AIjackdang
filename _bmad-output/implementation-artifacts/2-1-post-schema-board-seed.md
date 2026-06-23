# Story 2.1: post 스키마 + board 도메인 데이터 시드

Status: ready-for-dev

## Story

As a 개발팀,
I want `post` 테이블과 `board`/`category` 메타 데이터가 AR-6 다형성 모델 설계대로 `packages/database`에 정착되기를,
so that 이후 모든 게시판·공지 스토리가 동일 DB 기반 위에서 독립 구현된다.

## Acceptance Criteria

1. `packages/database/src/schema/posts.ts`가 생성되고 `drizzle-kit generate && migrate` 실행 후 `posts` 테이블이 DB에 존재한다. 필수 컬럼: `id` uuid PK, `user_id` uuid FK(`users.id`, ON DELETE SET NULL), `board` varchar(50) NOT NULL, `category` varchar(50), `title` varchar(300) NOT NULL, `slug` varchar(350) UNIQUE NOT NULL, `content_json` jsonb NOT NULL, `summary` varchar(500), `status` `post_status` enum(`draft`/`published`/`hidden`/`deleted`) DEFAULT `draft`, `is_pinned` boolean DEFAULT false, `seo_title` varchar(200) nullable, `seo_description` varchar(500) nullable, `view_count` integer DEFAULT 0, `created_at`/`updated_at`/`deleted_at` timestamptz.
2. `tags`(`id` uuid PK, `name` varchar(100) UNIQUE NOT NULL, `slug` varchar(100) UNIQUE NOT NULL, `created_at` timestamptz) 테이블과 `taggable`(`target_type` varchar(50) NOT NULL, `target_id` uuid NOT NULL, `tag_id` uuid FK(`tags.id`, ON DELETE CASCADE), 복합 PK(`target_type`, `target_id`, `tag_id`)) 테이블이 동일 마이그레이션 파일에 포함된다.
3. `packages/contracts/src/post.ts`가 AR-6 설계대로 전면 재작성된다. export: `postCardSchema`(목록 카드), `postDetailSchema`(상세), `createPostSchema`(작성 — `board`, `title`, `contentJson`, `summary?`, `tags[]`), `updatePostSchema`(수정 — partial), `paginatedPostsSchema`(목록 응답), `postStatusSchema`. 모두 `index.ts`에서 재노출되고 `pnpm typecheck`가 전 워크스페이스 통과.
4. `packages/contracts/src/board.ts`가 NEW로 생성된다. `BOARDS` 상수(`Record<string, BoardMeta>`)에 10개 board 슬러그가 매핑된다: `vibe-coding-guide`, `vibe-coding-tips`, `automation-guide`, `automation-cases`, `automation-tips`, `monetization-tips`, `monetization-cases`, `ai-creation`, `ai-products`, `talk`, `gigs`, `notice`. 각 board 항목: `{ label, description, category, urlPath, isSystemBoard?, hasCreativeSpec?, boardKind? }`. `notice`는 `isSystemBoard: true`, `ai-creation`은 `hasCreativeSpec: true`, `gigs`는 `boardKind: 'recruit'`.
5. 단일 마이그레이션 파일(`drizzle/migrations/*.sql`)에 `posts`, `tags`, `taggable`이 모두 포함되고, 파일 상단에 "Epic 3/4 확장 시 이 파일에 새 마이그레이션 추가 금지" 주석이 존재한다.
6. `pnpm typecheck`가 전 워크스페이스 통과한다.

## Tasks / Subtasks

- [ ] Task 1: posts 스키마 생성 (AC: #1)
  - [ ] `packages/database/src/schema/posts.ts` NEW 파일 작성
  - [ ] `pgEnum("post_status", ["draft","published","hidden","deleted"])` 정의
  - [ ] `posts` pgTable 정의 — 컬럼 명세 AC#1 참조. `user_id`는 `uuid("user_id").references(() => users.id, { onDelete: "set null" })` (nullable)
  - [ ] `is_pinned boolean DEFAULT false`, `seo_title` text nullable, `seo_description` text nullable 포함 (architecture.md 2026-06-22 보강분)
  - [ ] `export type PostRow = typeof posts.$inferSelect`, `export type NewPostRow = typeof posts.$inferInsert`
  - [ ] `packages/database/src/schema/index.ts`에 posts, postStatus enum re-export

- [ ] Task 2: tags + taggable 스키마 생성 (AC: #2)
  - [ ] `packages/database/src/schema/tags.ts` NEW 파일 작성
  - [ ] `tags` 테이블: `id` uuid PK, `name` varchar(100) UNIQUE NOT NULL, `slug` varchar(100) UNIQUE NOT NULL, `created_at` timestamptz
  - [ ] `taggable` 테이블: 복합 PK(`target_type`, `target_id`, `tag_id`), `tag_id` FK → tags.id ON DELETE CASCADE
  - [ ] schema/index.ts에 재노출

- [ ] Task 3: 마이그레이션 실행 (AC: #5)
  - [ ] `cd packages/database && pnpm drizzle-kit generate`
  - [ ] 생성된 `.sql` 파일 상단에 경고 주석 추가
  - [ ] `pnpm drizzle-kit migrate` 실행 (docker-compose.dev.yml DB 기동 전제)
  - [ ] DB에서 `\d posts`, `\d tags`, `\d taggable` 확인

- [ ] Task 4: contracts/post.ts 전면 재작성 (AC: #3)
  - [ ] 기존 `packages/contracts/src/post.ts` UPDATE: 현재 파일은 `postCategorySchema`(enum 4개)·`createPostSchema`·`updatePostSchema`·`postStatusSchema`만 있음
  - [ ] `postCardSchema` 추가: `{ id, slug, title, summary, board, authorNickname, authorGrade?, createdAt, viewCount, commentCount, likeCount, hasAttachment, tags[] }`
  - [ ] `postDetailSchema` 추가: postCard + `{ contentHtml, contentJson, authorId, isOwner, isPinned, seoTitle?, seoDescription? }`
  - [ ] `createPostSchema` 갱신: `board` varchar 50, `title` max 300, `contentJson` Tiptap JSON, `summary?` optional, `tags[]` max 10
  - [ ] `paginatedPostsSchema` = `paginatedResponseSchema(postCardSchema)`
  - [ ] `packages/contracts/src/index.ts` UPDATE: 새 export 추가

- [ ] Task 5: contracts/board.ts 신규 생성 (AC: #4)
  - [ ] `packages/contracts/src/board.ts` NEW
  - [ ] `BoardMeta` 타입 정의: `{ label: string; description: string; category: string; urlPath: string; isSystemBoard?: boolean; hasCreativeSpec?: boolean; boardKind?: 'recruit' | 'standard' }`
  - [ ] `BOARDS` 상수 — 12개 board 슬러그 매핑 (위 AC#4 목록)
  - [ ] `index.ts` re-export

- [ ] Task 6: typecheck 통과 확인 (AC: #6)
  - [ ] `pnpm typecheck` 전 워크스페이스 실행
  - [ ] 오류 0 확인

## Dev Notes

### 아키텍처 패턴 (AR 인용)
- **AR-2 마이그레이션 단일 소유권**: `drizzle-kit generate`로 단일 SQL 파일 생성. 이 파일은 머지 전 커밋 금지(동시 작업 충돌 방지). [Source: architecture.md#Data Architecture]
- **AR-6 다형성 모델**: `post` 단일 테이블을 `board`/`category` 조합으로 인스턴스화. 참여(tag)는 `taggable(target_type, target_id)` 다형 참조. [Source: architecture.md#Data Architecture]
- **AR-7 soft-delete**: `status` enum + `deleted_at` 패턴. [Source: project-context.md#구조]
- **DB 접근 격리**: `packages/database`는 `apps/api`·`apps/worker`에서만 import. web/admin은 API 경유. [Source: project-context.md#패키지 경계]

### 수정 대상 기존 파일
- `packages/contracts/src/post.ts` (UPDATE): 현재 `postCategorySchema`(enum: vibe-coding/ai-automation/ai-monetization/lounge 4개)·단순 `createPostSchema`·`updatePostSchema`·`postStatusSchema`만 존재. **보존할 것**: `postStatusSchema`(enum 값 동일). **바꾸는 것**: `postCategorySchema` 제거(board 상수로 대체), `postCardSchema`·`postDetailSchema`·`paginatedPostsSchema` 추가, `createPostSchema` board/title max 갱신.
- `packages/database/src/schema/index.ts` (UPDATE): posts, tags, taggable export 추가.
- `packages/contracts/src/index.ts` (UPDATE): board.ts, 새 post 스키마 re-export.

### Drizzle 네이밍 규칙
- 테이블명: `snake_case` 복수형 → `posts`, `tags`, `taggable`
- 컬럼명: `snake_case` DB, Drizzle 프로퍼티 `camelCase`
- enum: `pgEnum("post_status", [...])` → Drizzle property `status`
- PK: `uuid("id").defaultRandom().primaryKey()`
- timestamptz: `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()`

### contracts 네이밍 규칙
- Zod 스키마: `xxxSchema`, 추론 타입: `Xxx`/`XxxInput`
- JSON 필드: camelCase (`contentJson`, `authorNickname`, `viewCount`)

### 주의사항
- `content_json` 컬럼: `jsonb("content_json").notNull()` — Tiptap JSON 저장. HTML 원본 저장 절대 금지.
- `summary` 컬럼: `varchar(500)` nullable — `generateSummary()` (Story 2.2)가 자동 생성. 현재 단계는 nullable로.
- `slug` 컬럼: `varchar(350) UNIQUE NOT NULL` — `slugify(title)` + 중복 시 `-{shortid}` (utilities 패키지, Story 2.7 구현).
- `view_count`: 직접 DB 업데이트 금지. Redis 버퍼 → worker flush (Story 2.4에서 구현).
- `is_pinned` + `seo_title` + `seo_description`: architecture.md 2026-06-22 보강분 필수 포함.
- `tags` 테이블의 `slug`는 tag 이름의 slugify 결과 (한글 태그도 처리).
- `taggable.target_type` 허용값: `post`(2.1), `question`(Epic 3), `resource`(Epic 4) — 현재는 post만 사용.

### Project Structure Notes
- 신규 파일: `packages/database/src/schema/posts.ts`, `packages/database/src/schema/tags.ts`
- 신규 파일: `packages/contracts/src/board.ts`
- 기존 파일 수정: `packages/database/src/schema/index.ts`, `packages/contracts/src/post.ts`, `packages/contracts/src/index.ts`
- 마이그레이션 SQL: `packages/database/drizzle/migrations/` (drizzle-kit generate 자동 생성)
- 현재 `packages/database/src/schema/users.ts`의 `userRole` enum은 ADR-0003에 의해 분리 리팩터링 대상이나, 본 스토리는 건드리지 않음 (Epic 1 소유)

### References
- [Source: epics.md#Story 2.1 AC]
- [Source: architecture.md#Data Architecture — 콘텐츠 모델링(다형성)]
- [Source: architecture.md#Data Architecture — 데이터 모델 동기화 2026-06-22]
- [Source: project-context.md#네이밍]
- [Source: project-context.md#패키지 경계]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
- NEW: `packages/database/src/schema/posts.ts`
- NEW: `packages/database/src/schema/tags.ts`
- NEW: `packages/contracts/src/board.ts`
- UPDATE: `packages/database/src/schema/index.ts`
- UPDATE: `packages/contracts/src/post.ts`
- UPDATE: `packages/contracts/src/index.ts`
- AUTO-GENERATED: `packages/database/drizzle/migrations/*.sql`

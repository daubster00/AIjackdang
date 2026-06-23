# Story 5.1: 다형 참여 스키마 마이그레이션

Status: ready-for-dev

## Story

As a 개발팀,
I want `comment`·`reaction`·`bookmark`·`report`·`block`·`follows` 테이블이 한 번에 정착되기를,
so that Epic 5 전체 스토리가 일관된 다형 모델 위에서 독립 진행된다.

## Acceptance Criteria

1. `drizzle-kit generate && migrate` 실행 후 다음 테이블이 생성된다:
   - `comments`: `id`(uuid PK) · `author_id`(FK→users.id) · `target_type`(pgEnum: post|question|answer|resource|comment) · `target_id`(uuid) · `parent_id`(uuid nullable FK→comments.id, 1단계 대댓글) · `content`(text NOT NULL) · `status`(pgEnum: visible|deleted) default visible · `deleted_at`(timestamptz nullable) · `created_at`·`updated_at`(timestamptz)
   - `reactions`: `id`(uuid PK) · `user_id`(FK→users.id) · `target_type`(pgEnum: post|question|answer|resource|comment) · `target_id`(uuid) · `reaction_type`(pgEnum: like) · `created_at`(timestamptz) · UNIQUE(`user_id`, `target_type`, `target_id`, `reaction_type`)
   - `bookmarks`: `id`(uuid PK) · `user_id`(FK→users.id) · `target_type`(pgEnum: post|question|resource) · `target_id`(uuid) · `created_at`(timestamptz) · UNIQUE(`user_id`, `target_type`, `target_id`)
   - `reports`: `id`(uuid PK) · `reporter_id`(FK→users.id) · `target_type`(pgEnum: post|question|answer|resource|comment) · `target_id`(uuid) · `reason_code`(text NOT NULL) · `detail`(text nullable) · `status`(pgEnum: pending|reviewing|resolved|dismissed) default pending · `created_at`(timestamptz)
   - `blocks`: `id`(uuid PK) · `blocker_id`(FK→users.id) · `blocked_id`(FK→users.id) · `created_at`(timestamptz) · UNIQUE(`blocker_id`, `blocked_id`)
   - `follows`: `follower_id`(FK→users.id) · `following_id`(FK→users.id) · `created_at`(timestamptz) · 복합 PK(`follower_id`, `following_id`) · CHECK `follower_id <> following_id`
2. `(target_type, target_id)` 복합 인덱스가 `comments`·`reactions`·`bookmarks`·`reports`에 생성된다. `follows`에는 양방향 조회용 인덱스(`follower_id`·`following_id`)가 별도 생성된다.
3. `packages/contracts`에 `comment`·`reaction`·`bookmark`·`report`·`block`·`follow` Zod 스키마와 추론 타입이 정의된다. `api`·`web`에서 import 가능하며 `pnpm typecheck` 통과한다.
4. `packages/database/src/schema/index.ts` 배럴에 신규 스키마 파일이 등록된다.
5. 기존 `users.ts` placeholder(`userRole`, `passwordHash` 등)는 이 Story에서 건드리지 않는다(인증 Story 담당).

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 파일 작성 (AC: #1, #2) [NEW]
  - [ ] `packages/database/src/schema/engagement.ts` 생성: `comments`, `reactions`, `bookmarks`, `reports`, `blocks`, `follows` 테이블 + Drizzle pgEnum 정의
  - [ ] 복합 인덱스: `index('idx_comments_target', [comments.targetType, comments.targetId])` 형태로 `comments`·`reactions`·`bookmarks`·`reports`에 추가
  - [ ] `follows` 복합 PK: `primaryKey({ columns: [follows.followerId, follows.followingId] })` + CHECK는 마이그레이션 raw SQL로 (`sql\`CHECK (follower_id <> following_id)\``)
  - [ ] Row 타입 export: `CommentRow`, `NewCommentRow`, `ReactionRow`, `NewReactionRow`, `BookmarkRow`, `NewBookmarkRow`, `ReportRow`, `NewReportRow`, `BlockRow`, `NewBlockRow`, `FollowRow`, `NewFollowRow`
- [ ] Task 2: 스키마 배럴 등록 (AC: #4) [UPDATE]
  - [ ] `packages/database/src/schema/index.ts`에 `export * from "./engagement"` 추가
- [ ] Task 3: Contracts Zod 스키마 작성 (AC: #3) [NEW]
  - [ ] `packages/contracts/src/engagement.ts` 생성
  - [ ] `commentSchema`: `{ id, authorId, targetType, targetId, parentId, content, status, deletedAt, createdAt, updatedAt }` + 입력용 `createCommentInputSchema`: `{ targetType, targetId, parentId?, content }`
  - [ ] `reactionSchema` + `createReactionInputSchema`: `{ targetType, targetId, reactionType }`
  - [ ] `bookmarkSchema` + `createBookmarkInputSchema`: `{ targetType, targetId }`
  - [ ] `reportSchema` + `createReportInputSchema`: `{ targetType, targetId, reasonCode, detail? }`
  - [ ] `blockSchema` + `createBlockInputSchema`: `{ blockedId }`
  - [ ] `followSchema` + `createFollowInputSchema`: `{ followingId }`
  - [ ] 모든 스키마 named export
- [ ] Task 4: Contracts 배럴 등록 (AC: #3) [UPDATE]
  - [ ] `packages/contracts/src/index.ts`에 `export * from "./engagement"` 추가
- [ ] Task 5: Drizzle 마이그레이션 생성 (AC: #1) [NEW]
  - [ ] `pnpm -F @ai-jakdang/database drizzle-kit generate` 실행해 마이그레이션 파일 생성
  - [ ] `pnpm -F @ai-jakdang/database drizzle-kit migrate` 로컬 PostgreSQL에서 마이그레이션 적용 확인
- [ ] Task 6: 검증 (AC: #3, #4)
  - [ ] `pnpm typecheck` 워크스페이스 전체 통과 확인
  - [ ] `pnpm lint` 통과 확인

## Dev Notes

- **브라운필드**: 기존 `packages/database/src/schema/users.ts`(placeholder)와 `packages/contracts/src/` 기존 파일은 건드리지 않는다. 신규 파일만 추가.
- **Drizzle 0.38 stable 사용** (`drizzle-orm` 0.38.x — v1.0 beta/0.45 금지). `pgEnum` import: `import { pgEnum, pgTable, uuid, text, timestamp, index, uniqueIndex, primaryKey, sql } from "drizzle-orm/pg-core"`.
- **`follows` CHECK 제약**: Drizzle 0.38에서 CHECK constraint는 `pgTable`의 세 번째 인자 콜백에서 `check("chk_no_self_follow", sql\`follower_id <> following_id\`)` 형태로 추가. `primaryKey` 복합 PK도 동일 콜백에서.
- **UNIQUE 제약**: `uniqueIndex("idx_reactions_unique", [reactions.userId, reactions.targetType, reactions.targetId, reactions.reactionType])` 패턴 사용.
- **마이그레이션 소유권 규칙**: `drizzle-kit generate` 파일은 커밋 전 단일 작업만. 동시 다른 스키마 작업과 충돌 금지 [Source: _bmad-output/planning-artifacts/architecture.md#마이그레이션 규칙].
- **타임스탬프**: `timestamp("...", { withTimezone: true })` 필수. `timestamptz`.
- **PK**: 전부 `uuid("id").defaultRandom().primaryKey()` (`follows`만 복합 PK 예외).
- **FK**: `references(() => users.id)` 패턴.
- **배럴 규칙**: `export *` 금지 — 각 파일에서 named export 후 배럴에는 `export * from "./engagement"` 한 줄만. Contracts 배럴에서 re-export 시 순환 import 주의 (`engagement.ts`가 `common.ts`를 import할 경우 가능한 범위만).
- **DB 접근 격리**: `packages/database` 스키마 파일은 `apps/api`·`apps/worker`에서만 import. `apps/web`에서 직접 import 금지.
- **기존 contracts**: `packages/contracts/src/common.ts`·`auth.ts`·`post.ts`·`index.ts` 존재. `engagement.ts` 신규 추가 후 `index.ts`에 한 줄 추가만.
- **typecheck 통과 조건**: `packages/contracts/src/engagement.ts`가 Zod 4.1 API 사용. `import { z } from "zod"`.

### Project Structure Notes

```
packages/
  database/src/schema/
    users.ts          ← 기존(UPDATE 금지)
    engagement.ts     ← NEW (comments, reactions, bookmarks, reports, blocks, follows)
    index.ts          ← UPDATE (export * from "./engagement" 추가)
  contracts/src/
    common.ts / auth.ts / post.ts  ← 기존(UPDATE 금지)
    engagement.ts     ← NEW
    index.ts          ← UPDATE (export * from "./engagement" 추가)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1 AC]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — 다형성]
- [Source: _bmad-output/project-context.md#패키지 경계 & 격리]
- [Source: _bmad-output/project-context.md#네이밍]
- [AR-2: N+1 쿼리 금지 — 복합 인덱스로 JOIN 최적화 기반 마련]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

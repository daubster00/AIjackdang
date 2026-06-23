# Story 4.1: `resource`·`resource_file`·`rating` 스키마 + API 계약

Status: ready-for-dev

## Story

As a 개발팀,
I want 실전자료 도메인의 DB 스키마와 API Zod 계약이 한 번에 확정되기를,
So that 이후 4.2~4.9가 스키마 충돌 없이 동일 계약 위에서 구현된다.

## Acceptance Criteria

1. `resources`, `resource_files`, `ratings` 세 테이블의 Drizzle 스키마가 `packages/database/src/schema/resources.ts`에 작성되고, `packages/database/src/schema/index.ts`에서 re-export되며 `drizzle-kit generate` 후 `migrate`까지 완료된다.
2. `resources` 테이블이 다음 컬럼을 포함한다: `id`(uuid PK), `user_id`(FK→users.id), `slug`(text unique not null), `title`, `summary`, `resource_type`(pgEnum: `prompt|claude-code-skill|mcp|rules-config|template-checklist`), `environment`(text[]), `difficulty`(pgEnum: `beginner|intermediate|advanced`), `description_json`(jsonb — Tiptap JSON), `usage_json`(jsonb — Tiptap JSON), `caution_json`(jsonb nullable), `version`(text nullable), `reference_links`(jsonb nullable), `status`(pgEnum: `draft|published|hidden|deleted`), `copyright_agreed`(boolean not null default false), `download_count`(integer not null default 0), `avg_rating`(numeric(3,2) not null default 0), `rating_count`(integer not null default 0), `created_at`(timestamptz), `updated_at`(timestamptz), `deleted_at`(timestamptz nullable).
3. `resource_files` 테이블이 다음 컬럼을 포함한다: `id`(uuid PK), `resource_id`(FK→resources.id onDelete cascade), `original_name`(text), `storage_key`(text unique), `file_size`(integer), `mime_type`(text), `allowed_extension`(pgEnum: `zip|md|txt|json|pdf|docx|xlsx`), `is_primary`(boolean not null default false), `scan_status`(pgEnum: `pending|clean|infected|error`), `scan_completed_at`(timestamptz nullable), `display_order`(integer not null default 0), `created_at`(timestamptz).
4. `ratings` 테이블이 다음 컬럼을 포함한다: `id`(uuid PK), `resource_id`(FK→resources.id), `user_id`(FK→users.id), `score`(smallint, CHECK 1~5), `created_at`(timestamptz), `updated_at`(timestamptz). UNIQUE constraint(`resource_id`, `user_id`).
5. `is_primary=true`가 resource당 정확히 1개임을 보장하는 설계 결정이 주석으로 명시된다(DB 레벨 unique partial index 또는 application 레벨 보장 선택).
6. `packages/contracts/src/resource.ts`에 다음 Zod 스키마가 모두 export된다: `resourceTypeSchema`, `difficultySchema`, `scanStatusSchema`, `createResourceSchema`, `updateResourceSchema`, `resourceCardSchema`, `resourceDetailSchema`, `listResourcesQuerySchema`, `ratingSchema`, `ratingResponseSchema`.
7. `resourceCardSchema`에 `commentCount` 필드가 포함되며, 해당 필드 옆에 `// TODO: Epic 5 활성화 전 항상 0 반환` 주석이 달린다.
8. `packages/contracts/src/index.ts`에서 resource.ts가 re-export된다.

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 작성 (AC: #1, #2, #3, #4, #5)
  - [ ] `packages/database/src/schema/resources.ts` 신규 생성 (NEW)
  - [ ] `pgEnum` 정의: `resourceType`, `difficulty`, `resourceStatus`, `allowedExtension`, `scanStatus`
  - [ ] `resources` 테이블 정의 (컬럼 명세 §AC-2 전부)
  - [ ] `resource_files` 테이블 정의 (컬럼 명세 §AC-3 전부)
  - [ ] `ratings` 테이블 정의 + UNIQUE constraint (§AC-4)
  - [ ] `is_primary` 설계 주석 추가: "is_primary=true는 resource당 1개만 허용. DB partial unique index: `CREATE UNIQUE INDEX ON resource_files (resource_id) WHERE is_primary = true;` — drizzle sql.raw로 추가하거나 application service 레이어에서 upsert 전 보장."
  - [ ] Row 타입 export: `ResourceRow`, `NewResourceRow`, `ResourceFileRow`, `NewResourceFileRow`, `RatingRow`, `NewRatingRow`
  - [ ] `packages/database/src/schema/index.ts` UPDATE: `export * from "./resources";` 추가

- [ ] Task 2: Drizzle 마이그레이션 생성·실행 (AC: #1)
  - [ ] `pnpm --filter @ai-jakdang/database db:generate` 실행
  - [ ] 생성된 마이그레이션 파일 검토(enum·unique·FK 정확성 확인)
  - [ ] `pnpm --filter @ai-jakdang/database db:migrate` 실행 (로컬 Docker PG)
  - [ ] ⚠️ 마이그레이션 파일은 머지 전 커밋 금지(AR-2 규칙) — 단독 소유권 확인

- [ ] Task 3: contracts/resource.ts 작성 (AC: #6, #7)
  - [ ] `packages/contracts/src/resource.ts` 신규 생성 (NEW)
  - [ ] `resourceTypeSchema` = `z.enum(["prompt","claude-code-skill","mcp","rules-config","template-checklist"])`
  - [ ] `difficultySchema` = `z.enum(["beginner","intermediate","advanced"])`
  - [ ] `scanStatusSchema` = `z.enum(["pending","clean","infected","error"])`
  - [ ] `createResourceSchema`: `title`(min 2, max 150), `summary`(min 1, max 300), `resourceType`, `environment`(string array), `difficulty`, `descriptionJson`(Tiptap JSON object), `usageJson`(Tiptap JSON), `cautionJson`(optional), `version`(optional), `referenceLinks`(array of {label, url} optional), `copyrightAgreed`(boolean, must be true), `tags`(string[] max 10 default [])
  - [ ] `updateResourceSchema` = `createResourceSchema.partial()`
  - [ ] `resourceCardSchema`: `id`, `slug`, `title`, `summary`, `resourceType`, `environment`, `difficulty`, `authorId`, `authorNickname`, `authorAvatarIndex`, `avgRating`(number), `ratingCount`, `downloadCount`, `commentCount`(number, `// TODO: Epic 5 활성화 전 항상 0 반환`), `tagNames`(string[]), `updatedAt`, `status`
  - [ ] `resourceDetailSchema`: `resourceCardSchema`에 추가로 `descriptionJson`, `usageJson`, `cautionJson`, `version`, `referenceLinks`, `files`(array of resourceFileSchema), `createdAt`
  - [ ] `resourceFileSchema`: `id`, `originalName`, `storageKey`, `fileSize`, `mimeType`, `allowedExtension`, `isPrimary`, `scanStatus`, `displayOrder`
  - [ ] `listResourcesQuerySchema`: `paginationQuerySchema` 확장 + `type`(resourceTypeSchema optional), `environment`(string optional), `difficulty`(difficultySchema optional), `sort`(enum `latest|popular|rating|downloads|reviews` default `latest`), `q`(string optional)
  - [ ] `ratingSchema`: `score`(z.number().int().min(1).max(5))`
  - [ ] `ratingResponseSchema`: `id`, `resourceId`, `userId`, `score`, `createdAt`, `updatedAt`
  - [ ] 추론 타입 export: `CreateResourceInput`, `UpdateResourceInput`, `ResourceCard`, `ResourceDetail`, `ResourceFile`, `ListResourcesQuery`, `RatingInput`, `RatingResponse`

- [ ] Task 4: contracts index re-export (AC: #8)
  - [ ] `packages/contracts/src/index.ts` UPDATE: `export * from "./resource";` 추가

- [ ] Task 5: 타입체크 검증
  - [ ] `pnpm typecheck` 전 워크스페이스 통과 확인

## Dev Notes

### 아키텍처 가드레일

- **DB 접근 격리 (AR-2)**: `packages/database`는 `apps/api`, `apps/worker`에서만 import. `apps/web` 절대 금지.
- **Drizzle 버전 고정**: `drizzle-orm` 0.38.x stable (v1.0 beta 금지). 현재 설치된 버전 확인 후 유지.
- **마이그레이션 단일 소유권 (AR-2)**: `drizzle-kit generate` 파일은 이 스토리가 단독 소유. 다른 스토리와 동시 작업 금지. 머지 전까지 별도 브랜치 유지.
- **pgEnum 네이밍**: DB enum은 `snake_case`(`resource_type`, `scan_status`), Drizzle 프로퍼티는 camelCase.
- **PK**: `uuid("id").defaultRandom().primaryKey()` 패턴 (기존 `users.ts` 참조).
- **타임스탬프**: `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()`.
- **soft-delete**: `status` enum + `deleted_at` nullable timestamptz (AR-7).
- **Tiptap JSON 컬럼**: `jsonb("description_json").notNull()` — 텍스트 저장 금지(AR-8).
- **`environment` 컬럼**: `text("environment").array().notNull().default(sql`'{}'`)` — PostgreSQL text[] 타입.
- **`avg_rating`**: `numeric("avg_rating", { precision: 3, scale: 2 }).notNull().default("0")`.
- **`score` CHECK**: Drizzle에서 CHECK constraint는 `check("score_range", sql`score BETWEEN 1 AND 5`)` 방식 사용.
- **BullMQ job 타입**: 4.5에서 `resource.scan` job 페이로드 타입도 이 contracts 파일에 추가 예정(4.5 스토리 담당).

### 손댈 파일 목록

| 파일 | NEW/UPDATE | 비고 |
|------|-----------|------|
| `packages/database/src/schema/resources.ts` | NEW | 3개 테이블 + enum 전부 |
| `packages/database/src/schema/index.ts` | UPDATE | `export * from "./resources"` 추가 |
| `packages/database/drizzle/migrations/*.sql` | NEW | `db:generate` 자동 생성 |
| `packages/contracts/src/resource.ts` | NEW | Zod 스키마 전부 |
| `packages/contracts/src/index.ts` | UPDATE | `export * from "./resource"` 추가 |

### 기존 파일 현재 상태 (UPDATE 대상)

- `packages/database/src/schema/index.ts` 현재: `export * from "./users";` 한 줄. `resources` 추가 후 두 줄.
- `packages/contracts/src/index.ts` 현재: `auth`, `post`, `common` export. `resource` 추가.
- `packages/database/src/schema/users.ts`: `users` 테이블에 `id`(uuid PK), `email`, `nickname`, `password_hash`, `role`, `created_at` 컬럼. `ratings.user_id` FK는 이 `users.id`를 참조.

### 테스트 표준

- 단위 테스트(Vitest): Zod 스키마 유효/무효 케이스 — `packages/contracts/src/resource.test.ts` 신규 생성 권장.
  - `createResourceSchema`: `copyrightAgreed=false`일 때 실패, 필수 필드 누락 시 실패.
  - `ratingSchema`: `score=0`, `score=6` 실패; `score=1~5` 통과.
  - `listResourcesQuerySchema`: 쿼리 파라미터 coerce 동작 확인.
- DB 마이그레이션 검증: `pnpm db:migrate` 후 `psql` 또는 Drizzle Studio로 테이블 존재 확인.

### Project Structure Notes

- `packages/database/src/schema/` 폴더에 `resources.ts`가 추가된다. 현재 `users.ts`만 존재.
- `packages/contracts/src/` 폴더에 `resource.ts`가 추가된다. 현재 `auth.ts`, `post.ts`, `common.ts` 존재.
- `paginationQuerySchema`, `paginatedResponseSchema`는 `packages/contracts/src/common.ts`에 이미 정의됨 — `listResourcesQuerySchema`에서 import 재사용.
- `postStatusSchema`는 `packages/contracts/src/post.ts`에 정의됨 — `resource`의 status enum은 동일 값이지만 별도 `resourceStatusSchema`로 정의(도메인 독립성).

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — resources 컬럼 명세
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — DB 네이밍, 페이지네이션
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1] — AC 원문
- [Source: _bmad-output/project-context.md#패키지 경계 & 격리] — DB 접근 격리 규칙
- [Source: docs/adr/ADR-0002] — 마이그레이션 소유권

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

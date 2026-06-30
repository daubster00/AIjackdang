# Story 11.1: 봇 데이터 스키마 + `users.is_bot` 마이그레이션

Status: ready-for-dev

## Story

As a 개발자,
I want 봇 전용 테이블 9종과 `users.is_bot`(봇 계정 여부) 컬럼을 Drizzle 스키마로 정의하고 마이그레이션까지 완료하기,
So that 봇 신원·페르소나·주제 풀·리듬·모델 할당·생성 잡·보류 큐·활동 로그·전역 설정을 DB에 저장할 수 있다.

## Acceptance Criteria

1. `packages/database/src/schema/bot.ts` 신규 생성 — ARCHITECTURE.md §2에 명시된 봇 테이블 9종(`bot_personas`, `bot_persona_boards`, `bot_activity_rhythm`, `bot_topics`, `bot_model_assignments`, `bot_generation_jobs`, `bot_hold_queue`, `bot_activity_log`, `bot_settings`)과 필요한 pgEnum 전부 포함.
2. `users` 테이블에 `is_bot`(봇 계정 여부) boolean NOT NULL DEFAULT false 컬럼 추가 — ALTER 방식(기존 `users` 레코드에 영향 없음, 기본값 false 적용).
3. `packages/database/src/schema/index.ts` 배럴에 `export * from "./bot"` 추가.
4. `pnpm --filter @ai-jakdang/database drizzle-kit generate` 실행으로 **새 마이그레이션 파일 1개 생성**. **번호를 고정하지 않는다** — `packages/database/migrations/`와 `packages/database/migrations/meta/_journal.json`의 **현재 최신 번호를 확인한 뒤 그 다음 번호**로 drizzle이 자동 부여한다(착수 시점에 0024 다음일 수도, 그 사이 다른 마이그레이션이 추가됐으면 더 큰 번호일 수도 있음). 봇 스키마 변경(봇 테이블 9종 + `users.is_bot`)만 포함(타 세션 변경 혼입 없음).
5. `pnpm --filter @ai-jakdang/database drizzle-kit migrate` 실행 성공 — psql에서 9개 봇 테이블 + `users.is_bot` 컬럼 존재 확인.

## Tasks / Subtasks

- [ ] Task 1: `users.is_bot` 컬럼 스키마 추가 (AC: #2, #4, #5)
  - [ ] `packages/database/src/schema/auth.ts`의 `users` 테이블 정의에 `isBot: boolean("is_bot").notNull().default(false)` 컬럼 추가(기존 `deletedAt` 뒤 또는 공통 타임스탬프 앞)
  - [ ] `UserRow` / `NewUserRow` 추론 타입 자동 반영 확인(타입 재수동 정의 금지)

- [ ] Task 2: `packages/database/src/schema/bot.ts` 신규 생성 (AC: #1)
  - [ ] 파일 상단 JSDoc 주석 작성(Epic 11 봇 스키마, ARCHITECTURE.md §2 참조)
  - [ ] pgEnum 6종 정의:
    - `botAiProvider`(AI 프로바이더): `"openai" | "anthropic" | "google"`
    - `botModelPurpose`(모델 용도): `"generation" | "censor" | "image"`
    - `botJobKind`(잡 종류): `"post" | "comment" | "reply" | "question" | "resource"` — `question`(Q&A 질문 작성: 11.4 `createQuestionAsBot`), `resource`(실전자료 작성: 11.4 `createResourceAsBot`). #6 정합(2026-06-29).
    - `botJobStatus`(잡 상태): `"pending" | "generating" | "censoring" | "held" | "approved" | "published" | "discarded" | "blocked"`
    - `botTopicKind`(주제 종류): `"fixed" | "realtime" | "auto"`
    - `botTopicStatus`(주제 상태): `"unused" | "used" | "cooling"`
    - `botHoldReason`(보류 사유): `"ambiguous" | "injection_suspect" | "copyright_risk" | "observation_mode"` — `observation_mode`(관찰 모드 보류)는 Story 11.12가 `bot_observation_mode` ON일 때 게시 전 전량을 보류 큐에 적재하며 사용한다.
    - `botHoldDecision`(보류 결정): `"approved" | "discarded"`
    - `botEventType`(활동 이벤트 유형): `"post.published" | "comment.published" | "held" | "blocked" | "regenerated" | "skipped" | "cost" | "discarded" | "planned"` — `discarded`(폐기: 11.9 재생성 한도 초과·11.17 보류 폐기), `planned`(일일 계획 기록: 11.11 `botDailyPlanProcessor`가 페르소나별 계획 완료 시 기록). 11.11의 계획 로그는 `cost`(비용)가 아니라 `planned`를 사용한다.
  - [ ] `botPersonas` 테이블 정의 (다른 테이블이 `persona_id`로 FK 참조하므로 **가장 먼저 정의**). **`gen_model_id`/`censor_model_id` 컬럼 없음** — 모델 할당은 `bot_model_assignments`가 `persona_id`로 역참조한다(#5 정합, 2026-06-29).
  - [ ] `botModelAssignments` 테이블 정의 (**`persona_id` FK → `botPersonas.id`**(NOT NULL, `onDelete: cascade`), `provider`·`model`·`purpose`·`is_active`·`note`). **unique 제약 `(persona_id, purpose)`** — 페르소나당 용도별 모델 1개. 모델 조회는 `(persona_id, purpose)`로 수행.
  - [ ] `botPersonaBoards` 테이블 정의 (`persona_id` FK → `botPersonas.id`)
  - [ ] `botActivityRhythm` 테이블 정의 (`persona_id` FK → `botPersonas.id`)
  - [ ] `botTopics` 테이블 정의 (`persona_id` FK → `botPersonas.id`)
  - [ ] `botGenerationJobs` 테이블 정의 (`persona_id` FK → `botPersonas.id`, `topic_id` nullable FK → `botTopics.id`)
  - [ ] `botHoldQueue` 테이블 정의 (`job_id` FK → `botGenerationJobs.id`)
  - [ ] `botActivityLog` 테이블 정의 (`persona_id` FK → `botPersonas.id`)
  - [ ] `botSettings` 테이블 정의 (`site_settings` 패턴 — key text PK, value jsonb, updatedAt)
  - [ ] 각 테이블 `$inferSelect` / `$inferInsert` 타입 export

- [ ] Task 3: 배럴 export 추가 (AC: #3)
  - [ ] `packages/database/src/schema/index.ts`에 `// ── Epic 11: 시딩 봇 ──` 섹션 아래 `export * from "./bot"` 추가

- [ ] Task 4: 마이그레이션 생성 및 실행 (AC: #4, #5)
  - [ ] **생성 전** `packages/database/migrations/`(가장 큰 `NNNN_*.sql`)와 `packages/database/migrations/meta/_journal.json`(마지막 entry의 `idx`/태그)에서 **현재 최신 마이그레이션 번호를 확인**한다
  - [ ] `pnpm --filter @ai-jakdang/database drizzle-kit generate` 실행 — drizzle이 **최신 번호의 다음 번호**로 파일을 자동 생성(번호 하드코딩 금지)
  - [ ] 생성된 파일 번호가 위에서 확인한 최신 번호 + 1인지 확인
  - [ ] SQL 파일 내용 검토 — 봇 테이블 9종 + `users.is_bot` ALTER만 포함, 타 스키마 변경 없음 확인
  - [ ] `pnpm --filter @ai-jakdang/database drizzle-kit migrate` 실행(DATABASE_URL 주입 — Dev Notes 참조)
  - [ ] psql 또는 drizzle studio에서 9개 봇 테이블 생성 확인, `users` 테이블에 `is_bot` 컬럼 존재 확인

- [ ] Task 5: TypeScript 타입 검사 통과 (AC: 전체)
  - [ ] `pnpm --filter @ai-jakdang/database tsc --noEmit` 통과
  - [ ] `bot.ts` 내부 forward reference 없음 확인(정의 순서: `botPersonas` → `botModelAssignments` → 나머지 — 모든 테이블이 `botPersonas`를 참조하므로 personas가 최상단)

## Dev Notes

### 아키텍처 가드레일

- **DB 직접 INSERT 금지(핵심 원칙)**: 이 스토리는 스키마 정의와 마이그레이션만 수행한다. 봇 계정 실제 생성·주제 시드는 Story 11.5에서 처리한다.
- **DB 접근 경계**: `packages/database`는 `apps/api`·`apps/worker`에서만 Drizzle import. `apps/web`·`apps/admin`에서 직접 import 금지. [Source: docs/seeding-bot/ARCHITECTURE.md#0]
- **Drizzle 버전**: `drizzle-orm ^0.38 stable` 사용 중. v1.0 beta 사용 금지.
- **enum 하드코딩 금지 패턴**: 기존 코드베이스의 모든 enum은 `pgEnum`으로 정의 후 컬럼에서 참조. `as const` 배열 직접 사용 금지.

### `users.is_bot` 컬럼 추가 시 주의사항

- 기존 `users` 레코드는 `DEFAULT false`로 자동 채워지므로 데이터 마이그레이션 불필요.
- 이후 통계·랭킹 쿼리(포인트·랭킹·접속통계)에서 `is_bot = false` 필터 추가 여부는 Story 11.5의 범위(`bot_exclude_from_ranking` 설정값 토글). 이 스토리에서는 컬럼 추가만.
- `auth.ts`의 `UserRow` 타입 추론이 자동 갱신되므로 `UserRow`를 사용하는 api/worker의 타입 안전성이 함께 강화된다.

### `bot_settings` 테이블 — `site_settings` 패턴 재사용

`site_settings`(`packages/database/src/schema/site-settings.ts`)와 동일하게 key-value jsonb 구조로 구현한다:

```ts
// 참조 패턴
export const botSettings = pgTable("bot_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

초기 시드 키 8종(`bot_master_enabled`(킬 스위치), `bot_daily_post_limit`(일일 글 상한), `bot_daily_comment_limit`(일일 댓글 상한), `bot_daily_cost_limit_usd`(일일 비용 상한), `bot_exclude_from_ranking`(랭킹 제외), `bot_auto_refill_topics`(주제 자동 보충), `bot_observation_mode`(관찰 모드), `bot_push_channel`(푸시 채널))는 Story 11.5 시드 스크립트에서 INSERT.

### 모델 할당 구조 — `bot_model_assignments`가 `bot_personas`를 역참조 (#5 정합)

봇별 모델 할당은 **`bot_model_assignments` 테이블이 `persona_id`로 `bot_personas`를 참조**하는 방향이다. `bot_personas`에는 `gen_model_id`/`censor_model_id` 컬럼을 **두지 않는다**(과거 설계 폐기). 따라서 정의 순서는 `botPersonas`(먼저) → `botModelAssignments`(나중) 이고, forward reference 문제도 없다(personas가 다른 모든 테이블의 부모).

```ts
// 1) personas 먼저 (모델 FK 컬럼 없음)
export const botPersonas = pgTable("bot_personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  // ... nickname, persona_prompt, info_ratio, is_admin_persona, is_active 등
});

// 2) model_assignments가 persona_id로 역참조 + (persona_id, purpose) unique
export const botModelAssignments = pgTable(
  "bot_model_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personaId: uuid("persona_id").notNull()
      .references(() => botPersonas.id, { onDelete: "cascade" }),
    provider: botAiProvider("provider").notNull(),         // openai|anthropic|google
    model: varchar("model", { length: 128 }).notNull(),    // 모델명(DB값, 하드코딩 금지)
    purpose: botModelPurpose("purpose").notNull(),          // generation|censor|image
    isActive: boolean("is_active").notNull().default(true),
    note: text("note"),
  },
  (t) => ({
    personaPurposeUq: unique("bot_model_assignments_persona_purpose_uq")
      .on(t.personaId, t.purpose),   // 페르소나당 용도별 1개
  }),
);
```

> 모델 조회는 항상 **`(persona_id, purpose)`** 로 수행한다(예: 글 생성 모델 = `purpose='generation'`, 검열관 = `purpose='censor'`, 이미지 = `purpose='image'`). 공용 헬퍼 `getModelAssignment(db, personaId, purpose)`(Story 11.6 정의)를 11.9/11.10 파이프라인이 사용한다.

### `bot_activity_rhythm` — jsonb 컬럼

`active_hours`(활동 시간대)·`active_days`(활동 요일 성향) 모두 `jsonb()` 타입. 별도 타입 정의 없이 `jsonb("active_hours")` 형태로 정의하면 된다. 런타임 타입은 Zod(Story 11.2)에서 검증한다.

### `bot_generation_jobs` — `topic_id` nullable FK

댓글 잡(job_kind = `"comment"`)은 주제가 없으므로 `topic_id`는 nullable:
```ts
topicId: uuid("topic_id").references(() => botTopics.id, { onDelete: "set null" }),
```
`target_post_id`(댓글 대상 게시글 ID)도 nullable uuid(FK 미설정, 크로스 도메인 참조 회피 — 기존 `issuedBy` 패턴 동일).

### `bot_hold_queue` — `decided_by` 크로스 도메인

`decided_by`(결정한 관리자 ID)는 `admin_users.id`를 가리키지만, 크로스 도메인 FK 설정 금지 원칙에 따라 uuid 값만 저장(FK 없음). 기존 `user_sanctions.issuedBy`와 동일 패턴. [Source: packages/database/src/schema/auth.ts#userSanctions]

### 마이그레이션 실행 — DATABASE_URL 주의

```bash
# 루트 .env의 DATABASE_URL은 포트 5433. drizzle-kit migrate가 auth_failed면 env 주입 필요.
DATABASE_URL=postgresql://... pnpm --filter @ai-jakdang/database drizzle-kit migrate
```

`db:generate`는 오프라인 동작(스키마 분석만)이므로 DB 연결 불필요. `db:migrate`만 연결 필요.

### 다중 세션 충돌 방지 — 마이그레이션 혼입 금지

`drizzle-kit generate`는 현재 체크아웃된 **전체 schema 디렉터리**를 읽어 단 하나의 마이그레이션 파일을 생성한다. 동시에 다른 세션에서 스키마를 변경한 경우, 해당 변경이 같은 마이그레이션 파일에 묶일 수 있다. 이 스토리 실행 전 `git status`로 `packages/database/src/schema/` 내 다른 변경이 없는지 확인하라. 혼입 발생 시 생성된 SQL 파일에서 봇 테이블·`users.is_bot` 이외의 DDL을 제거하고 별도 마이그레이션으로 분리한다. [Source: 메모리 규칙 — epic9-migration-0017-reconciled.md]

### idempotent 마이그레이션 패턴

이 레포의 수동 마이그레이션 관행(`IF NOT EXISTS`·`DO $$` 가드)에 따라, generate 후 SQL에 `CREATE TYPE IF NOT EXISTS`·`CREATE TABLE IF NOT EXISTS` 가드가 없으면 idempotent하게 수동 보강한다. (Drizzle generate는 기본적으로 IF NOT EXISTS 없이 생성하지만, 레포 내 기존 수동 마이그레이션 0022·0023·0024는 `IF NOT EXISTS` 패턴을 혼용하고 있음.) [Source: packages/database/migrations/0023_epic9_admin_gaps.sql]

### 건드릴 파일 목록

| 작업 | 파일 |
|---|---|
| 신규 생성 | `packages/database/src/schema/bot.ts` |
| 수정 | `packages/database/src/schema/auth.ts` — `users` 테이블 `isBot` 컬럼 추가 |
| 수정 | `packages/database/src/schema/index.ts` — bot export 추가 |
| 자동 생성 | `packages/database/migrations/<다음번호>_*.sql` (번호 고정 금지 — generate가 최신 다음 번호 자동 부여) |

### Project Structure Notes

- `bot.ts`는 `packages/database/src/schema/` 기존 파일들과 동일 위치. 파일명 kebab-case 규칙(`site-settings.ts`, `page-views.ts`처럼 복합어는 하이픈 구분 — 단일어 테이블은 단순명 `bot.ts`).
- Drizzle 마이그레이션 파일은 `packages/database/migrations/` 에 자동 생성되며 커밋 대상. 파일명은 Drizzle이 자동 부여(스키마 해시 기반).
- `packages/database/src/schema/index.ts`의 export 순서: 기존 Epic 섹션 주석 패턴(`// ── Epic N: 설명 ──`) 유지.
- 이 스토리에서 생성하는 enum 9종은 `packages/contracts/src/bot.ts`(Story 11.2)에서 Zod 스키마와 함께 재사용된다. 두 파일이 별개의 소스이므로 contracts에서 Drizzle enum 직접 import 금지(contracts 패키지는 database 패키지에 의존하지 않음).

### References

- [Source: docs/seeding-bot/ARCHITECTURE.md#2] — 봇 테이블 9종 컬럼 정의 전체(이 스토리의 1차 설계 기준)
- [Source: docs/seeding-bot/ARCHITECTURE.md#0] — DB 직접 INSERT 금지, DB 접근 경계 원칙
- [Source: docs/seeding-bot/ARCHITECTURE.md#2.10] — `bot_settings` 키-값 정의 8종
- [Source: docs/seeding-bot/PRD.md#FR-SB-1.1] — `is_bot`(봇 여부) 플래그 요구사항
- [Source: docs/seeding-bot/PRD.md#FR-SB-1.5] — `bot_exclude_from_ranking`(봇 랭킹 제외) 토글
- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.1] — AC 원문
- [Source: packages/database/src/schema/site-settings.ts] — `bot_settings` 구현의 참조 패턴
- [Source: packages/database/src/schema/auth.ts#userSanctions] — 크로스 도메인 `decided_by` 비FK 패턴
- [Source: packages/database/src/schema/index.ts] — 배럴 export 섹션 주석 패턴
- [Source: packages/database/migrations/ + meta/_journal.json] — **착수 시 최신 마이그레이션 번호 확인 후 다음 번호로 생성**(번호 하드코딩 금지). 기존 최신은 시점에 따라 달라질 수 있음.
- [Source: packages/database/migrations/*epic9*.sql 등 기존 마이그레이션] — idempotent DDL(`IF NOT EXISTS`·`DO $$` 가드) 참조 패턴

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

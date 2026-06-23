# Story 10.2: 동의 기록 스키마 — `users` 컬럼 + 계약 타입

Status: ready-for-dev

## Story

As a 개발팀,
I want 가입 시 동의한 약관 버전·시점을 `users`에 기록하는 스키마가 준비되기를,
so that PIPA 요건상 "언제·어떤 버전 동의"를 증명할 수 있다.

## Acceptance Criteria

1. `packages/database/src/schema/users.ts`에 `termsAgreedAt` (`terms_agreed_at`, `timestamptz`, nullable)과 `termsVersion` (`terms_version`, `varchar(32)`, nullable) 컬럼이 추가되고, `drizzle-kit generate`로 마이그레이션 파일이 생성되어 적용 후 기존 레코드가 null로 유지된다(AR-2 단일 소유권).
2. `packages/database/src/migrations/` 에 마이그레이션 파일이 생성되며, `drizzle-kit migrate`(또는 `push`) 후 `\d users`에서 두 컬럼이 확인된다.
3. `packages/contracts/src/auth.ts`의 `signUpSchema`에 `termsAgreed: z.literal(true)`가 추가되어, `false` 또는 누락 시 Zod 검증이 실패(422)한다. `UserRow` 응답 타입 `publicUserSchema`에 `termsAgreedAt: z.string().nullable()`, `termsVersion: z.string().nullable()`이 추가된다.
4. `packages/core/src/legal.ts`(NEW)에 `CURRENT_TERMS_VERSION = '2026-06-17'` 상수가 정의된다. `packages/core/src/index.ts` 배럴에 export되어 `apps/api`, `apps/web` 모두 동일 상수를 import한다(단일 소스).
5. `packages/database/src/schema/users.ts`의 `UserRow` 타입(`$inferSelect`)이 `termsAgreedAt: Date | null`, `termsVersion: string | null`을 포함한다.
6. 소셜 가입(Better Auth 신규 사용자 생성 훅) 경로에서도 `terms_agreed_at`·`terms_version`을 기록할 수 있는 인터페이스가 schema 레벨에서 준비된다(실제 소셜 연동은 Story 1.5 — 이 스토리는 컬럼 존재만 보장).

## Tasks / Subtasks

- [ ] Task 1: `packages/core/src/legal.ts` 생성 (AC: #4)
  - [ ] `packages/core/src/legal.ts` NEW
    ```ts
    /** 현재 약관 버전 상수. 개정 시 이 값만 변경하면 가입 처리·약관 페이지가 모두 반영된다. */
    export const CURRENT_TERMS_VERSION = '2026-06-17' as const;
    ```
  - [ ] `packages/core/src/index.ts` UPDATE — `export { CURRENT_TERMS_VERSION } from './legal.js';` 추가

- [ ] Task 2: `packages/database/src/schema/users.ts` 컬럼 추가 (AC: #1, #5)
  - [ ] `packages/database/src/schema/users.ts` UPDATE
    - `import` 에 `varchar` 추가(drizzle-orm/pg-core)
    - `users` 테이블 정의에 추가:
      ```ts
      termsAgreedAt: timestamp('terms_agreed_at', { withTimezone: true }),
      termsVersion: varchar('terms_version', { length: 32 }),
      ```
    - 두 컬럼 모두 `.notNull()` 없음 → nullable (기존 레코드 영향 없음, AR-2)
    - `UserRow` / `NewUserRow` 타입은 `$inferSelect` / `$inferInsert` 자동 반영
  - [ ] 현재 파일에 있는 `userRole` pgEnum, `id`, `email`, `nickname`, `passwordHash`, `role`, `createdAt` 컬럼은 변경하지 않음(회귀 방지)

- [ ] Task 3: drizzle-kit 마이그레이션 생성 (AC: #1, #2)
  - [ ] `packages/database/` 에서 `pnpm drizzle-kit generate` 실행 → `src/migrations/` 에 SQL 파일 생성
  - [ ] 생성된 SQL 확인: `ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_agreed_at TIMESTAMPTZ;` + `terms_version VARCHAR(32);`
  - [ ] `pnpm drizzle-kit migrate` (또는 `push`) 로 dev DB 적용
  - [ ] **마이그레이션 파일 단일 소유권**: 이 스토리 외 다른 스토리가 동시에 users 컬럼 수정 중이면 머지 전 커밋 금지(AR 마이그레이션 규칙)

- [ ] Task 4: `packages/contracts/src/auth.ts` 업데이트 (AC: #3)
  - [ ] `signUpSchema` UPDATE — `termsAgreed: z.literal(true)` 필드 추가:
    ```ts
    export const signUpSchema = z.object({
      email: z.string().trim().email(),
      password: z.string().min(8).max(128),
      nickname: z.string().trim().min(2).max(20),
      termsAgreed: z.literal(true),  // ← 추가: false/누락 시 422
    });
    ```
  - [ ] `publicUserSchema` UPDATE — 응답 타입에 약관 필드 추가:
    ```ts
    export const publicUserSchema = z.object({
      id: z.string(),
      email: z.string().email(),
      nickname: z.string(),
      role: z.enum(["member", "admin"]),
      createdAt: z.string(),
      termsAgreedAt: z.string().nullable(),  // ← 추가
      termsVersion: z.string().nullable(),   // ← 추가
    });
    ```
  - [ ] 기존 `signInSchema` (email, password)는 변경하지 않음

- [ ] Task 5: 타입 정합성 검증 (AC: #3, #4, #5)
  - [ ] `pnpm typecheck` — 전 워크스페이스 통과 확인
  - [ ] `packages/contracts/src/auth.test.ts` 가 있으면 `termsAgreed: true` 케이스·`false` 케이스 테스트 추가

## Dev Notes

### 아키텍처 패턴
- **DB 단일 소유권(AR-2)**: `terms_agreed_at` / `terms_version` 컬럼은 `packages/database`만 소유. `apps/api`의 service 레이어만 쓰기. `packages/core`·web·admin에서 Drizzle 직접 호출 금지. [Source: project-context.md#패키지 경계]
- **contracts 우선**: `termsAgreed` 필드는 `packages/contracts/auth.ts`에만 정의. API 라우트에서 로컬 재정의 금지. [Source: project-context.md#Critical Implementation Rules]
- **core 단일 상수**: `CURRENT_TERMS_VERSION`은 `packages/core/src/legal.ts`에만 존재. web·api 양쪽에서 import. 하드코딩 금지. [Source: epics.md#Story 10.2 AC]
- **마이그레이션 규칙**: `drizzle-kit generate` 파일은 단일 소유권·머지 전 커밋 금지. 동시 작업 스토리(1.2 등 users 테이블 수정)와 타이밍 조율 필수. [Source: architecture.md#Process Patterns - Transaction & Data Access]

### 수정 대상 파일 현황
- **`packages/database/src/schema/users.ts`** (UPDATE):
  - 현재: `id`, `email`, `nickname`, `passwordHash`, `role`, `createdAt` 6개 컬럼. placeholder 스키마 상태("Better Auth 구현 단계에서 확장" 주석 있음).
  - 변경: `termsAgreedAt`, `termsVersion` 2개 nullable 컬럼 추가.
  - 보존: `userRole` enum, 기존 6개 컬럼 정의, `UserRow`/`NewUserRow` export 이름.
  - ⚠️ 주의: architecture.md §Data Architecture에서 `users` 추가 컬럼(`default_avatar_index`, `banner_url`, `links`, `terms_agreed_at`, `terms_version`, `suspended_until`)을 Story 1.2 첫 스키마부터 포함하라고 명시함. Story 1.2가 이미 완료되었다면 `terms_agreed_at`·`terms_version`이 이미 추가됐을 수 있음 → 착수 전 현재 파일 확인 필수. 이미 있으면 이 Task 2·3는 skip하고 contracts/core만 추가.

- **`packages/contracts/src/auth.ts`** (UPDATE):
  - 현재: `signUpSchema`에 `termsAgreed` 없음. `publicUserSchema`에 `termsAgreedAt`·`termsVersion` 없음.
  - 변경: 상기 필드 추가.
  - 보존: `signInSchema` 불변.

- **`packages/core/src/index.ts`** (UPDATE):
  - 현재: `export * from './qna.js'; export * from './points.js';` 구조 (추정).
  - 변경: `legal.ts` export 추가.
  - 보존: 기존 export 전부.

### Drizzle 네이밍 규칙
- DB 컬럼명 = `snake_case`: `terms_agreed_at`, `terms_version`
- Drizzle 프로퍼티명 = `camelCase`: `termsAgreedAt`, `termsVersion`
- `varchar(32)` — 버전 문자열 최대 길이 `CURRENT_TERMS_VERSION = '2026-06-17'` (10자) 기준, 여유분 확보
- `timestamptz` — `timestamp('terms_agreed_at', { withTimezone: true })`
- [Source: project-context.md#네이밍]

### 테스트
- `packages/contracts/src/auth.test.ts` 가 있으면 `signUpSchema.parse({ ..., termsAgreed: false })` → throw, `termsAgreed: true` → pass 케이스 추가.
- `packages/core` 단위 테스트: `CURRENT_TERMS_VERSION`이 string이고 truthy임 확인(간단).

### Project Structure Notes
- `packages/core/src/legal.ts` 파일명: `legal.ts` (lowercase, 모듈 파일 규칙). named export 사용.
- `packages/core/src/index.ts` 배럴: Next.js `transpilePackages` 환경이므로 `export *` 배럴 주의. `legal.ts`의 export는 단순 상수 1개이므로 `export { CURRENT_TERMS_VERSION } from './legal.js'` 명시적 re-export 권장.

### References
- [Source: epics.md#Story 10.2 AC]
- [Source: architecture.md#Data Architecture — users 추가 컬럼]
- [Source: architecture.md#Implementation Patterns — Naming Patterns, Process Patterns]
- [Source: project-context.md#패키지 경계, 네이밍]
- [Source: packages/database/src/schema/users.ts — 현재 상태]
- [Source: packages/contracts/src/auth.ts — 현재 상태]
- [Source: docs/adr/ADR-0002-identity-and-auth-schema.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

- NEW `packages/core/src/legal.ts`
- UPDATE `packages/core/src/index.ts`
- UPDATE `packages/database/src/schema/users.ts`
- NEW `packages/database/src/migrations/{timestamp}_add_terms_columns.sql` (drizzle-kit generate 산출물)
- UPDATE `packages/contracts/src/auth.ts`

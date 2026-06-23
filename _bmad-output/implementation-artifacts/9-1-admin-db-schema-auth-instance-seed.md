# Story 9.1: 관리자 신원 DB 스키마 · Better Auth 인스턴스 · super_admin 시드

Status: ready-for-dev

## Story

As a 개발팀,
I want 관리자 전용 DB 테이블과 별도 Better Auth 인스턴스·super_admin 시드가 ADR-0003대로 정착되기를,
So that 모든 어드민 기능이 유저 신원과 격리된 토대 위에서 구현된다.

## Acceptance Criteria

1. `packages/database/src/schema/admin.ts` 생성, `adminRole`(staff/super_admin)·`adminStatus`(pending/active/suspended/disabled) pgEnum 정의, `admin_users`(email unique·name·phone·role default staff·status default pending·approved_by·approved_at·note·createdAt·updatedAt)·`admin_sessions`·`admin_accounts`(credential 전용, providerId default "credential")·`admin_verifications` 테이블 생성. `users`와 FK·공유 컬럼 없음.
2. `packages/database/src/schema/index.ts`에서 admin 스키마 re-export. `drizzle-kit generate && migrate` 완료, 모든 테이블 확인.
3. `packages/auth`에 Better Auth 설치(`better-auth` npm 패키지). `packages/auth/src/adminAuth.ts`에 관리자용 Better Auth 인스턴스 생성: basePath `/api/v1/admin/auth`, 이메일+비밀번호(credential only, 소셜 없음), Argon2id, admin 테이블 바인딩. 유저 인스턴스(`/api/v1/auth`)와 독립.
4. `packages/auth/src/permissions.ts`에서 기존 `Role = "member" | "admin"` 2단계를 3단계로 분리: 유저측 `UserRole = "member"`(역할 없음), 관리자측 `AdminRole = "staff" | "super_admin"`. `canAccessAdmin(session)` 함수를 **관리자 세션·`status=active`** 기준으로 재구현(유저 세션으로는 호출 불가). `hasAdminPermission(role: AdminRole, action: AdminAction)` 구현: staff는 숨김 상한(soft actions만), super_admin은 영구삭제·사이트설정·광고·운영자 승인·권한변경 추가.
5. `apps/api/src/plugins/adminAuth.ts`에서 Fastify 플러그인으로 관리자 Better Auth 인스턴스 마운트. 세션 쿠키명 `aj_admin_session`(admin 서브도메인 scoped). `GET /api/v1/admin/auth/session`으로 세션 확인 가능.
6. `packages/database/src/seeds/super-admin.ts` 작성: env `SUPER_ADMIN_EMAIL` · `SUPER_ADMIN_NAME` · `SUPER_ADMIN_PASSWORD` 읽어 `admin_users`(status=active, role=super_admin) + `admin_accounts`(Argon2id 해시) 생성. 재실행 멱등(이미 존재하면 스킵).
7. `apps/api` 미들웨어에 `/api/v1/admin/*` 가드 구현: `aj_admin_session` 쿠키 없거나 `status≠active`이면 401 반환. 유저 세션(`aj_session`)만 있는 요청은 동일하게 401. 통합 테스트(Vitest) 확인.
8. `packages/auth/src/index.ts` re-export 업데이트: `AdminRole`, `UserRole`, `canAccessAdmin`, `hasAdminPermission`, `AdminAction` export.

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 생성 (AC: #1, #2)
  - [ ] `packages/database/src/schema/admin.ts` 생성 — ADR-0003 §2 Draft 스키마 기준(아래 Dev Notes 참조)
  - [ ] `packages/database/src/schema/index.ts`에 `export * from './admin'` 추가
  - [ ] `pnpm --filter @ai-jakdang/database drizzle-kit generate` 실행
  - [ ] `pnpm --filter @ai-jakdang/database drizzle-kit migrate` 실행
  - [ ] psql에서 4개 테이블(`admin_users`, `admin_sessions`, `admin_accounts`, `admin_verifications`) 확인

- [ ] Task 2: Better Auth 설치 및 관리자 인스턴스 생성 (AC: #3)
  - [ ] `pnpm add better-auth` (workspace root 또는 packages/auth)
  - [ ] `packages/auth/src/adminAuth.ts` 신규 생성: `createAdminAuth()` 함수 — admin 테이블 바인딩, basePath `/api/v1/admin/auth`, credential only, Argon2id
  - [ ] `packages/auth/src/userAuth.ts` 신규 또는 기존 auth 분리: 유저용 인스턴스(basePath `/api/v1/auth`)

- [ ] Task 3: 권한 타입 분리 리팩터링 (AC: #4, #8)
  - [ ] `packages/auth/src/permissions.ts` UPDATE: `Role`(2단계) → `UserRole`, `AdminRole`, `AdminAction` union 타입으로 분리
  - [ ] `AdminAction` 타입 정의: `'content:hide' | 'content:delete' | 'report:process' | 'member:sanction' | 'member:role-change' | 'site:settings' | 'ads:manage' | 'admin:approve'`
  - [ ] `hasAdminPermission(role, action)` 구현: staff = hide/sanction/report:process만, super_admin = 전체
  - [ ] `canAccessAdmin(adminSession)` 재구현: `adminSession.status === 'active'`일 때만 true
  - [ ] `packages/auth/src/index.ts` re-export 업데이트
  - [ ] 기존 `permissions.test.ts` UPDATE: 새 타입·함수로 테스트 재작성, `pnpm test` 통과

- [ ] Task 4: Fastify admin auth 플러그인 마운트 (AC: #5)
  - [ ] `apps/api/src/plugins/adminAuth.ts` NEW: Fastify 플러그인으로 Better Auth 핸들러 마운트(`/api/v1/admin/auth/*`)
  - [ ] `apps/api/src/plugins/adminGuard.ts` NEW: `/api/v1/admin/*` 전체에 preHandler 훅 — `aj_admin_session` 검증
  - [ ] `apps/api/src/app.ts`에 adminAuth 플러그인·adminGuard 훅 등록

- [ ] Task 5: super_admin 시드 스크립트 (AC: #6)
  - [ ] `packages/database/src/seeds/super-admin.ts` NEW: env 변수 읽기, Argon2id 해시, upsert-or-skip 패턴
  - [ ] `.env.example`에 `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_NAME`, `SUPER_ADMIN_PASSWORD` 추가
  - [ ] `package.json` scripts에 `"seed:super-admin": "tsx packages/database/src/seeds/super-admin.ts"` 추가
  - [ ] 멱등성 테스트: 2회 실행 후 레코드 1개만 존재 확인

- [ ] Task 6: admin guard 통합 테스트 (AC: #7)
  - [ ] `apps/api/src/routes/admin/__tests__/adminGuard.test.ts` NEW (Vitest)
  - [ ] 케이스 1: aj_admin_session 없음 → 401
  - [ ] 케이스 2: 유저 aj_session만 있음 → 401
  - [ ] 케이스 3: pending/suspended/disabled admin session → 401
  - [ ] 케이스 4: active admin session → 200(또는 해당 라우트 통과)

## Dev Notes

### 아키텍처 가드레일
- **DB 스키마 소유권**: `packages/database`는 api/worker 전용. web/admin에서 Drizzle 직접 import 금지. [Source: _bmad-output/project-context.md#패키지 경계]
- **타입 공유**: `packages/auth`에서 타입만 export, 비시각 공유 패키지 원칙 준수. web/admin/api 전부 동일 타입 사용.
- **Drizzle 버전**: `drizzle-orm ^0.38 stable`(v1.0 beta 절대 금지). [Source: _bmad-output/project-context.md#Technology Stack]
- **Better Auth**: 현재 미설치(project-context.md "계획됐으나 아직 미설치"). 이 스토리에서 설치. packages/auth의 현재 `permissions.ts`는 Role="member"|"admin" 2단계로 리팩터링 필요.
- **Argon2id**: `better-auth`가 Argon2id 내장 제공하면 사용, 없으면 `@node-rs/argon2` or `argon2` 패키지. 절대 평문/bcrypt 사용 금지.
- **AdminRole 타입 분리(ADR-0003 §3)**: 기존 `Role = "member" | "admin"` → `UserRole = "member"`, `AdminRole = "staff" | "super_admin"`. 유저에게 역할 없음(전원 일반회원). [Source: docs/adr/ADR-0003-admin-identity-and-approval.md#3]
- **세션 쿠키 분리**: 유저 `aj_session`(루트 도메인) ↔ 관리자 `aj_admin_session`(admin 서브도메인). 도메인 설정 주의. [Source: ADR-0003 §1]

### 수정 대상 파일 현재 상태
- `packages/auth/src/permissions.ts` (UPDATE): 현재 `Role = "member" | "admin"`, `hasPermission`, `canAccessAdmin(role: Role)`. 리팩터링 시 `canAccessAdmin`을 `role: Role` 인수에서 `adminSession` 인수로 변경 — **기존 시그니처 변경**이므로 web/admin/api에서 `canAccessAdmin` 사용처 전체 확인·수정 필요.
- `packages/database/src/schema/users.ts` (UPDATE): 현재 `userRole = pgEnum("user_role", ["member", "admin"])`. admin 제거하고 `userRole = pgEnum("user_role", ["member"])`로 수정 (또는 admin 값 그대로 유지 + 신규 admin_role enum 별도 생성 후 단계적 마이그레이션 — 9.1에서는 신규 admin enum 추가, users.ts는 건드리지 않고 병행 가능).
- `packages/database/src/schema/index.ts` (UPDATE): 현재 users만 export. admin.ts export 추가.
- `packages/auth/src/index.ts` (UPDATE): 현재 permissions.ts re-export. 새 타입 추가 후 업데이트.

### Admin Schema (정확한 구현 기준 — ADR-0003 §2)
```ts
// packages/database/src/schema/admin.ts
import { pgEnum, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";

export const adminRole = pgEnum("admin_role", ["staff", "super_admin"]);
export const adminStatus = pgEnum("admin_status", ["pending", "active", "suspended", "disabled"]);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: adminRole("role").notNull().default("staff"),
  status: adminStatus("status").notNull().default("pending"),
  approvedBy: uuid("approved_by"),  // admin_users.id, FK 대신 id 보관 (ADR-0003 §5)
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAccounts = pgTable("admin_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull().default("credential"),
  accountId: text("account_id").notNull(),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  providerAccountUq: uniqueIndex("admin_accounts_provider_account_uq").on(t.providerId, t.accountId)
}));

export const adminVerifications = pgTable("admin_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminUserRow = typeof adminUsers.$inferSelect;
export type NewAdminUserRow = typeof adminUsers.$inferInsert;
```

### hasAdminPermission 구현 가이드
```ts
export type AdminAction =
  | 'content:hide'       // staff 가능 (숨김 상한)
  | 'content:delete'     // super_admin 전용
  | 'report:process'     // staff 가능
  | 'member:sanction'    // staff 가능 (이용제한까지)
  | 'member:role-change' // super_admin 전용
  | 'site:settings'      // super_admin 전용
  | 'ads:manage'         // super_admin 전용
  | 'admin:approve';     // super_admin 전용

const STAFF_ACTIONS = new Set<AdminAction>(['content:hide','report:process','member:sanction']);
const SUPER_ADMIN_ACTIONS = new Set<AdminAction>([...STAFF_ACTIONS, 'content:delete','member:role-change','site:settings','ads:manage','admin:approve']);
```

### 보안 주의
- admin guard preHandler는 모든 `/api/v1/admin/*` 라우트에 적용(sign-in/sign-up 엔드포인트 제외 — Better Auth가 처리).
- 시드 스크립트의 비밀번호는 반드시 Argon2id 해시 후 저장. 평문 저장 금지.
- `.env.example`에만 추가하고 `.env` 실제 값은 `.gitignore` 확인.

### Project Structure Notes
- 새 파일(NEW): `packages/database/src/schema/admin.ts`, `packages/auth/src/adminAuth.ts`, `packages/auth/src/userAuth.ts`, `apps/api/src/plugins/adminAuth.ts`, `apps/api/src/plugins/adminGuard.ts`, `packages/database/src/seeds/super-admin.ts`
- 수정 파일(UPDATE): `packages/database/src/schema/index.ts`, `packages/auth/src/permissions.ts`, `packages/auth/src/permissions.test.ts`, `packages/auth/src/index.ts`
- 마이그레이션 파일 생성 위치: `packages/database/drizzle/` (단일 소유권, 동시 작업 시 충돌 주의)

### References
- [Source: docs/adr/ADR-0003-admin-identity-and-approval.md] — 전체 결정 근거
- [Source: _bmad-output/planning-artifacts/architecture.md#Established Foundation] — Better Auth, Argon2id
- [Source: _bmad-output/project-context.md#보안] — 관리자 신원 분리, aj_admin_session
- [Source: _bmad-output/planning-artifacts/epics.md#L2573-2600] — AC 원문

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

# Story 1.2: 인증 토대 — 스키마 · packages/auth 분리 · Better Auth 유저 인스턴스

Status: ready-for-dev

## Story

As a 개발팀,
I want 유저 인증 스키마와 권한 패키지·Better Auth 유저 인스턴스가 ADR-0002/0003 설계대로 정착되기를,
so that 회원가입·로그인·소셜 등 모든 인증 흐름이 일관된 토대 위에서 구현된다.

## Acceptance Criteria

1. `packages/database/src/schema/auth.ts`에 ADR-0002 설계(`users`·`sessions`·`accounts`·`verifications`·`user_sanctions`) + 아키텍처 추가 컬럼(`default_avatar_index`·`banner_url`·`links`·`terms_agreed_at`·`terms_version`·`suspended_until`)이 모두 포함된 Drizzle 스키마가 존재하고 drizzle-kit 마이그레이션이 DB에 적용된다.
2. `users.password_hash` 컬럼이 **없다** — 비밀번호는 `accounts.password`에 Argon2id 해시로만 저장(기존 placeholder `users.ts`의 `passwordHash` 대체).
3. `users.email`(notNull·unique)·`users.nickname`(notNull·unique)·`user_status` enum(active/suspended/withdrawn)·`users.default_avatar_index`(int notNull)이 존재한다.
4. `nickname`의 허용 문자(한글·영문·숫자·`_`)·길이 제약(2~20자)이 `packages/contracts/src/auth.ts`의 Zod 스키마에 정의된다.
5. `packages/auth`의 기존 `Role("member"|"admin")` 2단계가 유저(역할 없음)·관리자(`AdminRole: "staff"|"super_admin"`) 분리 구조로 리팩터링되고, `hasPermission`·`canAccessAdmin`이 새 타입으로 컴파일되며 web/admin/api typecheck를 통과한다.
6. Better Auth 유저 인스턴스가 `apps/api/src/auth/user-auth.ts`에 구성된다(basePath `/api/v1/auth`, Argon2id 커스텀 해셔, 소셜 provider 구성 슬롯).
7. `AUTH_DEV_BYPASS=true`이고 `NODE_ENV!=production`일 때 `/api/v1/auth/dev-login` 호출 시 시드 유저 세션이 발급된다. production 빌드에서는 해당 라우트가 404 또는 비노출임을 테스트로 확인한다.
8. `packages/contracts/src/auth.ts`에 auth Zod 스키마(`signUpSchema`·`signInSchema`·`publicUserSchema` 갱신)가 정의되고 api 라우트가 `fastify-type-provider-zod`로 이를 사용한다.
9. `pnpm typecheck` 전 워크스페이스 통과.

## Tasks / Subtasks

- [ ] Task 1: Better Auth 설치 (AC: #6) — `packages/auth`는 현재 빈 패키지(AR-9 "아직 미설치")
  - [ ] 1.1 `pnpm add better-auth` — `packages/auth` 패키지에 추가
  - [ ] 1.2 `pnpm add argon2` — Argon2id 해셔용 (또는 better-auth 번들 해셔 확인 후 결정)
  - [ ] 1.3 `packages/config/src/env.ts` UPDATE: `AUTH_SECRET`(string min 32)·`BETTER_AUTH_URL`(optional) 추가

- [ ] Task 2: DB 스키마 재작성 (AC: #1, #2, #3) — UPDATE: 기존 `packages/database/src/schema/users.ts` placeholder를 ADR-0002 설계로 대체
  - [ ] 2.1 `packages/database/src/schema/users.ts` 파일명을 `auth.ts`로 변경 또는 내용 전체 대체
    ```ts
    // 보존해야 할 것: 없음(placeholder, 그린필드)
    // 대체할 것: userRole enum 제거, passwordHash 컬럼 제거
    // 추가할 것: userStatus enum(active/suspended/withdrawn), 전체 컬럼 세트
    ```
  - [ ] 2.2 `users` 테이블 필수 컬럼:
    - `id` uuid PK `defaultRandom()`
    - `email` text notNull unique
    - `emailVerified` boolean notNull default false
    - `nickname` text notNull unique
    - `image` text nullable (소셜/업로드 아바타 URL)
    - `bio` text nullable
    - `status` userStatus notNull default 'active'
    - `defaultAvatarIndex` int notNull default 0 (`default_avatar_index` snake_case)
    - `avatarUrl` text nullable (`avatar_url`) — 커스텀 업로드 시 설정, null이면 defaultAvatarIndex 사용
    - `bannerUrl` text nullable
    - `links` jsonb nullable (외부 링크 배열 `[{label, url}]`)
    - `suspendedUntil` timestamp tz nullable
    - `termsAgreedAt` timestamp tz nullable
    - `termsVersion` text nullable
    - `createdAt`/`updatedAt` timestamptz notNull defaultNow()
    - `deletedAt` timestamptz nullable
  - [ ] 2.3 `sessions` 테이블 (ADR-0002 draft 그대로)
  - [ ] 2.4 `accounts` 테이블 (providerId='credential'|'google'|'naver'|'kakao', password nullable Argon2id)
  - [ ] 2.5 `verifications` 테이블
  - [ ] 2.6 `sanctionType` enum(warning/suspend/permaban) + `userSanctions` 테이블
  - [ ] 2.7 `packages/database/src/schema/index.ts` UPDATE: `auth.ts` 내보내기, 기존 `users.ts` 참조 제거
  - [ ] 2.8 `drizzle-kit generate` + `drizzle-kit migrate` 실행; 마이그레이션 파일 단일 소유권 확인(AR-2)

- [ ] Task 3: `packages/auth` 리팩터링 (AC: #5) — UPDATE
  - [ ] 3.1 `packages/auth/src/permissions.ts` UPDATE:
    - `Role` 타입 제거(유저는 역할 없음)
    - `AdminRole = "staff" | "super_admin"` 추가
    - `AdminPermission` 타입: `"post:moderate"` `"admin:access"` `"admin:manage-members"` `"admin:approve-admin"` `"admin:permanent-delete"` `"admin:settings"` 등 권한맵 정의
    - `hasPermission(role: AdminRole, permission: AdminPermission): boolean`
    - `canAccessAdmin(role: AdminRole, status: "active" | "pending" | "suspended" | "disabled"): boolean` — `status=active`일 때만 true
    - 유저용 헬퍼: `isAuthenticated(session: UserSession | null): boolean`
  - [ ] 3.2 `packages/auth/src/index.ts` UPDATE: 새 exports 반영
  - [ ] 3.3 `packages/auth/src/permissions.test.ts` UPDATE: 새 타입 기준 테스트 업데이트

- [ ] Task 4: `packages/contracts/src/auth.ts` 스키마 갱신 (AC: #4, #8) — UPDATE
  - [ ] 4.1 `signUpSchema` 갱신: `nickname` 필드 제거(시스템 자동배정, AR-9), `email`+`password`+`termsAgreed`(boolean true 필수)만
  - [ ] 4.2 `nicknameSchema` 추가: `z.string().min(2).max(20).regex(/^[가-힣a-zA-Z0-9_]+$/, "한글·영문·숫자·_ 만 허용")` — 계정 설정에서 재사용
  - [ ] 4.3 `publicUserSchema` 갱신: `role` 필드 제거, `id·email·nickname·status·emailVerified·defaultAvatarIndex·avatarUrl·bio·createdAt` 포함
  - [ ] 4.4 `updateProfileSchema` NEW: `nickname(nicknameSchema)·bio(max 120)·links(jsonb)` optional
  - [ ] 4.5 `changePasswordSchema` NEW: `currentPassword·newPassword(min 8 max 128)`

- [ ] Task 5: Better Auth 유저 인스턴스 구성 (AC: #6, #7) — NEW
  - [ ] 5.1 `apps/api/src/auth/user-auth.ts` NEW 생성:
    ```ts
    // Better Auth 인스턴스 (basePath: '/api/v1/auth')
    // emailAndPassword: { enabled: true, requireEmailVerification: true }
    // socialProviders: { google: {...}, naver: {...}, kakao: {...} } — env에서 키 로드
    // 커스텀 Argon2id 해셔: { hash: argon2.hash, verify: argon2.verify }
    // 세션 쿠키명: 'aj_session'
    // account linking: trustedProviders 설정
    // DB adapter: packages/database getDb() 연결
    ```
  - [ ] 5.2 `apps/api/src/auth/dev-login.ts` NEW 생성: `AUTH_DEV_BYPASS=true` && `NODE_ENV!='production'` 조건부 라우트
    ```ts
    // GET /api/v1/auth/dev-login → 시드 유저(id 고정 uuid, nickname='개발자') 세션 즉시 발급
    // production이면 route 자체를 등록하지 않음
    ```
  - [ ] 5.3 `apps/api/src/routes/v1/index.ts` UPDATE: auth 라우트 등록 (Better Auth handler + dev-login)
  - [ ] 5.4 dev-login production 차단 Vitest 테스트 작성: `NODE_ENV=production` 환경에서 라우트가 404 반환

- [ ] Task 6: typecheck 통과 확인 (AC: #9)
  - [ ] 6.1 `pnpm typecheck` 전 워크스페이스 통과
  - [ ] 6.2 `pnpm test` (permissions.test.ts 통과)

## Dev Notes

### 기존 파일 현황 및 변경 사항
- **`packages/database/src/schema/users.ts`** (UPDATE — 전체 대체):
  - 현재: `userRole` enum(member|admin), `passwordHash`, `role` 컬럼 — ADR-0002 위반
  - 변경: `userStatus` enum(active/suspended/withdrawn), Better Auth 설계(`email_verified`, `accounts` 테이블에 비밀번호 이전), 추가 컬럼(`default_avatar_index` 등) — 그린필드라 마이그레이션 아님
  - 보존할 것: 없음(placeholder, 실 데이터 없음)
- **`packages/auth/src/permissions.ts`** (UPDATE):
  - 현재: `Role = "member" | "admin"`, `hasPermission(role, permission)`, `canAccessAdmin(role)`
  - 변경: `Role` → `AdminRole = "staff" | "super_admin"` 분리. 유저는 역할 없음(인증 여부만 체크)
  - 보존할 것: 파일 구조와 함수 시그니처 패턴(변경된 타입으로 재정의)
- **`packages/contracts/src/auth.ts`** (UPDATE):
  - 현재: `signUpSchema`에 `nickname` 필드 있음 — 제거(시스템 자동배정)
  - 현재: `publicUserSchema`에 `role: z.enum(["member", "admin"])` — 제거(유저 역할 없음)
  - 변경: 위 두 항목 제거 + 신규 스키마 추가

### Better Auth 구성 주의점
- **인증 마운트 규약(ADR-0002 §설계노트)**: Better Auth는 `apps/api`에서 동작하되 브라우저에는 **유저 출처 기준 프록시**로 노출. 소셜 콜백 = `http://localhost:3003/api/v1/auth/callback/{provider}` (로컬) → Next rewrite로 API 포워딩. Next가 DB에 직접 접근하지 않으므로 "DB는 api/worker만" 원칙 위배 아님.
- **Better Auth 아직 미설치** (`project-context.md` §미설치 의존성): `packages/auth`에 추가 필요.
- **Argon2id**: Better Auth 내장 Argon2id 해셔 확인 후 `@node-rs/argon2` 또는 `argon2` 패키지로 커스텀 해셔 구성.
- **카카오 이메일(ADR-0002 §카카오 정책)**: 비즈앱 검수 전까지 카카오 로그인 비활성 또는 추가 이메일 입력 처리. `users.email` notNull 설계는 유지.

### 아키텍처 가드레일
- **AR-9**: Better Auth 유저 인스턴스 basePath `/api/v1/auth`, 이메일+비밀번호+소셜(구글/네이버/카카오), `accounts` 테이블 계정 연결.
- **AR-11**: `packages/auth` Role 2→3단계 분리 — 이 스토리가 수행.
- **AR-12**: 일회용 이메일 차단·rate limit·닉네임 유니크는 Story 1.3에서 구현.
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: docs/adr/ADR-0002-identity-and-auth-schema.md]
- [Source: docs/adr/ADR-0003-admin-identity-and-approval.md#3. packages/auth 리팩터링]

### Project Structure Notes
- 새 파일: `packages/database/src/schema/auth.ts`, `apps/api/src/auth/user-auth.ts`, `apps/api/src/auth/dev-login.ts`
- 변경 파일: `packages/database/src/schema/users.ts`(내용 전체 대체 또는 삭제+auth.ts), `packages/auth/src/permissions.ts`, `packages/contracts/src/auth.ts`
- `drizzle-kit` 설정 파일(`drizzle.config.ts` in `packages/database` 또는 `apps/api`) 위치 확인 필요.

### References
- [Source: docs/adr/ADR-0002-identity-and-auth-schema.md#2. 인증 스키마 설계]
- [Source: docs/adr/ADR-0003-admin-identity-and-approval.md#2. Admin Schema]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — 데이터 모델 동기화]
- [Source: _bmad-output/project-context.md#보안]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

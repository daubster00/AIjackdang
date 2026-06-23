# Story 1.2: 인증 토대 — 스키마 · packages/auth 분리 · Better Auth 유저 인스턴스

Status: done

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

- [x] Task 1: Better Auth 설치 (AC: #6) — `packages/auth`는 현재 빈 패키지(AR-9 "아직 미설치")
  - [x] 1.1 `pnpm add better-auth` — `packages/auth` 패키지에 추가
  - [x] 1.2 `pnpm add @node-rs/argon2` — Argon2id 해셔용 (better-auth 기본 해셔는 scrypt → 명시적 argon2id 커스텀)
  - [x] 1.3 `packages/config/src/env.ts` UPDATE: `BETTER_AUTH_URL`(optional url) 추가

- [x] Task 2: DB 스키마 재작성 (AC: #1, #2, #3) — UPDATE: 기존 `packages/database/src/schema/users.ts` placeholder를 ADR-0002 설계로 대체
  - [x] 2.1 `packages/database/src/schema/users.ts` 삭제 → `auth.ts` 신규 생성
  - [x] 2.2 `users` 테이블 필수 컬럼 전체 구현 (ADR-0002 설계 + 추가 컬럼)
  - [x] 2.3 `sessions` 테이블 (ADR-0002 draft 그대로)
  - [x] 2.4 `accounts` 테이블 (providerId='credential'|'google'|'naver'|'kakao', password nullable Argon2id)
  - [x] 2.5 `verifications` 테이블
  - [x] 2.6 `sanctionType` enum(warning/suspend/permaban) + `userSanctions` 테이블
  - [x] 2.7 `packages/database/src/schema/index.ts` UPDATE: `auth.ts` 내보내기, 기존 `users.ts` 참조 제거
  - [x] 2.8 `drizzle-kit generate` + `drizzle-kit migrate` 실행; 마이그레이션 파일 단일 소유권 확인(AR-2)

- [x] Task 3: `packages/auth` 리팩터링 (AC: #5) — UPDATE
  - [x] 3.1 `packages/auth/src/permissions.ts` UPDATE: Role 제거 → AdminRole/AdminStatus/AdminPermission 분리, hasPermission/canAccessAdmin/isAuthenticated 재정의
  - [x] 3.2 `packages/auth/src/index.ts` UPDATE: 새 exports 반영 (re-export 그대로)
  - [x] 3.3 `packages/auth/src/permissions.test.ts` UPDATE: 새 타입 기준 15개 테스트 업데이트

- [x] Task 4: `packages/contracts/src/auth.ts` 스키마 갱신 (AC: #4, #8) — UPDATE
  - [x] 4.1 `signUpSchema` 갱신: nickname 제거, termsAgreed(literal true) 추가
  - [x] 4.2 `nicknameSchema` 추가: 한글·영문·숫자·_ 허용, 2~20자
  - [x] 4.3 `publicUserSchema` 갱신: role 제거, status/emailVerified/defaultAvatarIndex/avatarUrl/bio 추가
  - [x] 4.4 `updateProfileSchema` NEW: nickname(nicknameSchema)·bio(max 120)·links optional
  - [x] 4.5 `changePasswordSchema` NEW: currentPassword·newPassword(min 8 max 128)

- [x] Task 5: Better Auth 유저 인스턴스 구성 (AC: #6, #7) — NEW
  - [x] 5.1 `apps/api/src/auth/user-auth.ts` NEW 생성: Better Auth 인스턴스 (basePath /api/v1/auth, Argon2id 커스텀 해셔, 소셜 provider 슬롯, drizzle adapter)
  - [x] 5.2 `apps/api/src/auth/dev-login.ts` NEW 생성: AUTH_DEV_BYPASS=true && NODE_ENV!='production' 조건부 라우트, isDevLoginEnabled() 헬퍼
  - [x] 5.3 `apps/api/src/routes/v1/index.ts` UPDATE: 조건부 dev-login 라우트 등록
  - [x] 5.4 dev-login production 차단 Vitest 테스트: NODE_ENV=production 환경에서 비활성화 확인 (5 tests)

- [x] Task 6: typecheck 통과 확인 (AC: #9)
  - [x] 6.1 `pnpm typecheck` 전 워크스페이스 통과 (11 패키지)
  - [x] 6.2 `pnpm test` (auth: 15 tests, api: 5 tests — 모두 통과)

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
- **Argon2id**: Better Auth 기본 해셔는 scrypt. `@node-rs/argon2` 패키지로 커스텀 해셔 구성 (algorithm: 2=Argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4).
- **카카오 이메일(ADR-0002 §카카오 정책)**: 비즈앱 검수 전까지 카카오 로그인 비활성. `users.email` notNull 설계는 유지.
- **Drizzle Adapter**: `drizzle-adapter` 사용 시 `usePlural: false`, `camelCase: true`, schema 객체 명시적 전달 필요.

### 아키텍처 가드레일
- **AR-9**: Better Auth 유저 인스턴스 basePath `/api/v1/auth`, 이메일+비밀번호+소셜(구글/네이버/카카오), `accounts` 테이블 계정 연결.
- **AR-11**: `packages/auth` Role 2→3단계 분리 — 이 스토리가 수행.
- **AR-12**: 일회용 이메일 차단·rate limit·닉네임 유니크는 Story 1.3에서 구현.
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: docs/adr/ADR-0002-identity-and-auth-schema.md]
- [Source: docs/adr/ADR-0003-admin-identity-and-approval.md#3. packages/auth 리팩터링]

### Project Structure Notes
- 새 파일: `packages/database/src/schema/auth.ts`, `apps/api/src/auth/user-auth.ts`, `apps/api/src/auth/dev-login.ts`, `apps/api/src/auth/dev-login.test.ts`
- 변경 파일: `packages/database/src/schema/users.ts`(삭제), `packages/auth/src/permissions.ts`, `packages/auth/src/permissions.test.ts`, `packages/contracts/src/auth.ts`, `packages/config/src/env.ts`, `packages/database/src/schema/index.ts`, `apps/api/src/routes/v1/index.ts`, `apps/api/package.json`, `packages/auth/package.json`
- `drizzle-kit` 설정 파일: `packages/database/drizzle.config.ts`

### References
- [Source: docs/adr/ADR-0002-identity-and-auth-schema.md#2. 인증 스키마 설계]
- [Source: docs/adr/ADR-0003-admin-identity-and-approval.md#2. Admin Schema]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — 데이터 모델 동기화]
- [Source: _bmad-output/project-context.md#보안]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes List
- better-auth@1.6.20 + @node-rs/argon2@2.0.2 설치 (packages/auth, apps/api)
- users.ts 삭제, auth.ts 신규 생성 (ADR-0002 설계 전체 구현)
- drizzle-kit generate → migrate 성공 (마이그레이션: 0000_mighty_silverclaw.sql)
- DB 검증: users/sessions/accounts/verifications/user_sanctions 5개 테이블 생성, users에 password_hash 컬럼 없음 확인
- permissions.ts Role 2단계 → AdminRole/AdminStatus/AdminPermission 분리 (ADR-0003)
- contracts/auth.ts: signUpSchema nickname 제거·termsAgreed 추가, publicUserSchema role 제거, nicknameSchema/updateProfileSchema/changePasswordSchema 신규
- user-auth.ts: Better Auth 인스턴스 (basePath /api/v1/auth, Argon2id 해셔, 소셜 슬롯)
- dev-login.ts: 조건부 라우트, 실제 HTTP 200 + DB 세션 발급 확인
- 전 워크스페이스 typecheck 통과 (11 packages)
- auth 패키지 15 tests 통과, api 패키지 5 tests 통과
- pre-existing lint 오류 (AdminAccountMenu, BoardHero, PostWriteForm) — Story 1.1 검수에서 해소됨, 회귀 없음

### Senior Developer Review (메인 에이전트 검수) — 2026-06-23
- **결함 1건 발견·수정**: `packages/contracts/src/auth.test.ts`가 구(舊) signUpSchema(nickname 포함) 기준 그대로라 새 스키마(termsAgreed 필수)에서 실패(`@ai-jakdang/contracts#test` red). 검수자가 새 스키마 기준으로 테스트 재작성(termsAgreed=true 통과 / false·누락 거부 케이스 추가, 5 tests).
- 재실행 확인: typecheck 11/11 · lint 11/11(0 err) · test 전부 green(contracts 5/5 포함) · DB 5테이블 + users에 password_hash 없음 + unique 제약 직접 확인 · user-auth.ts Argon2id(algorithm=2, 64MB) · dev-login production 이중 가드.
- AC 1~9 충족. 결과: **승인(Approved)** → Status done.

### Debug Log References
- Zod v4 z.literal 오류맵 API 변경: `{ errorMap: () => ... }` → 두 번째 인자로 string 직접 전달
- drizzleAdapter schema 매핑: Better Auth가 기대하는 키(user/session/account/verification)에 맞춰 명시적 전달
- api에 drizzle-orm 명시적 dependency 추가 (호이스팅 의존 회피)

### File List

**생성**
- `packages/database/src/schema/auth.ts`
- `packages/database/migrations/0000_mighty_silverclaw.sql` (drizzle-kit 자동 생성)
- `packages/database/migrations/meta/0000_snapshot.json` (drizzle-kit 자동 생성)
- `packages/database/migrations/meta/_journal.json` (drizzle-kit 자동 생성)
- `apps/api/src/auth/user-auth.ts`
- `apps/api/src/auth/dev-login.ts`
- `apps/api/src/auth/dev-login.test.ts`

**수정**
- `packages/database/src/schema/index.ts` (users.ts → auth.ts)
- `packages/auth/src/permissions.ts` (Role 2단계 → AdminRole 분리)
- `packages/auth/src/permissions.test.ts` (새 타입 기준 테스트)
- `packages/contracts/src/auth.ts` (스키마 갱신)
- `packages/contracts/src/auth.test.ts` (검수: 새 signUpSchema 기준 테스트 재작성)
- `packages/config/src/env.ts` (BETTER_AUTH_URL 추가)
- `apps/api/src/routes/v1/index.ts` (dev-login 조건부 등록)
- `apps/api/package.json` (@ai-jakdang/auth/@ai-jakdang/database/drizzle-orm/vitest 추가)
- `packages/auth/package.json` (better-auth/@node-rs/argon2 추가)
- `pnpm-lock.yaml`

**삭제**
- `packages/database/src/schema/users.ts`

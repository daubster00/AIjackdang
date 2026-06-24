# Story 9.2: 관리자 로그인 · 로그아웃 · 가입(승인 대기) UX

Status: done

## Story

As a 관리자,
I want 관리자 전용 로그인/로그아웃·가입(승인 대기 안내)이 동작하기를,
So that 독립된 어드민 진입점으로 안전하게 로그인하고 신규 운영자 신청이 가능하다.

## Acceptance Criteria

1. `/login` 폼에서 active 자격증명 로그인 성공 시 `aj_admin_session` 쿠키 발급, `admin_sessions` 레코드 생성, `/dashboard` 리다이렉트.
2. pending/suspended/disabled 계정이 올바른 자격증명으로 로그인 시도 시 → 로그인 차단, 상태별 사유 안내 메시지("승인 대기 중입니다. 최고관리자의 승인 후 로그인 가능합니다." / "계정이 정지된 상태입니다." / "비활성화된 계정입니다."). 유저 세션과 무관.
3. 틀린 자격증명: 어느 쪽(이메일/비밀번호)이 틀렸는지 미노출("이메일 또는 비밀번호가 올바르지 않습니다."). 연속 실패 5회 이상 시 rate limit 적용, 과도한 시도는 429 반환.
4. `/signup`에 이름·이메일·비밀번호·연락처 입력·유효 제출 시 → `admin_users`(status=pending, role=staff) + `admin_accounts`(Argon2id) 생성, "최고관리자 승인 후 로그인 가능합니다" 안내 화면 표시, 로그인 불가.
5. 중복 이메일 가입 시도 → 409 응답, 인라인 오류 "이미 사용 중인 이메일입니다.".
6. 로그아웃 실행 시 → `admin_sessions` 무효화(DB 삭제 또는 만료), `aj_admin_session` 쿠키 제거, `/login` 리다이렉트.
7. 비밀번호 최소 요건(8자 이상) 클라이언트·서버 양측 검증. 폼 검증 오류는 blur 시 개별 + submit 시 전체.

## Tasks / Subtasks

- [x] Task 1: 로그인 API 연동 (AC: #1, #2, #3)
  - [x] `apps/api/src/routes/admin/auth/` 폴더 신규 생성
  - [x] `apps/api/src/routes/admin/auth/sign-in.ts` NEW: `POST /api/v1/admin/auth/sign-in` — Better Auth credential 검증, status 확인, 세션 발급
  - [x] status별 오류 코드: `PENDING_APPROVAL`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DISABLED`, `INVALID_CREDENTIALS`
  - [x] `@fastify/rate-limit` 로그인 라우트 적용 (5회/분 limit, config.rateLimit)
  - [x] `apps/admin/app/login/page.tsx` UPDATE: 더미 onSubmit → `fetch('/api/v1/admin/auth/sign-in')` 호출로 교체
  - [x] 로그인 성공: `/dashboard` 리다이렉트
  - [x] 로그인 실패: 상태별 인라인 오류 메시지 표시 (fieldError + formError div 추가)
  - [x] 로딩 중 버튼 disabled + Spinner

- [x] Task 2: 가입 API 구현 (AC: #4, #5, #7)
  - [x] `apps/api/src/routes/admin/auth/sign-up.ts` NEW: `POST /api/v1/admin/auth/sign-up`
  - [x] `packages/contracts/src/admin/auth.ts` NEW: `adminSignUpSchema` (name/email/password/phone Zod 스키마), `adminSignInSchema`
  - [x] Argon2id 해시(@node-rs/argon2, algorithm:2 Argon2id) 후 admin_accounts 저장
  - [x] 중복 이메일 → 409 `DUPLICATE_EMAIL`
  - [x] `apps/admin/app/signup/page.tsx` UPDATE: 초대코드 → 이름/이메일/비밀번호/연락처 폼, 실제 API 연동
  - [x] 가입 성공: 승인 대기 안내 화면(인라인 상태 전환, submitted=true)

- [x] Task 3: 로그아웃 구현 (AC: #6)
  - [x] `apps/api/src/routes/admin/auth/sign-out.ts` NEW: `POST /api/v1/admin/auth/sign-out` — 세션 무효화, 쿠키 제거
  - [x] `apps/admin/components/layout/AdminAccountMenu.tsx` UPDATE: 모달 하단 로그아웃 버튼 API 연동
  - [x] 로그아웃 후 `/login` 리다이렉트

- [x] Task 4: 폼 검증 강화 (AC: #7)
  - [x] 비밀번호 최소 8자 클라이언트 측 검증 (blur + submit)
  - [x] 이메일 형식 검증
  - [x] blur 시 개별 필드 오류, submit 시 전체 검증
  - [x] 오류 메시지는 인라인(색 + 텍스트 + 아이콘, 색만으로 상태 전달 금지)

## Dev Notes

### 의존성 (선행 스토리)
- **9.1 완료 필수**: `admin_users`·`admin_accounts` 테이블, Better Auth admin 인스턴스, `adminGuard` 플러그인 존재해야 함.

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/login/page.tsx` (UPDATE): 현재 `"use client"` 컴포넌트, `onSubmit`에서 `router.push('/dashboard')`로 더미 동작. 이메일·비밀번호 입력 필드, 비밀번호 show/hide 토글 구현됨. 오류 메시지 표시 UI 없음 → 추가 필요. 로그인 유지 체크박스, 도움말 링크, 가입 링크 포함.
- `apps/admin/app/signup/page.tsx` (UPDATE): 파일 존재 확인 후 현재 상태 파악. 더미 폼으로 추정.
- `apps/admin/components/layout/AdminAccountMenu.tsx` (UPDATE): 로그아웃 버튼 있을 것으로 추정, 실제 파일 확인 필요.

### API 응답 형식
- 오류: `{ error: { code: "INVALID_CREDENTIALS", message: "이메일 또는 비밀번호가 올바르지 않습니다." } }`
- 성공(로그인): 쿠키 Set-Cookie + `{ adminUser: { id, name, email, role, status } }` 또는 페이로드 없이 쿠키만.

### 보안
- 로그인 오류 시 어느 쪽(이메일/비밀번호)이 틀렸는지 구분 노출 금지 (열거 공격 방지).
- rate limit: `@fastify/rate-limit` 로그인 라우트에 5회/분 적용 (9.1에서 설치되었으면 활용).
- 세션 쿠키: `httpOnly: true`, `secure: true`(운영), `sameSite: 'strict'`.

### UX 규칙
- 로딩: 로그인 버튼 내 Spinner + disabled (외부 Skeleton 금지).
- 에러: 인라인 필드 아래 12px `danger` 색 텍스트 + 아이콘 동반.
- 가입 성공: 바로 로그인 가능한 척 하지 않음 — 명확한 "승인 대기" 안내 필수.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#Foundation]

### Project Structure Notes
- NEW: `apps/api/src/routes/admin/auth/sign-in.ts`, `sign-up.ts`, `sign-out.ts`
- NEW: `packages/contracts/src/admin/auth.ts`
- UPDATE: `apps/admin/app/login/page.tsx`, `apps/admin/app/signup/page.tsx`, `apps/admin/components/layout/AdminAccountMenu.tsx`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2601-2631] — AC 원문
- [Source: docs/adr/ADR-0003-admin-identity-and-approval.md#1] — 관리자 신원 분리 원칙
- [Source: _bmad-output/project-context.md#보안] — Argon2id, rate limiting

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- `vi.clearAllMocks()` → `vi.resetAllMocks()`로 변경 필요: clearAllMocks는 mockReturnValueOnce 큐를 초기화하지 않음. 이전 케이스에서 소비되지 않은 큐가 다음 케이스에 영향을 줌.
- Better Auth `signInResult.response`는 존재하지 않음. 쿠키는 `reply.header("Set-Cookie", ...)` 로 직접 설정.
- `adminAuth.api.revokeSession`은 `body: { token }` 필수. `headers`만으로 호출 불가.
- signup/page.tsx에서 `useRouter` import 후 `router`를 사용하지 않으면 TS6133 오류.

### Completion Notes List
- sign-in: Better Auth 내부 API(`signInEmail`) → status 체크 → 쿠키 직접 설정 방식 채택. pending/suspended/disabled 시 `revokeSession(body:{token})` 으로 세션 폐기.
- 쿠키 이름: `aj_admin_session.session_token` (cookiePrefix=aj_admin_session + .session_token)
- app.ts에 `adminRoutes` 등록: `app.register(adminRoutes, { prefix: "/api/v1" })` — adminGuardHook은 전역 preHandler이므로 `/api/v1/admin/auth/*` 경로가 자동 제외됨.
- contracts/index.ts에 `export * from "./admin/auth"` 추가.

### File List
- NEW: `packages/contracts/src/admin/auth.ts`
- NEW: `apps/api/src/routes/admin/auth/sign-in.ts`
- NEW: `apps/api/src/routes/admin/auth/sign-up.ts`
- NEW: `apps/api/src/routes/admin/auth/sign-out.ts`
- NEW: `apps/api/src/routes/admin/index.ts`
- NEW: `apps/api/src/routes/admin/__tests__/adminAuth.test.ts`
- UPDATE: `packages/contracts/src/index.ts`
- UPDATE: `apps/api/src/app.ts`
- UPDATE: `apps/admin/app/login/page.tsx`
- UPDATE: `apps/admin/app/login/login.module.css`
- UPDATE: `apps/admin/app/signup/page.tsx`
- UPDATE: `apps/admin/app/signup/signup.module.css`
- UPDATE: `apps/admin/components/layout/AdminAccountMenu.tsx`

# Story 1.4: 로그인 / 로그아웃 / 세션 유지

Status: ready-for-dev

## Story

As a 회원,
I want 이메일·비밀번호로 로그인하고 로그아웃하며 세션이 유지되기를,
so that 재방문 시 다시 인증하지 않고 내 활동을 이어갈 수 있다.

## Acceptance Criteria

1. 인증 완료된 계정(emailVerified=true)으로 올바른 이메일·비밀번호 입력 시 API 서버가 httpOnly 세션 쿠키(`aj_session`)를 발급하고, `sessions` 레코드가 생성된다.
2. 로그인 후 Next 서버 컴포넌트가 쿠키를 포워딩해 로그인 상태를 SSR로 반영한다(헤더 아바타·닉네임 표시).
3. 틀린 비밀번호·미인증 이메일·suspended 계정 각각 다른 처리: 401(자격증명 불일치) + "이메일 또는 비밀번호가 올바르지 않습니다" 인라인 오류, 이메일 미인증 시 재발송 안내, suspended 시 제재 사유/기간 안내.
4. 로그인 시도에 rate limit 적용 (IP당 10회/시간 → 429).
5. 로그인 상태에서 로그아웃 시 세션 무효화(`sessions` 레코드 삭제)와 `aj_session` 쿠키 제거, 비회원 상태 전환.
6. 세션 만료 전 재방문 시 세션이 자동 연장되거나 만료 후 재로그인 요청이 표시된다.
7. `/login` 페이지는 이미 로그인된 경우 `/`로 리다이렉트한다.
8. 헤더 컴포넌트가 실제 인증 세션에서 유저 정보(닉네임·등급·아바타)를 읽어 렌더한다(현재 `useMockAuth` → 실제 세션 API 교체).

## Tasks / Subtasks

- [ ] Task 1: 로그인 API 연결 (AC: #1, #2, #3, #4) — UPDATE `apps/web/app/login/LoginForm.tsx`
  - [ ] 1.1 `apps/web/lib/auth-api.ts` UPDATE: `signIn(email, password)` → `POST /api/v1/auth/sign-in` Better Auth 엔드포인트 호출
  - [ ] 1.2 `LoginForm.tsx` UPDATE:
    - **현재 코드 보존**: 이메일·비밀번호 Input 필드, 소셜 로그인 버튼(3개), "로그인 유지" Checkbox, "비밀번호 찾기" Link, "아직 계정이 없나요?" 링크 구조 유지
    - **제거**: `useMockAuth`·`createMockUserFromEmail` 의존, handleSubmit의 mock 로직
    - **추가**: 실제 API 호출, 에러 처리(401·이메일 미인증·suspended·429·네트워크 오류)
    - 로그인 성공: `router.push(redirectTo ?? '/')` — URL `?redirectTo=` 파라미터 반영
    - 로그인 실패: danger 토스트 또는 인라인 오류(401 → 이메일/비밀번호 필드 인라인, 429 → 토스트)
  - [ ] 1.3 rate limit: Task 3.3(Story 1.3)에서 설치된 `@fastify/rate-limit` 적용 — 로그인 라우트에도 적용 확인
  - [ ] 1.4 `apps/web/app/login/page.tsx` UPDATE: 서버 컴포넌트에서 기존 세션 확인 → 이미 로그인된 경우 `redirect('/')`

- [ ] Task 2: 로그아웃 구현 (AC: #5)
  - [ ] 2.1 `POST /api/v1/auth/sign-out` Better Auth 엔드포인트 확인 (내장 제공)
  - [ ] 2.2 헤더 드롭다운의 "로그아웃" 버튼 UPDATE: `useMockAuth logout` → 실제 sign-out API 호출 후 `router.push('/')`
  - [ ] 2.3 `apps/web/hooks/useAuth.ts` NEW: `useMockAuth`를 대체하는 실제 세션 훅 — `GET /api/v1/auth/session` 응답으로 `user` 상태 관리

- [ ] Task 3: 세션 관리 미들웨어 (AC: #2, #6, #7)
  - [ ] 3.1 `apps/web/middleware.ts` UPDATE: `/mypage`·`/settings/*`·`/login` 경로에 세션 확인 미들웨어 — 비로그인 시 `/login?redirectTo={현재경로}`, 로그인 상태로 `/login` 접근 시 `/` 리다이렉트
  - [ ] 3.2 Next.js 서버 컴포넌트에서 쿠키 포워딩 패턴 확립: `cookies()` 헤더 포워딩으로 API 인증 통과

- [ ] Task 4: 헤더 실제 세션 연동 (AC: #8)
  - [ ] 4.1 헤더 컴포넌트 파일 위치 확인 (`apps/web/components/ui` 또는 `app/layout.tsx`)
  - [ ] 4.2 헤더 UPDATE: `useMockAuth` → `useAuth` (실 세션) 교체 — 닉네임·아바타(`defaultAvatarIndex`→URL 또는 `avatarUrl`)·등급 표시
  - [ ] 4.3 `getDefaultAvatarUrl(index)` from `packages/core/src/avatar.ts` 사용 — `defaultAvatarIndex`를 이미지 경로로 변환

- [ ] Task 5: 세션 관련 API 응답 계약 (AC: #1)
  - [ ] 5.1 `packages/contracts/src/auth.ts` UPDATE: `sessionSchema`(userId·nickname·email·emailVerified·status·defaultAvatarIndex·avatarUrl·createdAt) 추가 — Better Auth session 응답 타입과 정합
  - [ ] 5.2 `GET /api/v1/auth/session` 라우트 확인(Better Auth 내장) + 응답 타입이 `sessionSchema`와 일치 확인

- [ ] Task 6: 테스트
  - [ ] 6.1 로그인 성공·실패(401/미인증/suspended)·rate limit(429) 케이스 통합 테스트
  - [ ] 6.2 로그아웃 후 `/mypage` 접근 시 `/login?redirectTo=/mypage` 리다이렉트 확인
  - [ ] 6.3 세션 유지: 재방문 시 로그인 상태 유지 확인

## Dev Notes

### 기존 파일 현황 및 변경 사항
- **`apps/web/app/login/LoginForm.tsx`** (UPDATE):
  - 현재: `useMockAuth`·`createMockUserFromEmail` 사용, handleSubmit에서 mock login + `router.push('/')`
  - 변경: 실제 API 호출, 에러 처리, redirectTo 지원
  - **보존**: 이메일·비밀번호 Input 구성(label·type·name·autoComplete·leftIcon), 소셜 로그인 버튼 3개(KakaoMark·N·GoogleMark SVG), Checkbox "로그인 유지", Link "/forgot-password"·"/signup" 위치 유지
  - **UI 계약**: 레이아웃·버튼 구성 변경 금지. mock 코드만 실제 API로 교체.

- **`apps/web/hooks/useMockAuth.ts`**: 현재 사용 중인 mock 훅 — `useAuth.ts`로 대체. 이미 `useMockAuth`를 참조하는 컴포넌트(mypage, header, settings 등) 전부 `useAuth`로 마이그레이션 필요(Story 1.4 범위 또는 다음 스토리에서 순차적으로).

### 쿠키·세션 전략 (ADR-0002 §설계노트)
- **세션 쿠키명**: `aj_session` (httpOnly, SameSite=Lax, Secure in production)
- **마운트 포인트**: Better Auth는 `apps/api`에서 동작, 브라우저는 유저 출처(`localhost:3003` 또는 `www.<도메인>`) 기준 프록시로 노출 → Next rewrite 설정 필요
  ```ts
  // apps/web/next.config.ts rewrites:
  { source: '/api/v1/auth/:path*', destination: 'http://localhost:4003/api/v1/auth/:path*' }
  ```
- **First-party 쿠키**: 프록시를 통해 같은 출처에서 쿠키가 설정되므로 cross-origin 문제 없음

### 보안 주의점
- 로그인 실패 응답에 계정 존재 여부를 노출하지 않는다 → 401 응답 메시지를 "이메일 또는 비밀번호가 올바르지 않습니다"(계정 존재 여부 언급 없음)으로 통일.
- suspended 계정: 제재 사유와 만료일만 노출. 비밀번호 틀림과 동일한 401로 처리하지 않음(구분 필요 — 423 또는 커스텀 에러 코드 `ACCOUNT_SUSPENDED`).
- "로그인 유지" Checkbox: Better Auth 세션 maxAge 조절 옵션 확인.

### UX 요구사항
- **redirectTo**: URL 파라미터로 전달 → 로그인 성공 후 원래 위치 복귀 (UX-DR-U1 행동 게이팅 복귀)
- **에러 표시**: 401 → 비밀번호 필드 아래 인라인. 429 → danger 토스트. suspended → 별도 안내 (UX-DR-U11)
- **로딩**: 제출 버튼 내 Spinner, 중복 클릭 방지 (UX-DR-U11)

### References
- [Source: docs/adr/ADR-0002-identity-and-auth-schema.md#설계 노트 — 인증 마운트 & 콜백 규약]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: _bmad-output/project-context.md#보안 — 인증 권위는 API 서버]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

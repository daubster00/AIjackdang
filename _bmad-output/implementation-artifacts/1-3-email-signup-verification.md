# Story 1.3: 이메일 회원가입 + 이메일 인증

Status: ready-for-dev

## Story

As a 비회원,
I want 이메일·비밀번호로 가입하고 이메일 인증을 완료하기를,
so that AI작당의 회원이 되어 행동(작성·다운로드·반응)을 할 수 있다.

## Acceptance Criteria

1. `/signup` 화면에서 이메일·비밀번호·약관 동의(이용약관·개인정보보호방침 필수, 마케팅 선택)를 입력하면 가입이 제출된다. 닉네임 입력칸은 없다(시스템 자동배정).
2. 유효한 가입 제출 시 `accounts`(providerId='credential', Argon2id 해시)와 `users`(emailVerified=false, 시스템 자동배정 닉네임 + 랜덤 `defaultAvatarIndex`)가 생성되고, 인증 메일이 `email` BullMQ 큐(worker)로 발송되며, "인증 메일을 보냈어요" 안내가 표시된다.
3. 자동 닉네임 생성기(한국어 형용사+명사 단어 풀 + 숫자 접미)가 `packages/core/src/nickname.ts`에 구현된다. `users.nickname` UNIQUE 위반 시 숫자 접미를 바꿔 최대 10회 재시도, 모두 충돌하면 더 긴 숫자 fallback으로 반드시 유니크 값을 확정한다.
4. `defaultAvatarIndex`는 준비된 기본 이미지 N종 중 `crypto.randomInt(0, N)` 또는 카운터 기반으로 균등 배정된다(`Math.random` 미사용).
5. 발송된 인증 링크(`verifications` 토큰, 24시간 만료)를 클릭하면 `users.emailVerified=true`로 갱신되고 로그인 가능 상태가 된다. 만료·위조 토큰은 명확한 오류 + 재발송 안내를 보인다.
6. 이메일 중복은 409 + 인라인 오류, 일회용 이메일 도메인 차단 안내, 가입 rate limit 초과는 429로 거부된다. 닉네임은 시스템 생성이므로 사용자향 중복 오류 없음.
7. 약관 미동의 시 제출 버튼이 비활성(이용약관·개인정보 필수 체크 시만 활성). XSS 입력은 새니타이즈/거부된다.
8. 기본 프로필 이미지 원본 PNG(`public/images/avatars/` N종)는 256×256 WebP로 준비되어 있고, 코드는 `defaultAvatarIndex`로 `/images/avatars/{index}.webp` 경로를 해석한다.
9. `POST /api/v1/auth/sign-up` API 엔드포인트가 `packages/contracts/src/auth.ts`의 `signUpSchema`로 검증된다.

## Tasks / Subtasks

- [ ] Task 1: 자동 닉네임 생성기 구현 (AC: #3) — NEW in `packages/core`
  - [ ] 1.1 `packages/core/src/nickname.ts` NEW 생성:
    ```ts
    // ADJECTIVES: 한국어 형용사 50개 이상 (예: "빠른", "멋진", "신비로운", ...)
    // NOUNS: 한국어 명사 50개 이상 (예: "탐험가", "개발자", "작당원", ...)
    // generateNickname(): 형용사 + 명사 + 3자리 숫자 (예: "빠른탐험가042")
    // generateNicknameWithFallback(attempt: number): attempt > 10이면 더 긴 숫자 접미
    ```
  - [ ] 1.2 `packages/core/src/index.ts` UPDATE: `export * from './nickname'` 추가
  - [ ] 1.3 `packages/core/src/nickname.test.ts` NEW: 단위 테스트 — 충돌 시 재시도 로직, fallback, 형식 검증

- [ ] Task 2: 기본 프로필 이미지 자산 준비 (AC: #4, #8) — NEW
  - [ ] 2.1 `apps/web/public/images/avatars/` 디렉터리에 기본 아바타 이미지 8~12종을 `0.webp`~`N.webp`로 배치 (실제 이미지가 없으면 placeholder SVG로 대체 후 나중에 교체)
  - [ ] 2.2 `packages/core/src/avatar.ts` NEW: `DEFAULT_AVATAR_COUNT = N`, `getDefaultAvatarUrl(index: number): string` export
  - [ ] 2.3 `packages/core/src/index.ts` UPDATE: avatar export 추가

- [ ] Task 3: 가입 API 구현 (AC: #2, #3, #4, #6, #9) — NEW in `apps/api`
  - [ ] 3.1 `apps/api/src/routes/v1/auth/sign-up.ts` NEW 생성 (Better Auth가 내장 회원가입 엔드포인트 제공 여부 확인 후, 커스텀 로직을 Better Auth 훅/플러그인으로 연결):
    - 입력: `signUpSchema`(`email`·`password`·`termsAgreed`)
    - 자동 닉네임: `generateNickname()` → DB insert 시도 → UNIQUE 오류 시 최대 10회 재시도
    - `defaultAvatarIndex`: `crypto.randomInt(0, DEFAULT_AVATAR_COUNT)`
    - `termsAgreedAt`: 현재 UTC, `termsVersion`: '2026-06' 상수
    - Better Auth `emailAndPassword.signUp` 호출 or 커스텀 핸들러
    - 성공 시: `email` 큐에 `email.send` job 발행(인증 메일 전송)
    - 응답: 201 + `{ message: "인증 메일을 보냈어요. 메일함을 확인해 주세요." }`
  - [ ] 3.2 `apps/api/src/services/auth/sign-up.service.ts` NEW: DB 트랜잭션 service 레이어(닉네임 생성·users 삽입·accounts 삽입)
  - [ ] 3.3 `@fastify/rate-limit` 설치 + `apps/api/src/app.ts` UPDATE: 가입 라우트 rate limit 적용 (IP당 10회/시간)
  - [ ] 3.4 일회용 이메일 도메인 차단 리스트(`packages/core/src/disposable-emails.ts` NEW): blocklist 배열 + `isDisposableEmail(email: string): boolean`

- [ ] Task 4: 이메일 인증 플로우 구현 (AC: #5) — NEW
  - [ ] 4.1 Better Auth `emailVerification` 설정 확인 — `sendVerificationEmail` 훅에서 `email` BullMQ 큐 발행
  - [ ] 4.2 `GET /api/v1/auth/verify-email?token=` 라우트: `verifications` 토큰 확인 → `users.emailVerified=true` 업데이트 → 만료/위조 시 400 `{ error: { code: 'INVALID_TOKEN', message: '인증 링크가 만료됐거나 유효하지 않습니다.' } }`
  - [ ] 4.3 인증 완료 후 `/signup/verified` 리다이렉트 또는 성공 메시지 표시

- [ ] Task 5: `apps/web` 가입 폼 실제 API 연결 (AC: #1, #7) — UPDATE `apps/web/app/signup/SignupForm.tsx`
  - [ ] 5.1 `SignupForm.tsx` UPDATE: 현재 mock 상태 → 실제 `POST /api/v1/auth/sign-up` 호출
    - **현재 코드 보존**: 소셜/이메일 탭(role=tablist), 3개 소셜 버튼, AgreementPanel 구조 유지
    - **제거**: 휴대전화 번호·이름·성별·생년월일·주소 선택 필드(FR-1.1 확인 — 불필요한 개인정보 수집 최소화)
    - **유지**: 이메일·비밀번호 필드, AgreementPanel(terms·privacy 필수, marketing 선택)
    - 폼 검증: blur 시 개별 + submit 시 전체(UX-DR 에러 표시 규칙)
    - 제출 버튼: terms·privacy 미체크 시 disabled
    - 제출 성공: "인증 메일을 보냈어요" 안내 화면 전환
    - 제출 실패: 409(이메일 중복)→ 이메일 필드 인라인 오류, 429 → danger 토스트
  - [ ] 5.2 `apps/web/lib/api.ts` 또는 `apps/web/lib/auth-api.ts` NEW: `signUp(input)` fetch 헬퍼 (Next의 쿠키 포워딩 포함)
  - [ ] 5.3 이메일 인증 완료 페이지 `apps/web/app/signup/verified/page.tsx` NEW: "이메일 인증이 완료됐습니다. 로그인해 주세요." + 로그인 링크

- [ ] Task 6: BullMQ email worker 골격 (AC: #2) — NEW in `apps/worker`
  - [ ] 6.1 `apps/worker/src/queues/email.ts` NEW: BullMQ Worker(`email` 큐, `email.send` job 핸들러 골격 — 실 이메일 발송은 nodemailer/Resend 연동)
  - [ ] 6.2 `packages/contracts/src/jobs/email.ts` NEW: `EmailSendPayload` Zod 스키마(to·subject·templateId·variables)
  - [ ] 6.3 `apps/worker/src/index.ts` UPDATE: email worker 등록

- [ ] Task 7: 테스트 (AC: 전반)
  - [ ] 7.1 `packages/core/src/nickname.test.ts`: 생성기 형식, 재시도 로직
  - [ ] 7.2 `apps/api` 가입 엔드포인트 통합 테스트: 정상가입, 이메일 중복(409), 일회용 도메인 차단, rate limit(429)

## Dev Notes

### 기존 파일 현황 및 변경 사항
- **`apps/web/app/signup/SignupForm.tsx`** (UPDATE — 부분):
  - 현재: 소셜/이메일 탭, 휴대전화·이름·성별·생년월일·주소 선택 필드 포함 (mock)
  - 변경: 불필요 필드 제거(개인정보 최소 수집), 실제 API 연결
  - **보존**: 소셜/이메일 tablist 구조, AgreementPanel(terms·privacy·marketing 3항목·전체동의), 소셜 3개 버튼 구조(로직은 Story 1.5에서 연결), 비밀번호 `autoComplete="new-password"`
  - **UI 계약 불변**: 탭 구조·레이아웃·버튼 구성 변경 금지. 데이터 연결만.
- **`packages/utilities/src/string.ts`**: 기존 `slugify` 존재 — slug용은 재사용. 닉네임 생성은 `packages/core`에 별도 구현.
- **`packages/contracts/src/auth.ts`**: Story 1.2에서 갱신된 `signUpSchema`(nickname 제거) 사용.

### 도메인 로직 위치 규칙
- 닉네임 생성 순수 함수: `packages/core/src/nickname.ts` (서버/클라이언트 공유 가능)
- DB 트랜잭션: `apps/api/src/services/auth/sign-up.service.ts` (service 레이어에서만)
- 큐 발행: service 레이어 또는 route handler에서 직접 (BullMQ Queue 인스턴스)

### 보안 주의점
- Argon2id 해시: Better Auth 내장 또는 `@node-rs/argon2`(권장, 네이티브 바인딩 성능). 평문 저장 절대 금지.
- `email` 필드 입력: trim + lowercase 정규화 후 저장.
- 일회용 이메일 도메인 차단: 가입 시 서버 사이드에서 검증(클라이언트 검증 우회 가능성).
- XSS: 사용자 입력은 Zod 스키마로 형식 검증. 본문 저장 시 `sanitize-html` 적용(에디터 콘텐츠는 Epic 2에서).

### UX 요구사항 (UX-DR)
- **UX-DR-U11**: 제출 실패 = danger 토스트(서버 오류) + 인라인(폼 필드 귀속 오류), 입력 유지
- **UX-DR-U15**: 가입 완료 안내 = "인증 메일을 보냈어요" (차분한 실전 동료 톤, 압박 없음)
- **폼 검증 타이밍**: blur 시 개별 필드(이메일 형식·비밀번호 길이) + submit 시 전체

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: docs/adr/ADR-0002-identity-and-auth-schema.md#1. 신원·다계정 정책]
- [Source: _bmad-output/project-context.md#통신 패턴 — BullMQ]
- [Source: _bmad-output/project-context.md#보안]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

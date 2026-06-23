# Story 1.6: 비밀번호 재설정 (분실)

Status: ready-for-dev

## Story

As a 비밀번호를 잊은 회원,
I want 이메일로 재설정 링크를 받아 새 비밀번호를 설정하기를,
so that 계정 접근을 다시 확보한다.

## Acceptance Criteria

1. `/forgot-password` 화면에서 이메일 입력 후 제출 시 계정 존재 여부를 노출하지 않는 동일 응답("입력하신 이메일로 재설정 안내를 보냈어요. 메일함을 확인해 주세요.")을 주고, 계정이 존재 시 `verifications` 토큰으로 재설정 메일을 `email` BullMQ 큐로 발송한다.
2. 재설정 링크(`/reset-password?token=XXX`)에서 새 비밀번호 입력·제출 시 `accounts.password`가 새 Argon2id 해시로 갱신되고, 기존 세션이 무효화(`sessions` 레코드 전부 삭제)되며 로그인 화면으로 안내된다.
3. 만료(1시간) 또는 재사용 토큰은 400 오류 + 재발송 버튼을 보인다.
4. 재설정 요청 rate limit: IP당 5회/시간 (429).
5. 새 비밀번호 최소 8자 이상 검증 후 입력 미달 시 인라인 오류.
6. `apps/web/app/forgot-password/ForgotPasswordForm.tsx`의 현재 UI(3단계: identity→verify→complete) 구조를 이메일 전용 재설정 플로우(1단계 이메일 입력 → 완료 안내)로 수정한다 — 현재 UI가 휴대전화 인증번호 방식이나 FR-1.4는 이메일 재설정 링크 방식.

## Tasks / Subtasks

- [ ] Task 1: `/forgot-password` UI 수정 (AC: #1, #6) — UPDATE `apps/web/app/forgot-password/ForgotPasswordForm.tsx`
  - [ ] 1.1 `ForgotPasswordForm.tsx` UPDATE:
    - **현재 UI 분석**: 현재 코드는 3단계(identity: 이메일+휴대전화 → verify: 인증번호 → complete: 완료). FR-1.4 재확인 결과 → **이메일 재설정 링크 방식**이 명시됨(휴대전화 인증번호 미도입, ADR-0002 §휴대폰 본인인증 비도입)
    - **변경**: 2단계로 단순화 (step: 'email' | 'sent')
      - `email` 단계: 이메일 입력 + "재설정 링크 받기" 버튼
      - `sent` 단계: "입력하신 이메일로 재설정 안내를 보냈어요" 완료 화면 + 재발송 버튼
    - **보존**: 전체 페이지 레이아웃(`styles.page`·`styles.authSection`·`styles.shell`·`styles.formPanel`), "로그인으로 돌아가기" 링크, `h1` 제목, 상태 배지 패턴
    - **제거**: `phone` 입력 필드, `code` 입력 필드, "인증번호 문자로 받기" 버튼, "정보 수정"/"인증 확인" 버튼 그룹
    - 제출 성공: step='sent' 전환 (API 성공/실패 무관 — 계정 존재 여부 노출 금지)
    - 제출 실패(네트워크 오류): danger 토스트 + 입력 유지
  - [ ] 1.2 실제 API 호출 추가: `POST /api/v1/auth/forgot-password` (또는 Better Auth 내장 엔드포인트)

- [ ] Task 2: `/reset-password` 페이지 신규 생성 (AC: #2, #3, #5) — NEW
  - [ ] 2.1 `apps/web/app/reset-password/page.tsx` NEW 서버 컴포넌트:
    - URL `?token=` 파라미터 존재 여부 확인 → 없으면 `/forgot-password`로 리다이렉트
  - [ ] 2.2 `apps/web/app/reset-password/ResetPasswordForm.tsx` NEW 클라이언트 컴포넌트:
    - "새 비밀번호" + "새 비밀번호 확인" 두 Input 필드
    - 최소 8자 blur 시 인라인 검증, 불일치 인라인 오류
    - 제출 → `POST /api/v1/auth/reset-password` with `{ token, newPassword }`
    - 성공: "비밀번호가 변경됐어요. 다시 로그인해 주세요." + 로그인 링크
    - 실패(만료/재사용): 400 → "링크가 만료됐거나 이미 사용됐어요." + 재발송 버튼(`/forgot-password` 링크)

- [ ] Task 3: 비밀번호 재설정 API (AC: #1, #2, #3, #4) — UPDATE/NEW in `apps/api`
  - [ ] 3.1 Better Auth `emailAndPassword.resetPassword` 내장 기능 확인 — 존재하면 활용, 없으면 커스텀 구현
  - [ ] 3.2 커스텀 구현 시:
    - `POST /api/v1/auth/forgot-password`: 이메일 조회 → 토큰 생성(crypto.randomBytes(32).toString('hex')) → `verifications` 삽입(1시간 만료) → `email` 큐 발행 → 항상 동일 200 응답
    - `POST /api/v1/auth/reset-password`: 토큰 조회 → 만료/재사용 체크 → `accounts.password` Argon2id 재해시 → `sessions` 전부 삭제(세션 무효화) → `verifications` 토큰 삭제 → 200
  - [ ] 3.3 rate limit: IP당 5회/시간 (forgot-password 라우트)
  - [ ] 3.4 `packages/contracts/src/auth.ts` UPDATE: `forgotPasswordSchema`·`resetPasswordSchema` 추가

- [ ] Task 4: 이메일 템플릿 골격 (AC: #1) — NEW in `apps/worker`
  - [ ] 4.1 `apps/worker/src/templates/reset-password.ts` NEW: 재설정 링크 이메일 템플릿 (HTML 간단 버전)
  - [ ] 4.2 email worker(`apps/worker/src/queues/email.ts`)에서 `templateId='reset-password'` job 처리

## Dev Notes

### 기존 파일 현황 및 변경 사항
- **`apps/web/app/forgot-password/ForgotPasswordForm.tsx`** (UPDATE):
  - 현재: 3단계 플로우(이메일+휴대전화 → 인증번호 → 완료). 휴대전화·인증번호 필드 포함.
  - 변경: 2단계로 단순화(이메일 → 완료 안내). FR-1.4 + ADR-0002 §휴대폰 본인인증 비도입 근거.
  - **보존**: 전체 레이아웃 구조(`shell`·`formPanel`·`backLink`), h1 제목, 상태 배지 패턴, Icon 사용 패턴
  - **제거**: `phone` state, `code` state, `setStep("verify")` 로직, `verify` 단계 전체 JSX, `phone` Input 필드
  - **이 변경은 UI 계약 변경**이지만 현행 UI가 FR-1.4(이메일 재설정 링크) 명세와 불일치하므로 수정이 정당함. dev 에이전트는 이를 명시적으로 사용자 승인 없이 수행.
- **`apps/web/app/reset-password/`**: 현재 없음 → NEW.

### 보안 주의점
- **계정 존재 노출 금지**: forgot-password API는 계정 존재 여부와 무관하게 항상 동일한 200 응답. 공격자가 이메일 유효성 탐지 못하게.
- **토큰 만료**: `verifications.expiresAt` 1시간, 사용 후 즉시 삭제(재사용 방지).
- **세션 무효화**: 비밀번호 재설정 시 기존 모든 세션(`sessions` WHERE userId) 삭제 → 기존 공격자 세션 무효화.
- **Argon2id 재해시**: 새 비밀번호를 Argon2id로 해시 후 `accounts.password` 업데이트.

### UX 요구사항
- **UX-DR-U15**: "입력하신 이메일로 재설정 안내를 보냈어요" (차분한 톤, 확실한 정보 없이 안심 유도)
- 재설정 완료 후 로그인 페이지로 이동 → "비밀번호가 변경됐어요. 다시 로그인해 주세요." 토스트(성공 메시지)

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6]
- [Source: docs/adr/ADR-0002-identity-and-auth-schema.md#1. 신원·다계정 정책 — 휴대폰 본인인증 비도입]
- [Source: _bmad-output/project-context.md#보안]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

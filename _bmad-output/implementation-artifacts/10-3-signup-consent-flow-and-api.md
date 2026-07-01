# Story 10.3: 가입 시 약관 동의 흐름 + 동의 기록 API

Status: done

## Story

As a 가입 시도 비회원,
I want 가입 폼에서 이용약관·개인정보처리방침에 동의하고 가입을 완료하기를,
so that 동의 사실이 기록되고 동의 없이는 가입이 진행되지 않아 법적 근거가 확보된다.

## Acceptance Criteria

1. `/signup`의 `SignupForm`(이미 구현된 `AgreementPanel` 컴포넌트)에서 이용약관·개인정보처리방침 링크가 현재의 `/terms`, `/privacy`(href 미연결 상태)에서 `target="_blank" rel="noopener noreferrer"`를 적용한 `/terms`, `/privacy`로 정상 연결된다. 운영정책(마케팅 항목) 체크박스 링크도 `/operation-policy`로 연결된다.
2. 기존 `AgreementPanel`의 `agreements.terms`·`agreements.privacy` 두 항목이 미체크 상태일 때 가입 버튼이 비활성(`disabled`)되거나 submit 시 인라인 오류가 표시된다(UX-DR — 색만으로 상태 전달 금지, 아이콘·텍스트 동반).
3. `POST /api/v1/auth/sign-up` API가 `termsAgreed: false` 또는 누락 시 HTTP 422와 `{ error: { code: 'TERMS_NOT_AGREED', message: '이용약관 및 개인정보처리방침 동의가 필요합니다.' } }`를 반환한다.
4. 유효한 정보 + `termsAgreed: true` 제출 시, 가입 service가 `db.transaction()` 내에서 `users.terms_agreed_at = NOW()`, `users.terms_version = CURRENT_TERMS_VERSION`을 함께 저장한다. DB 조회 시 두 컬럼이 null이 아니다.
5. `terms` 컬럼이 null인 기존 레코드(마이그레이션 전/비정상)가 있어도 API는 정상 처리한다(재동의 강제는 이 스토리 범위 밖).
6. 체크박스 접근성: `<input type="checkbox">` 기반, Space 키로 토글, `<label>`의 `for`/`id` 연결, 링크 텍스트가 키보드·스크린리더로 식별 가능하다(UX-DR-U13).
7. `SignupForm`의 `EmailSignup` 폼 submit 시 `termsAgreed: true` 값이 API 요청 body에 포함된다(현재 `<form>` submit은 미연결 상태 — 이 스토리에서 API 연결).
8. **소셜 가입 약관 동의 스텝 유지**: 소셜 로그인(카카오/네이버/Google)으로 최초 가입 시에도 AI작당 서비스 이용약관·개인정보처리방침 동의를 **별도로** 받아야 한다. 소셜 제공자의 OAuth 동의와 별개로, 소셜 가입 완료 직후 약관 동의 스텝(`SocialSignup` 탭 하단 `AgreementPanel`)이 작동하여 동의 없이는 서비스 이용이 불가하다. 이 스텝을 생략하거나 자동 체크 처리 금지.

## Tasks / Subtasks

- [ ] Task 1: `SignupForm`의 약관 링크 경로 수정 (AC: #1, #6)
  - [ ] `apps/web/app/signup/SignupForm.tsx` UPDATE
    - `AgreementPanel` 내부의 `<Link href="/terms">보기</Link>` → `<Link href="/terms" target="_blank" rel="noopener noreferrer">보기</Link>` (현재 href="/terms"이나 target/rel 미적용 상태이면 속성 추가; href 자체는 이미 "/terms"이므로 라우트 변경 불필요)
    - `<Link href="/privacy">보기</Link>` → `<Link href="/privacy" target="_blank" rel="noopener noreferrer">보기</Link>` (동일)
    - 마케팅(운영정책) 항목: 현재 `<span>선택</span>` 뒤에 링크 없음 → `<Link href="/operation-policy" target="_blank" rel="noopener noreferrer">보기</Link>` 추가
    - Checkbox `name="terms"`, `name="privacy"` 는 이미 `<label>` 래퍼(Checkbox 컴포넌트) 방식이므로 `for`/`id` 연결은 `Checkbox` 컴포넌트 내부 구현에 위임 — Checkbox 컴포넌트가 `id` 자동 부여하는지 확인 후, 필요 시 `id` prop 전달
    - 보존: `agreements` state, `updateAll`, `updateAgreement` 로직, `compact` prop, 기존 UI 구조 전혀 변경하지 않음

  > **현재 코드 실측**: `SignupForm.tsx` 182행 `<Link href="/terms">보기</Link>`, 188행 `<Link href="/privacy">보기</Link>`. href 경로는 이미 `/terms`·`/privacy`로 올바르나, `target="_blank" rel="noopener noreferrer"` 속성이 없으므로 추가. 운영정책 링크(`/operation-policy`)는 신규 추가.

- [ ] Task 2: 필수 동의 미체크 시 버튼 비활성 로직 추가 (AC: #2)
  - [ ] `apps/web/app/signup/SignupForm.tsx` UPDATE — `EmailSignup` 내부에 `AgreementPanel`이 상태를 위로 공유할 방법 필요:
    - `EmailSignup`을 refactor: `AgreementPanel`의 `agreements` state를 `EmailSignup` 또는 `SignupForm` 레벨로 끌어올려 `canSubmit = agreements.terms && agreements.privacy` 계산
    - `<Button type="submit" ... disabled={!canSubmit}>이메일로 가입</Button>` 적용
    - 소셜 탭의 `SocialSignup`도 동일하게 `AgreementPanel`에서 `terms && privacy` 만족 시에만 소셜 버튼 활성 (또는 클릭 시 인라인 안내) — **소셜 가입 동의 스텝은 반드시 유지**, 자동 통과 처리 금지
    - **UI 계약 준수**: 기존 버튼 텍스트(`이메일로 가입`), 아이콘(`arrow-right-line`), size, fullWidth 속성 변경 금지
  - [ ] `disabled` 상태 시각: CSS `opacity`, `cursor: not-allowed` — 기존 `Button` 컴포넌트의 disabled 스타일 그대로 사용(추가 CSS 금지)

- [ ] Task 3: API 라우트 — 가입 엔드포인트 구현 (AC: #3, #4, #5)
  - [ ] `apps/api/src/routes/v1/auth/sign-up.ts` NEW — 실제 가입 로직:
    ```
    POST /api/v1/auth/sign-up
    body: signUpSchema (termsAgreed: z.literal(true) 포함, contracts에서 import)
    ```
    - `termsAgreed` 검증: Zod `z.literal(true)`가 body 스키마에 포함되므로 자동 422. 명시적 체크 불필요하나, 서비스 레이어에서 이중 방어: `if (!body.termsAgreed) return 422 TERMS_NOT_AGREED`
    - DB 삽입: `db.transaction()` 내 `INSERT INTO users` — `termsAgreedAt: new Date()`, `termsVersion: CURRENT_TERMS_VERSION` 포함
    - `CURRENT_TERMS_VERSION`은 `@ai-jakdang/core`에서 import
    - 비밀번호 해시: `Argon2id` (`argon2` 패키지 — 미설치 시 이 스토리에서 설치)
    - 닉네임 중복: `409 NICKNAME_TAKEN`
    - 이메일 중복: `409 EMAIL_TAKEN`
    - 성공 응답: `201 { id, email, nickname, termsAgreedAt, termsVersion, createdAt }` (publicUserSchema 기반)
  - [ ] `apps/api/src/routes/v1/auth/sign-up.ts` 내 service 레이어를 `apps/api/src/routes/v1/auth/service.ts`로 분리(트랜잭션은 service에서만, route handler에서 직접 db 호출 금지)
  - [ ] `apps/api/src/routes/v1/index.ts` UPDATE — 현재 placeholder sign-up 핸들러를 실제 라우트로 교체(또는 별도 파일로 분리 후 register)

- [ ] Task 4: `SignupForm` → API 연결 (AC: #7)
  - [ ] `apps/web/app/signup/SignupForm.tsx` UPDATE — `EmailSignup` form의 `onSubmit` 핸들러 구현:
    - `FormData` 또는 controlled input에서 `email`, `password`, `termsAgreed: true` 추출
    - `fetch('/api/v1/auth/sign-up', { method: 'POST', body: JSON.stringify({ email, password, nickname: ..., termsAgreed: true }) })` (Next.js App Router 방식, 쿠키 포워딩은 서버 컴포넌트에서 — 클라이언트 submit이므로 직접 fetch)
    - 성공: 홈(또는 redirectTo 쿼리파라미터 대상)으로 이동
    - 실패 422: 인라인 오류(아이콘+텍스트, 색만으로 상태 전달 금지)
    - 실패 409: 닉네임/이메일 중복 인라인 오류
    - 로딩 중: submit 버튼 내 `Spinner` 표시 (기존 `Spinner` 컴포넌트 `apps/web/components/ui/Spinner/`)
    - **주의**: 현재 `SignupForm`에 닉네임 입력칸이 없음(epics.md AC §1.3: 닉네임 입력칸 없음). `nickname`은 이메일 앞 부분 자동 생성 또는 API에서 기본값 처리. 착수 전 Story 1.x 완료 내용 확인하여 기존 닉네임 처리 방식 일치.

- [ ] Task 5: 접근성 검증 (AC: #6)
  - [ ] `Checkbox` 컴포넌트(`apps/web/components/ui/Checkbox/Checkbox.tsx`) 확인 — `id` 자동 부여 또는 prop 수신 여부 확인. `for`/`id` 연결 미흡 시 Checkbox 컴포넌트에 `id` prop 전달하여 `<label htmlFor={id}>`·`<input id={id}>` 연결
  - [ ] 키보드 탐색: Tab으로 체크박스·링크 순서 이동, Space로 체크박스 토글, Enter로 링크 이동 확인

## Dev Notes

### 아키텍처 패턴
- **트랜잭션 레이어**: `db.transaction()`은 `apps/api/src/routes/v1/auth/service.ts`(service 레이어)에서만. route handler에서 직접 `db` 호출 금지. [Source: project-context.md#패키지 경계]
- **contracts 재사용**: `signUpSchema`(termsAgreed 포함)를 API body 검증에 그대로 사용 — `fastify-type-provider-zod`가 자동 422 반환. 로컬 스키마 정의 금지. [Source: project-context.md#타입·검증]
- **보안 — Argon2id**: 비밀번호는 반드시 Argon2id. `argon2` npm 패키지 미설치 시 이 스토리에서 설치. 평문/가역 암호화 절대 금지. [Source: project-context.md#보안]
- **오류 응답 형식**: `{ error: { code: 'TERMS_NOT_AGREED', message: '...(한국어)' } }`. code=UPPER_SNAKE. [Source: project-context.md#응답 & 데이터 포맷]
- **클라이언트 오류 표시**: 인라인 오류(필드 귀속) — 필드 아래 13px, `--color-danger`, 아이콘+텍스트 동반(색만으로 전달 금지). 로딩 중 = Spinner 버튼 내. [Source: project-context.md#UX / 에러 처리]

### 소셜 가입 약관 동의 스텝 유지 방침
소셜 OAuth(카카오/네이버/Google)는 해당 제공자의 약관 동의를 받지만, **AI작당 서비스 자체의 이용약관·개인정보처리방침 동의는 별도로 수집해야 한다** (PIPA 요건). 따라서:
- `SocialSignup` 탭 하단의 `AgreementPanel compact` 는 유지하고 작동해야 함.
- 소셜 버튼 클릭 시 `terms && privacy` 미체크라면 버튼 비활성 또는 인라인 안내 표시.
- 소셜 OAuth 완료 후 콜백에서 약관 동의 상태를 서버로 전달하거나, 최초 소셜 로그인 후 약관 동의 스텝 페이지로 리다이렉트하는 방식으로 처리. 자동 `termsAgreed: true` 처리 금지.
- Epic 1.5(소셜 가입 구현) 착수 시 이 방침을 반드시 준수. 이 스토리(10.3)는 이메일 가입 API 연결이 주이나, 소셜 동의 UI는 손대지 않고 보존.

### 수정 대상 파일 현황
- **`apps/web/app/signup/SignupForm.tsx`** (UPDATE):
  - 현재 상태(실측): 182행 `<Link href="/terms">보기</Link>`, 188행 `<Link href="/privacy">보기</Link>` — href는 올바르나 `target="_blank" rel="noopener noreferrer"` 없음. 운영정책(`/operation-policy`) 링크 없음. `AgreementPanel`이 자체 `agreements` state를 보유. `EmailSignup` form에 `onSubmit` 핸들러 없음(미연결). `SocialSignup`은 `AgreementPanel compact` 사용(보존 필수).
  - 변경: target/rel 속성 추가. `/operation-policy` 링크 추가. state 끌어올리기. submit 핸들러 연결.
  - 보존: 소셜/이메일 탭 전환(`method` state), UI 구조(methodTabs, socialGrid, fieldGroup, optionalBlock), 소셜 버튼 3개, KakaoMark/GoogleMark SVG 컴포넌트, 기존 Input 필드들(이메일/비밀번호/전화번호/선택정보). `SocialSignup` 하단 `AgreementPanel compact` **반드시 유지**.

- **`apps/api/src/routes/v1/index.ts`** (UPDATE):
  - 현재: sign-up placeholder(501 NOT_IMPLEMENTED). `/auth/me` placeholder(401 UNAUTHORIZED).
  - 변경: sign-up placeholder → 실제 구현(별도 파일 분리 후 연결).
  - 보존: `/auth/me` 엔드포인트 구조.

### `CURRENT_TERMS_VERSION` import 경로
```ts
// apps/api/src/routes/v1/auth/service.ts
import { CURRENT_TERMS_VERSION } from '@ai-jakdang/core';
// apps/web/app/signup/SignupForm.tsx (필요 시)
import { CURRENT_TERMS_VERSION } from '@ai-jakdang/core';
```

### 에러 코드 목록 (이 스토리 신규)
| 상황 | HTTP | code |
|---|---|---|
| termsAgreed false/누락 | 422 | TERMS_NOT_AGREED |
| 이메일 중복 | 409 | EMAIL_TAKEN |
| 닉네임 중복 | 409 | NICKNAME_TAKEN |
| 검증 오류 기타 | 422 | VALIDATION_ERROR |

### 접근성 (UX-DR-U13)
- 체크박스: `<input type="checkbox" id="terms" name="terms">` + `<label htmlFor="terms">`. Space 토글.
- 링크: `<Link href="/terms" target="_blank" rel="noopener noreferrer">이용약관 보기</Link>` — 링크 텍스트가 의미를 담아야 함("보기"만으로는 맥락 부족 → aria-label 또는 시각적으로 앞 체크박스 텍스트와 연결).
- 색 단독 오류 표시 금지: 오류 메시지는 `<Icon name="error-warning-line" />` + 텍스트.

### 테스트
- `apps/api/src/routes/v1/auth/sign-up.test.ts` (NEW, Vitest):
  - `termsAgreed: false` → 422
  - `termsAgreed: true` + 유효 입력 → 201, DB에 `terms_agreed_at` not null
  - 이메일 중복 → 409
- `SignupForm.test.tsx` (선택): 필수 체크박스 미체크 시 버튼 disabled 확인.

### Project Structure Notes
- API 라우트 파일 구조:
  ```
  apps/api/src/routes/v1/
    auth/
      sign-up.ts   ← route 정의
      service.ts   ← 트랜잭션 포함 service 함수
    index.ts       ← UPDATE (sign-up 라우트 등록)
  ```
- `apps/web/app/signup/`에 `SignupForm.tsx` 이미 존재 — 새 파일 생성 불필요.

### References
- [Source: epics.md#Story 10.3 AC]
- [Source: apps/web/app/signup/SignupForm.tsx — 현재 상태 (실측: 182행 href="/terms", 188행 href="/privacy", SocialSignup compact AgreementPanel 유지)]
- [Source: apps/api/src/routes/v1/index.ts — 현재 상태]
- [Source: packages/contracts/src/auth.ts — signUpSchema]
- [Source: project-context.md#보안, UX/에러처리, 패키지 경계]
- [Source: architecture.md#Authentication & Security — Argon2id]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-2026-06-17/EXPERIENCE.md#접근성]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

- UPDATE `apps/web/app/signup/SignupForm.tsx`
- NEW `apps/api/src/routes/v1/auth/sign-up.ts`
- NEW `apps/api/src/routes/v1/auth/service.ts`
- UPDATE `apps/api/src/routes/v1/index.ts`

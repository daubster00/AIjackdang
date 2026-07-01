# Story 10.4: 약관 버전 변경 대응

Status: done

## Story

As a 운영자,
I want 약관 개정 시 버전 상수를 올리고 기존 회원에게 재동의를 안내할 기반이 있기를,
so that 중요 변경 시 정보주체에게 통보·재동의를 받는 경로가 확보된다.

## Acceptance Criteria

1. `CURRENT_TERMS_VERSION` 상수(`packages/core/src/legal.ts`)를 변경·배포하면 `/terms`·`/privacy`·`/operation-policy` 페이지의 버전 표기가 자동으로 반영된다(버전 컴포넌트가 상수를 import — 하드코딩 없음).
2. 세션 응답(`GET /api/v1/auth/me`) 에서 `users.terms_version != CURRENT_TERMS_VERSION`인 회원은 `termsUpdateRequired: true`를 포함하여 반환한다. 클라이언트가 이 신호로 재동의 배너/모달을 표시할 수 있다. 행동 전면 차단은 이 스토리 범위 밖.
3. `POST /api/v1/users/me/terms-consent` 호출 시 `users.terms_agreed_at = NOW()`, `users.terms_version = CURRENT_TERMS_VERSION`으로 갱신되며, 이후 `GET /api/v1/auth/me` 응답에서 `termsUpdateRequired: false`가 된다.
4. 버전 변경이 없는 상태에서 신규 가입하면 `termsUpdateRequired: false`가 되어 재동의 흐름이 발생하지 않는다(회귀 방지).
5. 소셜 최초 가입(Epic 1.5 흐름)에서도 동의 완료 후 `terms_agreed_at`·`terms_version`이 기록되고, `termsUpdateRequired` 판단이 이메일 가입과 동등하게 적용된다.

## Tasks / Subtasks

- [ ] Task 1: `/terms`·`/privacy`·`/operation-policy` 페이지 버전 상수 참조 검증 (AC: #1)
  - [ ] Story 10.1에서 생성한 `apps/web/app/(legal)/_content/terms.ts`, `privacy.ts`, `operation-policy.ts` 파일이 `CURRENT_TERMS_VERSION`을 `@ai-jakdang/core`에서 import하고 있는지 확인
  - [ ] 현재 `TERMS_VERSION = '0.1'` 같은 로컬 상수로 하드코딩했다면 → `import { CURRENT_TERMS_VERSION } from '@ai-jakdang/core'`로 교체
  - [ ] 각 `page.tsx`에서 버전 표기 `<p>버전 {CURRENT_TERMS_VERSION} · 시행일 {TERMS_EFFECTIVE_DATE}</p>` 형태로 상수를 직접 참조(하드코딩 금지)
  - [ ] `TERMS_EFFECTIVE_DATE`는 별도 상수(`packages/core/src/legal.ts`에 추가: `TERMS_EFFECTIVE_DATE = '2026-06-17'`) — 개정 시 버전과 함께 변경

- [ ] Task 2: `packages/core/src/legal.ts` 업데이트 (AC: #1)
  - [ ] `packages/core/src/legal.ts` UPDATE — `TERMS_EFFECTIVE_DATE` 상수 추가:
    ```ts
    export const CURRENT_TERMS_VERSION = '2026-06-17' as const;
    export const TERMS_EFFECTIVE_DATE = '2026-06-17' as const;
    ```
  - [ ] `packages/core/src/index.ts` UPDATE — `TERMS_EFFECTIVE_DATE` export 추가

- [ ] Task 3: `GET /api/v1/auth/me` — `termsUpdateRequired` 신호 추가 (AC: #2, #4)
  - [ ] `apps/api/src/routes/v1/auth/` 에 me 라우트 구현(현재 placeholder):
    - 세션 쿠키 검증 → 없으면 401 UNAUTHORIZED
    - 유효 세션 → `db.select().from(users).where(eq(users.id, sessionUserId))`
    - `termsUpdateRequired: userRow.termsVersion !== CURRENT_TERMS_VERSION` 계산
    - `termsVersion`이 null인 경우도 `!== CURRENT_TERMS_VERSION` → `true` (PIPA 안전 처리)
    - 응답 `publicUserSchema` 확장:
      ```ts
      export const publicUserSchema = z.object({
        id: z.string(),
        email: z.string().email(),
        nickname: z.string(),
        role: z.enum(["member", "admin"]),
        createdAt: z.string(),
        termsAgreedAt: z.string().nullable(),
        termsVersion: z.string().nullable(),
        termsUpdateRequired: z.boolean(),  // ← 추가
      });
      ```
    - `packages/contracts/src/auth.ts` UPDATE — `publicUserSchema`에 `termsUpdateRequired: z.boolean()` 추가

- [ ] Task 4: `POST /api/v1/users/me/terms-consent` 엔드포인트 구현 (AC: #3)
  - [ ] `apps/api/src/routes/v1/users/terms-consent.ts` NEW
    ```
    POST /api/v1/users/me/terms-consent
    인증 필요 (세션 쿠키)
    body: 없음 (또는 빈 객체)
    ```
    - 세션 검증 → 없으면 401
    - `db.update(users).set({ termsAgreedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION }).where(eq(users.id, sessionUserId))` (service 레이어에서)
    - 성공 응답: `200 { termsAgreedAt: ISO8601string, termsVersion: string, termsUpdateRequired: false }`
    - 에러: 401 UNAUTHORIZED(미인증), 500 서버 오류
  - [ ] `apps/api/src/routes/v1/index.ts` UPDATE — `/users/me/terms-consent` 라우트 등록
  - [ ] `packages/contracts/src/auth.ts` UPDATE — `termsConsentResponseSchema` 추가:
    ```ts
    export const termsConsentResponseSchema = z.object({
      termsAgreedAt: z.string(),
      termsVersion: z.string(),
      termsUpdateRequired: z.literal(false),
    });
    ```

- [ ] Task 5: 소셜 가입 대응 준비 (AC: #5)
  - [ ] `apps/api/src/routes/v1/auth/service.ts`(Story 10.3에서 생성)에 `recordTermsConsent(userId: string, db: DrizzleClient): Promise<void>` 헬퍼 함수 추가 — `users.terms_agreed_at = NOW()`, `users.terms_version = CURRENT_TERMS_VERSION` 업데이트 로직
  - [ ] 이 함수는 Story 1.5(소셜 가입) 구현 시 Better Auth 신규 사용자 생성 콜백에서 호출 가능하도록 준비 (이 스토리는 인터페이스 준비만; 실제 소셜 연동은 1.5에서)
  - [ ] `packages/core/src/legal.ts` export 목록이 소셜 가입 구현 에이전트가 import할 수 있도록 `index.ts`에 정확히 노출되는지 확인

- [ ] Task 6: 회귀 방지 테스트 (AC: #4)
  - [ ] `apps/api/src/routes/v1/auth/sign-up.test.ts` UPDATE — 정상 가입 후 `GET /auth/me` 응답에서 `termsUpdateRequired: false` 확인
  - [ ] `apps/api/src/routes/v1/users/terms-consent.test.ts` NEW:
    - 재동의 전: `termsUpdateRequired: true`
    - `POST /users/me/terms-consent` 후: `termsUpdateRequired: false`
    - 버전 변경 없는 신규 가입: `termsUpdateRequired: false`

## Dev Notes

### 아키텍처 패턴
- **단일 상수 소스**: `CURRENT_TERMS_VERSION`·`TERMS_EFFECTIVE_DATE` 모두 `packages/core/src/legal.ts`. api/web/worker 전부 여기서만 import. 분산 하드코딩 금지. [Source: epics.md#Story 10.2 AC, project-context.md#Critical Implementation Rules]
- **`termsUpdateRequired` 계산 위치**: API 서버(`/auth/me` 핸들러 또는 service). 클라이언트 분기는 UX 편의 — 최종 통제는 API. [Source: project-context.md#보안]
- **행동 전면 차단 범위 밖**: 이 스토리는 신호(`termsUpdateRequired: true`) 제공까지. 클라이언트가 재동의 배너를 띄우는 것은 별도 구현. [Source: epics.md#Story 10.4 AC]
- **트랜잭션 레이어**: `POST /users/me/terms-consent`의 DB 업데이트는 `service.ts`에서. route handler에서 직접 db 호출 금지. [Source: project-context.md#패키지 경계]

### 수정 대상 파일 현황
- **`packages/contracts/src/auth.ts`** (UPDATE):
  - Story 10.3에서 `publicUserSchema`에 `termsAgreedAt`, `termsVersion` 추가됨.
  - 이 스토리에서 `termsUpdateRequired: z.boolean()` 추가.
  - 보존: `signUpSchema`, `signInSchema`, 기존 필드 전부.

- **`apps/api/src/routes/v1/auth/me.ts`** (현재 placeholder in `index.ts`):
  - 현재: `GET /auth/me`가 `v1/index.ts`에 401 반환 skeleton으로 있음.
  - 변경: 실제 세션 검증 + DB 조회 + `termsUpdateRequired` 계산.
  - Better Auth 세션 조회 방식은 Story 1.x(인증 구현 완료 시) 확립된 패턴 그대로 사용 — 착수 전 해당 스토리 완료 여부 확인.

- **`packages/core/src/legal.ts`** (UPDATE):
  - Story 10.2에서 `CURRENT_TERMS_VERSION` 추가됨.
  - 이 스토리에서 `TERMS_EFFECTIVE_DATE` 추가.

### `termsUpdateRequired` 계산 로직
```ts
// apps/api/src/routes/v1/auth/service.ts
import { CURRENT_TERMS_VERSION } from '@ai-jakdang/core';

function computeTermsUpdateRequired(userRow: UserRow): boolean {
  return userRow.termsVersion !== CURRENT_TERMS_VERSION;
  // termsVersion === null인 경우도 true가 됨 (null !== '2026-06-17')
}
```

### 소셜 가입 인터페이스 (Story 1.5 핸드오프)
```ts
// apps/api/src/routes/v1/auth/service.ts (Story 10.3 + 10.4 누적)
export async function recordTermsConsent(userId: string, db: DrizzleClient): Promise<void> {
  await db.update(users)
    .set({ termsAgreedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION })
    .where(eq(users.id, userId));
}
```
Story 1.5 구현 시 Better Auth의 `onUserCreated` 훅에서 이 함수를 호출해 소셜 가입도 동의 기록.

### `POST /api/v1/users/me/terms-consent` 스펙
```
Method: POST
Path: /api/v1/users/me/terms-consent
Auth: 필요 (httpOnly 세션 쿠키)
Body: 없음
Response 200: { termsAgreedAt: string (ISO8601), termsVersion: string, termsUpdateRequired: false }
Response 401: { error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } }
```

### 법무 페이지 버전 표기 패턴 (Story 10.1 연계)
```tsx
// apps/web/app/terms/page.tsx (UPDATE if 10.1 하드코딩함)
// apps/web/app/privacy/page.tsx
// apps/web/app/operation-policy/page.tsx
import { CURRENT_TERMS_VERSION, TERMS_EFFECTIVE_DATE } from '@ai-jakdang/core';
// ...
<p>버전 {CURRENT_TERMS_VERSION} · 시행일 {TERMS_EFFECTIVE_DATE}</p>
```

### 테스트 표준
- co-located `*.test.ts` (Vitest)
- `terms-consent.test.ts`: Fastify `inject` 방식으로 HTTP 레벨 테스트
- `CURRENT_TERMS_VERSION` mocking: `vi.mock('@ai-jakdang/core', () => ({ CURRENT_TERMS_VERSION: 'TEST-VERSION' }))` 패턴으로 버전 변경 시나리오 테스트 가능

### Project Structure Notes
- `apps/api/src/routes/v1/users/` 폴더 신규 생성 필요 (현재 auth만 있음)
- 파일명: `terms-consent.ts` (kebab-case, 모듈 파일 규칙)
- `apps/web/` 클라이언트 측 재동의 UI(배너/모달)는 이 스토리 범위 밖 — 신호(`termsUpdateRequired`)만 제공하고 UI는 향후 Epic 확장.

### 의존성 체인 (착수 순서)
```
10.1 완료(/terms·/privacy·/operation-policy 페이지) → 10.2 완료(스키마+CURRENT_TERMS_VERSION) → 10.3 완료(가입 API) → 10.4
```
10.4는 10.2·10.3이 완료된 상태에서만 착수 가능.
Better Auth 세션 조회(Story 1.x 완료) 없이는 `/auth/me`·`/users/me/terms-consent` 인증 부분 구현 불가.

### References
- [Source: epics.md#Story 10.4 AC]
- [Source: packages/core/src/legal.ts (10.2에서 생성)]
- [Source: packages/contracts/src/auth.ts (10.2·10.3에서 수정됨)]
- [Source: apps/api/src/routes/v1/index.ts — 현재 상태]
- [Source: project-context.md#보안, 패키지 경계, 응답 & 데이터 포맷]
- [Source: architecture.md#Authentication & Security, API & Communication Patterns]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

- UPDATE `packages/core/src/legal.ts`
- UPDATE `packages/core/src/index.ts`
- UPDATE `packages/contracts/src/auth.ts`
- UPDATE `apps/web/app/(legal)/_content/terms.ts` (버전 상수 import 교체 — 10.1에서 하드코딩 시)
- UPDATE `apps/web/app/(legal)/_content/privacy.ts`
- UPDATE `apps/web/app/(legal)/_content/operation-policy.ts`
- NEW `apps/api/src/routes/v1/auth/me.ts` (또는 UPDATE `index.ts` 내 me 핸들러)
- NEW `apps/api/src/routes/v1/users/terms-consent.ts`
- UPDATE `apps/api/src/routes/v1/auth/service.ts` (`recordTermsConsent` 헬퍼 추가)
- UPDATE `apps/api/src/routes/v1/index.ts`
- NEW `apps/api/src/routes/v1/users/terms-consent.test.ts`

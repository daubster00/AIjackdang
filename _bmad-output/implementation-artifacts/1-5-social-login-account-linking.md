# Story 1.5: 소셜 로그인(구글/네이버/카카오) + 계정 연결

Status: ready-for-dev

## Story

As a 비회원/회원,
I want 구글·네이버·카카오로 로그인하고 같은 이메일이면 한 계정으로 연결되기를,
so that 가입 마찰 없이 빠르게 진입하고 중복 계정이 생기지 않는다.

## Acceptance Criteria

1. Better Auth `socialProviders`에 구글·네이버·카카오가 네이티브 구성되고 OAuth 콜백(`/api/v1/auth/callback/{provider}`)이 등록된다.
2. 소셜 로그인 버튼 클릭 → OAuth 플로우 완료 시 `accounts`(providerId=해당 소셜)와 `users`가 생성/연결되고 `aj_session` 쿠키가 발급된다.
3. 최초 소셜 로그인(신규 유저) 시 닉네임·`defaultAvatarIndex`가 자동 배정된다(Story 1.3 `generateNickname()` 재사용). 이후 계정 설정에서 변경 가능.
4. 동일한 이메일의 credential·다른 소셜 계정이 이미 존재 시 account linking으로 **한 `users`에 계정이 병합**되고 별도 유저가 생기지 않는다.
5. 카카오 비즈앱 미검수 상태에서는 카카오 로그인 버튼을 비활성(disabled)으로 표시하거나 "카카오 로그인 준비 중" 안내를 보인다(ADR-0002 §카카오 정책). 환경변수 `KAKAO_ENABLED=false`로 제어.
6. `/signup`·`/login` 화면의 소셜 버튼 클릭 시 실제 OAuth 리다이렉트가 발생한다.
7. 소셜 로그인 완료 후 `redirectTo` 파라미터를 통해 원래 위치로 복귀한다.
8. `pnpm typecheck` 통과 및 소셜 콜백 통합 테스트(dev-bypass 환경에서 mock provider).

## Tasks / Subtasks

- [ ] Task 1: Better Auth 소셜 provider 구성 (AC: #1, #2) — UPDATE `apps/api/src/auth/user-auth.ts`
  - [ ] 1.1 `user-auth.ts` UPDATE: `socialProviders` 구성 추가
    ```ts
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
      naver: {
        clientId: env.NAVER_CLIENT_ID,
        clientSecret: env.NAVER_CLIENT_SECRET,
        // Better Auth 네이티브 naver provider 설정
      },
      kakao: {
        clientId: env.KAKAO_REST_API_KEY,
        clientSecret: env.KAKAO_CLIENT_SECRET,
        // Better Auth 네이티브 kakao provider 설정
      },
    }
    ```
  - [ ] 1.2 `accountLinking`: `{ enabled: true, trustedProviders: ['google', 'naver', 'kakao'] }` 설정 → 동일 이메일 자동 연결
  - [ ] 1.3 Better Auth `onUserCreated` 훅(또는 `socialProviders.signIn.callback`): 신규 유저 생성 시 닉네임·`defaultAvatarIndex` 자동 배정 로직 추가

- [ ] Task 2: `packages/config/src/env.ts` UPDATE (AC: #1, #5)
  - [ ] 2.1 OAuth 키 추가: `GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET`·`NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`·`KAKAO_REST_API_KEY`·`KAKAO_CLIENT_SECRET` — 개발 환경에서는 optional(소셜 미설정 시 해당 버튼만 비활성)
  - [ ] 2.2 `KAKAO_ENABLED` boolean(default false) 추가 — 비즈앱 검수 완료 후 true로 전환

- [ ] Task 3: 소셜 로그인 버튼 실제 연결 (AC: #5, #6, #7) — UPDATE 두 파일
  - [ ] 3.1 `apps/web/app/signup/SignupForm.tsx` UPDATE:
    - **보존**: SocialSignup 컴포넌트 내 버튼 3개 구조·스타일·SVG 마크 유지
    - 카카오 버튼: `env.KAKAO_ENABLED`가 false이면 `disabled` + `title="카카오 로그인 준비 중"` + 반투명 스타일
    - 구글·네이버 버튼 `onClick`: `window.location.href = '/api/v1/auth/social/{google|naver}?redirectTo={encodedPath}'` (Better Auth OAuth 시작 URL)
  - [ ] 3.2 `apps/web/app/login/LoginForm.tsx` UPDATE: 동일 패턴 소셜 버튼 3개 연결

- [ ] Task 4: Next.js 소셜 콜백 프록시 확인 (AC: #2)
  - [ ] 4.1 `apps/web/next.config.ts` 확인/UPDATE: `/api/v1/auth/callback/{provider}` 리라이트 → `http://localhost:4003/api/v1/auth/callback/{provider}` 매핑 확인 (ADR-0002 §콜백 규약)
  - [ ] 4.2 콜백 완료 후 `redirectTo` 파라미터 기반 복귀 처리 — Better Auth가 state에 넣어 돌려주는 방식 확인

- [ ] Task 5: 신규 소셜 유저 프로필 초기화 (AC: #3) — UPDATE `apps/api/src/auth/user-auth.ts`
  - [ ] 5.1 Better Auth `onSocialSignIn`(또는 `databaseHooks.user.create`) 훅:
    ```ts
    // 신규 유저(isNew=true)이면:
    // nickname = await generateUniqueNickname(db) — DB UNIQUE 검증 포함
    // defaultAvatarIndex = crypto.randomInt(0, DEFAULT_AVATAR_COUNT)
    // termsAgreedAt = 소셜 가입 시 자동 동의로 처리(약관 동의 페이지 생략 정책 확인)
    ```
  - [ ] 5.2 소셜 가입 약관 동의 정책 확인: 소셜 가입 시 자동 동의 처리 vs. 별도 약관 동의 페이지로 유도 — 설계 결정을 스토리 파일에 명시

- [ ] Task 6: `generateUniqueNickname` service 함수 (AC: #3) — NEW
  - [ ] 6.1 `apps/api/src/services/auth/nickname.service.ts` NEW:
    ```ts
    // generateUniqueNickname(db: Database, maxRetries = 10): Promise<string>
    // packages/core의 generateNickname() 호출 + DB 중복 확인 루프
    ```

- [ ] Task 7: 통합 테스트 (AC: #8)
  - [ ] 7.1 dev-bypass 환경에서 mock 소셜 provider 테스트(Better Auth test utilities)
  - [ ] 7.2 동일 이메일 계정 연결(account linking) 테스트
  - [ ] 7.3 카카오 비활성 상태 UI 확인

## Dev Notes

### 기존 파일 현황 및 변경 사항
- **`apps/web/app/signup/SignupForm.tsx`** (UPDATE — 소셜 버튼 연결):
  - 현재: 소셜 버튼이 `type="button"` 클릭 이벤트 없음 (mock)
  - 변경: OAuth redirect 추가. 버튼 구조·SVG·클래스명 완전 보존.
  - **보존**: KakaoMark SVG, GoogleMark SVG, `styles.socialButton` 클래스, "카카오로 가입"·"네이버로 가입"·"Google로 가입" 텍스트
- **`apps/web/app/login/LoginForm.tsx`** (UPDATE — 소셜 버튼 연결): 동일 패턴

### Better Auth 소셜 provider 주의사항
- **네이버**: Better Auth 네이티브 지원 확인(ADR-0001 §4). `naver` provider 키 이름과 설정 구조를 Better Auth 공식 문서에서 확인.
- **카카오**: Better Auth 네이티브 지원 확인. `KAKAO_REST_API_KEY`를 `clientId`로 사용. 비즈앱 검수 전 `scope` 없이 이메일 없는 경우 처리.
- **콜백 URL**: 각 플랫폼 개발자 콘솔에 `http://localhost:3003/api/v1/auth/callback/{provider}` 등록 필요(개발자가 직접 등록 — 코드로 해결 불가).

### Account Linking 보안
- Better Auth `trustedProviders`에 구글·네이버·카카오 포함 → 동일 이메일이면 자동 병합.
- 악의적 account linking 방지: 소셜 provider의 이메일이 **검증된(verified) 이메일**인 경우만 신뢰. 미검증 이메일로는 linking 금지.

### References
- [Source: docs/adr/ADR-0002-identity-and-auth-schema.md#1. 신원·다계정 정책 — 계정 연결]
- [Source: docs/adr/ADR-0001-local-dev-infrastructure.md#4. 소셜 OAuth 로컬 전략]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

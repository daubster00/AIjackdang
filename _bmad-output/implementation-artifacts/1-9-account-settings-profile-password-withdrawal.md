# Story 1.9: 계정 설정 — 회원정보 수정 · 비밀번호 변경 · 회원 탈퇴

Status: ready-for-dev

## Story

As a 회원,
I want 민감 영역인 계정 설정에서 프로필을 수정하고 비밀번호를 바꾸고 탈퇴하기를,
so that 내 정보와 계정 수명을 직접 관리한다.

## Acceptance Criteria

1. `/settings/profile`에서 닉네임·소개·프로필 이미지·배너 이미지·외부 링크를 수정·저장 시 닉네임 유니크·허용 문자(`/^[가-힣a-zA-Z0-9_]+$/`, 2~20자) 검증 통과 후 `users`가 갱신되고 성공 토스트가 표시된다.
2. 프로필 이미지(아바타)/배너 이미지를 업로드 시 `users.avatarUrl`/`users.bannerUrl`이 설정되어 기본 이미지(`defaultAvatarIndex`)를 덮어쓴다. 업로드는 API 서버 멀티파트 방식. 이미지 허용 형식(jpg·png·webp·gif) + 최대 5MB 검증.
3. `/settings/password`(로그인 상태)에서 현재 비밀번호 확인 후 새 비밀번호(8자 이상) 변경 시 `accounts.password`가 Argon2id로 갱신된다. 현재 비밀번호 불일치는 401 + 인라인 오류.
4. `/settings/account`에서 회원 탈퇴 확정(2단계 확인: 안내 읽기 + "탈퇴합니다" 텍스트 입력) 시 `users.status=withdrawn` + `users.deletedAt=now()` soft-delete + 세션 종료 + 홈 리다이렉트.
5. 탈퇴 후 콘텐츠 처리: 작성 글·댓글의 `user_id`를 null로 설정(익명화). `users` 레코드는 삭제하지 않고 status=withdrawn 유지(AR-7 soft-delete 정책).
6. `/settings/*` 전체 경로는 로그인 필요 + noindex.
7. 소셜 전용 계정(credential 없음)은 `/settings/password`에서 비밀번호 변경 폼 대신 "소셜 계정으로 가입하셨어요" 안내를 표시.

## Tasks / Subtasks

- [ ] Task 1: `/settings/profile` 실제 API 연결 (AC: #1, #2) — UPDATE `apps/web/app/settings/profile/ProfileForm.tsx`
  - [ ] 1.1 `ProfileForm.tsx` UPDATE:
    - **보존**: 전체 폼 레이아웃(bannerSection·avatarRow·nicknameField·bio Textarea·linksSection·readonlyField 이메일·actions 버튼), Avatar 미리보기 패턴(FileReader dataURL), 배너 미리보기, 외부 링크 행 추가 패턴(최대 5개)
    - **교체**: `alert("프로필이 저장되었습니다. (목업)")` → 실제 `PATCH /api/v1/users/me` API 호출
    - **추가**: blur 시 닉네임 유니크 체크 API(`GET /api/v1/users/check-nickname?nickname=XXX`)
    - **추가**: 이미지 업로드 — 파일 선택 후 `POST /api/v1/uploads/avatar`(멀티파트) → URL 획득 후 폼에 반영
    - 저장 성공: `success` 토스트("프로필이 저장됐어요")
    - 저장 실패(409 닉네임 중복): 닉네임 필드 인라인 오류
    - 저장 실패(4xx 기타): danger 토스트
  - [ ] 1.2 `apps/web/app/settings/profile/page.tsx`: `metadata.robots = { index: false }` 추가 확인 (현재 없음)

- [ ] Task 2: 프로필 수정 API (AC: #1, #2) — NEW in `apps/api`
  - [ ] 2.1 `PATCH /api/v1/users/me` 라우트 NEW:
    - 인증 필요(`requireAuthHook`)
    - 입력: `updateProfileSchema`(nickname·bio·links·avatarUrl·bannerUrl — 모두 optional)
    - 닉네임 변경 시: `nicknameSchema` 검증 + DB UNIQUE 확인(409 `NICKNAME_TAKEN`)
    - `users` 갱신 + 성공 200 응답
  - [ ] 2.2 `GET /api/v1/users/check-nickname` 라우트 NEW:
    - 쿼리 `?nickname=` + 현재 사용자 제외 중복 확인
    - 응답: `{ available: boolean }`
  - [ ] 2.3 이미지 업로드 라우트 NEW (API 서버 멀티파트 방식 확정):
    - `POST /api/v1/uploads/avatar` — 프로필 이미지(아바타) 업로드. 인증 필요. 허용 형식: jpg·png·webp·gif, 최대 5MB. MinIO/R2에 저장 후 `avatarUrl` 반환.
    - `POST /api/v1/uploads/banner` — 배너 이미지 업로드. 동일 조건. MinIO/R2에 저장 후 `bannerUrl` 반환.
    - **저장 방식**: API 서버 멀티파트 스트림 업로드 (presigned URL 방식 사용 금지)

- [ ] Task 3: `/settings/password` 실제 API 연결 (AC: #3, #7) — UPDATE `apps/web/app/settings/security/SecurityForm.tsx`
  - [ ] 3.1 `SecurityForm.tsx` UPDATE:
    - **보존**: 3개 Input 필드(현재·새·확인), 폼 레이아웃, blur 검증(tooShort·mismatch), 취소/변경 버튼
    - **교체**: `alert("비밀번호 변경 기능은 아직 개발 중입니다.")` → 실제 `POST /api/v1/users/me/password` API 호출
    - 현재 비밀번호 불일치(401): 현재 비밀번호 필드 인라인 오류
    - 성공: "비밀번호가 변경됐어요" success 토스트
  - [ ] 3.2 소셜 전용 계정 감지: `GET /api/v1/users/me/accounts` → `accounts` 중 providerId='credential' 없으면 폼 대신 안내 표시

- [ ] Task 4: 비밀번호 변경 API (AC: #3) — NEW in `apps/api`
  - [ ] 4.1 `POST /api/v1/users/me/password` 라우트 NEW:
    - 인증 필요
    - 입력: `changePasswordSchema`(currentPassword·newPassword)
    - `accounts.password` Argon2id verify → 불일치 401 `WRONG_PASSWORD`
    - 새 비밀번호 Argon2id 해시 → `accounts.password` 갱신
    - 성공 200

- [ ] Task 5: `/settings/account` 회원 탈퇴 (AC: #4, #5) — NEW 페이지 + API
  - [ ] 5.1 `apps/web/app/settings/account/page.tsx` NEW 서버 컴포넌트: 탈퇴 안내 + `WithdrawalForm` 마운트
  - [ ] 5.2 `apps/web/app/settings/account/WithdrawalForm.tsx` NEW 클라이언트 컴포넌트:
    - 1단계: "탈퇴 전 확인사항" 목록(콘텐츠 익명화·포인트 소멸·복구 불가 등) 읽기 + [다음] 버튼
    - 2단계: `<input type="text" placeholder='탈퇴하려면 "탈퇴합니다"를 입력하세요'>` + [탈퇴 확정] 버튼(빨간색·disabled unless 텍스트 일치)
    - 확정 후: `DELETE /api/v1/users/me` 호출 → 성공 시 세션 클리어 + `router.push('/')`
  - [ ] 5.3 `DELETE /api/v1/users/me` 라우트 NEW in `apps/api`:
    - 인증 필요
    - `users.status = 'withdrawn'` + `users.deletedAt = now()` 갱신 (soft-delete)
    - 해당 사용자의 `sessions` 전부 삭제
    - 성공 200 (`aj_session` 쿠키는 클라이언트에서 제거)
    - 콘텐츠 익명화(`posts.user_id`, `comments.user_id` null 처리)는 worker `cleanup` 큐로 위임(즉시 처리 아님)

- [ ] Task 6: `/settings/*` 인증 가드 (AC: #6)
  - [ ] 6.1 `apps/web/middleware.ts` 확인: `/settings/*` 경로 → 비로그인 시 `/login?redirectTo={path}` 리다이렉트 (Story 1.4에서 이미 설정됐을 수 있음 — 확인)
  - [ ] 6.2 각 page.tsx metadata: `robots: { index: false }` 추가

- [ ] Task 7: 테스트 (AC: 전반)
  - [ ] 7.1 프로필 저장 성공·닉네임 중복 409·이미지 업로드 케이스
  - [ ] 7.2 비밀번호 변경 성공·현재 비밀번호 불일치 401
  - [ ] 7.3 탈퇴 흐름: 확인 텍스트 불일치 시 버튼 disabled, 탈퇴 완료 후 세션 종료

## Dev Notes

### 기존 파일 현황 및 변경 사항
- **`apps/web/app/settings/profile/ProfileForm.tsx`** (UPDATE):
  - 현재: 배너·아바타·닉네임·bio·외부링크·이메일(읽기전용) 완성된 UI. mock `alert()` 호출.
  - 변경: 실제 API 연결(PATCH + 이미지 업로드), blur 시 닉네임 중복 체크
  - **보존**: 전체 UI 구조·컴포넌트(Avatar·Textarea·Button·Input 사용 패턴), `avatarPreview`/`bannerPreview` FileReader 패턴, 링크 행 추가/삭제 패턴(`linkIdCounter`), `BIO_MAX = 120`
  - **유지**: `/settings/profile/page.tsx`에서 `cancelLink`는 `/mypage` 참조 유지 (마이페이지 경로 변경 없음)

- **`apps/web/app/settings/security/SecurityForm.tsx`** (UPDATE):
  - 현재: 3 Input 필드 완성된 UI. mock `alert()` 호출.
  - 변경: 실제 API 연결
  - **보존**: `MIN_LENGTH = 8`, `tooShort`/`mismatch` 검증 로직, `submitted` 플래그, 필드 error/success 패턴

- **`apps/web/app/settings/account/`**: 현재 없음 → NEW 생성.

### 이미지 업로드 아키텍처 (AR-15 일부)
- 소셜/자료 업로드 보안 파이프라인(ClamAV 스캔)은 Epic 4(실전자료)에서 본격 도입.
- **프로필 이미지(아바타)/배너 이미지 업로드 방식: API 서버 멀티파트 업로드 확정** (presigned URL 방식 사용 금지 — 아바타/배너는 서버 위험도 낮음, 단순 크기 제한 + 확장자 검증으로 충분).
- 최대 5MB, 허용: jpg·png·webp·gif.
- "아바타"는 곧 프로필 이미지 (`users.avatarUrl` 또는 `getDefaultAvatarUrl(defaultAvatarIndex)` 폴백). 별도 아바타 시스템이 아님.

### 탈퇴 콘텐츠 처리 정책 (Open Q-12)
- ADR/Open Q-12에 따라 **익명화** 처리: `posts.user_id = null`, `comments.user_id = null`.
- `users` 레코드는 `status=withdrawn`+`deletedAt` soft-delete로 보존.
- 즉시 처리가 아닌 worker `cleanup` 큐(`cleanup.anonymize` job) 위임 — 탈퇴 API에서 job 발행.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.9]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — soft-delete]
- [Source: docs/adr/ADR-0002-identity-and-auth-schema.md#2. 인증 스키마 설계]
- [Source: apps/web/app/settings/profile/ProfileForm.tsx — 현재 구현]
- [Source: apps/web/app/settings/security/SecurityForm.tsx — 현재 구현]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
없음 (타입오류 2건 수정: Zod v4 `issues` API 교체, `rawBody` → `request.body` 캐스팅)

### Completion Notes List

**완료:**
- PATCH /users/me — 프로필 수정 (닉네임 중복 409, updatedAt 갱신)
- GET /users/check-nickname — 본인 제외 닉네임 중복 확인
- POST /users/me/password — Argon2id verify + 새 해시 갱신
- GET /users/me/accounts — providers 목록 (소셜 전용 판별용)
- DELETE /users/me — soft-delete + 세션 삭제 + cleanup 큐 발행
- POST /users/uploads/avatar · /uploads/banner — 멀티파트 이미지 업로드
- apps/web ProfileForm.tsx — 실제 API 연결, 닉네임 blur 중복 체크, 이미지 업로드, 성공/실패 토스트
- apps/web SecurityForm.tsx — 실제 API 연결, 소셜 전용 계정 안내, 401 인라인 오류
- apps/web /settings/account — 신규 page.tsx + WithdrawalForm.tsx (2단계 확인 → DELETE → 세션클리어 → 홈)
- middleware.ts /settings/* 가드 이미 Story 1.4 에서 구현됨 — 확인 후 그대로 유지
- 각 settings page.tsx robots noindex 추가
- cleanup 큐 worker 골격 추가 (apps/worker/src/index.ts 맨 아래 [1.9] 블록)

**편차:**
1. **스토리지 로컬 폴백**: @fastify/multipart 가 실제 설치되어 있지 않음 → Node.js 내장 Buffer 기반 멀티파트 파서(services/storage/multipart.ts)로 대체. 로컬 파일시스템(apps/api/uploads/)에 저장하고 `/uploads/{subdir}/{filename}` URL 반환. MinIO/S3 연결 시 uploadImage() 함수에서 분기 예정.
2. **익명화 worker 골격만**: posts·comments 테이블이 미생성 상태 — cleanup.anonymize job 수신 시 TODO 로그만 출력, 실제 UPDATE는 Epic 2 이후 구현.
3. **링크 label**: updateProfileSchema 의 links 필드가 `{label, url}` 구조 — 프론트에서 url 을 label 로도 사용(더미 label = url). 링크 전용 label 입력 UI 는 추후 개선 가능.

### File List
- apps/api/src/routes/v1/users.ts (UPDATED)
- apps/api/src/services/storage/index.ts (NEW)
- apps/api/src/services/storage/multipart.ts (NEW)
- apps/api/src/queues/cleanup.queue.ts (NEW)
- apps/api/src/routes/v1/users.test.ts (NEW)
- apps/web/app/settings/profile/ProfileForm.tsx (UPDATED)
- apps/web/app/settings/profile/page.tsx (UPDATED — noindex 추가)
- apps/web/app/settings/security/SecurityForm.tsx (UPDATED)
- apps/web/app/settings/security/page.tsx (UPDATED — noindex 추가)
- apps/web/app/settings/account/page.tsx (NEW)
- apps/web/app/settings/account/WithdrawalForm.tsx (NEW)
- apps/web/app/settings/account/account.module.css (NEW)
- apps/web/lib/users-api.ts (NEW)
- apps/worker/src/connection.ts (UPDATED — cleanup 큐 이름 추가)
- apps/worker/src/index.ts (UPDATED — cleanup worker 블록 추가)
- packages/contracts/src/user.ts (UPDATED — imageUploadResponseSchema 추가)

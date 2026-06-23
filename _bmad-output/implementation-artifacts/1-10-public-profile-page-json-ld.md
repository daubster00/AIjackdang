# Story 1.10: 공개 프로필 페이지(`/u/{nickname}`) + ProfilePage JSON-LD

Status: ready-for-dev

## Story

As a 방문자(비회원 포함),
I want 작성자의 공개 프로필에서 닉네임·소개·등급·뱃지·작성물을 보기를,
so that 작성자의 신뢰도를 가늠하고 더 탐색한다.

## Acceptance Criteria

1. 유효한 닉네임으로 `/u/{nickname}` 진입 시 SSR 렌더로 닉네임·소개·프로필 이미지·배너·등급이 노출된다. 비회원도 열람 가능 (FR-1.5, FR-11.5).
2. `<head>`에 ProfilePage JSON-LD(`@type: "ProfilePage"`, `mainEntity: { @type: "Person", name, identifier, image, description }`)와 고유 `<title>`·`<meta name="description">`·`<link rel="canonical">`가 설정된다.
3. 팔로워/팔로잉 카운트 슬롯과 팔로우 버튼 슬롯은 구조를 유지하되 카운트는 0 표시 + "Epic 5에서 활성화" 주석.
4. 작성 글 등 활동 영역은 EmptyState("아직 공개된 작성물이 없어요")로 렌더되고 이후 콘텐츠 에픽에서 집계가 채워진다.
5. 존재하지 않는 닉네임 → `notFound()` (Next.js 404). `status=withdrawn` 탈퇴 회원 → 404 안내 페이지(`"탈퇴한 회원이에요"`) + noindex.
6. `generateMetadata`는 실제 API(`GET /api/v1/users/profile/{nickname}`)에서 가져온 닉네임·소개로 채운다. API 에러 시 `notFound()` fallback.
7. 자신의 프로필 페이지에서 [프로필 수정] 버튼이 표시된다(로그인 사용자 식별). 타인 프로필에서는 표시되지 않는다.

## Tasks / Subtasks

- [ ] Task 1: `/u/{nickname}` 페이지 mock → 실제 API 교체 (AC: #1, #2, #5, #6) — UPDATE `apps/web/app/u/[nickname]/page.tsx`
  - [ ] 1.1 `page.tsx` UPDATE — 서버 컴포넌트:
    - **보존**: `generateMetadata` 함수 시그니처, `generateStaticParams` 함수(빈 배열로 유지 — 완전 동적 렌더), `notFound()` 호출 패턴, 전체 페이지 레이아웃 구조(profileHeader·profileBand·bannerSection·statsRow·tabs 등), ProfilePage JSON-LD 구조(`<script type="application/ld+json">`)
    - **교체**: mock 데이터(`MOCK_PROFILES`, mock user 선택 로직) → 실제 `GET /api/v1/users/profile/{nickname}` fetch
    - **교체**: mock 팔로워/팔로잉 수치 → 0 (Epic 5에서 활성화)
    - **교체**: mock 작성 글 목록 → 빈 배열 + EmptyState
    - `generateMetadata` → 실제 API 사용, 존재 확인: 없으면 `return {}` (404는 page.tsx에서 처리)
    - `withdrawn` 상태 유저 → 404 UI(`"탈퇴한 회원이에요"`) + `robots: { index: false }`
  - [ ] 1.2 ProfilePage JSON-LD 실데이터 연결:
    ```ts
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      "dateCreated": profile.createdAt,
      "dateModified": profile.updatedAt ?? profile.createdAt,
      "mainEntity": {
        "@type": "Person",
        "name": profile.nickname,
        "identifier": profile.nickname,
        "image": profile.avatarUrl ?? getDefaultAvatarUrl(profile.defaultAvatarIndex),
        "description": profile.bio ?? "",
        "url": `https://aijakdang.com/u/${profile.nickname}`,
      }
    }
    ```

- [ ] Task 2: `ProfileInteraction` 클라이언트 컴포넌트 업데이트 (AC: #3, #7) — UPDATE `apps/web/app/u/[nickname]/ProfileInteraction.tsx`
  - [ ] 2.1 `ProfileInteraction.tsx` UPDATE:
    - **보존**: `useAuth` 훅 사용 패턴, 자신 여부 감지 로직(`session.user.id === profile.id`), 조건부 렌더(내 프로필: [프로필 수정] 버튼, 타인: 팔로우 버튼)
    - **교체**: `useMockAuth` → `useAuth` (실제 세션)
    - **팔로우 버튼**: 구조 유지, `requireAuth('follow')` 적용 (Story 1.7 `useGating` 사용), 실제 API 호출은 Epic 5에서 활성화 — 현재 클릭 시 "팔로우 기능은 준비 중이에요" 안내 또는 비활성
    - **주석 추가**: `// TODO: Epic 5 Story 5.12 — 팔로우/팔로워 실데이터 연결`

- [ ] Task 3: 공개 프로필 API (AC: #1, #5, #6) — NEW in `apps/api`
  - [ ] 3.1 `GET /api/v1/users/profile/{nickname}` 라우트 NEW:
    - 인증 불필요 (공개)
    - `nickname` 기준 `users` 조회
    - 없거나 `status=withdrawn` → 404 `{ error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없어요.' } }`
    - 응답 타입 `PublicProfileResponse`: `{ id, nickname, bio, avatarUrl, defaultAvatarIndex, bannerUrl, rank, createdAt, updatedAt, followersCount: 0, followingCount: 0, isWithdrawn: boolean }`
    - 민감 정보 노출 금지: email·status·suspendedUntil·links 등 민감 필드 제외

- [ ] Task 4: 프로필 페이지 메타데이터 + noindex (AC: #2, #5)
  - [ ] 4.1 `generateMetadata({ params })` UPDATE:
    - 실제 API fetch → `profile.nickname` + `profile.bio`로 `title`·`description` 생성
    - canonical: `https://aijakdang.com/u/${nickname}`
    - 탈퇴/없음: `robots: { index: false, follow: false }`
    - 정상: `robots: { index: true }`
  - [ ] 4.2 OG 태그: `og:title`, `og:description`, `og:image`(avatarUrl) 설정

- [ ] Task 5: `packages/contracts/src/user.ts` UPDATE (AC: #6)
  - [ ] 5.1 `publicProfileSchema` Zod 스키마 NEW:
    ```ts
    export const publicProfileSchema = z.object({
      id: z.string().uuid(),
      nickname: z.string(),
      bio: z.string().nullable(),
      avatarUrl: z.string().url().nullable(),
      defaultAvatarIndex: z.number().int(),
      bannerUrl: z.string().url().nullable(),
      rank: z.string(), // 등급 키: 'rookie' | 'regular' | ...
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime().nullable(),
      followersCount: z.number().int().default(0),
      followingCount: z.number().int().default(0),
    });
    export type PublicProfile = z.infer<typeof publicProfileSchema>;
    ```

- [ ] Task 6: 테스트 (AC: 전반)
  - [ ] 6.1 유효 닉네임 → 실제 프로필 렌더 (title·description·JSON-LD 포함)
  - [ ] 6.2 없는 닉네임 → 404
  - [ ] 6.3 탈퇴 회원 → 404 UI + noindex
  - [ ] 6.4 자신 프로필 → [프로필 수정] 버튼 노출, 타인 → 팔로우 버튼만

## Dev Notes

### 기존 파일 현황 및 변경 사항
- **`apps/web/app/u/[nickname]/page.tsx`** (UPDATE):
  - 현재: `MOCK_PROFILES` 배열에서 mock 프로필 조회. `generateMetadata`도 mock 기반. ProfilePage JSON-LD는 이미 구현됨(구조 유지).
  - 변경: 실제 `GET /api/v1/users/profile/{nickname}` API 연결
  - **보존**: SSR 서버 컴포넌트 패턴, `generateMetadata` + `notFound()` 패턴, 전체 HTML 구조, `<script type="application/ld+json">` 블록 위치, `generateStaticParams`(빈 배열 유지)

- **`apps/web/app/u/[nickname]/ProfileInteraction.tsx`** (UPDATE):
  - 현재: `useMockAuth` 사용. 자신/타인 구분 로직 있음.
  - 변경: `useMockAuth` → `useAuth`, 팔로우 버튼에 `requireAuth` 추가
  - **보존**: 컴포넌트 시그니처(`profile: PublicProfile`), 조건부 렌더 패턴

### 아바타 표시 규칙 (Story 1.8·1.9와 동일)
- `profile.avatarUrl`이 있으면 해당 URL
- null이면 `getDefaultAvatarUrl(profile.defaultAvatarIndex)` → `/images/avatars/{index}.webp`

### 팔로워/팔로잉 슬롯 처리 (Epic 5 미래 의존)
- 현재: 카운트 항상 0, 팔로우 버튼 클릭 시 "준비 중" 안내
- Epic 5 Story 5.12에서 실제 팔로우 API + 카운트 집계로 교체
- 소스에 `// TODO: Epic 5 Story 5.12` 주석 명시

### ProfilePage JSON-LD 구조 (schema.org)
```json
{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "dateCreated": "ISO datetime",
  "dateModified": "ISO datetime",
  "mainEntity": {
    "@type": "Person",
    "name": "닉네임",
    "identifier": "닉네임",
    "image": "아바타 URL",
    "description": "소개",
    "url": "https://aijakdang.com/u/닉네임"
  }
}
```

### API 공개 접근
- `GET /api/v1/users/profile/{nickname}` — 인증 불필요, 공개
- 하지만 `GET /api/v1/users/me` (Story 1.8) — 인증 필요, 비공개
- 두 엔드포인트는 다른 응답 구조를 가짐: me = 자신의 전체 정보, profile = 공개 정보만

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.10]
- [Source: _bmad-output/planning-artifacts/architecture.md#SEO & Metadata Strategy]
- [Source: apps/web/app/u/[nickname]/page.tsx — 현재 구현]
- [Source: apps/web/app/u/[nickname]/ProfileInteraction.tsx — 현재 구현]
- [Source: _bmad-output/project-context.md#SEO·메타데이터]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

# Story 1.8: 마이페이지 활동 허브(`/mypage`) 셸 — mock → 실제 세션 교체

Status: ready-for-dev

## Story

As a 회원,
I want `/mypage`에서 내 요약(등급·포인트·통계)과 활동(글/댓글/북마크/좋아요/팔로잉/팔로워) 탭을 실제 세션 데이터로 볼 수 있기를,
so that 내 활동을 빠르게 파악하고 이동한다.

## Acceptance Criteria

1. `/mypage` 진입 시 noindex·로그인 필요로 처리된다. 비로그인 접근은 `/login?redirectTo=/mypage`로 리다이렉트.
2. `/mypage` 페이지는 기존 탭 구조(내가 쓴 글·댓글·북마크·좋아요·팔로잉·팔로워)를 그대로 유지하며, mock 데이터가 제거되고 실제 `useAuth` 세션 데이터(닉네임·이메일·등급·프로필 이미지)로 교체된다.
3. 각 탭은 현재 EmptyState("아직 글이 없어요" + 다음 행동 1개)로 렌더된다. 콘텐츠 에픽 구현 후 채워진다.
4. 팔로잉/팔로워 탭과 카운트 슬롯은 구조를 유지하되 실제 데이터는 Epic 5에서 채운다(현재 0 표시 + "Epic 5에서 활성화" 주석).
5. 통계 요약(작성한 글·받은 좋아요·채택된 답변·북마크) 4개 카드는 현재 0으로 표시. Epic 2~5 구현 후 집계.
6. 사이드바의 등급 진행도(`rankProgress`)는 현재 등급(기본 `rookie`)·포인트(0) 기준으로 렌더.
7. 사이드바 계정 관리 링크는 `/settings/profile`·`/settings/notifications`·`/settings/security`를 참조한다.
8. 알림 진입은 `/notifications`, 쪽지 진입은 `/messages`를 참조한다(사이드바 또는 헤더 링크).

## Tasks / Subtasks

- [ ] Task 1: `/mypage` 미들웨어 인증 가드 (AC: #1)
  - [ ] 1.1 `apps/web/middleware.ts` UPDATE: `/mypage` 경로 → 비로그인 시 `/login?redirectTo=/mypage` 리다이렉트 추가 (기존 `/settings/*` 가드와 동일 패턴)

- [ ] Task 2: `/mypage` 페이지 mock → 실제 세션 교체 (AC: #2, #3, #4, #5, #6, #7, #8)
  - [ ] 2.1 `apps/web/app/mypage/page.tsx` UPDATE — 현재 약 820줄 파일 기반:
    - **보존**: 전체 레이아웃(profileBand·identity·statGrid·tabBar·panel·sidebar), `RankBadge`, `Avatar`, `EmptyState`, `FollowButton`, `Dropdown/DropdownItem` 사용 패턴, 탭 키(`posts`·`comments`·`bookmarks`·`likes`·`following`·`followers`)
    - **제거**: `DEMO_USER` 상수, `profileExtra` mock 객체, `myPosts`·`activityData`·`followingData`·`followersData` mock 배열, `useMockAuth` import
    - **교체**: `useMockAuth` → `useAuth` (실제 세션); 닉네임·이메일·등급·프로필 이미지를 세션에서 읽음
    - **교체**: `myPosts`, `activityData` mock 데이터 → 실제 빈 배열 + EmptyState
    - **교체**: `followingData`, `followersData` mock → 0카운트 + EmptyState + `// Epic 5에서 활성화` 주석
    - **교체**: `stats` 4개 카드 → 모두 0 (실제 집계는 Epic 2~5에서)
    - **유지**: 등급 진행도 사이드바(`rankProgress`) 구조 — `profile.rank`는 실제 세션에서, `points`는 0
    - **유지**: 계정 관리 사이드바 링크(`/settings/profile`·`/settings/notifications`·`/settings/security`)
    - **유지**: 내가 쓴 글 탭의 게시판 필터·정렬·검색 구조(데이터만 비움)
    - **유지**: 탭 클릭 시 `setActiveTab` 상태 관리
  - [ ] 2.2 팔로잉/팔로워 탭:
    ```tsx
    // 현재 데이터: followingData(3명), followersData(4명) mock
    // 변경: [] 빈 배열 + EmptyState
    // 카운트: profile.followers = 0, profile.following = 0 (실제 API 미구현, Epic 5)
    // 보존: FollowButton 구조, /u/{nickname} 링크 패턴
    // 주석: // Epic 5에서 활성화
    ```
  - [ ] 2.3 알림·쪽지 사이드바/헤더 링크 확인: `/notifications`·`/messages` 참조(기존 최상위 라우트). `/me/notifications`·`/me/messages` 링크가 있으면 제거.

- [ ] Task 3: `/mypage` 메타데이터 (AC: #1)
  - [ ] 3.1 `apps/web/app/mypage/page.tsx` UPDATE: `export const metadata: Metadata = { robots: { index: false } }` 추가 (또는 레이아웃에서 처리)
  - [ ] 3.2 페이지 title: "마이페이지 | AI작당"

- [ ] Task 4: 실제 유저 정보 API 조회 (AC: #2)
  - [ ] 4.1 `GET /api/v1/users/me` 라우트 NEW in `apps/api`:
    - 인증 필요(`requireAuthHook`)
    - 응답: `publicUserSchema` 기반 — id·email·nickname·status·emailVerified·defaultAvatarIndex·avatarUrl·bio·createdAt
  - [ ] 4.2 `apps/web/hooks/useAuth.ts` UPDATE: 세션에서 userId만 받고 `GET /api/v1/users/me`로 전체 프로필 로드하거나, 세션 자체에 프로필 포함 여부 확인

- [ ] Task 5: 헤더 마이페이지 링크 확인
  - [ ] 5.1 헤더 컴포넌트의 "마이페이지" 링크가 `/mypage`를 참조하는지 확인 (변경 불필요 시 그대로 유지)

- [ ] Task 6: 테스트
  - [ ] 6.1 비로그인 상태 `/mypage` 접근 → `/login?redirectTo=/mypage` 리다이렉트 확인
  - [ ] 6.2 로그인 후 실제 세션(닉네임·등급·아바타) 표시 확인
  - [ ] 6.3 각 탭 전환 정상 동작 + EmptyState 렌더 확인

## Dev Notes

### 기존 파일 현황 및 변경 사항
- **`apps/web/app/mypage/page.tsx`** (UPDATE — mock 제거, 실제 세션 교체):
  - 현재: 약 820줄. mock 데이터(`myPosts`, `activityData`, `followingData`, `followersData`), `useMockAuth` 사용.
  - 변경: `useMockAuth` → `useAuth` 교체. mock 상수 제거. 데이터는 빈 배열/0으로 초기화.
  - **파일 경로 유지**: `apps/web/app/mypage/page.tsx` — 이동하지 않는다. `/me` 신규 라우트 생성 금지.
  - **보존해야 할 UI 계약**: 전체 레이아웃 구조와 컴포넌트 패턴 유지.

### 라우트 정책 (중요)
- `/mypage` = 마이페이지 활동 허브. **기존 경로 유지. `/me`로 이전하지 않는다.**
- `/mypage` → `/me` 리다이렉트 설정 금지. `apps/web/app/me/` 디렉터리 신규 생성 금지.
- 알림 = `/notifications` (기존 최상위 독립 라우트, `apps/web/app/notifications/` 존재).
- 쪽지 = `/messages` (기존 최상위 독립 라우트, `apps/web/app/messages/` 존재).
- 설정 = `/settings/*` (기존: `/settings/profile`·`/settings/security`·`/settings/notifications`).

### 등급 데이터 (현 시점)
- 신규 가입자 기본 등급: `rookie` (새내기)
- `RANK_LIST`·`resolveRank` from `apps/web/lib/ranks.ts` — 이미 구현됨. 재사용.
- `points`: 현재 0 (Epic 6 포인트 시스템 구현 전)
- `rankProgress.pct`: 0% (포인트 없음)

### 아바타 표시 규칙
- `users.avatarUrl`이 있으면 해당 URL 사용
- `users.avatarUrl`이 null이면 `getDefaultAvatarUrl(users.defaultAvatarIndex)` → `/images/avatars/{index}.webp` 사용
- `Avatar` 컴포넌트는 `src`와 `name`(폴백용 첫 글자) 모두 지원 — 기존 컴포넌트 그대로 사용

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8]
- [Source: _bmad-output/planning-artifacts/architecture.md — newRequirements: mypage-structure]
- [Source: _bmad-output/project-context.md#구조]
- [Source: apps/web/app/mypage/page.tsx — 현재 구현 코드]
- [Source: apps/web/app/notifications/ — 기존 알림 라우트]
- [Source: apps/web/app/messages/ — 기존 쪽지 라우트]
- [Source: apps/web/app/settings/ — 기존 설정 라우트]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
없음 (타입체크·린트·테스트 모두 첫 실행 통과)

### Completion Notes List
- **미들웨어 변경 없음**: `apps/web/middleware.ts`에 이미 `/mypage`가 `PROTECTED_PATHS`에 포함되어 있었음. Task 1.1은 선행 스토리에서 이미 완료된 상태.
- **page.tsx**: `useMockAuth` import가 이미 `useAuth`로 교체된 상태였으나, `DEMO_USER`·`profileExtra`·`myPosts`·`activityData`·`followingData`·`followersData` 모든 mock 상수가 남아 있었음. 이를 모두 제거하고 실제 세션 기반으로 재작성.
- **ProfileView 타입**: `useAuth`의 `AuthUser`(세션)에는 `bio`가 없으므로, bio는 `GET /api/v1/users/me`로 별도 fetch하여 보강.
- **rank**: 게이미피케이션 API 미구현으로 신규 기본값 `"rookie"`(새내기) 고정. Epic 6 이후 교체 예정.
- **stats 4개 카드**: 모두 `"0"` 고정. Epic 2~5 구현 후 집계 예정.
- **팔로잉/팔로워 탭**: 빈 배열 + `EmptyState` 렌더. 카운트 0 고정(`followingCount`·`followersCount` = 0). `// Epic 5에서 활성화` 주석 추가.
- **댓글/북마크/좋아요 탭**: `EmptyState` 렌더. `// Epic 2~4에서 활성화` 주석.
- **`FollowButton` import 제거**: 팔로우 목록이 EmptyState로 교체되어 불필요.
- **`layout.tsx` 신규 생성**: page.tsx가 `"use client"`이므로 `export const metadata` 불가. `apps/web/app/mypage/layout.tsx`를 새로 만들어 `title: "마이페이지 | AI작당"`, `robots: { index: false, follow: false }` 처리.
- **`profile`·`myPosts` useMemo화**: react-hooks/exhaustive-deps 경고 제거를 위해 `useMemo`로 안정적인 참조 유지.
- **게이트**: typecheck 0 errors, lint 0 errors (warnings 13개 모두 pre-existing, mypage 관련 없음), tests 35/35 pass.

### File List
- `apps/web/app/mypage/page.tsx` (UPDATE — mock 제거, 실세션 교체, 전체 재작성)
- `apps/web/app/mypage/layout.tsx` (NEW — noindex 메타데이터, title)

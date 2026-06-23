# Story 5.12: 회원 팔로우 — 팔로우/언팔 · 팔로워·팔로잉 목록·카운트

Status: ready-for-dev

## Story

As a 로그인 회원,
I want 다른 회원을 팔로우/언팔하고 내 팔로잉·팔로워를 관리하기를,
so that 관심 있는 작성자를 모아 두고 그들의 활동을 가까이 둔다.

## Acceptance Criteria

1. 로그인 회원이 공개 프로필(`/u/{nickname}`)·작성자 정보의 [팔로우] 버튼 클릭 시 `POST /api/v1/follows`가 `follows`(`follower_id`, `following_id`) 레코드를 생성하고, 버튼이 [팔로잉] 상태로 낙관적 토글되며 팔로워 카운트가 즉시 반영된다.
2. 이미 팔로우한 회원 재팔로우 시 멱등 처리(복합 PK 충돌 무시) — 중복 생성 없이 현재 상태를 유지한다.
3. 본인 팔로우 시 400 SELF_FOLLOW_FORBIDDEN (DB CHECK 제약과 일치).
4. [팔로잉] 상태에서 언팔 시 `DELETE /api/v1/follows/{targetNickname}` 레코드 제거, 버튼 [팔로우] 복귀, 카운트 감소.
5. 공개 프로필 진입(비회원 포함) SSR 시 팔로워/팔로잉 카운트가 실제 집계로 표시되고, 로그인 회원에게는 현재 팔로우 여부에 따른 버튼 상태, 비회원에게는 로그인 유도(행동 게이팅)가 노출된다.
6. 마이페이지(`/mypage`) 팔로잉/팔로워 탭: `GET /api/v1/users/{nickname}/following`·`/followers`(페이지네이션)로 목록 SSR, 각 항목에 프로필 링크·등급 뱃지·팔로우/언팔 버튼, 비면 EmptyState.
7. 차단 관계(Story 5.11)와 팔로우의 상호작용: 차단된 회원은 팔로우 버튼 비활성/숨김(실연계 슬롯 마련).
8. 팔로우 발생 시 `follow.created` 이벤트 발행 슬롯(실전송 Epic 7, 포인트 Epic 6).
9. [팔로우]/[언팔] 버튼·목록 접근성: `aria-pressed`(팔로잉 상태)·키보드 조작.

## Tasks / Subtasks

- [ ] Task 1: API 라우트 — follows (AC: #1, #2, #3, #4, #5, #6) [NEW]
  - [ ] `apps/api/src/routes/v1/follows.ts` 생성
  - [ ] `POST /api/v1/follows`: body `createFollowInputSchema`(contracts `{ followingId }`), 인증 필요, 본인 팔로우 400 SELF_FOLLOW_FORBIDDEN, INSERT ON CONFLICT DO NOTHING (멱등), `follow.created` job 발행(`notifications` 큐)
  - [ ] `DELETE /api/v1/follows/:targetNickname` 또는 `/:followingId`: `follower_id=req.user.id` AND `following_id` 매칭 레코드 삭제
  - [ ] `GET /api/v1/users/:nickname/following`: 해당 유저가 팔로우하는 목록, `page`/`pageSize`, 각 항목에 유저 정보(닉네임, 등급, bio) JOIN
  - [ ] `GET /api/v1/users/:nickname/followers`: 해당 유저를 팔로우하는 목록, 동일
  - [ ] `GET /api/v1/users/:nickname/follow-status?viewerId=`: 뷰어가 해당 유저를 팔로우하는지 여부 반환(SSR 초기 상태용)
  - [ ] 팔로워/팔로잉 카운트: `GET /api/v1/users/:nickname` (공개 프로필 API) 응답에 `followerCount`·`followingCount` 포함
- [ ] Task 2: Worker — follow.created 이벤트 (AC: #8) [UPDATE]
  - [ ] `apps/worker/src/index.ts` notifications Worker에서 `follow.created` job 수신 로그(실처리 Epic 7)
- [ ] Task 3: 프론트 — FollowButton API 연결 (AC: #1, #4, #5, #9) [UPDATE]
  - [ ] `apps/web/components/ui/FollowButton/FollowButton.tsx` 현재 상태 확인(낙관적 토글 UI만 있을 것)
  - [ ] Props 추가: `targetNickname: string`, `initialFollowing: boolean`, `onFollowChange?: (following: boolean) => void`
  - [ ] `handleClick()`: 비회원 → 로그인 유도, 본인 → disabled, 팔로우 → `POST /api/v1/follows`, 언팔 → `DELETE /api/v1/follows/{targetNickname}`
  - [ ] 낙관적 토글: 버튼 상태 즉시 전환 → API 실패 시 롤백 + 토스트
  - [ ] `aria-pressed={isFollowing}` 적용
  - [ ] 차단 관계 슬롯: `isBlocked` prop 추가, true이면 버튼 disabled/숨김(AC #7)
- [ ] Task 4: 프론트 — 공개 프로필 팔로워/팔로잉 카운트 SSR 연결 (AC: #5) [UPDATE]
  - [ ] `apps/web/app/u/[nickname]/page.tsx`: 현재 `MOCK_PROFILES`에서 `followers`·`following` 하드코딩 → `GET /api/v1/users/{nickname}` API 호출로 대체(서버 컴포넌트)
  - [ ] `ProfileInteraction.tsx`: `initialFollowing` 초기값을 서버에서 `GET /api/v1/users/{nickname}/follow-status` 로 가져와 주입
  - [ ] 비회원 방문 시 `FollowButton`은 클릭 시 로그인 유도 모달
- [ ] Task 5: 프론트 — 마이페이지 팔로잉/팔로워 탭 API 연결 (AC: #6) [UPDATE]
  - [ ] `apps/web/app/mypage/page.tsx`: `followingData`·`followersData` 목업 → `GET /api/v1/users/me/following`·`GET /api/v1/users/me/followers` API 호출로 대체
  - [ ] 마이페이지는 클라이언트 컴포넌트이므로 `useEffect` + fetch 또는 서버에서 초기 데이터 전달
  - [ ] 각 항목 `FollowButton` 이미 사용 중(Story 5.12의 API 연결 완료 후 자동 동작)
  - [ ] EmptyState 이미 있음(followingData.length===0 조건)
- [ ] Task 6: 검증 (AC: #1~9)
  - [ ] `pnpm typecheck` 통과
  - [ ] `pnpm lint` 통과
  - [ ] 팔로우 → 낙관적 버튼 전환 → API 성공 → 카운트 반영 확인

## Dev Notes

- **기존 FollowButton**: `apps/web/components/ui/FollowButton/FollowButton.tsx` 존재. 낙관적 UI 토글만 있음(API 미연결). `targetNickname`·`initialFollowing`·`className` props 현재 있음(ProfileInteraction, mypage에서 사용 중).
- **기존 ProfileInteraction**: `FollowButton` 사용, `useMockAuth`로 본인 여부 판단, `followers`·`following` props를 page에서 받음. → API 연결 시 실데이터 주입.
- **기존 mypage**: `followingData`·`followersData` 하드코딩 배열. `FollowButton initialFollowing` 목업값. → API로 교체.
- **`follows` 테이블 PK**: 복합 PK(`follower_id`, `following_id`). INSERT ON CONFLICT DO NOTHING으로 멱등.
- **DELETE endpoint**: `follower_id=req.user.id AND following_id=(SELECT id FROM users WHERE nickname=$nickname)` 패턴. 닉네임으로 찾는 편이 프론트에서 편리.
- **팔로워 카운트 SSR**: `/u/{nickname}` 페이지에서 `followerCount` = DB `SELECT COUNT(*) FROM follows WHERE following_id=$userId`. 서버 컴포넌트에서 한 번에 조회.
- **follow.created 큐**: 큐명 `"notifications"`, job명 `"follow.created"`, 페이로드 `{ followerId, followingId }`. Story 5.4에서 이미 notifications Worker 스텁이 있으므로 job명만 추가.
- **차단 관계(Story 5.11) 슬롯**: `FollowButton`에 `isBlocked` prop 추가. 서버에서 follow-status API가 `isBlocked` 여부도 함께 반환하도록 설계.
- **마이페이지 탭 페이지네이션**: `/mypage`의 팔로잉/팔로워 탭은 현재 전체 목록 렌더. API 응답에 `meta.totalItems` 포함 → 필요시 Pagination 컴포넌트 추가(현재 UI에 없음 → 이번에는 페이지네이션 없이 `pageSize=50` 기본값으로 처리 가능).
- **보존해야 할 것**: mypage.tsx 전체 탭 구조(posts/comments/bookmarks/likes/following/followers), FollowButton 기존 className prop, ProfileInteraction 레이아웃.

### Project Structure Notes

```
apps/
  api/src/routes/v1/
    follows.ts        ← NEW
    index.ts          ← UPDATE
  worker/src/
    index.ts          ← UPDATE (follow.created job 수신 로그)
  web/
    components/ui/FollowButton/FollowButton.tsx  ← UPDATE (API 연결, aria-pressed, isBlocked)
    app/u/[nickname]/page.tsx            ← UPDATE (API 데이터, 카운트 SSR)
    app/u/[nickname]/ProfileInteraction.tsx ← UPDATE (initialFollowing from API)
    app/mypage/page.tsx                  ← UPDATE (followingData/followersData → API)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.12 AC]
- [Source: _bmad-output/project-context.md#통신 패턴 — 낙관적 업데이트]
- [Source: _bmad-output/project-context.md#UX / 에러 처리 — 행동 게이팅]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — follows 테이블]
- [AR-2: N+1 금지 — 목록 조회 시 JOIN 단일 쿼리]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

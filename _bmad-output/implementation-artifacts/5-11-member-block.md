# Story 5.11: 회원 차단 — 등록·해제·설정 화면

Status: ready-for-dev

## Story

As a 로그인 회원,
I want 특정 회원을 차단하고 `/settings/blocks`에서 관리하기를,
so that 원치 않는 쪽지를 받지 않고 차단 회원 콘텐츠가 걸러진다.

## Acceptance Criteria

1. 로그인 회원이 프로필/작성자 정보의 [차단] 선택·확인 시 `POST /api/v1/blocks` UNIQUE 레코드 생성 + 성공 토스트.
2. 이미 차단한 회원 재차단 시 409 ALREADY_BLOCKED.
3. 차단 등록 완료 시 목록 조회 API에서 서버가 blocks 조인해 차단 회원 작성 콘텐츠를 응답에서 제외한다(콘텐츠 필터링 슬롯 마련).
4. 회원이 `/settings/blocks` 진입 시 `GET /api/v1/users/me/blocks` SSR, 각 항목 [차단 해제] 버튼, 비면 EmptyState.
5. [차단 해제] 클릭 후 확인 시 `DELETE /api/v1/blocks/{id}` 즉시 제거.
6. 본인 차단 시 400 SELF_BLOCK_FORBIDDEN.
7. [차단] 모달: 포커스 트랩·Esc·`aria-labelledby`·`aria-label`(UX-DR-U13).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 — blocks (AC: #1, #2, #3, #5, #6) [NEW]
  - [ ] `apps/api/src/routes/v1/blocks.ts` 생성
  - [ ] `POST /api/v1/blocks`: body `createBlockInputSchema`(contracts `{ blockedId }`), 인증 필요, 본인 차단 시 400 SELF_BLOCK_FORBIDDEN, UNIQUE 충돌 시 409 ALREADY_BLOCKED, 삽입
  - [ ] `GET /api/v1/users/me/blocks`: 인증 필요, `page`/`pageSize` 쿼리, 차단 목록 + 차단된 유저 닉네임/프로필 정보 JOIN, 응답 `{ items: BlockWithUser[], meta }`
  - [ ] `DELETE /api/v1/blocks/:id`: 소유자(`blocker_id`) 확인(403), 삭제
  - [ ] 콘텐츠 필터링 슬롯(AC #3): `GET /api/v1/posts` 등 목록 API에 차단 필터 적용 훅 마련. 이번 Story에서는 구조만 준비(실제 콘텐츠 필터링은 각 콘텐츠 Story에서 연계).
- [ ] Task 2: 프론트 — /settings/blocks 페이지 신규 생성 (AC: #4, #5, #7) [NEW]
  - [ ] `apps/web/app/settings/blocks/page.tsx` 생성 (서버 컴포넌트)
  - [ ] `apps/web/app/settings/blocks/BlockList.tsx` 생성 (클라이언트 컴포넌트)
  - [ ] `apps/web/app/settings/blocks/blocks.module.css` 생성
  - [ ] 서버 컴포넌트에서 `GET /api/v1/users/me/blocks` fetch(인증 쿠키 포워딩)
  - [ ] `BlockList`: 차단 목록 렌더, 각 항목에 Avatar + 닉네임 + [차단 해제] 버튼
  - [ ] [차단 해제] 클릭 → 확인 다이얼로그(`<dialog>`) → 확인 시 `DELETE /api/v1/blocks/{id}` → 즉시 목록에서 제거(낙관적 또는 router.refresh)
  - [ ] 비어있으면 `EmptyState` 컴포넌트 사용("차단한 회원이 없습니다" + 탐색 버튼)
  - [ ] 차단 해제 확인 다이얼로그: `aria-labelledby`·Esc·포커스 트랩(native `<dialog>`)
- [ ] Task 3: 프론트 — 차단 액션 (AuthorName/프로필) (AC: #1, #7) [UPDATE]
  - [ ] `apps/web/components/ui/AuthorName/AuthorName.tsx` 확인 — 드롭다운에 [차단] 메뉴 항목 존재 여부 확인
  - [ ] [차단] 클릭 시 확인 모달 → `POST /api/v1/blocks` 호출 → 성공 토스트
  - [ ] 확인 모달: `<dialog>` native, `aria-labelledby`, Esc, 포커스 트랩
  - [ ] 본인 프로필에서는 [차단] 버튼 미표시
  - [ ] `/settings/blocks` 링크를 settings 메뉴에 추가(현재 settings 페이지 확인 후)
- [ ] Task 4: settings 메뉴에 차단 목록 링크 추가 (AC: #4) [UPDATE]
  - [ ] `apps/web/app/settings/` 레이아웃 또는 사이드바에 "차단 목록" → `/settings/blocks` 링크 추가
  - [ ] mypage.tsx의 accountLinks 배열에 `{ href: '/settings/blocks', icon: 'forbid-line', label: '차단 목록' }` 추가
- [ ] Task 5: 검증 (AC: #1~7)
  - [ ] `pnpm typecheck` 통과
  - [ ] `pnpm lint` 통과

## Dev Notes

- **`/settings/blocks` 신규**: `apps/web/app/settings/` 내에 이미 `profile/`·`notifications/`·`security/` 존재. `blocks/` 폴더 신규 추가. 동일 설정 페이지 레이아웃 스타일(`settings.module.css`) 참조.
- **AuthorName 컴포넌트**: MEMORY에 따르면 클릭 시 쪽지/팔로우/계정바로가기 메뉴+등급뱃지 표시. [차단] 메뉴 항목 존재 여부 확인 후 없으면 추가. 있으면 API 연결만.
- **차단 확인 모달**: 오용 방지 위해 확인 단계 필요. native `<dialog>` 사용. "정말 {nickname}님을 차단하시겠습니까?" + [차단하기]/[취소].
- **콘텐츠 필터링 슬롯**: 게시판 목록 API에 `blocker_id` 기반 필터를 추가하는 것은 각 Epic의 목록 API 라우트에서 담당. 이 Story에서는 blocks.ts API만 구현. 필터링 연계는 주석으로 TODO 남김.
- **Epic 7 연계**: 차단 회원이 쪽지 발송 불가 처리는 Epic 7에서. 이 Story에서는 슬롯만 남김.
- **DB 접근**: `apps/api/src/routes/v1/blocks.ts`에서만 `blocks` 테이블 Drizzle 직접 접근.
- **접근성**: native `<dialog>` showModal() 로 포커스 트랩 자동. `dialog[aria-labelledby="block-modal-title"]`.
- **settings 레이아웃**: `apps/web/app/settings/` 폴더 구조 확인. `settings.module.css` 공유 CSS 참조.

### Project Structure Notes

```
apps/
  api/src/routes/v1/
    blocks.ts         ← NEW
    index.ts          ← UPDATE
  web/app/
    settings/blocks/
      page.tsx        ← NEW
      BlockList.tsx   ← NEW
      blocks.module.css ← NEW
    mypage/page.tsx   ← UPDATE (accountLinks에 차단목록 추가)
  web/components/ui/
    AuthorName/AuthorName.tsx ← UPDATE (차단 API 연결)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.11 AC]
- [Source: _bmad-output/project-context.md#UX / 에러 처리 — 모달 접근성]
- [Source: _bmad-output/project-context.md#UX / 에러 처리 — 행동 게이팅]
- [Source: _bmad-output/project-context.md#패키지 경계 & 격리]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

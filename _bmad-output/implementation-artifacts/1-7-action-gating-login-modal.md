# Story 1.7: 행동 게이팅 토대 + 로그인 유도 모달

Status: done

## Story

As a 비회원,
I want 읽기는 막히지 않되 행동 시도 시 가치를 곁들인 로그인 유도를 받고, 로그인 후 원래 행동으로 복귀하기를,
so that 벽이 아니라 부드러운 전환점을 통해 회원이 된다.

## Acceptance Criteria

1. 비회원으로 공개 페이지(목록·상세·태그 등)를 열람 시 게이팅 없이 SSR 본문이 즉시 노출된다.
2. 비회원이 행동(다운로드·작성·반응·쪽지·신고 등) 진입점을 클릭하면 차단 화면이 아니라 **가치 강조 로그인 유도 모달**이 열린다. 모달은 Esc·바깥 클릭·닫기 버튼으로 닫을 수 있다.
3. 로그인 유도 모달에는 "AI작당 회원이 되면 (혜택 1~3개)" 가치 강조 문구, [로그인] 버튼, [가입하기] 링크가 있다.
4. 모달에서 [로그인]을 클릭 시 `/login?redirectTo={현재URL+시도한행동힌트}` 로 이동한다. 로그인 완료 후 `redirectTo`로 복귀한다.
5. API가 비인증 요청의 행동(쓰기·반응·다운로드) API를 401로 거부한다(클라이언트 분기는 UX 편의일 뿐, 최종 통제는 API).
6. `useGating` 훅이 `apps/web/hooks/useGating.ts`에 구현된다: `requireAuth(action?: string)` — 로그인 상태면 `true`, 비로그인이면 로그인 유도 모달을 열고 `false` 반환.
7. 모달 포커스 트랩·Esc 닫기·배경 스크롤 잠금을 지킨다(UX-DR-U13).

## Tasks / Subtasks

- [x] Task 1: `useGating` 훅 구현 (AC: #2, #6) — NEW
  - [x] 1.1 `apps/web/hooks/useGating.ts` NEW:
    ```ts
    // useGating(): { requireAuth: (action?: string) => boolean, GatingModal: React.ReactNode }
    // requireAuth(action): useAuth().user가 있으면 true 반환
    //   없으면: setModalOpen(true) + setIntendedAction(action) + return false
    ```
  - [x] 1.2 로그인 유도 모달 상태를 전역으로 관리하거나 `GatingProvider` 컨텍스트로 관리 — 여러 컴포넌트에서 `requireAuth` 호출 시 모달이 한 번만 열리도록

- [x] Task 2: `LoginGatingModal` 컴포넌트 (AC: #2, #3, #4, #7) — NEW
  - [x] 2.1 `apps/web/components/ui/LoginGatingModal/LoginGatingModal.tsx` NEW:
    ```tsx
    // 기존 Modal 컴포넌트(`components/ui/Modal`) 재사용
    // 내용:
    //   - 아이콘 (예: remixicon "user-add-line")
    //   - 제목: "AI작당 회원이 되면"
    //   - 가치 목록 (3개): "실전 노하우 공유", "자료 다운로드", "질문·답변 참여"
    //   - [로그인] 버튼(primary) → /login?redirectTo={returnTo}
    //   - [가입하기] 링크(secondary) → /signup?redirectTo={returnTo}
    //   - [×] 닫기 버튼 상단 우측
    // UX-DR-U15: 가치 강조 톤("30초 가입으로 시작할 수 있어요"), 압박·과장 금지
    // UX-DR-U13: 포커스 트랩(Modal 컴포넌트가 처리), Esc 닫기, 배경 스크롤 잠금
    ```
  - [x] 2.2 `apps/web/components/ui/LoginGatingModal/index.ts` NEW: named export
  - [x] 2.3 `apps/web/components/ui/LoginGatingModal/LoginGatingModal.module.css` NEW: 모달 스타일 — 토큰(`var(--...)`) 사용, 하드코딩 금지

- [x] Task 3: `GatingProvider` 전역 컨텍스트 (AC: #2, #6)
  - [x] 3.1 `apps/web/contexts/GatingContext.tsx` NEW:
    ```tsx
    // GatingProvider: LoginGatingModal을 앱 루트에 마운트
    // useGating(): { requireAuth }
    ```
  - [x] 3.2 `apps/web/app/layout.tsx` UPDATE: `<GatingProvider>` 추가

- [x] Task 4: 기존 행동 진입점에 `requireAuth` 적용 (AC: #2)
  - [x] 4.1 `apps/web/app/vibe-coding/[slug]/ReactionBar.tsx` UPDATE: 좋아요 버튼 클릭 → `requireAuth('like')` 확인 후 실행
  - [x] 4.2 `apps/web/app/vibe-coding/write/page.tsx`: SSR 서버 컴포넌트이므로 미들웨어(middleware.ts) 방식이 일관적. 쓰기 페이지 게이팅은 middleware에서 처리 (보호 경로 확장은 Epic 2 글쓰기 스토리에서). 클라이언트 댓글폼/반응바에 useGating 적용으로 이 스토리 범위 충족.
  - [x] 4.3 ReactionBar (vibe-coding·automation·monetize·lounge·lounge/products·lounge/talk), CommentForm (전체 6개 게시판) — `useGating` requireAuth 적용 완료
  - [x] 4.4 북마크 버튼: ReactionBar 내 toggleBookmark에 `requireAuth('bookmark')` 적용 완료. bookmarks/page.tsx의 removeBookmark(북마크 해제)는 로그인 사용자만 접근 가능 페이지이므로 middleware 처리로 충분.
  - [x] 4.5 신고 모달(ReportModal): ReactionBar 내 신고 버튼 클릭 전 `requireAuth('report')` 확인 완료

- [x] Task 5: API 인증 가드 (AC: #5)
  - [x] 5.1 `apps/api/src/plugins/require-auth.ts` NEW: Fastify preHandler 훅 — Better Auth api.getSession()으로 세션 검증, 세션 없으면 401 반환
  - [x] 5.2 현재 apps/api에 쓰기·반응·다운로드·신고 행동 라우트 없음 → 플러그인만 정의. Epic 2~9 각 스토리에서 라우트 등록 시 requireAuthHook 추가.

- [x] Task 6: `redirectTo` 복귀 흐름 확인 (AC: #4)
  - [x] 6.1 LoginGatingModal이 `/login?redirectTo={현재URL+action힌트}` 로 이동. Story 1.4에서 구현한 middleware.ts의 redirectTo 처리와 연동됨.
  - [x] 6.2 소셜 로그인 콜백도 Better Auth 내부에서 redirectTo를 처리 (Story 1.3/1.4 구현 범위).

- [x] Task 7: 테스트 (AC: 전반)
  - [x] 7.1 `LoginGatingModal` 렌더 테스트: 열기·닫기(Esc·닫기버튼)·가치목록·로그인링크·가입하기링크 (9개 테스트 통과)
  - [x] 7.2 `useGating` 훅: 비로그인 시 → false + 모달 열림, 로그인 시 → true, 닫기 후 모달 해제 (3개 테스트 통과)
  - [x] 7.3 API 인증 가드: requireAuthHook 플러그인 구현 완료. 현재 행동 라우트 없으므로 통합 테스트는 Epic 2~9 스토리에서 추가.

## Dev Notes

### 기존 컴포넌트 재사용
- **`Modal` 컴포넌트**: `apps/web/components/ui/Modal/Modal.tsx` — 기존 Modal을 `LoginGatingModal` 내부에서 사용. 포커스 트랩·Esc·배경 스크롤 잠금은 Modal 컴포넌트가 이미 처리하는지 확인 필요.
- **`ReactionBar`**(`vibe-coding/[slug]/ReactionBar.tsx`, `automation/[slug]/ReactionBar.tsx` 등): 동일 패턴의 파일이 여러 게시판에 존재 → 공통 `useGating` 적용 방식으로 통일.
- **`ReportModal`**(`vibe-coding/[slug]/ReportModal.tsx` 등): 신고 모달도 동일 패턴.

### 행동 게이팅 범위 (FR-1.8)
- **게이팅 필요**: 다운로드(Epic 4), 글쓰기/수정/삭제(Epic 2~4), 반응(좋아요·북마크), 댓글 작성(Epic 5), 쪽지(Epic 7), 신고(Epic 9)
- **게이팅 불필요(읽기)**: 목록·상세·태그·프로필 — SSR 그대로 노출
- **이 스토리 범위**: 게이팅 토대(`useGating` + `LoginGatingModal` + `requireAuthHook`) 구현. 각 실제 기능에 `requireAuth` 적용은 해당 기능 스토리(Epic 2~9)에서 추가. 단, 현재 이미 구현된 ReactionBar·CommentForm·ReportModal에는 여기서 바로 적용.

### UX 마이크로카피 (UX-DR-U15)
- 모달 제목: "AI작당에서 더 많이 하려면" 또는 "AI작당 회원이 되면"
- 가치 목록 예시:
  - "실전자료를 바로 다운로드"
  - "질문 올리고 답변받기"  
  - "좋아요·댓글로 의견 나누기"
- 버튼 텍스트: [로그인] (primary), [가입하기] (secondary or ghost)
- **금지 표현**: "지금 바로!", "무료로!", 과장 표현 → 차분한 실전 동료 톤

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7]
- [Source: _bmad-output/project-context.md#UX / 에러 처리 — 행동 게이팅]
- [Source: _bmad-output/planning-artifacts/architecture.md#UX Design Requirements — UX-DR-U1]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- 테스트 실패 1: useGating.test.tsx에서 `act` 미사용 import → 제거
- 테스트 실패 2: LoginGatingModal에 닫기 버튼이 2개(Modal 헤더 IconButton + 푸터 Button) → `getAllByRole("button", { name: "닫기" })` 사용
- 테스트 실패 3: intendedAction이 있는 경우 href가 URL-encoded이므로 `/action=like/` regex 불일치 → `action`과 `like` 각각 포함 여부로 분리 확인

### Completion Notes List
- `GatingContext.tsx`에 `GatingProvider` 구현. `useAuth().user`를 직접 소비해 로그인 상태 판단.
- `useGating.ts`는 `useGatingContext()`의 얇은 래퍼.
- `LoginGatingModal`은 기존 `Modal` 컴포넌트 재사용 — 포커스트랩·Esc·스크롤잠금 Modal이 처리.
- Task 4.2: `vibe-coding/write/page.tsx`는 SSR 서버 컴포넌트이므로 `useGating` 적용 불가. 쓰기 페이지 보호는 `middleware.ts` 보호경로 확장으로 처리(Epic 2 글쓰기 스토리 범위).
- Task 5.2: 현재 apps/api에 행동 라우트(쓰기·반응·다운로드·신고) 없음 → `requireAuthHook` 플러그인만 정의. 등록 대상 라우트 없음.
- 전체 ReactionBar 6개, CommentForm 6개에 `useGating` requireAuth 적용 완료.

### File List
**NEW:**
- `apps/web/contexts/GatingContext.tsx`
- `apps/web/hooks/useGating.ts`
- `apps/web/hooks/useGating.test.tsx`
- `apps/web/components/ui/LoginGatingModal/LoginGatingModal.tsx`
- `apps/web/components/ui/LoginGatingModal/LoginGatingModal.module.css`
- `apps/web/components/ui/LoginGatingModal/index.ts`
- `apps/web/components/ui/LoginGatingModal/LoginGatingModal.test.tsx`
- `apps/api/src/plugins/require-auth.ts`

**UPDATED:**
- `apps/web/app/layout.tsx` — GatingProvider 마운트
- `apps/web/components/ui/index.ts` — LoginGatingModal export 추가
- `apps/web/app/vibe-coding/[slug]/ReactionBar.tsx` — requireAuth 적용
- `apps/web/app/vibe-coding/[slug]/CommentForm.tsx` — requireAuth 적용
- `apps/web/app/automation/[slug]/ReactionBar.tsx` — requireAuth 적용
- `apps/web/app/automation/[slug]/CommentForm.tsx` — requireAuth 적용
- `apps/web/app/monetize/[slug]/ReactionBar.tsx` — requireAuth 적용
- `apps/web/app/monetize/[slug]/CommentForm.tsx` — requireAuth 적용
- `apps/web/app/lounge/[slug]/ReactionBar.tsx` — requireAuth 적용
- `apps/web/app/lounge/[slug]/CommentForm.tsx` — requireAuth 적용
- `apps/web/app/lounge/products/[slug]/ReactionBar.tsx` — requireAuth 적용
- `apps/web/app/lounge/products/[slug]/CommentForm.tsx` — requireAuth 적용
- `apps/web/app/lounge/talk/[slug]/ReactionBar.tsx` — requireAuth 적용
- `apps/web/app/lounge/talk/[slug]/CommentForm.tsx` — requireAuth 적용
- `apps/web/app/lounge/gigs/[slug]/CommentForm.tsx` — requireAuth 적용

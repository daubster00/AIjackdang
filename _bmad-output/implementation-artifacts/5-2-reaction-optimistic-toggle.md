# Story 5.2: 좋아요(reaction) — 낙관적 토글 · 자가추천 차단

Status: review

## Story

As a 로그인 회원,
I want 글·질문·답변·자료·댓글에 좋아요를 즉시 토글하기를,
so that 유용한 콘텐츠에 반응하고 즉시 화면에 반영된다.

## Acceptance Criteria

1. 로그인 회원이 콘텐츠 상세 페이지에서 좋아요 버튼 클릭 시 UI 낙관적 +1 반영, `POST /api/v1/reactions` 백그라운드 INSERT, 성공 시 확정된다.
2. API 실패 시 낙관적 변경 롤백 + danger 토스트가 표시된다(UX-DR-U12).
3. 이미 좋아요 상태에서 재클릭 시 낙관적 -1, `DELETE /api/v1/reactions/{id}` 호출된다.
4. 본인 작성 콘텐츠에 좋아요 클릭 시 API 409 SELF_REACTION_FORBIDDEN 반환, 버튼이 비활성(disabled) 상태로 표시된다(AR-12·FR-9.1).
5. reaction 생성 성공 시 `stats` BullMQ 큐에 `reaction.created` job이 발행된다(포인트 적립은 Epic 6 담당).
6. 비회원 좋아요 클릭 시 로그인 유도 모달이 표시되고, 로그인 후 원래 행동이 자동 실행된다(UX-DR-U1).
7. 좋아요 버튼은 `aria-label="좋아요 N개"` · `aria-pressed` 속성을 가진다(UX-DR-U13).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 — reactions (AC: #1, #3, #4, #5) [NEW]
  - [ ] `apps/api/src/routes/v1/reactions.ts` 생성
  - [ ] `POST /api/v1/reactions`: body `createReactionInputSchema`(contracts) 검증, `user_id` = 세션에서, target 작성자 조회 → 자가추천이면 409 SELF_REACTION_FORBIDDEN, UNIQUE 충돌이면 409 ALREADY_REACTED, 삽입 후 `stats` 큐에 `reaction.created` job 발행
  - [ ] `DELETE /api/v1/reactions/:id`: `user_id` 소유자 검증 후 삭제, 비소유 시 403 FORBIDDEN
  - [ ] `GET /api/v1/reactions/me?targetType=&targetId=`: 현재 사용자의 해당 타겟 reaction 여부·id 반환(좋아요 상태 초기화용)
  - [ ] 응답 스키마: `reactionSchema`(contracts) 사용, 오류 `errorResponseSchema`(contracts) 사용
- [ ] Task 2: Worker — stats 큐 등록 (AC: #5) [UPDATE]
  - [ ] `apps/worker/src/connection.ts`의 `QUEUE_NAMES`에 `stats: "stats"` 추가
  - [ ] `apps/worker/src/index.ts`에 `stats` Worker 스텁 추가(`reaction.created` job 수신 로그만, 실처리는 Epic 6)
- [ ] Task 3: 프론트 — ReactionBar API 연결 (AC: #1, #2, #3, #6, #7) [UPDATE]
  - [ ] 대상 파일: `apps/web/app/vibe-coding/[slug]/ReactionBar.tsx` + `apps/web/app/automation/[slug]/ReactionBar.tsx` + `apps/web/app/monetize/[slug]/ReactionBar.tsx` + `apps/web/app/lounge/[slug]/ReactionBar.tsx` + `apps/web/app/lounge/products/[slug]/ReactionBar.tsx` + `apps/web/app/lounge/talk/[slug]/ReactionBar.tsx` (6개 파일 모두 동일 패턴 적용)
  - [ ] Props 확장: `likes: number`, `bookmarks: number`, `postId: string`, `targetType: string`, `authorId: string`, `initialLiked?: boolean`, `initialBookmarked?: boolean`
  - [ ] `toggleLike()`: 현재 `setLiked`/`setLikeCount` 로컬 토글 → API 호출 래핑. 비회원 체크(`useAuthGate`) → 미로그인이면 로그인 유도 모달 오픈. 낙관적 토글 먼저, API 실패 시 롤백 + danger 토스트.
  - [ ] 본인 글 여부(`authorId === currentUser.id`)이면 좋아요 버튼 `disabled` + `aria-label="내 글은 좋아요할 수 없습니다"`.
  - [ ] `aria-label="좋아요 {likeCount}개"`, `aria-pressed={liked}` 적용 (이미 `aria-pressed`는 있음, `aria-label` 추가).
  - [ ] `useAuthGate` hook 또는 기존 인증 컨텍스트 활용. 비회원 감지: `user === null`.
- [ ] Task 4: 공유 ReactionBar 컴포넌트로 리팩터링 고려 [UPDATE / 선택]
  - [ ] 6개 `ReactionBar.tsx`가 동일 로직 → `components/board/ReactionBar.tsx` 공통 컴포넌트 추출 검토. 각 페이지의 CSS 모듈 분리 유지.
  - [ ] (필수 아님 — 이번 스토리 완료 기준은 AC 충족. 리팩터링은 추가 작업으로 처리 가능)
- [ ] Task 5: 검증 (AC: #1~7)
  - [ ] `pnpm typecheck` 통과
  - [ ] `pnpm lint` 통과
  - [ ] 좋아요 토글 → 낙관적 반영 → 200 확정 / 에러 시 롤백 수동 확인

## Dev Notes

- **기존 ReactionBar 현재 상태**: `likes: number`, `bookmarks: number` props만 받고 `toggleLike`/`toggleBookmark`는 순수 로컬 state로만 동작. 기존 공유 드롭다운·신고 버튼·북마크 버튼 동작은 이 Story에서 건드리지 않는다(북마크는 Story 5.7 담당).
- **보존해야 할 것**: 공유 드롭다운(SHARE_OPTIONS), ReportModal 연결, CSS 클래스(`styles.reactionBarBtnActive` 등) — 버튼 구성·레이아웃 변경 금지.
- **API 응답 표준**: 성공=단건 페이로드 직접, 오류=`{ error: { code, message } }`. `errorResponseSchema`는 `packages/contracts/src/common.ts` 참조.
- **낙관적 업데이트 패턴**: `setLiked(prev => !prev)` → `setLikeCount(prev => liked ? prev-1 : prev+1)` 먼저 실행 → API 호출 → 실패 시 원상복구(`setLiked(prev => !prev)` 재실행 + 카운트 복구).
- **자가추천 차단(AR-12)**: API 서버에서 `target_type`에 따라 작성자 ID 조회 → `author_id === req.user.id`이면 409. 프론트는 `authorId` prop으로 미리 비활성화(UX 편의) + API도 차단(최종 통제).
- **`stats` 큐**: 큐명 kebab = `"stats"`, job명 = `"reaction.created"`, 페이로드 `{ reactionId, userId, targetType, targetId }`.
- **인증 세션**: Epic 3(인증 Story) 완료 전이라 세션 미구현 시 `req.user` 타입만 준비. 스텁으로 401 반환 가능.
- **DB 접근**: `apps/api/src/routes/v1/reactions.ts`에서만 Drizzle 직접 사용. `packages/core`·`web`에서 금지.
- **트랜잭션**: reaction INSERT + 큐 발행은 동일 트랜잭션 불요. INSERT 성공 후 큐 발행 순서로.
- **접근성**: `<button aria-label="좋아요 {n}개" aria-pressed={liked}>`. 기존 `aria-pressed`는 이미 있으므로 `aria-label` 문자열 형식만 추가.
- **UX-DR-U1 (행동 게이팅)**: 로그인 유도 모달 = `useRouter().push('/login?redirectTo='+encodeURIComponent(window.location.href))` 또는 기존 모달 컴포넌트 활용. URL redirectTo 방식 권장(메모리 콜백 금지).

### Project Structure Notes

```
apps/
  api/src/routes/v1/
    reactions.ts      ← NEW
    index.ts          ← UPDATE (reactionRoutes 등록)
  worker/src/
    connection.ts     ← UPDATE (QUEUE_NAMES.stats 추가)
    index.ts          ← UPDATE (stats Worker 스텁)
  web/app/
    vibe-coding/[slug]/ReactionBar.tsx     ← UPDATE
    automation/[slug]/ReactionBar.tsx      ← UPDATE
    monetize/[slug]/ReactionBar.tsx        ← UPDATE
    lounge/[slug]/ReactionBar.tsx          ← UPDATE
    lounge/products/[slug]/ReactionBar.tsx ← UPDATE
    lounge/talk/[slug]/ReactionBar.tsx     ← UPDATE
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2 AC]
- [Source: _bmad-output/project-context.md#통신 패턴 — 낙관적 업데이트]
- [Source: _bmad-output/project-context.md#보안 — AR-12 자가추천 차단]
- [Source: _bmad-output/project-context.md#UX / 에러 처리 — 행동 게이팅]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [AR-12: 게이미피케이션 자가추천 차단 — packages/core에서 순수 함수로 검증, API 서버 최종 통제]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

# Story 5.6: 댓글 좋아요·싫어요

Status: ready-for-dev

## Story

As a 로그인 회원,
I want 댓글에 좋아요/싫어요를 하기를,
so that 유용하거나 부적절한 댓글을 표시한다.

## Acceptance Criteria

1. 로그인 회원이 댓글 좋아요/싫어요 버튼 클릭 시 `POST /api/v1/reactions`에 `target_type='comment'`·`target_id={commentId}`·`reaction_type='like'|'dislike'` 전송, Story 5.2와 동일한 낙관적 토글·실패 롤백·자가추천 차단·비회원 게이팅 규칙이 적용된다.
2. 댓글 좋아요/싫어요 수가 각각 렌더되고, 본인이 누른 버튼이 시각적으로 구분된다(색+아이콘 변경).

## Tasks / Subtasks

- [ ] Task 1: API — reactions 라우트 댓글 지원 확인 (AC: #1) [UPDATE]
  - [ ] `apps/api/src/routes/v1/reactions.ts`의 `POST /api/v1/reactions`에서 `targetType: 'comment'` 허용 여부 확인
  - [ ] `createReactionInputSchema.targetType` enum에 `'comment'` 포함 확인(Story 5.1에서 이미 정의됨)
  - [ ] 자가추천 차단: `target_type='comment'`이면 `comments.author_id === req.user.id` 확인 후 409
  - [ ] 이미 5.2에서 처리됐으면 코드 변경 불필요(AC #1은 자동 충족)
- [ ] Task 2: 프론트 — CommentItem 좋아요 버튼 API 연결 (AC: #1, #2) [UPDATE]
  - [ ] 대상: `apps/web/app/vibe-coding/[slug]/CommentItem.tsx` + 나머지 5개 동일 구조 파일의 `CommentItem`·`ReplyItem` 내 좋아요 버튼
  - [ ] 기존 `voteState("like"|"dislike"|null)` + `likeCount`/`dislikeCount` 로컬 state 이미 있음
  - [ ] `handleVote("like"|"dislike")` → `POST /api/v1/reactions`(`targetType='comment'`, `targetId=comment.id`, `reactionType='like'|'dislike'`) API 호출로 대체(낙관적 업데이트 유지)
  - [ ] 실패 시 롤백 + danger 토스트
  - [ ] 비회원 클릭 시 로그인 유도 모달
  - [ ] 본인 댓글이면 좋아요 버튼 `disabled`
  - [ ] 아이콘: 좋아요 활성 = `thumb-up-fill`, 비활성 = `thumb-up-line` (기존과 동일)
  - [ ] **`dislike`(싫어요) 버튼은 기존 UI 그대로 유지** — 기존 CommentItem의 like/dislike 양쪽 버튼 보존. dislike 클릭 시 동일하게 낙관적 토글(`reaction_type: 'dislike'`) + 실패 롤백 처리
  - [ ] `aria-pressed={voteState === 'like'}` · `aria-label="좋아요"`, `aria-pressed={voteState === 'dislike'}` · `aria-label="싫어요"` 기존 그대로 유지
- [ ] Task 3: 검증 (AC: #1, #2)
  - [ ] `pnpm typecheck` 통과
  - [ ] 댓글 좋아요/싫어요 토글 → 낙관적 반영 → API 200 확정 확인

## Dev Notes

- **의존성**: Story 5.2(reaction API) + Story 5.4(comment CRUD) 완료 후 진행.
- **기존 CommentItem voteState**: `handleVote` 함수가 `like`/`dislike` 모두 처리. `dislike` 버튼은 제거하지 않고 기존 UI 그대로 유지. `dislikeCount` state도 보존.
- **보존**: `voteState` state명 유지, `like`/`dislike` 양쪽 API 연결. UI는 like/dislike 버튼 모두 남김.
- **ReplyItem에도 동일 적용**: `ReplyItem` 내 vote 버튼도 동일 패턴.
- **자가추천**: `comment.authorId === currentUser.id`이면 프론트에서 버튼 disabled. API에서도 차단.
- **댓글 좋아요 수 초기값**: 상세 페이지 SSR 시 `GET /api/v1/comments` 응답에 `likeCount` 포함 필요. Story 5.4의 GET 응답 스키마 확장.

### Project Structure Notes

```
apps/
  api/src/routes/v1/
    reactions.ts      ← UPDATE (comment targetType 확인/자가추천 로직)
  web/app/
    vibe-coding/[slug]/CommentItem.tsx  ← UPDATE (좋아요/싫어요 API 연결, dislike UI 유지)
    (나머지 5개 동일)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.6 AC]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2 — 동일 규칙 재사용]
- [Source: _bmad-output/project-context.md#통신 패턴 — 낙관적 업데이트]
- [AR-12: 자가추천 차단]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

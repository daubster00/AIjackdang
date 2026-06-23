# Story 5.5: 대댓글 (1단계)

Status: ready-for-dev

## Story

As a 로그인 회원,
I want 댓글에 대댓글을 달기를,
so that 댓글 맥락에서 대화를 이어간다.

## Acceptance Criteria

1. [답글] 클릭 시 대댓글 입력 폼이 열리고, 입력 후 [등록] 클릭 시 `POST /api/v1/comments`에 `parent_id={댓글id}` · 부모와 동일 `target_type`/`target_id`로 생성된다. 대댓글은 부모 아래 표시된다.
2. 대댓글에 [답글](2단계 시도) 클릭 시 API 400 NESTING_NOT_ALLOWED 반환, UI에서 2단계 입력창이 미노출된다.
3. 부모 댓글 soft-delete 시 대댓글이 존재하는 경우 부모는 "삭제된 댓글입니다", 대댓글은 그대로 노출된다.
4. 대댓글 등록 완료 시 `comment.created` 이벤트 발생(부모 작성자 대상, 전송은 Epic 7 담당).

## Tasks / Subtasks

- [ ] Task 1: API — parent_id 검증 강화 (AC: #1, #2, #4) [UPDATE]
  - [ ] `apps/api/src/routes/v1/comments.ts`의 `POST /api/v1/comments` 핸들러 수정
  - [ ] `parent_id` 있으면: 부모 댓글 조회 → `parent.parent_id IS NOT NULL`이면 400 `NESTING_NOT_ALLOWED` 반환 (2단계 차단)
  - [ ] 부모 댓글의 `target_type`/`target_id` 와 요청의 것이 일치하는지 확인
  - [ ] `comment.created` job 페이로드에 `parentCommentAuthorId: parent.authorId` 포함(부모 작성자 알림 대상)
- [ ] Task 2: 프론트 — CommentItem 대댓글 UI 연결 (AC: #1, #2, #3) [UPDATE]
  - [ ] 대상: `apps/web/app/vibe-coding/[slug]/CommentItem.tsx` + 나머지 5개 동일 구조 파일
  - [ ] 기존 `replyOpen` state + `replyValue` + 답글 폼(replyForm) 이미 있음 → 답글 [등록] 버튼 클릭 시 `POST /api/v1/comments`에 `parent_id` 포함 실제 API 호출
  - [ ] `openReply()` 호출 조건: 대댓글(`comment.parentId !== null`)이면 [답글] 버튼 미표시(2단계 UI 차단)
  - [ ] soft-delete 부모(`comment.status === 'deleted'`)에 대댓글이 있으면 "삭제된 댓글입니다" + 대댓글 목록 표시
  - [ ] 기존 `repliesVisible` toggle + `ReplyItem` 렌더 구조 유지
  - [ ] `ReplyItem`에는 [답글] 버튼 없음(2단계 차단 — `ReplyItem` 레벨에서 `openReply` 미제공)
- [ ] Task 3: 검증 (AC: #1~4)
  - [ ] `pnpm typecheck` 통과
  - [ ] 2단계 대댓글 시도 시 400 반환 확인

## Dev Notes

- **의존성**: Story 5.4(comment CRUD) 완료 후 진행. `POST /api/v1/comments` 핸들러가 이미 존재.
- **기존 CommentItem 구조**: `openReply()` → `setReplyOpen(true)`, `replyValue` state, `.replyForm` 인라인 폼, 답글 등록 버튼 이미 있음. 실제 API 호출만 추가.
- **기존 ReplyItem 구조**: `ReplyItem`은 CommentItem 내부 함수. edit/vote/report 있음. [답글] 버튼 없음 — 이 구조 유지.
- **2단계 차단 로직**: API 서버에서 parent 댓글의 `parent_id`가 non-null이면 400 반환. 프론트는 `comment.parentId !== null`이면 [답글] 버튼 렌더 안 함.
- **대댓글 표시 순서**: 등록순(createdAt ASC). 부모 댓글 목록 API에서 이미 대댓글 포함하여 반환(Story 5.4 GET 쿼리).
- **들여쓰기 CSS**: `.replyList`, `.replyItem` 클래스 이미 있음 — CSS 변경 불필요.
- **`comment.created` 이벤트**: Story 5.4에서 이미 발행. 이 Story에서 `parentCommentAuthorId` 페이로드 추가만.

### Project Structure Notes

```
apps/
  api/src/routes/v1/
    comments.ts       ← UPDATE (parent_id 검증 강화)
  web/app/
    vibe-coding/[slug]/CommentItem.tsx  ← UPDATE (답글 API 연결, 2단계 차단)
    (나머지 5개 동일)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.5 AC]
- [Source: _bmad-output/project-context.md#응답 & 데이터 포맷]
- [AR-7: soft-delete — 부모 삭제 시 대댓글 보존]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

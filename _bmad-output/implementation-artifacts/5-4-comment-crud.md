# Story 5.4: 댓글 CRUD — 작성·수정·삭제

Status: ready-for-dev

## Story

As a 로그인 회원,
I want 글·질문·자료 상세에서 댓글을 작성·수정·삭제하기를,
so that 콘텐츠에 의견을 남기고 관리한다.

## Acceptance Criteria

1. 로그인 회원이 상세 페이지 댓글 폼에서 [등록] 클릭 시 `POST /api/v1/comments`로 `{ targetType, targetId, content, parentId: null }` 생성, 댓글 목록 갱신, `comment.created` 이벤트 발생(전송은 Epic 7 담당).
2. 본인 댓글 [수정] 클릭 시 인라인 편집 폼 열림 → 저장 시 `PATCH /api/v1/comments/{id}`로 `content`·`updatedAt` 갱신. 타인 댓글 수정 시 403 FORBIDDEN.
3. 본인 댓글 [삭제] 확인 시 `DELETE /api/v1/comments/{id}` → `status=deleted`·`deleted_at` soft-delete, 화면에 "삭제된 댓글입니다" 표시.
4. 비회원이 댓글 입력 포커스 또는 [등록] 클릭 시 로그인 유도 모달이 표시된다(UX-DR-U1).
5. 빈/공백 본문 [등록] 시 400 VALIDATION_ERROR + 인라인 오류 표시.
6. 댓글 목록 SSR 렌더: 최상위 최신순, 대댓글은 부모 아래 1단계 들여쓰기.
7. [삭제] 버튼은 `<button>`·`aria-label="댓글 삭제"`·포커스 링 적용(UX-DR-U13).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 — comments (AC: #1, #2, #3, #5) [NEW]
  - [ ] `apps/api/src/routes/v1/comments.ts` 생성
  - [ ] `POST /api/v1/comments`: body `createCommentInputSchema`(contracts) — `content` 공백 trim 후 빈값 400, `parent_id`가 있으면 부모 댓글 존재 확인, 삽입, `comment.created` job 큐 발행(`notifications` 큐, 페이로드 `{ commentId, authorId, targetType, targetId, parentCommentAuthorId? }`)
  - [ ] `PATCH /api/v1/comments/:id`: 소유자 확인(403), `content` 업데이트, `updated_at` 갱신
  - [ ] `DELETE /api/v1/comments/:id`: 소유자 확인(403), `status='deleted'`·`deleted_at=now()` soft-delete
  - [ ] `GET /api/v1/comments?targetType=&targetId=&page=&pageSize=`: 목록 조회(최상위 최신순, `parent_id IS NULL` 먼저 + 각 부모의 대댓글 포함), 응답 `{ items: CommentWithReplies[], meta }`, `status='deleted'` 댓글은 content를 null로 마스킹하여 포함
  - [ ] 응답 스키마: `commentSchema`(contracts) 사용
- [ ] Task 2: Worker — notifications 큐 등록 (AC: #1) [UPDATE]
  - [ ] `apps/worker/src/connection.ts`의 `QUEUE_NAMES`에 `notifications: "notifications"` 추가
  - [ ] `apps/worker/src/index.ts`에 `notifications` Worker 스텁 추가(`comment.created` 수신 로그만, 실전송은 Epic 7)
- [ ] Task 3: 프론트 — CommentForm API 연결 (AC: #1, #4, #5) [UPDATE]
  - [ ] 대상: `apps/web/app/vibe-coding/[slug]/CommentForm.tsx` + 나머지 5개 동일 구조 파일
  - [ ] `onSubmit` 핸들러 추가: `POST /api/v1/comments` 호출, 비회원 체크 → 로그인 유도, 빈값 클라이언트 검증(400 전 차단)
  - [ ] 성공 시 textarea 초기화 + 목록 갱신(부모 컴포넌트 콜백 또는 router.refresh())
  - [ ] 실패 시 인라인 오류 메시지 표시
  - [ ] 현재 `<form>` 구조(textarea, charCount, Button) 유지 — 레이아웃 변경 금지
- [ ] Task 4: 프론트 — CommentItem API 연결 (AC: #2, #3, #7) [UPDATE]
  - [ ] 대상: `apps/web/app/vibe-coding/[slug]/CommentItem.tsx` + 나머지 5개 동일 구조 파일
  - [ ] 현재 `openEdit()` → `setEditOpen(true)` 후 저장 버튼 클릭 시 `PATCH /api/v1/comments/{id}` 호출
  - [ ] 현재 삭제 버튼(메뉴 내 `<button>`) 클릭 시 확인 후 `DELETE /api/v1/comments/{id}` 호출, 성공 시 `status=deleted` 처리(content를 "삭제된 댓글입니다"로 교체 또는 목록 갱신)
  - [ ] 삭제 버튼에 `aria-label="댓글 삭제"` 추가(이미 텍스트는 있으나 aria-label 명시 필요)
  - [ ] 타인 댓글이면 수정/삭제 메뉴 항목 미표시(`currentUser.id !== comment.authorId` 조건)
  - [ ] soft-delete 댓글(`status=deleted`) 표시: 본문 대신 "삭제된 댓글입니다" + 메뉴 미표시
  - [ ] 기존 voteState(like/dislike 토글), replyOpen, editOpen 등 기존 로컬 state·UI 구조 보존
- [ ] Task 5: 상세 페이지 댓글 목록 SSR (AC: #6) [UPDATE]
  - [ ] 각 `apps/web/app/{board}/[slug]/page.tsx` 서버 컴포넌트에서 `GET /api/v1/comments?targetType=&targetId=` 호출
  - [ ] 반환된 댓글 목록을 `CommentItem` + 대댓글 `ReplyItem`에 hydrate
  - [ ] `page.tsx`는 서버 컴포넌트이므로 fetch(cookies 포워딩)로 API 호출
- [ ] Task 6: 검증 (AC: #1~7)
  - [ ] `pnpm typecheck` 통과
  - [ ] `pnpm lint` 통과

## Dev Notes

- **기존 CommentForm 현재 상태**: `<form>` 내 textarea + charCount + Button 존재. submit 로직 없음(UI만). `onSubmit` 핸들러 추가 + API 호출 연결.
- **기존 CommentItem 현재 상태**: `openEdit()`/`openReply()`/voteState 등 로컬 state 있음. 메뉴 내 수정/삭제/신고/답변 버튼 있음. 실제 API 호출 없음. API 호출만 연결, UI 구조 변경 금지.
- **보존해야 할 것**: 메뉴 드롭다운(more-2-fill), 인라인 편집 폼(inlineForm), 답글 폼(replyForm), voteState(좋아요/싫어요 로컬), ReportModal — 이 Story는 이것들을 건드리지 않음. 수정/삭제 API만 연결.
- **`comment.created` 큐**: 큐명 = `"notifications"`, job명 = `"comment.created"`. 페이로드 `{ commentId, authorId, targetType, targetId }`.
- **소유자 확인**: `comments.author_id === req.user.id`. 아니면 403 `{ error: { code: 'FORBIDDEN', message: '권한이 없습니다.' } }`.
- **목록 쿼리 최적화**: N+1 금지(AR-2). 최상위 댓글 SELECT + `parent_id IN (최상위 id 배열)` inArray로 대댓글 일괄 조회 후 서버에서 조합.
- **서버 컴포넌트 fetch**: Next App Router에서 `cookies()` from `next/headers` 포워딩. `fetch(\`\${process.env.API_URL}/api/v1/comments?...\`, { headers: { cookie: cookieHeader } })`.
- **router.refresh()**: Next 13+ App Router에서 서버 컴포넌트 데이터 갱신. 클라이언트 컴포넌트에서 `useRouter().refresh()` 호출.
- **Soft-delete 표시**: 목록 API에서 `status=deleted` 댓글을 `{ ...comment, content: null, deletedAt: '...' }` 형태로 반환. 프론트에서 `content === null`이면 "삭제된 댓글입니다" 표시.
- **댓글 수 집계**: `posts`/`questions`/`resources` 테이블의 `comment_count` 컬럼이 있으면 댓글 INSERT 시 +1 UPDATE. 없으면 서브쿼리로 COUNT. 이 Story에서는 서브쿼리 방식 우선.

### Project Structure Notes

```
apps/
  api/src/routes/v1/
    comments.ts       ← NEW
    index.ts          ← UPDATE (commentRoutes 등록)
  worker/src/
    connection.ts     ← UPDATE (notifications 큐 추가)
    index.ts          ← UPDATE (notifications Worker 스텁)
  web/app/
    vibe-coding/[slug]/CommentForm.tsx  ← UPDATE
    vibe-coding/[slug]/CommentItem.tsx  ← UPDATE
    vibe-coding/[slug]/page.tsx         ← UPDATE (댓글 목록 SSR)
    (automation, monetize, lounge, lounge/products, lounge/talk 동일 패턴)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4 AC]
- [Source: _bmad-output/project-context.md#응답 & 데이터 포맷]
- [Source: _bmad-output/project-context.md#UX / 에러 처리]
- [Source: _bmad-output/project-context.md#프론트 선구현 — 디테일 정합성]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — 데이터 패칭]
- [AR-2: N+1 쿼리 금지 — inArray 배치 조회 사용]
- [AR-7: soft-delete — status enum + deleted_at]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

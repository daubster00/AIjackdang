# Story 9.9: 댓글 · 후기 통합 관리

Status: ready-for-dev

## Story

As a 관리자,
I want 전체 댓글·후기를 통합 목록으로 조회하고 숨김/삭제·관련 글 이동하기를,
So that 댓글 환경을 사후 관리한다.

## Acceptance Criteria

1. `/comments` 진입 시 전체 comments 목록(내용 일부·작성자·대상 콘텐츠·유형·작성일·신고수·상태). 필터(유형=일반댓글/대댓글/후기/Q&A답변·상태·신고여부·기간) URL 파라미터 반영.
2. "관련 글로 이동": `target_type`·`target_id` 기반 관련 콘텐츠 관리 화면 크로스 링크 이동(예: target_type='post' → `/posts?highlight=:id`).
3. 숨김/삭제: 9.6 위험도별 확인 동일 패턴. 내용 직접 수정 없음(UX-DR-A9).
4. 다중 선택 벌크: 일괄 숨김(즉시+토스트), 일괄 삭제(모달+사유, super_admin만).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 (AC: #1~#4)
  - [ ] `GET /api/v1/admin/comments` — 통합 목록(type/status/hasReports/dateFrom/dateTo/page/pageSize/q)
  - [ ] `PATCH /api/v1/admin/comments/:id/hide` — 숨김
  - [ ] `DELETE /api/v1/admin/comments/:id` — soft-delete (super_admin만)
  - [ ] `POST /api/v1/admin/comments/bulk` — 벌크 액션(ids[], action: 'hide'|'delete')
  - [ ] `packages/contracts/src/admin/comments.ts` NEW

- [ ] Task 2: 크로스 링크 매핑 (AC: #2)
  - [ ] `apps/admin/lib/contentCrossLink.ts` NEW: `getCrossLink(targetType, targetId)` 함수
  - [ ] 매핑: post→`/posts`, qna_question→`/qna`, resource→`/resources`, comment(대댓글)→`/comments`

- [ ] Task 3: 프런트 (AC: #1~#4)
  - [ ] `apps/admin/app/comments/page.tsx` UPDATE (완독 필수)
  - [ ] `apps/admin/app/comments/[id]/page.tsx` UPDATE: 상세 드로어 + "관련 글로 이동" 링크
  - [ ] 필터 패널: 유형 탭(일반/대댓글/후기/Q&A답변) + 상태 + 신고여부 + 기간
  - [ ] 행 액션: 숨김(즉시+토스트), 삭제(super_admin만, 모달+사유), 관련 글로 이동(링크)
  - [ ] 벌크 툴바: 일괄 숨김 / 일괄 삭제 버튼

## Dev Notes

### 의존성
- **Epic 2/3/4/5 완료 필요**: `comments` 테이블 + `target_type` enum + `comment_type` 컬럼

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/comments/page.tsx` (UPDATE): 댓글·후기 관리 더미 페이지
- `apps/admin/app/comments/[id]/page.tsx` (UPDATE): 상세 페이지

### comment_type 매핑
- 일반댓글: comment_type='comment', target_type in ('post')
- 대댓글: comment_type='reply'
- 후기: target_type='resource' (또는 comment_type='review')
- Q&A 답변: target_type in ('qna_question')

### 가드레일
- 내용 수정 버튼 없음 (UX-DR-A9: 신뢰 문제)

### Project Structure Notes
- NEW: `apps/api/src/routes/admin/comments/`, `packages/contracts/src/admin/comments.ts`, `apps/admin/lib/contentCrossLink.ts`
- UPDATE: `apps/admin/app/comments/page.tsx`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2809-2831] — AC 원문

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

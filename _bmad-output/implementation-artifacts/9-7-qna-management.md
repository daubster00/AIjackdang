# Story 9.7: Q&A 관리

Status: ready-for-dev

## Story

As a 관리자,
I want Q&A 질문·답변을 목록/필터로 조회하고 상태 강제 변경·숨김·삭제하기를,
So that 묻고답하기 질을 사후 유지한다.

## Acceptance Criteria

1. `/qna` 진입 시 질문 목록 테이블(제목·작성자·Q&A 상태·작성일·답변수·신고수·콘텐츠 상태). 질문/답변 탭 전환. 필터(Q&A 상태·콘텐츠 상태·기간·신고여부) URL 파라미터 반영.
2. 질문 상세 드로어에서 Q&A 상태 강제 변경: 드롭다운(답변대기/답변있음/해결됨) 선택·저장 → `qna_status` 갱신, 즉시+토스트. 도메인 어휘(답변대기/답변있음/해결됨) 일관 사용. "도움된 답변" 대신 지정 기능 없음(UX-DR-A9).
3. 질문/답변 숨김/삭제: 9.6 위험도별 확인 동일 패턴. `staff`는 숨김까지, 삭제는 super_admin 전용.
4. 회원 댓글/답변 내용 직접 수정 기능 없음 — 숨김/삭제 중심(UX-DR-A9).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 (AC: #1~#3)
  - [ ] `GET /api/v1/admin/qna/questions` — 질문 목록(qnaStatus/contentStatus/dateFrom/dateTo/hasReports/page/pageSize/q)
  - [ ] `GET /api/v1/admin/qna/answers` — 답변 목록(questionId?/contentStatus/hasReports/page/pageSize)
  - [ ] `PATCH /api/v1/admin/qna/questions/:id/status` — Q&A 상태 강제 변경(qnaStatus: 'pending'|'answered'|'resolved')
  - [ ] `PATCH /api/v1/admin/qna/questions/:id/hide` — 질문 숨김
  - [ ] `DELETE /api/v1/admin/qna/questions/:id` — 질문 soft-delete (super_admin만)
  - [ ] `PATCH /api/v1/admin/qna/answers/:id/hide` — 답변 숨김
  - [ ] `DELETE /api/v1/admin/qna/answers/:id` — 답변 soft-delete (super_admin만)
  - [ ] `packages/contracts/src/admin/qna.ts` NEW: Zod 스키마

- [ ] Task 2: 프런트 — Q&A 목록 (AC: #1)
  - [ ] `apps/admin/app/qna/page.tsx` UPDATE (현재 파일 완독 필수)
  - [ ] 탭: 질문 탭 / 답변 탭 (line-tabs 컴포넌트)
  - [ ] 필터 패널: Q&A 상태(드롭다운) + 콘텐츠 상태(드롭다운) + 기간 + 신고여부(체크)
  - [ ] URL 파라미터 동기화

- [ ] Task 3: 프런트 — 상세 드로어 + 상태 강제 변경 (AC: #2)
  - [ ] 질문 행 클릭 → 우측 드로어(상세: 제목/본문 미리보기/작성자/답변 목록)
  - [ ] 드로어 내 Q&A 상태 커스텀 셀렉트 + "저장" 버튼
  - [ ] 저장 → `PATCH /status` API 호출 + 즉시+토스트

- [ ] Task 4: 프런트 — 숨김/삭제 (AC: #3, #4)
  - [ ] 행 액션 메뉴: 숨김(즉시+토스트), 삭제(super_admin만, 모달+사유)
  - [ ] 내용 직접 수정 버튼 없음(UX-DR-A9 가드레일)

- [ ] Task 5: 기존 QnaForm 검토 (AC: #4)
  - [ ] `apps/admin/app/qna/_components/QnaForm.tsx` 완독: 기존 폼이 내용 수정 UI를 제공하는지 확인 → 있으면 제거

## Dev Notes

### 의존성
- **Epic 3 완료 필요**: `qna_questions`·`qna_answers` 테이블 + `qna_status` enum('pending'/'answered'/'resolved') 존재
- **9.6 패턴**: 숨김/삭제 위험도 확인 패턴 동일하게 적용

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/qna/page.tsx` (UPDATE): Q&A 관리 목록 더미 페이지
- `apps/admin/app/qna/[id]/page.tsx` (UPDATE): Q&A 상세 페이지
- `apps/admin/app/qna/_components/QnaForm.tsx` (확인 후 처리): 내용 수정 폼이면 제거/비활성화 필요
- `apps/admin/app/qna/new/page.tsx`, `apps/admin/app/qna/[id]/edit/page.tsx`: 관리자가 직접 글 쓰는 기능 — UX 가드레일(직접 수정 금지)에 따라 비활성화 또는 제거 검토

### 도메인 어휘 (일관 사용 필수)
- Q&A 상태: `답변대기` / `답변있음` / `해결됨` (EXPERIENCE.md 도메인 어휘)
- DB 값: `pending` / `answered` / `resolved` (Epic 3 스키마 기준)

### 가드레일
- "도움된 답변" 대신 지정 버튼 없음: 이는 질문자 권한. API에도 해당 필드 업데이트 라우트 없음.
- 내용 직접 수정 없음: 운영자는 숨김/삭제만. 신뢰 원칙.

### Project Structure Notes
- NEW: `apps/api/src/routes/admin/qna/`, `packages/contracts/src/admin/qna.ts`
- UPDATE: `apps/admin/app/qna/page.tsx`, `apps/admin/app/qna/[id]/page.tsx`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2761-2784] — AC 원문
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#Component Patterns] — 가드레일

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

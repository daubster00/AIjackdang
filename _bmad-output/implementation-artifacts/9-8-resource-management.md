# Story 9.8: 실전자료 관리

Status: ready-for-dev

## Story

As a 관리자,
I want 실전자료를 목록/필터로 조회하고 부적절 첨부 삭제·자료 숨김/삭제·후기 관리하기를,
So that 자료실 품질·안전성을 사후 관리한다.

## Acceptance Criteria

1. `/resources` 진입 시 자료 테이블(자료명·유형·작성자·작성일·다운로드수·평점·신고수·상태). 필터(유형·상태·신고여부·기간) URL 파라미터 반영.
2. 자료 상세 드로어에서 첨부 삭제: 모달+사유 확정 → `resource_files` soft-delete(또는 R2 파일 접근 비활성화). 안전성 보증·검수 표시 미부착(UX-DR-A9).
3. 자료 숨김/삭제: 9.6 위험도별 확인 동일 패턴(숨김 즉시+undo, 삭제 모달+사유+super_admin).
4. 후기 탭: `comments` WHERE `target_type='resource'` 목록. 후기 숨김/soft-delete, 위험도별 확인(숨김 즉시+토스트, 삭제 모달+사유).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 (AC: #1~#4)
  - [ ] `GET /api/v1/admin/resources` — 목록(type/status/hasReports/dateFrom/dateTo/page/pageSize/q)
  - [ ] `GET /api/v1/admin/resources/:id` — 상세(파일 목록 포함)
  - [ ] `PATCH /api/v1/admin/resources/:id/hide` — 자료 숨김
  - [ ] `DELETE /api/v1/admin/resources/:id` — 자료 soft-delete (super_admin만)
  - [ ] `DELETE /api/v1/admin/resources/:id/files/:fileId` — 첨부 삭제(모달+사유) — `resource_files` soft-delete
  - [ ] `GET /api/v1/admin/resources/:id/reviews` — 후기 목록(`comments` WHERE target_type='resource')
  - [ ] `PATCH /api/v1/admin/reviews/:commentId/hide` — 후기 숨김
  - [ ] `DELETE /api/v1/admin/reviews/:commentId` — 후기 soft-delete (super_admin만)
  - [ ] `packages/contracts/src/admin/resources.ts` NEW

- [ ] Task 2: R2 파일 비활성화 (AC: #2)
  - [ ] 첨부 삭제 시: `resource_files.status='deleted'` + `deleted_at=NOW()` (soft-delete)
  - [ ] R2 실제 삭제는 9.10 cleanup worker에서 30일 후 hard-delete 처리
  - [ ] **안전성 보증 표시 추가 금지**: "검수됨", "안전한 파일" 같은 레이블 API 응답에 포함 금지

- [ ] Task 3: 프런트 (AC: #1~#4)
  - [ ] `apps/admin/app/resources/page.tsx` UPDATE (완독 필수)
  - [ ] `apps/admin/app/resources/[id]/page.tsx` UPDATE: 상세 드로어 + 첨부 목록 + 삭제 버튼
  - [ ] 자료 탭 / 후기 탭 (line-tabs)
  - [ ] 첨부 삭제: 모달(사유 필수 textarea)
  - [ ] 후기 탭: comments WHERE target_type='resource' 목록 + 숨김/삭제 액션

- [ ] Task 4: 기존 ResourceForm 검토
  - [ ] `apps/admin/app/resources/_components/ResourceForm.tsx` 완독: 관리자가 직접 자료 등록/수정 가능한지 확인. 관리자 작성 자료 여부 정책 확인 (UX-DR-A9: 사후관리자이지 검수자가 아님).

## Dev Notes

### 의존성
- **Epic 4 완료 필요**: `resources`, `resource_files` 테이블, `comments.target_type='resource'` 패턴
- **9.6 패턴**: 숨김/삭제 위험도별 확인 동일

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/resources/page.tsx` (UPDATE): 실전자료 목록 더미 페이지
- `apps/admin/app/resources/[id]/page.tsx` (UPDATE): 상세 페이지
- `apps/admin/app/resources/_components/ResourceForm.tsx` (확인): 등록/수정 폼

### 가드레일 (UX-DR-A9)
- 검수됨 표시 없음
- 공식 인증 없음
- 안전성 보증 없음
- 사후 삭제·비활성화만

### Project Structure Notes
- NEW: `apps/api/src/routes/admin/resources/`, `packages/contracts/src/admin/resources.ts`
- UPDATE: `apps/admin/app/resources/page.tsx`, `apps/admin/app/resources/[id]/page.tsx`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2785-2807] — AC 원문

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

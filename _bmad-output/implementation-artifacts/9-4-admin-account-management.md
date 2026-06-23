# Story 9.4: 운영자 계정 관리 (최고관리자 전용)

Status: ready-for-dev

## Story

As a 최고관리자,
I want 가입 대기 운영자를 승인·반려하고 역할·상태를 관리하기를,
So that 승인된 운영자만 접근하고 역할별 권한 경계가 집행된다.

## Acceptance Criteria

1. `/admin-members` 접근 시 `admin_users` 목록 테이블 렌더: 컬럼 — 이름·이메일·연락처·역할·상태·가입일·승인일·승인자. 상태 필터(pending/active/suspended/disabled)·검색·페이지네이션(URL 파라미터 반영). `staff` 접근 시 권한 거부 화면 + API 403.
2. pending 행 승인: 모달에서 역할(staff|super_admin) 선택 + 사유 메모 입력 확정 → `status=active`, `approved_by`(현재 관리자 id), `approved_at`, `note` 갱신, 성공 토스트. 사유 메모 비어있으면 확정 버튼 비활성(UX-DR-A4).
3. pending 행 반려: 모달에서 사유 메모 입력 확정 → `status=disabled`, `note` 갱신, 이후 로그인 불가, 사유 없이 반려 버튼 비활성.
4. active 운영자 정지: 모달+사유 입력 확정 → `status=suspended`, 기존 `admin_sessions` 즉시 무효화(전체 삭제). 재활성 가능(모달+사유 유지, status=active 복원).
5. 역할 변경(staff↔super_admin): 모달+사유 입력 확정 → `role` 갱신, 세션 즉시 반영(세션 무효화 후 재발급 유도). 최고관리자 자기 자신의 역할 변경 시도 → 403 반환("자신의 역할을 변경할 수 없습니다.").
6. `staff`가 `/admin-members` URL 직접 접근 시 화면 거부 + API 403(9.3과 동일 권한 게이트).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 구현 (AC: #1~#5)
  - [ ] `apps/api/src/routes/admin/admin-members/` 폴더 NEW (운영자 계정 관리 API — 일반 회원 `members/` 와 별개)
  - [ ] `GET /api/v1/admin/admin-members` — 목록 조회(page/pageSize/status/search, 응답: `{ items, meta }`)
  - [ ] `PATCH /api/v1/admin/admin-members/:id/approve` — 승인(role, note 필수)
  - [ ] `PATCH /api/v1/admin/admin-members/:id/reject` — 반려(note 필수)
  - [ ] `PATCH /api/v1/admin/admin-members/:id/suspend` — 정지(note 필수) + admin_sessions 전체 삭제
  - [ ] `PATCH /api/v1/admin/admin-members/:id/activate` — 재활성(note 필수)
  - [ ] `PATCH /api/v1/admin/admin-members/:id/role` — 역할 변경(role, note 필수) + 자기 자신 변경 403 가드
  - [ ] `packages/contracts/src/admin/admin-members.ts` NEW: Zod 스키마(요청/응답)
  - [ ] `requireSuperAdmin` preHandler(9.3에서 생성) 전체 라우트에 적용

- [ ] Task 2: 서비스 레이어 (AC: #2~#5)
  - [ ] `apps/api/src/routes/admin/admin-members/service.ts` NEW
  - [ ] `approveAdmin(id, role, note, approverId)`: 트랜잭션 — admin_users UPDATE
  - [ ] `rejectAdmin(id, note)`: admin_users UPDATE status=disabled
  - [ ] `suspendAdmin(id, note)`: 트랜잭션 — admin_users UPDATE status=suspended + admin_sessions DELETE WHERE adminUserId=id
  - [ ] `activateAdmin(id, note)`: admin_users UPDATE status=active
  - [ ] `changeAdminRole(id, role, note, requesterId)`: 자기 자신 방지 체크, admin_users UPDATE + admin_sessions DELETE

- [ ] Task 3: 어드민 프런트 — `/admin-members` 페이지 (AC: #1, #6)
  - [ ] 기존 `apps/admin/app/admin-members/page.tsx` 유지 (경로 이전·rename 하지 않음)
  - [ ] `apps/admin/app/admin-members/page.tsx` UPDATE: 더미 데이터 → `GET /api/v1/admin/admin-members` 실제 API 호출
  - [ ] 테이블 컬럼: 이름·이메일·연락처·역할(badge)·상태(badge)·가입일·승인일·승인자
  - [ ] 필터 패널: 상태 필터(pending/active/suspended/disabled) + 검색(이름/이메일)
  - [ ] URL 파라미터 반영(`?page=1&status=pending&q=`)
  - [ ] 페이지네이션 컴포넌트 연결

- [ ] Task 4: 모달 연동 (AC: #2~#5)
  - [ ] 승인 모달(`adminMemberApprove`): 역할 선택(radio: staff/super_admin) + 사유 textarea(필수) → confirm disabled until 사유 입력. API `PATCH /api/v1/admin/admin-members/:id/approve` 호출
  - [ ] 반려 모달(`adminMemberReject`): 사유 textarea(필수) → confirm disabled. API `PATCH /api/v1/admin/admin-members/:id/reject` 호출
  - [ ] 정지 모달(NEW): 사유 textarea(필수) + 위험 확인 알림 → API `PATCH /suspend`
  - [ ] 역할 변경 모달(NEW): 새 역할 선택 + 사유(필수) → API `PATCH /role`
  - [ ] 모든 모달: 성공 → 토스트 + 목록 갱신, 실패 → 오류 토스트
  - [ ] 자기 자신 역할 변경 시 UI에서도 버튼 비활성(현재 세션 id와 row id 비교)

- [ ] Task 5: 접근 제어 확인 (AC: #6)
  - [ ] 9.3에서 구현된 `PermissionDenied` 컴포넌트·`requireSuperAdmin` preHandler 연결 확인

## Dev Notes

### 의존성
- **9.1 완료**: `admin_users`, `admin_sessions` 테이블, `AdminRole`, `hasAdminPermission`
- **9.2 완료**: 세션 발급, 로그인 동작
- **9.3 완료**: `requireSuperAdmin` preHandler, `PermissionDenied` 컴포넌트, 미들웨어 인증 게이트

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/admin-members/page.tsx` (UPDATE or MOVE): 현재 관리회원 목록 더미 페이지. 승인/반려 모달 마크업 포함(id: adminMemberApprove, adminMemberReject). 더미 `ADMIN_MEMBERS` 배열, `ADMIN_GRADE_BADGE`, `STATUS_BADGE` 매핑. 실제 API 연동 없음.
- `apps/admin/app/admin-members/[id]/page.tsx`: 관리회원 상세 페이지 확인 필요.
- `apps/admin/app/admin-members/grades/page.tsx`, `apps/admin/app/admin-members/permissions/page.tsx`: 현재 별도 화면 확인 필요.

### 경로 정합성 주의
기존 코드 기준 `/admin-members`가 정식 경로다. UX IA의 `/admin-accounts` 표기는 무시하고 `/admin-members`로 통일한다. AdminShell NAV_GROUPS 및 API 라우트 모두 `admin-members`를 사용(일반 회원 관리 `/members`와 별도 경로로 유지). 경로 이전·rename 작업 없음.

### 위험도별 확인 UX
- pending 승인/반려: **모달+사유 필수** (위험·되돌리기 어려움 카테고리)
- active 정지/재활성: **모달+사유 필수**
- 역할 변경: **모달+사유 필수**
- 사유 없이 확정 버튼 비활성: textarea 비어있으면 `disabled` 상태 유지
[Source: EXPERIENCE.md#위험도별 파괴적 확인 UX]

### 세션 즉시 무효화 패턴
정지/역할변경 시 `DELETE FROM admin_sessions WHERE admin_user_id = :id`. 해당 관리자는 다음 요청에서 401을 받고 로그인 화면으로 이동.

### API 응답 포맷
- 목록: `{ items: AdminUserRow[], meta: { page, pageSize, totalItems, totalPages } }`
- 단건 액션: `{ adminUser: AdminUserRow }` (갱신된 레코드)
- 오류: `{ error: { code: "SELF_ROLE_CHANGE_FORBIDDEN", message: "자신의 역할을 변경할 수 없습니다." } }`

### Project Structure Notes
- NEW: `apps/api/src/routes/admin/admin-members/` (운영자 계정 관리 API 라우트), `packages/contracts/src/admin/admin-members.ts`
- UPDATE: `apps/admin/app/admin-members/page.tsx` (더미 데이터 → 실제 API 연동, 모달 연결)

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2665-2695] — AC 원문
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#Permissions] — 역할 매트릭스

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

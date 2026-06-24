# Story 9.4: 운영자 계정 관리 (최고관리자 전용)

Status: done

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
7. `/admin-members/grades` 진입 시 운영자 역할 등급표(staff/super_admin 역할명·설명·접근 가능 메뉴·위험 액션 권한 여부) 읽기 전용 렌더. 실시간 편집 불가(코드 수준 역할 정의를 참조 목적으로 표시). `super_admin`만 접근.
8. `/admin-members/permissions` 진입 시 메뉴×역할 권한 매트릭스(체크박스 그리드 형태, 읽기 전용) 렌더. `hasAdminPermission` 함수 정의 기반 정적 표시. `super_admin`만 접근.

## Tasks / Subtasks

- [x] Task 1: API 라우트 구현 (AC: #1~#5)
  - [x] `apps/api/src/routes/admin/admin-members/` 폴더 NEW (운영자 계정 관리 API — 일반 회원 `members/` 와 별개)
  - [x] `GET /api/v1/admin/admin-members` — 목록 조회(page/pageSize/status/search, 응답: `{ items, meta }`)
  - [x] `PATCH /api/v1/admin/admin-members/:id/approve` — 승인(role, note 필수)
  - [x] `PATCH /api/v1/admin/admin-members/:id/reject` — 반려(note 필수)
  - [x] `PATCH /api/v1/admin/admin-members/:id/suspend` — 정지(note 필수) + admin_sessions 전체 삭제
  - [x] `PATCH /api/v1/admin/admin-members/:id/activate` — 재활성(note 필수)
  - [x] `PATCH /api/v1/admin/admin-members/:id/role` — 역할 변경(role, note 필수) + 자기 자신 변경 403 가드
  - [x] `packages/contracts/src/admin/admin-members.ts` NEW: Zod 스키마(요청/응답)
  - [x] `requireSuperAdmin` preHandler(9.3에서 생성) 전체 라우트에 적용

- [x] Task 2: 서비스 레이어 (AC: #2~#5)
  - [x] `apps/api/src/routes/admin/admin-members/service.ts` NEW
  - [x] `approveAdmin(id, role, note, approverId)`: 트랜잭션 — admin_users UPDATE
  - [x] `rejectAdmin(id, note)`: admin_users UPDATE status=disabled
  - [x] `suspendAdmin(id, note)`: 트랜잭션 — admin_users UPDATE status=suspended + admin_sessions DELETE WHERE adminUserId=id
  - [x] `activateAdmin(id, note)`: admin_users UPDATE status=active
  - [x] `changeAdminRole(id, role, note, requesterId)`: 자기 자신 방지 체크, admin_users UPDATE + admin_sessions DELETE

- [x] Task 3: 어드민 프런트 — `/admin-members` 페이지 (AC: #1, #6)
  - [x] 기존 `apps/admin/app/admin-members/page.tsx` 유지 (경로 이전·rename 하지 않음)
  - [x] `apps/admin/app/admin-members/page.tsx` UPDATE: 서버 컴포넌트 래퍼 + AdminMembersClient로 분리
  - [x] 테이블 컬럼: 이름·이메일·연락처·역할(badge)·상태(badge)·가입일·승인일·승인자
  - [x] 필터 패널: 상태 필터(pending/active/suspended/disabled) + 검색(이름/이메일)
  - [x] URL 파라미터 반영(`?page=1&status=pending&q=`)
  - [x] 페이지네이션 컴포넌트 연결

- [x] Task 4: 모달 연동 (AC: #2~#5)
  - [x] 승인 모달(`adminMemberApprove`): 역할 선택(radio: staff/super_admin) + 사유 textarea(필수) → confirm disabled until 사유 입력. API `PATCH /api/v1/admin/admin-members/:id/approve` 호출
  - [x] 반려 모달(`adminMemberReject`): 사유 textarea(필수) → confirm disabled. API `PATCH /api/v1/admin/admin-members/:id/reject` 호출
  - [x] 정지 모달(NEW): 사유 textarea(필수) + 위험 확인 알림 → API `PATCH /suspend`
  - [x] 역할 변경 모달(NEW): 새 역할 선택 + 사유(필수) → API `PATCH /role`
  - [x] 모든 모달: 성공 → 토스트 + 목록 갱신, 실패 → 오류 토스트
  - [x] 자기 자신 역할 변경 시 UI에서도 버튼 비활성(현재 세션 id와 row id 비교)

- [x] Task 5: 접근 제어 확인 (AC: #6)
  - [x] 9.3에서 구현된 `PermissionDenied` 컴포넌트·`requireSuperAdmin` preHandler 연결 확인

- [x] Task 6: 역할 등급표 + 권한 매트릭스 (AC: #7, #8)
  - [x] `apps/admin/app/admin-members/grades/page.tsx` UPDATE (완독 필수): staff/super_admin 역할 정의를 정적 상수로 정의 → 카드 그리드 렌더(역할명·설명·주요 권한 목록). 실제 DB 쿼리 없음.
  - [x] `apps/admin/app/admin-members/permissions/page.tsx` UPDATE (완독 필수): `packages/auth`의 `hasAdminPermission` 권한맵을 바탕으로 `행=메뉴/기능, 열=staff/super_admin` 체크박스 그리드 읽기 전용 렌더. 실제 DB 쿼리 없음.
  - [x] 두 페이지 모두 `super_admin`만 접근(9.3 PermissionDenied 패턴 적용)

## Dev Notes

### 의존성
- **9.1 완료**: `admin_users`, `admin_sessions` 테이블, `AdminRole`, `hasAdminPermission`
- **9.2 완료**: 세션 발급, 로그인 동작
- **9.3 완료**: `requireSuperAdmin` preHandler, `PermissionDenied` 컴포넌트, 미들웨어 인증 게이트

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/admin-members/page.tsx` (UPDATE or MOVE): 현재 관리회원 목록 더미 페이지. 승인/반려 모달 마크업 포함(id: adminMemberApprove, adminMemberReject). 더미 `ADMIN_MEMBERS` 배열, `ADMIN_GRADE_BADGE`, `STATUS_BADGE` 매핑. 실제 API 연동 없음.
- `apps/admin/app/admin-members/[id]/page.tsx`: 관리회원 상세 페이지 확인 필요.
- `apps/admin/app/admin-members/grades/page.tsx` (UPDATE): 역할 등급 카드 더미 페이지. DB 쿼리 없이 정적 상수 기반으로 렌더 예정.
- `apps/admin/app/admin-members/permissions/page.tsx` (UPDATE): 권한 매트릭스 더미 페이지. `hasAdminPermission` 정적 권한맵 참조해 체크박스 그리드 렌더 예정.

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
claude-sonnet-4-6

### Debug Log References
- contracts/admin-members.ts — 이미 stub로 완성된 상태로 제공됨 (재작성 없음)
- routes/admin/admin-members/index.ts — stub가 이미 전체 구현으로 제공됨
- routes/admin/admin-members/service.ts — stub가 이미 전체 구현으로 제공됨
- 프론트엔드 page.tsx — 3개 모두 이미 새 버전으로 교체된 상태로 제공됨

### Completion Notes List
- contracts, API 라우트, 서비스 레이어는 모두 오케스트레이터가 사전 생성한 완성 버전으로 제공됨
- 프론트엔드 3개 페이지(admin-members/page.tsx, grades/page.tsx, permissions/page.tsx) 실제 구현 완료
- page.tsx → 서버 컴포넌트(세션 체크) + AdminMembersClient(클라이언트, 실제 API 호출+모달) 분리 패턴
- permissions/page.tsx → 서버 컴포넌트(세션 체크) + PermissionsMatrix(클라이언트) 분리
- contracts typecheck: 통과
- api typecheck: admin-members 관련 에러 0 (타 에이전트 파일 에러만 존재)
- admin typecheck: admin-members 관련 에러 0 (stats/page.tsx 등 타 파일 에러만 존재)
- vitest 8개 테스트 통과 (자기자신 역할변경 403, suspend 세션삭제, approve 상태전이 등 핵심 케이스)
- 공유 파일 4개(schema/index.ts, contracts/src/index.ts, routes/admin/index.ts, routes/v1/index.ts) 미수정 확인

### File List
- packages/contracts/src/admin/admin-members.ts (기존 stub → 완성 버전으로 제공됨)
- apps/api/src/routes/admin/admin-members/index.ts (기존 stub → 완성 버전으로 제공됨)
- apps/api/src/routes/admin/admin-members/service.ts (NEW, 오케스트레이터 생성)
- apps/api/src/routes/admin/__tests__/admin-members.service.test.ts (NEW)
- apps/admin/app/admin-members/page.tsx (UPDATE — 서버 컴포넌트 래퍼로 교체)
- apps/admin/app/admin-members/AdminMembersClient.tsx (NEW — 클라이언트 컴포넌트)
- apps/admin/app/admin-members/grades/page.tsx (UPDATE — super_admin 접근 체크 + 정적 역할표)
- apps/admin/app/admin-members/permissions/page.tsx (UPDATE — 서버 컴포넌트 래퍼로 교체)
- apps/admin/app/admin-members/permissions/PermissionsMatrix.tsx (NEW — 클라이언트 컴포넌트)

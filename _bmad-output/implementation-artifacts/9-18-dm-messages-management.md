# Story 9.18: 쪽지(DM) 모더레이션 관리

Status: done

## Story

As a 관리자,
I want 회원 간 쪽지(DM)를 목록 조회하고 스팸·신고된 쪽지를 숨김·발신제한·삭제 처리하기를,
So that 쪽지 채널의 스팸·괴롭힘을 운영 개입으로 차단한다.

## Acceptance Criteria

1. `/messages` 진입 시 `messages` 테이블 목록(발신자·수신자·내용 미리보기·발송일·스팸 배지·신고수·상태) + 탭(전체/신고있음/숨김) + 필터(신고여부·기간) URL 파라미터 반영. 스팸 배지: 수신자가 신고했거나 `hidden_by_admin=true`인 메시지에 표시.
2. `/messages/[id]` 진입 시 쪽지 원문(발신자·수신자·전송일·본문) + 해당 메시지에 연결된 신고 목록(신고자·사유·신고일·신고 상태) 렌더.
3. 숨김 처리: 행 메뉴 또는 상세에서 숨김 클릭 → `messages.hidden_by_admin=true` 즉시 처리 + 토스트(undo). 수신자·발신자 양쪽에서 비노출. `staff`·`super_admin` 모두 가능.
4. 숨김 복구: 숨김 상태 쪽지에서 복구 클릭 → `messages.hidden_by_admin=false` 복원 + 토스트.
5. 발신제한: 행 메뉴 발신제한 클릭 → 기간(일 수)·사유 입력 모달 확정 → `user_sanctions`(`user_id`=발신자·`type='message_restriction'`·`endsAt`·`note`·`issuedBy`) 생성 + 토스트. 사유 없이 확정 불가(UX-DR-A4). 쪽지 발송 API에서 발신자의 `message_restriction` 제재 존재 시 403 차단.
6. 삭제(최고관리자 전용): 모달+사유 확정 → `messages` soft-delete(`deleted_at` 갱신) + 토스트(위험 액션). `staff` UI 숨김·API 403.
7. 벌크 액션: 다중 선택 후 벌크 숨김(즉시) / 벌크 삭제(모달+사유, 최고관리자 전용).
8. `staff`가 `/messages` 접근 시 조회·숨김·발신제한 가능. 삭제는 `super_admin`만.

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 변경 (AC: #3, #4, #6)
  - [ ] `packages/database/src/schema/messaging.ts` UPDATE (완독 필수): `messages` 테이블에 `hiddenByAdmin` boolean DEFAULT false + `deletedAt` timestamp nullable 컬럼 추가
  - [ ] `packages/database/drizzle/` 마이그레이션 생성 (`drizzle-kit generate`)
  - [ ] `packages/database/drizzle/` 마이그레이션 적용 (`drizzle-kit migrate`)

- [ ] Task 2: 제재 타입 확장 (AC: #5)
  - [ ] `packages/database/src/schema/users.ts` (또는 sanctions 스키마): `user_sanctions.type` enum에 `'message_restriction'` 추가 (Epic 9.12와 공유 스키마 — 충돌 없이 enum 확장)
  - [ ] 마이그레이션 생성 + 적용 (Task 1과 단일 마이그레이션으로 묶기 가능)

- [ ] Task 3: API 라우트 (AC: #1~#8)
  - [ ] `apps/api/src/routes/admin/messages/` 폴더 NEW
  - [ ] `GET /api/v1/admin/messages` — 목록 조회(page/pageSize/tab/hasReport/from/to, `hidden_by_admin`, 신고 수 JOIN)
  - [ ] `GET /api/v1/admin/messages/:id` — 상세 + 연결 신고 목록
  - [ ] `PATCH /api/v1/admin/messages/:id/hide` — `hidden_by_admin=true`
  - [ ] `PATCH /api/v1/admin/messages/:id/unhide` — `hidden_by_admin=false`
  - [ ] `DELETE /api/v1/admin/messages/:id` — soft-delete(super_admin 전용, `requireSuperAdmin` preHandler)
  - [ ] `POST /api/v1/admin/messages/:id/restrict-sender` — 발신자 `user_sanctions` 생성(기간·사유 필수)
  - [ ] `POST /api/v1/admin/messages/bulk-hide` — 벌크 숨김
  - [ ] `DELETE /api/v1/admin/messages/bulk` — 벌크 삭제(super_admin 전용)
  - [ ] `packages/contracts/src/admin/messages.ts` NEW: 요청/응답 Zod 스키마
  - [ ] `apps/api/src/routes/admin/index.ts` UPDATE: messages 라우터 등록

- [ ] Task 4: 쪽지 발송 API 제재 게이트 (AC: #5)
  - [ ] `apps/api/src/routes/v1/messages.ts` UPDATE (완독 필수): `POST /api/v1/messages` 발송 시 발신자의 `user_sanctions` 조회 → `type='message_restriction'` 유효한 제재(`endsAt > now()` 또는 영구) 존재 시 403 `MESSAGE_SENDING_RESTRICTED`

- [ ] Task 5: 어드민 프런트 — `/messages` 목록 (AC: #1, #3, #4, #7)
  - [ ] `apps/admin/app/messages/page.tsx` UPDATE (완독 필수): 더미 데이터 → 실제 API 연동
  - [ ] 탭: 전체 / 신고있음 / 숨김 (`.line-tabs` 패턴)
  - [ ] 필터: 신고여부 셀렉트, 기간 날짜, 초기화·검색 버튼
  - [ ] 테이블: 체크박스, 발신자·수신자·내용미리보기·발송일·스팸배지(hidden_by_admin=true 또는 신고 있음)·신고수·상태
  - [ ] 행 메뉴(⋮): 원문보기(`/messages/[id]`)·신고내역·숨김·숨김복구·발신제한·삭제(super_admin만)
  - [ ] 벌크 선택 시 상단 일괄 처리 버튼 활성화 (숨김 즉시 / 삭제 모달)
  - [ ] 발신제한 모달: 기간(일 수 입력) + 사유(textarea, 필수) + 확정 버튼(사유 없으면 disabled)

- [ ] Task 6: 어드민 프런트 — `/messages/[id]` 상세 (AC: #2, #3, #4, #6)
  - [ ] `apps/admin/app/messages/[id]/page.tsx` UPDATE (완독 필수): 더미 → API 연동
  - [ ] 쪽지 원문 카드: 발신자·수신자·전송일·본문
  - [ ] 신고 내역 섹션: 신고자·사유·신고일·신고상태 테이블
  - [ ] 액션 버튼: 숨김/복구 + 발신제한 + 삭제(super_admin만)

## Dev Notes

### 의존성
- **7.4 완료**: `messages` 테이블, `POST /api/v1/messages` 쪽지 발송 API 존재
- **5.x 완료**: `reports` 테이블, messages 신고 가능 (`target_type='message'`)
- **9.1 완료**: admin 인증, `requireSuperAdmin` preHandler
- **9.3 완료**: AdminShell, adminGuard 미들웨어
- **9.12 완료**: `user_sanctions` 테이블, 제재 패턴 (message_restriction 타입 추가 필요)

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/messages/page.tsx` (UPDATE): 더미 쪽지 관리 목록 페이지. 스팸 배지 표시, 탭·필터·행 메뉴 마크업 포함. 실제 API 연동 없음.
- `apps/admin/app/messages/[id]/page.tsx` (UPDATE): 더미 쪽지 상세 페이지. 원문 카드·신고 내역 마크업 포함.
- `apps/api/src/routes/v1/messages.ts`: 유저 쪽지 발송·조회 API. `POST /api/v1/messages` 발신 제한 게이트 추가 필요.
- `packages/database/src/schema/`: messaging 스키마 파일 경로 확인 필요.

### Nav IA 위치
AdminShell Operation 그룹: 신고 관리 → 쪽지 관리 → 회원 관리 → 운영자 계정 관리 순
`{ key: "messages", href: "/messages", icon: "ri-mail-line", label: "쪽지 관리" }` (9.3 Task 3에서 추가)

### 숨김 vs 삭제 구분
- **숨김**: `hidden_by_admin=true`, 발신자·수신자 모두 비노출, 복구 가능, `staff`도 가능
- **삭제**: `deleted_at` soft-delete, 30일 후 9.10 cleanup worker hard-delete, `super_admin`만

### 발신제한 타입
`user_sanctions.type = 'message_restriction'` — 발송 API에서 이 타입 체크. 기존 `warning/suspension/permanent_ban` 타입과 독립 작동(계정 정지와 별개로 쪽지만 제한 가능).

### 위험도별 확인 UX (UX-DR-A4)
- 숨김: 즉시 + 토스트(undo) — 저위험
- 발신제한: 모달 + 사유 필수 — 중위험
- 삭제: 모달 + 사유 필수, super_admin 전용 — 고위험

### API 응답 포맷
```ts
// 목록 응답
{ items: MessageAdminRow[], meta: { page, pageSize, totalItems, totalPages } }

// MessageAdminRow
{
  id: string,
  senderId: string, senderNickname: string,
  receiverId: string, receiverNickname: string,
  bodyPreview: string, // 첫 100자
  createdAt: string,
  hiddenByAdmin: boolean,
  reportCount: number,
  deletedAt: string | null
}
```

### Project Structure Notes
- NEW: `apps/api/src/routes/admin/messages/`, `packages/contracts/src/admin/messages.ts`
- UPDATE: `packages/database/src/schema/messaging.ts` (hiddenByAdmin, deletedAt 컬럼 추가), `apps/api/src/routes/v1/messages.ts` (발신제한 게이트), `apps/admin/app/messages/page.tsx`, `apps/admin/app/messages/[id]/page.tsx`, `apps/api/src/routes/admin/index.ts`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Epic9] — Epic9 범위 및 UX-DR 규칙
- [Source: _bmad-output/implementation-artifacts/9-10-report-queue-processing-cleanup-worker.md] — 신고 처리 패턴 참조
- [Source: _bmad-output/implementation-artifacts/9-12-member-management-sanctions.md] — user_sanctions 패턴 참조

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

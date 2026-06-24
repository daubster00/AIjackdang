# Story 9.12: 회원 관리 — 제재·포인트·등급·뱃지 수동 조작

Status: done

## Story

As a 관리자,
I want 회원을 목록 조회하고 상태 변경(이용제한)·포인트 지급/차감·등급 변경·뱃지 지급/회수하기를,
So that 참여를 촉진하고 위반 회원을 절차적으로 제재한다.

## Acceptance Criteria

1. `/members` 목록(닉네임·이메일·가입일·등급·포인트·게시글수·신고수·상태). 필터(상태 정상/이용제한/탈퇴·등급·기간)·검색 URL 파라미터 반영(UX-DR-A8).
2. 회원 상세 드로어에서 이용제한/영구정지: 유형(경고/일시정지/영구정지) + 사유 메모 + 종료일(일시정지) 입력·확정 → `user_sanctions` 생성 + `users.status`·`suspended_until` 트랜잭션 갱신(ADR-0002). 사유 없이 불가.
3. 제재 회원 API 접근 시 403 "이용이 제한된 계정입니다." (기존 Epic 1 유저 guard에서 처리되어야 함 — 이 스토리에서 검증).
4. 포인트 수동 지급: 금액+사유 → `points_ledger`(`type='admin_grant'`) 생성, 토스트.
5. 포인트 차감: 모달+금액+사유 확정 → `points_ledger`(`type='admin_deduct'`) 생성(위험 액션, 모달+사유 필수).
6. 등급 수동 변경: 모달+사유 확정 → `users.grade`(또는 캐시) 갱신(위험 액션).
7. 뱃지 수동 지급: 뱃지 선택+저장 → `user_badges` 생성, 즉시+토스트.
8. 뱃지 회수: 모달+사유 확정 → `user_badges` 삭제(위험 액션).
9. `staff`가 권한 변경·영구 삭제 시도 → UI 숨김·API 403(최고관리자 전용).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 (AC: #1~#9)
  - [ ] `GET /api/v1/admin/members` — 목록
  - [ ] `GET /api/v1/admin/members/:id` — 상세(활동 수치 포함)
  - [ ] `POST /api/v1/admin/members/:id/sanctions` — 이용제한 생성(type/note/endsAt 필수) + 트랜잭션
  - [ ] `DELETE /api/v1/admin/members/:id/sanctions/:sanctionId` — 제재 해제 (super_admin만)
  - [ ] `POST /api/v1/admin/members/:id/points` — 수동 지급(amount/note)
  - [ ] `DELETE /api/v1/admin/members/:id/points` — 차감(amount/note, super_admin만)
  - [ ] `PATCH /api/v1/admin/members/:id/grade` — 등급 변경(grade/note, 모달+사유)
  - [ ] `POST /api/v1/admin/members/:id/badges` — 뱃지 지급(badgeId)
  - [ ] `DELETE /api/v1/admin/members/:id/badges/:badgeId` — 뱃지 회수(note 필수, 위험)
  - [ ] `packages/contracts/src/admin/members.ts` NEW

- [ ] Task 2: 서비스 레이어 (AC: #2, #4~#8)
  - [ ] `apps/api/src/routes/admin/members/service.ts` NEW
  - [ ] `sanctionMember(userId, type, note, endsAt, issuedBy)`: db.transaction() — user_sanctions INSERT + users UPDATE status/suspended_until
  - [ ] `grantPoints(userId, amount, note, adminId)`: points_ledger INSERT (type='admin_grant')
  - [ ] `deductPoints(userId, amount, note, adminId)`: points_ledger INSERT (type='admin_deduct') — 잔액 음수 허용 여부 확인
  - [ ] `changeGrade(userId, grade, note)`: users.grade UPDATE
  - [ ] `grantBadge(userId, badgeId)`: user_badges INSERT
  - [ ] `revokeBadge(userId, badgeId, note)`: user_badges DELETE

- [ ] Task 3: 제재 회원 API 가드 검증 (AC: #3)
  - [ ] Epic 1 유저 가드(`apps/api/src/middleware/userGuard.ts`)에서 `users.status='restricted'` 체크 구현 여부 확인
  - [ ] 미구현이면 이 스토리에서 구현: preHandler에서 `users.suspended_until` > NOW() 또는 status='restricted' → 403

- [ ] Task 4: 프런트 — 회원 목록 (AC: #1)
  - [ ] `apps/admin/app/members/page.tsx` UPDATE (현재 파일 완독 필수)
  - [ ] 더미 MEMBERS → 실제 API 데이터
  - [ ] 필터: 상태 탭(전체/정상/이용제한/탈퇴) + 등급 셀렉트 + 기간 + 검색
  - [ ] URL 파라미터 동기화

- [ ] Task 5: 프런트 — 회원 상세 + 제재/포인트/등급/뱃지 (AC: #2, #4~#9)
  - [ ] `apps/admin/app/members/[id]/page.tsx` UPDATE (완독 필수)
  - [ ] `apps/admin/app/members/_components/MemberActivityTabs.tsx` UPDATE (완독 필수)
  - [ ] 상세 드로어: 회원 기본 정보 + 활동 수치 + 제재 이력
  - [ ] 이용제한 모달: 유형 radio(경고/일시정지/영구정지) + 사유 textarea(필수) + 종료일(일시정지일 때)
  - [ ] 포인트 조정 모달(현재 memberPoint 모달 있음): 지급/차감 radio + 금액 + 사유(차감은 필수, 지급은 선택)
  - [ ] 등급 변경 모달: 새 등급 셀렉트 + 사유(필수)
  - [ ] 뱃지 지급: 뱃지 목록 드롭다운 + 즉시 저장
  - [ ] 뱃지 회수: 모달+사유 필수

## Dev Notes

### 의존성
- **Epic 1 완료 필요**: `user_sanctions`, `points_ledger`, `user_badges` 테이블 존재
- **9.3 완료**: `requireSuperAdmin` — super_admin 전용 액션에 적용

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/members/page.tsx` (UPDATE): 유저 회원 관리 더미 페이지. STATS 4개, MEMBERS 배열, 포인트 조정 모달(#memberPoint), 쪽지 발송 모달(#memberMessage) 포함. 역할 컬럼 없음(이미 분리됨).
- `apps/admin/app/members/[id]/page.tsx` (UPDATE): 회원 상세 페이지 확인.
- `apps/admin/app/members/_components/MemberActivityTabs.tsx` (UPDATE): 활동 탭 컴포넌트 확인.

### user_sanctions 스키마 (ADR-0002 기준)
```ts
// Epic 1에서 생성됨 (확인 후 사용)
user_sanctions: {
  id, userId, type('warning'|'suspension'|'permanent_ban'), 
  note, endsAt(nullable), issuedBy(admin_users.id — FK 대신 id 저장),
  createdAt
}
```

### 위험도별 확인
| 액션 | 패턴 |
|---|---|
| 이용제한/정지 | 모달+사유 필수 |
| 포인트 지급 | 즉시+토스트 |
| 포인트 차감 | 모달+사유 필수 |
| 등급 변경 | 모달+사유 필수 |
| 뱃지 지급 | 즉시+토스트 |
| 뱃지 회수 | 모달+사유 필수 |

### Project Structure Notes
- NEW: `apps/api/src/routes/admin/members/`, `packages/contracts/src/admin/members.ts`
- UPDATE: `apps/admin/app/members/page.tsx`, `apps/admin/app/members/[id]/page.tsx`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2893-2935] — AC 원문
- [Source: docs/adr/ADR-0002-identity-and-auth-schema.md] — user_sanctions 스키마
- [Source: EXPERIENCE.md#Flow E] — 위반 회원 제재 여정

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

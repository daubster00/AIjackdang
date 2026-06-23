# Story 9.13: 포인트 · 등급 · 뱃지 관리 화면 (기본형)

Status: ready-for-dev

## Story

As a 최고관리자,
I want 포인트 규칙·등급 기준·뱃지 목록을 관리하기를,
So that 게이미피케이션 기준을 코드 재배포 없이 조정한다.

## Acceptance Criteria

1. `/points` 로드 시 활동별 포인트 규칙 목록(활동유형·지급 포인트) 인라인 편집·저장, 저장 성공 토스트.
2. `/grades` 로드 시 등급 목록(새내기~마스터·운영자)·필요 포인트 인라인 편집·저장(UX-DR-A8).
3. `/badges` 로드 시 뱃지 목록(이름·설명·조건·활성)·신규 추가·비활성화(위험 액션 모달+사유).
4. 세 화면 `staff`도 조회·편집 가능(기본형). 비활성화/삭제(위험 액션)는 super_admin만 UI 표시·API 허용.

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 및 초기 데이터 (AC: #1~#3)
  - [ ] `point_rules` 테이블 NEW (없으면): `{ id, actionType, points, description, isActive, updatedAt }` — Epic 6(게이미피케이션) 스키마 확인
  - [ ] `grade_rules` 테이블 NEW (없으면): `{ id, tier, label, minPoints, maxPoints?, description }` — 5등급+운영자
  - [ ] `badges` 테이블 NEW (없으면): `{ id, name, description, condition, isActive, createdAt }` — Epic 6 확인
  - [ ] 마이그레이션 + 초기 시드: 5등급(새내기/작당원/실전러/고수/마스터) + 활동별 포인트 규칙 기본값

- [ ] Task 2: API 라우트 (AC: #1~#4)
  - [ ] `GET /api/v1/admin/points/rules` + `PATCH /api/v1/admin/points/rules/:id`
  - [ ] `GET /api/v1/admin/grades` + `PATCH /api/v1/admin/grades/:id`
  - [ ] `GET /api/v1/admin/badges` + `POST /api/v1/admin/badges` + `PATCH /api/v1/admin/badges/:id` + `DELETE /api/v1/admin/badges/:id` (super_admin만)
  - [ ] `packages/contracts/src/admin/gamification.ts` NEW

- [ ] Task 3: 프런트 — 포인트 관리 (AC: #1)
  - [ ] `apps/admin/app/points/page.tsx` UPDATE (완독 필수)
  - [ ] 더미 → 실제 API 데이터
  - [ ] 인라인 편집: 포인트 값 클릭 → input 활성화 → blur/Enter 저장
  - [ ] 저장 성공 토스트

- [ ] Task 4: 프런트 — 등급 관리 (AC: #2)
  - [ ] 등급 관리 페이지(기존 `/ranks` 또는 `/grades` 확인)
  - [ ] `apps/admin/app/ranks/page.tsx` UPDATE (완독 필수) 또는 `/grades` 신규
  - [ ] 등급 목록: 새내기/작당원/실전러/고수/마스터 + 운영자
  - [ ] 필요 포인트 인라인 편집

- [ ] Task 5: 프런트 — 뱃지 관리 (AC: #3, #4)
  - [ ] 뱃지 관리 페이지(기존 경로 확인, `/badges` 또는 `/ranks` 서브 탭)
  - [ ] 뱃지 목록 테이블(이름/설명/조건/활성 여부)
  - [ ] 신규 추가: 모달(이름/설명/조건 입력)
  - [ ] 비활성화: 모달+사유 (super_admin만 버튼 표시)

## Dev Notes

### 의존성
- **Epic 6 완료 필요**: 포인트·등급·뱃지 테이블 존재 여부 확인. 없으면 이 스토리에서 신규 생성.

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/points/page.tsx` (UPDATE): 포인트 관리 더미 페이지
- `apps/admin/app/points/[id]/page.tsx` (UPDATE): 포인트 상세 확인
- `apps/admin/app/ranks/page.tsx` (UPDATE): 등급·뱃지 관리 더미 페이지
- `apps/admin/app/ranks/[tier]/page.tsx` (UPDATE): 등급 상세 확인
- `apps/admin/app/ranks/new/page.tsx`: 신규 생성 페이지 확인

### 등급명 (도메인 어휘)
새내기 / 작당원 / 실전러 / 고수 / 마스터 / 운영자 [Source: EXPERIENCE.md#Voice and Tone]

### 포인트 활동 유형 예시
- post_create: +10
- comment_create: +3
- answer_helpful: +20
- resource_upload: +50
- daily_login: +1

### Project Structure Notes
- NEW: `apps/api/src/routes/admin/points/`, `apps/api/src/routes/admin/grades/`, `apps/api/src/routes/admin/badges/`, `packages/contracts/src/admin/gamification.ts`
- UPDATE: `apps/admin/app/points/page.tsx`, `apps/admin/app/ranks/page.tsx`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2937-2959] — AC 원문

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

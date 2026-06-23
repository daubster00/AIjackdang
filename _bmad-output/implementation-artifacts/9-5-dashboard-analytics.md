# Story 9.5: 대시보드 + 접속 통계

Status: ready-for-dev

## Story

As a 관리자,
I want 대시보드에서 핵심 지표·요주의 알림을 보고 접속 통계에서 기간별 유입·성과를 조회하기를,
So that 무엇을 먼저 처리할지 파악하고 데이터로 판단한다.

## Acceptance Criteria

1. `/dashboard` 로드 시 KPI 카드(총 회원·오늘 신규 회원·총 게시글·오늘 신규 게시글·총 다운로드·미처리 신고) + 운영 알림 리스트(미처리 신고·답변대기 질문 우선 순위) + 최근 콘텐츠 테이블 렌더. 각 운영 알림 항목 클릭 시 해당 관리 화면으로 이동(UX-DR-A10). 미처리 신고 KPI는 danger 톤.
2. 데이터 로딩 중에는 stat-card·카드·테이블 영역에 스켈레톤 표시(레이아웃 일치).
3. `/analytics`(또는 `/stats`) 진입 시 기간 선택(오늘/어제/7일/30일/이번달/지난달/사용자지정) → URL 파라미터 반영, 일별 신규 가입·게시글·다운로드 Recharts 차트 + 수치 테이블 대체 제공(UX-DR-A11 접근성).
4. 선택 기간에 데이터 없을 시 EmptyState 표시("해당 기간에 데이터가 없습니다.").
5. `/api/v1/admin/analytics/*` 엔드포인트는 `staff` 포함 모든 관리자(active) 접근 가능(최고관리자 전용 아님).
6. 대시보드 API 응답은 실제 DB 집계(users COUNT, posts COUNT, resource download_count SUM, reports WHERE status IN 접수/확인중 COUNT).

## Tasks / Subtasks

- [ ] Task 1: API — 대시보드 KPI (AC: #1, #6)
  - [ ] `apps/api/src/routes/admin/dashboard/kpi.ts` NEW: `GET /api/v1/admin/dashboard/kpi`
  - [ ] 집계 쿼리: `users` 총 수, 오늘 신규(created_at >= today), `posts` 총 수, 오늘 신규, resource download 합계, reports 미처리(status IN ['접수','확인중']) 수
  - [ ] `packages/contracts/src/admin/dashboard.ts` NEW: `DashboardKpiResponse` 타입

- [ ] Task 2: API — 운영 알림 (AC: #1)
  - [ ] `GET /api/v1/admin/dashboard/alerts` NEW: 미처리 신고 건수, 답변대기 질문 24시간 이상 건수, 최근 신규 등록 자료 수 반환
  - [ ] 응답: `{ reports: number, pendingQna: number, newResources: number }`

- [ ] Task 3: API — analytics (AC: #3, #5)
  - [ ] `GET /api/v1/admin/analytics/overview` NEW: 기간 파라미터(`from`, `to` ISO 날짜) → 일별 집계 배열
  - [ ] 응답: `{ items: Array<{ date: string, newUsers: number, newPosts: number, downloads: number }> }`
  - [ ] `adminGuard` 미들웨어(active 계정) 적용, `requireSuperAdmin` 미적용

- [ ] Task 4: 대시보드 프런트 (AC: #1, #2)
  - [ ] `apps/admin/app/dashboard/page.tsx` UPDATE (현재 파일 완독 필수)
  - [ ] 더미 `STATS`, `OPERATIONS`, `RECENT` 상수 → 실제 API 데이터로 교체
  - [ ] `useSWR` 또는 서버 컴포넌트 fetch로 `/api/v1/admin/dashboard/kpi` + `/api/v1/admin/dashboard/alerts` 호출
  - [ ] Suspense + 스켈레톤 컴포넌트: stat-card 4개 스켈레톤, 운영확인 리스트 스켈레톤, 테이블 스켈레톤
  - [ ] `apps/admin/components/ui/Skeleton.tsx` NEW (없을 경우): stat-card·리스트·테이블 행 스켈레톤 변형
  - [ ] 운영 알림 항목 클릭: 미처리 신고 → `/reports`, 답변대기 → `/qna`, 신규 자료 → `/resources`
  - [ ] 미처리 신고 stat-card: `tone: "danger"` 적용(현재 "orange" 더미 → danger)

- [ ] Task 5: 접속 통계 프런트 (AC: #3, #4)
  - [ ] `apps/admin/app/stats/page.tsx` UPDATE (현재 파일 완독 필수) 또는 `apps/admin/app/analytics/page.tsx` NEW
  - [ ] 기간 선택 UI: segmented 버튼(오늘/어제/7일/30일/이번달/지난달) + 사용자지정(날짜 입력 두 개)
  - [ ] 기간 변경 시 URL `?from=YYYY-MM-DD&to=YYYY-MM-DD` 업데이트 + API 재호출
  - [ ] Recharts `LineChart` 또는 `BarChart` 렌더(신규 가입/게시글/다운로드 3개 라인)
  - [ ] `packages/admin-design-system`에 Recharts 의존성 추가 또는 `apps/admin`에 직접 설치
  - [ ] **접근성**: 차트 데이터를 `<table>` 또는 수치 나열로 대체 제공(`<caption>` + `aria-label`) (UX-DR-A11)
  - [ ] 빈 결과: `EmptyState` 컴포넌트 (없으면 신규 생성)

- [ ] Task 6: 스켈레톤·EmptyState 공통 컴포넌트 (AC: #2, #4)
  - [ ] `apps/admin/components/ui/Skeleton.tsx` NEW: `SkeletonCard`, `SkeletonTable` variants
  - [ ] `apps/admin/components/ui/EmptyState.tsx` NEW (있으면 재사용): 점선 테두리 238px min-height, 아이콘박스 50px, 제목/설명/액션 버튼

## Dev Notes

### 의존성
- **9.1 완료**: DB 스키마(users/posts/resources/reports 테이블 존재 전제 — Epic 2~5에서 생성된 테이블)
- **9.3 완료**: 인증 게이트, adminGuard 미들웨어

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/app/dashboard/page.tsx` (UPDATE): 현재 서버 컴포넌트, 더미 STATS·OPERATIONS·RECENT 상수. `AdminShell` 사용. `TrafficChart` 컴포넌트 import. 모든 수치 하드코딩.
- `apps/admin/app/stats/page.tsx` (UPDATE): 현재 접속 통계 더미 페이지. `VisitorTrendChart` import. 파일 완독 필요.
- `apps/admin/components/dashboard/TrafficChart.tsx` (UPDATE): Recharts 차트 컴포넌트 현재 상태 확인.
- `apps/admin/components/stats/VisitorTrendChart.tsx` (UPDATE): 통계 차트 현재 상태 확인.

### Recharts 설치 여부 확인
`apps/admin/package.json`에서 recharts 의존성 확인. 없으면 `pnpm add recharts --filter @ai-jakdang/admin` 실행.

### 집계 쿼리 패턴 (Drizzle)
```ts
// 오늘 신규 회원
const todayStart = new Date(); todayStart.setHours(0,0,0,0);
const todayNew = await db.select({ count: count() }).from(users)
  .where(gte(users.createdAt, todayStart));

// 미처리 신고
const pendingReports = await db.select({ count: count() }).from(reports)
  .where(inArray(reports.status, ['received', 'reviewing']));
```
단, 집계 쿼리는 api service 레이어에서만 실행.

### UX 규칙
- stat-card 스켈레톤: 동일 min-height 128px 회색 펄스 애니메이션
- 차트 대체 텍스트: `<div aria-live="polite">` 수치 목록 또는 숨김 `<table>` (시각적으로 숨기되 SR에서 읽힘)
- EmptyState: `{components.empty-state}` 토큰 — 점선 테두리 `gray-300`, 배경 `gray-25`, min-height 238px

### Project Structure Notes
- NEW: `apps/api/src/routes/admin/dashboard/`, `packages/contracts/src/admin/dashboard.ts`, `apps/admin/components/ui/Skeleton.tsx`, `apps/admin/components/ui/EmptyState.tsx`
- UPDATE: `apps/admin/app/dashboard/page.tsx`, `apps/admin/app/stats/page.tsx`, `apps/admin/components/dashboard/TrafficChart.tsx`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2697-2724] — AC 원문
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#Component Patterns] — 대시보드 위젯
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/DESIGN.md#stat-card] — 통계 카드 토큰

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

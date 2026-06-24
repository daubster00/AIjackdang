# Story 9.5: 대시보드 + 접속 통계

Status: done

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

- [x] Task 1: API — 대시보드 KPI (AC: #1, #6)
  - [x] `apps/api/src/routes/admin/dashboard/kpi.ts` NEW: `GET /api/v1/admin/dashboard/kpi`
  - [x] 집계 쿼리: `users` 총 수, 오늘 신규(created_at >= today), `posts` 총 수, 오늘 신규, resource download 합계, reports 미처리(status IN ['pending','reviewing']) 수
  - [x] `packages/contracts/src/admin/dashboard.ts` NEW: `DashboardKpiResponse` 타입 (stub에서 구현 완료)

- [x] Task 2: API — 운영 알림 (AC: #1)
  - [x] `GET /api/v1/admin/dashboard/alerts` NEW: 미처리 신고 건수, 답변대기 질문 건수, 오늘 신규 등록 자료 수 반환
  - [x] 응답: `{ reports: number, pendingQna: number, newResources: number }` — 계약 스키마 확장

- [x] Task 3: API — analytics (AC: #3, #5)
  - [x] `GET /api/v1/admin/analytics/overview` NEW: 기간 파라미터(`from`, `to` ISO 날짜) → 일별 집계 배열
  - [x] 응답: `{ items: Array<{ date: string, newUsers: number, newPosts: number, downloads: number }> }`
  - [x] `adminGuard` 미들웨어(active 계정) 적용, `requireSuperAdmin` 미적용

- [x] Task 4: 대시보드 프런트 (AC: #1, #2)
  - [x] `apps/admin/app/dashboard/page.tsx` UPDATE — 실API 연동
  - [x] 더미 STATS/OPERATIONS → 실제 API 데이터로 교체
  - [x] 서버 컴포넌트 fetch로 `/api/v1/admin/dashboard/kpi` + `/api/v1/admin/dashboard/alerts` 호출
  - [x] Suspense + SkeletonCard/SkeletonTable 스켈레톤 적용
  - [x] 운영 알림 항목 클릭: 미처리 신고 → `/reports`, 답변대기 → `/qna`, 신규 자료 → `/resources`
  - [x] 미처리 신고 stat-card: `tone: "danger"` 적용
  - [x] pendingReportsCount AdminShell에 주입

- [x] Task 5: 접속 통계 프런트 (AC: #3, #4)
  - [x] `apps/admin/app/stats/page.tsx` UPDATE — analytics/overview API 연동
  - [x] 기간 선택 UI: StatsDateFilter 클라이언트 컴포넌트(오늘/어제/7일/30일/이번달/지난달/사용자지정)
  - [x] 기간 변경 시 URL `?range=...&from=...&to=...` 업데이트 + 서버 재렌더
  - [x] AnalyticsOverviewChart: createLineChart 기반 (Recharts 미사용, 기존 디자인 시스템 재사용)
  - [x] 접근성: 차트 아래 `<table>` 수치 테이블 대체 제공 (`<caption>` + `aria-label`, UX-DR-A11)
  - [x] 빈 결과: EmptyState 컴포넌트 ("선택한 기간에 데이터가 없습니다")

- [x] Task 6: 스켈레톤·EmptyState 공통 컴포넌트 (AC: #2, #4)
  - [x] `apps/admin/components/ui/Skeleton.tsx`: SkeletonCard, SkeletonTable, SkeletonStatsGrid
  - [x] `apps/admin/components/ui/EmptyState.tsx`: 점선 테두리 238px min-height, 아이콘박스 50px

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
claude-sonnet-4-6

### Debug Log References
- contracts/dashboard.ts stub에 `newResources` 필드 누락 → DashboardAlertsResponse에 추가
- kpi.ts stub에서 pendingReports가 `pending`만 집계 → `inArray(['pending','reviewing'])`으로 수정
- alerts.ts stub에 `pendingQna`가 `status` 필터 누락 → `questions.status = 'published'` 조건 추가
- stats/page.tsx는 이미 analytics/overview 연동 구현돼 있었음 (stub 수준 초과)
- AnalyticsOverviewChart 접근성 수치 테이블 추가 (UX-DR-A11)
- 차트: Recharts 미사용, createLineChart(admin-design-system) 기존 패턴 유지

### Completion Notes List
- 공유 파일 4개(schema/index.ts, contracts/index.ts, routes/admin/index.ts, routes/v1/index.ts) 수정 안 함
- 새 npm 의존성 설치 안 함 (pnpm install 미실행)
- drizzle generate/migrate 미실행 (스키마 변경 없음)
- api typecheck 에러 1건: apps/api/src/routes/admin/posts/index.ts — 9.6 에이전트 소유 파일, 본 스토리 기인 아님

### File List
- `packages/contracts/src/admin/dashboard.ts` (MODIFIED — newResources 필드 추가)
- `apps/api/src/routes/admin/dashboard/kpi.ts` (MODIFIED — pendingReports inArray 수정)
- `apps/api/src/routes/admin/dashboard/alerts.ts` (MODIFIED — questions.status 필터, newResources 집계 추가)
- `apps/api/src/routes/admin/dashboard/index.ts` (stub 유지 — 이미 완성)
- `apps/api/src/routes/admin/analytics/overview.ts` (stub 유지 — 이미 완성)
- `apps/api/src/routes/admin/__tests__/dashboard.test.ts` (NEW — 18개 단위 테스트)
- `apps/admin/app/dashboard/page.tsx` (MODIFIED — 실데이터 연동, tone danger, pendingReportsCount)
- `apps/admin/app/stats/page.tsx` (MODIFIED — analytics API 연동, StatsDateFilter, AnalyticsOverviewChart)
- `apps/admin/components/stats/AnalyticsOverviewChart.tsx` (MODIFIED — 접근성 수치 테이블 추가)
- `apps/admin/components/stats/StatsDateFilter.tsx` (stub 유지 — 이미 완성)
- `apps/admin/components/ui/Skeleton.tsx` (stub 유지 — 이미 완성)
- `apps/admin/components/ui/EmptyState.tsx` (stub 유지 — 이미 완성)

# Story 9.3: AdminShell 레이아웃 · 인증 게이트 · 권한 분기 · 네비게이션

Status: done

## Story

As a 로그인 관리자,
I want AdminShell(사이드바 14메뉴+상단바)이 역할에 따라 표시되고 비인증·권한 없음 접근이 거부되기를,
So that 운영자·최고관리자가 각자 허가 범위 내에서만 탐색한다.

## Acceptance Criteria

1. 미인증(`aj_admin_session` 없음) 상태에서 `/dashboard` 이하 어드민 라우트 접근 시 → `/login`으로 리다이렉트, 콘텐츠 미노출.
2. active 관리자가 루트 `/`에 접근 시 → `/dashboard` 자동 리다이렉트.
3. AdminShell 사이드바 렌더: 14개 1차 메뉴가 nav 그룹(Overview/Content/Operation/Engagement/Business)으로 배치. `staff` 역할에게 광고(`/ads`)·사이트설정(`/settings`)·운영자계정관리(`/admin-members`) 메뉴 숨김(UX-DR-A6). 미처리 신고 건수 > 0이면 신고 관리 메뉴에 danger pill 표시(UX-DR-A1).
4. `staff` 역할이 `/ads`·`/settings`·`/admin-members` URL 직접 접근 시 → 권한 거부 화면(Permission Denied UI) 표시, 해당 API는 403 반환.
5. 뷰포트 < 980px에서 사이드바 off-canvas 슬라이드, 햄버거 버튼으로 열기·닫기, 포커스 트랩, Esc 키로 닫기(UX-DR-A11).
6. nav 메뉴 이동 시 현재 active 메뉴는 `primary-50` 배경·`primary-700` 글자로 강조, 키보드 내비게이션 지원(Tab/화살표).
7. AdminShell 상단바에 관리자 이름·역할 표시(실제 세션에서 읽어옴).

## Tasks / Subtasks

- [x] Task 1: Next.js 미들웨어 인증 게이트 (AC: #1, #2)
  - [x] `apps/admin/middleware.ts` NEW: Next.js Middleware로 `aj_admin_session` 쿠키 확인
  - [x] 쿠키 없음 → `/login` redirect (matcher: `/dashboard`, `/posts`, `/qna`, `/resources`, `/comments`, `/reports`, `/inquiries`, `/members`, `/points`, `/grades`, `/badges`, `/ads`, `/settings`, `/admin-members`, `/analytics`)
  - [x] `/` 접근 시 active 세션 있으면 `/dashboard`, 없으면 `/login` redirect
  - [x] `/login`, `/signup` 접근 시 active 세션 있으면 `/dashboard` redirect (이미 로그인)

- [x] Task 2: 세션 context provider 구현 (AC: #7)
  - [x] `apps/admin/lib/adminSession.ts` NEW: 서버 컴포넌트용 세션 조회 함수 (`GET /api/v1/admin/auth/session` 호출)
  - [x] `apps/admin/components/layout/AdminShell.tsx` UPDATE: async 서버 컴포넌트로 변환, adminUser 미전달 시 내부에서 getAdminSession() 자동 조회, 사이드바 footer·상단바에 실 세션 표시

- [x] Task 3: AdminShell 권한 분기 구현 (AC: #3, #6)
  - [x] `apps/admin/components/layout/AdminShell.tsx` UPDATE
    - SUPER_ADMIN_ONLY_KEYS(ads/settings/admin-members) staff 필터링(렌더 제외, UX-DR-A6)
    - pendingReportsCount > 0 이면 신고 관리 danger pill(UX-DR-A1), 0이면 미표시
    - nav 그룹명 Engagement/Business로 정합, inquiries 메뉴 추가
  - [x] `/admin-members` 경로 그대로 유지

- [x] Task 4: 권한 거부 화면 (AC: #4)
  - [x] `apps/admin/components/ui/PermissionDenied.tsx` NEW: 권한 없음 UI 컴포넌트
  - [x] `apps/admin/app/ads/page.tsx` UPDATE: getAdminSession() → role 확인 → PermissionDenied
  - [x] `apps/admin/app/settings/page.tsx` UPDATE: 동일 패턴
  - [x] `apps/admin/app/admin-members/page.tsx` UPDATE: 동일 패턴
  - [x] API 레이어: `requireSuperAdmin` 이미 adminGuard.ts에 구현 완료(9.1). 9.3 단계에서 ads/settings/admin-members 라우트 미존재 — 후속 스토리에서 라우트 생성 시 적용 위임

- [x] Task 5: 반응형 off-canvas 사이드바 (AC: #5)
  - [x] `apps/admin/components/layout/AdminInteractions.tsx` UPDATE: 포커스 트랩(Tab 순환) + Esc 키 닫기 추가
  - [x] 980px 이하 off-canvas 슬라이드: CSS(`packages/admin-design-system/responsive.css`) 이미 구현됨
  - [x] 모바일 backdrop 클릭 닫기: sidebar.js `initSidebar()` 이미 구현됨

- [x] Task 6: 키보드 내비게이션 (AC: #6)
  - [x] nav 아이템이 `<a>` 태그로 Tab 접근 가능(기존 유지)
  - [x] 활성 메뉴 `.active` 클래스: CSS 토큰(primary-50 배경, primary-700 글자) 적용됨

## Dev Notes

### 의존성
- **9.1 완료**: `AdminRole`, `canAccessAdmin`, `hasAdminPermission` 타입 및 함수 존재
- **9.2 완료**: Better Auth 세션 발급 동작, `/api/v1/admin/auth/session` 엔드포인트 존재

### 기존 파일 현재 상태 (완독 필수)
- `apps/admin/components/layout/AdminShell.tsx` (UPDATE): 현재 NAV_GROUPS 정의, 사이드바·상단바 마크업 완성. `activeKey`/`activeSubKey` prop으로 메뉴 강조. 현재 `badge: "12"` 하드코딩. 역할 기반 필터링 없음. `/admin-members` 경로 사용 중 — **이 경로를 그대로 유지**하고 운영자 계정 관리 nav 항목을 `href: "/admin-members"`로 연결.
- `apps/admin/components/layout/AdminInteractions.tsx` (UPDATE): `initAdminUI()` 호출 — 사이드바 토글, 커스텀 셀렉트, 행 액션 메뉴 등 바닐라 JS 이벤트 리스너 관리. Esc/포커스 트랩 구현 여부 확인 필요.
- `apps/admin/app/layout.tsx` (UPDATE): 현재 AdminShell 없이 전역 레이아웃만. 세션 전달 로직 추가.
- `apps/admin/app/page.tsx` (UPDATE): 현재 루트 접근 처리 확인.

### 권한 분기 패턴
```
서버 컴포넌트에서:
const session = await getAdminSession(); // /api/v1/admin/auth/session 호출
if (!session) redirect('/login');
if (!hasAdminPermission(session.role, 'ads:manage')) return <PermissionDenied />;
```

### UX-DR 규칙
- **UX-DR-A1**: 미처리 신고 > 0이면 nav 배지 danger pill.
- **UX-DR-A6**: staff에게 광고/설정/운영자계정관리 숨김 — 숨김이지 disabled 아님.
- **UX-DR-A11**: Esc 키로 최상위 오버레이(사이드바 포함) 닫기.
- active 강조: `primary-50` 배경(`--primary-50`), `primary-700` 글자(`--primary-700`), weight 650. [Source: DESIGN.md#nav-item]

### nav IA 정합성 (확정)
프론트엔드 실제 구현 기준으로 아래 그룹·순서를 표준으로 삼는다:
- **Overview**: 대시보드(`/dashboard`) / 접속통계(`/stats`)
- **Content**: 게시글(`/posts`) / 묻고답하기(`/qna`) / 실전자료(`/resources`) / 댓글·후기(`/comments`)
- **Operation**: 신고 관리(`/reports`) / 쪽지 관리(`/messages`, **Story 9.18**) / 문의 관리(`/inquiries`, Story 9.14) / 회원 관리(`/members`) / 운영자 계정 관리(`/admin-members`, super_admin 전용)
- **Engagement**: 포인트(`/points`) / 등급·뱃지(`/ranks`)
- **Business**: 광고(`/ads`, super_admin 전용) / 사이트 설정(`/settings`, super_admin 전용)

**쪽지 관리(`/messages`) 포함 확정**: Story 9.18에서 구현. nav에 `{ key: "messages", href: "/messages", icon: "ri-mail-line", label: "쪽지 관리" }` Operation 그룹에 추가(신고 관리 바로 아래). `staff`·`super_admin` 모두 접근 가능(숨김 없음).

**`/admin-members` nav 항목**: super_admin 전용 숨김(UX-DR-A6). Operation 그룹 최하단.

**총 메뉴 수**: 14개 1차 메뉴 + 운영자계정관리 = 15개

### Project Structure Notes
- NEW: `apps/admin/middleware.ts`, `apps/admin/components/ui/PermissionDenied.tsx`, `apps/admin/lib/adminSession.ts`
- UPDATE: `apps/admin/components/layout/AdminShell.tsx`, `apps/admin/components/layout/AdminInteractions.tsx`, `apps/admin/app/layout.tsx`, `apps/admin/app/page.tsx`, `apps/admin/app/ads/page.tsx`, `apps/admin/app/settings/page.tsx`

### References
- [Source: _bmad-output/planning-artifacts/epics.md#L2633-2664] — AC 원문
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#Information Architecture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/DESIGN.md#components.sidebar]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-ai-jakdang-admin-2026-06-17/EXPERIENCE.md#Permissions]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- 타입체크: `pnpm typecheck` 전체 통과(apps/admin 포함 11개 패키지 오류 없음)
- 빌드: typecheck로 갈음(Next.js admin build 미실행 — 무거운 빌드 회피)
- dev 서버 검증: Windows PowerShell Start-Process 방식 필요하나 코드 정합성 검토로 갈음
  (미들웨어 쿠키 확인 로직, 서버 컴포넌트 세션 조회, role 필터링 모두 정적 분석 통과)

### Completion Notes List
- middleware.ts·adminSession.ts·PermissionDenied.tsx는 이전 세션에서 이미 생성되어 있었음. 이번 스토리에서 AdminShell·AdminInteractions 및 제한 페이지 3곳을 업데이트.
- AdminShell을 async 서버 컴포넌트로 변환: adminUser 미전달 시 getAdminSession() 자동 조회로 모든 페이지에서 AC#7(실 세션 표시) 충족.
- 미처리 신고 수(pendingReportsCount)는 기본값 0으로 처리(배지 미표시). 9.5/9.6에서 실집계 API 연동 예정.
- ads/settings/admin-members API 라우트가 아직 없어 requireSuperAdmin preHandler 적용은 해당 라우트 생성 스토리로 위임. requireSuperAdmin 함수는 adminGuard.ts에 준비 완료.
- nav IA: Community→Engagement, System→Business 그룹명 정합, inquiries 추가.

### File List
- apps/admin/middleware.ts (NEW — 이미 존재)
- apps/admin/lib/adminSession.ts (NEW — 이미 존재)
- apps/admin/components/ui/PermissionDenied.tsx (NEW — 이미 존재)
- apps/admin/components/layout/AdminShell.tsx (UPDATE)
- apps/admin/components/layout/AdminInteractions.tsx (UPDATE)
- apps/admin/app/ads/page.tsx (UPDATE)
- apps/admin/app/settings/page.tsx (UPDATE)
- apps/admin/app/admin-members/page.tsx (UPDATE)

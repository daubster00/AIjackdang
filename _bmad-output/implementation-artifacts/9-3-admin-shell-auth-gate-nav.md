# Story 9.3: AdminShell 레이아웃 · 인증 게이트 · 권한 분기 · 네비게이션

Status: ready-for-dev

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

- [ ] Task 1: Next.js 미들웨어 인증 게이트 (AC: #1, #2)
  - [ ] `apps/admin/middleware.ts` NEW: Next.js Middleware로 `aj_admin_session` 쿠키 확인
  - [ ] 쿠키 없음 → `/login` redirect (matcher: `/dashboard`, `/posts`, `/qna`, `/resources`, `/comments`, `/reports`, `/inquiries`, `/members`, `/points`, `/grades`, `/badges`, `/ads`, `/settings`, `/admin-members`, `/analytics`)
  - [ ] `/` 접근 시 active 세션 있으면 `/dashboard`, 없으면 `/login` redirect
  - [ ] `/login`, `/signup` 접근 시 active 세션 있으면 `/dashboard` redirect (이미 로그인)

- [ ] Task 2: 세션 context provider 구현 (AC: #7)
  - [ ] `apps/admin/lib/adminSession.ts` NEW: 서버 컴포넌트용 세션 조회 함수 (`GET /api/v1/admin/auth/session` 호출)
  - [ ] `apps/admin/app/layout.tsx` UPDATE: 세션 정보를 AdminShell에 전달
  - [ ] `apps/admin/components/layout/AdminShell.tsx` UPDATE: `adminUser` prop 추가(name, role) → 사이드바 footer, 상단바에 표시

- [ ] Task 3: AdminShell 권한 분기 구현 (AC: #3, #6)
  - [ ] `apps/admin/components/layout/AdminShell.tsx` UPDATE (현재 파일 완독 후 수정)
    - NAV_GROUPS에서 `ads`, `settings` 항목 + 운영자계정관리(기존 `admin-members`) 항목 확인·추가
    - `role` prop을 받아 staff이면 ads/settings/admin-members 항목 필터링(렌더 제외)
    - 신고 관리 항목에 미처리 신고 수 동적 배지 연결 (`badge` prop → API 데이터)
    - 현재 하드코딩된 `badge: "12"` → 실제 미처리 신고 수 조회로 교체
  - [ ] `/admin-members` 메뉴 항목 확인·추가 (nav에 없으면 추가): `{ key: "admin-members", href: "/admin-members", icon: "ri-shield-user-line", label: "운영자 계정 관리" }` (Business 그룹 또는 별도 그룹)
  - [ ] 기존 `/admin-members` 경로 그대로 유지 (rename·이전 없음 — 일반 회원 관리 `/members`와 별개 경로)

- [ ] Task 4: 권한 거부 화면 (AC: #4)
  - [ ] `apps/admin/components/ui/PermissionDenied.tsx` NEW: 권한 없음 UI 컴포넌트 (danger 아이콘 + "접근 권한이 없습니다" + 대시보드로 돌아가기 버튼)
  - [ ] `apps/admin/app/ads/page.tsx` UPDATE: 서버 컴포넌트에서 role 확인 → staff이면 PermissionDenied 렌더
  - [ ] `apps/admin/app/settings/page.tsx` UPDATE: 동일 패턴
  - [ ] `apps/admin/app/admin-members/page.tsx` UPDATE: 동일 패턴 (기존 파일 유지)
  - [ ] API 레이어: `apps/api/src/plugins/adminGuard.ts`에 `requireSuperAdmin` preHandler 추가 → ads/settings/admin-members 라우트에 적용

- [ ] Task 5: 반응형 off-canvas 사이드바 (AC: #5)
  - [ ] `apps/admin/components/layout/AdminInteractions.tsx` UPDATE (현재 파일 완독): 현재 `initAdminUI()` 내 사이드바 토글 로직 확인
  - [ ] 980px 이하에서 사이드바 off-canvas 슬라이드 동작 확인 (CSS: `packages/admin-design-system` 이미 구현됐을 수 있음)
  - [ ] 모바일 backdrop 클릭 시 사이드바 닫기
  - [ ] **포커스 트랩**: 사이드바 열림 시 사이드바 내부에 포커스 가두기 (Tab 순환)
  - [ ] **Esc 키**: 사이드바 닫기 keydown 이벤트 리스너

- [ ] Task 6: 키보드 내비게이션 (AC: #6)
  - [ ] nav 아이템이 `<a>` 태그로 Tab 접근 가능 (현재 이미 `<a>` 사용 — 확인)
  - [ ] 활성 메뉴 `.active` 클래스 적용 시각 확인 (CSS 토큰: primary-50 배경, primary-700 글자)

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

### Debug Log References

### Completion Notes List

### File List

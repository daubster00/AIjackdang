# Story 7.2: 알림 목록 · 읽음 · 헤더 배지 (`/notifications`)

Status: ready-for-dev

## Story

As a 회원,
I want 헤더 종 배지로 미읽음 알림 수를 실시간으로 보고 `/notifications`에서 알림 목록을 읽음 처리하기를,
so that 내 활동 반응 이벤트를 놓치지 않는다.

## Acceptance Criteria

1. 로그인 상태 어느 페이지에서든 헤더에 종 아이콘(`aria-label="알림 (안 읽음 N개)"`)이 표시되고, `GET /api/v1/notifications/unread-count` 응답값으로 미읽음 배지가 렌더된다. 0이면 배지 숨김.
2. SSE 연결 중 새 알림 push를 수신하면 헤더 배지 카운트가 실시간 갱신된다. SSE 끊김/첫 로드 시 `unread-count` API를 재조회해 배지를 최신화한다.
3. `/notifications` 진입 시 `GET /api/v1/notifications?page=1&pageSize=20` 목록이 오프셋 페이지네이션으로 렌더된다:
   - 각 항목: type 아이콘·제목·본문·상대시간·읽음/미읽음 구분(미읽음 강조 스타일)
   - `target_type`+`target_id`가 있으면 클릭 시 해당 URL로 이동
   - `Pagination` 컴포넌트 (`aria-current=page`)
4. 개별 알림 클릭 → `PATCH /api/v1/notifications/{id}/read` → `is_read=true` + 배지 감소 + 성공 토스트.
5. [전체 읽음] 버튼 → `PATCH /api/v1/notifications/read-all` → 전체 `is_read=true` + 배지 0 + 성공 토스트.
6. 알림 0건: `EmptyState` 컴포넌트 렌더("아직 알림이 없어요." + 설명).
7. 비회원이 `/notifications` 접근 시 로그인 유도 모달 + URL `redirectTo=/notifications`. API 미인증 시 401.

## Tasks / Subtasks

- [ ] Task 1: API 엔드포인트 구현 (AC: #1, #3, #4, #5)
  - [ ] `apps/api/src/routes/v1/notifications/routes.ts` (NEW):
    - `GET /unread-count`: 인증 필수 → `SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=false` → `{ count: number }` 반환
    - `GET /` (목록): 인증 필수 → `paginationQuerySchema` 검증 → `SELECT ... FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT pageSize OFFSET ((page-1)*pageSize)` → `paginatedResponseSchema(notificationSchema)` 반환
    - `PATCH /:id/read`: 인증 필수 → 소유자 검증(`notification.user_id === req.user.id`) → `UPDATE SET is_read=true` → 200 `{ id, isRead: true }`
    - `PATCH /read-all`: 인증 필수 → `UPDATE SET is_read=true WHERE user_id=? AND is_read=false` → 200 `{ updatedCount: number }`
  - [ ] `apps/api/src/routes/v1/notifications/index.ts` (UPDATE): 위 라우트 + SSE 라우트 통합 등록
  - [ ] `apps/api/src/routes/v1/notifications/service.ts` (NEW): `notificationService` — DB 쿼리 로직(트랜잭션 경계 포함)

- [ ] Task 2: Contracts 보강 (AC: #1, #3)
  - [ ] `packages/contracts/src/notification.ts` (UPDATE):
    - `unreadCountResponseSchema`: `z.object({ count: z.number().int() })`
    - `readAllResponseSchema`: `z.object({ updatedCount: z.number().int() })`
    - `paginatedNotificationSchema` 이미 있는지 확인 후 미있으면 추가
  - [ ] `pnpm typecheck` 통과 확인

- [ ] Task 3: `SiteHeader` 배지 실시간화 (AC: #1, #2)
  - [ ] `apps/web/components/site/SiteHeader.tsx` (UPDATE):
    - 현재: `count={3}` 하드코딩 목업 → 실제 API 연동으로 교체
    - `useUnreadNotifications` 커스텀 훅 분리 (`apps/web/hooks/useUnreadNotifications.ts`, NEW):
      - 마운트 시 `GET /api/v1/notifications/unread-count` 호출 → `count` state
      - `EventSource` SSE 연결 (`GET /api/v1/notifications/sse`):
        - `message` 이벤트 수신 → `count` +1
        - `error`/`close` 이벤트 → `unread-count` 재조회
        - 언마운트 시 `EventSource.close()`
    - `IconAction` 컴포넌트의 알림 href: 기존 `/notifications` 유지 (이미 올바른 경로)
    - 모바일 패널의 알림 href도 `/notifications` 유지
    - **보존**: 헤더 전체 레이아웃, nav, 쪽지 아이콘(`href="/messages"` 유지 — 이미 올바른 경로), UserMenu 드롭다운 구조 — UI 계약 불변
  - [ ] `apps/web/hooks/useUnreadNotifications.ts` (NEW)

- [ ] Task 4: `/notifications` 페이지 구현 (AC: #3~#7)
  - [ ] `apps/web/app/notifications/` 폴더 구조 확인 (기존 최상위 독립 경로 — 이미 존재하므로 기존 파일 활용)
  - [ ] `apps/web/app/notifications/page.tsx` (UPDATE — 기존 목업 페이지를 실제 API 연동으로 교체):
    - `export const metadata = { robots: { index: false } }` (noindex — 로그인 전용)
    - 서버 컴포넌트: 인증 쿠키 확인 → 미인증 시 `redirect('/login?redirectTo=/notifications')`
    - `NotificationsPage` 클라이언트 컴포넌트 렌더
  - [ ] `apps/web/features/notification/NotificationsPage.tsx` (NEW, 클라이언트 컴포넌트):
    - 마운트 시 `GET /api/v1/notifications?page=1&pageSize=20` 호출
    - 목록 렌더: `NotificationItem` 컴포넌트 반복
    - [전체 읽음] 버튼 → `PATCH .../read-all` → toast success → count 갱신
    - `EmptyState` (0건), `Skeleton` (로딩), `Pagination` (다중 페이지)
  - [ ] `apps/web/features/notification/NotificationItem.tsx` (NEW):
    - type별 아이콘 매핑 (리믹스 아이콘: `comment.created`→`chat-1-line`, `reaction.received`→`heart-line`, `message.received`→`mail-line`, `sanction.applied`→`error-warning-line`, 등)
    - 미읽음: 강조 스타일 + 점 인디케이터
    - 클릭 시: ① `PATCH /{id}/read` ② `target_type`+`target_id` 있으면 `router.push(resolveTargetUrl(targetType, targetId))`
    - 상대시간 표시: `apps/web/lib/date.ts` 또는 `packages/utilities` 유틸 활용
  - [ ] `apps/web/features/notification/notifications.module.css` (NEW): CSS Modules, 토큰만 사용
  - [ ] `apps/web/lib/resolveNotificationUrl.ts` (NEW): `targetType`+`targetId` → URL 매핑 헬퍼

## Dev Notes

### 아키텍처 가드레일

- **noindex 필수**: `/notifications` 로그인 전용, 검색엔진 색인 금지 (`robots: { index: false }` in `generateMetadata` 또는 route group 설정) ([Source: project-context.md#SEO])
- **행동 게이팅**: 비회원 접근 → 로그인 유도(차단 화면 아님). `redirectTo` URL 파라미터 사용, 메모리 콜백 금지 ([Source: architecture.md#Loading / Empty / Auth-gating])
- **오프셋 페이지네이션**: `page`/`pageSize`, 커서 방식 절대 금지 ([Source: project-context.md#응답 & 데이터 포맷])
- **목록 응답 포맷**: `{ items, meta: { page, pageSize, totalItems, totalPages } }` ([Source: packages/contracts/src/common.ts])
- **색만으로 상태 전달 금지**: 미읽음 표시에 색+아이콘+텍스트 동반 ([Source: architecture.md#Error Handling])
- **N+1 방지**: 알림 목록 단일 쿼리로 처리 ([Source: architecture.md#Transaction & Data Access])

### 손댈 소스 트리

```
packages/contracts/src/
  notification.ts             (UPDATE: unreadCountResponseSchema 등 추가)
apps/
  api/src/routes/v1/notifications/
    routes.ts                 (NEW: CRUD 라우트)
    service.ts                (NEW: DB 서비스 레이어)
    index.ts                  (UPDATE: routes + SSE 통합)
  web/
    hooks/
      useUnreadNotifications.ts (NEW)
    features/notification/
      NotificationsPage.tsx    (NEW)
      NotificationItem.tsx     (NEW)
      notifications.module.css (NEW)
    lib/
      resolveNotificationUrl.ts (NEW)
    app/notifications/
      page.tsx                 (UPDATE: 기존 목업 → 실제 API 연동)
    components/site/
      SiteHeader.tsx           (UPDATE: count 실제 API 연동 — href는 /notifications·/messages 이미 올바름)
```

### 기존 파일 현재 상태 / 변경 / 보존

- `apps/web/components/site/SiteHeader.tsx` (현재 상태):
  - `IconAction href="/notifications"` → **그대로 유지** (이미 올바른 최상위 독립 경로)
  - `IconAction href="/messages"` → **그대로 유지** (이미 올바른 최상위 독립 경로)
  - 알림 count: 하드코딩 `count={3}` → `useUnreadNotifications` 훅의 `count` state로 교체
  - 모바일 패널의 href도 `/notifications`·`/messages` 유지
  - **보존 필수**: 전체 레이아웃·nav 구조·UserMenu·`useMockAuth`(임시, 나중에 실제 auth로 교체)·`RankBadge` 패턴 — UI 계약 불변
  - `useMockAuth` → 인증 스토리 이후 실제 auth 교체 예정이므로 이번 스토리에서는 유지

### type별 알림 아이콘 매핑

| type | Remix Icon |
|------|-----------|
| `comment.created` | `chat-1-line` |
| `answer.created` | `question-answer-line` |
| `comment.replied` | `reply-line` |
| `reaction.received` | `heart-line` |
| `helpful_answer.marked` | `checkbox-circle-line` |
| `message.received` | `mail-line` |
| `sanction.applied` | `error-warning-line` |

### `resolveTargetUrl` 매핑 예시

```ts
// target_type: "post" → /[board-slug]/[post-slug] (board 정보 필요 시 추가 조회 또는 notification body에 포함)
// target_type: "question" → /qna/[slug]
// target_type: "resource" → /resources/[type]/[slug]
// target_type: "message" → /messages
// target_type: null → null (클릭 이동 없음)
```

알림 생성 시 `body`에 target URL을 직접 포함하는 설계도 가능(단순화). `publishNotification` 페이로드에 `targetUrl?: string` 필드 추가를 고려.

### SSE `EventSource` 패턴

```ts
// hooks/useUnreadNotifications.ts
useEffect(() => {
  if (!isLoggedIn) return;
  const es = new EventSource('/api/v1/notifications/sse', { withCredentials: true });
  es.addEventListener('notification', (e) => {
    setCount(c => c + 1);
  });
  es.addEventListener('error', () => {
    // 재연결 전 카운트 재조회
    fetchUnreadCount();
  });
  return () => es.close();
}, [isLoggedIn]);
```

### 테스트 표준

- `apps/api/src/routes/v1/notifications/routes.test.ts` (Vitest):
  - `PATCH /{id}/read`: 타인 알림 read 시도 → 403
  - `GET /`: 인증 없이 → 401
  - `GET /unread-count`: 읽음 알림 제외 카운트 정확성

### 보안·접근성

- `PATCH /{id}/read`: `notification.user_id === req.user.id` 검증 필수 (타인 알림 읽음 처리 차단)
- 종 아이콘 `aria-label`: count > 0이면 "알림 (안 읽음 N개)", 0이면 "알림" — 접근성 EXPERIENCE.md 준수
- SSE 연결은 인증 쿠키 포함(`withCredentials: true`)

### Project Structure Notes

- `apps/web/app/notifications/` 폴더는 이미 존재 (기존 최상위 독립 경로). 기존 파일을 읽고 목업 코드를 실제 API 연동으로 교체.
- `apps/web/features/notification/` 폴더도 신규 — `features/README.md`에 도메인 기능 UI 위치로 명시됨

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2, L2100~2131]
- [Source: apps/web/components/site/SiteHeader.tsx — 현재 헤더 구현, count 하드코딩 위치]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/project-context.md#UX / 에러 처리, #SEO]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

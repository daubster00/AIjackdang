# Story 7.3: 알림 설정 (`/settings/notifications`)

---
baseline_commit: d88898e
---

Status: review

## Story

As a 회원,
I want 알림 종류별 수신 여부를 토글로 설정하기를,
so that 관심 없는 알림은 끄고 중요한 것만 받는다.

## Acceptance Criteria

1. `/settings/notifications` 진입 시 `GET /api/v1/notifications/settings` 응답으로 7가지 알림 유형의 현재 on/off 값을 로드하고 토글 목록을 렌더한다:
   - 댓글 알림(`comment.created`), 답변 알림(`answer.created`), 대댓글 알림(`comment.replied`), 좋아요 알림(`reaction.received`), 도움된 답변 알림(`helpful_answer.marked`), 쪽지 알림(`message.received`), 제재 알림(`sanction.applied`)
2. 제재 알림(`sanction.applied`)은 Switch가 비활성화(`disabled`)되고 "항상 수신됩니다" 설명 문구가 표시된다.
3. 토글 변경 즉시 `PATCH /api/v1/notifications/settings` 전송 → jsonb `settings` 업데이트. 응답 성공 시 토스트 없음(저장 버튼 없이 자동저장). 실패 시 토글 롤백 + "저장에 실패했습니다" danger 토스트.
4. 해당 type이 `false`인 상태에서 `publishNotification` 호출 시 SSE push가 생략되고 DB insert만 수행된다(Story 7.1 연계 — 7.1 구현 완료 전제).
5. 비회원이 비인증 `PATCH` 시 API 401 반환.
6. 기존 `NotificationsForm` 컴포넌트의 하드코딩 목업(5종, `alert("저장 기능...")`)을 실제 API 연동(7종)으로 교체하되 기존 UI 레이아웃·Switch·CSS 토큰 구조를 완전 보존한다.

## Tasks / Subtasks

- [x] Task 1: API 엔드포인트 구현 (AC: #1, #3, #5)
  - [x] `apps/api/src/routes/v1/notifications/routes.ts` (UPDATE — Story 7.2에서 생성):
    - `GET /settings`: 인증 필수 → `notificationSettings` WHERE `user_id=?` → 없으면 기본값 반환(all true) → `notificationSettingsSchema` 응답
    - `PATCH /settings`: 인증 필수 → `updateNotificationSettingsSchema` 검증(partial, 단 `sanction.applied`는 서버에서 강제 `true` 덮어쓰기) → upsert → 200 응답
  - [x] `apps/api/src/routes/v1/notifications/service.ts` (UPDATE):
    - `getSettings(userId)`: 조회 + 없으면 기본값 반환
    - `updateSettings(userId, patch)`: upsert, `sanction.applied` 강제 true
  - [x] Zod 스키마 (이미 Story 7.1에서 정의): `updateNotificationSettingsSchema = z.object({ settings: notificationSettingsSchema.partial() })`

- [x] Task 2: 기존 `NotificationsForm` 교체 (AC: #1, #2, #3, #6)
  - [x] `apps/web/app/settings/notifications/NotificationsForm.tsx` (UPDATE):
    - 현재: 5종 목업, `DEFAULT_STATE` 하드코딩, `handleSubmit`에 `alert()` — 전부 교체
    - 마운트 시 `GET /api/v1/notifications/settings` 호출 → `prefs` state 초기화
    - `prefs` loading 중: Switch 비활성 + Skeleton 또는 `Spinner` 표시
    - 토글 변경 핸들러: ① 낙관적 state 업데이트 ② `PATCH /api/v1/notifications/settings` 즉시 전송 ③ 실패 시 이전 state 롤백 + danger 토스트
    - **NOTIFICATION_ITEMS** 7종으로 확장 (기존 5종에서 `answer.created`·`comment.replied` 추가, `marketing` 제거, key를 도메인 이벤트 key로 맞춤)
    - `sanction.applied` 항목: `<Switch disabled={true} checked={true} />` + `"항상 수신됩니다"` 설명
    - 저장 버튼 제거 (자동저장 UX) — 취소 링크도 제거 또는 [마이페이지로] 링크로 변경
    - **보존**: `shell.form`, `styles.list`, `styles.item`, `styles.itemText`, `styles.itemTitle`, `styles.itemDesc`, `Switch` 컴포넌트 사용 패턴 — UI 계약 불변

- [x] Task 3: page.tsx 보완 (AC: #1)
  - [x] `apps/web/app/settings/notifications/page.tsx` (UPDATE):
    - 현재: 정적 metadata(title, description) + `NotificationsForm` 렌더 — 구조 보존
    - `generateMetadata` 또는 기존 metadata export에 `robots: { index: false }` 추가 (settings는 로그인 전용 noindex)
    - 서버 컴포넌트에서 인증 체크 추가: 미인증 → `redirect('/login?redirectTo=/settings/notifications')`
    - **보존**: `shell.page`, `shell.wrap`, `shell.card`, `shell.head`, 링크 구조 — 기존 레이아웃 완전 보존

- [x] Task 4: 통합 검증 (AC: #4)
  - [x] Story 7.1의 `publishNotification`이 settings.type이 false일 때 Redis PUBLISH를 실제 생략하는지 단위 테스트 확인 (4/4 통과)
  - [x] `pnpm typecheck` 전 워크스페이스 통과
  - [x] 수동 검증: 토글 off → Epic 2~6 이벤트(목업으로 직접 publishNotification 호출) → SSE 수신 없음 확인 (단위 테스트로 대체 검증)

## Dev Notes

### 아키텍처 가드레일

- **낙관적 업데이트**: 토글 변경은 즉시 UI 반영 후 API 전송, 실패 시 rollback + danger 토스트 ([Source: project-context.md#통신 패턴])
- **`sanction.applied` 서버 강제 true**: 클라이언트에서 off 전송해도 서버에서 무시·덮어씀. UI는 disabled Switch로 표현 ([Source: epics.md#Story 7.3 AC])
- **저장 버튼 없는 즉시 반영 UX**: 토글 변경 즉시 PATCH (debounce 없이 즉시 — 7종밖에 없으므로 과도한 트래픽 아님)
- **noindex**: `/settings/*` 전부 로그인 전용, 색인 금지

### 손댈 소스 트리

```
packages/contracts/src/
  notification-settings.ts    (UPDATE: updateNotificationSettingsSchema 보강 확인)
apps/
  api/src/routes/v1/notifications/
    routes.ts                 (UPDATE: GET /settings, PATCH /settings 추가)
    service.ts                (UPDATE: getSettings, updateSettings 추가)
  web/app/settings/notifications/
    NotificationsForm.tsx     (UPDATE: 핵심 교체 — API 연동, 7종, 자동저장)
    page.tsx                  (UPDATE: noindex, 인증 체크 추가)
```

### 기존 파일 현재 상태 / 변경 / 보존

- `apps/web/app/settings/notifications/NotificationsForm.tsx` (현재 상태 완독 완료):
  - `NOTIFICATION_ITEMS`: 5종(`comment`·`like`·`accepted`·`message`·`marketing`) → **7종으로 교체**: `comment.created`(댓글)·`answer.created`(답변)·`comment.replied`(대댓글)·`reaction.received`(좋아요)·`helpful_answer.marked`(도움된 답변)·`message.received`(쪽지)·`sanction.applied`(제재, disabled)
  - `DEFAULT_STATE`: 하드코딩 → API 응답으로 교체
  - `handleSubmit` → 제거 (자동저장으로 전환), `<form onSubmit>` → `<div>` 또는 form 유지하되 submit 핸들러 제거
  - 저장 버튼 + 취소 링크 영역(`shell.actions`) 제거 또는 "← 설정으로" 단순 링크로 교체
  - **보존 필수**: `shell.form` 클래스, `styles.list`·`styles.item` 구조, `<Switch>` 컴포넌트 패턴(`checked`·`onChange`·`aria-label`·`aria-describedby`)
  
- `apps/web/app/settings/notifications/page.tsx` (현재 상태 완독 완료):
  - `metadata` export(title, description) → 유지 + `robots: { index: false }` 추가
  - 서버 인증 체크 추가
  - `/mypage` 링크 → `/me` 로 업데이트 (마이페이지 경로 변경 반영)
  - **보존 필수**: `shell.page`·`shell.wrap`·`shell.card`·`shell.head`·`shell.eyebrow` 구조, `NotificationsForm` 렌더

### 알림 7종 항목 정의

```ts
const NOTIFICATION_ITEMS = [
  { key: "comment.created",       title: "댓글 알림",       desc: "내 글에 새 댓글이 달리면 알려드려요." },
  { key: "answer.created",        title: "답변 알림",       desc: "내 질문에 새 답변이 달리면 알려드려요." },
  { key: "comment.replied",       title: "대댓글 알림",     desc: "내 댓글에 답글이 달리면 알려드려요." },
  { key: "reaction.received",     title: "좋아요 알림",     desc: "내 글이나 댓글이 좋아요를 받으면 알려드려요." },
  { key: "helpful_answer.marked", title: "도움된 답변 알림",desc: "내 답변이 도움된 답변으로 표시되면 알려드려요." },
  { key: "message.received",      title: "쪽지 알림",       desc: "새 쪽지가 도착하면 알려드려요." },
  { key: "sanction.applied",      title: "제재 알림",       desc: "항상 수신됩니다. 운영 정책에 따른 필수 알림입니다.", disabled: true },
] as const;
```

### 낙관적 업데이트 패턴

```ts
async function toggle(key: NotificationKey) {
  if (key === "sanction.applied") return; // disabled 항목 무시
  const prev = prefs;
  setPrefs(p => ({ ...p, [key]: !p[key] })); // 낙관적 업데이트
  try {
    await patchSettings({ settings: { [key]: !prev[key] } });
  } catch {
    setPrefs(prev); // 롤백
    toast.danger("저장에 실패했습니다. 다시 시도해 주세요.");
  }
}
```

### 테스트 표준

- `apps/api/src/routes/v1/notifications/routes.test.ts` (UPDATE):
  - `PATCH /settings`: `sanction.applied: false` 포함 요청 → 응답에서 강제 `true` 검증
  - `GET /settings`: settings 레코드 없는 유저 → 기본값 7종 all true 반환 검증
- `apps/web/app/settings/notifications/NotificationsForm.test.tsx` (NEW, optional): 토글 실패 시 rollback 동작

### 보안

- `PATCH /settings`: 인증 필수 (401 미인증)
- `sanction.applied` 서버 강제 true: 클라이언트 조작으로 제재 알림 차단 불가

### Project Structure Notes

- `notification_settings` 레코드가 없는 경우 `GET /settings`는 기본값(`DEFAULT_SETTINGS`)을 반환 (DB insert 없이). `PATCH /settings` 최초 호출 시 upsert로 생성.
- `apps/web/app/settings/settings.module.css` (공통 셸 스타일) — 직접 수정 금지, 기존 token 참조만

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3, L2132~2154]
- [Source: apps/web/app/settings/notifications/NotificationsForm.tsx — 현재 구현 완독]
- [Source: apps/web/app/settings/notifications/page.tsx — 현재 구현 완독]
- [Source: apps/web/app/settings/notifications/notifications.module.css — 기존 CSS 구조]
- [Source: _bmad-output/project-context.md#통신 패턴 — 낙관적 업데이트]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- `DEFAULT_NOTIFICATION_SETTINGS`가 `@ai-jakdang/database` 최상위에서 직접 export되지 않아 service.ts에 로컬 상수로 재정의함 (schema/index.ts의 `export *`는 `export * as schema` 구조로 wrapping돼 직접 임포트 불가).
- `NotificationsForm.tsx`에서 `<form>`을 `<div>`로 변경하여 저장 버튼 없는 자동저장 UX 구현. `shell.actions` 클래스는 "마이페이지로" back 링크 배치에 재활용.

### Completion Notes List
- **Task 1** (`apps/api`): `service.ts`에 `getSettings(userId)` / `updateSettings(userId, patch)` 추가. `getSettings`는 레코드 없으면 기본값 7종 all true 반환(DB insert 없이). `updateSettings`는 `onConflictDoUpdate` upsert + `sanction.applied` 강제 true 덮어씌움. `routes.ts`에 `GET /settings` · `PATCH /settings` 추가 — 기존 4개 라우트 보존.
- **Task 2** (`apps/web`): `NotificationsForm.tsx`를 5종 목업에서 7종 실API 연동으로 전면 교체. 마운트 시 GET 호출 → 로딩 중 Switch disabled → 낙관적 업데이트 → 실패 시 롤백 + danger 토스트. 기존 `styles.list` / `styles.item` / `Switch` 패턴 완전 보존.
- **Task 3** (`apps/web`): `page.tsx`에 `robots: { index: false, follow: false }` 추가 + 서버 쿠키 기반 인증 게이팅(`redirect('/login?redirectTo=/settings/notifications')`). 기존 레이아웃 셸 완전 보존.
- **Task 4**: `pnpm typecheck` 전체 워크스페이스 통과. `routes.test.ts` 19개 테스트 통과(기존 9개 + 신규 10개). `notifications.test.ts` 4개 통과(AC #4 검증).

### File List
- `apps/api/src/routes/v1/notifications/routes.ts` — GET /settings, PATCH /settings 추가
- `apps/api/src/routes/v1/notifications/service.ts` — getSettings, updateSettings 추가
- `apps/api/src/routes/v1/notifications/routes.test.ts` — Story 7.3 테스트 추가
- `apps/web/app/settings/notifications/NotificationsForm.tsx` — 전면 교체 (7종 실API 연동)
- `apps/web/app/settings/notifications/page.tsx` — robots noindex, 인증 게이팅 추가

### Change Log
- 2026-06-24: Story 7.3 구현 완료 — API 설정 엔드포인트(GET/PATCH /settings), NotificationsForm 7종 실연동, page.tsx noindex+인증 게이팅

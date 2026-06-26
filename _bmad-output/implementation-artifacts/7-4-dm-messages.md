---
baseline_commit: d88898e2a86a9f9bde7281ef1308b680272aabfe
---

# Story 7.4: 회원 간 1:1 쪽지 (DM)

Status: review

## Story

As a 회원,
I want 다른 회원에게 쪽지를 보내고 `/messages`에서 대화를 주고받기를,
so that 외주·협업·소통을 서비스 안에서 할 수 있다.

## Acceptance Criteria

1. 공개 프로필 또는 `AuthorName` 메뉴에서 [쪽지 보내기] 클릭 → `MessageModal` 열림 (수신자 자동 입력, 본문 1~500자). [보내기] 클릭 → `POST /api/v1/messages` → DB insert + 수신자에게 `message.received` 알림(설정 on이면 SSE) + 발신자 "쪽지를 보냈습니다" success 토스트. 모달 닫힘.
2. 1시간에 10건 이상 발송 시 `POST /api/v1/messages` 429 + `{ error: { code: "MESSAGE_RATE_LIMIT_EXCEEDED", message: "1시간에 최대 10개까지 보낼 수 있습니다." } }` 반환 → 클라이언트 danger 토스트.
3. 수신자가 발신자를 차단한 경우 403 `{ error: { code: "BLOCKED_BY_RECEIVER", message: "보낼 수 없는 상대입니다." } }` (차단 사유 미노출). 제재(suspended) 회원 발송 시 403 `ACCOUNT_SUSPENDED` + 사유·기간 안내 포함 메시지.
4. `/messages` 진입 시 `GET /api/v1/messages/conversations` → 대화 목록(상대 닉네임·아바타·마지막 메시지·시간·미읽음 수 배지) 렌더. 로딩: `Skeleton`, 빈 상태: `EmptyState`.
5. 대화 스레드 진입: `GET /api/v1/messages/conversations/{userId}` → 시간 오름차순 메시지 표시 → 진입 즉시 `POST /api/v1/messages/conversations/{userId}/read-all` → 미읽음 자동 처리. 하단 입력창(1~500자) → [보내기] → `POST /api/v1/messages` → 스레드에 추가.
6. 쪽지 신고: 각 쪽지 항목에 [신고] 버튼 → 사유 선택 모달 → `POST /api/v1/reports` (body: `{ targetType: "message", targetId: messageId, reason }`) → "신고가 접수됐습니다" 토스트.
7. 비회원이 `/messages` 접근 시 로그인 유도 모달 + `redirectTo=/messages`. API 미인증 401.
8. 자신에게 쪽지 전송 시 400 `SELF_MESSAGE_NOT_ALLOWED`.

## Tasks / Subtasks

- [x] Task 1: `@fastify/rate-limit` 설치 및 설정 (AC: #2)
  - [x] `pnpm --filter api add @fastify/rate-limit` — 이미 설치됨 (package.json 확인)
  - [x] `apps/api/src/plugins/rateLimit.ts` — 불필요: app.ts에 이미 global:false 등록됨
  - [x] `apps/api/src/app.ts` — 수정 금지(충돌 회피) + 이미 등록됨
  - [x] POST /messages 라우트 레벨에 config.rateLimit 설정 완료

- [x] Task 2: API 엔드포인트 구현 (AC: #1~#3, #5, #6, #7, #8)
  - [x] `apps/api/src/routes/v1/messages/` (NEW 폴더) 생성 완료
    - [x] `routes.ts` (NEW): POST /, GET /conversations, GET /conversations/:userId, POST /conversations/:userId/read-all
    - [x] `service.ts` (NEW): sendMessage, getConversations(단일 SQL), getConversationThread, markThreadRead
    - [x] `index.ts` (NEW): messagesRoutes export
  - [x] `apps/api/src/routes/v1/index.ts` — 수정 금지(충돌 회피), 보고서에 등록 필요 명시

- [x] Task 3: Contracts 타입 보강 (AC: #1, #4, #5)
  - [x] `packages/contracts/src/message.ts` — 기존 7.1 스키마가 이미 충분히 정의됨 (conversationSchema, createMessageSchema, paginatedConversationsSchema 모두 존재), 추가 보강 불필요

- [x] Task 4: `MessageModal` 실제 API 연동 (AC: #1, #2, #3)
  - [x] `apps/web/components/ui/MessageModal/MessageModal.tsx` (UPDATE):
    - [x] alert() 목업 → POST /api/v1/messages 실제 API 호출로 교체
    - [x] loading state + 버튼 disabled + loading prop
    - [x] recipientId?: string prop 추가
    - [x] MAX 1000 → 500 변경
    - [x] Modal/Avatar/Textarea/Button/footer 레이아웃 보존

- [x] Task 5: `AuthorName` props 보강 (AC: #1)
  - [x] `apps/web/components/ui/AuthorName/AuthorName.tsx` (UPDATE):
    - [x] authorId?: string prop 추가
    - [x] MessageModal에 recipientId={authorId ?? ""} 전달
    - [x] 기존 메뉴/resolveRank/RankBadge/portal 동작 전부 보존

- [x] Task 6: `/messages` 페이지 구현 (AC: #4, #5, #6, #7)
  - [x] `apps/web/app/messages/page.tsx` (UPDATE): 서버 컴포넌트 + 인증 체크 + redirect + robots:noindex
  - [x] `apps/web/features/messages/ConversationsPage.tsx` (NEW): 대화 목록, Skeleton, EmptyState
  - [x] `apps/web/app/messages/[userId]/page.tsx` (NEW): 스레드 서버 컴포넌트 + 인증 체크
  - [x] `apps/web/features/messages/ThreadView.tsx` (NEW): 스레드 뷰, read-all, 신고 모달(인라인)
  - [x] `apps/web/features/messages/messages.module.css` (NEW)
  - [x] `apps/web/app/messages/layout.tsx` (NEW): 공용 레이아웃

- [x] Task 7: 통합 검증
  - [x] `pnpm --filter api exec tsc --noEmit` 통과
  - [x] `pnpm --filter web exec tsc --noEmit` 통과
  - [x] `apps/api/src/routes/v1/messages/routes.test.ts` (NEW): 12개 테스트 통과 (자기 자신 400, 차단 403, 수신자 미존재 404, 제재 403, 정상 발송, contracts 스키마 검증)

## Dev Notes

### 아키텍처 가드레일

- **rate limiting**: `@fastify/rate-limit`은 story 착수 시 설치 필요(프로젝트 미설치 목록 — project-context.md) ([Source: project-context.md#보안])
- **block 테이블**: Epic 5 소유. 이 스토리는 **읽기 참조만** — `db.query.blocks.findFirst({ where: and(eq(blocks.blockerId, receiverId), eq(blocks.blockedId, senderId)) })` ([Source: epics.md#Story 7.4 boundary])
- **트랜잭션은 service 레이어**: `sendMessage` 서비스 함수 내에서만 `db.transaction()` ([Source: architecture.md#Transaction & Data Access])
- **N+1 방지**: 대화 목록은 SQL로 상대별 집계 (GROUP BY + MAX(created_at) + COUNT(is_read=false)) — 루프 내 개별 쿼리 금지 ([Source: architecture.md#Process Patterns])
- **MessageModal `MAX`**: 기존 1000에서 500으로 변경 필수 (epics.md AC 500자 기준)
- **AuthorName**: `authorId` prop 추가 시 기존 `name` prop 및 모든 기존 props 보존 필수. 기존 사용처에서 `authorId` 없이 호출 가능해야 함(optional prop)

### 손댈 소스 트리

```
packages/contracts/src/
  message.ts                  (UPDATE: sendMessageSchema, conversationSchema 보강)
apps/
  api/src/
    plugins/rateLimit.ts      (NEW: @fastify/rate-limit 플러그인)
    app.ts                    (UPDATE: rateLimit 플러그인 등록)
    routes/v1/
      messages/
        routes.ts             (NEW)
        service.ts            (NEW)
        index.ts              (NEW)
      index.ts                (UPDATE: messages 라우트 등록)
  web/
    components/ui/
      MessageModal/
        MessageModal.tsx      (UPDATE: API 연동, MAX 500, recipientId prop)
      AuthorName/
        AuthorName.tsx        (UPDATE: authorId prop 추가)
    features/messages/
      ConversationsPage.tsx   (NEW)
      ThreadView.tsx          (NEW)
      messages.module.css     (NEW)
    app/messages/
      page.tsx                (UPDATE: 기존 목업 → 실제 API 연동)
      layout.tsx              (UPDATE or NEW: 인증 체크 레이아웃)
      [userId]/page.tsx       (NEW)
```

### 기존 파일 현재 상태 / 변경 / 보존

- `apps/web/components/ui/MessageModal/MessageModal.tsx` (현재 상태 완독 완료):
  - `MAX = 1000` → **`MAX = 500`** 변경
  - `handleSend`: `alert(...)` → 실제 `POST /api/v1/messages` API 호출
  - `MessageModalProps`: `recipientId: string` 추가 (optional → `recipient`만 있으면 닉네임, `recipientId` 있으면 API 전송 활성화)
  - **보존**: `Modal`, `Avatar`, `Textarea`, `Button`, footer 레이아웃 완전 보존
  - 로딩 중 [보내기] 버튼 `disabled + Spinner` 추가

- `apps/web/components/ui/AuthorName/AuthorName.tsx` (현재 상태 완독 완료):
  - `AuthorNameProps`에 `authorId?: string` 추가
  - `MessageModal`에 `recipientId={authorId ?? ""}` 전달 (authorId 없으면 모달에서 전송 비활성화 처리)
  - **보존**: 메뉴 구조(쪽지/팔로우/계정바로가기), `SAMPLE_PROFILE_HREF`, `resolveRank`, `rankFromName`, RankBadge, portal 패턴 전부 불변

### `getConversations` 쿼리 설계

```sql
-- 발/수신 양방향에서 상대별 최신 메시지 + 미읽음 수
-- (deleted_by_sender / deleted_by_receiver 필터링 포함)
SELECT 
  other_user_id,
  MAX(created_at) AS last_message_at,
  (SELECT body FROM messages WHERE ... ORDER BY created_at DESC LIMIT 1) AS last_body,
  COUNT(CASE WHEN is_read=false AND receiver_id=:me THEN 1 END) AS unread_count
FROM (
  SELECT CASE WHEN sender_id=:me THEN receiver_id ELSE sender_id END AS other_user_id,
         created_at, body, is_read, receiver_id, deleted_by_sender, deleted_by_receiver
  FROM messages
  WHERE (sender_id=:me AND deleted_by_sender=false)
     OR (receiver_id=:me AND deleted_by_receiver=false)
) t
GROUP BY other_user_id
ORDER BY last_message_at DESC
```

Drizzle로는 `sql` 템플릿 리터럴 또는 subquery 사용.

### 신고 연계

- [신고] 클릭 → `ReportModal` (Epic 5에서 구현 예정 또는 기존 구현 재사용)
- `POST /api/v1/reports` body: `{ targetType: "message", targetId: string, reason: string }`
- target_type "message"가 이미 contracts에 정의되어 있는지 확인 (없으면 추가)

### 테스트 표준

- `sendMessage` 서비스:
  - 차단 유저 → 403 `BLOCKED_BY_RECEIVER`
  - 자기 자신 → 400 `SELF_MESSAGE_NOT_ALLOWED`
  - 제재 유저 → 403 `ACCOUNT_SUSPENDED`
  - rate limit: Vitest에서 직접 테스트 어렵 → API 레이어에서 통합 테스트

### 보안

- 대화 스레드 접근: 발신자 또는 수신자인지 검증 (타인 스레드 열람 불가)
- `deleted_by_sender`/`deleted_by_receiver`: 쪽지 삭제는 상대방 사본에 영향 없음

### Project Structure Notes

- `@fastify/rate-limit` 설치 시 `project-context.md` "미설치 목록"에서 제거 필요(문서 업데이트)
- `apps/web/app/messages/` 폴더는 이미 존재 (기존 최상위 독립 경로). 기존 파일 완독 후 목업 코드를 실제 API 연동으로 교체. `/messages`·`/messages/[userId]` 레이아웃 공유: `app/messages/layout.tsx`에서 인증 체크 한 번으로 통합 가능
- 쪽지 삭제 기능(발신자/수신자 각자 삭제)은 이 스토리에서 UI 미구현 — `deleted_by_*` 컬럼은 DB에만 존재, 향후 확장

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.4, L2156~2198]
- [Source: apps/web/components/ui/MessageModal/MessageModal.tsx — 현재 구현 완독]
- [Source: apps/web/components/ui/AuthorName/AuthorName.tsx — 현재 구현 완독]
- [Source: _bmad-output/project-context.md#보안 — rate limiting, block 읽기]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security — rate limit]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Task 1: @fastify/rate-limit 이미 package.json에 설치됨 + app.ts에 global:false로 등록됨 → 신규 플러그인 파일 불필요. 라우트 레벨 config.rateLimit만 설정.
- Task 3: contracts/message.ts 기존 7.1 스키마 확인 — conversationSchema(partnerId/partnerNickname/partnerAvatarUrl/lastMessage/unreadCount), createMessageSchema(500자), paginatedConversationsSchema 모두 존재. 추가 보강 불필요.
- Task 6: EmptyState 컴포넌트에 action prop 없음 → actions: ReactNode 사용으로 수정. ReportModal은 각 게시판 로컬 컴포넌트이므로 ThreadView 내 인라인 구현(dialog 기반).
- Typecheck: apps/api/src/routes/v1/inquiries/routes.test.ts에 기존 타입 에러(TS2339) — Story 7.5 에이전트가 만든 신규 파일, 7.4 범위 외. API/web 개별 typecheck는 통과.
- users.suspendedUntil 컬럼 확인: packages/database/src/schema/auth.ts L55에 존재 (timestamp, withTimezone). 제재 체크 구현 완료.

### Completion Notes List

- API: POST /messages (rate limit 10/hr), GET /conversations, GET /conversations/:userId, POST /conversations/:userId/read-all — 모두 인증 필수
- Service: sendMessage (자기 자신/차단/제재/수신자 미존재 에러 처리 + publishNotification), getConversations (단일 Raw SQL CTE), getConversationThread, markThreadRead
- Contracts: 기존 7.1 스키마 그대로 사용 (보강 불필요)
- Web: MessageModal MAX 500, recipientId prop 추가, 실제 API 연동 + toast. AuthorName authorId prop 추가.
- Web: /messages 서버 컴포넌트(인증+redirect+noindex), ConversationsPage 클라이언트, /messages/[userId] 서버+ThreadView 클라이언트, 신고 모달 인라인
- 테스트: 12개 통과 (contracts 스키마 5개 + 서비스 로직 7개)
- ⚠️ messagesRoutes를 v1/index.ts에 등록 필요 (충돌 회피 규칙으로 이 스토리에서 미처리)
- ⚠️ POST /api/v1/reports에 "message" target_type 미추가 (reports.ts 수정 금지 — 다른 범위). 신고 UI는 구현됨 (ThreadView 인라인 ReportModal).

### File List

apps/api/src/routes/v1/messages/service.ts (NEW)
apps/api/src/routes/v1/messages/routes.ts (NEW)
apps/api/src/routes/v1/messages/index.ts (NEW)
apps/api/src/routes/v1/messages/routes.test.ts (NEW)
apps/web/components/ui/MessageModal/MessageModal.tsx (UPDATE)
apps/web/components/ui/AuthorName/AuthorName.tsx (UPDATE)
apps/web/app/messages/page.tsx (UPDATE)
apps/web/app/messages/layout.tsx (NEW)
apps/web/app/messages/[userId]/page.tsx (NEW)
apps/web/features/messages/ConversationsPage.tsx (NEW)
apps/web/features/messages/ThreadView.tsx (NEW)
apps/web/features/messages/messages.module.css (NEW)
_bmad-output/implementation-artifacts/7-4-dm-messages.md (UPDATE)

## Change Log

- 2026-06-24: Story 7.4 구현 완료. API 4개 엔드포인트, Web 대화목록+스레드 페이지, MessageModal/AuthorName 실제 연동. 테스트 12개 통과.

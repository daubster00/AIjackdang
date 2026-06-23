# Story 7.1: 알림·쪽지·문의 DB 스키마 + SSE Pub/Sub 파이프라인

Status: ready-for-dev

## Story

As a 개발팀,
I want `notification`·`message`·`inquiry`·`inquiry_reply`·`notification_settings` 스키마와 SSE+Redis Pub/Sub 팬아웃 인프라가 정착되기를,
so that 이후 모든 알림·쪽지·문의 스토리(7.2~7.5)가 이 기반 위에서 안전하게 구현된다.

## Acceptance Criteria

1. `drizzle-kit generate && migrate` 실행 후 `notifications`·`messages`·`inquiries`·`inquiry_replies`·`notification_settings` 5개 테이블이 PostgreSQL에 존재한다.
   - `notifications`: `id`(uuid PK)·`user_id`(FK→users)·`type`(pgEnum: `comment.created`|`answer.created`|`comment.replied`|`reaction.received`|`helpful_answer.marked`|`message.received`|`sanction.applied`)·`target_type`(text nullable)·`target_id`(uuid nullable)·`title`(text)·`body`(text)·`is_read`(bool default false)·`created_at`(timestamptz)
   - `messages`: `id`(uuid PK)·`sender_id`(FK→users)·`receiver_id`(FK→users)·`body`(text 500자 제한 DB 레벨 불필요, 앱 레벨 검증)·`is_read`(bool default false)·`deleted_by_sender`(bool default false)·`deleted_by_receiver`(bool default false)·`created_at`(timestamptz)
   - `inquiries`: `id`(uuid PK)·`user_id`(FK→users)·`title`(text)·`body`(jsonb — Tiptap JSON)·`status`(pgEnum: `pending`|`in_progress`|`resolved` default `pending`)·`created_at`(timestamptz)·`updated_at`(timestamptz)
   - `inquiry_replies`: `id`(uuid PK)·`inquiry_id`(FK→inquiries)·`author_type`(pgEnum: `user`|`admin`)·`author_id`(uuid)·`body`(jsonb — Tiptap JSON)·`created_at`(timestamptz)
   - `notification_settings`: `id`(uuid PK)·`user_id`(uuid unique FK→users)·`settings`(jsonb default `{"comment.created":true,"answer.created":true,"comment.replied":true,"reaction.received":true,"helpful_answer.marked":true,"message.received":true,"sanction.applied":true}`)·`created_at`(timestamptz)·`updated_at`(timestamptz)

2. `packages/contracts`에 `notificationSchema`·`NotificationEventPayload`·`messageSchema`·`conversationSchema`·`inquirySchema`·`inquiryReplySchema`·`notificationSettingsSchema`와 페이지네이션 래퍼가 정의되고, `pnpm typecheck` 통과(api/web 모두).

3. `GET /api/v1/notifications/sse` 엔드포인트가 존재하고:
   - 인증 회원: `Content-Type: text/event-stream` 연결 유지, 25초마다 keepalive ping 이벤트 전송
   - 미인증: 401 반환
   - 연결 시 user_id 기준 커넥션 맵에 등록, 연결 해제 시 제거

4. Redis Pub/Sub 채널 `notification:{userId}` 구독: 다른 인스턴스가 해당 채널에 `PUBLISH`하면 해당 유저의 SSE 커넥션을 보유한 인스턴스만 이벤트를 push한다(ECS 다중 인스턴스 팬아웃).

5. `publishNotification(userId, payload)` 헬퍼 함수가 존재하고:
   - `notifications` 테이블에 insert
   - `notification_settings` 조회 후 해당 type이 `false`면 Redis PUBLISH 생략(insert는 수행)
   - type이 `true`이거나 settings 레코드가 없으면 Redis PUBLISH 수행 → SSE 팬아웃

6. 새 유저 가입 시 `notification_settings` 레코드가 자동 생성된다(all true 기본값). 또는 최초 조회 시 upsert 생성.

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 정의 (AC: #1)
  - [ ] `packages/database/src/schema/notifications.ts` 신규 생성: `notificationType` pgEnum, `notifications` 테이블, Row 타입
  - [ ] `packages/database/src/schema/messages.ts` 신규 생성: `messages` 테이블, Row 타입
  - [ ] `packages/database/src/schema/inquiries.ts` 신규 생성: `inquiryStatus` pgEnum, `inquiries` 테이블, Row 타입
  - [ ] `packages/database/src/schema/inquiry-replies.ts` 신규 생성: `authorType` pgEnum, `inquiryReplies` 테이블, Row 타입
  - [ ] `packages/database/src/schema/notification-settings.ts` 신규 생성: `notificationSettings` 테이블, Row 타입
  - [ ] `packages/database/src/schema/index.ts` (UPDATE): 위 5개 모듈 export 추가
  - [ ] `pnpm drizzle-kit generate` → 마이그레이션 파일 생성 → `pnpm drizzle-kit migrate` 실행 검증

- [ ] Task 2: Contracts 타입·Zod 스키마 정의 (AC: #2)
  - [ ] `packages/contracts/src/notification.ts` 신규 생성:
    - `notificationTypeSchema` (z.enum with 7 types)
    - `notificationSchema` (단건 응답), `NotificationEventPayload` (SSE 페이로드 타입)
    - `createNotificationSchema` (publishNotification 입력)
    - `paginatedResponseSchema(notificationSchema)` 래퍼
  - [ ] `packages/contracts/src/message.ts` 신규 생성:
    - `messageSchema` (단건), `createMessageSchema` (본문 1~500자)
    - `conversationSchema` (대화 목록 아이템: 상대 userId/nickname/rank·마지막메시지·unreadCount)
    - `paginatedResponseSchema` 래퍼
  - [ ] `packages/contracts/src/inquiry.ts` 신규 생성:
    - `inquiryStatusSchema`, `inquirySchema`, `createInquirySchema` (title 1~100자, body Tiptap JSON)
    - `inquiryReplySchema`, `createInquiryReplySchema`
    - `paginatedResponseSchema` 래퍼
  - [ ] `packages/contracts/src/notification-settings.ts` 신규 생성:
    - `notificationSettingsSchema` (settings jsonb), `updateNotificationSettingsSchema` (partial)
  - [ ] `packages/contracts/src/index.ts` (UPDATE): 위 4개 모듈 re-export 추가
  - [ ] `pnpm typecheck` 전 워크스페이스 통과 확인

- [ ] Task 3: SSE 인프라 구현 (AC: #3, #4)
  - [ ] `apps/api/src/lib/sse.ts` (NEW): `SseConnectionMap` 클래스
    - `add(userId, reply)` / `remove(userId, reply)` / `push(userId, event)` 메서드
    - `Map<string, Set<FastifyReply>>` 내부 구조 (다중 탭/기기 지원)
  - [ ] `apps/api/src/lib/redis-pubsub.ts` (NEW):
    - `ioredis` subscriber 인스턴스 별도 생성 (BullMQ connection과 분리)
    - `subscribeUserNotifications(userId)` — `notification:{userId}` 채널 구독
    - `unsubscribeUserNotifications(userId)` — 구독 해제
    - `SUBSCRIBE` 메시지 수신 시 `sseConnectionMap.push(userId, event)` 호출
  - [ ] `apps/api/src/routes/v1/notifications/` (NEW 폴더):
    - `sse.ts`: `GET /sse` 핸들러
      - `request.session` 인증 체크 → 미인증 401
      - `reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })`
      - `sseConnectionMap.add(userId, reply)`
      - 25초 keepalive interval (`data: ping\n\n`)
      - `request.socket.on('close', ...)` → cleanup: interval 정리, `sseConnectionMap.remove`, `unsubscribeUserNotifications`
      - 연결 시 `subscribeUserNotifications(userId)`
  - [ ] `apps/api/src/routes/v1/notifications/index.ts` (NEW): SSE 라우트 등록 (나머지 CRUD는 Story 7.2에서)
  - [ ] `apps/api/src/routes/v1/index.ts` (UPDATE): notifications 라우트 등록

- [ ] Task 4: `publishNotification` 헬퍼 (AC: #5)
  - [ ] `apps/api/src/lib/notifications.ts` (NEW):
    ```ts
    // publishNotification(userId, payload): 
    // 1. db.insert(notifications).values(...)
    // 2. notification_settings 조회 (없으면 all-true 기본 처리)
    // 3. settings[payload.type] !== false → ioredis.publish(`notification:${userId}`, JSON.stringify(payload))
    ```
  - [ ] 타입: `payload`는 `NotificationEventPayload`(`@ai-jakdang/contracts`)
  - [ ] `ioredis` publisher 인스턴스는 `apps/api/src/lib/redis.ts` 단일 파일에서 export (subscriber와 별개 인스턴스 필요)

- [ ] Task 5: notification_settings 자동 초기화 (AC: #6)
  - [ ] `apps/api/src/lib/notifications.ts`의 `publishNotification` 내부: `notificationSettings`가 없으면 기본값 upsert 후 진행
  - [ ] 또는 회원가입 service에서 가입 완료 후 `db.insert(notificationSettings)` 트랜잭션에 포함 (Story 1.x 인증 story와 의존 관계 확인 필요 — 안전하게 upsert로 처리 권장)

- [ ] Task 6: 통합 검증 (AC: #1~#6)
  - [ ] `pnpm typecheck` 전 워크스페이스 통과
  - [ ] SSE 엔드포인트 수동 테스트: `curl -N -H "Cookie: aj_session=..." http://localhost:4003/api/v1/notifications/sse`
  - [ ] Vitest 단위 테스트: `apps/api/src/lib/notifications.test.ts` (publishNotification — settings off 시 publish 미호출 검증)

## Dev Notes

### 아키텍처 가드레일

- **DB 접근은 `apps/api`·`apps/worker`만** — 모든 스키마는 `packages/database/src/schema/`, 마이그레이션은 `drizzle-kit` 단독 소유권 ([Source: project-context.md#패키지 경계 & 격리])
- **Drizzle 버전: 0.38 stable** — `drizzle-orm` 0.38.x, `drizzle-kit` 0.30.x. v1.0 beta 금지 ([Source: project-context.md#Technology Stack])
- **타입·검증은 `packages/contracts`** — 즉석 로컬 타입 정의 금지 ([Source: architecture.md#Implementation Patterns])
- **SSE + Redis Pub/Sub 팬아웃 필수** — ECS 다중 인스턴스 환경에서 단일 인스턴스 가정 금지. subscriber용 ioredis 인스턴스는 BullMQ connection과 **반드시 별개** (ioredis subscriber 모드는 다른 명령 혼용 불가) ([Source: architecture.md#API & Communication Patterns, AR-14])
- **이벤트명 = `domain.event`** 형식: `comment.created`, `answer.created`, `comment.replied`, `reaction.received`, `helpful_answer.marked`, `message.received`, `sanction.applied` ([Source: architecture.md#Communication Patterns])
- **DB 네이밍**: 테이블=`snake_case` 복수형, 컬럼=`snake_case`, Drizzle 프로퍼티=`camelCase`, PK=`uuid defaultRandom()`, FK=`{entity}_id`, 타임스탬프=`timestamptz` ([Source: architecture.md#Naming Patterns])
- **마이그레이션 주의**: inquiry·notification 동시 작업 충돌 방지 — 단일 소유권 확인 후 `generate` ([Source: architecture.md#Data Architecture, project-context.md])

### 손댈 소스 트리

```
packages/
  database/src/schema/
    notifications.ts        (NEW)
    messages.ts             (NEW)
    inquiries.ts            (NEW)
    inquiry-replies.ts      (NEW)
    notification-settings.ts (NEW)
    index.ts                (UPDATE: 5개 export 추가)
  contracts/src/
    notification.ts         (NEW)
    message.ts              (NEW)
    inquiry.ts              (NEW)
    notification-settings.ts (NEW)
    index.ts                (UPDATE: 4개 re-export 추가)
apps/
  api/src/
    lib/
      redis.ts              (NEW: publisher ioredis 인스턴스)
      redis-pubsub.ts       (NEW: subscriber 인스턴스 + 채널 관리)
      sse.ts                (NEW: SseConnectionMap)
      notifications.ts      (NEW: publishNotification 헬퍼)
    routes/v1/
      notifications/
        sse.ts              (NEW: GET /sse 핸들러)
        index.ts            (NEW: 라우트 등록)
      index.ts              (UPDATE: notifications 라우트 prefix 등록)
```

### 기존 파일 현재 상태 / 변경 / 보존

- `packages/database/src/schema/index.ts` (현재: `export * from "./users"` 1줄) → 5개 export 추가. `users.ts`의 기존 export **보존 필수**
- `packages/contracts/src/index.ts` (현재: `export * from "./common"; export * from "./auth"; export * from "./post"`) → 4개 re-export 추가. 기존 3개 export **보존 필수**
- `apps/api/src/routes/v1/index.ts` (현재: `/auth/sign-up`, `/auth/me` 스켈레톤 라우트) → notifications 라우트 `prefix: /notifications` 등록 추가. 기존 라우트 **삭제/변경 금지**
- `apps/api/src/app.ts` (현재: Fastify 설정, cors, helmet, sensible, healthRoutes, v1Routes 등록) → **변경 불필요** (v1Routes에 이미 포함됨)

### `notification_settings` jsonb 기본값 설계

```ts
const DEFAULT_SETTINGS = {
  "comment.created": true,
  "answer.created": true,
  "comment.replied": true,
  "reaction.received": true,
  "helpful_answer.marked": true,
  "message.received": true,
  "sanction.applied": true,  // 항상 on (7.3에서 UI 비활성화)
};
```

`sanction.applied`는 7.3 설정 화면에서 UI 레벨 비활성(항상 on)으로 표시하지만 DB에는 true 고정.

### `publishNotification` 로직 상세

```ts
async function publishNotification(
  userId: string,
  payload: NotificationEventPayload,  // { type, targetType?, targetId?, title, body }
  db: DrizzleDB,
  redisPublisher: Redis,
) {
  // 1. insert
  const [notif] = await db.insert(notifications).values({
    userId, type: payload.type, targetType: payload.targetType ?? null,
    targetId: payload.targetId ?? null, title: payload.title, body: payload.body,
  }).returning();

  // 2. settings 조회 (없으면 전체 true 기본)
  const settingsRow = await db.query.notificationSettings
    .findFirst({ where: eq(notificationSettings.userId, userId) });
  const settings = settingsRow?.settings ?? DEFAULT_SETTINGS;

  // 3. type off이면 SSE 생략
  if (settings[payload.type] === false) return notif;

  // 4. Redis PUBLISH (fanout → 해당 유저 SSE 커넥션 보유 인스턴스만 push)
  await redisPublisher.publish(
    `notification:${userId}`,
    JSON.stringify({ ...payload, id: notif.id, createdAt: notif.createdAt }),
  );
  return notif;
}
```

### 테스트 표준

- co-located `apps/api/src/lib/notifications.test.ts` (Vitest)
- Mock: Drizzle DB (vitest mock), ioredis mock
- 핵심 케이스: ① settings off → PUBLISH 미호출 ② settings on → PUBLISH 호출 ③ settings 레코드 없음 → 기본 true로 PUBLISH 호출

### 보안·성능

- SSE 커넥션은 인증 필수(미인증 401 즉시 반환)
- Redis subscriber는 앱 시작 시 1개 인스턴스만 생성(연결 과다 방지)
- `notification_settings` 조회는 `userId`가 unique index이므로 O(1)

### Project Structure Notes

- `ioredis` 5.10.1 이미 설치(`apps/worker` 의존성) — `apps/api`에도 추가 필요: `pnpm --filter api add ioredis`
- `@fastify/rate-limit`은 아직 미설치(project-context.md 미설치 목록) — 이 스토리에서는 SSE만, rate-limit은 7.4/7.5에서 설치
- Fastify SSE: Node.js `response.raw` 직접 조작 방식 사용 (`@fastify/reply-from` 불필요)
- `packages/database`에 drizzle `query` 모드를 사용하는 경우 `schema` 모두 `db` 인스턴스에 등록 필요 (`packages/database/src/client.ts` 확인 후 `{ schema }` 전달)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1, L2072~2099]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns — SSE + Redis Pub/Sub]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — notification·message·inquiry 테이블]
- [Source: _bmad-output/project-context.md#통신 패턴, #패키지 경계 & 격리]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

# Story 11.17: 일일 집계·리포트 API + 보류 큐 처리 액션

Status: ready-for-dev

## Story

As a 시스템 관리자,
I want 봇의 어제 활동을 집계한 일일 리포트 API와, 보류 큐 항목을 통과·폐기할 수 있는 액션 엔드포인트를 갖기,
so that 매일 아침 봇 운영 현황을 한눈에 파악하고, 사람의 판단이 필요한 보류 콘텐츠를 즉시 처리할 수 있다.

---

## Acceptance Criteria

1. `bot.daily-report`(일일 리포트 크론) 잡이 매일 아침(07:00 KST = 전일 22:00 UTC) 실행되어
   어제 `bot_activity_log`(봇 활동 로그)를 집계한다:
   글 N·댓글 M·캐릭터 분포·게시 목록(링크)·보류 건수·경고(차단 수·재생성 다발 페르소나·잠수 계정)·비용 합계·전체 상태(`ok`|`warning`).
   `GET /api/v1/admin/bots/report?date=YYYY-MM-DD` 엔드포인트로 동일 집계를 on-demand로 제공한다.

2. 보류 항목 통과: `PATCH /api/v1/admin/bots/hold-queue/:id/approve` 호출 시
   `bot_generation_jobs.job_kind`(잡 종류)에 따라 5종 작성 함수로 분기해 게시한다:
   `post`→`createPostAsBot`, `comment`→`createCommentAsBot`, `reply`→`createReplyAsBot`,
   `question`→`createQuestionAsBot`, `resource`→`createResourceAsBot`.
   `bot_hold_queue`(보류 큐)에 `decided=true`, `decision='approved'`, `decided_at=now()`,
   `decided_by=adminUserId`(결정 관리자 ID)를 기록한다.

3. 보류 항목 폐기: `PATCH /api/v1/admin/bots/hold-queue/:id/discard` 호출 시
   게시 없이 `bot_generation_jobs.status='discarded'`(폐기),
   `bot_hold_queue.decided=true`, `decision='discarded'`, `decided_at=now()`, `decided_by=adminUserId`를 기록하고
   `bot_activity_log`에 `discarded`(폐기) 이벤트를 추가한다.

---

## Tasks / Subtasks

- [ ] Task 1: `BotDailyReport` + `BotDailyReportSummary` Zod 스키마 추가 (AC1, 11.18 연동)
  - [ ] 1.1: `packages/contracts/src/bot.ts` — 11.2에서 생성된 파일에 `botDailyReportSchema` Zod 스키마 + 타입 추가 (Dev Notes §응답 구조 참조)
  - [ ] 1.2: 같은 파일에 11.18 텔레그램 푸시가 사용할 `botDailyReportSummarySchema` + `BotDailyReportSummary` 타입 추가:
    ```ts
    export const botDailyReportSummarySchema = z.object({
      date: z.string(),
      publishedPosts: z.number(),
      publishedComments: z.number(),
      heldCount: z.number(),
      blockedCount: z.number().optional(),
      costUsd: z.number().optional(),
    });
    export type BotDailyReportSummary = z.infer<typeof botDailyReportSummarySchema>;
    ```
  - [ ] 1.3: `packages/contracts/src/index.ts` (배럴) — `botDailyReportSchema`, `BotDailyReport`, `botDailyReportSummarySchema`, `BotDailyReportSummary` export 확인

- [ ] Task 2: 리포트 집계 함수 + GET 엔드포인트 (AC1)
  - [ ] 2.1: `apps/api/src/routes/admin/bots/report.ts` 신규 생성
  - [ ] 2.2: `buildDailyReport(dateStr: string): Promise<BotDailyReport>` 집계 함수 구현
    - KST 날짜 경계 계산 (`getKstDayBounds`, Dev Notes §집계 쿼리 참조)
    - `bot_activity_log` 해당 날짜 전체 조회 (`gte` / `lte`, Drizzle ORM)
    - 이벤트 타입별 카운트 분리: `post.published` / `comment.published` / `held` / `blocked` / `regenerated` / `discarded` / `cost`
    - 캐릭터 분포: `persona_id` 기준 집계 → `bot_personas.nickname`(페르소나 닉네임) 조인
    - 게시 목록: `event_type='post.published'`의 `ref_id`(게시글 ID) → `posts.slug`·`posts.title`·`posts.board` 조인
    - 보류 미결정 건수: `bot_hold_queue WHERE decided=false` COUNT
    - 경고 집계 (Dev Notes §경고 판정 규칙 참조):
      - `blockedCount`: 오늘 `blocked` 이벤트 수
      - `highRegenPersonas`(재생성 다발 페르소나): 오늘 `regenerated` 이벤트가 2회 초과인 페르소나 목록
      - `dormantPersonas`(잠수 계정): `is_active=true` 페르소나 중 최근 7일 `bot_activity_log` 미존재
    - 비용 합계: `event_type='cost'`의 `payload->>'costUsd'` SUM(또는 `bot_generation_jobs.cost` JSONB, Dev Notes 참조)
    - `systemStatus`(시스템 상태): `bot_settings`에서 `bot_master_enabled`·`bot_observation_mode`·`bot_daily_post_limit`·`bot_daily_comment_limit` 읽기
    - `status`: 경고 조건 1개라도 있으면 `'warning'`, 없으면 `'ok'`
  - [ ] 2.3: `GET /admin/bots/report` 라우트 등록 (`requireSuperAdmin` preHandler)
    - 쿼리 파라미터 `date` (YYYY-MM-DD 형식, 생략 시 어제 KST 날짜 자동 사용)
    - `date` Zod 검증: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()`
    - `buildDailyReport(date)` 호출 → JSON 응답
    - 오류: `400 VALIDATION_ERROR`, `500 INTERNAL_ERROR`

- [ ] Task 3: 보류 큐 통과(approve) 액션 (AC2)
  - [ ] 3.1: `apps/api/src/routes/admin/bots/hold-queue-actions.ts` 신규 생성
  - [ ] 3.2: `PATCH /admin/bots/hold-queue/:id/approve` 구현
    - `requireSuperAdmin` preHandler
    - `adminId` = `request.adminSession?.adminUserId` (없으면 401)
    - `bot_hold_queue JOIN bot_generation_jobs JOIN bot_personas` 단건 조회 (`decided=false` 조건 → 없거나 이미 결정됐으면 404)
    - `draft_content`(잡 초안 콘텐츠) JSONB 역직렬화 (Dev Notes §draft_content 역직렬화 참조)
    - 역직렬화 실패 시 `422 INVALID_DRAFT_CONTENT`
    - `job_kind='post'` → `CreatePostAsBotInput` 재구성 → `createPostAsBot(input)` 호출
    - `job_kind='comment'` → `CreateCommentAsBotInput` 재구성 → `createCommentAsBot(input)` 호출
    - `job_kind='reply'` → `CreateReplyAsBotInput`(`parentId` 필수) 재구성 → `createReplyAsBot(input)` 호출
    - `job_kind='question'` → `CreateQuestionAsBotInput` 재구성 → `createQuestionAsBot(input)` 호출 (#6)
    - `job_kind='resource'` → `CreateResourceAsBotInput`(`type` 포함) 재구성 → `createResourceAsBot(input)` 호출 (#6)
    - 반환 `{ status: 'blocked' }` 시: `422 CONTENT_BLOCKED` (hold_queue는 `decided=false` 유지, 관리자가 재판단)
    - 반환 `{ status: 'published', refId }` 시: `db.transaction()` 안에서
      - `bot_hold_queue` UPDATE: `decided=true, decision='approved', decided_at=new Date(), decided_by=adminId`
      - `bot_activity_log` INSERT: `event_type=(job_kind==='comment'||job_kind==='reply')?'comment.published':'post.published'`(글·질문·자료는 `post.published`로 집계), `payload.kind=job_kind, payload.decidedBy=adminId, payload.holdQueueId=id`
    - 응답 `200`: `{ status: 'approved', refId }`

- [ ] Task 4: 보류 큐 폐기(discard) 액션 (AC3)
  - [ ] 4.1: `PATCH /admin/bots/hold-queue/:id/discard` 구현 (hold-queue-actions.ts 내)
    - `requireSuperAdmin` preHandler
    - `adminId` = `request.adminSession?.adminUserId` (없으면 401)
    - `bot_hold_queue WHERE id=:id AND decided=false` 단건 조회 (없거나 이미 결정됐으면 404)
    - `db.transaction()` 안에서:
      - `bot_generation_jobs` UPDATE: `status='discarded', updatedAt=new Date()`
      - `bot_hold_queue` UPDATE: `decided=true, decision='discarded', decided_at=new Date(), decided_by=adminId`
      - `bot_activity_log` INSERT: `personaId=hold.personaId(job에서), event_type='discarded', refId=hold.jobId, payload.decidedBy=adminId, payload.holdReason=hold.reason`
    - 응답 `200`: `{ status: 'discarded' }`

- [ ] Task 5: 라우트 등록 (AC1~3)
  - [ ] 5.1: `apps/api/src/routes/admin/bots/index.ts` (11.14에서 생성됨)에 import·await 추가
    ```ts
    import { registerAdminBotReportRoute } from './report.js'
    import { registerAdminBotHoldQueueActionRoutes } from './hold-queue-actions.js'
    // 등록 함수 안에서:
    await registerAdminBotReportRoute(app)
    await registerAdminBotHoldQueueActionRoutes(app)
    ```

- [ ] Task 6: 워커 일일 리포트 프로세서 (AC1)
  - [ ] 6.1: `apps/worker/src/processors/bot/daily-report.processor.ts` 신규 생성
    - `@ai-jakdang/database`의 Drizzle 인스턴스(`getDb()`)로 Task 2.2와 동일한 집계 쿼리 수행
    - `SEEDING_BOT_ENABLED`(봇 모듈 로드 여부) env가 `'true'`가 아니면 즉시 skip + `console.info`
    - `bot_master_enabled`(킬 스위치) `bot_settings`에서 읽어 `false`면 skip (11.12 규칙)
    - 집계 후 결과를 `console.info('[bot-daily-report]', JSON.stringify(report, null, 2))`로 출력
      (Story 11.18에서 텔레그램 전송으로 교체될 진입점)
    - 오류 발생 시 `throw` (BullMQ 재시도 트리거)
    - export: `dailyReportProcessor(job: Job): Promise<void>`
  - [ ] 6.2: `bot.daily-report` 크론 등록·디스패처 연결은 **Story 11.13 소유** — 본 스토리에서 새로 등록하지 않는다
    - 11.13이 단일 `bot` 큐(`QUEUE_NAMES.bot`)에 `bot.daily-report` 크론(`repeat: '0 22 * * *'` = UTC 22:00 = KST 익일 07:00, `jobId: 'bot-daily-report-cron'`)을 이미 등록하고, `switch(job.name)` 디스패처에 `case 'bot.daily-report'` 스텁을 만들어 둔다
    - 본 스토리는 11.13이 만든 `daily-report.processor.ts` 스텁의 **본문만 채운다**(Task 6.1). `bot.cron.ts`·`index.ts` 디스패처는 **수정하지 않는다**(11.13이 이미 `dailyReportProcessor`를 연결)
    - 만약 11.13 스텁에 `dailyReportProcessor` 연결이 빠져 있으면 11.13 쪽 갭이므로 11.13에서 보완(별도 큐·중복 cron 등록 금지)

- [ ] Task 7: `event_type` enum 확인 (AC3)
  - [ ] 7.1: `packages/database/src/schema/bot.ts`(봇 스키마)의 `botEventType` enum에 `'discarded'`·`'planned'`가 포함돼 있는지 확인. **2026-06-29 정합화로 11.1 enum에 이미 포함**되어 있으므로 본 스토리에서 enum 수정·마이그레이션은 불필요(`db:generate`/`db:migrate` 안 함). `discarded`/`planned` 이벤트는 그대로 INSERT만 한다.
    - 만약 11.1 구현에 누락돼 있다면 11.1 쪽 버그 → 11.1에서 수정(본 스토리에서 enum 변경 금지)

---

## Dev Notes

### 선행 의존성

| 의존 스토리 | 역할 | 참조 |
|---|---|---|
| **11.1** | `bot_hold_queue`(보류 큐)·`bot_activity_log`(활동 로그)·`bot_generation_jobs`(생성 작업)·`bot_personas`(봇 페르소나)·`bot_settings`(봇 전역 설정) 스키마 존재 | [Source: docs/seeding-bot/ARCHITECTURE.md, §2.6~2.10] |
| **11.2** | `packages/contracts/src/bot.ts` 파일 존재 (이 스토리에서 `BotDailyReport` 추가 대상) | [Source: docs/seeding-bot/EPICS-AND-STORIES.md, Story 11.2] |
| **11.4** | 5종 작성 함수 `createPostAsBot`·`createCommentAsBot`·`createReplyAsBot`·`createQuestionAsBot`·`createResourceAsBot`와 각 입력 타입 | [Source: _bmad-output/implementation-artifacts/11-4-bot-write-service.md, §입력 타입 정의] |
| **11.13** | `apps/worker/src/schedules/bot.cron.ts` 존재, bot 큐 이름 상수(`QUEUE_NAMES.bot`), bot 워커 디스패처 구조 | [Source: docs/seeding-bot/EPICS-AND-STORIES.md, Story 11.13] |
| **11.14** | `apps/api/src/routes/admin/bots/index.ts` 존재 (이 스토리 라우트 추가 대상) | [Source: docs/seeding-bot/EPICS-AND-STORIES.md, Story 11.14] |
| 11.16 | 운영 패널이 이 스토리의 리포트 API + 보류 큐 액션 API를 소비 (의존 방향: 11.16 → 11.17) | — |
| 11.18 | 텔레그램 푸시는 다음 스토리. 이 스토리의 `daily-report.processor.ts`가 진입점(console.info) 역할 | — |

### 응답 구조 (`BotDailyReport` Zod 스키마)

```ts
// packages/contracts/src/bot.ts 에 추가
export const botDailyReportSchema = z.object({
  date: z.string(),                        // "YYYY-MM-DD" (집계 대상 날짜)
  posts: z.object({
    published: z.number(),                 // 게시 성공 건수
    blocked: z.number(),                   // contentGuard 차단 건수
    discarded: z.number(),                 // 폐기 건수
    held: z.number(),                      // 보류 큐 이동 건수
  }),
  comments: z.object({
    published: z.number(),
    blocked: z.number(),
    discarded: z.number(),
    held: z.number(),
  }),
  personaBreakdown: z.array(z.object({
    personaId: z.string(),
    nickname: z.string(),
    postsPublished: z.number(),
    commentsPublished: z.number(),
    blocked: z.number(),
    costUsd: z.number(),
  })),
  publishedPosts: z.array(z.object({
    postId: z.string(),
    title: z.string(),
    slug: z.string(),                      // URL 구성: "/posts/{slug}"
    board: z.string(),
    personaNickname: z.string(),
  })),
  holdQueuePending: z.number(),            // 미결정 보류 항목 수 (decided=false)
  warnings: z.object({
    blockedCount: z.number(),
    highRegenPersonas: z.array(z.object({  // 재생성 다발(2회 초과) 페르소나
      personaId: z.string(),
      nickname: z.string(),
      regenCount: z.number(),
    })),
    dormantPersonas: z.array(z.object({    // 7일간 활동 없는 활성 페르소나
      personaId: z.string(),
      nickname: z.string(),
    })),
  }),
  totalCostUsd: z.number(),               // 어제 총 비용(달러, cost 이벤트 payload 합산)
  systemStatus: z.object({
    masterEnabled: z.boolean(),            // bot_master_enabled 현재값
    observationMode: z.boolean(),          // bot_observation_mode 현재값
    dailyPostLimit: z.number(),            // bot_daily_post_limit 현재값
    dailyCommentLimit: z.number(),         // bot_daily_comment_limit 현재값
    dailyCostLimitUsd: z.number(),         // bot_daily_cost_limit_usd 현재값
  }),
  status: z.enum(['ok', 'warning']),       // 경고 조건 하나라도 있으면 'warning'
});
export type BotDailyReport = z.infer<typeof botDailyReportSchema>;

// Story 11.18 텔레그램 푸시가 소비하는 최소 요약 타입
export const botDailyReportSummarySchema = z.object({
  date: z.string(),
  publishedPosts: z.number(),
  publishedComments: z.number(),
  heldCount: z.number(),
  blockedCount: z.number().optional(),
  costUsd: z.number().optional(),
});
export type BotDailyReportSummary = z.infer<typeof botDailyReportSummarySchema>;
```

### 집계 쿼리 상세 (Drizzle ORM)

```ts
// KST 날짜 경계 계산 (UTC+9)
function getKstDayBounds(dateStr: string): { start: Date; end: Date } {
  // "2026-06-28" KST → UTC 2026-06-27 15:00:00 ~ 2026-06-28 14:59:59.999
  const [year, month, day] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, day!, -9, 0, 0, 0));
  const end   = new Date(Date.UTC(year!, month! - 1, day!, 14, 59, 59, 999));
  return { start, end };
}

// 어제 KST 날짜 자동 계산 (date 파라미터 생략 시)
function yesterdayKst(): string {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstNow.setDate(kstNow.getDate() - 1);
  return kstNow.toISOString().slice(0, 10);
}

// bot_activity_log 해당 날짜 전체 조회
const { start, end } = getKstDayBounds(dateStr);
const logs = await db
  .select()
  .from(schema.botActivityLog)
  .where(and(
    gte(schema.botActivityLog.createdAt, start),
    lte(schema.botActivityLog.createdAt, end),
  ));

// 게시글 목록: ref_id → posts 조인
const publishedPostIds = logs
  .filter(l => l.eventType === 'post.published')
  .map(l => l.refId)
  .filter(Boolean) as string[];

const publishedPostRows = publishedPostIds.length > 0
  ? await db
      .select({ id: schema.posts.id, title: schema.posts.title, slug: schema.posts.slug, board: schema.posts.board })
      .from(schema.posts)
      .where(inArray(schema.posts.id, publishedPostIds))
  : [];

// 보류 미결정 건수
const [holdResult] = await db
  .select({ count: count() })
  .from(schema.botHoldQueue)
  .where(eq(schema.botHoldQueue.decided, false));

// 잠수 계정: is_active=true 페르소나 중 7일간 활동 없음
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const activePersonas = await db
  .select({ id: schema.botPersonas.id, nickname: schema.botPersonas.nickname })
  .from(schema.botPersonas)
  .where(eq(schema.botPersonas.isActive, true));

const recentlyActivePersonaIds = new Set(
  (await db
    .select({ personaId: schema.botActivityLog.personaId })
    .from(schema.botActivityLog)
    .where(gte(schema.botActivityLog.createdAt, sevenDaysAgo))
    .groupBy(schema.botActivityLog.personaId)
  ).map(r => r.personaId)
);
const dormantPersonas = activePersonas.filter(p => !recentlyActivePersonaIds.has(p.id));

// bot_settings 읽기 (key-value 구조)
const settingKeys = ['bot_master_enabled','bot_observation_mode','bot_daily_post_limit','bot_daily_comment_limit','bot_daily_cost_limit_usd'];
const settingRows = await db
  .select()
  .from(schema.botSettings)
  .where(inArray(schema.botSettings.key, settingKeys));
const settings = Object.fromEntries(settingRows.map(r => [r.key, r.value]));
```

### 경고 판정 규칙

| 경고 종류 | 판정 조건 |
|---|---|
| `blockedCount`(차단 수) | `event_type='blocked'` 이벤트 수 > 0 |
| `highRegenPersonas`(재생성 다발) | 페르소나별 `event_type='regenerated'` 이벤트 수 > 2 |
| `dormantPersonas`(잠수 계정) | `is_active=true`인 페르소나 중 최근 7일간 `bot_activity_log` 미존재 |

위 3가지 중 하나라도 해당 항목이 있으면 `status='warning'`.

### 보류 큐 통과(approve) 전체 흐름

```
PATCH /api/v1/admin/bots/hold-queue/:id/approve
  ↓
bot_hold_queue WHERE id=:id AND decided=false → 없으면 404
  ↓
bot_generation_jobs WHERE id=hold.jobId → draft_content(초안 콘텐츠), job_kind(잡 종류), target_post_id(대상 글 ID)
bot_personas WHERE id=job.personaId → userId(봇 계정 ID)
  ↓
draft_content Zod 파싱 → 실패 시 422 INVALID_DRAFT_CONTENT
  ↓
job_kind === 'post'
  → createPostAsBot({ botUserId, personaId, jobId, postInput: { board, title, contentJson, tags } })
  
job_kind === 'comment'
  → createCommentAsBot({ botUserId, personaId, jobId, targetType, targetId, content })

job_kind === 'reply'
  → createReplyAsBot({ botUserId, personaId, jobId, targetType, targetId, content, parentId })
  ↓
result.status === 'blocked'
  → 422 CONTENT_BLOCKED (hold_queue decided=false 유지, 관리자 재판단 가능)
  ↓
result.status === 'published'
  → db.transaction():
      UPDATE bot_hold_queue SET decided=true, decision='approved', decided_at=now(), decided_by=adminId
      INSERT bot_activity_log (personaId, event_type='post.published' 또는 'comment.published',
                               refId=result.refId, payload={ decidedBy: adminId, holdQueueId: id })
  → 200 { status: 'approved', refId: result.refId }
```

> **트랜잭션 경계 주의**: `createPostAsBot`은 내부에서 posts service를 거치므로 외부 트랜잭션에 포함시키면 중첩 트랜잭션이 된다. `createPostAsBot` 호출 → 성공 확인 → 이후 `db.transaction()`으로 hold_queue + activity_log만 묶는다.

### `draft_content`(초안 콘텐츠) 역직렬화 규칙

`bot_generation_jobs.draft_content`는 JSONB 컬럼. 11.9 글 생성 파이프라인에서 저장하는 구조를 기준으로 방어적으로 파싱한다.

```ts
// job_kind === 'post' 일 때 예상 구조
const postDraftSchema = z.object({
  board: z.string(),
  title: z.string().min(2),
  contentJson: z.record(z.unknown()),      // Tiptap JSON
  tags: z.array(z.string()).optional(),
  creativeSpec: z.unknown().optional(),
  recruitPost: z.unknown().optional(),
});

// job_kind === 'comment' | 'reply' 일 때 예상 구조
const commentDraftSchema = z.object({
  targetType: z.enum(['post','question','answer','resource','comment']),
  targetId: z.string(),
  content: z.string().min(1),
  parentId: z.string().optional(),         // reply인 경우 필수
});
```

`z.safeParse` 사용. 실패 시 `422 INVALID_DRAFT_CONTENT` + details.

### `event_type` enum 값 (`discarded` 포함 — 11.1에서 확정)

`bot_activity_log.event_type` 전체 목록(Story 11.1 `botEventType` pgEnum, ARCHITECTURE §2.9 정합): `post.published`|`comment.published`|`held`|`blocked`|`regenerated`|`skipped`|`cost`|`discarded`|`planned`

본 스토리가 사용하는 `'discarded'`(폐기 결정) 이벤트는 **이미 11.1 enum에 포함**되어 있으므로(2026-06-29 정합화), 이 스토리에서 enum을 별도로 변경하지 않는다. 11.1이 선행 완료되어 있다면 그대로 INSERT만 하면 된다(`db:generate`/`db:migrate` 불필요). 만약 11.1 구현에 `discarded`가 누락돼 있으면 11.1 쪽 버그이므로 11.1에서 수정한다.

### 권한: `requireSuperAdmin` 강제

모든 봇 관련 admin 라우트는 `requireSuperAdmin`(슈퍼 관리자 전용) preHandler 필수.
(ARCHITECTURE §10 — staff 포함 `adminGuard`만으로는 부족)

```ts
import { requireSuperAdmin } from '../../../plugins/adminGuard.js'

// 예시
app.get('/admin/bots/report', { preHandler: [requireSuperAdmin] }, ...)
app.patch('/admin/bots/hold-queue/:id/approve', { preHandler: [requireSuperAdmin] }, ...)
app.patch('/admin/bots/hold-queue/:id/discard', { preHandler: [requireSuperAdmin] }, ...)
```

[Source: apps/api/src/routes/admin/grades/index.ts, line 14] — `requireSuperAdmin` import 경로 확인

### 워커 크론 등록 패턴

```ts
// apps/worker/src/schedules/bot.cron.ts (11.13에서 생성됨)
// bot.daily-report 크론 등록 (ranking.cron.ts 패턴 참조)
await botQueue.add(
  'bot.daily-report',
  { triggeredAt: new Date().toISOString() },
  {
    repeat: { pattern: '0 22 * * *' },    // UTC 22:00 = KST 다음날 07:00
    jobId: 'bot-daily-report-cron',        // 중복 등록 방지 고정 ID
    attempts: 2,
    backoff: { type: 'exponential', delay: 60000 },
  }
);
console.log('[worker] bot.daily-report 크론 등록 완료 (매일 UTC 22:00)');
```

> ⚠️ 위 크론 등록 코드는 **Story 11.13이 소유**하는 코드를 참고용으로 보인 것이다(2026-06-29 정합화). 본 스토리는 `bot.cron.ts`를 **수정하지 않는다**. 11.13이 단일 `bot` 큐(`QUEUE_NAMES.bot`)에 `bot.daily-report` 크론을 이미 등록한다. 본 스토리는 11.13이 만든 `daily-report.processor.ts` 스텁의 본문만 채운다.

### 워커 디스패처 패턴 (참고 — 11.13 소유, 본 스토리 수정 안 함)

```ts
// apps/worker/src/index.ts — 단일 bot 큐 워커의 job.name switch (Story 11.13 소유)
// case 'bot.daily-plan':   return dailyPlanProcessor(job)   // 11.11 처리로직
// case 'bot.write':        return botWriteProcessor(job)    // 11.9
// case 'bot.comment':      return botCommentProcessor(job)  // 11.10
// case 'bot.daily-report': return dailyReportProcessor(job) // ← 본 스토리는 이 processor 본문만 채움
```

> ⚠️ `case 'bot.daily-report'` 디스패처 연결과 import는 **11.13이 등록**한다. 본 스토리는 `index.ts`를 수정하지 않고, 11.13이 가리키는 `daily-report.processor.ts`의 집계 로직만 구현한다. 단일 `bot` 큐 + `job.name` 분기 구조(별도 큐 금지).

[Source: _bmad-output/implementation-artifacts/11-13-bullmq-jobs-cron-worker.md] — 단일 `bot` 큐 디스패처·cron 단일 소유
[Source: apps/worker/src/index.ts, line 187~200] — ranking 워커 디스패처(단일 큐 다중 job.name) 패턴 참조

### 비용(`totalCostUsd`) 집계 방법

`bot_activity_log`의 `event_type='cost'` + `payload.costUsd` 숫자를 합산하거나,
`bot_generation_jobs.cost` JSONB의 `costUsd` 필드를 날짜 범위 집계. 두 방법 중 11.6 AI 추상화 레이어가 실제로 기록한 곳을 확인하고 일치시킨다.

> 11.6 구현 전이면 `totalCostUsd: 0` 기본값으로 리포트를 반환하고, 11.6 완료 후 실제 집계로 교체.

### Project Structure Notes

| 파일 | 변경 유형 | 비고 |
|---|---|---|
| `packages/contracts/src/bot.ts` | **수정** — `botDailyReportSchema`·`BotDailyReport` 추가 | 11.2에서 생성됨 |
| `apps/api/src/routes/admin/bots/report.ts` | **신규** | GET 리포트 엔드포인트 + `buildDailyReport` 집계 함수 |
| `apps/api/src/routes/admin/bots/hold-queue-actions.ts` | **신규** | approve·discard PATCH 엔드포인트 |
| `apps/api/src/routes/admin/bots/index.ts` | **수정** — 신규 라우트 2개 import·await 추가 | 11.14에서 생성됨 |
| `apps/worker/src/processors/bot/daily-report.processor.ts` | **본문 작성** — 11.13이 만든 스텁의 집계 로직 채움 (11.18 텔레그램 진입점) | 11.13에서 스텁 생성 |
| `apps/worker/src/schedules/bot.cron.ts` | **수정 안 함** — `bot.daily-report` 크론 등록은 11.13 소유 | 11.13에서 생성·등록 |
| `apps/worker/src/index.ts` | **수정 안 함** — bot 워커 단일 `bot` 큐 디스패처의 `'bot.daily-report'` case는 11.13 소유 | 11.13에서 등록 |
| `packages/database/src/schema/bot.ts` | **수정 안 함** — `event_type` enum의 `'discarded'`·`'planned'`는 11.1에 이미 포함(2026-06-29 정합) | 11.1에서 생성 |

---

### References

- [Source: docs/seeding-bot/EPICS-AND-STORIES.md, Story 11.17] — AC 원문, 집계 항목, 보류 큐 처리 명세
- [Source: docs/seeding-bot/ARCHITECTURE.md, §2.8 bot_hold_queue] — `decided_by`(결정 관리자 ID)·`decision`(결정값)·`decided_at`(결정 시각) 컬럼 정의
- [Source: docs/seeding-bot/ARCHITECTURE.md, §2.9 bot_activity_log] — `event_type` 열거값 목록, 집계 원천 테이블
- [Source: docs/seeding-bot/ARCHITECTURE.md, §9 워커·큐·크론] — `bot.daily-report` 트리거 타이밍(매일 아침)·처리 정의
- [Source: docs/seeding-bot/ARCHITECTURE.md, §10 관리자 대시보드] — 슈퍼관리자 전용 규칙, 보류 큐 처리 UI 진입점
- [Source: docs/seeding-bot/ARCHITECTURE.md, §11 보안·실패 모드] — fail-safe 원칙(의심되면 안 올린다), blocked 시 hold_queue 유지
- [Source: _bmad-output/implementation-artifacts/11-4-bot-write-service.md, §입력 타입 정의] — `CreatePostAsBotInput`·`CreateCommentAsBotInput`·`CreateReplyAsBotInput`·`CreateQuestionAsBotInput`·`CreateResourceAsBotInput` 시그니처
- [Source: _bmad-output/implementation-artifacts/11-4-bot-write-service.md, §bot_activity_log 기록 경로] — `event_type` 값, `payload` 구조
- [Source: apps/worker/src/schedules/ranking.cron.ts] — BullMQ repeat cron 등록 패턴 (`jobId` 고정으로 중복 방지)
- [Source: apps/worker/src/index.ts, line 286~336] — `content.cleanup` cron + 워커 등록 패턴 재사용
- [Source: apps/worker/src/index.ts, line 187~200] — job.name 기반 디스패처 switch 패턴
- [Source: apps/api/src/routes/admin/reports/index.ts] — PATCH 액션 라우트 패턴(review/hide/reject), `adminSession?.adminUserId` 추출, 404·500 오류 처리
- [Source: apps/api/src/routes/admin/dashboard/kpi.ts] — Drizzle `count()`·`sum()` 집계 쿼리 패턴
- [Source: apps/api/src/routes/admin/grades/index.ts, line 14] — `requireSuperAdmin` import 경로
- [Source: apps/api/src/routes/admin/index.ts] — 라우트 등록 진입점 패턴 (await + registerXxx(app))
- [Source: apps/api/src/lib/queues.ts] — BullMQ Queue 싱글톤 패턴 (봇 큐도 동일 방식)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

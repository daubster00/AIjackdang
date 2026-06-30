# Story 11.11: 일일 활동 계획 생성기 (리듬·요일·시간대)

Status: ready-for-dev

## Story

As a 시딩 봇 오케스트레이터(bot orchestrator),
I want 매일 새벽 각 봇 페르소나의 `bot_activity_rhythm`(활동 리듬)·요일·시간대를 읽어 오늘 활동 계획을 랜덤 배정하고 단일 `bot` 큐에 `bot.write`/`bot.comment` 잡으로 enqueue하기,
so that 봇이 사람처럼 불규칙하고 자연스러운 패턴으로 글과 댓글을 올린다.

> ⚠️ **큐 구조 (Story 11.13과 통일 — 2026-06-29 정합화)**
> 봇 잡은 **단일 `bot` 큐**(`QUEUE_NAMES.bot = "bot"`)에 모두 들어가고, `job.name`(`bot.daily-plan` / `bot.write` / `bot.comment` / `bot.daily-report` / `bot.refill-topics`)으로 분기한다(기존 `ranking` 큐의 `job.name` switch 디스패처와 동일). 큐 상수·`getBotQueue()` 싱글톤·디스패처·cron 등록·Worker 등록의 **단일 소유자는 Story 11.13**이다. 본 스토리는 ① `bot.daily-plan` 처리 로직(`botDailyPlanProcessor`)과 ② `getBotQueue().add("bot.write" | "bot.comment", …)` enqueue만 담당한다. `bot-orchestrator` / `bot-write` / `bot-comment` 같은 **별도 큐를 만들지 않는다**.

## Acceptance Criteria

1. `bot.daily-plan` 잡(Story 11.13이 등록한 cron이 매일 새벽 트리거)이 실행되면 `botDailyPlanProcessor`가 활성 봇 페르소나 전체를 순회하며 오늘 활동 계획을 생성한다.
2. 각 페르소나별로 `bot_activity_rhythm.active_days`(활동 요일 성향) 확률에 따라 오늘 활동 여부를 결정한다. 매주 월요일 기준으로 해당 주의 잠수(dormant) 여부를 날짜+`personaId` 시드 PRNG로 결정하며, 잠수 주에는 모든 활동을 skip하고 `bot_activity_log`에 기록한다.
3. 활동하는 페르소나에 대해 `posts_per_week`(주당 글 수) / 7 ± 20% 랜덤 변동으로 오늘 글 개수를, `comments_per_week`(주당 댓글 수) / 7 ± 20% 변동으로 오늘 댓글 개수를 산출한다.
4. 각 글 활동은 `getBotQueue().add("bot.write", …)`로, 각 댓글 활동은 `getBotQueue().add("bot.comment", …)`로 **단일 `bot` 큐**에 enqueue한다. 각 잡의 `delay`(지연 시간 ms)는 `active_hours`(활동 시간대) 윈도우 중 하나를 랜덤 선택한 뒤 그 범위 내 KST 기준 분 단위 랜덤 시각으로 계산한다.
5. 같은 날 cron이 재실행되거나 워커가 재기동되어도 잡이 중복 생성되지 않는다 (`personaId + YYYY-MM-DD + 순번` 조합의 `jobId`로 BullMQ 멱등 보장).
6. 합산 하루 전체 봇 새 글 5~7건 / 댓글 15~25건이 기대값이 되도록, 7개 페르소나의 기본 리듬 합산값을 단위 테스트로 시뮬레이션해 범위를 검증한다.

## Tasks / Subtasks

- [ ] Task 1: 잡 페이로드 타입 보완 (AC: 4)
  - [ ] `packages/contracts/src/bot.ts`(11.2 정의)에 `BotDailyPlanJobPayload`, `BotWriteJobPayload`, `BotCommentJobPayload` Zod 스키마가 없으면 추가
  - [ ] `BotWriteJobPayload`: `{ personaId: string; triggeredDate: string }` (YYYY-MM-DD, 로그 추적용)
  - [ ] `BotCommentJobPayload`: `{ personaId: string; triggeredDate: string; targetPostId?: string }` (null이면 11.10 파이프라인이 대상 글 선택)
  - [ ] `BotDailyPlanJobPayload`: `{ triggeredAt: string }` (cron fire 시각 ISO string)
  - [ ] `packages/contracts/src/index.ts` 배럴 export 확인

- [ ] Task 2: 순수 함수 구현 (AC: 2, 3, 4, 5)
  - [ ] `apps/worker/src/processors/bot/dailyPlan.processor.ts` 파일 신규 생성 (`apps/worker/src/processors/bot/` 디렉터리가 11.13에서 이미 생성됐으면 재사용)
  - [ ] `seededRandom(seed: string): number` — `seed` 문자열 기반 결정론적 0~1 float (단순 해시, 재실행 시 동일 결과)
  - [ ] `isDormantThisWeek(personaId: string, date: Date): boolean` — 해당 주 월요일 기준 seed, 12% 잠수 확률
  - [ ] `calcTodayCount(perWeek: number, seed: string): number` — `perWeek/7 × [0.8~1.2]`, 최솟값 0
  - [ ] `pickDelayMs(activeHours: Array<{from:number;to:number;crossesMidnight?:boolean}>, index: number, today: Date): number` — 시간대 내 KST 랜덤 시각→ms 차이, `Asia/Seoul` 기준, 음수 방지. 자정 넘김은 `crossesMidnight:true`로 처리하며 `to > 24`·`% 24` 금지.

- [ ] Task 3: 일일 계획 프로세서 메인 로직 구현 (AC: 1, 2, 3, 4, 5)
  - [ ] `botDailyPlanProcessor(job: Job<BotDailyPlanJobPayload>): Promise<void>` export — Story 11.13의 디스패처(`switch (job.name)`)가 `case 'bot.daily-plan'`에서 이 함수를 호출한다
  - [ ] `getDb()`로 `bot_personas`와 `bot_activity_rhythm` 조인 조회 (isActive=true 필터)
  - [ ] **enqueue는 `getBotQueue()`(단일 `bot` 큐, 11.13/`apps/api/src/lib/queues.ts` 정의) 한 곳만 사용** — 각 페르소나별: 잠수 주 체크 → 요일 확률 체크 → 오늘 글/댓글 개수 산출 → `getBotQueue().add("bot.write", payload, opts)` / `getBotQueue().add("bot.comment", payload, opts)`
  - [ ] enqueue `jobId` 형식: `bot-write-{personaId}-{YYYY-MM-DD}-{index}`, `bot-comment-{personaId}-{YYYY-MM-DD}-{index}`
  - [ ] skip 시 `bot_activity_log` insert: `event_type='skipped'`, `payload: {reason:'dormant_week'|'day_probability', date}`
  - [ ] 계획 완료 시 `bot_activity_log` insert: `event_type='planned'`(일일 계획 기록 — `cost` 아님, Story 11.1 enum 확정값), `payload: {plannedPosts, plannedComments, date}`
  - [ ] 킬 스위치(`bot_master_enabled`) 확인 stub: `bot_settings`에서 값 읽어 off면 전체 skip + warn 로그 (11.12 완료 후 공용 `checkBotGates()` 함수로 교체)

- [ ] Task 4: 단위 테스트 (AC: 6)
  - [ ] `apps/worker/src/processors/bot/dailyPlan.processor.test.ts` 신규 생성
  - [ ] 순수 함수 테스트: `seededRandom` 동일 seed 동일 결과, 다른 seed 다른 결과
  - [ ] `isDormantThisWeek` 100개 personaId × 52주 시뮬레이션 → 잠수 비율 8~16% 범위 검증
  - [ ] `calcTodayCount` 결과값이 [perWeek/7 × 0.8, perWeek/7 × 1.2] 범위 내인지 검증
  - [ ] 기본 리듬 합산 시뮬레이션: 7개 페르소나 × 100일 → 평균 글 5~7 / 댓글 15~25 범위 검증 (아래 Dev Notes의 기본값 표 사용)
  - [ ] enqueue 호출이 `getBotQueue().add("bot.write" | "bot.comment", …)` 단일 큐로만 일어남을 mock으로 검증 (별도 큐 인스턴스 생성 없음)

## Dev Notes

### 큐·잡 이름 전체 맵 (Story 11.13과 단일 소스 — 별도 큐 금지)

| 큐 이름 (`QUEUE_NAMES` 키) | `job.name` | producer | consumer | 소유 스토리 |
|---|---|---|---|---|
| `bot` (`QUEUE_NAMES.bot`) | `bot.daily-plan` | cron (11.13 등록) | 11.13 디스패처 → `botDailyPlanProcessor` (본 스토리) | 큐·cron=11.13 / 처리로직=11.11 |
| `bot` (`QUEUE_NAMES.bot`) | `bot.write` | 본 스토리 (`getBotQueue().add`) | 11.9 processor | 큐=11.13 / enqueue=11.11 / 처리=11.9 |
| `bot` (`QUEUE_NAMES.bot`) | `bot.comment` | 본 스토리 (`getBotQueue().add`) | 11.10 processor | 큐=11.13 / enqueue=11.11 / 처리=11.10 |

> ⚠️ **단일 `bot` 큐 + `job.name` 분기**가 Epic 11의 표준이다(Story 11.13이 `QUEUE_NAMES.bot`·`getBotQueue()`·`switch(job.name)` 디스패처·Worker·cron을 모두 소유). 본 스토리는 큐 인스턴스를 **새로 만들지 않고** `getBotQueue()`를 호출만 한다. 잡은 delay와 함께 단일 큐에 쌓이며, 소비자(11.9/11.10 processor)가 11.13 Worker에 등록되기 전이라도 Redis에 영속되어 유실되지 않는다.

### BullMQ 재사용 패턴 (기존 코드 준수)

**1. 단일 `bot` 큐 enqueue** — `apps/api/src/lib/queues.ts`의 `getBotQueue()`(11.13 정의, 기존 `getRankingQueue()` 지연 초기화 싱글톤 패턴) 호출:

```typescript
// Story 11.13이 apps/api/src/lib/queues.ts에 정의 (본 스토리는 import만)
//   export const BOT_QUEUE_NAME = "bot" as const;
//   export function getBotQueue(): Queue { /* 지연 초기화 싱글톤 */ }
//
// 본 스토리(11.11) processor 안에서의 사용:
import { getBotQueue } from "../../lib/queues.js"; // 실제 경로는 worker→api 경계에 맞춰 조정(11.13 결정)

const botQueue = getBotQueue();
await botQueue.add(
  "bot.write",                                            // job.name으로 분기
  { personaId, triggeredDate: dateKey } satisfies BotWriteJobPayload,
  { delay, jobId: `bot-write-${personaId}-${dateKey}-${i}` },
);
await botQueue.add(
  "bot.comment",
  { personaId, triggeredDate: dateKey } satisfies BotCommentJobPayload,
  { delay, jobId: `bot-comment-${personaId}-${dateKey}-${i}` },
);
```

[Source: apps/api/src/lib/queues.ts — `getRankingQueue()` 지연 초기화 싱글톤 패턴]
[Source: _bmad-output/implementation-artifacts/11-13-bullmq-jobs-cron-worker.md — `QUEUE_NAMES.bot`, `getBotQueue()`, `job.name` 디스패처 단일 소유]

> ⚠️ worker 코드(`apps/worker`)에서 api 패키지의 `getBotQueue()`에 접근하는 import 경계는 **Story 11.13이 결정**한다(패키지 이동 vs 복제). 본 스토리는 11.13이 노출한 `getBotQueue()`를 그대로 사용한다.

**2. cron·Worker 등록은 본 스토리 범위 아님** — `bot.daily-plan` cron 등록과 Worker(`new Worker(QUEUE_NAMES.bot, dispatcher)`) 생성, `switch(job.name)` 디스패처는 **전부 Story 11.13**이 담당한다. 본 스토리는 `apps/worker/src/index.ts`·`schedules/*`를 **수정하지 않으며**, 별도의 `setupBotDailyPlanCron` 함수도 만들지 않는다(11.13이 cron을 직접 등록).

[Source: _bmad-output/implementation-artifacts/11-13-bullmq-jobs-cron-worker.md — bot 큐 Worker·cron·디스패처 등록]

### dailyPlan.processor.ts 알고리즘 상세

```typescript
import { getBotQueue } from "../../lib/queues.js"; // 11.13이 노출 (경계는 11.13 결정)

export async function botDailyPlanProcessor(job: Job<BotDailyPlanJobPayload>): Promise<void> {
  const today = new Date(); // UTC 기준이지만 날짜 키는 KST 계산 권장
  const dateKey = toKSTDateKey(today); // "YYYY-MM-DD" (KST)

  // ── 0. 킬 스위치 확인 (stub — 11.12에서 공용 checkBotGates()로 교체) ──
  const db = getDb();
  const masterSetting = await db.select().from(botSettings)
    .where(eq(botSettings.key, "bot_master_enabled")).limit(1);
  if (masterSetting[0]?.value === false) {
    console.warn("[bot-daily-plan] 킬 스위치 OFF — 전체 skip");
    return;
  }

  // ── 1. 활성 페르소나 + 리듬 조인 조회 ──
  const personas = await db
    .select({ persona: botPersonas, rhythm: botActivityRhythm })
    .from(botPersonas)
    .innerJoin(botActivityRhythm, eq(botPersonas.id, botActivityRhythm.personaId))
    .where(eq(botPersonas.isActive, true));

  // ── 단일 bot 큐 (별도 write/comment 큐 없음) ──
  const botQueue = getBotQueue();

  for (const { persona, rhythm } of personas) {
    // ── 2. 잠수 주 체크 ──
    if (isDormantThisWeek(persona.id, today)) {
      await db.insert(botActivityLog).values({
        personaId: persona.id, eventType: "skipped",
        payload: { reason: "dormant_week", date: dateKey },
      });
      continue;
    }

    // ── 3. 요일 확률 체크 ──
    const isWeekend = [0, 6].includes(today.getDay());
    const activeDays = rhythm.activeDays as { weekday: number; weekend: number };
    const prob = isWeekend ? activeDays.weekend : activeDays.weekday;
    if (seededRandom(`${persona.id}-day-${dateKey}`) > prob) {
      await db.insert(botActivityLog).values({
        personaId: persona.id, eventType: "skipped",
        payload: { reason: "day_probability", date: dateKey },
      });
      continue;
    }

    // ── 4. 오늘 개수 산출 ──
    const activeHours = rhythm.activeHours as Array<{ from: number; to: number; crossesMidnight?: boolean }>;
    const postsToday = calcTodayCount(rhythm.postsPerWeek, `${persona.id}-posts-${dateKey}`);
    const commentsToday = calcTodayCount(rhythm.commentsPerWeek, `${persona.id}-comments-${dateKey}`);

    // ── 5. bot.write 잡 enqueue (단일 bot 큐, job.name으로 분기) ──
    for (let i = 0; i < postsToday; i++) {
      const delay = pickDelayMs(activeHours, i, today);
      await botQueue.add(
        "bot.write",
        { personaId: persona.id, triggeredDate: dateKey } satisfies BotWriteJobPayload,
        { delay, jobId: `bot-write-${persona.id}-${dateKey}-${i}` },
      );
    }

    // ── 6. bot.comment 잡 enqueue (동일 bot 큐) ──
    for (let i = 0; i < commentsToday; i++) {
      const delay = pickDelayMs(activeHours, postsToday + i, today);
      await botQueue.add(
        "bot.comment",
        { personaId: persona.id, triggeredDate: dateKey } satisfies BotCommentJobPayload,
        { delay, jobId: `bot-comment-${persona.id}-${dateKey}-${i}` },
      );
    }

    // ── 7. 계획 로그 ──
    await db.insert(botActivityLog).values({
      personaId: persona.id, eventType: "planned",
      payload: { plannedPosts: postsToday, plannedComments: commentsToday, date: dateKey },
    });
  }
}
```

> ⚠️ 일일 계획 로그는 `event_type='planned'`를 사용한다(비용이 아니므로 `cost` 금지 — 2026-06-29 정합화). `planned`는 Story 11.1 `botEventType` pgEnum의 확정값이다. 임의의 미정의 enum 값 INSERT는 런타임 오류를 일으킨다.

### 순수 함수 구현 가이드

```typescript
/** 문자열 seed 기반 결정론적 0~1 float. 재실행 동일 결과 보장. */
function seededRandom(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i);
    hash = hash & 0xffffffff; // 32비트 유지
  }
  return (hash >>> 0) / 0xffffffff; // 양수 0~1
}

/**
 * 해당 주 월요일 날짜 + personaId 시드로 잠수 여부 결정.
 * 12% 확률 (약 6~7주에 1번).
 */
function isDormantThisWeek(personaId: string, date: Date): boolean {
  const monday = getMonday(date); // 해당 주 월요일 자정
  const key = `${personaId}-dormant-${monday.toISOString().slice(0, 10)}`;
  return seededRandom(key) < 0.12;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=일, 1=월
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 주당 횟수를 일 횟수로 변환, ±20% 변동.
 * seed 기반이라 재실행 동일 결과. 최솟값 0.
 */
function calcTodayCount(perWeek: number, seed: string): number {
  const base = perWeek / 7;
  const multiplier = 0.8 + seededRandom(seed) * 0.4; // 0.8~1.2
  return Math.max(0, Math.round(base * multiplier));
}

/**
 * active_hours 윈도우 중 하나에서 KST 랜덤 시각 계산 → ms delay.
 * index로 여러 잡에 분산.
 * 음수(이미 지난 시각) 방지 → 최솟값 0.
 */
function pickDelayMs(
  activeHours: Array<{ from: number; to: number; crossesMidnight?: boolean }>,
  index: number,
  today: Date,
): number {
  const fallback = [{ from: 10, to: 22 }];
  const windows = activeHours.length > 0 ? activeHours : fallback;
  const window = windows[index % windows.length];
  const jitter = Math.random(); // delay는 결정론적일 필요 없음
  const hourFloat = window.from + jitter * (window.to - window.from);
  const targetHour = Math.floor(hourFloat);
  const targetMin = Math.floor((hourFloat % 1) * 60);

  // KST 기준 오늘 날짜의 해당 시각 (Asia/Seoul UTC+9)
  const kstOffset = 9 * 60 * 60 * 1000;
  const nowKST = new Date(today.getTime() + kstOffset);
  const targetKST = new Date(nowKST);
  targetKST.setUTCHours(targetHour, targetMin, 0, 0);
  const delayMs = targetKST.getTime() - today.getTime();

  return Math.max(0, delayMs);
}

function toKSTDateKey(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
```

> ⚠️ `pickDelayMs`는 `Math.random()` 사용 — delay는 재실행 간 달라져도 되며, 같은 `jobId`로 BullMQ가 중복을 차단함.

### 합산 목표 검증 — 기본 리듬 설계값 (11.5 시드 확인용)

| 닉네임 | `posts_per_week`(주당 글 수) | `comments_per_week`(주당 댓글 수) |
|---|---|---|
| `dubu_2` | 5 | 18 |
| `rainy03` | 6 | 20 |
| `semo_k` | 7 | 25 |
| `감자세개` | 4 | 15 |
| `wolse99` | 5 | 18 |
| `latte2x` | 6 | 22 |
| `냉장고털이` | 5 | 16 |
| **합계** | **38 → 일 평균 5.4건** | **134 → 일 평균 19.1건** |

잠수율 12% 반영 시: 글 ≈ 5.4 × 0.88 ≈ 4.8~5건, 댓글 ≈ 19 × 0.88 ≈ 16~17건. AC6의 범위(글 5~7, 댓글 15~25)를 만족한다. 시드가 다르면 11.5 dev agent가 위 표를 참고해 맞게 설정한다.

단위 테스트는 이 기본값을 하드코딩하여 100일 시뮬레이션 → 평균 범위 검증.

### 의존 스토리 완료 조건

| 의존 | 필요한 것 | 미완시 대처 |
|---|---|---|
| **11.1 완료** | `bot_personas`, `bot_activity_rhythm`, `bot_activity_log`(+ `event_type` enum의 `plan`/`skipped`), `bot_settings` 테이블 | 테이블/enum 없으면 컴파일·런타임 에러 — 11.1 먼저 |
| **11.2 완료** | `BotWriteJobPayload`, `BotCommentJobPayload`, `BotDailyPlanJobPayload` Zod 타입 | 없으면 본 스토리 Task 1에서 `packages/contracts/src/bot.ts`에 추가 |
| **11.13 (큐 소유)** | `QUEUE_NAMES.bot` + `getBotQueue()` + `switch(job.name)` 디스패처 + Worker + `bot.daily-plan` cron 등록 | 11.11이 먼저 착수되면 `getBotQueue()`(단일 `bot` 큐)를 11.13과 **동일한 이름·패턴**으로 본 스토리에서 최초 정의하고, 11.13이 이를 재사용한다. **절대 별도 큐(`bot-write` 등)를 만들지 않는다.** |
| **11.9/11.10 후행** | `bot.write`/`bot.comment` processor를 11.13 디스패처에 연결 | Worker 없어도 잡은 단일 `bot` 큐에 쌓임(Redis 영속). 유실 없음 |
| **11.12 후행** | `checkBotGates()` 공용 게이트 함수 | 본 스토리에서 인라인 킬 스위치 stub으로 대체. 11.12 완료 후 교체 |

### Project Structure Notes

- `apps/worker/src/processors/bot/` 디렉터리에 `dailyPlan.processor.ts`를 둔다(11.13이 같은 디렉터리에 디스패처 `index.ts`·stub들을 생성하므로 충돌 없이 합류).
- `apps/worker/src/index.ts`·`apps/worker/src/schedules/*`·`apps/worker/src/connection.ts`의 `QUEUE_NAMES`는 **본 스토리에서 수정 금지** — 큐 상수 추가·Worker·cron 등록은 전부 Story 11.13 소유. 본 스토리는 processor 파일 + (필요 시) contracts payload만 생성한다.
- 단일 `bot` 큐 원칙: `bot-orchestrator`/`bot-write`/`bot-comment` 등 **별도 큐 이름을 새로 도입하지 않는다.** 모든 봇 잡은 `QUEUE_NAMES.bot`에 `job.name`으로 구분해 적재한다(기존 `ranking` 큐가 `ranking.compute`·`gamification.grade-up`을 공유하는 방식과 동일).
- Drizzle import: `botPersonas`, `botActivityRhythm`, `botActivityLog`, `botSettings`는 `@ai-jakdang/database/schema`에서 (11.1에서 정의).
- `getDb()`는 `@ai-jakdang/database`에서 import (기존 cleanup.ts, og-fetch.ts 패턴 동일).

### References

- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.11] — AC 전문 및 그룹 D 의존성 순서
- [Source: docs/seeding-bot/ARCHITECTURE.md#9-워커·큐·크론] — 큐/잡 이름 목록, 킬 스위치 규칙, `bot.daily-plan` 역할 정의
- [Source: docs/seeding-bot/ARCHITECTURE.md#2.4-bot_activity_rhythm] — `active_hours`(활동 시간대) `{from,to}` jsonb, `active_days`(요일 성향) `{weekday,weekend}` jsonb, `posts_per_week`, `comments_per_week`
- [Source: docs/seeding-bot/ARCHITECTURE.md#2.2-bot_personas] — `isActive`, `personaId` FK 구조
- [Source: docs/seeding-bot/ARCHITECTURE.md#2.9-bot_activity_log] — `event_type`(이벤트 타입) enum, `payload` jsonb
- [Source: docs/seeding-bot/ARCHITECTURE.md#2.10-bot_settings] — `bot_master_enabled`(킬 스위치) key
- [Source: _bmad-output/implementation-artifacts/11-13-bullmq-jobs-cron-worker.md] — **단일 `bot` 큐·`getBotQueue()`·`job.name` 디스패처·Worker·cron 단일 소유 (큐 구조 정합 기준)**
- [Source: apps/api/src/lib/queues.ts] — 지연 초기화 싱글톤 Queue 패턴 (`getRankingQueue`, `getFileScanQueue`, `getOgFetchQueue`)
- [Source: apps/worker/src/connection.ts] — `QUEUE_NAMES` 상수 객체 + `createConnection()` (수정은 11.13)
- [Source: apps/worker/src/index.ts] — `ranking` 큐의 `job.name` 기반 디스패처(switch/case) 패턴 (단일 큐 다중 잡 분기 선례)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

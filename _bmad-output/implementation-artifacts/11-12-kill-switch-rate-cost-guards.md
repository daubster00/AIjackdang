# Story 11.12: 킬 스위치·속도 안전선·비용 상한·관찰 모드

Status: ready-for-dev

## Story

As a 시스템 운영자,
I want 모든 봇 잡(job) processor가 시작 시 전역 게이트(킬 스위치·속도 안전선·비용 상한·관찰 모드)를 단일 헬퍼로 확인하기,
so that 비정상 폭주·과금 사고를 막고, 초기 1~2주 관찰 모드에서 운영자가 게시 전 전량을 검토할 수 있다.

---

## Acceptance Criteria

1. 모든 봇 processor(`bot.write`, `bot.comment`, `bot.daily-plan` 등)가 잡 처리 **최초** 시점에 `checkBotGates(db)` 헬퍼를 호출한다. `bot_master_enabled`(킬 스위치)가 `false`면 즉시 job을 skip하고 `bot_activity_log`(봇 활동 로그)에 `event_type='skipped'`, `payload={reason:'master_disabled'}` 항목을 적재한 뒤 정상 반환(BullMQ 실패 처리 아님)한다.

2. 하루 동안 `bot_activity_log`에 `event_type='post.published'`로 쌓인 건수가 `bot_daily_post_limit`(하루 최대 글 수, 기본 10)에 도달하면 `bot.write` 잡을 skip하고 로그에 `{reason:'daily_post_limit_exceeded'}`를 적재한다. 마찬가지로 `event_type='comment.published'` 건수가 `bot_daily_comment_limit`(하루 최대 댓글 수, 기본 40)에 도달하면 `bot.comment` 잡을 skip하고 `{reason:'daily_comment_limit_exceeded'}`를 남긴다. **"하루"의 기준은 KST(Asia/Seoul) 00:00 ~ 23:59**(서비스가 한국 사용자 대상이며 11.11 일일 계획도 KST 날짜 키를 쓰므로 일관성 유지).

3. `bot_settings`(봇 전역 설정)에서 읽는 `bot_daily_cost_limit_usd`(일일 비용 상한 달러)에 도달했는지는 Story 11.6이 이미 판단한다(AI 호출 전 차단). 이 스토리의 `checkBotGates` 헬퍼는 11.6과 **공통으로 쓸 수 있는** `isCostLimitReached(db): Promise<boolean>` 함수를 제공하며, `bot.write`·`bot.comment` processor에서 gate 체크 시 이 함수를 호출해 `true`면 skip + `{reason:'daily_cost_limit_reached'}` 로그를 적재한다. 11.6이 완료된 경우 11.6의 기존 비용 차단 로직을 이 함수로 교체해 중복 구현을 없애되, 11.6 미완성이라면 이 스토리에서 최초 구현으로 간주한다.

4. `bot_observation_mode`(관찰 모드)가 `true`일 때 `bot.write`·`bot.comment` processor는 생성 파이프라인(Story 11.9/11.10)의 결과물을 **자동 게시하지 않고** 전량 `bot_hold_queue`(보류 큐)에 `reason='observation_mode'`로 적재한다. `bot_generation_jobs`(생성 작업 추적)의 `status`는 `held`(보류)로 기록된다. 운영자가 보류 큐에서 "통과" 액션 시 실제 `createPostAsBot`/`createCommentAsBot`이 호출돼 게시된다(보류 큐 처리는 Story 11.17 범위).

5. `checkBotGates(db, jobKind)` 헬퍼는 api와 worker가 모두 import 가능한 **server-only 공용 경계**(권장: `packages/server-bot/src/gates.ts`; 임시 API 위치 사용 시 worker 직접 `apps/api/src/*` import 금지)에 구현한다. 결과 타입은 아래 형태이며, 모든 봇 processor가 동일한 함수를 임포트해 사용한다:
   ```typescript
   // GateResult(게이트 결과)
   export type GateResult =
     | { allowed: true; observationMode: boolean }
     | { allowed: false; reason: string };
   ```
   `allowed: false`면 processor는 즉시 skip + 로그를 남기고 반환한다. `allowed: true`이되 `observationMode: true`면 게시 직전 보류 큐로 분기한다.

6. `bot_settings` 조회는 `apps/api/src/lib/siteSettings.ts`(사이트 설정 유틸)의 `getSiteSetting` 패턴을 재사용하되, 중복 구현을 피하기 위해 단건/전체 조회·저장 헬퍼를 공용 `botSettings` 유틸로 모은다. API 프로세스용은 `apps/api/src/lib/botSettings.ts`, worker/server-only용은 `packages/server-bot` 또는 `apps/worker/src/lib/botSettings.ts`에 두며, 캐시 TTL은 60초, 캐시 키 prefix는 `bot_settings:`로 통일한다. `gates.ts`는 내부에 별도 `getBotSetting`을 새로 만들지 말고 이 helper를 import한다.

7. `bot_settings` 테이블·`bot_activity_log` 테이블이 DB에 없을 때(Story 11.1 미실행 등) 각 헬퍼는 에러를 던지지 않고 **안전 기본값**을 반환한다: 킬 스위치 OFF(비가동)·상한 미초과·관찰 모드 OFF. `try/catch`로 감싸고 warn 로그만 남긴다.

---

## Tasks / Subtasks

### Task 1: server-only `gates.ts` 신규 생성 (AC: #5, #6, #7)

- [ ] 1.1 파일 생성: `packages/server-bot/src/gates.ts`. worker가 `apps/api/src/*`를 직접 import하는 구조는 금지한다.

- [ ] 1.2 `getBotSetting<T>(key: string): Promise<T | null>`는 공용 bot settings helper에서 import.
  - `bot_settings`(봇 전역 설정) 테이블 `WHERE key = $key LIMIT 1` 조회.
  - Redis 캐시 키 `bot_settings:{key}`, TTL 60초.
  - `try/catch`: 테이블 미존재 등 예외 시 `null` 반환 + `console.warn('[bot-settings] bot_settings 조회 실패:', ...)`.

- [ ] 1.3 `isCostLimitReached(db?): Promise<boolean>` 구현.
  - `bot_daily_cost_limit_usd`(일일 AI 비용 상한, 달러) 값 조회(오늘 KST 기준).
  - `bot_activity_log`(봇 활동 로그)에서 오늘(KST 자정 이후, 아래 `getKstDayStart` 기준) `event_type='cost'` 항목의 `payload.costUsd`(달러 비용) 합산.
  - 합산 >= 상한이면 `true`. 상한 미설정(`null`) 시 `false`.
  - 예외 시 `false` 반환(안전 기본값 — 비용 초과 미검출이 과금 폭주보다 안전하지 않으므로, 차단보다 게이트 장애를 로그만 남기는 선택임을 주석에 명시).

- [ ] 1.4 `checkBotGates(jobKind: 'write' | 'comment' | 'plan' | 'report' | string): Promise<GateResult>` 구현.
  단계별 순서:
  1. `bot_master_enabled`(킬 스위치) 조회 → false이면 `{ allowed: false, reason: 'master_disabled' }` 즉시 반환.
  2. `jobKind === 'write'`면 오늘 `post.published` 건수 >= `bot_daily_post_limit`(하루 최대 글 수) → `{ allowed: false, reason: 'daily_post_limit_exceeded' }`.
  3. `jobKind === 'comment'`면 오늘 `comment.published` 건수 >= `bot_daily_comment_limit`(하루 최대 댓글 수) → `{ allowed: false, reason: 'daily_comment_limit_exceeded' }`.
  4. `isCostLimitReached()` → true면 `{ allowed: false, reason: 'daily_cost_limit_reached' }`.
  5. `bot_observation_mode`(관찰 모드) 조회.
  6. 모두 통과 → `{ allowed: true, observationMode: <값> }`.

  ⚠️ DB 쿼리는 병렬(`Promise.all`) 처리로 지연 최소화. 단, 킬 스위치 판정은 앞 순서대로 단락 평가(short-circuit) — 킬 스위치 off면 나머지 DB 쿼리 불필요.

- [ ] 1.5 `logBotSkip(personaId: string | null, reason: string, jobKind: string): Promise<void>` 유틸 구현.
  - `bot_activity_log`에 `event_type='skipped'`, `payload={reason, jobKind}`, `persona_id=personaId` INSERT.
  - 실패 시 에러를 전파하지 않음(로깅 실패가 잡 크래시를 유발하면 안 됨).

### Task 2: `bot.write` / `bot.comment` processor에 게이트 적용 (AC: #1, #2, #3, #4)

> Story 11.9(`bot.write` processor)·11.10(`bot.comment` processor)·11.13(`apps/worker` 등록)가 완성되어 있어야 이 Task가 적용 가능하다. 미완성 시 processor 파일을 **스텁(stub)** 으로 만들어 게이트만 먼저 구현하고, 생성 로직은 TODO로 남긴다.

- [ ] 2.1 **`apps/worker/src/processors/bot/write.processor.ts`** 상단(processor 함수 진입 즉시):
  ```typescript
  // 게이트 체크 (AC: #1~#4)
  const gate = await checkBotGates('write');
  if (!gate.allowed) {
    await logBotSkip(job.data.personaId ?? null, gate.reason, 'write');
    return; // BullMQ completed (실패 아님)
  }
  // ... 기존 생성 파이프라인 ...
  // 관찰 모드 분기 (AC: #4)
  if (gate.observationMode) {
    await holdForObservation(jobId, draftContent, 'observation_mode');
    return;
  }
  await createPostAsBot(...);
  ```

- [ ] 2.2 **`apps/worker/src/processors/bot/comment.processor.ts`** 동일 패턴 적용 (`jobKind='comment'`).

- [ ] 2.3 **`apps/worker/src/processors/bot/daily-plan.processor.ts`** (`bot.daily-plan` 잡): 게이트 중 **킬 스위치만** 확인한다(계획 생성은 글 수 상한·비용 상한에 걸릴 필요 없음). `checkBotGates('plan')` 호출 시 내부적으로 step 2~4(상한 체크)를 'plan' 종류에 대해 건너뜀.

### Task 3: `holdForObservation` 유틸 구현 (AC: #4)

- [ ] 3.1 `apps/api/src/services/bot/holdQueue.ts`(또는 기존 파일에 추가) 내에 `holdForObservation(jobId: string, draftContent: unknown, reason: string): Promise<void>` 구현.
  - `bot_generation_jobs`(생성 작업 추적)의 해당 `jobId` 레코드를 `status='held'`(보류)로 UPDATE.
  - `bot_hold_queue`(보류 큐)에 `{job_id: jobId, reason, decided: false}` INSERT.
  - `bot_activity_log`에 `event_type='held'`, `payload={reason}` INSERT.

### Task 4: 일일 카운트 쿼리 구현 (AC: #2)

- [ ] 4.1 `gates.ts` 내에 `getDailyPublishedCount(eventType: 'post.published' | 'comment.published'): Promise<number>` 구현.
  - **KST(Asia/Seoul) 자정 기준** 집계: `bot_activity_log WHERE event_type = $1 AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'` 의 `COUNT(*)`. (= "오늘 KST" 시작 instant 이후. 비용 합산 `isCostLimitReached`도 동일 경계 — 공용 `getKstDayStart()` 헬퍼로 통일 권장)
  - 실패 시 `0` 반환(안전 기본값 — 과소 집계 방향).

### Task 5: 기존 bot settings helper와 통합 확인 (AC: #6)

- [ ] 5.1 Story 11.5가 이미 `apps/api/src/services/bot/settings.ts`에 `getBotExcludeFromRanking`을 구현했다면, 공용 `getBotSetting('bot_exclude_from_ranking')` 내부 호출 형태로 리팩터링한다.
- [ ] 5.2 Story 11.16의 settings API와 중복되지 않도록 `apps/api/src/lib/botSettings.ts`를 API용 단일 유틸로 사용한다. worker/server-only 경계에서는 동일 정책의 helper를 별도 노출한다.

### Task 6: 단위 테스트 (AC: #1~#7)

- [ ] 6.1 `apps/api/src/services/bot/gates.test.ts` 신규.
  - DB/Redis mocking 후 `checkBotGates` 6가지 시나리오 단위 테스트:
    1. 킬 스위치 off → `allowed: false, reason: 'master_disabled'`
    2. 글 상한 초과 → `allowed: false, reason: 'daily_post_limit_exceeded'`
    3. 댓글 상한 초과 → `allowed: false, reason: 'daily_comment_limit_exceeded'`
    4. 비용 상한 초과 → `allowed: false, reason: 'daily_cost_limit_reached'`
    5. 관찰 모드 ON → `allowed: true, observationMode: true`
    6. 전부 통과 → `allowed: true, observationMode: false`
  - DB 미존재(예외) 시 안전 기본값 테스트.

### Task 7: 검증

- [ ] 7.1 `pnpm -F @ai-jakdang/api typecheck` — 타입 에러 없음.
- [ ] 7.2 `bot_settings`에 `bot_master_enabled=false` 세팅 후 `bot.write` 잡 enqueue → `bot_activity_log`에 `skipped/master_disabled` 항목 확인.
- [ ] 7.3 `bot_daily_post_limit=0` (0으로 낮춤) 설정 후 `bot.write` 잡 → skip + `daily_post_limit_exceeded` 로그 확인.
- [ ] 7.4 `bot_observation_mode=true` 설정 후 `bot.write` 잡 → `bot_hold_queue`에 `reason='observation_mode'` 레코드 생성 확인. `bot_generation_jobs.status='held'` 확인.

---

## Dev Notes

### 선행 의존성

| 의존 스토리 | 이유 |
|---|---|
| **Story 11.1** (필수) | `bot_settings`, `bot_activity_log`, `bot_hold_queue`, `bot_generation_jobs` 테이블·스키마가 없으면 게이트 헬퍼가 동작하지 않는다. 테이블 미존재 시 안전 기본값 반환(AC: #7)으로 장애를 방지하되, 실제 동작 검증은 11.1 이후에만 가능. |
| **Story 11.6** (비용 상한, 부분 의존) | 비용 상한 판정 로직이 11.6에서 먼저 구현될 수 있다. 이 경우 `isCostLimitReached` 함수를 11.6의 것으로 교체해 중복을 제거한다. 11.6 미완 시 이 스토리가 최초 구현. |
| **Story 11.9/11.10** (파이프라인, 부분 의존) | `bot.write`·`bot.comment` processor가 없으면 Task 2는 스텁으로 구현. 파이프라인 완성 후 게이트 코드 삽입. |
| **Story 11.13** (워커 등록) | 워커가 실제 등록되어야 end-to-end 검증 가능. 게이트 로직 자체는 독립적으로 구현·테스트 가능. |

### `bot_settings` 조회 패턴 — helper 중복 금지

기존 `apps/api/src/lib/siteSettings.ts`(사이트 설정 유틸)의 `getSiteSetting` 함수는 `site_settings`(사이트 전역 설정) 테이블을 대상으로 한다. `bot_settings`(봇 전역 설정) 테이블은 별도 테이블이므로 같은 패턴을 쓰되, `gates.ts` 안에 복사하지 않고 공용 bot settings helper로 모은다. Redis 캐시 키 접두사는 `bot_settings:`로 구분한다.

```typescript
// apps/api/src/lib/botSettings.ts 또는 packages/server-bot/src/botSettings.ts 패턴 예시
const CACHE_PREFIX = 'bot_settings:';
const CACHE_TTL = 60;

async function getBotSetting<T>(key: string): Promise<T | null> {
  const redis = getApiRedis();
  try {
    const cached = await redis.get(`${CACHE_PREFIX}${key}`);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch { /* Redis 장애 시 DB 폴백 */ }

  try {
    const db = getDb();
    const [row] = await db
      .select({ value: schema.botSettings.value })
      .from(schema.botSettings)
      .where(eq(schema.botSettings.key, key))
      .limit(1);
    const value = (row?.value ?? null) as T | null;
    await redis.set(`${CACHE_PREFIX}${key}`, JSON.stringify(value), 'EX', CACHE_TTL);
    return value;
  } catch (err) {
    console.warn('[bot-settings] bot_settings 조회 실패:', (err as Error).message);
    return null;
  }
}
```

> `schema.botSettings`(봇 설정 Drizzle 스키마)는 `packages/database/src/schema/bot.ts`에서 export 됨(Story 11.1 담당). `@ai-jakdang/database/schema`로 import.

### `checkBotGates` 호출 위치 — processor 진입 즉시

모든 봇 잡 processor 파일(`bot/write.processor.ts`, `bot/comment.processor.ts`, `bot/daily-plan.processor.ts`)의 **함수 본문 첫 번째 줄**에서 `checkBotGates`를 호출한다. 어떤 상태 변경·DB 쓰기·AI 호출도 게이트 통과 전에 실행하면 안 된다.

```typescript
// 예시: apps/worker/src/processors/bot/write.processor.ts
export async function botWriteProcessor(job: Job<BotWriteJobPayload>): Promise<void> {
  // ── 게이트 체크 (11.12) ────────────────────────────
  const gate = await checkBotGates('write');
  if (!gate.allowed) {
    await logBotSkip(job.data.personaId ?? null, gate.reason, 'write');
    return; // 정상 완료(실패 아님)
  }
  // ── 이후 생성 파이프라인 (11.9) ────────────────────
  // ...
  if (gate.observationMode) {
    await holdForObservation(generationJobId, draftContent, 'observation_mode');
    return;
  }
  await createPostAsBot(/* ... */);
}
```

### 관찰 모드(`bot_observation_mode`)의 의미

- `true`: 자동 게시 전면 중단. 모든 생성 결과물은 `bot_hold_queue`로 직행.
- `false`: 파이프라인 정상 흐름(검열 통과 → 자동 게시).
- 초기 시딩 시작 시 `seed-bots.ts`(Story 11.5)가 기본값 `true`로 설정. 운영자가 1~2주 관찰 후 관리자 UI(Story 11.16)에서 `false`로 변경.

### 상한 카운트 기준 — KST 날짜 (Asia/Seoul)

`getDailyPublishedCount`·`isCostLimitReached`는 **KST(Asia/Seoul) 자정 경계**로 "하루"를 집계한다(`created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'`). 서비스가 한국 사용자 대상이고 Story 11.11 일일 계획(`toKSTDateKey`)·`bot.daily-plan`/`bot.daily-report` cron도 KST 기준이므로, 상한·비용·계획·리포트의 "하루" 경계를 KST로 일치시킨다(UTC 혼용 금지). `created_at`이 `timestamptz`이므로 위 식 하나로 정확히 계산되며 인덱스도 그대로 활용된다. 공용 헬퍼 `getKstDayStart(): Date`로 묶어 재사용.

### BullMQ 잡 결과 처리 — 실패 vs skip

게이트 차단 시 **`throw`하지 않는다**. `throw`하면 BullMQ가 실패로 기록하고 재시도(retry)를 시도한다. 킬 스위치가 켜져 있는 한 재시도는 모두 skip되므로 재시도 큐 오염이 발생한다. `return`으로 정상 완료 처리해야 `removeOnComplete` 정책이 적용된다.

### 비용 상한 `isCostLimitReached` — Story 11.6과의 관계

Story 11.6(AC: #4)은 "AI 호출마다 `costUsd`를 `bot_activity_log`에 누적, 일일 상한 도달 시 신규 생성 잡 자동 중단"을 요구한다. 11.6이 `callModel()` 내부에서 직접 상한 체크를 구현했다면, 이 스토리의 `isCostLimitReached` 함수로 대체해 한 곳에 집중한다. 11.6 개발자와 인터페이스를 합의하거나, 이 스토리를 11.6 이후에 작업한다.

### `bot_activity_log` 이벤트 타입 (`event_type`) 정리

이 스토리에서 추가로 사용하는 값:
| `event_type` 값 | 의미 | 적재 시점 |
|---|---|---|
| `skipped` | 게이트 차단으로 잡 건너뜀 | `logBotSkip` 호출 시 |
| `held` | 관찰 모드·애매·인젝션 의심으로 보류 | `holdForObservation` 호출 시 |

기존 Story 11.9/11.10이 정의한 `post.published`, `comment.published`, `cost` 이벤트 타입과 충돌하지 않는다.

### Project Structure Notes

**신규 파일 (이 스토리 생성)**:
```
packages/server-bot/src/gates.ts            (권장: 봇 게이트 헬퍼 — checkBotGates·isCostLimitReached·logBotSkip)
apps/api/src/lib/botSettings.ts             (API용 bot settings helper — 11.16과 공유)
apps/api/src/services/bot/holdQueue.ts      (holdForObservation — 11.4에 있으면 추가, 없으면 신규. worker 사용 시 server-only 경계로 이동/re-export)
apps/api/src/services/bot/gates.test.ts     (단위 테스트; 실제 위치는 gates 구현 위치에 맞춤)
```

**수정 대상 파일 (기존 파일 수정)**:
```
apps/worker/src/processors/bot/write.processor.ts    (게이트 호출 + 관찰 모드 분기 삽입)
apps/worker/src/processors/bot/comment.processor.ts  (동일)
apps/worker/src/processors/bot/daily-plan.processor.ts (킬 스위치만 호출)
apps/api/src/services/bot/settings.ts               (Story 11.5 파일 — getBotExcludeFromRanking를 getBotSetting 재사용으로 리팩터링)
```

**이 스토리가 건드리지 않는 파일**:
- `packages/database/src/schema/bot.ts` — Story 11.1 담당
- server-only bot write boundary — Story 11.4 담당 (API 원형은 `apps/api/src/services/bot/write.ts`, worker 직접 import 금지)
- 생성 파이프라인 내부 로직 — Story 11.9/11.10 담당
- `apps/worker/src/index.ts` — Story 11.13 담당(워커 등록)
- 보류 큐 통과/폐기 API — Story 11.17 담당

---

### References

- `bot_settings` 키 목록 및 의미 (전체): [Source: docs/seeding-bot/ARCHITECTURE.md#2.10-bot_settings]
- `bot_activity_log` 이벤트 타입·컬럼: [Source: docs/seeding-bot/ARCHITECTURE.md#2.9-bot_activity_log]
- `bot_hold_queue` 컬럼·reason 값: [Source: docs/seeding-bot/ARCHITECTURE.md#2.8-bot_hold_queue]
- `bot_generation_jobs` status enum: [Source: docs/seeding-bot/ARCHITECTURE.md#2.7-bot_generation_jobs]
- 킬 스위치 + 일일 상한 + 관찰 모드 AC 원문: [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.12]
- fail-safe 원칙 ("의심되면 안 올린다"): [Source: docs/seeding-bot/ARCHITECTURE.md#11-보안·실패-모드]
- 비용 가드 요구사항: [Source: docs/seeding-bot/PRD.md#NFR-SB-3]
- 관찰 모드 운영 정책 ("초기 1~2주 반자동 관찰"): [Source: docs/seeding-bot/PRD.md#8-운영-정책]
- `isCostLimitReached` 원출처 (Story 11.6 AC #4): [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.6]
- `bot_activity_log` 비용 이벤트 적재 방식 (11.6): [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.6]
- BullMQ 잡 패턴 (실패 vs 정상 완료): [Source: apps/worker/src/index.ts] (기존 skip은 throw 아닌 return)
- `siteSettings.ts` Redis 캐시 패턴 (재사용 기반): [Source: apps/api/src/lib/siteSettings.ts]
- 기존 큐 연결·QUEUE_NAMES 패턴: [Source: apps/worker/src/connection.ts]
- 기존 cron 등록 패턴 (`repeat.pattern`): [Source: apps/worker/src/schedules/ranking.cron.ts]
- 봇 잡 큐 이름 목록: [Source: docs/seeding-bot/ARCHITECTURE.md#9-워커·큐·크론]
- 상한·관찰 모드 기본값 (seed 기준): [Source: _bmad-output/implementation-artifacts/11-5-ensure-bot-user-seed-ranking-exclude.md#Task-2-bot_settings-시드]

---

## Dev Agent Record

### Agent Model Used

_미입력 (dev 착수 시 기입)_

### Debug Log References

_착수 후 기입_

### Completion Notes List

_착수 후 기입_

### File List

```
apps/api/src/services/bot/gates.ts              (신규)
apps/api/src/services/bot/holdQueue.ts          (신규 또는 기존 파일에 함수 추가)
apps/api/src/services/bot/gates.test.ts         (신규)
apps/api/src/services/bot/settings.ts           (수정 — getBotExcludeFromRanking 내부 getBotSetting 재사용으로 리팩터링)
apps/worker/src/processors/bot/write.processor.ts     (수정 — 게이트 삽입)
apps/worker/src/processors/bot/comment.processor.ts   (수정 — 게이트 삽입)
apps/worker/src/processors/bot/daily-plan.processor.ts (수정 — 킬 스위치 게이트 삽입)
```

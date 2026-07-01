# Story 11.13: BullMQ 잡·크론 등록 + 워커 격리 + 부팅 토글

Status: ready-for-dev

## Story

As a 시스템 운영자,
I want `apps/worker`에 봇 BullMQ 워커·크론을 등록하고 `SEEDING_BOT_ENABLED`(봇 모듈 로드 여부) env 하나로 부팅 시 로드 여부를 제어하기,
so that 봇 워커 크래시가 사이트 본체(`api`·`web`)를 멈추지 않고, 배포 초기에는 봇을 꺼둔 채 사이트를 먼저 안정화할 수 있다.

---

## Acceptance Criteria

1. `apps/worker`에 봇 워커(`processors/bot/*`)·크론(`schedules/bot.cron.ts`)이 등록된다. 큐 이름·잡 등록 방식은 **기존 `content.cleanup` 패턴**(`QUEUE_NAMES.cleanup` 큐 → `contentCleanupProcessor` import → `index.ts` 등록 → 별도 async IIFE에서 `contentCleanupQueue.add(…, { repeat: { pattern: "0 3 * * *" } })`)을 재사용한다.

2. `SEEDING_BOT_ENABLED`(봇 모듈 로드 여부)가 `'true'`일 때만 봇 Worker 인스턴스와 크론이 등록된다. 기본값은 `false`(= env 미설정 포함). `SEEDING_BOT_ENABLED`가 `'true'`가 아닌 경우 기존 워커(`email`·`ranking`·`cleanup` 등)는 영향 없이 정상 기동한다.

3. 봇 Worker 크래시(잡 처리 오류·Worker 수준 오류)가 사이트 본체(`api`·`web`)를 멈추지 않는다. **격리 증명**: ① 봇 Worker의 `failed`·`error` 이벤트 핸들러가 `console.error`만 하고 `process.exit()`를 호출하지 않는다. ② 봇 모듈 전체를 `try/catch`로 감싸 초기화 실패 시 다른 워커에 영향 없음을 코드로 보장한다. ③ `processors/bot/bot.processor.test.ts`에 dispatcher 단위 테스트를 작성해 잘못된 `job.name` 수신 시 throw 없이 warn만 출력함을 검증한다.

---

## Tasks / Subtasks

### Task 1: `apps/worker/src/connection.ts` 수정 — 봇 큐 이름 추가 (AC: #1)

- [x] 1.1 `QUEUE_NAMES` 객체 끝에 `bot` 항목 추가. 다른 항목 변경 금지.
  ```typescript
  bot: "bot",  // 봇 통합 큐. 잡 이름: bot.daily-plan / bot.write / bot.comment / bot.daily-report / bot.refill-topics
  ```
  > 이유: 단일 `bot` 큐에 잡 이름으로 분기 → `rankingProcessor` 패턴(job.name switch)과 동일.
  > write·comment 잡은 동시에 여러 봇이 처리해야 하므로 Worker 생성 시 `concurrency: 3` 지정.

### Task 2: `apps/worker/src/processors/bot/index.ts` 신규 — 봇 잡 디스패처 (AC: #1)

- [x] 2.1 파일 생성. 기존 `rankingProcessor` 디스패처(`index.ts` §6.3/6.5 블록의 `switch` 패턴) 재사용.

```typescript
/**
 * 봇 BullMQ 잡 디스패처 — Story 11.13
 *
 * 단일 "bot" 큐에서 job.name 기반 분기.
 * 각 processor는 시작 시 bot_master_enabled(킬 스위치) 확인 후 skip 여부 결정 (Story 11.12).
 */
import type { Job } from 'bullmq';
import { botDailyPlanProcessor } from './daily-plan.processor.js';    // Story 11.11 생성
import { botWriteProcessor } from './write.processor.js';              // Story 11.9 생성
import { botCommentProcessor } from './comment.processor.js';           // Story 11.10 생성
import { botDailyReportProcessor } from './daily-report.processor.js'; // 이 스토리 stub → Story 11.17 실구현
import { botRefillTopicsProcessor } from './refill-topics.processor.js'; // 이 스토리 stub

export async function botProcessor(job: Job): Promise<void> {
  switch (job.name) {
    case 'bot.daily-plan':    return botDailyPlanProcessor(job);
    case 'bot.write':         return botWriteProcessor(job);
    case 'bot.comment':       return botCommentProcessor(job);
    case 'bot.daily-report':  return botDailyReportProcessor(job);
    case 'bot.refill-topics': return botRefillTopicsProcessor(job);
    default:
      console.warn(`[bot-worker] 알 수 없는 job.name: ${job.name} (jobId=${job.id})`);
  }
}
```

- [x] 2.2 위 import 대상(`./daily-plan.processor.js`, `./write.processor.js`, `./comment.processor.js`)이 각각 Story 11.11, 11.9, 11.10에서 생성되었는지 확인한다. **없으면** 해당 파일의 빈 stub을 임시 생성한다(Dev Notes §선행 의존성 참고). stub 형식:
  ```typescript
  import type { Job } from 'bullmq';
  /** TODO: Story 11.X에서 실 구현 */
  export async function botXxxProcessor(_job: Job): Promise<void> {
    console.info(`[bot-xxx] stub — 미구현`);
  }
  ```

### Task 3: `apps/worker/src/processors/bot/daily-report.processor.ts` 신규 — stub (AC: #1)

- [x] 3.1 파일 생성. Story 11.17에서 실 구현 예정. 이 스토리에서는 로그만 출력.
  ```typescript
  /**
   * bot.daily-report 잡 처리기 stub — Story 11.13
   * 어제 활동(bot_activity_log) 집계 + 대시보드 데이터 + 텔레그램 푸시는 Story 11.17에서 구현.
   */
  import type { Job } from 'bullmq';

  export async function botDailyReportProcessor(job: Job): Promise<void> {
    console.info(`[bot-daily-report] 잡 수신: jobId=${job.id} — Story 11.17 구현 예정`);
  }
  ```

### Task 4: `apps/worker/src/processors/bot/refill-topics.processor.ts` 신규 — stub (AC: #1)

- [x] 4.1 파일 생성. 주제 자동 보충 로직은 Story 11.9(글 생성 파이프라인)에서 구현한 함수에 연결 예정.
  ```typescript
  /**
   * bot.refill-topics 잡 처리기 stub — Story 11.13
   * bot_topics(주제 풀) 소진 감지 → 자동 보충은 Story 11.9 완료 후 연결.
   */
  import type { Job } from 'bullmq';

  export async function botRefillTopicsProcessor(job: Job): Promise<void> {
    console.info(`[bot-refill-topics] 잡 수신: jobId=${job.id} — Story 11.9 연결 예정`);
  }
  ```

### Task 5: `apps/worker/src/schedules/bot.cron.ts` 신규 (AC: #1)

- [x] 5.1 파일 생성. **`ranking.cron.ts` 패턴 재사용** (`apps/worker/src/schedules/ranking.cron.ts` 참고).
  `setupBotCrons(botQueue: Queue): Promise<void>` 함수 구현.

  등록할 cron 3개 (모두 UTC 기준, `jobId` 고정 → 중복 등록 방지):

  | `jobId` | `job.name` | `repeat.pattern` (UTC) | KST 환산 |
  |---|---|---|---|
  | `bot-daily-plan-cron` | `bot.daily-plan` | `0 17 * * *` | 매일 02:00 KST |
  | `bot-daily-report-cron` | `bot.daily-report` | `0 22 * * *` | 매일 07:00 KST |
  | `bot-refill-topics-cron` | `bot.refill-topics` | `0 18 * * *` | 매일 03:00 KST |

  ```typescript
  /**
   * 봇 cron 스케줄 등록 — Story 11.13
   *
   * ranking.cron.ts 패턴 재사용:
   * - BullMQ repeat + 고정 jobId = 멱등 (재실행 시 중복 등록 없음)
   * - 각 cron의 실 처리기는 해당 Story에서 구현 (daily-plan: 11.11, report: 11.17)
   */
  import { Queue } from 'bullmq';

  export async function setupBotCrons(botQueue: Queue): Promise<void> {
    await botQueue.add(
      'bot.daily-plan',
      { triggeredAt: new Date().toISOString() },
      { repeat: { pattern: '0 17 * * *' }, jobId: 'bot-daily-plan-cron' },
    );
    console.log('[worker] bot.daily-plan 크론 등록 완료 (UTC 17:00 = KST 02:00)');

    await botQueue.add(
      'bot.daily-report',
      { triggeredAt: new Date().toISOString() },
      { repeat: { pattern: '0 22 * * *' }, jobId: 'bot-daily-report-cron' },
    );
    console.log('[worker] bot.daily-report 크론 등록 완료 (UTC 22:00 = KST 07:00)');

    await botQueue.add(
      'bot.refill-topics',
      { triggeredAt: new Date().toISOString() },
      { repeat: { pattern: '0 18 * * *' }, jobId: 'bot-refill-topics-cron' },
    );
    console.log('[worker] bot.refill-topics 크론 등록 완료 (UTC 18:00 = KST 03:00)');
  }
  ```

### Task 6: `apps/worker/src/index.ts` 수정 — 봇 워커 조건부 등록 (AC: #2, #3)

- [x] 6.1 기존 `// ── [9.10] content.cleanup cron END ────` 블록 직후에 봇 블록을 추가한다. 기존 블록 일체 변경 금지.

- [x] 6.2 아래 블록을 `index.ts` 끝부분(SIGINT/SIGTERM 핸들러 **이전**)에 삽입:

```typescript
// ── [11.13] 봇 워커 (SEEDING_BOT_ENABLED=true 시에만 등록) ──────────────────
void (async () => {
  if (process.env.SEEDING_BOT_ENABLED === 'true') {
    try {
      // 동적 import: SEEDING_BOT_ENABLED=false 시 봇 모듈 전체 미로드 (메모리·의존성 격리)
      const { botProcessor } = await import('./processors/bot/index.js');
      const { setupBotCrons } = await import('./schedules/bot.cron.js');

      const botConnection = createConnection();
      const botWorker = new Worker(
        QUEUE_NAMES.bot,
        botProcessor,
        { connection: botConnection, concurrency: 3 }, // 여러 봇 동시 처리
      );

      // [격리 보장] failed·error 핸들러: console.error만, process.exit() 금지
      botWorker.on('ready', () => console.log('[worker] bot 워커 준비 완료'));
      botWorker.on('completed', (job) =>
        console.info(`[bot-worker] job 완료: ${job.id} (${job.name})`));
      botWorker.on('failed', (job, error) =>
        // 잡 실패 → 로그만. 다른 워커·api·web 영향 없음
        console.error(`[bot-worker] job 실패 ${job?.id} (${job?.name}):`, error.message));
      botWorker.on('error', (error) =>
        // Worker 수준 오류 → 전파 차단, 로그만
        console.error('[bot-worker] Worker 오류 (사이트 본체 영향 없음):', error.message));

      workers.push(botWorker); // 그레이스풀 셧다운 포함
      console.log('[worker] 봇 워커 등록 완료 (SEEDING_BOT_ENABLED=true)');

      // 봇 크론 등록
      try {
        const botCronQueue = new Queue(QUEUE_NAMES.bot, { connection: createConnection() });
        await setupBotCrons(botCronQueue);
      } catch (err) {
        console.warn('[worker] 봇 크론 등록 실패 (봇 비활성화 유지):', (err as Error).message);
      }

    } catch (err) {
      // 봇 모듈 초기화 실패 → 봇만 비활성화, 나머지 워커 정상 가동 [격리 핵심]
      console.error('[worker] 봇 워커 초기화 실패 (사이트 본체 영향 없음):', (err as Error).message);
    }
  } else {
    console.log('[worker] 봇 워커 비활성화 (SEEDING_BOT_ENABLED != true)');
  }
})();
// ── [11.13] 봇 워커 END ───────────────────────────────────────────────────────
```

- [x] 6.3 `SIGINT`/`SIGTERM` 핸들러 내 `shutdown()` 함수는 이미 `workers.map((w) => w.close())`를 사용하므로 수정 불필요. 봇 워커는 6.2에서 `workers.push(botWorker)` 했으므로 자동 포함된다.

### Task 7: `apps/api/src/lib/queues.ts` 수정 — `getBotQueue()` 추가 (AC: #1)

봇 잡 수동 enqueue(관리자 UI·11.14~11.16)·일일 계획에서 write/comment 잡 발행에 필요.

- [x] 7.1 기존 `getRankingQueue()` 패턴(지연 초기화 싱글톤) 그대로 복사해 `getBotQueue()` 추가:

```typescript
/** bot 큐 이름 (Story 11.13) — worker QUEUE_NAMES.bot와 동일해야 함 */
export const BOT_QUEUE_NAME = "bot" as const;

let _botQueue: Queue | null = null;

/**
 * 봇 통합 큐 인스턴스를 반환한다(지연 초기화 싱글톤).
 * 관리자 봇 라우트(11.14~11.16)·일일 계획 processor가 bot.write / bot.comment 잡 발행에 사용.
 */
export function getBotQueue(): Queue {
  if (!_botQueue) {
    _botQueue = new Queue(BOT_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return _botQueue;
}
```

### Task 8: 디스패처 단위 테스트 (AC: #3)

- [x] 8.1 `apps/worker/src/processors/bot/bot.processor.test.ts` 생성. 기존 `rankingCompute.processor.test.ts`의 Vitest 구조 참고.

  테스트 항목:
  - **정상 분기**: `job.name = 'bot.daily-plan'` → `botDailyPlanProcessor` 호출 검증 (vi.mock)
  - **정상 분기**: `job.name = 'bot.write'` → `botWriteProcessor` 호출 검증
  - **알 수 없는 잡 이름**: `job.name = 'unknown.job'` → throw 없이 `console.warn` 출력, resolved 확인
  - **격리 검증**: 한 processor가 throw해도 dispatcher가 그것을 re-throw하지 않고 BullMQ `failed` 이벤트로 처리됨 (BullMQ 자체 동작 — 주석으로 설계 근거 명시, 별도 테스트 불필요)

- [x] 8.2 `pnpm -F @ai-jakdang/worker test` 기존 테스트 회귀 없음 확인.

### Task 9: TypeScript 검증

- [x] 9.1 `pnpm -F @ai-jakdang/worker typecheck` — 컴파일 에러 없음 확인.
- [x] 9.2 `pnpm -F @ai-jakdang/api typecheck` — `queues.ts` 수정 후 에러 없음 확인.

---

## Dev Notes

### 선행 의존성 (중요)

Story 11.13은 다음 스토리의 결과물을 `import`한다. 착수 전 해당 파일 존재 여부를 확인한다.

| import 경로 | 생성 스토리 | 비고 |
|---|---|---|
| `./write.processor.js` | Story 11.9 | 글 생성 파이프라인 전체 |
| `./comment.processor.js` | Story 11.10 | 댓글·반응 파이프라인 |
| `./daily-plan.processor.js` | Story 11.11 | 일일 활동 계획 생성기 |

**파일 없을 경우**: Task 2.2 지시대로 빈 stub 파일을 임시 생성하고 `// TODO: Story 11.X에서 실 구현` 주석 명시. stub은 `botXxxProcessor(_job: Job): Promise<void>` 시그니처만 맞추면 됨.

### 재사용할 핵심 Worker 패턴 경로

| 패턴 | 참고 파일 |
|---|---|
| 잡 등록·Worker 생성 | `apps/worker/src/index.ts` § `content.cleanup` 블록 (282~336행) |
| cron 등록 함수 | `apps/worker/src/schedules/ranking.cron.ts` — `setupRankingCron(Queue)` |
| 잡 이름 기반 디스패처 | `apps/worker/src/index.ts` § `rankingProcessor` (189~199행) |
| API 측 Queue 싱글톤 | `apps/api/src/lib/queues.ts` — `getRankingQueue()` (158~174행) |

### `content.cleanup` 패턴과의 대응

```
content.cleanup 패턴          | 봇 패턴 (이 스토리)
------------------------------|-------------------------------
QUEUE_NAMES.cleanup = "cleanup" | QUEUE_NAMES.bot = "bot"
jobs/cleanup.ts의 함수 import  | processors/bot/index.ts 디스패처
cleanupWorker = new Worker()   | botWorker = new Worker(…, concurrency: 3)
workers.push(cleanupWorker)    | workers.push(botWorker)
async IIFE → contentCleanupQueue.add(…, repeat) | async IIFE → setupBotCrons(botCronQueue)
```

### 격리 설계 근거 (AC #3 "설계로 증명")

```
apps/api   (포트 3001) ┐
apps/web   (포트 3003) ├── 별개 Node.js 프로세스 → 봇 Worker 크래시와 완전 독립
apps/admin (포트 3004) ┘

apps/worker (봇 포함) ──→ 봇 Worker 오류는 BullMQ Worker.on('error'/'failed')로 흡수
                           process.exit() 없음 → 다른 Worker (email, ranking, cleanup) 계속 실행
```

- BullMQ `Worker`는 잡 처리 중 throw가 발생해도 내부적으로 catch → `failed` 이벤트 발행. Worker 프로세스 자체는 죽지 않음.
- Worker 수준 오류(`error` 이벤트, 예: Redis 연결 끊김)도 이벤트 핸들러가 있으면 `uncaughtException`으로 전파되지 않음.
- `try/catch`로 봇 모듈 `import` + Worker 생성 전체를 감싸면 봇 코드의 `import` 에러(syntax/타입 오류 등)도 다른 워커에 영향 없음.

### 동적 import 선택 이유

`SEEDING_BOT_ENABLED=false`(기본값) 시 봇 관련 processor 모듈 전체가 메모리에 로드되지 않아야 함(`import` 시 DB 연결·AI SDK 초기화 등 부작용 방지). 따라서 정적 import 대신 `await import('./processors/bot/index.js')`를 async IIFE 내에서 조건부 실행한다.

### `apps/worker/package.json` 의존성

`@ai-jakdang/config` 패키지는 `apps/worker/package.json`에 없으므로 `env.ts`를 import하지 않는다. `SEEDING_BOT_ENABLED`는 `process.env.SEEDING_BOT_ENABLED`로 직접 읽는다. 기존 워커도 `process.env.REDIS_URL`, `process.env.DATABASE_URL` 등을 직접 읽는 패턴이 확립되어 있음.

### `getBotQueue()` 위치와 사용처

- `apps/api/src/lib/queues.ts` — API 측 Queue producer (기존 `getFileScanQueue`, `getRankingQueue` 패턴)
- 11.11 processor가 `bot.write`/`bot.comment` 잡을 enqueue할 때도 이 queue를 사용할 수 있음 (또는 processor 내부에서 직접 Queue 인스턴스 생성 — 둘 다 유효)
- 봇 관련 잡을 API 라우트에서 수동 enqueue(11.14~11.16 관리자 패널)할 때 반드시 필요

### `SEEDING_BOT_ENABLED` env 위치

- `.env.example`(루트)에 `SEEDING_BOT_ENABLED=false` 이미 포함됨 — `docs/seeding-bot/DEPLOYMENT.md` §부록 A 참고. 별도 `.env.example` 수정 불필요.
- `packages/config/src/env.ts` 수정은 이 스토리 범위 외 (AI·검색·이미지 키는 Story 11.6~11.8에서 추가).

### 봇 Worker `concurrency` 설정

- `concurrency: 3` — 동시에 최대 3개 봇 잡 처리.
  - `bot.write`·`bot.comment` 잡이 지연(분~시간) 후 한꺼번에 도달할 수 있으므로 최소 2~3 권장.
  - 너무 높으면 AI API 동시 호출 급증·비용 상한(`bot_daily_cost_limit_usd`) 순간 초과 가능.
  - 11.12(비용 상한) 구현 후 상향 조정 가능.

### 크론 시간 근거

- `bot.daily-plan` UTC 17:00 = KST 02:00 (새벽, 사람 없을 때 다음 날 계획 수립)
- `bot.daily-report` UTC 22:00 = KST 07:00 (아침 출근 전 전날 리포트 발행, 텔레그램 수신 시간대 맞춤)
- `bot.refill-topics` UTC 18:00 = KST 03:00 (daily-plan보다 1시간 앞서 주제 풀 보충 완료)

### 스토리 그룹 D 내 의존성 순서

```
11.11 (daily-plan processor 구현)
  ↓
11.12 (bot_master_enabled 킬 스위치 — 모든 processor에 시작 시 체크 삽입)
  ↓
11.13 (이 스토리 — BullMQ 등록 + 격리 + 토글) ← 11.9·11.10 processor도 완료 상태 가정
```

### Project Structure Notes

**신규 파일 (이 스토리 생성)**:
```
apps/worker/src/processors/bot/index.ts                  (봇 잡 디스패처)
apps/worker/src/processors/bot/daily-report.processor.ts (stub, 11.17에서 실구현)
apps/worker/src/processors/bot/refill-topics.processor.ts (stub)
apps/worker/src/processors/bot/bot.processor.test.ts      (단위 테스트)
apps/worker/src/schedules/bot.cron.ts                    (cron 등록)
```

**수정 파일 (이 스토리 수정)**:
```
apps/worker/src/connection.ts          (QUEUE_NAMES.bot 추가)
apps/worker/src/index.ts               (봇 Worker 조건부 등록 블록)
apps/api/src/lib/queues.ts             (getBotQueue() + BOT_QUEUE_NAME 추가)
```

**이 스토리가 건드리지 않는 파일** (선행 스토리 영역):
```
apps/worker/src/processors/bot/write.processor.ts          — Story 11.9 담당
apps/worker/src/processors/bot/comment.processor.ts         — Story 11.10 담당
apps/worker/src/processors/bot/daily-plan.processor.ts      — Story 11.11 담당
```

---

### References

- `content.cleanup` 패턴 전체 (등록·Worker·cron): [Source: apps/worker/src/index.ts#282-336]
- `content.cleanup` processor 파일 구조 예시: [Source: apps/worker/src/jobs/cleanup.ts]
- `rankingProcessor` 디스패처 (switch 패턴): [Source: apps/worker/src/index.ts#189-199]
- `setupRankingCron` — cron 등록 패턴 참고: [Source: apps/worker/src/schedules/ranking.cron.ts]
- `QUEUE_NAMES` 현재 목록 (확장 위치 확인): [Source: apps/worker/src/connection.ts]
- `createConnection()` 함수 (워커별 별도 연결): [Source: apps/worker/src/connection.ts]
- `getRankingQueue()` 싱글톤 패턴 (getBotQueue 기반): [Source: apps/api/src/lib/queues.ts#158-175]
- 봇 큐/잡 이름 전체 목록: [Source: docs/seeding-bot/ARCHITECTURE.md#9-워커큐크론]
- `SEEDING_BOT_ENABLED` env 정의 및 부팅 토글 설계: [Source: docs/seeding-bot/ARCHITECTURE.md#8-환경변수]
- `.env.example` 봇 키 위치: [Source: docs/seeding-bot/DEPLOYMENT.md#부록-A]
- 봇 격리 설계 (별 프로세스·fail-safe): [Source: docs/seeding-bot/ARCHITECTURE.md#11-보안실패-모드]
- Story 11.13 AC 원문: [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.13]
- 봇 worker 그룹 D 의존성: [Source: docs/seeding-bot/EPICS-AND-STORIES.md#스토리-그룹-의존성]
- `apps/worker/package.json` 의존성 (config 패키지 없음 확인): [Source: apps/worker/package.json]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- typecheck 1차 실패: `vi.fn<[Job], Promise<void>>()` — vitest의 `vi.fn`은 타입 인수 0~1개만 허용. `vi.fn().mockResolvedValue(undefined)`로 교정.
- `processors/bot/index.ts` 기존 파일: Story 11.10이 배럴 export만 두었음(`export { commentProcessor }`). 디스패처로 교체하되 기존 re-export 유지.
- `dailyPlan.processor.ts`(camelCase) vs `daily-plan.processor.ts`(kebab): 실제 파일은 camelCase이므로 dispatcher import 경로를 `./dailyPlan.processor.js`로 사용.
- `comment.processor.ts` export 이름이 `commentProcessor`(not `botCommentProcessor`)이므로 dispatcher에서 기존 이름 그대로 사용.

### Completion Notes List

- Task 1: `QUEUE_NAMES.bot = "bot"` 추가 완료.
- Task 2: `processors/bot/index.ts`를 5-way switch 디스패처로 교체. Story 11.10 배럴 호환성(re-export) 유지.
- Task 2.2: `write.processor.ts` stub 신규 생성(Story 11.9 미완). `dailyPlan.processor.ts`·`comment.processor.ts`는 11.11·11.10에서 이미 생성됨.
- Task 3: `daily-report.processor.ts` stub 신규(Story 11.17 예정).
- Task 4: `refill-topics.processor.ts` stub 신규(Story 11.9 연결 예정).
- Task 5: `schedules/bot.cron.ts` — UTC 17:00/18:00/22:00 3개 반복 잡 멱등 등록.
- Task 6: `index.ts`에 `[11.13]` 봇 Worker async IIFE 삽입. 동적 import로 모듈 격리. failed/error 핸들러 console.error만(process.exit 없음). try/catch로 봇 초기화 실패 격리.
- Task 7: `apps/api/src/lib/queues.ts`에 `getBotQueue()`·`BOT_QUEUE_NAME` 추가(getRankingQueue 싱글톤 패턴 재사용).
- Task 8: `bot.processor.test.ts` — 7개 테스트(5 정상분기 + 2 unknown warn). vi.hoisted + vi.mock으로 processor mock 격리.
- typecheck: worker 0 errors, api 0 errors.
- test: 27 passed (bot 7 + rankingCompute 14 + resource-scan 6), 회귀 없음.

### File List

```
apps/worker/src/connection.ts                             (수정 — QUEUE_NAMES.bot 추가)
apps/worker/src/processors/bot/index.ts                   (신규 — 봇 잡 디스패처)
apps/worker/src/processors/bot/daily-report.processor.ts  (신규 — stub)
apps/worker/src/processors/bot/refill-topics.processor.ts (신규 — stub)
apps/worker/src/processors/bot/bot.processor.test.ts      (신규 — 단위 테스트)
apps/worker/src/schedules/bot.cron.ts                     (신규 — cron 등록)
apps/worker/src/index.ts                                  (수정 — 봇 Worker 조건부 등록 블록)
apps/api/src/lib/queues.ts                                (수정 — getBotQueue() + BOT_QUEUE_NAME)
```

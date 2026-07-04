# Story 13.6: 예약 스케줄러 (하루 1편 · 챕터별 시각 · 준비완료 게이트)

Status: done

---

## Story

As a 시스템 운영자,
I want 커리큘럼 챕터에 하루 간격 `scheduled_at`(챕터별 예약 게시 시각)을 자동 배정하고, BullMQ 크론 잡 `bot.curriculum-publish`(커리큘럼 예약 게시 크론 잡)이 30분마다 `status=ready`(이미지 준비완료) AND `scheduled_at<=now` 챕터를 스캔해 실제 게시판에 발행하기,
so that 관리자가 커리큘럼 전편의 예약 시각을 한 번만 설정해 두면 매일 자동으로 한 편씩 게시되고, 이미지가 준비되지 않은 챕터는 반쪽짜리 상태로 게시되는 일이 없다.

---

## Acceptance Criteria

### AC1. 하루 간격 예약시각 자동 배정

- **Given** 시리즈 ID와 시작일(`startAt`)이 주어질 때
- **When** `assignDefaultScheduledTimes(seriesId, startAt)` 헬퍼가 호출되면
- **Then** 챕터 `order_index`(1-based 편 번호) = 1 → startAt, 2 → startAt + 1일, N → startAt + (N-1)일로 `scheduled_at`(챕터별 예약 게시 시각)이 설정된다.
- **And** `skipIfSet: true`(기본값)이면 이미 `scheduled_at`이 설정된 챕터는 덮어쓰지 않는다.
- **And** Story 13.5는 수동 `scheduled_at` 지정까지만 제공한다. 이 스토리(13.6)가 완료되면 관리자 API가 이 헬퍼를 호출하는 "자동 하루 간격 배정" 액션을 추가/연결할 수 있다.

### AC2. `bot.curriculum-publish` 크론 등록

- **Given** `SEEDING_BOT_ENABLED`(봇 모듈 로드 여부 env)가 `'true'`이고 worker가 기동될 때
- **When** `setupBotCrons(botQueue)`(크론 등록 함수)가 실행되면
- **Then** `bot.curriculum-publish`(커리큘럼 예약 게시 잡) 잡이 `*/30 * * * *` (30분 간격, UTC)로 단일 `bot` 큐(`QUEUE_NAMES.bot`)에 반복 등록된다.
- **And** `jobId: 'bot-curriculum-publish-cron'`(고정 ID)으로 BullMQ 멱등이 보장된다(재기동 시 중복 등록 없음).
- **And** 기존 단일 `bot` 큐 디스패처(`processors/bot/index.ts`)의 `switch (job.name)` 분기에 `case 'bot.curriculum-publish'`가 추가된다.

### AC3. 준비완료 챕터 게시

- **Given** 스캔 시점에 `scheduled_at <= now AND status = 'ready'`(이미지 준비완료)인 챕터가 DB에 존재할 때
- **When** `bot.curriculum-publish` 잡 처리기가 실행되면
- **Then** `checkBotGates('curriculum-publish')`(봇 게이트 확인)를 먼저 통과한다.
- **And** Story 13.3이 `packages/server-bot/src/curriculum-publish.ts`에 노출하는 `publishChapter(chapterId: string)` 함수가 챕터별로 호출된다.
- **And** 성공 시 챕터 `status = 'published'`(게시 완료), `published_post_id`(게시 결과 포스트 ID, `bot_curriculum_chapters` 컬럼)에 반환된 포스트 ID가 저장된다.
- **And** `bot_activity_log`(봇 활동 로그)에 `event_type='post.published'`, `payload={chapterId, seriesId, orderIndex}`(편 번호) 항목이 적재된다.

### AC4. 미완 안전장치 — 게시 없이 대기 + 표시

- **Given** 스캔 시점에 `scheduled_at <= now AND status NOT IN ('ready', 'published', 'skipped')`(이미지 미완 챕터)가 존재할 때
- **When** 잡 처리기가 해당 챕터를 발견하면
- **Then** 게시하지 않고 건너뛴다.
- **And** `bot_activity_log`에 `event_type='skipped'`, `payload={reason:'image_slots_pending', chapterId, scheduledAt, currentStatus}`(현재 상태) 항목이 적재된다.
- **And** Story 13.5 관리자 API는 `scheduled_at <= now AND status NOT IN ('ready','published','skipped')` 챕터를 조회해 관리자 화면에서 "⚠️ 이미지 미완으로 보류 중" 배지를 표시할 수 있다. (13.5 API 쿼리 명세는 이 스토리의 Dev Notes에 포함.)

### AC5. 킬 스위치·비용 상한 게이트 적용

- **Given** `bot_master_enabled`(킬 스위치)가 false이거나 `bot_daily_cost_limit_usd`(일일 비용 상한 달러)에 도달했을 때
- **When** `bot.curriculum-publish` 잡이 실행되면
- **Then** `checkBotGates('curriculum-publish')` 결과 `allowed: false` 반환 → skip + `logBotSkip` 호출 후 `return`(BullMQ 정상 완료, `throw` 금지).
- **And** 글/댓글 수 상한(`bot_daily_post_limit`(하루 최대 글 수), `bot_daily_comment_limit`(하루 최대 댓글 수))은 커리큘럼 게시에 적용하지 않는다(관리자가 예약한 콘텐츠이므로 일반 봇 글 상한과 분리).

### AC6. 연속성 갱신 (게시된 편 요약 저장)

- **Given** 챕터 게시가 성공했을 때
- **When** `publishChapter(chapterId)` 반환값에 `continuitySummary`(게시된 편의 연속성 요약)가 포함될 때
- **Then** 현재 게시된 챕터의 `continuity_summary`(편별 요약 컬럼)가 해당 요약으로 UPDATE된다.
- **And** 다음 편 초안 생성(13.3)은 이전 편들의 `continuity_summary`를 읽어 `previousChapters`에 주입한다. 스케줄러가 다음 편 레코드에 앞편 요약을 복사하지 않는다.

---

## Tasks / Subtasks

### Task 1: `packages/server-bot/src/curriculum-schedule.ts` 신규 — 예약시각 자동 배정 유틸 (AC: #1)

- [ ] 1.1 파일 신규 생성. DB import는 `@ai-jakdang/database`, `@ai-jakdang/database/schema` 경로 사용(기존 `gates.ts` 패턴 동일).
- [ ] 1.2 `assignDefaultScheduledTimes(seriesId: string, startAt: Date, skipIfSet = true): Promise<void>` 구현.
  - `botCurriculumChapters`(챕터 테이블)에서 해당 `seriesId`(시리즈 FK) 챕터를 `order_index`(편 번호) ASC로 조회.
  - 각 챕터에 대해 `targetTime = new Date(startAt.getTime() + (orderIndex - 1) * 24 * 60 * 60 * 1000)` 계산.
  - `skipIfSet = true`이면 `scheduledAt`이 이미 NOT NULL인 챕터는 UPDATE하지 않는다.
  - Drizzle batch UPDATE: `where(eq(botCurriculumChapters.id, chapter.id))`.
  - 실행 후 업데이트된 챕터 수를 로그 출력.

  ```typescript
  // 사용 예시 (13.6 완료 후 관리자 API 자동 배정 액션에서 호출)
  import { assignDefaultScheduledTimes } from '@ai-jakdang/server-bot/curriculum-schedule';
  await assignDefaultScheduledTimes(seriesId, new Date(), true);
  ```

- [ ] 1.3 `packages/server-bot/package.json` exports에 `"./curriculum-schedule"` 항목 추가(기존 `"./gates"` 패턴).
- [ ] 1.4 `pnpm -F @ai-jakdang/server-bot tsc --noEmit` 통과 확인.

### Task 2: `packages/server-bot/src/gates.ts` 수정 — `curriculum-publish` jobKind 지원 (AC: #5)

- [ ] 2.1 기존 `checkBotGates(jobKind)` 함수에 `curriculum-publish` 전용 분기 추가. 파일 상단 주석의 "사용 계약" 섹션에도 예시 추가.

  아래 블록을 기존 `plan`/`report` 단락 평가 분기 **바로 아래**에 삽입:

  ```typescript
  // ── curriculum-publish 잡: 킬 스위치 + 비용 상한만 확인 ───────────────────────
  // 커리큘럼은 관리자가 사전 승인한 콘텐츠 → 글/댓글 수 상한·관찰 모드 미적용.
  // 비용 상한은 여전히 적용(과금 폭주 방지).
  if (jobKind === 'curriculum-publish') {
    const costReached = await isCostLimitReached().catch(() => false);
    if (costReached) {
      return { allowed: false, reason: 'daily_cost_limit_reached' };
    }
    return { allowed: true, observationMode: false };
  }
  ```

- [ ] 2.2 기존 파일 끝부분 주석 블록에 `curriculum-publish` jobKind 동작 설명 추가.
- [ ] 2.3 `pnpm -F @ai-jakdang/server-bot tsc --noEmit` 통과 확인.

### Task 3: `apps/worker/src/schedules/bot.cron.ts` 수정 — `bot.curriculum-publish` 크론 추가 (AC: #2)

- [ ] 3.1 기존 `setupBotCrons(botQueue)` 함수 끝(3번 refill-topics cron 등록 직후)에 아래 블록 추가:

  ```typescript
  // ── 4. bot.curriculum-publish: 30분마다 스캔 (UTC) ──────────────────────────
  // KST 무관 — 예약 시각 도달 여부만 판단하므로 UTC 기준 30분 간격이면 충분.
  await botQueue.add(
    'bot.curriculum-publish',
    { triggeredAt: new Date().toISOString() },
    {
      repeat: { pattern: '*/30 * * * *' },
      jobId: 'bot-curriculum-publish-cron', // 고정 jobId = 멱등 (재기동 중복 등록 방지)
    },
  );
  console.log('[worker] bot.curriculum-publish 크론 등록 완료 (30분 간격)');
  ```

- [ ] 3.2 파일 상단 JSDoc 크론 시간 표 주석에 `bot.curriculum-publish` 항목 추가:
  ```
  *   bot.curriculum-publish  */30 * * * *  (30분마다) 준비완료 챕터 게시 스캔
  ```

### Task 4: `apps/worker/src/processors/bot/index.ts` 수정 — 디스패처 case 추가 (AC: #2)

- [ ] 4.1 파일 상단 import에 신규 processor 추가:
  ```typescript
  import { curriculumPublishProcessor } from './curriculumPublish.processor.js'; // Story 13.6
  ```
- [ ] 4.2 기존 `switch (job.name)` 블록 끝(default case 직전)에 아래 case 삽입:
  ```typescript
  case 'bot.curriculum-publish':
    return curriculumPublishProcessor(job);
  ```
- [ ] 4.3 파일 상단 JSDoc 잡 이름 목록 주석에 아래 항목 추가:
  ```
  *   bot.curriculum-publish → curriculumPublishProcessor  (Story 13.6)
  ```
- [ ] 4.4 `pnpm -F @ai-jakdang/worker tsc --noEmit` 통과 확인.

### Task 5: `apps/worker/src/processors/bot/curriculumPublish.processor.ts` 신규 — 메인 처리기 (AC: #3, #4, #5, #6)

- [ ] 5.1 파일 신규 생성. 파일 최상단에 경계 제약 주석 명시:
  ```typescript
  /**
   * bot.curriculum-publish 잡 처리기 — Story 13.6
   *
   * 경계 제약:
   *  - apps/api/src/* import 절대 금지 (worker 프로세스 경계 외)
   *  - 게이트: @ai-jakdang/server-bot/gates (checkBotGates, logBotSkip)
   *  - 예약시각 유틸: @ai-jakdang/server-bot/curriculum-schedule
   *  - 게시 실행: @ai-jakdang/server-bot/curriculum-publish (Story 13.3 구현 필수)
   *  - DB 스키마: @ai-jakdang/database/schema
   */
  ```

- [ ] 5.2 import 목록:
  ```typescript
  import type { Job } from 'bullmq';
  import { and, eq, inArray, lte, not } from 'drizzle-orm';
  import { getDb } from '@ai-jakdang/database';
  import { botCurriculumChapters, botActivityLog } from '@ai-jakdang/database/schema';
  import { checkBotGates, logBotSkip } from '@ai-jakdang/server-bot/gates';
  // publishChapter는 Story 13.3이 packages/server-bot/src/curriculum-publish.ts에 구현
  import { publishChapter } from '@ai-jakdang/server-bot/curriculum-publish';
  ```

- [ ] 5.3 `curriculumPublishProcessor(job: Job): Promise<void>` 구현. 처리 순서:

  **Step 1 — 게이트 체크 (AC: #5)**
  ```typescript
  const gate = await checkBotGates('curriculum-publish');
  if (!gate.allowed) {
    await logBotSkip(null, gate.reason, 'curriculum-publish');
    return; // BullMQ 정상 완료 (throw 금지 — 재시도 큐 오염 방지)
  }
  ```

  **Step 2 — 준비완료 챕터 스캔 (AC: #3)**
  - 쿼리: `botCurriculumChapters WHERE scheduledAt <= now() AND status = 'ready'`, `scheduledAt ASC`(가장 오래된 것부터).
  - 결과가 없으면 조용히 반환(정상).

  **Step 3 — 챕터별 게시 실행 (AC: #3, #6)**
  ```typescript
  for (const chapter of readyChapters) {
    try {
      const result = await publishChapter(chapter.id);
      // status, published_post_id 업데이트
      await db.update(botCurriculumChapters)
        .set({ status: 'published', publishedPostId: result.postId, updatedAt: new Date() })
        .where(eq(botCurriculumChapters.id, chapter.id));
      // bot_activity_log 기록
      await db.insert(botActivityLog).values({
        personaId: null,          // 커리큘럼은 페르소나 없음 → null 허용 여부는 스키마 확인(Dev Notes)
        eventType: 'post.published',
        refId: result.postId,
        payload: { chapterId: chapter.id, seriesId: chapter.seriesId, orderIndex: chapter.orderIndex },
      });
      // 연속성 갱신 (AC: #6) — 현재 게시된 편의 요약 저장
      if (result.continuitySummary) {
        await db.update(botCurriculumChapters)
          .set({ continuitySummary: result.continuitySummary, updatedAt: new Date() })
          .where(eq(botCurriculumChapters.id, chapter.id));
      }
      console.info(`[curriculum-publish] 게시 완료: chapterId=${chapter.id}, postId=${result.postId}`);
    } catch (err) {
      // 챕터별 오류가 다른 챕터 처리를 막으면 안 됨 (fail-safe)
      console.error(`[curriculum-publish] 챕터 게시 실패 (chapterId=${chapter.id}):`, (err as Error).message);
      // 개별 챕터 오류는 재시도 가능하도록 throw하지 않고 다음 챕터로 진행
    }
  }
  ```

  **Step 4 — 미완 챕터 감지 + 경고 로그 (AC: #4)**
  ```typescript
  const overdueChapters = await db
    .select()
    .from(botCurriculumChapters)
    .where(
      and(
        lte(botCurriculumChapters.scheduledAt, new Date()),
        not(inArray(botCurriculumChapters.status, ['ready', 'published', 'skipped'])),
      ),
    );

  for (const chapter of overdueChapters) {
    console.warn(
      `[curriculum-publish] 이미지 미완 챕터 보류: chapterId=${chapter.id}, status=${chapter.status}`,
    );
    await db.insert(botActivityLog).values({
      personaId: null,
      eventType: 'skipped',
      refId: chapter.id,
      payload: {
        reason: 'image_slots_pending',
        chapterId: chapter.id,
        scheduledAt: chapter.scheduledAt?.toISOString(),
        currentStatus: chapter.status,
      },
    }).catch((e) => {
      console.error('[curriculum-publish] 보류 로그 실패 (무시):', (e as Error).message);
    });
  }
  ```

- [ ] 5.4 `pnpm -F @ai-jakdang/worker tsc --noEmit` 통과 확인.

### Task 6: TypeScript 전체 검증

- [ ] 6.1 `pnpm -F @ai-jakdang/server-bot tsc --noEmit` — 0 errors.
- [ ] 6.2 `pnpm -F @ai-jakdang/worker tsc --noEmit` — 0 errors.
- [ ] 6.3 기존 봇 테스트 회귀 없음: `pnpm -F @ai-jakdang/worker test`.

---

## Dev Notes

### ⚠️ Worker → 파이프라인 Last-Mile 경계 제약 (핵심)

`apps/worker`는 `apps/api/src/*`를 **직접 import할 수 없다**. 이는 11.13 워커 격리 설계의 핵심 제약이며, 기존 `write.processor.ts`·`comment.processor.ts`의 TODO 주석에도 명시된 사항이다:

```typescript
// apps/worker/src/processors/bot/write.processor.ts
// TODO: 파이프라인을 server-bot 경계로 이전 후 연결(apps/api 직접 import 불가)
//   import { runPostPipeline } from '@ai-jakdang/server-bot/pipeline';
```

따라서 Story 13.3이 구현하는 `publishChapter(chapterId)` 함수는 반드시 **`packages/server-bot/src/curriculum-publish.ts`** 에 위치해야 한다. `apps/api/src/services/bot/`에만 구현하면 13.6 processor가 연결 불가하다.

**13.3이 노출해야 할 인터페이스 (13.6 착수 전 확인 필수)**:

```typescript
// packages/server-bot/src/curriculum-publish.ts (Story 13.3 구현)
export interface PublishChapterResult {
  postId: string;                    // 게시된 포스트 ID
  continuitySummary: string | null;  // 다음 편에 주입할 앞편 요약 (없으면 null)
}

export async function publishChapter(chapterId: string): Promise<PublishChapterResult>;
```

이 인터페이스 계약(`PublishChapterResult` 타입)은 13.3과 13.6이 공유한다. 13.3 스토리 파일에 이 인터페이스를 명기하거나, `packages/contracts/src/bot-curriculum.ts`(13.2)에 추가해야 한다.

**13.6 processor의 worker → server-bot 연결 구조**:

```
apps/worker (bot.curriculum-publish 잡 처리기)
  ↓ import (허용)
packages/server-bot/src/curriculum-publish.ts
  → insertInlineImagesByMarker (packages/server-bot/src/image/tiptap.ts, 기존)
  → createPostAsBot (apps/api 내부 — server-bot이 어떻게 접근할지는 13.3 담당)
```

> **참고**: `createPostAsBot`은 현재 `apps/api/src/services/bot/write.ts`에 있다. `packages/server-bot`이 이를 호출하려면, `write.ts`를 `packages/server-bot`으로 이전하거나, `packages/server-bot`에서 직접 DB를 조작하는 방식으로 구현해야 한다. 이 last-mile 경계 해소는 **Story 13.3의 책임**이다. 13.6 개발 착수 전 13.3의 `publishChapter` 위치가 `packages/server-bot`에 있는지 반드시 확인.

### `checkBotGates('curriculum-publish')` 동작 (Task 2 설명)

기존 `gates.ts`의 jobKind별 체크 매트릭스:

| 체크 항목 | `write` | `comment` | `plan`/`report` | **`curriculum-publish`** |
|---|---|---|---|---|
| 킬 스위치(`bot_master_enabled`) | ✅ | ✅ | ✅ | ✅ |
| 글 수 상한(`bot_daily_post_limit`) | ✅ | ❌ | ❌ | **❌** (관리자 예약 콘텐츠) |
| 댓글 수 상한(`bot_daily_comment_limit`) | ❌ | ✅ | ❌ | **❌** |
| 비용 상한(`bot_daily_cost_limit_usd`) | ✅ | ✅ | ❌ | **✅** (과금 폭주 방지) |
| 관찰 모드(`bot_observation_mode`) | ✅ | ✅ | 반환만 | **❌** (관리자 승인 = 관찰 불필요) |

`curriculum-publish` 전용 분기는 킬 스위치 단락 평가 이후, `plan`/`report` 분기와 `write`/`comment` 병렬 조회 사이에 삽입한다. 비용 상한은 `isCostLimitReached()` 단독 호출로 처리(post/comment count 병렬 조회 불필요).

### 선행 의존성

| 의존 스토리 | 필요한 것 | 미완시 대처 |
|---|---|---|
| **13.1 완료** (필수) | `bot_curriculum_chapters` 테이블, `scheduled_at`(예약 시각) · `status`(챕터 상태) · `continuity_summary`(연속성 요약) · `published_post_id`(게시 포스트 ID) · `series_id`(시리즈 FK) · `order_index`(편 번호) 컬럼, `botCurriculumChapterStatus` enum(`planned·drafted·ready·published·skipped`) | 13.1 없으면 컴파일·런타임 에러 — 13.1 먼저 완료 필수 |
| **13.3 완료** (필수) | `packages/server-bot/src/curriculum-publish.ts`에서 `publishChapter(chapterId: string): Promise<PublishChapterResult>` export | 없으면 13.6 processor가 import 불가. Task 5 착수 전 파일 존재 여부를 확인하고, 없으면 13.3을 먼저 완료한다. **stub으로 우회 금지** |
| **11.12 완료** (완료됨) | `checkBotGates`, `logBotSkip`, `isCostLimitReached` — `packages/server-bot/src/gates.ts` | 이미 구현됨(`gates.ts` 검증 완료). Task 2에서 `curriculum-publish` 분기만 추가 |
| **11.13 완료** (완료됨) | `SEEDING_BOT_ENABLED`(봇 모듈 로드 env 가드), `setupBotCrons`(크론 등록 함수), 단일 `bot` 큐 디스패처, `QUEUE_NAMES.bot` | 이미 구현됨. Task 3·4에서 확장만 |

### `bot_activity_log` `persona_id` NOT NULL 제약 처리

Story 13.3/11.12 Dev Agent Record에서 확인된 제약:
- `bot_activity_log.persona_id`는 NOT NULL 제약을 가진다.
- `curriculum-publish` 잡은 특정 페르소나와 무관한 시스템 동작이라 `personaId=null` 전달이 필요하다.

두 가지 대응 중 하나를 착수 시점에 확인해 선택:
1. **Schema 확인 후 nullable 처리**: `bot_activity_log.persona_id`가 실제 nullable이면 `null` 삽입 가능.
2. **로그 생략**: `bot_curriculum_chapters` 자체의 `status` 변경이 충분한 감사 추적이 되므로, `bot_activity_log` INSERT를 생략하고 `console.info` 로그만 남긴다.

`packages/database/src/schema/bot.ts`에서 `botActivityLog.personaId` 컬럼 정의를 확인해 결정한다.

### 13.5 관리자 API — "이미지 미완 보류" 표시 지원 (AC: #4 연계)

13.5(관리자 커리큘럼 플랜 API) 개발 시 참고: 관리자 챕터 목록 API 응답에 아래 필드를 포함시키면 프론트가 "⚠️ 이미지 미완으로 보류 중" 배지를 표시할 수 있다.

```typescript
// 챕터 목록 응답 DTO 제안 (13.5 scope)
interface ChapterListItem {
  // ...
  isOverdue: boolean; // scheduledAt <= now() AND status NOT IN ('ready','published','skipped')
}
```

SQL 조건:
```sql
scheduled_at IS NOT NULL
AND scheduled_at <= NOW()
AND status NOT IN ('ready', 'published', 'skipped')
```

### 건드릴 파일 표

| 구분 | 파일 | 설명 |
|---|---|---|
| 신규 | `apps/worker/src/processors/bot/curriculumPublish.processor.ts` | 커리큘럼 예약 게시 잡 처리기 (메인) |
| 신규 | `packages/server-bot/src/curriculum-schedule.ts` | `assignDefaultScheduledTimes` 유틸 |
| 수정 | `apps/worker/src/processors/bot/index.ts` | `case 'bot.curriculum-publish'` case·import 추가 |
| 수정 | `apps/worker/src/schedules/bot.cron.ts` | `bot.curriculum-publish` 30분 cron 등록 추가 |
| 수정 | `packages/server-bot/src/gates.ts` | `curriculum-publish` jobKind 분기 추가 |
| 수정 | `packages/server-bot/package.json` | `./curriculum-schedule` exports 추가 |
| **13.3 담당** | `packages/server-bot/src/curriculum-publish.ts` | **이 스토리 생성 금지** — 13.3이 구현해야 함 |

**이 스토리가 건드리지 않는 파일**:
- `packages/server-bot/src/curriculum-publish.ts` — Story 13.3 담당
- `apps/api/src/services/bot/post-pipeline.ts` — 일반 파이프라인, 13.6 무관
- `apps/worker/src/index.ts` — 봇 Worker 등록 블록은 11.13 완료. 추가 수정 불필요
- `packages/database/src/schema/bot-curriculum.ts` — Story 13.1 담당

### References

- 스케줄러 설계 단일출처 §6: [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#6-스케줄러]
- 스테이징 워크플로우 ①~⑥: [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#2-커리큘럼-강의-시리즈-스테이징-워크플로우]
- 준비완료 판정 (`모든 슬롯 ready → 챕터 ready`): [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#4-데이터-모델]
- Story 13.6 AC 원문: [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-13.6]
- 봇 게이트 헬퍼 구현 (`checkBotGates`, `logBotSkip`, `isCostLimitReached`): [Source: packages/server-bot/src/gates.ts]
- 단일 `bot` 큐 + `job.name` 디스패처 (switch case 패턴): [Source: apps/worker/src/processors/bot/index.ts]
- 크론 등록 패턴 (`setupBotCrons`, `repeat.pattern`, 고정 `jobId`): [Source: apps/worker/src/schedules/bot.cron.ts]
- Worker→api 직접 import 금지 제약 (TODO 주석): [Source: apps/worker/src/processors/bot/write.processor.ts]
- comment.processor.ts 게이트 배선 패턴: [Source: apps/worker/src/processors/bot/comment.processor.ts]
- `SEEDING_BOT_ENABLED` env 가드·동적 import 격리: [Source: apps/worker/src/index.ts#11.13 봇 워커 블록]
- 챕터 DB 스키마 (`scheduled_at`, `status` enum, `continuity_summary`, `published_post_id`): [Source: _bmad-output/implementation-artifacts/13-1-curriculum-db-schema-seed.md#Task-1]
- `insertInlineImagesByMarker` 기존 구현: [Source: packages/server-bot/src/image/tiptap.ts]
- `allowDidacticTone` 가이드 검열 완화: [Source: apps/api/src/services/bot/censor.ts]
- `packages/server-bot/package.json` exports 현황 (`./gates`, `./botSettings`): [Source: packages/server-bot/package.json]

---

## Dev Agent Record

### Agent Model Used

_미정 (착수 시 기입)_

### Debug Log References

_착수 후 기입_

### Completion Notes List

_착수 후 기입_

### File List

```
apps/worker/src/processors/bot/curriculumPublish.processor.ts  (신규 — 커리큘럼 예약 게시 잡 처리기)
packages/server-bot/src/curriculum-schedule.ts                 (신규 — assignDefaultScheduledTimes 유틸)
apps/worker/src/processors/bot/index.ts                        (수정 — case 'bot.curriculum-publish' 추가)
apps/worker/src/schedules/bot.cron.ts                          (수정 — 30분 cron 등록 추가)
packages/server-bot/src/gates.ts                               (수정 — curriculum-publish jobKind 분기)
packages/server-bot/package.json                               (수정 — ./curriculum-schedule exports)
```

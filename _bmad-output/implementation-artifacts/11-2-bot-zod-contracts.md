# Story 11.2: 봇 Zod 계약(contracts)

Status: done

## Story

As a 개발자,
I want `packages/contracts/src/bot.ts`에 봇 도메인의 모든 Zod 스키마와 추론 타입을 정의하고 배럴 export를 등록하기,
so that API·worker·admin 전 레이어가 동일한 타입 계약을 import해 사용하며 즉석 타입 정의가 완전히 제거된다.

## Acceptance Criteria

1. `packages/contracts/src/bot.ts` 파일에 아래 도메인 영역별 Zod 스키마 + `z.infer<>` 추론 타입이 모두 정의된다.
   - **페르소나** — `botPersonaSchema`(`botPersonaItemSchema`(목록 카드) + `botPersonaDetailSchema`(상세))
   - **주제 풀** — `botTopicSchema`(개별 항목), `botTopicKindSchema`(topic_kind enum), `botTopicStatusSchema`(status enum)
   - **활동 로그** — `botActivityLogItemSchema`(이벤트 항목), `botActivityEventTypeSchema`(event_type enum)
   - **보류 큐** — `botHoldQueueItemSchema`(보류 항목), `botHoldReasonSchema`(reason enum), `botHoldDecisionSchema`(decision enum)
   - **전역 설정** — `botSettingsResponseSchema`(GET 응답), `botSettingsPatchSchema`(PATCH 요청)
   - **모델 할당** — `botModelAssignmentSchema`(개별 항목), `botProviderSchema`(provider enum), `botPurposeSchema`(purpose enum)
   - **생성 잡** — `botGenerationJobSchema`(개별 잡 항목), `botJobStatusSchema`(status enum), `botJobKindSchema`(job_kind enum)
   - **활동 리듬** — `botActivityRhythmSchema`(활동 리듬 응답), `botActiveHourSchema`(시간대 항목)
   - **관리자 API 요청·응답 봉투**
     - 목록 응답: `{items, meta}` — 기존 `paginatedResponseSchema` 헬퍼 재사용
     - 단건 응답: 직접 페이로드(봉투 없음) — 기존 패턴 준수
     - 오류 응답: `{error:{code,message,details?}}` — 기존 `errorResponseSchema` 재사용(새로 정의 금지)
   - **CRUD 요청** — `botPersonaCreateSchema`, `botPersonaUpdateSchema`(partial), `botTopicCreateSchema`, `botTopicBulkUpsertSchema`, `botModelAssignmentUpsertSchema`, `botRhythmUpdateSchema`, `botHoldQueueDecisionSchema`(보류 결정 요청), `botPersonaBoardUpsertSchema`(담당 게시판 upsert 요청)

2. 모든 스키마에 `z.infer<typeof ...>` 추론 타입이 함께 export된다(inline `type` 키워드 사용, 별도 `export type` 선언 병행).

3. `packages/contracts/src/index.ts` 배럴에 `// ── 시딩 봇 (Epic 11) ──` 주석과 함께 `export * from "./bot"` 한 줄이 추가된다.

4. `packages/contracts` 패키지의 기존 `tsc --noEmit` 검사가 통과한다(새로 추가한 스키마 포함).

5. 기존 `errorResponseSchema`·`paginationMetaSchema`·`paginatedResponseSchema` 등 공용 헬퍼를 그대로 import해 재사용하며, `bot.ts` 내부에서 동일 구조를 재정의하지 않는다.

6. `bot.ts` 파일 상단에 한국어 주석으로 스키마 사용 범위(API/worker/admin)와 단일 진실원 원칙(`ARCHITECTURE §0.7`)을 명시한다.

## Tasks / Subtasks

- [x] Task 1: enum 스키마 정의 (AC: 1)
  - [x] `botProviderSchema` — `z.enum(["openai", "anthropic", "google"])`
  - [x] `botPurposeSchema` — `z.enum(["generation", "censor", "image"])`
  - [x] `botTopicKindSchema` — `z.enum(["fixed", "realtime", "auto"])`
  - [x] `botTopicStatusSchema` — `z.enum(["unused", "used", "cooling"])`
  - [x] `botJobKindSchema` — `z.enum(["post", "comment", "reply", "question", "resource"])` (11.1 `botJobKind` pgEnum과 1:1 일치 — `question`·`resource` 포함, #6 정합)
  - [x] `botJobStatusSchema` — `z.enum(["pending", "generating", "censoring", "held", "approved", "published", "discarded", "blocked"])`
  - [x] `botActivityEventTypeSchema` — `z.enum(["post.published", "comment.published", "held", "blocked", "regenerated", "skipped", "cost", "discarded", "planned"])` (11.1 `botEventType` pgEnum과 1:1 일치 — `discarded`·`planned` 포함)
  - [x] `botHoldReasonSchema` — `z.enum(["ambiguous", "injection_suspect", "copyright_risk", "observation_mode"])` (11.1 `botHoldReason` pgEnum과 1:1 일치 — `observation_mode` 포함)
  - [x] `botHoldDecisionSchema` — `z.enum(["approved", "discarded"])`
  - [x] 각 enum에 `z.infer<>` 추론 타입 export

- [x] Task 2: 단위 도메인 스키마 정의 (AC: 1, 2)
  - [x] `botActiveHourSchema` — `{from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23), crossesMidnight: z.boolean().optional().default(false)}`. 자정을 넘는 구간은 `{from:23,to:2,crossesMidnight:true}`처럼 명시한다(`to > 24`·`% 24` 처리 금지).
  - [x] `botActivityRhythmSchema` — `{personaId, postsPerWeek, commentsPerWeek, activeHours: z.array(botActiveHourSchema), activeDays: z.record(...)}` (응답 전용; nullable 컬럼은 `.nullable()` 적용)
  - [x] `botModelAssignmentSchema` — `{id, personaId, provider, model, purpose, isActive, note}` (목록/상세 동일 형태; `personaId` 포함 — 모델 할당은 persona별, #5 정합). 조회 키는 `(personaId, purpose)` unique.
  - [x] `botTopicSchema` — `{id, personaId, board, titleSeed, topicKind, status, usedAt, seriesGroup}` (nullable 컬럼 반영)
  - [x] `botActivityLogItemSchema` — `{id, personaId, eventType, refId, payload, createdAt}` (payload는 `z.unknown()`)
  - [x] `botHoldQueueItemSchema` — `{id, jobId, reason, decided, decision, decidedAt, decidedBy, draftPreview, personaNickname}` (목록용 요약 포함)
  - [x] `botGenerationJobSchema` — `{id, personaId, jobKind, targetBoard, targetPostId, topicId, status, draftContent, censorResult, regenCount, scheduledAt, publishedPostId, publishedCommentId, cost, createdAt, updatedAt}` (jsonb 필드는 `z.unknown()` 또는 구체 스키마)
  - [x] `botPersonaItemSchema` — 목록 카드용 (id, nickname, isActive, isAdminPersona, infoRatio, createdAt, lastActivityAt 등 요약)
  - [x] `botPersonaDetailSchema` — 상세용 (전체 컬럼 + rhythm, assignedBoards 배열 포함)
  - [x] 각 스키마에 `z.infer<>` 추론 타입 export

- [x] Task 3: 목록 응답 스키마 정의 (AC: 1, 5)
  - [x] `paginatedBotPersonasSchema` — `paginatedResponseSchema(botPersonaItemSchema)` 재사용
  - [x] `paginatedBotTopicsSchema` — `paginatedResponseSchema(botTopicSchema)` 재사용
  - [x] `paginatedBotActivityLogsSchema` — `paginatedResponseSchema(botActivityLogItemSchema)` 재사용
  - [x] `paginatedBotHoldQueueSchema` — `paginatedResponseSchema(botHoldQueueItemSchema)` 재사용
  - [x] `paginatedBotGenerationJobsSchema` — `paginatedResponseSchema(botGenerationJobSchema)` 재사용
  - [x] 추론 타입 export

- [x] Task 4: 관리자 API 쿼리 파라미터 스키마 정의 (AC: 1)
  - [x] `adminBotPersonasQuerySchema` — `{isActive?, q?, page, pageSize}` (`coerce` 패턴 준수)
  - [x] `adminBotTopicsQuerySchema` — `{personaId?, status?, board?, page, pageSize}`
  - [x] `adminBotActivityLogsQuerySchema` — `{personaId?, eventType?, dateFrom?, dateTo?, page, pageSize}`
  - [x] `adminBotHoldQueueQuerySchema` — `{reason?, decided?, page, pageSize}`
  - [x] `adminBotJobsQuerySchema` — `{personaId?, status?, jobKind?, page, pageSize}`

- [x] Task 5: 전역 설정 스키마 정의 (AC: 1, 2)
  - [x] `botSettingsResponseSchema` — ARCHITECTURE §2.10의 key 전체를 flat 객체로 정의 (`bot_master_enabled`, `bot_daily_post_limit`, `bot_daily_comment_limit`, `bot_daily_cost_limit_usd`, `bot_exclude_from_ranking`, `bot_auto_refill_topics`, `bot_observation_mode`, `bot_push_channel`); 모두 optional (키 미존재 허용)
  - [x] `botSettingsPatchSchema` — 동일 키들 partial PATCH용 (변경 키만 전달)

- [x] Task 6: CRUD 요청 스키마 정의 (AC: 1, 2)
  - [x] `botPersonaCreateSchema` — 생성 가능한 필드 명시(`nickname`, `hiddenIdentity`, `ageJob`, `tone`, `personaPrompt`, `infoRatio`, `intentionalFlaws`, `isAdminPersona`, `isActive`)
  - [x] `botPersonaUpdateSchema` — `botPersonaCreateSchema.partial()`
  - [x] `botTopicCreateSchema` — `{personaId, board, titleSeed, topicKind, seriesGroup?}`
  - [x] `botTopicBulkUpsertSchema` — `{topics: z.array(botTopicCreateSchema)}`
  - [x] `botModelAssignmentUpsertSchema` — `{personaId, provider, model, purpose, isActive, note?}`
  - [x] `botRhythmUpdateSchema` — `{postsPerWeek, commentsPerWeek, activeHours, activeDays}`
  - [x] `botHoldQueueDecisionSchema` — `{decision: botHoldDecisionSchema}` (보류 항목 결정 요청)
  - [x] `botPersonaBoardUpsertSchema` — `{boards: z.array({board: z.string(), weight: z.number().int().min(1).max(10)})}`

- [x] Task 7: 배럴 export 등록 (AC: 3)
  - [x] `packages/contracts/src/index.ts` 파일 열기
  - [x] 파일 최하단에 `// ── 시딩 봇 (Epic 11) ──` 주석 블록과 `export * from "./bot"` 한 줄 추가

- [x] Task 8: 타입 검사 통과 확인 (AC: 4)
  - [x] `packages/contracts` 디렉터리에서 `pnpm tsc --noEmit` 실행
  - [x] 기존 export와 이름 충돌 없음 확인 (특히 `botProviderSchema` 등 bot 접두어로 충돌 방지)
  - [x] 오류 있으면 수정 후 재실행

## Dev Notes

### 핵심 패턴 — 반드시 준수

**1. 공용 헬퍼 import 패턴** (`packages/contracts/src/common.ts` 실코드 기준):
```ts
import { z } from "zod";
import { paginatedResponseSchema, paginationMetaSchema, errorResponseSchema } from "./common";
// errorResponseSchema는 새로 정의하지 않는다 — 재사용만.
```

**2. 목록 응답 봉투 패턴** (실제 코드 `admin/members.ts` 기준, `paginatedResponseSchema` 사용):
```ts
// common.ts가 제공하는 제네릭 헬퍼 직접 호출
export const paginatedBotPersonasSchema = paginatedResponseSchema(botPersonaItemSchema);
export type PaginatedBotPersonas = z.infer<typeof paginatedBotPersonasSchema>;
// → 결과: { items: BotPersonaItem[], meta: { page, pageSize, totalItems, totalPages } }
```

**3. 단건 상세 응답** — 봉투(`{data: ...}`) 없이 페이로드 직접 반환(기존 패턴 일치):
```ts
// 라우트에서: reply.send(detail)  ← {data: detail} 아님
export const botPersonaDetailSchema = z.object({ ... });
export type BotPersonaDetail = z.infer<typeof botPersonaDetailSchema>;
```

**4. 오류 응답** — `errorResponseSchema`는 `common.ts`에 이미 정의됨:
```ts
// { error: { code: string, message: string, details?: unknown } }
// 라우트에서: reply.status(404).send({ error: { code: 'BOT_NOT_FOUND', message: '...' } })
// contracts에서 재정의 금지.
```

**5. 쿼리 파라미터 coerce 패턴** (기존 `admin/members.ts` 기준):
```ts
export const adminBotPersonasQuerySchema = z.object({
  isActive: z.enum(["true", "false"]).transform(v => v === "true").optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
```

**6. nullable 컬럼 처리** — DB 컬럼이 nullable인 경우 `.nullable()`, API 응답에서 없을 수 있으면 `.nullable().optional()`:
```ts
usedAt: z.string().nullable(),          // DB nullable
seriesGroup: z.string().nullable().optional(),  // nullable + 미포함 가능
```

**7. jsonb 필드 처리** — `draftContent`, `censorResult`, `cost`, `payload`, `activeDays`는 구조가 유동적이므로 `z.unknown()` 또는 상위 호환 스키마로 처리:
```ts
draftContent: z.unknown(),   // Tiptap JSON — 구조 고정 불가
censorResult: z.unknown(),   // 검열 결과 — 항목 가변
cost: z.unknown(),           // 비용 집계 jsonb
```

### ARCHITECTURE §2 필드와 스키마 1:1 정합 체크포인트

| ARCHITECTURE 테이블 | 핵심 컬럼 | contracts 스키마 필드(camelCase) |
|---|---|---|
| `bot_personas` | `persona_prompt`, `info_ratio`, `intentional_flaws`, `is_admin_persona` | `personaPrompt`, `infoRatio`, `intentionalFlaws`, `isAdminPersona` |
| `bot_topics` | `title_seed`, `topic_kind`, `series_group`, `used_at` | `titleSeed`, `topicKind`, `seriesGroup`, `usedAt` |
| `bot_model_assignments` | `provider`(enum), `purpose`(enum), `is_active` | `provider`, `purpose`, `isActive` |
| `bot_generation_jobs` | `job_kind`, `target_board`, `target_post_id`, `regen_count`, `scheduled_at` | `jobKind`, `targetBoard`, `targetPostId`, `regenCount`, `scheduledAt` |
| `bot_hold_queue` | `reason`(enum), `decided`, `decision`, `decided_by` | `reason`, `decided`, `decision`, `decidedBy` |
| `bot_activity_log` | `event_type`(enum), `ref_id`, `payload` | `eventType`, `refId`, `payload` |
| `bot_settings` | key-value JSONB (8개 키) | flat 객체 스키마로 표현 |
| `bot_activity_rhythm` | `active_hours`(jsonb 배열), `active_days`(jsonb 객체) | `activeHours: z.array(botActiveHourSchema)`, `activeDays: z.record(...)` |

> **11.1과 정합 원칙**: 11.1 스키마가 아직 미구현일 수 있으므로 **ARCHITECTURE §2의 컬럼 목록을 단일 진실원**으로 삼는다. 11.1 구현 후 diff가 생기면 이 파일도 함께 수정.

### API 즉석 타입 정의 금지 가드레일

- `apps/api/src/routes/admin/bots/`(향후 생성), `apps/worker/src/processors/bot/`, `apps/admin/app/bots/`에서 직접 `z.object(...)` 로 새 타입을 만드는 것을 **금지**.
- 모든 req/res 타입은 `@ai-jakdang/contracts`에서 import.
- 11.2 이후 스토리(11.3~11.18)의 Dev Notes에 "타입은 `@ai-jakdang/contracts`의 bot 스키마만 사용" 규칙이 명시된다.

### 파일 배치·네이밍 규칙

- **파일 위치**: `packages/contracts/src/bot.ts` (단일 파일 — 봇 계약 전체)
- **배럴**: `packages/contracts/src/index.ts` 최하단 추가
- **이름 충돌 방지**: 기존 파일에 `provider`, `purpose`, `status` 등 동일명 enum이 존재할 수 있으므로 모든 export에 `bot` 접두어 사용 (`botProviderSchema`, `botJobStatusSchema` 등)

### Project Structure Notes

- 수정 대상 파일 2개만:
  1. `packages/contracts/src/bot.ts` (신규 생성)
  2. `packages/contracts/src/index.ts` (1줄 추가)
- **다른 파일 건드리지 말 것** — 11.1(스키마)·11.3(서비스) 파일은 각자 스토리가 소유.
- `packages/contracts/package.json`의 빌드 설정·`exports` 필드는 `index.ts` 배럴이 이미 처리하므로 변경 불필요.
- 타입 검사는 `packages/contracts` 루트에서 `pnpm tsc --noEmit` 로 실행한다 (모노레포 루트 `pnpm` 경로: `D:/projects/AIjackdang`; packages는 workspace로 연결됨).

### 참고: 기존 enum 네이밍 사례

- `reportStatusEnum` (`admin/reports.ts`) — `z.enum([...])` 직접 정의
- `sanctionTypeSchema` (`admin/members.ts`) — `z.enum([...])` 직접 정의
- 봇 enum도 동일 패턴 (`z.enum([...])`)으로 정의, 접두어만 `bot` 추가

## References

- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.2] — AC 원문
- [Source: docs/seeding-bot/ARCHITECTURE.md#2-데이터-모델] — 테이블 전체 컬럼 목록 (단일 진실원)
- [Source: docs/seeding-bot/ARCHITECTURE.md#0-설계-원칙] — §0.7 "타입은 packages/contracts(Zod), env는 packages/config 단일 진입점"
- [Source: packages/contracts/src/common.ts] — `paginatedResponseSchema`, `paginationMetaSchema`, `errorResponseSchema` 실제 구현
- [Source: packages/contracts/src/post.ts] — `paginatedPostsSchema = paginatedResponseSchema(postCardSchema)` 목록 응답 패턴
- [Source: packages/contracts/src/admin/members.ts] — 목록 쿼리(`coerce.number`) · 목록 응답(`{items, meta}`) · 단건 상세(직접 페이로드) · CRUD 요청(`.partial()`) 패턴
- [Source: packages/contracts/src/admin/reports.ts] — enum(`z.enum`) 정의·재사용 패턴
- [Source: packages/contracts/src/admin/settings.ts] — key-value flat 설정 스키마 패턴 (botSettingsResponseSchema 참고)
- [Source: packages/contracts/src/admin/gamification.ts] — 접두어(`admin`) 충돌 회피 패턴
- [Source: packages/contracts/src/index.ts] — 배럴 export 구조 및 주석 스타일

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

없음 — typecheck 1회 통과, 수정 없음.

### Completion Notes List

- `packages/contracts/src/bot.ts` 신규 생성: 9개 enum + 10개 단위 도메인 스키마 + 5개 paginated 응답 + 5개 쿼리 파라미터 + 2개 설정 스키마 + 8개 CRUD 요청 스키마. 총 39개 export (스키마 + 추론 타입).
- 모든 enum 값은 `packages/database/src/schema/bot.ts` pgEnum 값과 글자 그대로 일치 확인.
- `botSettingsPatchSchema = botSettingsResponseSchema` 패턴 사용 — 설정 응답과 PATCH 요청이 동일 shape(모두 optional)이므로 재정의 없이 재사용.
- `paginatedResponseSchema` 헬퍼(`common.ts`)를 5개 목록 응답 모두에서 재사용. `errorResponseSchema`는 재정의 없음.
- 쿼리 파라미터 `isActive`·`decided`의 boolean coerce 패턴: `z.enum(["true","false"]).transform(v => v === "true").optional()` — `admin/members.ts` 패턴 준수.
- `pnpm --filter @ai-jakdang/contracts typecheck` → 오류 0건 통과.

### File List

- `packages/contracts/src/bot.ts` (신규 생성)
- `packages/contracts/src/index.ts` (수정: `// ── 시딩 봇 (Epic 11) ──` 주석 + `export * from "./bot"` 추가)

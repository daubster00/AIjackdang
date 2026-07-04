# Story 13.2: 커리큘럼 Zod 계약(contracts)

Status: done

## Story

As a 개발자,
I want `packages/contracts/src/bot-curriculum.ts`에 커리큘럼 도메인의 모든 Zod 스키마와 추론 타입을 정의하고 배럴 export를 등록하기,
so that 관리자 API·worker·admin 전 레이어가 동일한 타입 계약을 import해 사용하며 즉석(inline) 타입 정의가 완전히 제거된다.

## Acceptance Criteria

1. `packages/contracts/src/bot-curriculum.ts` 파일에 enum 스키마 3종 + `z.infer<>` 추론 타입이 정의된다.
   - `curriculumChapterStatusSchema`(챕터 상태): `z.enum(["planned","drafted","ready","published","skipped"])` — `planned`(초안 생성 전)→`drafted`(초안 생성 완료)→`ready`(이미지 슬롯 전부 채워짐)→`published`(실제 게시 완료). `skipped`(건너뜀).
   - `curriculumSlotSourceKindSchema`(슬롯 출처 종류): `z.enum(["ai_diagram","web_download","capture","user_upload"])` — 각각 🟢AI 도식(Gemini 생성)·🟢웹 다운로드(공식문서 curl)·🟡캡처(사람 환경 준비 필요)·🔵사람 직접 업로드.
   - `curriculumSlotStatusSchema`(슬롯 상태): `z.enum(["pending","ready"])` — `pending`(이미지 미준비)·`ready`(이미지 채워짐, 챕터 준비완료 판정 대상).
   - **13.1 정합 필수**: 각 enum 값은 Story 13.1이 `packages/database/src/schema/bot-curriculum.ts`에 정의하는 pgEnum과 **문자열 1:1 정합**. contracts 패키지는 database 패키지를 의존하지 않으므로 Drizzle pgEnum 직접 import 금지 — Zod에서 독립 정의.

2. 같은 파일에 단위 도메인 스키마 5종 + `z.infer<>` 추론 타입이 정의된다.
   - `curriculumImageSlotSchema`(이미지 슬롯): `bot_curriculum_image_slots`(이미지 슬롯 테이블) 전체 컬럼 반영. nullable 컬럼 — `caption`(본문 캡션)·`alt`(대체텍스트)·`guidance`(사람용 상세 안내)·`positionHint`(위치 힌트)·`imageUrl`(버킷 업로드 결과)·`diagramPrompt`(AI 도식 프롬프트)·`sourceUrl`(원본 URL) — 모두 `.nullable()` 적용.
   - `curriculumChapterItemSchema`(챕터 목록 카드): 목록 화면 표시용 요약 (id·seriesId·orderIndex·title·goal·status·scheduledAt·publishedPostId·createdAt·updatedAt) + API 집계 필드 `totalSlots`(슬롯 총 수)·`readySlots`(완료 슬롯 수) 포함.
   - `curriculumChapterDetailSchema`(챕터 상세): `bot_curriculum_chapters`(커리큘럼 챕터 테이블) 전체 컬럼 — `outline`(소주제 배열 jsonb, `z.unknown()`)·`draftContent`(Tiptap 초안 jsonb, `z.unknown().nullable()`)·`draftTextEditable`(사람 수정 텍스트, nullable string) 포함 — + `slots: z.array(curriculumImageSlotSchema)`.
   - `curriculumSeriesItemSchema`(시리즈 목록 카드): 목록 표시용 요약 (id·title·board·tool·intro·isActive·createdAt) + API 집계 필드 `totalChapters`(챕터 총 수)·`publishedChapters`(게시 완료 챕터 수)·`readyChapters`(ready 챕터 수) 포함.
   - `curriculumSeriesDetailSchema`(시리즈 상세): `bot_curriculum_series`(커리큘럼 시리즈 테이블) 전체 컬럼(id·title·board·tool·intro·isActive·createdAt) + `chapters: z.array(curriculumChapterItemSchema)`.

3. 같은 파일에 관리자 API 요청/응답 스키마가 정의된다.
   - **목록 응답 2종**: `paginatedCurriculumSeriesSchema`(시리즈 목록 응답)·`paginatedCurriculumChaptersSchema`(챕터 목록 응답) — 기존 `paginatedResponseSchema`(`{items,meta}` 봉투 헬퍼) 재사용.
   - **쿼리 파라미터 2종**: `adminCurriculumSeriesQuerySchema`(`isActive?`·`page`·`pageSize`)·`adminCurriculumChaptersQuerySchema`(`seriesId?`·`status?`·`page`·`pageSize`) — `z.coerce.number()` 패턴 준수.
   - **CRUD 요청 6종**: `curriculumSeriesCreateSchema`(시리즈 생성)·`curriculumSeriesUpdateSchema`(시리즈 수정, `.partial()`)·`curriculumChapterDraftUpdateSchema`(초안 본문 수정 PATCH)·`curriculumChapterScheduleSchema`(예약시각 지정 PATCH)·`curriculumSlotFillSchema`(슬롯 완료 처리 PATCH)·`curriculumSlotGenerateSchema`(🟢 자동 생성 요청 POST).
   - **단건 응답**: 봉투(`{data: ...}`) 없이 직접 페이로드 반환(기존 관례). 오류 응답: `errorResponseSchema`(오류 응답 스키마) 재사용(재정의 금지).

4. 같은 파일에 BullMQ 잡 페이로드 스키마 2종 + 추론 타입이 정의된다.
   - `botCurriculumDraftJobSchema`(`bot.curriculum-draft`(커리큘럼 초안 생성 잡)): `{chapterId: uuid, seriesId: uuid}` — Story 13.3이 소비.
   - `botCurriculumPublishJobSchema`(`bot.curriculum-publish`(예약 게시 스캔 잡)): `{chapterId?: uuid}` — 미지정 시 전체 ready 챕터 스캔. Story 13.6이 기존 단일 `bot` 큐 디스패처에 이 `job.name`(잡 이름)을 추가한다.

5. `packages/contracts/src/index.ts`(배럴 export 파일) 최하단에 `// ── 커리큘럼 (Epic 13) ──` 주석과 함께 `export * from "./bot-curriculum"` 한 줄이 추가된다. 기존 `export * from "./bot"` export와 이름 충돌 없음 — 도메인 스키마는 `curriculum` 접두어, BullMQ 잡 스키마는 `botCurriculum` 접두어로 충돌 방지.

6. `packages/contracts`에서 `pnpm tsc --noEmit` 검사가 통과한다. 기존 `paginatedResponseSchema`·`paginationMetaSchema`·`errorResponseSchema`는 재사용만, `bot-curriculum.ts` 내부에서 동일 구조 재정의 금지.

7. `bot-curriculum.ts` 파일 상단 한국어 주석에 사용 범위(API `/api/v1/admin/bots/curriculum/*` · admin `apps/admin/app/bots/curriculum/` · worker `bot.curriculum-draft`·`bot.curriculum-publish`) + 단일 진실원 원칙 + "enum 값은 13.1 pgEnum과 문자열 정합" + "즉석 타입 정의 금지" 명시.

## Tasks / Subtasks

- [ ] Task 1: enum 스키마 3종 정의 (AC: 1)
  - [ ] `curriculumChapterStatusSchema`(챕터 상태) — `z.enum(["planned","drafted","ready","published","skipped"])` + `CurriculumChapterStatus` 타입 export
  - [ ] `curriculumSlotSourceKindSchema`(슬롯 출처 종류) — `z.enum(["ai_diagram","web_download","capture","user_upload"])` + `CurriculumSlotSourceKind` 타입 export
  - [ ] `curriculumSlotStatusSchema`(슬롯 상태) — `z.enum(["pending","ready"])` + `CurriculumSlotStatus` 타입 export
  - [ ] 13.1이 정의한 pgEnum 값 목록과 대조해 문자열 1:1 정합 확인(착수 시점에 13.1이 완료됐으면 DB 스키마 직접 확인, 미완이면 설계문서 §4 기준)

- [ ] Task 2: 단위 도메인 스키마 5종 정의 (AC: 2)
  - [ ] `curriculumImageSlotSchema`(이미지 슬롯) 정의
    - `id`·`chapterId`·`assetKey`(마커 매칭 키)·`sourceKind`·`status` — non-nullable
    - `caption`·`alt`·`guidance`·`positionHint`·`imageUrl`·`diagramPrompt`·`sourceUrl` — `.nullable()`
    - `createdAt`·`updatedAt` — string
    - `CurriculumImageSlot` 타입 export
  - [ ] `curriculumChapterItemSchema`(챕터 목록 카드) 정의
    - `id`·`seriesId`·`orderIndex`·`title`·`goal`·`status` — non-nullable
    - `scheduledAt`·`publishedPostId` — `.nullable()`
    - `totalSlots`·`readySlots` — `z.number().int()` (API 집계값)
    - `createdAt`·`updatedAt` — string
    - `CurriculumChapterItem` 타입 export
  - [ ] `curriculumChapterDetailSchema`(챕터 상세) 정의
    - 위 항목 전체 + `outline`(`z.unknown()`)·`draftContent`(`z.unknown().nullable()`)·`draftTextEditable`(`z.string().nullable()`)
    - `slots: z.array(curriculumImageSlotSchema)` 포함
    - `CurriculumChapterDetail` 타입 export
  - [ ] `curriculumSeriesItemSchema`(시리즈 목록 카드) 정의
    - `id`·`title`·`board`·`tool`·`isActive`·`createdAt` — non-nullable
    - `intro` — `.nullable()`
    - `totalChapters`·`publishedChapters`·`readyChapters` — `z.number().int()` (API 집계값)
    - `CurriculumSeriesItem` 타입 export
  - [ ] `curriculumSeriesDetailSchema`(시리즈 상세) 정의
    - `id`·`title`·`board`·`tool`·`isActive`·`createdAt` — non-nullable
    - `intro` — `.nullable()`
    - `chapters: z.array(curriculumChapterItemSchema)` 포함
    - `CurriculumSeriesDetail` 타입 export

- [ ] Task 3: 목록 응답 + 쿼리 파라미터 스키마 정의 (AC: 3)
  - [ ] `paginatedCurriculumSeriesSchema`(시리즈 목록 응답) — `paginatedResponseSchema(curriculumSeriesItemSchema)` 재사용 + `PaginatedCurriculumSeries` 타입 export
  - [ ] `paginatedCurriculumChaptersSchema`(챕터 목록 응답) — `paginatedResponseSchema(curriculumChapterItemSchema)` 재사용 + `PaginatedCurriculumChapters` 타입 export
  - [ ] `adminCurriculumSeriesQuerySchema`(시리즈 목록 쿼리) 정의
    - `isActive`: `z.enum(["true","false"]).transform(v => v === "true").optional()`
    - `page`: `z.coerce.number().int().min(1).default(1)`
    - `pageSize`: `z.coerce.number().int().min(1).max(100).default(20)`
    - `AdminCurriculumSeriesQuery` 타입 export
  - [ ] `adminCurriculumChaptersQuerySchema`(챕터 목록 쿼리) 정의
    - `seriesId`: `z.string().uuid().optional()`
    - `status`: `curriculumChapterStatusSchema.optional()`
    - `page`·`pageSize`: coerce 패턴 동일
    - `AdminCurriculumChaptersQuery` 타입 export

- [ ] Task 4: CRUD 요청 스키마 6종 정의 (AC: 3)
  - [ ] `curriculumSeriesCreateSchema`(시리즈 생성) — `{title: string.min(1), board: string.min(1), tool: string.min(1), intro?: string, isActive?: boolean}` + `CurriculumSeriesCreate` 타입 export
  - [ ] `curriculumSeriesUpdateSchema`(시리즈 수정) — `curriculumSeriesCreateSchema.partial()` + `CurriculumSeriesUpdate` 타입 export
  - [ ] `curriculumChapterDraftUpdateSchema`(초안 본문 수정) — `{draftContent: z.unknown(), draftTextEditable?: z.string()}` + `CurriculumChapterDraftUpdate` 타입 export
  - [ ] `curriculumChapterScheduleSchema`(예약시각 지정) — `{scheduledAt: z.string().nullable()}` (ISO 8601 timestamptz 또는 null=예약 취소) + `CurriculumChapterSchedule` 타입 export
  - [ ] `curriculumSlotFillSchema`(슬롯 완료 처리) — `{imageUrl: z.string().url(), sourceUrl?: z.string()}` (버킷에 업로드된 URL 기입 + 슬롯 `ready` 전환) + `CurriculumSlotFill` 타입 export
  - [ ] `curriculumSlotGenerateSchema`(🟢 자동 생성 요청) — `{force?: z.boolean(), imageModel?: z.object({ provider: z.string().min(1), model: z.string().min(1) }), diagramPrompt?: z.string()}` (`diagramPrompt`는 `ai_diagram` 슬롯의 일회성 프롬프트 override, 미지정 시 슬롯 `diagramPrompt` 사용) + `CurriculumSlotGenerate` 타입 export

- [ ] Task 5: BullMQ 잡 페이로드 스키마 2종 정의 (AC: 4)
  - [ ] `botCurriculumDraftJobSchema`(`bot.curriculum-draft` 잡) — `{chapterId: z.string().uuid(), seriesId: z.string().uuid()}` + `BotCurriculumDraftJobPayload` 타입 export
  - [ ] `botCurriculumPublishJobSchema`(`bot.curriculum-publish` 잡) — `{chapterId: z.string().uuid().optional()}` + `BotCurriculumPublishJobPayload` 타입 export

- [ ] Task 6: 파일 상단 주석 작성 (AC: 7)
  - [ ] 사용 범위: API `apps/api/src/routes/admin/bots/curriculum/`(13.5)·admin `apps/admin/app/bots/curriculum/`(13.5)·worker `apps/worker/src/processors/bot/`(13.3·13.6) 명시
  - [ ] 단일 진실원 원칙: "커리큘럼 도메인 타입은 이 파일에서만 정의, 즉석 `z.object(...)` 정의 금지" 명시
  - [ ] enum 정합 선언: "enum 값은 13.1 `packages/database/src/schema/bot-curriculum.ts` pgEnum과 문자열 1:1 정합" 명시

- [ ] Task 7: 배럴 export 등록 (AC: 5)
  - [ ] `packages/contracts/src/index.ts` 파일 열기
  - [ ] 기존 `// ── 시딩 봇 (Epic 11) ──` 블록 아래(또는 파일 최하단)에 `// ── 커리큘럼 (Epic 13) ──` 주석 + `export * from "./bot-curriculum"` 추가
  - [ ] 기존 export와 이름 충돌 여부 확인(tsc로 검증)

- [ ] Task 8: 타입 검사 통과 확인 (AC: 6)
  - [ ] `packages/contracts` 루트에서 `pnpm --filter @ai-jakdang/contracts tsc --noEmit` 실행
  - [ ] `curriculum` 접두어 export가 기존 `bot.ts` export와 충돌하지 않음 확인
  - [ ] 오류 있으면 수정 후 재실행

## Dev Notes

### 핵심 패턴 — 반드시 준수

**1. 공용 헬퍼 import 패턴** (`packages/contracts/src/common.ts` 실코드 기준):
```ts
import { z } from "zod";
import { paginatedResponseSchema, errorResponseSchema } from "./common";
// errorResponseSchema(오류 응답 스키마)는 재정의 금지 — 재사용만.
```

**2. 목록 응답 봉투 패턴** (`paginatedResponseSchema`(페이지네이션 응답 헬퍼) 재사용):
```ts
export const paginatedCurriculumSeriesSchema = paginatedResponseSchema(curriculumSeriesItemSchema);
export type PaginatedCurriculumSeries = z.infer<typeof paginatedCurriculumSeriesSchema>;
// → 결과: { items: CurriculumSeriesItem[], meta: { page, pageSize, totalItems, totalPages } }
```

**3. 단건 상세 응답** — 봉투(`{data: ...}`) 없이 직접 페이로드(기존 관례):
```ts
// 라우트에서: reply.send(detail)  ← {data: detail} 아님
export const curriculumSeriesDetailSchema = z.object({ ... });
export type CurriculumSeriesDetail = z.infer<typeof curriculumSeriesDetailSchema>;
```

**4. 쿼리 파라미터 coerce 패턴** (기존 `admin/members.ts` 기준):
```ts
export const adminCurriculumSeriesQuerySchema = z.object({
  isActive: z.enum(["true", "false"]).transform(v => v === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
```

**5. nullable 컬럼 처리**:
```ts
imageUrl: z.string().nullable(),        // 버킷 업로드 결과 — 이미지 준비 전 null
diagramPrompt: z.string().nullable(),   // ai_diagram 슬롯에만 있음, 나머지는 null
intro: z.string().nullable(),           // 시리즈 한 줄 소개 — 없을 수 있음
scheduledAt: z.string().nullable(),     // 예약 시각 — 미예약 시 null
publishedPostId: z.string().uuid().nullable(), // 게시 결과 — published 전 null
```

**6. jsonb 필드 처리** — `outline`(소주제 배열)·`draftContent`(Tiptap 초안) 구조 유동적이므로 `z.unknown()`:
```ts
outline: z.unknown(),                   // 소주제 배열 jsonb — 구조 고정 불가
draftContent: z.unknown().nullable(),   // Tiptap JSON 초안 — 생성 전 null
```

**7. contracts → database 단방향 의존 금지**:
```ts
// ❌ 금지: packages/database 의존
// import { curriculumChapterStatus } from "../../database/schema/bot";

// ✅ 올바름: Zod에서 독립 정의 (값은 13.1 pgEnum과 문자열 정합)
export const curriculumChapterStatusSchema = z.enum([
  "planned", "drafted", "ready", "published", "skipped"
]);
```

### 설계문서 §4 필드와 스키마 1:1 정합 체크포인트

| §4 테이블 | DB 컬럼 (snake_case) | contracts 스키마 필드 (camelCase) | 비고 |
|---|---|---|---|
| `bot_curriculum_series` | `title` | `title` | string |
| `bot_curriculum_series` | `board`(대상 게시판 슬러그) | `board` | string |
| `bot_curriculum_series` | `tool`(주력 도구명) | `tool` | string |
| `bot_curriculum_series` | `intro`(한 줄 소개) | `intro` | nullable |
| `bot_curriculum_series` | `is_active` | `isActive` | boolean |
| `bot_curriculum_chapters` | `series_id` | `seriesId` | FK uuid |
| `bot_curriculum_chapters` | `order_index`(1-based 순서) | `orderIndex` | int |
| `bot_curriculum_chapters` | `goal`(학습목표) | `goal` | string |
| `bot_curriculum_chapters` | `outline`(소주제 배열 jsonb) | `outline` | z.unknown() |
| `bot_curriculum_chapters` | `draft_content`(Tiptap 초안 jsonb) | `draftContent` | z.unknown().nullable() |
| `bot_curriculum_chapters` | `draft_text_editable`(사람 수정 텍스트) | `draftTextEditable` | nullable string |
| `bot_curriculum_chapters` | `status` | `status` | curriculumChapterStatusSchema |
| `bot_curriculum_chapters` | `scheduled_at`(챕터별 예약 게시 시각) | `scheduledAt` | nullable string(ISO 8601) |
| `bot_curriculum_chapters` | `published_post_id`(게시 결과 포스트 uuid) | `publishedPostId` | nullable uuid (크로스도메인 FK 미설정) |
| `bot_curriculum_image_slots` | `chapter_id` | `chapterId` | FK uuid |
| `bot_curriculum_image_slots` | `asset_key`(본문 마커 `[[IMG:키]]` 매칭 키) | `assetKey` | 챕터 내 유일 |
| `bot_curriculum_image_slots` | `caption`(본문 캡션) | `caption` | nullable |
| `bot_curriculum_image_slots` | `alt`(대체 텍스트) | `alt` | nullable |
| `bot_curriculum_image_slots` | `guidance`(사람용 상세 안내) | `guidance` | nullable |
| `bot_curriculum_image_slots` | `position_hint`(대략 위치 힌트) | `positionHint` | nullable |
| `bot_curriculum_image_slots` | `source_kind`(슬롯 출처 종류) | `sourceKind` | curriculumSlotSourceKindSchema |
| `bot_curriculum_image_slots` | `status`(슬롯 상태) | `status` | curriculumSlotStatusSchema |
| `bot_curriculum_image_slots` | `image_url`(버킷 업로드 결과) | `imageUrl` | nullable |
| `bot_curriculum_image_slots` | `diagram_prompt`(AI 도식 프롬프트) | `diagramPrompt` | nullable — `ai_diagram` 슬롯용 |
| `bot_curriculum_image_slots` | `source_url`(원본 URL) | `sourceUrl` | nullable — `web_download`·`capture` 슬롯용 |

> **13.1과 정합 원칙**: 13.1 스키마 구현 전이라도 **설계문서 §4를 단일 진실원**으로 삼는다. 13.1 구현 후 컬럼명 diff가 생기면 이 파일도 함께 수정.

### 집계 필드(API 계산값) vs DB 컬럼 구분

아래 필드들은 DB에 컬럼으로 저장되지 않고 **Story 13.5(API 구현)가 JOIN/COUNT로 계산해 응답에 추가**하는 값이다. contracts 스키마에서는 단순 `z.number().int()` 정의로 충분하다.

| 스키마 | 집계 필드 | 계산 원천 |
|---|---|---|
| `curriculumSeriesItemSchema` | `totalChapters`(챕터 총 수)·`publishedChapters`(게시 완료 챕터 수)·`readyChapters`(ready 챕터 수) | `bot_curriculum_chapters` COUNT |
| `curriculumChapterItemSchema` | `totalSlots`(슬롯 총 수)·`readySlots`(완료 슬롯 수) | `bot_curriculum_image_slots` COUNT |

### API 즉석 타입 정의 금지 가드레일

- `apps/api/src/routes/admin/bots/curriculum/`(Story 13.5에서 생성)
- `apps/admin/app/bots/curriculum/`(Story 13.5 admin UI)
- `apps/worker/src/processors/bot/`(Story 13.3·13.6 워커)

위 경로에서 `z.object(...)` 직접 타입 정의 **금지**. 모든 req/res 타입은 `@ai-jakdang/contracts`에서 import.

### 파일 배치·네이밍 규칙

- **파일 위치**: `packages/contracts/src/bot-curriculum.ts` (신규 단일 파일 — 커리큘럼 계약 전체)
- **배럴**: `packages/contracts/src/index.ts` — 기존 `// ── 시딩 봇 (Epic 11) ──` 블록 아래 `// ── 커리큘럼 (Epic 13) ──` 추가
- **이름 충돌 방지**: 기존 `bot.ts`에 `botProviderSchema`·`botJobStatusSchema`·`botActivityEventTypeSchema` 등이 있으므로 커리큘럼 도메인 스키마 전체에 `curriculum` 접두어 사용 (`curriculumChapterStatusSchema`·`curriculumImageSlotSchema` 등). BullMQ 잡 페이로드만 큐 네임 일관성을 위해 `botCurriculum` 접두어 사용 (`botCurriculumDraftJobSchema`·`botCurriculumPublishJobSchema`).

### Project Structure Notes

수정 대상 파일 2개만:
1. `packages/contracts/src/bot-curriculum.ts` (신규 생성)
2. `packages/contracts/src/index.ts` (1줄 추가)

다른 파일 건드리지 말 것:
- `packages/contracts/src/bot.ts` — Epic 11 봇 계약 (완료, 수정 불필요)
- `packages/contracts/src/common.ts` — 공용 헬퍼 (수정 불필요)
- `packages/database/src/schema/bot-curriculum.ts` — Story 13.1 소유 (DB 스키마 정의)

타입 검사: `pnpm --filter @ai-jakdang/contracts tsc --noEmit` (모노레포 루트 `D:/projects/AIjackdang`에서 실행 가능).

## References

- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-13.2] — AC 원문 (시리즈·챕터·이미지슬롯 스키마 + 관리자 요청/응답 + 배럴 export)
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#4-데이터-모델] — 테이블 3종 전체 컬럼 목록 (단일 진실원)
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#5-관리자-커리큘럼-플랜-UI] — 관리자 API 경로(`/api/v1/admin/bots/curriculum/*`) + 챕터 상세 필요 필드
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#3-이미지-슬롯-3+1-분류] — `source_kind`(슬롯 출처 종류) 분류·배지 색 + 슬롯 상태 흐름(`pending`→`ready`)
- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-13.1] — pgEnum 3종 값 목록 참조 (정합 근거)
- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-13.3] — `bot.curriculum-draft`(초안 생성 잡) 사용 컨텍스트
- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-13.6] — `bot.curriculum-publish`(예약 게시 스캔 잡) 사용 컨텍스트 + "기존 단일 bot 큐 디스패처에 추가" 원칙
- [Source: packages/contracts/src/common.ts] — `paginatedResponseSchema`, `paginationMetaSchema`, `errorResponseSchema` 실제 구현
- [Source: packages/contracts/src/bot.ts] — 기존 봇 계약 패턴 전체 참고 (enum·단위도메인·paginated·쿼리·CRUD·BullMQ 잡 페이로드 형식)
- [Source: packages/contracts/src/index.ts] — 배럴 export 구조 및 Epic별 주석 스타일
- [Source: _bmad-output/implementation-artifacts/11-2-bot-zod-contracts.md] — 같은 성격의 계약 스토리 형식·깊이 참조

## Dev Agent Record

### Agent Model Used

(미기입 — 착수 시 기입)

### Debug Log References

(미기입)

### Completion Notes List

(미기입)

### File List

(미기입)

# Story 13.1: 커리큘럼 DB 스키마 + `curriculum.ts` 시드 이관

Status: done

## Story

As a 개발자,
I want 관리자 가이드 강의 커리큘럼을 코드 파일 + jsonb가 아닌 정식 DB 테이블(`bot_curriculum_series`(시리즈 헤더)·`bot_curriculum_chapters`(편)·`bot_curriculum_image_slots`(이미지 슬롯))로 승격하고, 기존 `curriculum.ts`(두 시리즈×5강) 데이터를 멱등 시드 스크립트로 테이블에 이식하기,
So that 관리자가 챕터·이미지 슬롯을 CRUD하고 상태를 추적할 수 있는 기반이 만들어지며, 이후 스테이징·예약 게시·관리자 UI(Epic 13 후속 스토리)가 이 테이블 위에서 동작한다.

## Acceptance Criteria

1. `packages/database/src/schema/bot-curriculum.ts` 신규 생성 — 설계문서(GUIDE-CURRICULUM-AND-IMAGE-MODES.md) §4에 명시된 3개 테이블(`bot_curriculum_series`, `bot_curriculum_chapters`, `bot_curriculum_image_slots`)과 3개 pgEnum(`botCurriculumChapterStatus`(챕터 수명주기 상태) = `planned|drafted|ready|published|skipped`, `botCurriculumSlotSourceKind`(슬롯 이미지 출처 종류) = `ai_diagram|web_download|capture|user_upload`, `botCurriculumSlotStatus`(슬롯 준비 상태) = `pending|ready`) 전체 포함. `bot_curriculum_chapters`에는 설계문서 §4 컬럼 외에 `continuity_summary`(연속성용 요약 텍스트) 컬럼 추가(Dev Notes — guide_progress 매핑 참조). `bot_curriculum_image_slots`에는 `(chapter_id, asset_key)` unique 제약 설정(챕터 내 assetKey(이미지 자산 키) 유일 보장).
2. `pnpm --filter @ai-jakdang/database drizzle-kit generate` 실행으로 **새 마이그레이션 파일 1개 생성**. **번호 고정 금지** — `packages/database/migrations/meta/_journal.json` 최신 entry idx 확인 후(현재 `0031_admin_cols_reconcile`) 그 다음 번호(`0032_*`)로 drizzle이 자동 부여. 커리큘럼 스키마 변경(3 테이블 + 3 enum)만 포함, 타 세션 변경 혼입 금지. `pnpm --filter @ai-jakdang/database drizzle-kit migrate` 성공 후 DB에서 3개 테이블 존재 확인.
3. `packages/database/src/schema/index.ts` 배럴에 `// ── Epic 13: 가이드 커리큘럼 ──` 섹션 아래 `export * from "./bot-curriculum"` 추가. `@ai-jakdang/database`에서 `botCurriculumSeries`, `botCurriculumChapters`, `botCurriculumImageSlots` 및 관련 타입 re-export 확인.
4. `apps/api/src/scripts/seed-curriculum.ts` 신규 생성 — `apps/api/src/services/bot/curriculum.ts`의 `GUIDE_SERIES`(두 시리즈×5강×총 10 슬롯)를 읽어 3개 테이블에 멱등(ON CONFLICT DO NOTHING 또는 ON CONFLICT DO UPDATE) 삽입. 실행 시 결과 로그 출력.
5. 시드 스크립트가 `bot_settings WHERE key = 'guide_asset_manifest'`(가이드 이미지 URL 매니페스트) 값이 존재하면 각 슬롯의 `assetKey`(이미지 자산 키)를 매니페스트에서 조회해 `image_url`(버킷 URL)을 이식하고 슬롯 `status`를 `ready`로 갱신. 매니페스트가 없거나 해당 키가 없으면 `image_url = null`, `status = pending` 유지.
6. 시드 스크립트가 `bot_settings WHERE key = 'guide_progress'`(시리즈별 발행 편·요약 맵) 값이 존재하면 `published[]`(발행 완료 편 번호 배열)에 포함된 챕터를 `status = 'published'`로, `summaries[String(order)]`(편별 연속성 요약)를 챕터 `continuity_summary`(연속성 요약)에 이식. 값이 없으면 초기 `status = 'planned'` 유지.

## Tasks / Subtasks

- [ ] Task 1: `packages/database/src/schema/bot-curriculum.ts` 신규 생성 (AC: #1)
  - [ ] 파일 상단 JSDoc 주석 작성 (Epic 13 커리큘럼 스키마, 설계문서 §4 참조)
  - [ ] pgEnum 3종 정의:
    - `botCurriculumChapterStatus`(챕터 수명주기 상태): `"planned" | "drafted" | "ready" | "published" | "skipped"`
    - `botCurriculumSlotSourceKind`(슬롯 이미지 출처 종류): `"ai_diagram" | "web_download" | "capture" | "user_upload"`
    - `botCurriculumSlotStatus`(슬롯 준비 상태): `"pending" | "ready"`
  - [ ] `botCurriculumSeries` 테이블 정의 (다른 테이블이 `series_id`로 FK 참조하므로 **가장 먼저 정의**):
    - `id` uuid PK `.defaultRandom()`
    - `title`(표시·식별 제목) text NOT NULL
    - `board`(대상 게시판 슬러그) text NOT NULL
    - `tool`(주력 도구명) text NOT NULL
    - `intro`(한 줄 소개) text NOT NULL
    - `isActive`(활성 여부) boolean NOT NULL DEFAULT true
    - `createdAt`(생성 시각) timestamptz NOT NULL `.defaultNow()`
  - [ ] `botCurriculumChapters` 테이블 정의 (`series_id` FK → `botCurriculumSeries.id`, onDelete: "cascade"):
    - `id` uuid PK `.defaultRandom()`
    - `seriesId`(시리즈 FK) uuid NOT NULL FK
    - `orderIndex`(1-based 편 번호) integer NOT NULL
    - `title`(편 소제목) text NOT NULL
    - `goal`(학습목표) text NOT NULL
    - `outline`(소주제 배열) jsonb NOT NULL DEFAULT `'[]'`
    - `draftContent`(Tiptap JSON 초안, 생성 전 null) jsonb
    - `draftTextEditable`(사람이 수정한 본문 텍스트) text
    - `continuitySummary`(연속성 요약, 다음 편 프롬프트 주입용) text — Dev Notes 참조
    - `status`(챕터 수명주기 상태) `botCurriculumChapterStatus` NOT NULL DEFAULT `'planned'`
    - `scheduledAt`(챕터별 예약 게시 시각, null=미예약) timestamptz
    - `publishedPostId`(게시 결과 포스트 ID, FK 미설정 — 크로스도메인) uuid
    - `createdAt` timestamptz NOT NULL `.defaultNow()`
    - `updatedAt` timestamptz NOT NULL `.defaultNow()`
    - unique constraint: `(series_id, order_index)` — 시리즈 내 편 번호 중복 방지
  - [ ] `botCurriculumImageSlots` 테이블 정의 (`chapter_id` FK → `botCurriculumChapters.id`, onDelete: "cascade"):
    - `id` uuid PK `.defaultRandom()`
    - `chapterId`(챕터 FK) uuid NOT NULL FK
    - `assetKey`(본문 `[[IMG:키]]` 매칭용 전역 유일 키) text NOT NULL
    - `caption`(본문 캡션) text NOT NULL
    - `alt`(이미지 대체 텍스트) text NOT NULL
    - `guidance`(관리자용 상세 준비 안내) text — 어떤 이미지를 어떻게 준비하는지
    - `positionHint`(대략 어느 설명 옆에 배치되는지, 선택) text
    - `sourceKind`(이미지 출처 종류) `botCurriculumSlotSourceKind` NOT NULL
    - `status`(슬롯 준비 상태) `botCurriculumSlotStatus` NOT NULL DEFAULT `'pending'`
    - `imageUrl`(버킷 업로드 URL, 준비 전 null) text
    - `diagramPrompt`(ai_diagram용 이미지 생성 프롬프트) text
    - `sourceUrl`(web_download/capture 원본 URL) text
    - `createdAt` timestamptz NOT NULL `.defaultNow()`
    - `updatedAt` timestamptz NOT NULL `.defaultNow()`
    - unique constraint: `(chapter_id, asset_key)` — 챕터 내 assetKey 중복 방지
  - [ ] 각 테이블 `$inferSelect` / `$inferInsert` 타입 export

- [ ] Task 2: 배럴 export 추가 (AC: #3)
  - [ ] `packages/database/src/schema/index.ts`에 `// ── Epic 11: 시딩 봇 ──` 섹션 **아래**에 `// ── Epic 13: 가이드 커리큘럼 ──` 섹션 신설 후 `export * from "./bot-curriculum"` 추가
  - [ ] `pnpm --filter @ai-jakdang/database tsc --noEmit`로 타입 export 이상 없음 확인

- [ ] Task 3: 마이그레이션 생성 및 실행 (AC: #2)
  - [ ] **생성 전** `packages/database/migrations/meta/_journal.json` 마지막 entry 확인 — 현재 `idx: 31 / tag: "0031_admin_cols_reconcile"`. 다음은 `0032_*` 번호가 자동 부여됨
  - [ ] `git status packages/database/src/schema/` 확인 — 커리큘럼 스키마 변경 외 다른 파일 변경 없어야 함(타 세션 혼입 방지)
  - [ ] `pnpm --filter @ai-jakdang/database drizzle-kit generate` 실행
  - [ ] 생성된 SQL 파일 내용 검토 — `CREATE TYPE bot_curriculum_chapter_status`, `CREATE TYPE bot_curriculum_slot_source_kind`, `CREATE TYPE bot_curriculum_slot_status`, `CREATE TABLE bot_curriculum_series`, `CREATE TABLE bot_curriculum_chapters`, `CREATE TABLE bot_curriculum_image_slots` 만 포함, 타 DDL 없음 확인
  - [ ] `DATABASE_URL=postgresql://... pnpm --filter @ai-jakdang/database drizzle-kit migrate` 실행 (Dev Notes — DATABASE_URL 주의 참조)
  - [ ] psql 또는 drizzle studio에서 3개 테이블 생성 확인

- [ ] Task 4: 멱등 시드 스크립트 작성 (AC: #4, #5, #6)
  - [ ] `apps/api/src/scripts/seed-curriculum.ts` 신규 생성
  - [ ] `GUIDE_SERIES`(`apps/api/src/services/bot/curriculum.ts`) import — **curriculum.ts 원본 파일은 수정하지 않음**(post-pipeline.ts가 계속 참조, Story 13.3 이후 분리)
  - [ ] 시리즈 삽입: `botCurriculumSeries` ON CONFLICT(title) DO NOTHING (또는 upsert)
  - [ ] 챕터 삽입: `botCurriculumChapters` ON CONFLICT(series_id, order_index) DO NOTHING
  - [ ] 이미지 슬롯 삽입: 각 `GuideImageSlot`(이미지 슬롯 정의)를 아래 매핑 규칙으로 변환 후 `botCurriculumImageSlots` ON CONFLICT(chapter_id, asset_key) DO NOTHING:
    - `kind: "diagram"` → `sourceKind = "ai_diagram"`, `diagramPrompt` 이식, `guidance` = `"AI 도식 생성. 프롬프트: {diagramPrompt}"`
    - `kind: "screenshot"` + `sourceUrl` 존재 → `sourceKind = "web_download"`, `sourceUrl` 이식, `guidance` = `"공식문서 이미지 다운로드. 출처: {sourceLabel}({sourcePageUrl}). 원본: {sourceUrl}"`
  - [ ] `bot_settings WHERE key = 'guide_asset_manifest'` 조회 → 각 슬롯 `assetKey`(이미지 자산 키)에 매핑되는 `url` 있으면 `imageUrl` + `status = 'ready'` UPDATE
  - [ ] `bot_settings WHERE key = 'guide_progress'` 조회 → 발행 편은 챕터 `status = 'published'`, `summaries[N]` 있으면 `continuitySummary` UPDATE
  - [ ] 실행 완료 후 삽입 건수 로그 출력(`series N건, chapters N건, slots N건`)
  - [ ] 실행 방법: `tsx apps/api/src/scripts/seed-curriculum.ts` (기존 스크립트들과 동일 패턴, DATABASE_URL 주입 필요)

- [ ] Task 5: TypeScript 타입 검사 통과 (AC: 전체)
  - [ ] `pnpm --filter @ai-jakdang/database tsc --noEmit` 통과
  - [ ] `pnpm --filter @ai-jakdang/api tsc --noEmit` 통과 (시드 스크립트 포함)
  - [ ] `bot-curriculum.ts` 내부 forward reference 없음 확인 (정의 순서: `botCurriculumSeries` → `botCurriculumChapters` → `botCurriculumImageSlots`)

## Dev Notes

### 아키텍처 가드레일

- **이 스토리의 범위**: 스키마 정의·마이그레이션·초기 시드만. 관리자 API·UI(Story 13.5), 스테이징 파이프라인(Story 13.3), 스케줄러(Story 13.6)는 후속 스토리.
- **DB 직접 INSERT 금지 원칙**: 시드 스크립트 자체가 초기화 INSERT이므로 예외 허용. 단, 시드 외 모든 쓰기는 도메인 서비스 경유.
- **`curriculum.ts` 삭제 금지**: `apps/api/src/services/bot/post-pipeline.ts`가 `getGuideSeriesForBoard`를 정적 import. Story 13.3에서 DB 조회로 교체될 때까지 원본 파일은 건드리지 않는다.
- **DB 접근 경계**: `packages/database`는 `apps/api`·`apps/worker`에서만 Drizzle import. `apps/web`·`apps/admin`에서 직접 import 금지. [Source: docs/seeding-bot/ARCHITECTURE.md#0]
- **크로스도메인 FK 미설정 원칙**: `chapters.published_post_id`(게시 결과 포스트 ID)는 `posts.id`를 가리키지만 FK 설정하지 않는다. 기존 `bot_hold_queue.decided_by`·`bot_activity_log.target_post_id`와 동일 패턴. [Source: packages/database/src/schema/bot.ts]

### enum 명명 패턴

기존 `bot.ts`의 enum(예: `botAiProvider`(AI 프로바이더), `botJobStatus`(잡 상태))과 동일하게 camelCase 변수명 + snake_case DB 타입명 패턴을 유지한다. 커리큘럼 전용 enum에는 `botCurriculum` 접두사를 붙여 기존 봇 enum과 구분한다.

```ts
// 패턴 예시
export const botCurriculumChapterStatus = pgEnum(
  "bot_curriculum_chapter_status",
  ["planned", "drafted", "ready", "published", "skipped"]
);
```

contracts 패키지(Story 13.2)에서 Zod로 재정의할 때 Drizzle enum을 직접 import하지 않는다(contracts는 database에 의존하지 않음).

### `bot_curriculum_chapters` — `continuity_summary` 컬럼 추가 이유

설계문서 §4가 나열한 컬럼 외에 `continuity_summary`(연속성 요약 텍스트) 컬럼을 추가한다. 이는 프로토타입의 `bot_settings.guide_progress`(시리즈별 발행 편·요약) jsonb 중 **`summaries[String(order)]`(편별 연속성 요약)를 챕터 레코드로 이관**하기 위함이다. 다음 편 생성 시 앞편 요약이 프롬프트에 주입되는데(연속성 보장), 이 값이 챕터 자체에 붙어있어야 Story 13.3 스테이징 파이프라인이 DB만 읽어 연속성을 구성할 수 있다.

| 프로토타입 jsonb | 신규 DB 컬럼 | 타입 |
|---|---|---|
| `guide_progress[title].published.includes(order)` | `chapters.status = 'published'` | `botCurriculumChapterStatus` |
| `guide_progress[title].summaries[String(order)]` | `chapters.continuity_summary` | text (nullable) |
| `guide_asset_manifest[assetKey].url` | `image_slots.image_url` | text (nullable) |

이 매핑은 시드 스크립트(Task 4)에서 실제 이식을 수행한다. 프로토타입 jsonb는 시드 완료 후에도 삭제하지 않는다(롤백 안전망, Story 13.3에서 해당 경로를 제거하면서 정리).

### `bot_curriculum_image_slots` — `source_kind` 매핑 규칙

`curriculum.ts`의 `GuideImageSlot.kind`(이미지 슬롯 종류)와 신규 `source_kind`(이미지 출처 종류) enum의 매핑:

| `curriculum.ts` `kind` | 조건 | 신규 `source_kind` | 비고 |
|---|---|---|---|
| `"diagram"` | — | `"ai_diagram"` | Gemini `genImage` 자동 생성 |
| `"screenshot"` | `sourceUrl` 공개 S3/CDN URL 있음 | `"web_download"` | `curl` 다운로드 가능 |
| `"screenshot"` | `sourceUrl` 없음 또는 로그인 필요 | `"capture"` | Playwright/PowerShell 캡처 |

현재 `GUIDE_SERIES`(두 시리즈×5강) 중 `kind: "screenshot"`인 슬롯은 `make-first-scenario`(Make 첫 시나리오 화면) 1개뿐이며, `sourceUrl`이 공개 S3(`archbee-image-uploads.s3.amazonaws.com`)로 설정되어 있으므로 `source_kind = "web_download"` 매핑. 나머지 9개는 모두 `ai_diagram`.

### `guidance`(관리자용 상세 안내) 자동 생성 규칙

슬롯 `guidance`(관리자용 상세 준비 안내)는 시드 스크립트에서 `source_kind`별로 아래 패턴으로 자동 생성한다:

- `ai_diagram`: `"AI 도식 생성. 아래 프롬프트로 Gemini genImage 호출.\n프롬프트: {diagramPrompt}"`
- `web_download`: `"공식문서 이미지 다운로드.\n출처: {sourceLabel}({sourcePageUrl})\n원본 URL: {sourceUrl}"`
- `capture`: `"실제 화면 캡처 필요. 사람이 앱/브라우저 세팅 후 Playwright 또는 PowerShell로 캡처."`
- `user_upload`: `"관리자가 직접 제작 후 업로드 버튼으로 첨부."`

### `botCurriculumSeries` — title unique 제약

`guide_settings.guide_progress`(발행 편 맵)가 시리즈 `title`을 키로 사용하고, `curriculum.ts`의 `getGuideSeries(seriesGroup)` 조회가 `title`로 수행된다. 시드 ON CONFLICT 기준도 `title`이므로 `title`에 unique 제약을 걸어 멱등 upsert를 보장한다.

### 마이그레이션 실행 — DATABASE_URL 주의

```bash
# 루트 .env의 DATABASE_URL은 포트 5433. drizzle-kit migrate가 auth_failed면 env 주입.
DATABASE_URL=postgresql://... pnpm --filter @ai-jakdang/database drizzle-kit migrate
```

`db:generate`는 오프라인 동작(스키마 분석만)이므로 DB 연결 불필요. `db:migrate`만 연결 필요. [Source: 메모리 규칙 — drizzle-migrate-env-gotcha.md]

### 다중 세션 충돌 방지

`drizzle-kit generate`는 전체 schema 디렉터리를 읽어 단 하나의 마이그레이션 파일을 생성한다. 실행 전 `git status packages/database/src/schema/`로 `bot-curriculum.ts` 외 다른 변경이 없는지 확인한다. 혼입 발생 시 SQL에서 커리큘럼 DDL 외의 구문을 분리해 별도 마이그레이션으로 처리한다. [Source: 메모리 규칙 — epic9-migration-0017-reconciled.md]

### 시드 스크립트 실행 순서 의존성

시드 스크립트는 마이그레이션 완료 **후** 실행한다(테이블 미존재 시 오류). 또한 `bot_settings.guide_asset_manifest`(가이드 이미지 URL 매니페스트) 데이터는 `apps/api/src/scripts/build-guide-assets.ts`(에셋 다운로드 스크립트)를 먼저 실행해야 존재한다. 매니페스트가 없어도 시드 자체는 성공하며, 해당 슬롯의 `image_url`은 null·`status = 'pending'`으로 유지된다.

### 건드릴 파일 목록

| 작업 | 파일 |
|---|---|
| 신규 생성 | `packages/database/src/schema/bot-curriculum.ts` |
| 신규 생성 | `apps/api/src/scripts/seed-curriculum.ts` |
| 수정 | `packages/database/src/schema/index.ts` — Epic 13 섹션 + `export * from "./bot-curriculum"` 추가 |
| 자동 생성 | `packages/database/migrations/<0032 이상 자동 번호>_*.sql` (번호 고정 금지) |
| 자동 생성 | `packages/database/migrations/meta/_journal.json` (drizzle이 자동 갱신) |
| **건드리지 말 것** | `apps/api/src/services/bot/curriculum.ts` — post-pipeline.ts 의존, Story 13.3 전까지 원본 유지 |
| **건드리지 말 것** | `apps/api/src/services/bot/post-pipeline.ts` — Step 2.6 리팩터는 Story 13.3 범위 |

### Project Structure Notes

- `bot-curriculum.ts`는 `packages/database/src/schema/` 기존 파일들과 동일 위치. 파일명 kebab-case(`site-settings.ts`, `post-attachments.ts` 패턴 동일).
- `packages/database/src/schema/index.ts`의 export 순서: 기존 섹션 주석 패턴(`// ── Epic N: 설명 ──`) 유지. `// ── Epic 11: 시딩 봇 ──` 아래에 `// ── Epic 13: 가이드 커리큘럼 ──` 추가.
- 시드 스크립트는 `apps/api/src/scripts/` — 기존 `build-guide-assets.ts`·`publish-guide-chapter.ts`·`verify-series.ts`와 동일 위치. 실행 방법: `tsx apps/api/src/scripts/seed-curriculum.ts`.
- `$inferSelect` / `$inferInsert` 타입 명명: `BotCurriculumSeriesRow`(시리즈 행 타입), `BotCurriculumChapterRow`(챕터 행 타입), `BotCurriculumImageSlotRow`(이미지 슬롯 행 타입).
- 이 스토리에서 정의하는 enum 3종은 `packages/contracts/src/bot-curriculum.ts`(Story 13.2)에서 Zod 스키마와 함께 재정의된다. contracts 패키지는 database 패키지를 직접 import하지 않으므로, 두 파일은 별개 소스로 유지(DB enum 직접 import 금지).

### References

- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#4] — 3개 테이블 컬럼 정의 전체(이 스토리의 1차 설계 기준)
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#10] — 현재 구현 상태(프로토타입과 중복 금지)
- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-13.1] — AC 원문 + Dev Notes
- [Source: apps/api/src/services/bot/curriculum.ts] — 시드 이관 원본(두 시리즈×5강 데이터, `GuideImageSlot`(이미지 슬롯 정의)·`GuideChapter`(챕터)·`GuideSeries`(시리즈) 인터페이스)
- [Source: apps/api/src/services/bot/post-pipeline.ts#L118-L119] — `GUIDE_PROGRESS_KEY = "guide_progress"`(진척 설정 키), `GUIDE_ASSET_MANIFEST_KEY = "guide_asset_manifest"`(에셋 매니페스트 키) 상수 정의 — 시드 스크립트에서 동일 키로 조회
- [Source: apps/api/src/services/bot/post-pipeline.ts#L904-L914] — `guide_progress` 구조: `Record<seriesTitle, { published: number[], summaries: Record<string, string> }>` — `continuitySummary`(연속성 요약) 이식 기준
- [Source: packages/database/src/schema/bot.ts] — enum 명명 패턴(camelCase 변수 + pgEnum 인수 snake_case), 크로스도메인 FK 미설정 패턴
- [Source: packages/database/src/schema/site-settings.ts] — key-value jsonb 패턴(`bot_settings` 참조용)
- [Source: packages/database/src/schema/index.ts] — 배럴 export 섹션 주석 패턴(`// ── Epic N: 설명 ──`)
- [Source: packages/database/migrations/meta/_journal.json] — **착수 시 최신 idx(현재 31/`0031_admin_cols_reconcile`) 확인 후 다음 번호(`0032_*`)로 자동 생성**(번호 고정 금지)
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#3] — `source_kind`(슬롯 이미지 출처 종류) 4가지 분류 및 배지 의미
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#2] — 스테이징 워크플로우 전체 흐름(이 스토리는 ①플랜 수립 데이터 기반 구성)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

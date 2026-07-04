# Story 13.3: 스테이징 파이프라인 (생성 ≠ 게시) + 준비완료 판정

Status: done

## Story

As a 시스템(시딩 봇 오케스트레이터),
I want 커리큘럼 챕터의 초안 생성과 실제 게시를 완전히 분리하기를,
So that 사람이 중간에 초안을 검수하고 이미지를 준비한 뒤 모든 슬롯이 채워졌을 때만 자동 게시되며, 반쪽짜리 글이 절대 사이트에 올라가지 않는다.

---

## Acceptance Criteria

1. **초안 생성 잡**: `bot_curriculum_chapters`(커리큘럼 챕터 테이블)의 `status=planned`(계획됨) 챕터를 대상으로, 챕터의 `goal`(학습목표)·`outline`(소주제 배열)·시리즈 정보·이전 편 요약을 조합한 컨텍스트로 `buildGuideChapterUserPrompt`(강의 편 유저 프롬프트 빌더, `packages/bot-core`)를 재사용해 본문을 생성한다. 생성된 본문에는 `[[IMG:assetKey]]`(이미지 자리 마커) 마커가 포함된다. 결과를 `draft_content`(초안 본문 Tiptap JSON)에 저장하고 `status`(챕터 상태)를 `drafted`(초안 완성)로 갱신한다. **이 단계에서 게시(`createPostAsBot`)를 호출하지 않는다.**

2. **`post-pipeline.ts`(글 생성 파이프라인) Step 2.6 리팩터**: 현재 `runPostPipeline`(파이프라인 실행 함수)에 내장된 가이드 강의 시리즈 경로(커리큘럼 감지 → 즉시 게시까지 한 번에 수행)를 파이프라인에서 분리한다. 일반 글(정보형·잡담)·퍼오기(유튜브·밈) 경로는 **회귀 없이 그대로 유지**된다.

3. **준비완료 판정**: 챕터의 `bot_curriculum_image_slots`(이미지 슬롯 테이블) 전체를 조회해 모든 슬롯의 `status`(슬롯 상태)가 `ready`(준비됨)면 해당 챕터 `status`를 `ready`(게시 가능)로 승격한다. 슬롯이 하나라도 `pending`(대기)이면 챕터를 `ready`로 승격하지 않는다. 이미지 슬롯이 0개인 챕터는 `drafted` 전환 즉시 `ready`로 자동 승격한다.

4. **게시 실행**(13.6 예약 스케줄러가 호출): `status=ready` AND `scheduled_at`(예약 게시 시각) `<= now`인 챕터에 대해 `insertInlineImagesByMarker`(마커 자리에 이미지 인라인 삽입, `packages/server-bot`)로 `[[IMG:key]]` 마커를 이미지 슬롯의 `image_url`(버킷 URL)로 치환한 뒤 `createPostAsBot`(봇 글 작성 서비스, Story 11.4)를 호출해 게시한다. 게시 성공 시 챕터 `status=published`(게시됨) + `published_post_id`(게시 결과 포스트 UUID)를 저장한다.

5. **연속성(앞편 요약 → 다음 편)**: 챕터 초안 생성 시, 이전에 `status=published` 또는 `status=drafted`인 편들의 `continuity_summary`(저장된 편별 요약)를 우선 사용하고, 값이 없으면 `draft_text_editable`(사람 수정 본문) → `draft_content`(초안 본문) 순서로 텍스트를 추출해 앞 180자 요약을 만든다. 이 요약 배열을 `buildGuideChapterUserPrompt`의 `previousChapters`(이전 편 요약 배열)에 전달해 N편이 앞편 내용을 이어받고 중복 설명을 피하게 한다.

6. **`allowDidacticTone`(교육 문체 완화) 유지**: 초안 생성 시 `runSelfCensor`(자기검열, `censor.ts`)를 `allowDidacticTone: true`(강의 문체 비차단)로 호출한다. 이는 기존 프로토타입과 동일하게 `ai_tone`(AI 티)·`duplicate`(중복) 축의 오탐 `fail`을 `pass`로 완화한다(`safety`·`factuality`·`persona`·`context` 축은 기존과 동일하게 강제).

---

## Tasks / Subtasks

### Task 1: `post-pipeline.ts` Step 2.6 제거 — 커리큘럼 경로 분리 (AC: #2)

- [ ] 1.1 파일 맨 위 import 정리
  - `curriculum.js`에서 가져오는 `getGuideSeriesForBoard`(게시판별 가이드 시리즈 탐색), `GuideChapter`(챕터 타입), `GuideSeries`(시리즈 타입) import 제거
  - `@ai-jakdang/server-bot/image`에서 가져오는 `GuideAssetManifest`(에셋 매핑 타입) import 제거
  - `getBotSetting`·`setBotSetting`의 동적 import 호출(Step 2.6·진척도 갱신 블록)도 함께 제거
  - 이 import들은 Step 2.6 커리큘럼 경로에서만 사용하므로, 제거 후 컴파일 오류가 없어야 한다

- [ ] 1.2 Step 2.6(가이드 강의 시리즈 감지) 블록 제거
  - 대상 구간: `apps/api/src/services/bot/post-pipeline.ts` 내 `// ── Step 2.6: 가이드 강의 시리즈(고정 커리큘럼) 감지 ──` 주석부터 `guideChapterCtx` 할당 끝까지(현재 약 45줄)
  - 제거 변수: `guideSeries`·`guideChapter`·`guideChapterCtx`·`guideProgress`·`GUIDE_PROGRESS_KEY`·`GUIDE_ASSET_MANIFEST_KEY`·`GuideSeriesProgress`·`GuideProgressMap`·`pickNextChapter`·`summarizeForContinuity` 모두 제거

- [ ] 1.3 발굴 가드(`wantsDiscovery`) 조건 단순화
  - 기존: `if (wantsDiscovery && !guideSeries && (await isSearchDrivenTopicsEnabled(db)))`
  - 변경 후: `if (wantsDiscovery && (await isSearchDrivenTopicsEnabled(db)))`
  - `!guideSeries` 조건 제거 (커리큘럼 경로가 파이프라인에서 분리됐으므로 불필요)

- [ ] 1.4 Step 4 주제 확정 블록에서 가이드 챕터 분기 제거
  - `if (guideChapter && guideSeries)` 분기 전체 제거 (합성 `guideTopic` 생성 로직 포함)
  - 남은 분기: `curatedVideo` → `discovered` → `selectTopic` (기존 순서 유지)

- [ ] 1.5 Step 6 그라운딩 생략 조건 제거
  - 기존: `if (guideChapter) { facts = { facts: [], ... } }` → else if discovered → else groundTopic
  - 변경 후: `if (discovered) { ... } else { groundTopic(...) }` (guideChapter 분기 제거)

- [ ] 1.6 Step 6b 이미지 전략에서 가이드 챕터 `"none"` 강제 제거
  - 기존: `if (guideChapter) { imageStrategy = "none"; }` 블록 제거

- [ ] 1.7 생성 루프 내 가이드 챕터 `finalContentJson` 분기 제거
  - 기존 `if (guideChapter)` 분기(getBotSetting → manifest → insertInlineImagesByMarker)를 제거
  - `curatedVideo` / 이미지 있음 / 이미지 없음 분기만 남김

- [ ] 1.8 제목 생성에서 가이드 챕터 포맷 제거
  - 기존: `const title = guideChapter && guideSeries ? "..." : generateTitle(...)` → `generateTitle(...)` 단독 사용

- [ ] 1.9 `allowDidacticTone` 전달 제거
  - 기존: `allowDidacticTone: guideChapter !== null` → `allowDidacticTone: false`(또는 파라미터 자체 제거)
  - 이 옵션은 이제 `curriculum-staging.ts`의 `draftCurriculumChapter`에서만 `true`로 전달

- [ ] 1.10 가이드 발행 성공 후 `guide_progress` 갱신 블록 제거
  - `if (guideChapter && guideSeries && writeResult.status === "published") { ... setBotSetting(...) }` 블록 전체 제거

- [ ] 1.11 회귀 검증: 일반/퍼오기 경로가 동일하게 동작하는지 확인
  - `runPostPipeline({ personaId, board: "vibe-coding-tips" })` → 정상 게시
  - `runPostPipeline({ personaId, board: "ai-creation" })` → 퍼오기(유튜브/밈) 정상 동작
  - `runPostPipeline({ personaId, board: "vibe-coding-guide" })` → 이제 `no-topic` skip (커리큘럼 경로 없어짐)
  - 기존 단위 테스트(`post-pipeline.test.ts`) 전량 통과 필수

### Task 2: `curriculum-staging.ts` 신규 생성 — 초안 생성 함수 (AC: #1, #5, #6)

- [ ] 2.1 파일 생성: `apps/api/src/services/bot/curriculum-staging.ts`

- [ ] 2.2 공개 타입 정의
  ```ts
  export interface DraftChapterResult {
    status: "drafted" | "skipped" | "error";
    chapterId: string;
    reason?: string;
  }
  ```

- [ ] 2.3 `draftCurriculumChapter(chapterId: string): Promise<DraftChapterResult>` 구현
  - **Step A — 챕터 + 시리즈 로드**: `bot_curriculum_chapters`(챕터 테이블) JOIN `bot_curriculum_series`(시리즈 테이블) 쿼리
    - 챕터 `status=planned` 또는 `status=drafted`여야 함(기발행·스킵은 재초안 금지)
    - 없으면 `{ status: "skipped", reason: "chapter-not-found-or-invalid-status" }` 반환
  - **Step B — 이미지 슬롯 로드**: `bot_curriculum_image_slots`(이미지 슬롯 테이블) WHERE `chapter_id=chapterId` ORDER BY `created_at ASC` 조회
  - **Step C — 이전 편 요약 구성** (AC #5 연속성):
    - `bot_curriculum_chapters` WHERE `series_id=chapter.seriesId AND order_index < chapter.orderIndex AND status IN ('published', 'drafted')` ORDER BY `order_index ASC` 조회
    - 각 이전 편은 `continuity_summary`가 있으면 그대로 사용하고, 없으면 `draft_text_editable`(사람 수정 본문) → `extractTextFromTiptap(draft_content)`(초안 텍스트 추출) 순서로 원문을 얻어 `summarizeForContinuity`(앞 180자 추출) 적용
    - `previousChapters: [{ order: c.orderIndex, title: c.title, summary }]` 배열 구성
  - **Step D — 관리자 페르소나 조회**:
    - `bot_persona_boards`(페르소나 담당 게시판 테이블) WHERE `board=series.board` JOIN `bot_personas`(페르소나 테이블) WHERE `is_admin_persona=true` LIMIT 1
    - 없으면 `{ status: "error", reason: "no-admin-persona-for-board" }` 반환
  - **Step E — GuideChapterContext 조립** (`packages/bot-core/context-types.ts` 타입 재사용):
    ```ts
    const ctx: GuideChapterContext = {
      seriesTitle: series.title,
      seriesIntro: series.intro,
      tool: series.tool,
      order: chapter.orderIndex,
      totalChapters: totalCount,  // series JOIN count
      chapterTitle: chapter.title,
      goal: chapter.goal,
      outline: chapter.outline as string[],  // jsonb
      imageSlots: slots.map(s => ({ assetKey: s.assetKey, caption: s.caption })),
      previousChapters,
    };
    ```
  - **Step F — 프롬프트 생성 + 모델 호출**:
    - `buildGuideChapterUserPrompt(ctx, emptyFacts)` 호출 (재사용; `emptyFacts = { facts: [], sourceUrls: [], confidence: "low" }`)
    - `buildPersonaSystemPrompt(personaForPrompt)` 호출 (재사용)
    - `genAssignment = await getModelAssignment(db, persona.id, "generation")` 조회
    - `callModel(genAssignment, { system, user, maxTokens: 4000 })` 호출
    - 실패 시 `{ status: "error", reason: "generation-model-error" }` 반환
  - **Step G — Tiptap 변환**:
    - `parseResponseToTiptap(genText)` 호출 (기존 헬퍼 — `post-pipeline.ts`에서 추출하거나 동일 로직 구현)
    - `extractTextFromTiptap(draftJson)` 호출
  - **Step H — 자기검열** (AC #6 `allowDidacticTone`):
    - `runSelfCensor({ jobId: tempJobId, personaId: persona.id, draft: draftText, ... allowDidacticTone: true })` 호출
    - 검열 `fail` 시: `logActivity`(폐기 로그) 후 재시도 최대 2회 (생성 루프 MAX_REGEN=2)
    - `ambiguous` 시: 초안은 그래도 저장하되 `bot_hold_queue`(보류 큐) 적재 후 `drafted` 상태 유지
  - **Step I — 초안 저장**:
    - `continuitySummary = summarizeForContinuity(draftText)` 계산
    - `UPDATE bot_curriculum_chapters SET draft_content=draftJson, continuity_summary=continuitySummary, status='drafted', updated_at=now() WHERE id=chapterId`
    - 성공 시 `{ status: "drafted", chapterId }` 반환
  - **Step J — 이미지 슬롯 0개 처리** (AC #3 edge case):
    - 슬롯 0개이면 저장 직후 `checkAndPromoteChapter(chapterId)` 호출 → 즉시 `ready`로 승격

- [ ] 2.4 `summarizeForContinuity(text: string): string` 내부 헬퍼 정의
  - `text.replace(/\s+/g, " ").trim()` 후 180자 초과 시 `${앞 180자}…` 반환
  - 이는 기존 `post-pipeline.ts`의 동일 헬퍼와 동일 로직(복사하되 curriculum-staging 내부로 이관)

### Task 3: `curriculum-staging.ts` — 준비완료 판정 함수 (AC: #3)

- [ ] 3.1 공개 타입 정의
  ```ts
  export interface ReadinessResult {
    ready: boolean;
    pendingCount: number;  // pending 슬롯 수 (0이면 ready=true)
    totalCount: number;
  }
  ```

- [ ] 3.2 `checkAndPromoteChapter(chapterId: string): Promise<ReadinessResult>` 구현
  - **Step A — 챕터 상태 확인**: `status`가 `drafted`가 아니면 조기 반환 (`ready`/`published`/`skipped`는 재처리 불필요)
  - **Step B — 슬롯 전수 조회**:
    ```ts
    const slots = await db
      .select({ status: schema.botCurriculumImageSlots.status })
      .from(schema.botCurriculumImageSlots)
      .where(eq(schema.botCurriculumImageSlots.chapterId, chapterId));
    ```
  - **Step C — 판정**:
    - `totalCount = slots.length`
    - `pendingCount = slots.filter(s => s.status === "pending").length`
    - 슬롯 0개 OR `pendingCount === 0` → `ready: true`
    - `pendingCount > 0` → `ready: false`
  - **Step D — 승격 (ready=true인 경우)**:
    ```ts
    await db
      .update(schema.botCurriculumChapters)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(schema.botCurriculumChapters.id, chapterId));
    ```
  - **Step E — 반환**: `{ ready, pendingCount, totalCount }`

- [ ] 3.3 슬롯 상태 변경 시 트리거 포인트 문서화 (실제 호출은 13.4 이미지 슬롯 워크플로우에서 연동)
  - 슬롯 1개가 `ready`로 바뀔 때마다 `checkAndPromoteChapter` 를 호출해야 한다
  - 이 연동은 Story 13.4(이미지 슬롯 워크플로우) 또는 13.5(관리자 API)에서 구현
  - 이 스토리에서는 함수 정의와 내부 로직만 완성 (호출 포인트는 다음 스토리에서 연결)

### Task 4: `curriculum-staging.ts` — 게시 실행 함수 (AC: #4)

- [ ] 4.1 공개 타입 정의
  ```ts
  export interface PublishChapterResult {
    status: "published" | "blocked" | "error";
    chapterId: string;
    postId?: string;
    reason?: string;
  }
  ```

- [ ] 4.2 `packages/server-bot/src/curriculum-publish.ts`에 `publishChapter(chapterId: string): Promise<PublishChapterResult>` 구현
  - **Step A — 챕터 + 시리즈 로드**: `status=ready`인 챕터만 처리; 아니면 `{ status: "error", reason: "chapter-not-ready" }`
  - **Step B — 이미지 슬롯 로드**: 해당 챕터의 모든 슬롯 조회
    - 하나라도 `status=pending`이면 **게시 중단** (`{ status: "error", reason: "image-slot-still-pending" }`) — 미완 안전장치 (설계 §6)
  - **Step C — 매니페스트 조립**:
    ```ts
    const manifest: GuideAssetManifest = {};
    for (const slot of slots) {
      if (slot.imageUrl) {
        manifest[slot.assetKey] = {
          url: slot.imageUrl,
          caption: slot.caption ?? null,
          alt: slot.alt ?? null,
          sourceLabel: null,   // bot_curriculum_image_slots 스키마에 source_url 없으면 null
          sourceUrl: slot.sourceUrl ?? null,
        };
      }
    }
    ```
  - **Step D — 마커 치환** (`insertInlineImagesByMarker` 재사용):
    ```ts
    const sourceDoc = chapter.draftTextEditable   // 사람 수정 본문 우선
      ? (parseResponseToTiptap(chapter.draftTextEditable) as Record<string, unknown>)
      : (chapter.draftContent as Record<string, unknown>);
    const { doc: finalContentJson } = insertInlineImagesByMarker(sourceDoc, manifest);
    ```
  - **Step E — 관리자 페르소나 조회**: Task 2.3 Step D와 동일 로직
  - **Step F — contentGuard 검사**:
    - `extractTextFromTiptap(finalContentJson)` → `runContentGuard(text)`
    - 차단 시 `{ status: "blocked", reason: "content-guard-blocked" }` 반환
  - **Step G — 게시 실행**:
    ```ts
    const title = `${series.title} ${chapter.orderIndex}강. ${chapter.title}`;
    const tags = chapter.title.split(/\s+/).filter(w => w.length > 1).slice(0, 5);
    const writeResult = await createPostAsBot({
      botUserId: persona.userId ?? persona.id,
      personaId: persona.id,
      jobId: tempJobId,
      postInput: {
        board: series.board,
        title,
        contentJson: finalContentJson,
        status: "published",
        tags,
      },
    });
    ```
  - **Step H — 챕터 상태 업데이트**:
    ```ts
    await db
      .update(schema.botCurriculumChapters)
      .set({
        status: "published",
        publishedPostId: writeResult.refId ?? null,
        continuitySummary: summarizeForContinuity(extractTextFromTiptap(finalContentJson)),
        updatedAt: new Date(),
      })
      .where(eq(schema.botCurriculumChapters.id, chapterId));
    ```
  - **Step I — 반환**: `{ status: "published", chapterId, postId: writeResult.refId, continuitySummary }`

### Task 5: 내보내기 배럴 업데이트 (AC: 전체)

- [ ] 5.1 `apps/api/src/services/bot/index.ts`에 아래 추가:
  ```ts
  export * from "./curriculum-staging.js";
  ```

### Task 6: 단위 테스트 (AC: #1~6)

- [ ] 6.1 `apps/api/src/services/bot/curriculum-staging.test.ts` 신규 생성

  | 시나리오 | 기댓값 |
  |---|---|
  | `draftCurriculumChapter`: 정상 챕터 초안 생성 | `status: "drafted"`, `draft_content` DB 저장, `createPostAsBot` 호출 없음 |
  | `draftCurriculumChapter`: 챕터 미존재 | `status: "skipped"` |
  | `draftCurriculumChapter`: 슬롯 0개 챕터 → 초안 저장 후 `checkAndPromoteChapter` 호출 | `status: "drafted"`, 챕터 즉시 `ready` 승격 |
  | `draftCurriculumChapter`: `allowDidacticTone=true` 전달 확인 | `runSelfCensor` spy에서 `allowDidacticTone: true` 확인 |
  | `checkAndPromoteChapter`: 슬롯 전부 `ready` | `status` = `"ready"` 업데이트 호출, `{ ready: true, pendingCount: 0 }` |
  | `checkAndPromoteChapter`: 슬롯 일부 `pending` | DB 업데이트 호출 없음, `{ ready: false, pendingCount: N }` |
  | `checkAndPromoteChapter`: 슬롯 0개 | `{ ready: true, pendingCount: 0, totalCount: 0 }`, 챕터 `ready` 승격 |
  | `publishChapter`: 정상 게시 | `status: "published"`, `publishedPostId`와 `continuitySummary` 저장, `createPostAsBot` 호출 |
  | `publishChapter`: `pending` 슬롯 존재 | `status: "error"`, `createPostAsBot` 호출 없음 |
  | `publishChapter`: `contentGuard` 차단 | `status: "blocked"` |
  | `publishChapter`: `draft_text_editable`(사람 수정본) 우선 사용 | `parseResponseToTiptap` spy 호출 확인 |

- [ ] 6.2 `post-pipeline.test.ts` 기존 테스트 회귀 없음 확인
  - `board: "vibe-coding-guide"` 입력 시 `status: "skipped"` (커리큘럼 경로 제거로 topic 없음) 확인
  - 기존 일반/퍼오기 시나리오 전량 통과 확인

### Task 7: 타입체크 통과

- [ ] 7.1 `pnpm --filter apps/api typecheck` 통과
- [ ] 7.2 `pnpm --filter apps/api test -- --testPathPattern=curriculum-staging` 통과
- [ ] 7.3 `pnpm --filter apps/api test -- --testPathPattern=post-pipeline` 통과 (회귀 없음)

---

## Dev Notes

### 프로토타입 리팩터 매핑 — 어디를 어떻게 분리하나

현재 `post-pipeline.ts`의 가이드 강의 경로는 파이프라인에 인라인으로 박혀 있다. 아래 표는 각 코드 구간이 어떻게 재배치되는지 매핑한다.

| 프로토타입 코드 위치 (`post-pipeline.ts`) | 현재 역할 | 13.3 이후 처리 |
|---|---|---|
| Step 2.6 전체 (`guideSeries` 감지 ~`guideChapterCtx` 조립, ~45줄) | 게시판으로 커리큘럼 시리즈 탐지 → `bot_settings.guide_progress` 조회 → 다음 편 선택 | **제거** — 이제 DB(`bot_curriculum_chapters.status=planned`)가 상태 소유 |
| `!guideSeries` 발굴 조건 | 커리큘럼 감지 시 주제 발굴 skip | **제거** (단순화: 발굴은 항상 실행됨) |
| `guideChapter` 분기 주제 선정 | 합성 `guideTopic` BotTopicRow 생성 | **제거** — curriculum-staging이 챕터 직접 조회 |
| `if (guideChapter) { facts = empty }` | 커리큘럼은 그라운딩 없음 | **제거** |
| `if (guideChapter) { imageStrategy = "none" }` | 마커 인라인이라 상단 이미지 불필요 | **제거** |
| 생성 루프 `allowDidacticTone: guideChapter !== null` | 강의 문체 완화 | **제거** (일반글에는 `false`; 커리큘럼은 curriculum-staging에서 `true`) |
| `if (guideChapter) { getBotSetting → manifest → insertInlineImagesByMarker }` | 마커→이미지 치환 즉시 게시 | **제거** — `publishChapter`로 이관 |
| 제목 포맷 `"${series.title} ${chapter.order}강..."` | 커리큘럼 제목 조립 | **제거** — `publishChapter`로 이관 |
| `if (guideChapter && writeResult.status === "published") { setBotSetting(guide_progress) }` | `bot_settings` 진척 갱신 | **제거** — DB `status=published`가 진척 추적 |
| `GUIDE_PROGRESS_KEY`, `GUIDE_ASSET_MANIFEST_KEY` 상수 | `bot_settings` jsonb 키 | **제거** — DB 테이블로 이관됨(13.1) |

**일반/퍼오기 경로 — 건드리지 않을 코드**

아래 영역은 Step 2.6 제거 후에도 **그대로 유지**된다:
- Step 2.5 `decideCurationMode`(퍼오기 방식 결정) 블록 전체
- Step 3 `discoverTopic`(검색 주도 주제 발굴) 블록
- Step 4 `curatedVideo` / `discovered` / `selectTopic` 주제 확정 분기
- 생성 루프의 `allowObvious`, `curationMode` 관련 로직
- `prependYoutubeToTiptapDoc`·`prependImageToTiptapDoc`·`prependImageWithSourceToTiptapDoc` 호출 분기
- `createQuestionAsBot`·`createResourceAsBot`·`createPostAsBot` 분기 (#6 정합)

### `buildGuideChapterUserPrompt` 재사용 시 주의사항

함수 시그니처: `buildGuideChapterUserPrompt(gc: GuideChapterContext, facts: FactSummary): string`
위치: `packages/bot-core/src/prompt-builder.ts` (내부 함수, `buildPostUserPrompt` 내부에서 호출됨)

**문제**: `buildGuideChapterUserPrompt`는 현재 `prompt-builder.ts`의 내부(`private`) 함수로 export되지 않는다.  
**해결책**: `packages/bot-core/src/prompt-builder.ts`에서 `export function buildGuideChapterUserPrompt`로 변경하고 `packages/bot-core/src/index.ts` 배럴에 추가한다.

또는 `buildPostUserPrompt`에 `guideChapter`를 주입하는 기존 방식을 재사용해도 된다:
```ts
buildPostUserPrompt({
  titleSeed: chapter.title,
  facts: emptyFacts,
  board: series.board,
  postKind: "guide",
  guideChapter: ctx,   // ← GuideChapterContext 주입 시 내부적으로 buildGuideChapterUserPrompt 호출
});
```

어느 방식이든 **내부 로직 변경 없이 재사용**한다.

### `parseResponseToTiptap` 공유 전략

`parseResponseToTiptap`(모델 응답 → Tiptap JSON 변환)은 현재 `post-pipeline.ts` 내부 함수다.  
`curriculum-staging.ts`에서도 동일 변환이 필요하므로:
- 옵션 A: `apps/api/src/services/bot/_tiptap-parser.ts`로 추출해 두 파일에서 import
- 옵션 B: `curriculum-staging.ts`에 동일 로직을 로컬 복사 (간단하지만 중복)
- **권장**: 옵션 A — 별도 헬퍼 파일 추출, 13.7(사후 이미지 플래너)에서도 재사용 가능

### 연속성(continuity) 요약 추출 방식

이전 편 요약은 **`continuity_summary` 컬럼을 우선 사용**하고, 값이 없는 과거/초안 데이터만 본문에서 fallback으로 도출한다:

```ts
// 이전 편(published/drafted) 순서대로 조회
const prevChapters = await db
  .select({ orderIndex, title, continuitySummary, draftTextEditable, draftContent })
  .from(schema.botCurriculumChapters)
  .where(
    and(
      eq(schema.botCurriculumChapters.seriesId, chapter.seriesId),
      lt(schema.botCurriculumChapters.orderIndex, chapter.orderIndex),
      inArray(schema.botCurriculumChapters.status, ["published", "drafted"]),
    )
  )
  .orderBy(asc(schema.botCurriculumChapters.orderIndex));

const previousChapters = prevChapters
  .filter(c => c.draftContent !== null)
  .map(c => {
    const rawText = c.continuitySummary
      ?? c.draftTextEditable
      ?? extractTextFromTiptap(c.draftContent as Record<string, unknown>);
    return {
      order: c.orderIndex,
      title: c.title,
      summary: summarizeForContinuity(rawText),
    };
  });
```

이렇게 하면 `bot_settings.guide_progress.summaries`(기존 jsonb 저장소)를 완전히 대체할 수 있다.

### `guideProgress` 마이그레이션 — 기존 `bot_settings` 데이터 처리

프로토타입에서 `bot_settings.guide_progress`(시리즈별 발행편+요약)가 실제 운영 데이터를 담고 있을 수 있다.
- 13.1 스키마 시드가 `curriculum.ts`를 DB로 이관할 때 발행 완료 편의 `status=published`로 시딩한다면, 기존 `guide_progress` 데이터와의 충돌을 피할 수 있다.
- 13.3 구현 시 `bot_settings.guide_progress` 키를 읽거나 쓰지 않는다 — DB 상태만 신뢰한다.
- **혹시 dev 환경에 이전 프로토타입 진척이 남아있다면**: `apps/api/src/scripts/reset-guide-demo.ts`(기존 스크립트)로 초기화 후 재시드.

### 관리자 페르소나 조회 전략

```ts
// series.board로 관리자 페르소나를 찾는다
const result = await db
  .select({ persona: schema.botPersonas })
  .from(schema.botPersonaBoards)
  .innerJoin(schema.botPersonas, eq(schema.botPersonaBoards.personaId, schema.botPersonas.id))
  .where(
    and(
      eq(schema.botPersonaBoards.board, series.board),
      eq(schema.botPersonas.isAdminPersona, true),
    )
  )
  .limit(1);
```

`AI작당지기`(관리자 봇, 닉네임 설계 고정)가 `vibe-coding-guide`·`automation-guide`의 담당 페르소나다.
`bot_persona_boards`에 이 배정이 없으면 drafting을 중단하고 오류를 반환한다.

### `GuideAssetManifest` 타입 재사용

`insertInlineImagesByMarker`는 `GuideAssetManifest`(`packages/server-bot/src/image/tiptap.ts`) 타입을 매개변수로 받는다.

```ts
export type GuideAssetManifest = Record<string, GuideAssetManifestEntry>;
export interface GuideAssetManifestEntry {
  url: string;
  caption?: string | null;
  alt?: string | null;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
}
```

`publishChapter`에서 `bot_curriculum_image_slots`의 컬럼을 이 인터페이스로 매핑해 전달한다.

### 선행 의존성 (13.1 완료 후 착수)

| 의존 스토리 | 제공 항목 | 위치 |
|---|---|---|
| **13.1** | `bot_curriculum_series`·`bot_curriculum_chapters`·`bot_curriculum_image_slots` 테이블 + enum(`planned|drafted|ready|published|skipped`, `pending|ready`) | `packages/database/src/schema/bot-curriculum.ts` 추가 |
| **13.2** | Zod 계약 타입 | `packages/contracts/src/bot-curriculum.ts` |
| **11.4** | `createPostAsBot` 시그니처 | `apps/api/src/services/bot/write.ts` |
| **11.6** | `callModel`, `getModelAssignment` | `packages/server-bot/src/ai` |
| **11.9** | `runSelfCensor`(`allowDidacticTone` 지원 확인) | `apps/api/src/services/bot/censor.ts` |

### 건드릴 파일 요약

| 파일 | 변경 유형 | 핵심 내용 |
|---|---|---|
| `apps/api/src/services/bot/post-pipeline.ts` | **수정** | Step 2.6 가이드 강의 경로 전체 제거. 일반/퍼오기 경로 유지 |
| `apps/api/src/services/bot/curriculum-staging.ts` | **신규** | `draftCurriculumChapter`, `checkAndPromoteChapter`, `summarizeForContinuity` |
| `packages/server-bot/src/curriculum-publish.ts` | **신규** | `publishChapter`(worker/API 공용 게시 실행 함수) |
| `apps/api/src/services/bot/_tiptap-parser.ts` | **신규** | `parseResponseToTiptap`, `parseMarkdownLines` (post-pipeline에서 추출) |
| `apps/api/src/services/bot/curriculum-staging.test.ts` | **신규** | vitest 단위 테스트 (11개 시나리오) |
| `apps/api/src/services/bot/index.ts` | **수정** | `curriculum-staging.js` 배럴 추가 |
| `packages/bot-core/src/prompt-builder.ts` | **수정** | `buildGuideChapterUserPrompt` export 노출 (내부→공개) |
| `packages/bot-core/src/index.ts` | **수정** | `buildGuideChapterUserPrompt` 배럴 추가 |

### ⚠️ 교차 스토리 경계 — 게시 실행 함수의 호출 주체 (13.6과 반드시 정합)

`publishChapter`(챕터 게시 실행 함수)는 **13.6 예약 스케줄러(크론 워커 `apps/worker`)가 호출**한다. 그런데 Epic 11에서 확인된 기존 제약상 **`apps/worker`는 `apps/api`를 import할 수 없다**(worker→파이프라인 last-mile 미배선, `epic-11` sprint 노트·11.13 참조). 따라서 이 함수가 `apps/api/src/services/bot/curriculum-staging.ts`(apps/api 내부)에만 있으면 **13.6이 착수 불가**하다.

정합 방침:
- **확정 방침**: `publishChapter`의 **게시 실행 로직**(슬롯 조립·마커 치환·contentGuard·게시)을 `packages/server-bot/src/curriculum-publish.ts`(worker·api 공용 경계)에 둔다. `apps/api`는 필요할 경우 얇은 래퍼로 재노출한다. `createPostAsBot`(11.4)에 대한 의존은 주입(injection) 또는 server-bot 내 공용 write 경계로 해소한다. → 13.6 Dev Notes의 `publishChapter` 위치 요구와 일치.
- 착수 순서는 13.1→13.2→13.3(공용 게시 경계 확정 구현)→13.4→13.5→13.6이다.

### 핵심 가드레일

1. **초안 생성 ≠ 게시**: `draftCurriculumChapter`는 `createPostAsBot`을 절대 호출하지 않는다. 게시는 `publishChapter`만 담당한다.
2. **미완 안전장치**: `publishChapter`에서 `status=ready`인데 슬롯에 `pending`이 있으면(이론상 불가하나 방어코드) 즉시 중단. 반쪽짜리 글 방지.
3. **`draft_text_editable`(사람 수정본) 우선**: 게시 시 사람이 고친 내용이 있으면 그것을 우선 사용한다.
4. **`allowDidacticTone: true` 필수**: 강의 편은 `runSelfCensor` 호출 시 반드시 이 옵션을 전달한다. 누락 시 `ai_tone`·`duplicate` 오탐으로 재생성 루프에 갇힌다(§10 함정 기록).
5. **`bot_settings.guide_progress` 의존 제거**: 이 스토리 이후 커리큘럼 진척도는 DB `bot_curriculum_chapters.status`가 유일한 진실 소스다.

### Project Structure Notes

```
apps/
  api/src/services/bot/
    post-pipeline.ts          ← 수정: Step 2.6 제거
    _tiptap-parser.ts         ← 신규: parseResponseToTiptap 추출
    curriculum-staging.ts     ← 신규: 3종 함수
    curriculum-staging.test.ts← 신규: vitest
    index.ts                  ← 수정: 배럴 추가
packages/
  bot-core/src/
    prompt-builder.ts         ← 수정: buildGuideChapterUserPrompt export
    index.ts                  ← 수정: 배럴 추가
```

### References

- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md §2] — 스테이징 워크플로우 6단계 (플랜→초안생성→이미지채움→준비완료→예약→게시)
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md §3] — 이미지 슬롯 상태 `pending→ready` 및 준비완료 판정 규칙
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md §4] — `bot_curriculum_series`·`bot_curriculum_chapters`·`bot_curriculum_image_slots` 데이터 모델
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md §10] — 프로토타입 현황: 생성+즉시게시가 한 번에 일어남(분리 배경), `allowDidacticTone` 함정
- [Source: docs/seeding-bot/EPICS-AND-STORIES.md Epic 13, Story 13.3] — AC 원문 5항목
- [Source: apps/api/src/services/bot/post-pipeline.ts, Step 2.6] — 제거 대상 구간 (~L373~L418, 이미지처리 L800~L807, 제목 L840~L843, 진척갱신 L904~L915)
- [Source: apps/api/src/services/bot/post-pipeline.ts, `summarizeForContinuity`] — 앞 180자 요약 헬퍼 (curriculum-staging으로 이관)
- [Source: apps/api/src/services/bot/curriculum.ts] — `GuideSeries`·`GuideChapter` 타입, `getGuideSeriesForBoard`, 두 시리즈 정의 (DB 시드 후 이 파일은 읽기 참조용으로만 유지)
- [Source: packages/bot-core/src/prompt-builder.ts, `buildGuideChapterUserPrompt`] — 강의 편 프롬프트 빌더 재사용 대상
- [Source: packages/server-bot/src/image/tiptap.ts, `insertInlineImagesByMarker`] — 마커→이미지 인라인 치환 (게시 실행 시 재사용)
- [Source: apps/api/src/services/bot/censor.ts, `allowDidacticTone`] — `ai_tone`·`duplicate` 완화 로직 (유지)
- [Source: _bmad-output/implementation-artifacts/11-9-post-generation-pipeline.md, Task 4.3] — `parseResponseToTiptap` 헬퍼 추출 패턴

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

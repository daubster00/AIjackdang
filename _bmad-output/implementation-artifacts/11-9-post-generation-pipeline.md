# Story 11.9: 글 생성 파이프라인 (주제선정·작성·자기검열·보류큐·자동보충)

Status: done

## Story

As a 봇(시딩 봇 시스템),
I want 주제 선정부터 자기검열·분기·게시까지 한 건의 글을 안전하게 완성하기를,
so that 사람다운 사실 기반 글이 사이트에 올라가고, 기준 미달 글은 보류 또는 폐기된다.

## Acceptance Criteria

1. **주제 선정+중복 방지**: `bot_topics`(봇 주제 풀)에서 `unused`(미사용) 상태 주제를 선택하고 선택 즉시 `used`(사용됨)+`used_at`(사용 일시)을 기록한다. `cooling`(냉각중) 상태 주제는 선택되지 않는다. 고정 풀이 소진되면 `topic_kind='realtime'`(실시간 주제) 항목을 폴백으로 사용한다.

2. **작성**: `persona_prompt`(페르소나 사전 프롬프트)+`FactSummary`(사실 요약 객체, 11.7 `groundTopic`)+주제로 글 생성 모델(`getModelAssignment(db, personaId, 'generation')`로 조회한 할당 — #5 정합)을 호출해 Tiptap JSON 후보를 반환한다. **AI 티 제거 규칙**을 시스템 프롬프트에 내장한다: 이모지·상투어("안녕하세요"/"~드립니다"/"결론적으로" 등 판에 박힌 도입/마무리) 금지, 길이·문단 구조 들쭉날쭉, 캐릭터별 의도적 불완전함 반영.

3. **자기검열**: 글 생성 모델과 **분리된 검열관 모델**(`getModelAssignment(db, personaId, 'censor')`로 조회 — #5 정합)이 6항목(사실성/AI 티/페르소나 일관성/안전·위험/중복성/게시판 맥락 적합)을 판정하고 결과를 `bot_generation_jobs.censor_result`(검열 결과 jsonb)에 저장한다. 검열 강도를 차등 적용한다: `is_admin_persona`(관리자 페르소나 여부)=true 또는 `info_ratio`(정보형 비율) ≥ 70이면 `strict`(엄격), `info_ratio` ≥ 40이면 `normal`(보통), 그 외(잡담·밈)는 `loose`(느슨).

4. **분기**: 검열 결과에 따라 다음 4개 경로를 처리하고 각 분기마다 `bot_activity_log`(봇 활동 로그)를 적재한다.
   - 통과: `runContentGuard`(콘텐츠 가드) 통과 → 게시판별 작성 함수 분기(#6: `qna`→`createQuestionAsBot`, `resource:<type>`→`createResourceAsBot`, 그 외→`createPostAsBot`) → `published`(게시됨). `job_kind`도 동일 기준으로 `question`/`resource`/`post` 기록
   - `runContentGuard` 차단: `blocked`(차단됨)
   - 애매: `bot_hold_queue`(보류 큐)에 `reason='ambiguous'`(애매)로 적재 → `held`(보류)
   - 탈락: 재생성 시도, `regen_count`(재생성 횟수) < 3이면 생성 단계 재시도, ≥ 3이면 `discarded`(폐기)

5. **자동 보충**: `bot_settings.bot_auto_refill_topics`(주제 자동 보충 토글) ON + 봇별 `unused` 주제 수가 임계(기본 3개) 이하이면 AI가 해당 캐릭터 컨셉에 맞는 새 주제를 생성해 `topic_kind='auto'`(자동 생성 유형)로 `bot_topics`에 INSERT한다.

6. **관리자 장문 모드**: `is_admin_persona=true`이고 대상 주제에 `series_group`(연재 그룹)이 있으면 연재 모드로 작성한다(목차·소제목·코드블록 포함, AI 생성 표지 이미지 강제). 이 경우 검열 강도를 항상 `strict`로 고정하고, 사실 근거 강도(`intensity`)를 항상 `full`로 강제한다. `notices`(공지사항) 게시판은 봇 작성 대상에서 제외한다(11.4 `createPostAsBot` 가드 기존 구현 확인 후 파이프라인 진입 전 이중 차단).

## Tasks / Subtasks

### Task 1: `packages/bot-core` 신규 패키지 스캐폴드 (AC: #2, #3)

- [x] 1.1 `packages/bot-core/package.json` 생성
  ```json
  {
    "name": "@ai-jakdang/bot-core",
    "version": "0.0.1",
    "private": true,
    "type": "module",
    "main": "./src/index.ts",
    "exports": { ".": "./src/index.ts" },
    "scripts": {
      "typecheck": "tsc --noEmit",
      "test": "vitest run"
    },
    "devDependencies": {
      "typescript": "workspace:*",
      "vitest": "workspace:*"
    }
  }
  ```
  DB·네트워크 접근 의존성 추가 금지(순수 함수 패키지 원칙). [Source: docs/seeding-bot/ARCHITECTURE.md §1]

- [x] 1.2 `packages/bot-core/tsconfig.json` 생성
  - `extends: "../../packages/config/tsconfig.base.json"` (기존 패키지 패턴 준수)
  - `include: ["src/**/*.ts"]`

- [x] 1.3 `packages/bot-core/src/prompt-builder.ts` — 페르소나 프롬프트 빌더 (AC: #2)
  - `buildPersonaSystemPrompt(persona: BotPersonaForPrompt): string` 구현
    - `persona_prompt`(사전 프롬프트) 텍스트를 시스템 프롬프트 첫 블록으로 배치
    - AI 티 제거 규칙을 영어·한국어 혼합 지시로 내장:
      - 이모지 절대 사용 금지
      - "안녕하세요", "~드립니다", "결론적으로", "정리하자면" 등 상투어 금지
      - 문단 수·길이를 매번 다르게 (AI처럼 균일한 단락 구성 금지)
      - `intentional_flaws`(의도적 약점·버릇)를 반영해 가끔 오타·구어 허용
      - 봇임을 시사하는 자기 언급 금지 ("저는 AI이지만…" 등)
  - `buildPostUserPrompt(options: PostUserPromptOptions): string` 구현
    ```ts
    interface PostUserPromptOptions {
      titleSeed: string;           // 주제 출발점 텍스트
      facts: FactSummary;          // 사실 요약 객체 (11.7)
      board: string;               // 게시판 슬러그
      postKind: 'info' | 'chat' | 'guide'; // 글 성격
      seriesContext?: SeriesContext; // 관리자 연재 모드 시
    }
    interface SeriesContext {
      groupTitle: string;         // 대주제 제목 (예: "바이브코딩 입문 시리즈")
      episodeIndex: number;       // 몇 번째 편 (1부터)
      tableOfContents?: string[]; // 시리즈 전체 목차 (있으면 연재 연속성 유지)
    }
    ```
    - `postKind='guide'`(관리자 장문) 시: 목차 자동 생성 지시 포함, 코드블록 사용 지시
    - Tiptap JSON 형식으로 반환하도록 출력 포맷 지시 포함
  - `buildTopicRefillPrompt(persona: BotPersonaForPrompt, board: string, existingTopics: string[]): string` 구현
    - 캐릭터 컨셉에 맞는 새 주제 N개를 JSON 배열로 반환하는 프롬프트
    - 기존 주제 목록(`existingTopics`)을 넣어 중복 방지 지시

- [x] 1.4 `packages/bot-core/src/censor-rules.ts` — 검열 규칙 (AC: #3)
  - `buildCensorSystemPrompt(strictness: 'strict' | 'normal' | 'loose'): string` 구현
    - 6항목 판정 지시: 사실성/AI 티/페르소나 일관성/안전·위험/중복성/게시판 맥락
    - `strict`: 사실성 확인 최우선, AI 티 0건 허용, 사실 불확실 단정 즉시 탈락
    - `normal`: 통상 검열
    - `loose`: 잡담·밈은 사실성 항목 사실상 면제 (잡담이니까), AI 티만 점검
  - `buildCensorUserPrompt(options: CensorUserPromptOptions): string` 구현
    ```ts
    interface CensorUserPromptOptions {
      draft: string;              // 생성된 텍스트 (plain text 추출)
      personaName: string;        // 캐릭터 닉네임 (예: semo_k)
      tone: string;               // 말투 설명
      titleSeed: string;          // 원래 주제 출발점
      facts: FactSummary;         // 사실 요약 (비교 판정용)
      board: string;              // 게시판
    }
    ```
    - 출력 형식: JSON `{ items: { key, result, reason }[] }` 지시 (파싱 안정성)
  - `parseCensorResult(response: string): CensorResult` 구현
    ```ts
    interface CensorResult {
      items: Array<{
        key: 'factuality' | 'ai_tone' | 'persona' | 'safety' | 'duplicate' | 'context';
        result: 'pass' | 'fail' | 'ambiguous';
        reason: string;
      }>;
      overall: 'pass' | 'fail' | 'ambiguous';
    }
    ```
    - JSON 파싱 실패 시 `overall: 'ambiguous'` 반환(fail-safe)
    - `overall` 결정 규칙: 하나라도 `fail`이면 `fail`, 하나라도 `ambiguous` 이면 `ambiguous`, 전부 `pass`면 `pass`

- [x] 1.5 `packages/bot-core/src/duplicate-check.ts` — 단순 유사도 (AC: #3 중복성 1차 필터)
  - `jaccardSimilarity(a: string, b: string): number` 구현 (0~1, 단어 집합 기준)
  - `isTooSimilar(draft: string, existingPosts: string[], threshold?: number): boolean` (기본 threshold=0.6)
  - DB·네트워크 없음 (순수 함수)
  - 주의: 검열관 판정이 2차 중복 판정. 이 함수는 검열관 호출 전 1차 필터용 빠른 체크.

- [x] 1.6 `packages/bot-core/src/index.ts` — 배럴 export

- [x] 1.7 `packages/bot-core/src/prompt-builder.test.ts` — vitest 단위 테스트
  - `buildPersonaSystemPrompt`: 시스템 프롬프트에 이모지 금지 문구 포함 확인
  - `buildPersonaSystemPrompt`: `persona_prompt` 텍스트가 포함됨 확인
  - `parseCensorResult`: 유효 JSON → CensorResult 변환 확인
  - `parseCensorResult`: 깨진 JSON → `{ overall: 'ambiguous' }` 반환 확인

- [x] 1.8 `packages/bot-core/src/duplicate-check.test.ts` — vitest 단위 테스트
  - 동일 문자열 → 1.0
  - 완전 다른 문자열 → 0.0
  - 60% 이상 겹치면 `isTooSimilar` = true

### Task 2: 주제 선정 서비스 구현 (AC: #1, #5)

- [x] 2.1 `apps/api/src/services/bot/topic.ts` 신규 생성

  ```ts
  // 핵심 함수 시그니처
  export async function selectTopic(
    db: ReturnType<typeof getDb>,
    personaId: string,
    board: string,
    realtimeTopic?: string,   // 외부에서 주입된 실시간 주제 텍스트
  ): Promise<{ topic: typeof schema.botTopics.$inferSelect; wasRealtime: boolean } | null>
  ```
  - 쿼리 순서:
    1. `bot_topics WHERE persona_id=personaId AND board=board AND status='unused'` LIMIT 1 (ORDER BY created_at ASC)
    2. 없으면 `realtimeTopic` 있을 때 임시 객체 반환 (`wasRealtime=true`, DB INSERT하지 않음)
    3. 둘 다 없으면 `null` 반환 → 파이프라인 skip

  - `cooling` 처리: `status='cooling'` 행은 `used_at < NOW() - INTERVAL '7 days'`이면 `unused`로 리셋 가능 (별도 Task 4에서 cron이 처리). 이 함수에서는 `cooling` 상태 행을 조회 제외만 한다.

- [x] 2.2 `markTopicUsed(db, topicId: string): Promise<void>` 구현
  - `UPDATE bot_topics SET status='used', used_at=NOW() WHERE id=topicId`
  - `wasRealtime=true`인 경우 호출하지 않음 (임시 주제는 DB에 없음)

- [x] 2.3 `apps/api/src/services/bot/topic.test.ts` — vitest 단위 테스트
  - `selectTopic`: unused 행 있으면 반환 확인
  - `selectTopic`: unused 없고 realtimeTopic 있으면 임시 객체 반환 확인
  - `selectTopic`: 둘 다 없으면 null 반환 확인
  - `markTopicUsed`: UPDATE 쿼리 호출 확인 (mock DB)

### Task 3: 자기검열 서비스 구현 (AC: #3)

- [x] 3.1 `apps/api/src/services/bot/censor.ts` 신규 생성

  ```ts
  export interface SelfCensorInput {
    jobId: string;
    personaId: string;
    draft: string;                 // 생성된 평문 텍스트 (Tiptap에서 추출)
    titleSeed: string;
    persona: {
      personaName: string;
      tone: string;
      infoRatio: number;           // info_ratio (정보형 비율)
      isAdminPersona: boolean;     // is_admin_persona (관리자 페르소나 여부)
      personaId: string;           // 모델 조회 키 (getModelAssignment(personaId,'censor') — #5 정합)
    };
    facts: FactSummary;            // 11.7 groundTopic 결과
    board: string;
    existingPostTexts?: string[];  // 최근 자기 글 텍스트 (중복 1차 필터용)
  }

  export interface SelfCensorOutput {
    censorResult: CensorResult;    // packages/bot-core parseCensorResult 결과
    costUsd: number;               // 검열관 호출 비용
  }

  export async function runSelfCensor(input: SelfCensorInput): Promise<SelfCensorOutput>
  ```

  구현 흐름:
  1. 검열 강도 결정: `isAdminPersona || infoRatio >= 70` → `strict`, `infoRatio >= 40` → `normal`, else → `loose`
  2. `jaccardSimilarity`로 기존 글 중복 1차 확인 (임계 초과 시 `overall: 'fail'` 단락처리 — 검열관 호출 절약)
  3. `buildCensorSystemPrompt(strictness)` + `buildCensorUserPrompt(...)` 구성
  4. `getModelAssignment(db, personaId, 'censor')`(11.6)로 검열관 `bot_model_assignments`(봇 모델 할당) 행 조회 — `(persona_id, purpose)` unique 키. `null`이면 잡 `blocked` 처리 + 로그(검열 모델 미할당)
  5. `callModel(censorAssignment, censorPrompt)` 호출 (11.6 의존)
  6. `parseCensorResult(response.text)` 파싱
  7. `bot_generation_jobs` UPDATE: `status='censoring'`, `censorResult=...`, `cost` 누적

- [x] 3.2 `apps/api/src/services/bot/censor.test.ts` — vitest 단위 테스트
  - `runSelfCensor`: infoRatio=80 → strictness='strict' 검증
  - `runSelfCensor`: 중복 1차 탐지 → callModel 미호출 확인
  - `runSelfCensor`: callModel 정상 응답 → CensorResult 반환 확인
  - 검열관 모델 호출 비용이 `costUsd`에 포함됨 확인

### Task 4: 글 생성 파이프라인 오케스트레이터 구현 (AC: #1~6)

- [x] 4.1 `apps/api/src/services/bot/post-pipeline.ts` 신규 생성

  ```ts
  export interface RunPostPipelineInput {
    personaId: string;
    board: string;                    // 대상 게시판 슬러그
    realtimeTopic?: string;           // 외부 실시간 주제 (오케스트레이터에서 주입)
    forceSeriesGroup?: string;        // 관리자 연재 그룹 강제 지정
  }

  export type PostPipelineStatus =
    | 'published'
    | 'blocked'
    | 'held'
    | 'discarded'
    | 'skipped'    // 주제 없음 또는 설정에 의한 스킵
    | 'error';

  export interface PostPipelineResult {
    status: PostPipelineStatus;
    jobId?: string;
    postId?: string;
    reason?: string;
  }

  export async function runPostPipeline(input: RunPostPipelineInput): Promise<PostPipelineResult>
  ```

- [x] 4.2 파이프라인 단계별 구현 (AC: #1~6 전량)

  **Step 0 — 공지사항 가드**
  ```ts
  if (input.board === 'notices') {
    await logActivity(db, personaId, 'skipped', null, { reason: 'notices-board-forbidden' });
    return { status: 'skipped', reason: 'notices-board-forbidden' };
  }
  ```

  **Step 1 — 주제 선정** (AC: #1)
  ```ts
  const topicResult = await selectTopic(db, personaId, input.board, input.realtimeTopic);
  if (!topicResult) {
    await logActivity(db, personaId, 'skipped', null, { reason: 'no-topic' });
    return { status: 'skipped', reason: 'no-topic' };
  }
  ```
  - topicResult.wasRealtime=false이면 `markTopicUsed(db, topicResult.topic.id)` 즉시 호출 (선점)

  **Step 2 — bot_generation_jobs(생성 작업) 레코드 생성**
  ```ts
  // #6 정합: board 종류로 job_kind와 게시 함수를 분기 (Q&A·실전자료 경로)
  //   'qna'            → job_kind 'question',  createQuestionAsBot
  //   'resource:<type>'→ job_kind 'resource',  createResourceAsBot
  //   그 외            → job_kind 'post',      createPostAsBot
  const jobKind = input.board === 'qna'
    ? 'question'
    : input.board.startsWith('resource:')
      ? 'resource'
      : 'post';
  const job = await db.insert(schema.botGenerationJobs).values({
    personaId,
    jobKind,
    targetBoard: input.board,
    topicId: topicResult.wasRealtime ? null : topicResult.topic.id,
    status: 'pending',
    regenCount: 0,
  }).returning({ id: schema.botGenerationJobs.id });
  const jobId = job[0].id;
  ```

  **Step 3 — 사전 프롬프트 빌드**
  ```ts
  const persona = await db.query.botPersonas.findFirst({ where: eq(schema.botPersonas.id, personaId) });
  const isAdminPersona = persona.isAdminPersona;
  const postKind: 'info' | 'chat' | 'guide' = isAdminPersona ? 'guide'
    : (persona.infoRatio >= 50 ? 'info' : 'chat');
  ```

  **Step 4 — 검색·그라운딩** (AC: #2, 11.7 의존)
  ```ts
  const intensity: 'full' | 'light' | 'none' =
    postKind === 'guide' ? 'full' :
    postKind === 'info' ? 'full' :
    persona.infoRatio >= 30 ? 'light' : 'none';
  // 11.7 정합: 한국어 토픽을 영어로 번역해 englishQuery로 주입 (해외 AI 전문 도메인 검색 효과 ↑).
  // 번역은 별도 API 없이 callModel(11.6)로 짧게 처리하거나, 토픽 생성 단계(11.11)에서 영어 키워드를 함께 산출.
  const englishQuery = await translateTopicToEnglish(topicResult.topic.title_seed, persona); // 내부 헬퍼(저비용 callModel 1회) 또는 topic.en_keywords 사용
  const facts = await groundTopic(topicResult.topic.title_seed, intensity, {
    modelAssignment: genAssignment,         // summarizeFacts용 (없으면 원본 스니펫만)
    englishQuery,                            // 11.7 GroundTopicOptions.englishQuery — 영어 도메인 검색용
    onCostAccumulated: async (costUsd) => { /* 비용 누적(11.6 가드 연동) */ },
  });
  ```

  **Step 5 — 이미지 전략 결정** (AC: #6, 11.8 의존)
  ```ts
  let imageStrategy = await decideImageStrategy(persona, input.board, postKind);
  if (isAdminPersona) imageStrategy = 'ai'; // 관리자 장문은 AI 이미지 강제
  ```

  **Step 6 — 관리자 연재 컨텍스트 조회** (AC: #6)
  ```ts
  let seriesContext: SeriesContext | undefined;
  const seriesGroup = topicResult.topic.series_group ?? input.forceSeriesGroup;
  if (isAdminPersona && seriesGroup) {
    const episodeCount = await db.select({ count: count() })
      .from(schema.botTopics)
      .where(and(
        eq(schema.botTopics.seriesGroup, seriesGroup),
        inArray(schema.botTopics.status, ['used']),
      ));
    seriesContext = {
      groupTitle: seriesGroup,
      episodeIndex: (episodeCount[0]?.count ?? 0) + 1,
    };
  }
  ```

  **Step 7~9 — 생성 루프** (재생성 포함, AC: #2, #4)
  ```ts
  const MAX_REGEN = 3;
  let regenCount = 0;
  let pipelineResult: PostPipelineResult | null = null;

  while (regenCount <= MAX_REGEN && pipelineResult === null) {
    // Step 7: status='generating' 업데이트
    await db.update(schema.botGenerationJobs)
      .set({ status: 'generating', regenCount, updatedAt: new Date() })
      .where(eq(schema.botGenerationJobs.id, jobId));

    // 글 생성
    const systemPrompt = buildPersonaSystemPrompt(persona);
    const userPrompt = buildPostUserPrompt({ titleSeed: topicResult.topic.title_seed, facts, board: input.board, postKind, seriesContext });
    // #5 정합: persona.genModelId(폐기 컬럼) 대신 (persona_id, purpose) 조회
    const genAssignment = await getModelAssignment(db, persona.id, "generation");
    if (!genAssignment) {
      await logActivity(db, persona.id, "blocked", null, { reason: "no-generation-model" });
      await db.update(schema.botGenerationJobs)
        .set({ status: "blocked" }).where(eq(schema.botGenerationJobs.id, jobId));
      return { status: "blocked", reason: "no-generation-model" };
    }
    const genResponse = await callModel(genAssignment, { system: systemPrompt, user: userPrompt, maxTokens: isAdminPersona ? 4000 : 1500 });

    // Tiptap JSON 변환
    const draftJson = parseResponseToTiptap(genResponse.text); // 내부 헬퍼
    const draftText = extractTextFromTiptap(draftJson);         // 내부 헬퍼

    // Step 8: 자기검열 (status='censoring')
    const censorOutput = await runSelfCensor({ jobId, personaId, draft: draftText, titleSeed: topicResult.topic.title_seed, persona: { ... }, facts, board: input.board });
    const { censorResult } = censorOutput;

    // censor_result 저장
    await db.update(schema.botGenerationJobs)
      .set({ status: 'censoring', draftContent: draftJson, censorResult, updatedAt: new Date() })
      .where(eq(schema.botGenerationJobs.id, jobId));

    // Step 9: 분기 처리
    if (censorResult.overall === 'pass') {
      // 이미지 처리 (통과 시에만 비용 지출)
      const imageUrl = await resolveImage(imageStrategy, topicResult.topic.title_seed, facts.keywords[0] ?? '');

      // Tiptap에 이미지 삽입 (있을 경우)
      const finalContentJson = imageUrl ? insertImageToTiptap(draftJson, imageUrl) : draftJson;

      // contentGuard (11.3) 통과 확인
      const guardResult = await runContentGuard(draftText);
      if (!guardResult.ok) {
        // BLOCKED
        await db.update(schema.botGenerationJobs).set({ status: 'blocked', updatedAt: new Date() }).where(eq(schema.botGenerationJobs.id, jobId));
        await logActivity(db, personaId, 'blocked', jobId, { reason: guardResult.code ?? 'FORBIDDEN_CONTENT' });
        pipelineResult = { status: 'blocked', jobId };
      } else {
        // #6 정합: jobKind에 따라 게시 함수 분기 (createPostAsBot/createQuestionAsBot/createResourceAsBot, 모두 11.4)
        const title = generateTitle(topicResult.topic.title_seed, seriesContext); // 내부 헬퍼
        const tags = facts.keywords.slice(0, 5);
        const common = { botUserId: persona.userId, personaId, jobId };
        let writeResult;
        if (jobKind === 'question') {
          // Q&A 질문 작성 (Epic3 도메인 서비스 경유)
          writeResult = await createQuestionAsBot({
            ...common,
            questionInput: { title, contentJson: finalContentJson, tags },
          });
        } else if (jobKind === 'resource') {
          // 실전자료 작성 (Epic4 도메인 서비스 경유). board='resource:<type>' → type 매핑
          const resourceType = input.board.slice('resource:'.length);
          writeResult = await createResourceAsBot({
            ...common,
            resourceInput: { type: resourceType, title, contentJson: finalContentJson, tags },
          });
        } else {
          writeResult = await createPostAsBot({
            ...common,
            postInput: { board: input.board, title, contentJson: finalContentJson, status: 'published', tags },
          });
        }
        // 각 createXxxAsBot 내부에서 job status='published' 업데이트 및 bot_activity_log 기록 (11.4 구현)
        pipelineResult = { status: writeResult.status as PostPipelineStatus, jobId, postId: writeResult.refId };
      }
    } else if (censorResult.overall === 'ambiguous') {
      // HELD → bot_hold_queue INSERT
      await db.insert(schema.botHoldQueue).values({
        jobId,
        reason: 'ambiguous',
        decided: false,
      });
      await db.update(schema.botGenerationJobs).set({ status: 'held', updatedAt: new Date() }).where(eq(schema.botGenerationJobs.id, jobId));
      await logActivity(db, personaId, 'held', jobId, { censorResult });
      pipelineResult = { status: 'held', jobId };
    } else {
      // FAIL: 재생성 시도
      regenCount++;
      await logActivity(db, personaId, 'regenerated', jobId, { attempt: regenCount, censorResult });
      if (regenCount > MAX_REGEN) {
        await db.update(schema.botGenerationJobs).set({ status: 'discarded', updatedAt: new Date() }).where(eq(schema.botGenerationJobs.id, jobId));
        await logActivity(db, personaId, 'discarded', jobId, { reason: 'max-regen-exceeded' });
        pipelineResult = { status: 'discarded', jobId };
      }
      // else: while 루프 재진입
    }
  }
  ```

- [x] 4.3 내부 헬퍼 함수 구현 (`post-pipeline.ts` 내부 또는 별도 `_helpers.ts`)
  - `parseResponseToTiptap(text: string): Record<string, unknown>` — 모델 응답을 Tiptap JSON으로 변환. 모델이 Tiptap을 직접 반환하지 않으면 마크다운 → Tiptap 변환 로직. 파싱 실패 시 fallback: plain text paragraph 노드로 감싸기.
  - `extractTextFromTiptap(json: Record<string, unknown>): string` — Tiptap JSON에서 텍스트 노드만 추출 (기존 `contentGuard.ts`의 `extractTextFromTiptap` import 재사용 — 11.3에서 export됨)
  - `insertImageToTiptap(json: Record<string, unknown>, imageUrl: string): Record<string, unknown>` — Tiptap JSON 첫 번째 위치에 이미지 노드 삽입
  - `generateTitle(titleSeed: string, seriesContext?: SeriesContext): string` — 관리자 연재 시 "시리즈명 — 제N편" 형식 제목 생성
  - `resolveImage(strategy: ImageStrategy, keyword: string, fallbackKeyword: string): Promise<string | null>` — 전략별 이미지 URL 반환 (11.8 의존, `none` 시 null)

- [x] 4.4 `logActivity` 헬퍼 구현 (내부 함수)
  ```ts
  async function logActivity(
    db: ReturnType<typeof getDb>,
    personaId: string,
    eventType: string,
    refId: string | null,
    payload: Record<string, unknown>,
  ): Promise<void>
  ```
  `bot_activity_log`(봇 활동 로그)에 INSERT. 실패해도 파이프라인 계속 (best-effort, try/catch 감싸기).

- [x] 4.5 비용 누적 처리
  - `genResponse.costUsd` + `censorOutput.costUsd` + 이미지 생성 비용을 `bot_generation_jobs.cost`(비용 jsonb)에 누적 UPDATE
  - `bot_activity_log`에도 비용 이벤트(`eventType='cost'`) 기록 (11.12 일일 상한 집계 원천)

### Task 5: 자동 보충 구현 (AC: #5)

- [x] 5.1 `apps/api/src/services/bot/topic.ts`에 `refillTopicsIfNeeded(db, personaId: string): Promise<number>` 추가 (새로 생성된 주제 수 반환)

  구현 흐름:
  1. `bot_settings.bot_auto_refill_topics` 조회 → OFF이면 즉시 반환
  2. 미사용 주제 수 조회: `COUNT(bot_topics WHERE persona_id=personaId AND status='unused')`
  3. 임계(기본 3) 초과이면 즉시 반환 (보충 불필요)
  4. 페르소나 정보·담당 게시판 조회
  5. 기존 주제 title_seed 목록 조회 (중복 방지용)
  6. `buildTopicRefillPrompt(persona, board, existingTopics)` 프롬프트 생성
  7. `callModel(genAssignment, ...)` 호출 → JSON 배열 파싱
  8. `bot_topics` INSERT: `topic_kind='auto'`, `status='unused'`
  9. `bot_activity_log` 기록 (`eventType='skipped'` + payload `{ reason: 'topics-refilled', count: N }`)

- [x] 5.2 `runPostPipeline` 마지막 단계에 `refillTopicsIfNeeded` 호출 추가
  - 파이프라인 종료(성공·실패 불문) 후 비동기 호출 (await 없이 fire-and-forget, 오류는 catch 후 로그만)
  ```ts
  void refillTopicsIfNeeded(db, personaId).catch(err =>
    console.error('[post-pipeline] 자동 보충 실패 (무시):', err.message)
  );
  ```

### Task 6: 관리자 장문 모드 보강 (AC: #6)

- [x] 6.1 `packages/bot-core/src/prompt-builder.ts`의 `buildPostUserPrompt`에서 `postKind='guide'` 분기 구체화
  - 목차 자동 생성 지시: "글 시작 부분에 ## 목차를 생성하고 각 소제목과 연결하라"
  - 코드블록 사용 지시: "코드 예시는 반드시 코드블록으로 감싸라"
  - `seriesContext.episodeIndex`가 2 이상이면 이전 편 요약 한 줄 포함 지시
  - 최소 길이 지시: "1500자 이상 작성"
  - 사실 근거 지시 강화: "불확실한 수치·날짜·이름은 절대 단정하지 말고 출처 없음을 명시하라"

- [x] 6.2 `runPostPipeline`에서 관리자 연재 모드 로직 점검
  - `series_group` 있는 주제 선택 시 `seriesContext` 자동 구성 (Task 4.2 Step 6)
  - 관리자 모드에서 검열 강도 `strict` 강제 (Task 3의 `runSelfCensor`에서 `isAdminPersona` 전달)
  - `intensity='full'` 강제 (Task 4.2 Step 4)

- [x] 6.3 공지사항 가드 이중 차단 확인
  - Task 4.2 Step 0의 `board === 'notices'` 가드로 파이프라인 진입 전 차단
  - 11.4 `createPostAsBot` 내부에도 동일 가드 존재 (2중 방어 확인)

### Task 7: 통합 테스트 (AC: #1~6)

- [x] 7.1 `apps/api/src/services/bot/post-pipeline.test.ts` — vitest 통합 테스트 (DB mock 방식, 기존 `points.service.test.ts` 패턴 준수)

  | 시나리오 | 기댓값 |
  |---|---|
  | 정상 주제 선정 → 검열 통과 → contentGuard 통과 | `status: 'published'`, `markTopicUsed` 호출, `logActivity('post.published')` 호출 |
  | 검열 통과 → contentGuard 차단 | `status: 'blocked'`, `bot_generation_jobs.status='blocked'` 업데이트 |
  | 검열 `ambiguous` | `status: 'held'`, `bot_hold_queue` INSERT, `bot_generation_jobs.status='held'` |
  | 검열 `fail` 3회 | `status: 'discarded'`, `regen_count=3`, `logActivity('discarded')` |
  | 검열 `fail` 1회 후 `pass` | `status: 'published'`, `regen_count=1` |
  | 주제 없음 | `status: 'skipped'` |
  | `board='notices'` | `status: 'skipped'`, `reason: 'notices-board-forbidden'` |
  | `is_admin_persona=true` + `series_group` 있음 | `imageStrategy='ai'` 강제, `intensity='full'` 강제, `strictness='strict'` |
  | 자동 보충 임계 이하 | `refillTopicsIfNeeded` fire-and-forget 호출 확인 (spy) |

- [x] 7.2 mock 설정 참조 패턴
  ```ts
  // apps/api/src/routes/v1/gamification/points.service.test.ts 패턴 준수
  vi.mock('@ai-jakdang/database', () => ({ getDb: vi.fn(() => mockDb), schema: { ... } }))
  vi.mock('../../lib/ai/index.js', () => ({ callModel: vi.fn().mockResolvedValue({ text: '...', usage: {...}, costUsd: 0.001 }) }))
  vi.mock('../../lib/search/index.js', () => ({ groundTopic: vi.fn().mockResolvedValue({ facts: [], sources: [], keywords: [], confidence: 'medium' }) }))
  vi.mock('../../lib/images/index.js', () => ({ decideImageStrategy: vi.fn().mockResolvedValue('none'), pickStock: vi.fn(), genImage: vi.fn() }))
  vi.mock('../../middleware/contentGuard.js', () => ({ runContentGuard: vi.fn().mockResolvedValue({ ok: true }) }))
  vi.mock('./write.js', () => ({ createPostAsBot: vi.fn().mockResolvedValue({ status: 'published', refId: 'post-id-1' }) }))
  ```

### Task 8: 타입체크·빌드 검증

- [x] 8.1 `packages/bot-core/src/index.ts` 배럴 export 완성
- [x] 8.2 `apps/api/src/services/bot/index.ts` 업데이트 (`export * from './topic.js'`, `export * from './censor.js'`, `export * from './post-pipeline.js'`)
- [x] 8.3 `pnpm typecheck --filter @ai-jakdang/bot-core` 통과
- [x] 8.4 `pnpm typecheck --filter apps/api` 통과
- [x] 8.5 `pnpm test --filter @ai-jakdang/bot-core` 통과
- [x] 8.6 `pnpm test --filter apps/api` 통과 (기존 테스트 회귀 없음)

## Dev Notes

### 선행 의존성 (구현 전 반드시 확인)

| 스토리 | 제공 인터페이스 | 위치 |
|---|---|---|
| **11.1** | `schema.botTopics`, `schema.botGenerationJobs`, `schema.botHoldQueue`, `schema.botActivityLog`, `schema.botModelAssignments`, `schema.botPersonas`, `schema.botSettings` | `packages/database/src/schema/bot.ts` |
| **11.2** | Zod 스키마 — `BotPersonaSchema`, `BotTopicSchema`, `BotGenerationJobSchema` 등 | `packages/contracts/src/bot.ts` |
| **11.3** | `createComment(input: CreateCommentServiceInput): Promise<{id: string}>` | `apps/api/src/routes/v1/comments/service.ts` |
| **11.3** | `runContentGuard(text: string): Promise<ContentGuardResult>` (`{ ok: true } \| { ok: false; code: string; message: string; reason?: string }`) | server-only 공용 경계로 노출. 원본은 `contentGuard.ts`에서 추출하되 worker가 `apps/api/src/*`를 직접 import하지 않도록 `packages/bot-core`/`packages/server-bot`로 이동 또는 re-export |
| **11.3** | `extractTextFromTiptap(json): string` | 순수 함수이므로 `packages/bot-core` 권장. worker에서 `apps/api/src/middleware/contentGuard.ts` 직접 import 금지 |
| **11.4** | `createPostAsBot` / `createQuestionAsBot` / `createResourceAsBot` (`Promise<BotWriteResult>`) | server-only 공용 경계. API 원형은 `apps/api/src/services/bot/write.ts`이나 worker 직접 import 금지 |
| **11.4** | `BotWriteResult = { status: 'published'|'blocked'; refId?: string }` | 동일 파일 |
| **11.5** | `ensureBotUser(persona)` — 시드 계정 존재 보장 (런타임 의존 아닌 시드 선행 요건) | `scripts/seed-bots.ts` |
| **11.6** | `callModel(assignment: BotModelAssignment, prompt: AiPrompt): Promise<AiResponse>` | server-only AI 경계(`packages/server-bot` 권장). worker에서 `apps/api/src/lib/ai` 직접 import 금지 |
| **11.7** | `groundTopic(topic: string, intensity: 'full'|'light'|'none'): Promise<FactSummary>` | server-only search 경계 |
| **11.8** | `decideImageStrategy(persona, board, postKind): Promise<'stock'|'ai'|'none'|'meme'>` | server-only image 경계 |
| **11.8** | `pickStock(keyword: string): Promise<{url: string; credit: string} \| null>` | server-only image 경계 |
| **11.8** | `genImage(prompt: string): Promise<{url: string; costUsd: number} \| null>` | server-only image 경계 |

> 11.6·11.7·11.8 스토리 파일이 아직 없으므로 ARCHITECTURE.md §4·§5·§6의 인터페이스 정의를 기반으로 추정했다. 실제 구현 착수 시 해당 파일이 존재하면 실제 시그니처를 우선한다.

### 11.6 callModel 예상 인터페이스

```ts
// server-only AI boundary (packages/server-bot 권장; apps/api/src/lib/ai 직접 import 금지)
interface AiPrompt {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}
interface AiResponse {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
}
interface BotModelAssignment {
  id: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;                        // 예: "gpt-4o-mini", "claude-sonnet-4-5", "gemini-2.0-flash"
  purpose: 'generation' | 'censor' | 'image';
  isActive: boolean;
}
export async function callModel(assignment: BotModelAssignment, prompt: AiPrompt): Promise<AiResponse>
```

모델명 하드코딩 금지 — `bot_model_assignments` DB에서 읽음. [Source: docs/seeding-bot/ARCHITECTURE.md §4]

### 11.7 groundTopic 예상 인터페이스

```ts
// server-only search boundary (packages/server-bot 권장; apps/api/src/lib/search 직접 import 금지)
interface FactSummary {
  facts: string[];              // 핵심 사실 문장 목록 (확실한 것만)
  sources: string[];            // 출처 URL
  keywords: string[];           // 주요 키워드 (이미지 검색·태그에도 사용)
  confidence: 'high' | 'medium' | 'low';
}
interface GroundTopicOptions {
  modelAssignment?: BotModelAssignment;                 // summarizeFacts에 전달할 모델
  onCostAccumulated?: (costUsd: number) => Promise<void>; // 비용 누적 콜백(11.6 가드)
  englishQuery?: string;                                 // 해외 AI 도메인용 영어 검색어(11.7 정합)
}
export async function groundTopic(
  topic: string,
  intensity: 'full' | 'light' | 'none',
  options?: GroundTopicOptions,
): Promise<FactSummary>
```

- `intensity='none'`이면 검색 없이 빈 `FactSummary` 반환 (잡담·밈)
- 검색 결과는 `<untrusted_search_content>` 블록으로 감싸 AI 요약기에 전달 (인젝션 방어). [Source: docs/seeding-bot/ARCHITECTURE.md §5]

### 영어 쿼리 주입 (11.7 정합 — 해외 AI 도메인 검색)

> **배경**: 구글 CSE의 "전체 웹 검색"이 2026-01 폐지되어, `GOOGLE_SEARCH_CX`(구글 검색엔진 ID)에는 **해외 AI 전문 도메인 약 50개 허용목록**을 등록한다(11.7 Dev Notes 참조). 이 도메인들은 대부분 영어 사이트이므로 한국어 토픽을 그대로 넣으면 결과가 거의 안 잡힌다.

- 파이프라인은 한국어 토픽을 **영어 키워드로 번역**해 `groundTopic(topic, intensity, { englishQuery })`로 주입한다.
- 번역 경로 2택(구현 시 택1):
  1. `translateTopicToEnglish(titleSeed, persona)` 내부 헬퍼 — `callModel`(11.6) 1회로 짧게 영어 검색어 생성(저비용, 토큰 적음). 이 호출 비용도 `onCostAccumulated`로 누적.
  2. 11.11 일일 활동 플래너가 토픽 생성 시 `bot_topics.en_keywords`(영어 키워드) 컬럼을 함께 산출해 두고, 파이프라인은 그 값을 그대로 사용(추가 호출 0회 — 권장).
- `summarizeFacts`(11.7)는 영문 스니펫을 받아 **한국어 사실 객체**로 요약하므로(11.7 시스템 프롬프트 규칙 4), 검색=영어·산출=한국어가 자연 연결된다.
- 네이버 어댑터는 한국어 토픽 그대로 사용(국내 보조 출처).

> 옵션 2(토픽에 영어 키워드 동봉)를 택하면 `translateTopicToEnglish` 헬퍼와 그 비용이 불필요하다. 11.11 스토리 착수 시 `bot_topics`에 `en_keywords` 추가 여부를 함께 결정한다.

### 11.8 decideImageStrategy 예상 인터페이스

```ts
// server-only image boundary (packages/server-bot 권장; apps/api/src/lib/images 직접 import 금지)
export async function decideImageStrategy(
  persona: { isAdminPersona: boolean; infoRatio: number; nickname: string },
  board: string,
  postKind: 'info' | 'chat' | 'guide',
): Promise<'stock' | 'ai' | 'none' | 'meme'>
```

- `board === 'ai-creation'` → 반드시 `'ai'` (ARCHITECTURE §6 규칙)
- `is_admin_persona=true` → 항상 `'ai'`로 override (파이프라인에서 강제)
- 짧은 잡담 → 흔히 `'none'`
[Source: docs/seeding-bot/ARCHITECTURE.md §6]

### 핵심 제약 — 절대 규칙

1. **DB 직접 INSERT 금지**: `bot_generation_jobs`, `bot_hold_queue`, `bot_activity_log`는 메타 데이터 테이블이므로 직접 INSERT 허용. 그러나 `posts`, `comments` 등 도메인 콘텐츠는 반드시 `createPostAsBot`/`createCommentAsBot`(11.4)을 경유한다. [Source: docs/seeding-bot/ARCHITECTURE.md §0 절대 규칙 #1]

2. **생성 모델 ≠ 검열관 모델**: 두 호출에 다른 `bot_model_assignments` 레코드를 사용해야 한다 — `getModelAssignment(db, personaId, 'generation')` ≠ `getModelAssignment(db, personaId, 'censor')`(#5 정합: persona별 `(persona_id, purpose)` unique 조회, `persona.gen_model_id`/`censor_model_id` 컬럼은 폐기). [Source: docs/seeding-bot/PRD.md FR-SB-8.1]

3. **비신뢰 입력 래핑**: `FactSummary.facts`를 AI 요약기에서 받더라도, 다시 생성 모델의 `user` 프롬프트에 삽입할 때 `<search_summary>`로 구획화. 직접 시스템 프롬프트에 삽입 금지. [Source: docs/seeding-bot/ARCHITECTURE.md §7]

4. **공지사항 가드**: `board === 'notices'`는 파이프라인 진입 전 차단. 11.4의 `createPostAsBot` 가드는 2중 방어. [Source: docs/seeding-bot/EPICS-AND-STORIES.md Story 11.9 AC#6]

5. **검열 fail-safe**: `parseCensorResult` 파싱 실패, `callModel` 오류 등 예외 시 → `CensorResult.overall = 'ambiguous'` 처리. "의심되면 보류한다". [Source: docs/seeding-bot/ARCHITECTURE.md §11]

6. **packages/bot-core DB 접근 금지**: 순수 함수 패키지. `@ai-jakdang/database` import 없음. DB 접근은 `apps/api/src/services/bot/*.ts`에서만. [Source: docs/seeding-bot/ARCHITECTURE.md §1]

### Tiptap JSON 변환 전략

모델에 Tiptap JSON 출력을 직접 요청하는 것보다 마크다운 → Tiptap 변환이 실용적이다.
`buildPostUserPrompt`의 출력 지시: "마크다운 형식으로 작성하라 (## 소제목, **굵게**, ```코드블록```)".
`parseResponseToTiptap` 헬퍼가 마크다운을 Tiptap 호환 JSON으로 변환.

기존 프로젝트에 `@tiptap/extension-*` 서버사이드 패키지가 없을 경우 대안:
- 간단한 마크다운 파서 직접 구현 (h2→heading, bold→bold mark, code fence→codeBlock 노드)
- 또는 `markdown-it` + 커스텀 Tiptap 매핑 함수
- **파싱 실패 시 fallback**: 전체 텍스트를 하나의 `paragraph` 노드로 감싸기 (게시는 성공, 서식만 단순화)

### 비용 추적 경로

```
callModel(gen) → genResponse.costUsd
callModel(censor) → censorOutput.costUsd
resolveImage(ai) → imageGenCost (11.8에서 반환)
합계 → bot_generation_jobs.cost jsonb 누적
      → bot_activity_log(eventType='cost') 기록
      → 11.12에서 일일 합산 비교(bot_settings.bot_daily_cost_limit_usd(일일 비용 상한))
```

[Source: docs/seeding-bot/ARCHITECTURE.md §4, §9]

### 재생성 루프 설계 주의사항

- `MAX_REGEN = 3` (3회까지, 즉 초기 생성 포함 최대 4회 실제 생성 모델 호출)
- 재생성 시 `groundTopic` 재호출 없음 (비용 절약, 동일 사실 기반으로 재작성 시도)
- 재생성 시 검열 강도는 동일 유지 (느슨하게 바꾸지 않음)
- `regen_count` 업데이트는 각 루프 시작 전 DB에 반영

### 테스트 패턴 참조

기존 테스트 패턴 파일: `apps/api/src/routes/v1/gamification/points.service.test.ts`

```ts
// vi.mock 패턴 (경로는 .js 확장자 사용)
vi.mock('@ai-jakdang/database', () => ({
  getDb: vi.fn(() => mockDb),
  schema: { botTopics: {}, botGenerationJobs: {}, botHoldQueue: {}, botActivityLog: {}, botPersonas: {}, botModelAssignments: {}, botSettings: {} },
}))
```

### Project Structure Notes

신규·변경 파일 목록:

| 파일 | 변경 유형 | 비고 |
|---|---|---|
| `packages/bot-core/package.json` | **신규** | 순수 함수 패키지 |
| `packages/bot-core/tsconfig.json` | **신규** | |
| `packages/bot-core/src/prompt-builder.ts` | **신규** | 페르소나 프롬프트 빌더 |
| `packages/bot-core/src/censor-rules.ts` | **신규** | 검열 규칙 빌더·파서 |
| `packages/bot-core/src/duplicate-check.ts` | **신규** | 자카드 유사도 |
| `packages/bot-core/src/index.ts` | **신규** | 배럴 |
| `packages/bot-core/src/prompt-builder.test.ts` | **신규** | vitest |
| `packages/bot-core/src/duplicate-check.test.ts` | **신규** | vitest |
| `apps/api/src/services/bot/topic.ts` | **신규** | 주제 선정 + 자동 보충 |
| `apps/api/src/services/bot/topic.test.ts` | **신규** | vitest |
| `apps/api/src/services/bot/censor.ts` | **신규** | 자기검열 서비스 |
| `apps/api/src/services/bot/censor.test.ts` | **신규** | vitest |
| `apps/api/src/services/bot/post-pipeline.ts` | **신규** | 글 생성 파이프라인 메인 |
| `apps/api/src/services/bot/post-pipeline.test.ts` | **신규** | vitest 통합 테스트 |
| `apps/api/src/services/bot/index.ts` | **수정** | 신규 모듈 배럴 추가 |

`packages/bot-core`는 `packages/core`(기존 순수 함수 패키지, `src/nickname.ts`·`src/qna.ts` 등 위치)와 동일한 격리 원칙 적용.

11.13(BullMQ 워커 등록) 이전이므로 이 스토리에서 `apps/worker/src/processors/bot/` 파일은 생성하지 않는다. `runPostPipeline` 함수는 직접 테스트로만 검증하고, 11.13에서 `bot.write` 잡 processor가 이를 호출한다.

### References

- [Source: docs/seeding-bot/EPICS-AND-STORIES.md, Story 11.9] — AC 원문 6항목
- [Source: docs/seeding-bot/ARCHITECTURE.md §0] — 절대 규칙 (DB 직접 INSERT 금지, 설정 source of truth)
- [Source: docs/seeding-bot/ARCHITECTURE.md §2.5] — `bot_topics`(주제 풀) 스키마 (status enum: unused/used/cooling/realtime, topic_kind: fixed/realtime/auto, series_group)
- [Source: docs/seeding-bot/ARCHITECTURE.md §2.7] — `bot_generation_jobs`(생성 작업) 스키마 (status 전체: pending/generating/censoring/held/approved/published/discarded/blocked)
- [Source: docs/seeding-bot/ARCHITECTURE.md §2.8] — `bot_hold_queue`(보류 큐) 스키마 (reason: ambiguous/injection_suspect/copyright_risk/observation_mode)
- [Source: docs/seeding-bot/ARCHITECTURE.md §2.9] — `bot_activity_log`(봇 활동 로그) event_type 목록 (post.published/comment.published/held/blocked/regenerated/skipped/cost/discarded/planned)
- [Source: docs/seeding-bot/ARCHITECTURE.md §2.10] — `bot_settings` key 목록 (bot_auto_refill_topics, bot_daily_cost_limit_usd)
- [Source: docs/seeding-bot/ARCHITECTURE.md §4] — AI 추상화 레이어 인터페이스 (callModel, AiProvider)
- [Source: docs/seeding-bot/ARCHITECTURE.md §5] — 검색·그라운딩 인터페이스 (groundTopic, summarizeFacts)
- [Source: docs/seeding-bot/ARCHITECTURE.md §6] — 이미지 엔진 인터페이스 (decideImageStrategy)
- [Source: docs/seeding-bot/ARCHITECTURE.md §7] — 글 생성 파이프라인 흐름 다이어그램
- [Source: docs/seeding-bot/ARCHITECTURE.md §11] — 보안·실패 모드 (fail-safe 원칙)
- [Source: docs/seeding-bot/PRD.md FR-SB-5.1~5.5] — 글 생성 파이프라인 요구사항
- [Source: docs/seeding-bot/PRD.md FR-SB-8.1~8.7] — 자기검열·인젝션 방어 요구사항
- [Source: docs/seeding-bot-topic-pools.md §8] — `AI작당지기` 관리자 대주제 11개 + 연재 설명
- [Source: _bmad-output/implementation-artifacts/11-3-comment-service-contentguard-extraction.md] — `runContentGuard` 시그니처 및 `extractTextFromTiptap` 위치
- [Source: _bmad-output/implementation-artifacts/11-4-bot-write-service.md] — `createPostAsBot` 시그니처, 공지사항 가드 위치, DB 직접 INSERT 금지 패턴
- [Source: apps/api/src/lib/queues.ts] — BullMQ Queue 패턴 (지연 초기화 싱글톤, 큐명 상수)
- [Source: apps/worker/src/index.ts] — 기존 워커 등록 패턴 (content.cleanup cron: `repeat: { pattern: "0 3 * * *" }`)
- [Source: apps/worker/src/connection.ts] — QUEUE_NAMES 상수, createConnection 패턴
- [Source: apps/api/src/routes/v1/gamification/points.service.test.ts] — vitest + vi.mock DB mock 패턴

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `BotModelAssignmentRow`(`createdAt: Date`) → `BotModelAssignment`(`createdAt: string`) 타입 불일치 수정: `groundTopic` 호출 전 `toISOString()` 변환 객체 생성
- `FactGrounding`(server-bot/search 반환 타입)과 `FactSummary`(bot-core 내부 타입) 차이로 `adaptGrounding()` 어댑터 패턴 적용
- `decideImageStrategy`는 동기 함수(await 없이 직접 호출)
- `PersonaContext`(image 모듈)는 snake_case 키(`is_admin_persona`, `info_ratio`) 사용
- 관리자 페르소나: `imageStrategy='ai'` 강제, `internalPostKind='guide'` 강제, `intensity='full'` 강제
- `refillTopicsIfNeeded`는 파이프라인 종료 후 fire-and-forget 패턴으로 호출(await 없이)
- `packages/bot-core/src/context-types.ts`에 Story 11.9 타입 추가(11.10 타입과 공존)
- `pnpm --filter @ai-jakdang/bot-core typecheck && pnpm --filter @ai-jakdang/bot-core test && pnpm --filter @ai-jakdang/api typecheck` 전부 통과

### File List

- `packages/bot-core/package.json` [NEW]
- `packages/bot-core/tsconfig.json` [NEW]
- `packages/bot-core/src/context-types.ts` [MODIFIED — Story 11.9 타입 추가]
- `packages/bot-core/src/prompt-builder.ts` [NEW]
- `packages/bot-core/src/censor-rules.ts` [NEW]
- `packages/bot-core/src/duplicate-check.ts` [NEW]
- `packages/bot-core/src/index.ts` [NEW]
- `packages/bot-core/src/prompt-builder.test.ts` [NEW]
- `packages/bot-core/src/censor-rules.test.ts` [NEW]
- `packages/bot-core/src/duplicate-check.test.ts` [NEW]
- `apps/api/src/services/bot/topic.ts` [NEW]
- `apps/api/src/services/bot/topic.test.ts` [NEW]
- `apps/api/src/services/bot/censor.ts` [NEW]
- `apps/api/src/services/bot/censor.test.ts` [NEW]
- `apps/api/src/services/bot/post-pipeline.ts` [NEW]
- `apps/api/src/services/bot/post-pipeline.test.ts` [NEW]
- `apps/api/src/services/bot/index.ts` [UPDATE]

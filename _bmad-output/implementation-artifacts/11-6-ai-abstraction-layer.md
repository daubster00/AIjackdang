# Story 11.6: AI 추상화 레이어 (3사 어댑터·모델 할당·비용 가드)

Status: ready-for-dev

## Story

As a 시스템,
I want OpenAI·Claude·Gemini를 봇별로 갈아끼울 수 있는 통일 인터페이스와 비용 추적 가드를 구축하기,
so that 모델 라인업 변화에 코드 수정 없이 대응하고 일일 비용 폭주를 자동 차단한다.

## Acceptance Criteria

1. worker와 api가 모두 import 가능한 **server-only AI 경계**에 `AiProvider`(AI 프로바이더) 인터페이스(`generateText`, 선택 `generateImage`) + `getProvider()`(프로바이더 팩토리) 함수가 정의된다. 표준 위치는 `packages/server-bot/src/ai/`이며, worker가 `apps/api/src/*`를 직접 import하는 구조는 금지한다. `adapters/openai.ts`·`adapters/anthropic.ts`·`adapters/gemini.ts` 3개 파일이 동일한 인터페이스를 구현한다.

2. **도구/함수콜 비활성**: 세 어댑터 모두 SDK 호출 시 `tools` / `functions` 파라미터를 전달하지 않는다. `generateText` 반환값은 `{ text: string; usage: { inputTokens: number; outputTokens: number }; costUsd: number }` 뿐. 해당 AI 키(`OPENAI_API_KEY`·`ANTHROPIC_API_KEY`·`GEMINI_API_KEY`)가 env에 미설정이면 어댑터 호출 시점에 명확한 에러를 던진다(부팅 차단 아님 — `packages/config` optional 검증). 각 어댑터에 대한 모킹 단위 테스트가 통과한다.

3. `callModel(assignment, prompt)` 함수가 `bot_model_assignments`(봇 모델 할당) 행의 `provider`(프로바이더)·`model`(모델명)으로 라우팅한다. `assignment`는 `BotModelAssignment`(contracts 타입, Story 11.2 정의). 봇별 글생성용(`purpose='generation'`)·검열관용(`purpose='censor'`)·이미지용(`purpose='image'`) 모델 분리 구조를 지원한다.
   - **모델 조회 헬퍼(#5 정합)**: `getModelAssignment(db, personaId, purpose): Promise<BotModelAssignment | null>`를 이 레이어에서 export한다. `bot_model_assignments`를 **`(persona_id, purpose)` unique 키**로 조회(`WHERE persona_id = $1 AND purpose = $2 AND is_active = true LIMIT 1`)한다. `bot_personas`에는 `gen_model_id`/`censor_model_id` 컬럼이 없으므로(11.1 #5 정합), 11.9/11.10 파이프라인은 `persona.gen_model_id`를 읽지 않고 `getModelAssignment(db, personaId, 'generation')` / `'censor'`로 assignment 행을 얻어 `callModel`에 전달한다.
   - 해당 purpose의 할당이 없으면 `null` 반환 → 파이프라인은 잡을 `blocked`/`skipped` 처리하고 로그(모델 미할당 페르소나 방어).

4. `callModel` 호출 성공 후: (a) `bot_activity_log`(활동 로그)에 `event_type='cost'` 이벤트를 기록하고, (b) `bot_generation_jobs.cost`(생성 잡 비용 jsonb) 갱신 책임은 **호출자**(파이프라인)에 있다 — `callModel`은 `{ text, usage, costUsd }` 반환 후 `bot_activity_log` 기록만 수행. 일일 누적 비용 확인 함수 `checkDailyCostLimit()`가 `bot_activity_log` cost 이벤트를 합산하여 `bot_settings.bot_daily_cost_limit_usd`(일일 비용 상한)와 비교하며, 한도 도달 시 `BotCostLimitExceededError`를 던진다. `callModel` 호출 전 파이프라인이 이 함수를 선제 호출하여 잡을 중단+로그+리포트 경고 처리해야 함을 Dev Notes에 명시한다.

5. 모델명 하드코딩 금지: `callModel`은 `assignment.model`(DB에서 읽은 모델명)을 어댑터에 그대로 전달한다. 어댑터 내부에 모델 ID 상수를 선언하지 않는다. `costUsd`(달러 비용) 추정은 `estimateCostUsd(provider, model, inputTokens, outputTokens)` 함수로 분리하며, 알 수 없는 모델이면 `0`을 반환(차단 안 함 — fail-safe).

## Tasks / Subtasks

- [ ] Task 1: SDK 패키지 설치 (AC: #1, #2)
  - [ ] `pnpm --filter @ai-jakdang/api add openai @anthropic-ai/sdk @google/genai`
  - [ ] `apps/api/package.json` 의존성 추가 확인 (`dependencies` 섹션)
  - [ ] `pnpm --filter @ai-jakdang/config add @anthropic-ai/sdk` 불필요 — 키 검증만 config에서, SDK는 api에서만 사용

- [ ] Task 2: `packages/config/src/env.ts` — AI 키 추가 (AC: #2)
  - [ ] `envSchema` 에 아래 3개 키를 **optional** 로 추가 (미설정 시 앱 부팅 차단 안 됨):
    ```ts
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    ```
  - [ ] 추가 위치: `// S3 호환 스토리지` 섹션 앞, `// ── AI 프로바이더 (봇 AI 호출) ──` 섹션 주석과 함께
  - [ ] `Env` 타입 자동 반영 확인 (스키마 infer이므로 별도 수정 불필요)
  - [ ] `pnpm --filter @ai-jakdang/config tsc --noEmit` 통과

- [ ] Task 3: `AiProvider` 인터페이스 + `getProvider()` 팩토리 정의 (AC: #1)
  - [ ] server-only AI 경계 파일 신규 생성: `packages/server-bot/src/ai/index.ts`
    ```ts
    export interface AiTextRequest {
      system: string;
      user: string;
      model: string;          // bot_model_assignments.model 값 그대로
      maxTokens?: number;     // 기본값 어댑터가 정의
      temperature?: number;   // 기본값 어댑터가 정의
    }

    export interface AiTextResponse {
      text: string;
      usage: { inputTokens: number; outputTokens: number };
      costUsd: number;        // 달러 비용 추정(모름=0)
    }

    export interface AiImageRequest {
      prompt: string;
      model: string;
      n?: number;
      size?: string;
    }

    export interface AiImageResponse {
      url?: string;
      bytes?: string;       // base64
      costUsd: number;
    }

    export interface AiProvider {
      generateText(req: AiTextRequest): Promise<AiTextResponse>;
      generateImage?(req: AiImageRequest): Promise<AiImageResponse>;
    }
    ```
  - [ ] `getProvider(provider: 'openai' | 'anthropic' | 'google'): AiProvider` 팩토리 구현:
    - 지연 초기화(lazy singleton) 패턴 — `queues.ts`의 `getQueueConnection()` 패턴과 동일
    - 지원하지 않는 provider 문자열이면 `Error('지원하지 않는 AI 프로바이더: ${provider}')` throw
  - [ ] `callModel()`, `getModelAssignment(db, personaId, purpose)`, `checkDailyCostLimit()`, `estimateCostUsd()` 함수도 이 파일에서 export (`getModelAssignment`은 `(persona_id, purpose)` unique 조회 — #5 정합)
  - [ ] 파일 상단에 한국어 JSDoc: "ARCHITECTURE §4에 따라 생성 모델에 도구 권한 없음 — system+user 텍스트만 전달"

- [ ] Task 4: `estimateCostUsd()` 비용 추정 함수 구현 (AC: #5)
  - [ ] `packages/server-bot/src/ai/pricing.ts` 신규 생성:
    ```ts
    // 알려진 모델별 가격 (USD per 1M 토큰). 2026-06 기준 참고값.
    // 모델 라인업 변경 시 이 맵만 갱신.
    const PRICE_TABLE: Record<string, { input: number; output: number }> = {
      // OpenAI
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4.1': { input: 2.00, output: 8.00 },
      'gpt-4.1-mini': { input: 0.40, output: 1.60 },
      'gpt-4.1-nano': { input: 0.10, output: 0.40 },
      // Anthropic (claude-api 스킬로 최신 ID 확인할 것)
      'claude-haiku-4-5': { input: 0.80, output: 4.00 },
      'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
      'claude-opus-4-5': { input: 15.00, output: 75.00 },
      // Google Gemini
      'gemini-2.0-flash': { input: 0.075, output: 0.30 },
      'gemini-2.5-flash': { input: 0.15, output: 0.60 },
      'gemini-2.5-pro': { input: 1.25, output: 10.00 },
    };

    export function estimateCostUsd(
      _provider: string,
      model: string,
      inputTokens: number,
      outputTokens: number,
    ): number {
      const price = PRICE_TABLE[model];
      if (!price) return 0; // 알 수 없는 모델 — 차단 안 함(fail-safe)
      return (price.input * inputTokens + price.output * outputTokens) / 1_000_000;
    }
    ```
  - [ ] 가격 테이블은 참고값이며, 실제 모델 ID는 DB `bot_model_assignments.model`에서 읽음 — 절대 하드코딩 금지 원칙 준수

- [ ] Task 5: OpenAI 어댑터 구현 (AC: #1, #2)
  - [ ] `packages/server-bot/src/ai/adapters/openai.ts` 신규 생성:
    - `OpenAI` SDK import: `import OpenAI from 'openai'`
    - 지연 초기화 싱글톤(`_client: OpenAI | null = null`)
    - 키 미설정 확인: `if (!env.OPENAI_API_KEY) throw new Error('[ai/openai] OPENAI_API_KEY 미설정')`
    - `generateText` 구현:
      ```ts
      const completion = await client.chat.completions.create({
        model: req.model,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        max_tokens: req.maxTokens ?? 2000,
        temperature: req.temperature ?? 0.7,
        // tools 파라미터 절대 추가 금지 (ARCHITECTURE §4)
      });
      const text = completion.choices[0]?.message?.content ?? '';
      const usage = completion.usage!;
      return {
        text,
        usage: { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens },
        costUsd: estimateCostUsd('openai', req.model, usage.prompt_tokens, usage.completion_tokens),
      };
      ```
    - `generateImage` 구현 (DALL-E 3):
      ```ts
      const response = await client.images.generate({
        model: req.model,
        prompt: req.prompt,
        n: req.n ?? 1,
        size: (req.size as '1024x1024' | '1792x1024' | '1024x1792') ?? '1024x1024',
        response_format: 'url',
      });
      ```

- [ ] Task 6: Anthropic 어댑터 구현 (AC: #1, #2)
  - [ ] `packages/server-bot/src/ai/adapters/anthropic.ts` 신규 생성:
    - `import Anthropic from '@anthropic-ai/sdk'`
    - 키 미설정 확인: `if (!env.ANTHROPIC_API_KEY) throw new Error('[ai/anthropic] ANTHROPIC_API_KEY 미설정')`
    - `generateText` 구현:
      ```ts
      const message = await client.messages.create({
        model: req.model,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
        max_tokens: req.maxTokens ?? 2000,
        temperature: req.temperature ?? 0.7,
        // tools 파라미터 절대 추가 금지
      });
      const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
      return {
        text,
        usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
        costUsd: estimateCostUsd('anthropic', req.model, message.usage.input_tokens, message.usage.output_tokens),
      };
      ```
    - `generateImage` 미구현 (Anthropic은 텍스트 전용) — `undefined`로 두거나 throw

- [ ] Task 7: Gemini 어댑터 구현 (AC: #1, #2)
  - [ ] `packages/server-bot/src/ai/adapters/gemini.ts` 신규 생성:
    - `import { GoogleGenAI } from '@google/genai'`
    - 키 미설정 확인: `if (!env.GEMINI_API_KEY) throw new Error('[ai/gemini] GEMINI_API_KEY 미설정')`
    - `generateText` 구현:
      ```ts
      const genai = getClient(); // lazy singleton: new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
      const result = await genai.models.generateContent({
        model: req.model,
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        config: {
          systemInstruction: req.system,
          maxOutputTokens: req.maxTokens ?? 2000,
          temperature: req.temperature ?? 0.7,
          // tools 파라미터 절대 추가 금지
        },
      });
      const text = result.text ?? '';
      const inputTokens = result.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
      return {
        text,
        usage: { inputTokens, outputTokens },
        costUsd: estimateCostUsd('google', req.model, inputTokens, outputTokens),
      };
      ```
    - 주의: `@google/genai` v1.x API — `genai.models.generateContent()` 호출 방식 사용. 구버전(`@google/generative-ai`)과 혼동 금지.

- [ ] Task 8: `getBotSetting()` 유틸 구현 (AC: #4)
  - [ ] `apps/api/src/lib/botSettings.ts` 신규 생성:
    - `getSiteSetting()` (`apps/api/src/lib/siteSettings.ts`) 패턴을 그대로 따름
    - 대상 테이블: `botSettings`(DB 테이블 `bot_settings`, key-value jsonb, Story 11.1 정의)
    - `getBotSetting<T>(key: string): Promise<T | null>` — Redis 60초 캐시(prefix: `bot_settings:`) + DB 폴백
    - `invalidateBotSetting(key: string): Promise<void>`
    - `bot_settings` 테이블 import: `import { botSettings } from '@ai-jakdang/database/schema'`

- [ ] Task 9: `callModel()` + `checkDailyCostLimit()` 고수준 함수 구현 (AC: #3, #4)
  - [ ] `packages/server-bot/src/ai/index.ts`에 추가:

    **`callModel(assignment, prompt, opts?) → AiTextResponse`**
    ```ts
    export async function callModel(
      assignment: { provider: string; model: string; id?: string },
      prompt: { system: string; user: string; maxTokens?: number; temperature?: number },
      opts?: { personaId?: string; jobId?: string },
    ): Promise<AiTextResponse> {
      const provider = getProvider(assignment.provider as 'openai' | 'anthropic' | 'google');
      const response = await provider.generateText({ ...prompt, model: assignment.model });

      // bot_activity_log에 cost 이벤트 기록 (best-effort, 실패 시 로그만)
      if (opts?.personaId) {
        await recordCostEvent({
          personaId: opts.personaId,
          jobId: opts.jobId,
          provider: assignment.provider,
          model: assignment.model,
          ...response.usage,
          costUsd: response.costUsd,
        }).catch((err) => console.error('[ai/callModel] cost 로그 기록 실패:', err));
      }

      return response;
    }
    ```

    **`checkDailyCostLimit()`**
    ```ts
    export async function checkDailyCostLimit(): Promise<void> {
      const limitUsd = await getBotSetting<number>('bot_daily_cost_limit_usd');
      if (limitUsd == null) return; // 미설정 시 제한 없음

      const db = getDb();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // bot_activity_log WHERE event_type='cost' AND created_at >= 오늘 0시
      const rows = await db
        .select({ payload: botActivityLog.payload })
        .from(botActivityLog)
        .where(
          and(
            eq(botActivityLog.eventType, 'cost'),
            gte(botActivityLog.createdAt, todayStart),
          ),
        );

      const totalCostUsd = rows.reduce((sum, r) => {
        const p = r.payload as { costUsd?: number } | null;
        return sum + (p?.costUsd ?? 0);
      }, 0);

      if (totalCostUsd >= limitUsd) {
        throw new BotCostLimitExceededError(
          `일일 비용 상한 $${limitUsd} 도달 (현재 $${totalCostUsd.toFixed(4)}). 신규 생성 잡 중단.`,
        );
      }
    }

    export class BotCostLimitExceededError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'BotCostLimitExceededError';
      }
    }
    ```

  - [ ] `recordCostEvent()` 내부 helper:
    ```ts
    async function recordCostEvent(p: {
      personaId: string;
      jobId?: string;
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    }) {
      const db = getDb();
      await db.insert(botActivityLog).values({
        personaId: p.personaId,
        eventType: 'cost',
        refId: p.jobId ?? null,
        payload: {
          provider: p.provider,
          model: p.model,
          inputTokens: p.inputTokens,
          outputTokens: p.outputTokens,
          costUsd: p.costUsd,
        },
      });
    }
    ```

- [ ] Task 10: 단위 테스트 작성 (AC: #2)
  - [ ] `packages/server-bot/src/ai/adapters/openai.test.ts` 신규 생성:
    - `vi.mock('openai')` 로 SDK 모킹
    - 키 미설정 시 에러 throw 테스트
    - `generateText` 성공 시 `{ text, usage, costUsd }` 반환 형태 테스트
    - tools 파라미터 없음 검증: `expect(mockCreate).not.toHaveBeenCalledWith(expect.objectContaining({ tools: expect.anything() }))`
  - [ ] `packages/server-bot/src/ai/adapters/anthropic.test.ts` 신규 생성 (동일 패턴)
  - [ ] `packages/server-bot/src/ai/adapters/gemini.test.ts` 신규 생성 (동일 패턴)
  - [ ] `packages/server-bot/src/ai/index.test.ts` 신규 생성:
    - `callModel` — 올바른 provider로 라우팅 되는지 테스트 (adapter mock 주입)
    - `checkDailyCostLimit` — DB mock으로 한도 초과/미초과 두 케이스
    - `estimateCostUsd` — 알려진 모델과 알 수 없는 모델(0 반환) 테스트
  - [ ] `pnpm --filter @ai-jakdang/api vitest run` 전체 통과

- [ ] Task 11: TypeScript 검사 (AC: 전체)
  - [ ] `pnpm --filter @ai-jakdang/api tsc --noEmit` 통과
  - [ ] `pnpm --filter @ai-jakdang/config tsc --noEmit` 통과

## Dev Notes

### 의존성 순서 및 전제조건

이 스토리는 **그룹 B의 첫 번째 스토리**이며, 그룹 A(11.1~11.5) 전체가 완료된 상태에서 시작한다.

전제 조건 (착수 전 확인):
- `packages/database/src/schema/bot.ts` 존재 — `botActivityLog`(활동 로그), `botGenerationJobs`(생성 작업), `botSettings`(전역 설정), `botModelAssignments`(모델 할당) 테이블 정의됨 (Story 11.1)
- `packages/contracts/src/bot.ts` 존재 — `BotModelAssignment`(모델 할당 타입), `BotProvider`(프로바이더 타입) 등 Zod 스키마 정의됨 (Story 11.2)
- `apps/api/src/middleware/contentGuard.ts`에서 `runContentGuard()` 추출됨 (Story 11.3)

### 아키텍처 가드레일

1. **도구/함수콜 절대 비활성** (ARCHITECTURE §4 핵심 원칙):
   - 세 어댑터 모두 SDK 호출 시 `tools`, `functions`, `tool_choice` 등 파라미터를 전달하지 않는다.
   - 생성 모델이 DB·env·관리자 설정에 접근하는 경로를 완전히 차단한다.
   - system 프롬프트 + 비신뢰 입력 블록만 전달한다(ARCHITECTURE §4: "격리").

2. **모델명 하드코딩 금지** (ARCHITECTURE §4):
   - `callModel(assignment, prompt)` 는 `assignment.model` 값을 어댑터에 그대로 전달한다.
   - `pricing.ts`의 `PRICE_TABLE`은 비용 추정용이며, 실제 허용 모델 목록은 DB `bot_model_assignments`가 관리한다.
   - 최신 모델 ID 확인은 `claude-api` 스킬 참고. 단, 이 스토리는 모델 ID를 코드에 주입하지 않는다.

3. **env 단일 진입점** (project-context §패키지 경계):
   - `process.env.OPENAI_API_KEY` 직접 접근 금지.
   - `import { env } from '@ai-jakdang/config'` 로만 읽는다.
   - 키 누락 시 부팅 차단 안 함(optional) — 실제 AI 호출 시점에 에러 throw (ARCHITECTURE §8: "부분 가동 허용").

4. **DB 접근 경계** (project-context §2):
   - `botActivityLog` INSERT는 `packages/server-bot/src/ai/index.ts`에서 수행한다. 이 패키지는 server-only이며 `apps/api`·`apps/worker`만 import 가능하다.
   - `apps/web`·`apps/admin`이 이 모듈을 import하면 안 된다. 패키지 export/tsconfig/package.json으로 client 번들 유입을 차단한다.

5. **fail-safe 원칙** (ARCHITECTURE §11):
   - cost 로그 기록 실패(`recordCostEvent`) 시 AI 호출 결과는 반환하되 에러 로그만 남긴다(게시 블록 안 함).
   - `checkDailyCostLimit()` 자체가 DB 장애로 실패하면 제한 없이 통과시킨다(안전 우선 — 비용 초과보다 사이트 다운 방지 우선).

### 호출 흐름 및 비용 누적 책임 분리

```
파이프라인(Story 11.9/11.10 worker processor)
  ├─ 1. checkDailyCostLimit()  ← 한도 도달 시 BotCostLimitExceededError → skip+log
  ├─ 2. callModel(assignment, prompt, { personaId, jobId })
  │      └─ AI SDK 호출 → AiTextResponse 반환
  │      └─ recordCostEvent({ personaId, jobId, ...usage, costUsd })  [best-effort]
  └─ 3. (파이프라인 책임) bot_generation_jobs.cost jsonb 갱신
         cost = { ...기존cost, items: [...기존items, { phase, costUsd, model }] }
```

`bot_generation_jobs.cost`(생성 잡 비용) 갱신은 `callModel`이 하지 않는다. 파이프라인(Story 11.9)이 여러 phase(작성·검열·이미지)의 비용을 한 job에 누적하므로, 파이프라인에서 직접 UPDATE 처리한다.

### Worker 접근 패턴 (Story 11.13 선행 결정 필요)

실제 AI 호출은 `apps/worker`의 봇 processor에서 발생하므로 worker가 `apps/api/src/lib/ai/`를 직접 import하면 레이어 경계가 깨진다. 구현 전 아래 방향으로 확정한다.

- **확정안**: AI/search/image/봇 작성 공용 서버 로직을 `packages/server-bot` 같은 server-only 패키지로 둔다. `apps/api`와 `apps/worker`만 import하고, `apps/web`/`apps/admin`은 import 금지.
- 레포 구조상 부득이하게 임시 구현이 필요해도 worker processor 연결 전 반드시 공용 패키지로 이동하거나 server-only re-export를 만든다. 문서·코드에 TODO를 남기고 직접 상대경로 import는 금지한다.

**이 스토리의 완료 조건**: `callModel`, `getModelAssignment`, `checkDailyCostLimit`의 최종 import 경로가 11.9/11.10 worker 스토리에서 사용할 수 있는 server-only 경계로 명시돼 있어야 한다.

### `getBotSetting()` vs `getSiteSetting()` 분리 이유

`bot_settings`(봇 전역 설정)는 `site_settings`(사이트 설정)와 **별도 테이블**이다(ARCHITECTURE §2.10). `getSiteSetting()`을 재사용할 수 없으므로 `getBotSetting()`을 이 스토리에서 신규 생성한다. 구현은 `siteSettings.ts`를 그대로 복사하되, 테이블만 `botSettings`로 변경, Redis 캐시 prefix는 `bot_settings:`.

### 비용 추정 한계

`pricing.ts`의 가격 테이블은 2026-06 기준 근사값이다. 실제 청구 금액과 다를 수 있다.
- 알 수 없는 모델 ID는 `costUsd=0`을 반환 — 비용 추적이 안 되지만 생성 잡을 막지 않는다.
- 운영 단계에서 더 정밀한 비용 추적이 필요하면 `bot_model_assignments` 테이블에 `price_input_per_m`·`price_output_per_m` 컬럼을 추가하고 `pricing.ts` 대신 DB에서 읽도록 변경한다(이 스토리 범위 밖).

### `checkDailyCostLimit()` 호출 시점 — 파이프라인 규약

Story 11.9(글 생성 파이프라인)·11.10(댓글 파이프라인) 구현 시 반드시 AI 호출 **전에** 호출해야 한다:

```ts
// Story 11.9·11.10 processor 패턴 (참고)
try {
  await checkDailyCostLimit();  // 한도 초과 시 throw
} catch (err) {
  if (err instanceof BotCostLimitExceededError) {
    await db.insert(botActivityLog).values({ eventType: 'skipped', payload: { reason: 'cost_limit' } });
    // 리포트 경고 플래그 설정 (Story 11.17 집계 대상)
    return; // 잡 종료
  }
  throw err; // 그 외 DB 오류는 재throw → BullMQ retry
}
```

### 파일 구조 (신규 생성)

```
apps/api/src/lib/
├── ai/
│   ├── index.ts            # AiProvider 인터페이스, getProvider(), callModel(),
│   │                       # checkDailyCostLimit(), BotCostLimitExceededError, recordCostEvent()
│   ├── pricing.ts          # estimateCostUsd() + PRICE_TABLE
│   ├── adapters/
│   │   ├── openai.ts       # OpenAI SDK 래퍼
│   │   ├── anthropic.ts    # Anthropic SDK 래퍼
│   │   └── gemini.ts       # Google GenAI SDK 래퍼
│   ├── index.test.ts
│   ├── adapters/
│   │   ├── openai.test.ts
│   │   ├── anthropic.test.ts
│   │   └── gemini.test.ts
└── botSettings.ts          # getBotSetting() / invalidateBotSetting() (siteSettings.ts 패턴)

packages/config/src/
└── env.ts                  # OPENAI_API_KEY·ANTHROPIC_API_KEY·GEMINI_API_KEY 추가 (optional)
```

### 테스트 패턴 참고

기존 `apps/api/src/lib/notifications.test.ts` 패턴 준용:
- `import { describe, it, expect, vi, beforeEach } from 'vitest'`
- DB mock: `vi.fn().mockResolvedValue(...)` / `vi.fn().mockReturnValue({ ... })` 체이닝
- SDK mock: `vi.mock('openai', () => ({ default: vi.fn(...) }))` 방식

**AI SDK 모킹 시 주의**: `openai`, `@anthropic-ai/sdk`, `@google/genai` 모두 default export이므로 `{ default: ... }` 형태로 mock factory를 구성한다.

### `.env.example` 업데이트

`D:\projects\AIjackdang\.env.example`(리포 루트)에 아래 섹션 추가:
```bash
# ── AI 프로바이더 (봇 글·댓글·검열·이미지 생성) ──
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```
ARCHITECTURE §8에 이미 명시된 항목이므로 기존 `.env.example`에 없다면 추가한다.

### Project Structure Notes

- 기존 `apps/api/src/lib/` 파일들: `queues.ts`, `redis.ts`, `siteSettings.ts` — 이 스토리에서 직접 수정하는 파일 없음. `botSettings.ts`만 신규 추가.
- `packages/config/src/env.ts`만 UPDATE (3줄 추가).
- `apps/api/package.json` UPDATE (dependencies에 SDK 추가).
- 나머지 파일 전부 신규 생성(NEW).
- `packages/bot-core`는 이 스토리 범위 밖 — 순수 함수(인젝션 필터·자기검열 규칙 등)는 다른 스토리에서 생성.

### References

- [Source: docs/seeding-bot/ARCHITECTURE.md#4] — AI 추상화 레이어 설계 (인터페이스·어댑터·격리 원칙)
- [Source: docs/seeding-bot/ARCHITECTURE.md#0] — 설계 원칙 §4 (도구 권한 없음) §7 (타입은 contracts 단일 진입점)
- [Source: docs/seeding-bot/ARCHITECTURE.md#8] — 환경변수 목록 (AI 키 3종)
- [Source: docs/seeding-bot/ARCHITECTURE.md#2.6] — `bot_model_assignments` 테이블 스키마
- [Source: docs/seeding-bot/ARCHITECTURE.md#2.9] — `bot_activity_log` 테이블 스키마
- [Source: docs/seeding-bot/ARCHITECTURE.md#2.10] — `bot_settings` 키 목록 (`bot_daily_cost_limit_usd`)
- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.6] — AC 원문
- [Source: apps/api/src/lib/siteSettings.ts] — `getBotSetting()` 구현 참조 패턴
- [Source: apps/api/src/lib/queues.ts] — 지연 초기화 싱글톤 패턴
- [Source: apps/api/src/middleware/contentGuard.ts] — `env` 단일 진입점 + optional 키 패턴
- [Source: packages/config/src/env.ts] — `z.string().optional()` 패턴 및 기존 optional 키 목록
- [Source: apps/api/src/lib/notifications.test.ts] — vitest 모킹 패턴
- [Source: apps/worker/src/index.ts] — Worker 등록 패턴 (Story 11.13 참고용)
- [Source: apps/worker/src/schedules/ranking.cron.ts] — cron 등록 패턴 (Story 11.13 참고용)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

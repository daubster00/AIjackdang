# Story 11.8: 이미지 엔진 (스톡·AI생성·무이미지·썸네일 연동)

Status: done

## Story

As a 시딩 봇 파이프라인,
I want 글 성격에 맞는 이미지를 자동으로 조달·업로드하고 본문에 삽입하기,
so that 봇 게시글에 맥락에 맞는 이미지가 붙고 기존 썸네일 추출 로직이 자동으로 작동한다.

---

## Acceptance Criteria

1. server-only 이미지 경계(`packages/server-bot/src/images/`)에 `stock.ts`를 구현한다. worker가 `apps/api/src/*`를 직접 import하는 구조는 금지한다. Unsplash API(`UNSPLASH_ACCESS_KEY`)와 Pexels API(`PEXELS_API_KEY`) 두 소스를 지원한다. **무료 라이선스(Unsplash License / Pexels License) 이미지만** 반환한다. 키가 없으면 해당 소스는 건너뛴다(graceful skip). 두 키가 모두 없으면 `null` 반환.

2. 같은 server-only 이미지 경계에 `generate.ts`를 구현한다. Story 11.6이 정의한 `AiProvider.generateImage()` 인터페이스를 통해 **OpenAI DALL-E** 엔드포인트를 호출한다(`OPENAI_API_KEY` 재사용). 이미지 생성 비용(`costUsd`)을 `bot_generation_jobs.cost` jsonb 필드에 누적 기록한다. 키 없으면 `null` 반환.

3. 같은 server-only 이미지 경계의 `strategy.ts`에 `decideImageStrategy(persona, board, postKind)` 함수를 구현한다. 반환 타입은 `'stock' | 'ai' | 'none' | 'meme'`. 아래 규칙을 **이 순서대로** 적용한다:
   - `board === 'ai-creation'` → 무조건 `'ai'`
   - `persona.is_admin_persona === true` → 무조건 `'ai'`
   - `postKind === 'qna'` 또는 글이 매우 짧은 잡담(`info_ratio < 20`) → `'none'`
   - `persona.nickname === '냉장고털이'` 또는 (`info_ratio < 15` && `board === 'talk'`) → `'meme'`
   - `info_ratio >= 40` (정보형 글) → `'stock'`
   - 그 외(잡담형, 짧은 후기 등) → `'none'`

4. server-only 이미지 경계의 `index.ts`에 `fetchBotImage(params)` 통합 함수를 구현한다. 이 함수는:
   - `decideImageStrategy`로 전략 결정
   - `'stock'`: `pickStock(keyword)` → 외부 URL에서 이미지 데이터 fetch → `uploadImage(file, 'editor-images')` (기존 스토리지 서비스 재사용) → S3 공개 URL 반환
   - `'ai'`: `genImage(prompt)` → OpenAI URL에서 이미지 데이터 fetch → `uploadImage(file, 'editor-images')` 업로드 → S3 공개 URL 반환 + 비용 기록
   - `'none'`: `null` 반환 (이미지 없음)
   - `'meme'`: 외부 URL을 그대로 사용(S3 업로드 없음)하고 `{ imageUrl, isMeme: true, holdReason: 'copyright_risk' }` 반환. **이미지 엔진이 `bot_hold_queue`에 직접 INSERT하지 않는다.** 실제 보류 큐 적재는 `bot_generation_jobs.id`가 있는 Story 11.9 파이프라인이 수행한다.

5. 같은 server-only 이미지 경계의 `tiptap.ts`에 `prependImageToTiptapDoc(doc, imageUrl, altText?)` 함수를 구현한다. Tiptap JSON doc의 `content` 배열 맨 앞에 `{ type: "image", attrs: { src: imageUrl, alt: altText ?? null, title: null } }` 노드를 삽입하고 변경된 doc을 반환한다. 이렇게 되면 `createPost()` 내부의 기존 `extractFirstImageUrl(contentJson)` 호출이 자동으로 이 이미지를 썸네일 URL로 추출한다. 이미지가 없을 때(`null` 반환 시) doc을 변경하지 않는다.

6. `packages/config/src/env.ts`에 아래 env 키를 **optional** Zod 필드로 추가한다(부팅 차단 없음, 사용 시점에 에러):
   - `UNSPLASH_ACCESS_KEY` — Unsplash 스톡 API 키
   - `PEXELS_API_KEY` — Pexels 스톡 API 키
   - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` — AI 프로바이더 키 (Story 11.6과 공유, 이미 추가되어 있으면 중복 추가 금지)

---

## Tasks / Subtasks

### Task 1: `packages/config/src/env.ts` 봇 관련 키 추가 (AC: #6)

- [x] 1.1 `env.ts`의 `envSchema` 객체 안에 이미 `OPENAI_API_KEY`가 있으면 건너뜀. 없으면 추가:
  ```typescript
  OPENAI_API_KEY:      z.string().optional(),
  ANTHROPIC_API_KEY:   z.string().optional(),
  GEMINI_API_KEY:      z.string().optional(),
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  PEXELS_API_KEY:      z.string().optional(),
  ```
  **확인 결과**: `env.ts`에 이미 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY` 모두 optional로 존재. 추가 불필요.

- [x] 1.2 `.env.example` 파일에 이미 시딩봇 섹션 주석이 있고 두 키가 있으므로 별도 수정 불필요.

### Task 2: server-only `images/stock.ts` 구현 (AC: #1)

- [x] 2.1 파일 생성: `packages/server-bot/src/image/stock.ts` (worker 직접 `apps/api/src/*` import 금지)
  ※ 디렉터리는 `image/` (스텁 위치·package.json exports 기준)

- [x] 2.2 `pickStock(keyword: string): Promise<StockImage | null>` 구현.
  - `StockImage` 인터페이스:
    ```typescript
    export interface StockImage {
      url: string;        // 원본 이미지 직접 URL (다운로드 가능)
      source: 'unsplash' | 'pexels';
      altText: string | null;
      downloadUrl?: string; // Unsplash는 download endpoint 별도 호출 필요
    }
    ```
  - Unsplash 시도 우선 (`UNSPLASH_ACCESS_KEY` 있을 때):
    - `GET https://api.unsplash.com/search/photos?query=<keyword>&per_page=5&orientation=landscape`
    - 헤더: `Authorization: Client-ID <UNSPLASH_ACCESS_KEY>`
    - 응답: `results[n].urls.regular` (이미지 URL), `results[n].alt_description` (대체 텍스트), `results[n].links.download` (다운로드 엔드포인트 — Unsplash API 정책상 반드시 트리거해야 함)
    - 랜덤으로 1개 선택 후 `source='unsplash'` 반환
  - Unsplash 키 없거나 결과 없으면 Pexels 시도 (`PEXELS_API_KEY` 있을 때):
    - `GET https://api.pexels.com/v1/search?query=<keyword>&per_page=5&orientation=landscape`
    - 헤더: `Authorization: <PEXELS_API_KEY>`
    - 응답: `photos[n].src.large` (이미지 URL), `photos[n].alt` (대체 텍스트)
    - 랜덤으로 1개 선택 후 `source='pexels'` 반환
  - 두 키 모두 없거나 결과 없으면 `null` 반환.
  - 모든 HTTP 에러는 `try/catch` 후 `null` 반환(봇 글 게시 차단 금지).

- [x] 2.3 Unsplash download 엔드포인트 트리거: index.ts fetchBotImage에서 fire-and-forget 처리.

- [x] 2.4 env 읽기: `env.UNSPLASH_ACCESS_KEY`, `env.PEXELS_API_KEY` (`@ai-jakdang/config`) 사용.

### Task 3: server-only `images/generate.ts` 구현 (AC: #2)

- [x] 3.1 파일 생성: `packages/server-bot/src/image/generate.ts`

- [x] 3.2 `genImage(params: GenImageParams): Promise<GenImageResult | null>` 구현.
  - 입력 타입:
    ```typescript
    export interface GenImageParams {
      prompt: string;         // 이미지 생성 프롬프트
      jobId?: string;         // bot_generation_jobs.id — 비용 기록 대상
    }
    ```
  - 출력 타입:
    ```typescript
    export interface GenImageResult {
      url: string;            // OpenAI가 반환한 임시 URL (만료 전에 다운로드 필요)
      costUsd: number;        // 이미지 생성 비용 (달러)
    }
    ```
  - Story 11.6의 `getProvider('openai')` 호출 후 `generateImage!({ prompt, size: '1024x1024', quality: 'standard', n: 1 })` 실행.
  - `generateImage`는 `AiProvider` 인터페이스의 optional 메서드이므로 존재 확인 후 호출: `if (!provider.generateImage) return null`.
  - `OPENAI_API_KEY` 미설정 시 `getProvider('openai')` 단계에서 에러 throw → `try/catch`로 잡아 `null` 반환.
  - **비용 기록**: `jobId`가 있으면 `bot_generation_jobs` 테이블의 `cost` jsonb 필드를 업데이트:
    ```typescript
    // 기존 cost에 imageGen 항목 병합
    await db.update(schema.botGenerationJobs)
      .set({
        cost: sql`${schema.botGenerationJobs.cost} || ${JSON.stringify({
          imageGen: { provider: 'openai', model: 'dall-e-3', costUsd }
        })}::jsonb`
      })
      .where(eq(schema.botGenerationJobs.id, jobId));
    ```
  - 구현 노트: 11.6 stub이므로 getProvider() 대신 OpenAI DALL-E 직접 fetch 구현. 11.6 완성 후 교체 예정. bot_generation_jobs.cost jsonb COALESCE 병합 패턴 사용. graceful skip 구현 완료.

- [x] 3.3 OpenAI DALL-E 비용 상수 정의:
  ```typescript
  // 2025년 기준 DALL-E 3 표준 품질 1024x1024 단가
  const DALLE3_STANDARD_1024_COST_USD = 0.04;
  ```
  실제 비용은 OpenAI 응답에 포함되지 않으므로 상수 사용. 나중에 DB 설정으로 이동 가능하도록 주석 명시.

### Task 4: server-only `images/strategy.ts` 구현 (AC: #3)

- [x] 4.1 파일 생성: `packages/server-bot/src/image/strategy.ts`

- [x] 4.2 입력 타입 정의:
  ```typescript
  export interface PersonaContext {
    nickname: string;
    is_admin_persona: boolean;
    info_ratio: number;           // 0~100: 정보형 vs 잡담형 비율
  }

  export type ImageStrategy = 'stock' | 'ai' | 'none' | 'meme';

  export type PostKind = 'post' | 'qna' | 'comment' | 'reply';
  ```

- [x] 4.3 `decideImageStrategy(persona: PersonaContext, board: string, postKind: PostKind): ImageStrategy` 구현. 우선순위 순서:
  ```
  1. board === 'ai-creation'                         → 'ai'
  2. persona.is_admin_persona === true               → 'ai'
  3. postKind === 'qna' || postKind === 'comment' || postKind === 'reply'  → 'none'
  4. persona.info_ratio < 20                         → 'none'   (너무 짧은 잡담)
  5. persona.nickname === '냉장고털이'                 → 'meme'  (밈 특화 캐릭터)
  6. persona.info_ratio < 15 && board === 'talk'     → 'meme'
  7. persona.info_ratio >= 40                        → 'stock'
  8. 기본값                                          → 'none'
  ```

  - [x] 4.4 단위 테스트 파일 생성: `packages/server-bot/src/image/strategy.test.ts`. 22개 케이스 통과.
  - `board='ai-creation'` → `'ai'` ✓
  - `is_admin_persona=true` → `'ai'` ✓
  - `nickname='냉장고털이'` → `'meme'` ✓
  - `info_ratio=80, board='automation-cases'` → `'stock'` ✓
  - `postKind='qna'` → `'none'` ✓

### Task 5: Tiptap 이미지 삽입 헬퍼 (AC: #5)

- [x] 5.1 파일 생성: `packages/server-bot/src/image/tiptap.ts`

- [x] 5.2 `prependImageToTiptapDoc(doc: Record<string, unknown>, imageUrl: string, altText?: string): Record<string, unknown>` 구현:
  ```typescript
  export function prependImageToTiptapDoc(
    doc: Record<string, unknown>,
    imageUrl: string,
    altText?: string,
  ): Record<string, unknown> {
    const imageNode = {
      type: 'image',
      attrs: { src: imageUrl, alt: altText ?? null, title: null },
    };
    const existingContent = Array.isArray(doc.content) ? doc.content : [];
    return { ...doc, content: [imageNode, ...existingContent] };
  }
  ```
  ⚠️ Tiptap image 노드의 `attrs.src`가 존재해야 `extractFirstImageUrl()`이 이를 썸네일로 추출한다. 타입은 `string` 이어야 한다.

- [x] 5.3 `extractFirstImageUrl` 동작 확인: `{ type: 'image', attrs: { src: imageUrl } }` 노드 구조가 조건을 정확히 만족. `prependImageToTiptapDoc` 결과물 호환 확인.

### Task 6: server-only `images/index.ts` 통합 함수 구현 (AC: #4)

- [x] 6.1 파일 생성: `packages/server-bot/src/image/index.ts` (기존 stub 교체)

- [x] 6.2 외부 URL에서 이미지 데이터 다운로드 헬퍼:
  ```typescript
  async function downloadImageFromUrl(url: string): Promise<{ data: Buffer; mimetype: string; filename: string } | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') ?? 'image/jpeg';
      const mimetype = contentType.split(';')[0].trim();
      const data = Buffer.from(await res.arrayBuffer());
      const ext = mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
      return { data, mimetype, filename: `bot-image.${ext}` };
    } catch {
      return null;
    }
  }
  ```

- [x] 6.3 `FetchBotImageParams` 타입 정의:
  ```typescript
  export interface FetchBotImageParams {
    persona: PersonaContext;      // 페르소나 컨텍스트
    board: string;                // 대상 게시판 슬러그
    postKind: PostKind;           // 글 종류
    keyword: string;              // 스톡 이미지 검색 키워드 (주제 title_seed에서 유래)
    aiPrompt?: string;            // AI 이미지 생성 프롬프트 (board='ai-creation' 등)
    jobId?: string;               // bot_generation_jobs.id — 비용 기록용
  }

  export interface FetchBotImageResult {
    imageUrl: string | null;      // 최종 S3 URL 또는 외부 URL (meme 경우), 없으면 null
    strategy: ImageStrategy;      // 적용된 전략
    isMeme: boolean;              // true면 copyright_risk 보류 큐 적재 필요
  }
  ```

- [x] 6.4 `fetchBotImage(params: FetchBotImageParams): Promise<FetchBotImageResult>` 구현:
  ```
  1. strategy = decideImageStrategy(persona, board, postKind)
  
  2-A. strategy === 'stock':
    - image = await pickStock(keyword)
    - image가 null이면 { imageUrl: null, strategy: 'stock', isMeme: false } 반환
    - downloaded = await downloadImageFromUrl(image.url)
    - downloaded가 null이면 imageUrl: null 반환
    - { url } = await uploadImage({ filename: downloaded.filename, mimetype: downloaded.mimetype, data: downloaded.data }, 'editor-images')
    - Unsplash downloadUrl이 있으면 fire-and-forget fetch(image.downloadUrl)
    - return { imageUrl: url, strategy: 'stock', isMeme: false }
  
  2-B. strategy === 'ai':
    - prompt = aiPrompt ?? `high quality illustration for article: ${keyword}`
    - result = await genImage({ prompt, jobId })
    - result가 null이면 imageUrl: null 반환
    - downloaded = await downloadImageFromUrl(result.url)
    - downloaded가 null이면 imageUrl: null 반환
    - { url } = await uploadImage({ ... }, 'editor-images')
    - return { imageUrl: url, strategy: 'ai', isMeme: false }
  
  2-C. strategy === 'none':
    - return { imageUrl: null, strategy: 'none', isMeme: false }
  
  2-D. strategy === 'meme':
    - return { imageUrl: null, strategy: 'meme', isMeme: true }
    - ※ 외부 밈 URL 소스가 없으므로 imageUrl은 null. 실제 밈 이미지는 글 생성 파이프라인(11.9)에서
      냉장고털이가 본문에 직접 삽입하는 방식으로 처리한다.
    - 호출자(11.9)가 isMeme=true를 보고 copyright_risk 보류 큐 적재 여부를 결정.
  ```
  - 모든 단계에서 예외 발생 시 `try/catch` 후 `{ imageUrl: null, strategy, isMeme: false }` 반환. 이미지 실패로 글 게시 자체가 막히면 안 됨.

  - [x] 6.5 `uploadImage` 주입 패턴 구현: `UploadImageFn` 타입 정의 후 `FetchBotImageParams.uploadFn`으로 주입. apps/api 직접 import 없이 경계 준수. 11.9 파이프라인에서 `uploadImage`를 주입하도록 코드 주석 문서화.

### Task 7: `copyright_risk` 보류 큐 연결 문서화 (AC: #4)

- [x] 7.1 index.ts에 코드 주석으로 명시: "isMeme=true 반환 시 bot_hold_queue INSERT는 Story 11.9 파이프라인 담당".

- [x] 7.2 index.ts 상단 주석에 11.9 구현 시 참고할 uploadFn 주입 방법과 보류 큐 적재 인터페이스 문서화 완료.

### Task 8: 검증

- [x] 8.1 `pnpm --filter @ai-jakdang/server-bot typecheck` 에러 없음 (0 오류).
- [x] 8.2 `strategy.test.ts` 22개 케이스 전부 통과 (4ms).
- [ ] 8.3 실제 키 설정 후 pickStock 수동 확인 — 사용자 영역 (실 API 키 필요).
- [x] 8.4 prependImageToTiptapDoc 결과: { type:'image', attrs:{ src:url } } 노드가 content[0]으로 삽입 → extractFirstImageUrl 조건 만족 확인.
- [x] 8.5 두 키 모두 미설정 시 pickStock → null 반환 로직 구현 확인 (try/catch + key guard).

---

## Dev Notes

### 선행 의존성

| 의존 스토리 | 이유 |
|---|---|
| Story 11.1 | `bot_generation_jobs` 테이블(비용 기록), `bot_hold_queue` 테이블(copyright_risk) 정의 |
| Story 11.6 | `AiProvider` 인터페이스, `getProvider()`, 어댑터 구현 필요. `generate.ts`는 11.6 완료 후에야 `getProvider('openai')` 호출 가능. **11.6 미완 시**: `generate.ts`를 stub로 구현하고(`return null`), 11.6 완료 후 연결. |

그룹 B(11.6, 11.7, 11.8)는 병렬 실행 가능하지만, `generate.ts`의 `getProvider()` 호출은 11.6 파일이 존재해야 한다. 임시로 stub를 먼저 배치하거나, 11.6 → 11.8 순서로 진행할 것.

### 기존 업로드 서비스 재사용 (핵심)

```
apps/api/src/services/storage/index.ts
  └── uploadImage(file: ParsedFile, subdir: 'avatars' | 'banners' | 'editor-images' | 'attachments'): Promise<UploadResult>
```

- `ParsedFile`: `{ filename: string; mimetype: string; data: Buffer }`
- `UploadResult`: `{ url: string; filename: string }`
- S3 설정 있으면 MinIO/R2 공개 버킷에 업로드, 없으면 `apps/api/uploads/editor-images/` 로컬 폴백.
- **반드시 `'editor-images'` subdir 사용.** `attachments`는 게시글 첨부파일용이며 게시글당 5개 제한 로직이 다름.
- [Source: apps/api/src/services/storage/index.ts]

### 썸네일 자동 처리 메커니즘

```
prependImageToTiptapDoc(doc, imageUrl)
    ↓
contentJson.content[0] = { type: 'image', attrs: { src: imageUrl } }
    ↓
createPost() 내부의 extractFirstImageUrl(contentJson) 호출
    ↓
posts.thumbnail_url = imageUrl (자동 저장)
```

별도 썸네일 설정 코드 불필요. `createPostAsBot()`이 `createPost()`를 통과하면 자동으로 처리된다. 이미지가 없을 때(`imageUrl = null`) doc을 그대로 전달하면 `extractFirstImageUrl` 반환값도 `null`이 되어 `thumbnail_url = null`(기본 빈 썸네일).

[Source: apps/api/src/lib/extract-first-image.ts]
[Source: apps/api/src/routes/v1/posts/service.ts#createPost — line 317: `const thumbnailUrl = extractFirstImageUrl(contentJson)`]

### AiProvider 인터페이스 (11.6 정의)

```typescript
// server-only AI boundary (Story 11.6 생성)
interface AiProvider {
  generateText(req: { system: string; user: string; model: string; maxTokens: number; temperature?: number })
    : Promise<{ text: string; usage: { inputTokens: number; outputTokens: number }; costUsd: number }>
  generateImage?(req: { prompt: string; size?: string; quality?: string; n?: number })
    : Promise<{ url?: string; bytes?: Buffer; costUsd: number }>
}

function getProvider(providerName: 'openai' | 'anthropic' | 'google'): AiProvider
```

`generateImage`는 optional 메서드이므로 반드시 `provider.generateImage?.()` 또는 존재 확인 후 호출.

[Source: docs/seeding-bot/ARCHITECTURE.md#4-AI-추상화-레이어]

### `bot_generation_jobs.cost` 비용 누적 패턴

```typescript
// jsonb 병합 패턴 (Drizzle + PostgreSQL jsonb concat)
import { sql, eq } from 'drizzle-orm';
import { schema } from '@ai-jakdang/database';

await db.update(schema.botGenerationJobs)
  .set({
    cost: sql`COALESCE(${schema.botGenerationJobs.cost}, '{}'::jsonb) || ${JSON.stringify({ imageGen: { provider: 'openai', model: 'dall-e-3', costUsd } })}::jsonb`
  })
  .where(eq(schema.botGenerationJobs.id, jobId));
```

`||` 연산자는 PostgreSQL jsonb 병합(우측 우선). `COALESCE`로 null 처리.

[Source: docs/seeding-bot/ARCHITECTURE.md#2.7-bot_generation_jobs]

### Unsplash API 사용 규칙

1. `Authorization: Client-ID <KEY>` 헤더 방식.
2. 검색 응답 `results[n].urls.regular` — 보통 1080px 너비.
3. 이미지 "선택" 후 `results[n].links.download` URL에 GET 요청 필수(Unsplash 정책, 다운로드 카운터 증가). 실패해도 무시.
4. Unsplash License: 상업적 사용 가능, 출처 표시 불필요(attribution not required), 단 "unsplash" 로고 등 상표 위반 금지.

### Pexels API 사용 규칙

1. `Authorization: <API_KEY>` 헤더 방식(Basic/Bearer 아님, key 값 직접).
2. 검색 응답 `photos[n].src.large` — 보통 940px 너비.
3. Pexels License: 상업적 사용 가능, 출처 표시 필요 없음.

### OpenAI DALL-E 비용 참고

- DALL-E 3 Standard 1024×1024: $0.040/이미지 (2025년 6월 기준)
- DALL-E 3 HD 1024×1024: $0.080/이미지
- 이 스토리는 Standard 품질 사용.
- OpenAI API 응답에 비용이 포함되지 않으므로 위 상수를 사용. 모델명/가격 변동 대비 코드 주석으로 "2025-06 기준" 명시.
- 최신 모델 가격은 착수 시 [claude-api 스킬] 또는 https://openai.com/api/pricing 확인.

[Source: docs/seeding-bot/ARCHITECTURE.md#4-AI-추상화-레이어]

### `decideImageStrategy` 상세 설계 근거

| 조건 | 전략 | 근거 |
|---|---|---|
| `board === 'ai-creation'` | `ai` | AI 창작마당은 게시판 특성상 AI 생성 이미지 필수 [Source: docs/seeding-bot-design.md#6] |
| `is_admin_persona === true` | `ai` | 관리자 가이드 표지·도식은 고품질 AI 생성 [Source: docs/seeding-bot-design.md#7] |
| `postKind === 'qna/comment/reply'` | `none` | 댓글·질문은 이미지 불자연스러움 |
| `info_ratio < 20` | `none` | 짧은 잡담은 이미지 없는 게 자연스러움 [Source: docs/seeding-bot/ARCHITECTURE.md#6] |
| `nickname === '냉장고털이'` | `meme` | 밈·짤 특화 캐릭터 [Source: docs/seeding-bot-design.md#3-캐릭터-라인업-확정] |
| `info_ratio >= 40` | `stock` | 정보형 글에는 무료 스톡 [Source: docs/seeding-bot/ARCHITECTURE.md#6] |
| 기타 | `none` | 안전 기본값 |

### `'meme'` 전략 구현 범위 제한

현재 밈·짤 외부 URL 소스(밈 DB, Giphy 등)는 구현 범위에 없다. `decideImageStrategy`가 `'meme'`을 반환하면:
- `fetchBotImage`는 `{ imageUrl: null, isMeme: true }` 반환.
- 11.9 글 생성 파이프라인에서 `isMeme=true` 플래그를 받아 `bot_hold_queue`에 `reason: 'copyright_risk'`로 적재할지 결정.
- 실제 밈 이미지 없이 텍스트만으로 게시할 수도 있음(운영자 재량).

[Source: docs/seeding-bot/ARCHITECTURE.md#2.8-bot_hold_queue — reason: copyright_risk]

### 이미지 다운로드 타임아웃

외부 이미지 다운로드는 반드시 타임아웃(15초)을 걸어야 한다. Node.js 18+ `fetch`의 `AbortSignal.timeout(ms)` 사용. 로컬 MinIO 환경에서는 외부 URL fetch가 차단될 수 있으므로, 개발 환경에서 `UNSPLASH_ACCESS_KEY` 없이도 `null` 반환으로 정상 동작하는지 테스트.

### MIME 타입 처리

Unsplash/Pexels 이미지는 보통 JPEG. `Content-Type` 헤더를 신뢰하되, MIME이 `image/` prefix가 아니면 `image/jpeg` 기본값 사용. `ALLOWED_IMAGE_TYPES` (`apps/api/src/services/storage/index.ts`에 정의된 Set)에 포함되지 않는 MIME이면 업로드 거부 후 `null` 반환.

```typescript
import { ALLOWED_IMAGE_TYPES } from '../../services/storage/index.js';
// ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
```

### Project Structure Notes

**신규 생성 파일**:
```
packages/server-bot/src/images/stock.ts          (권장: Unsplash/Pexels 어댑터)
packages/server-bot/src/images/generate.ts       (권장: OpenAI 이미지 어댑터)
packages/server-bot/src/images/strategy.ts       (권장: 전략 결정 함수)
packages/server-bot/src/images/tiptap.ts         (권장: Tiptap 이미지 삽입 헬퍼)
packages/server-bot/src/images/index.ts          (권장: 통합 진입점 + fetchBotImage)
packages/server-bot/src/images/strategy.test.ts  (권장: 전략 단위 테스트)
```

**수정 파일**:
```
packages/config/src/env.ts                (UNSPLASH_ACCESS_KEY, PEXELS_API_KEY optional 추가)
```

**건드리지 않는 파일** (이 스토리 범위 외):
```
apps/api/src/services/storage/index.ts    (기존 uploadImage 그대로 재사용)
apps/api/src/lib/extract-first-image.ts   (기존 extractFirstImageUrl 그대로 재사용)
apps/api/src/routes/v1/posts/service.ts   (createPost 수정 없음)
server-only AI boundary                   (Story 11.6 담당, `packages/server-bot` 권장)
bot_hold_queue 적재 로직                  (Story 11.9 담당)
```

**디렉터리 확인**: 표준 신규 위치는 `packages/server-bot/src/images/`. worker가 `apps/api/src/*`를 직접 import하는 구조는 금지한다.

---

### References

- 이미지 엔진 설계 전체: [Source: docs/seeding-bot/ARCHITECTURE.md#6-이미지-엔진]
- 이미지 전략 3종 + 밈 전략: [Source: docs/seeding-bot-design.md#6-이미지-전략-3종-믹스]
- 관리자 캐릭터 이미지 요건: [Source: docs/seeding-bot-design.md#7-관리자-가이드-발행]
- `ai-creation` 게시판 이미지 필수 규칙: [Source: docs/seeding-bot-design.md#14.3-이미지]
- `copyright_risk` 보류 큐 reason 값: [Source: docs/seeding-bot/ARCHITECTURE.md#2.8-bot_hold_queue]
- `bot_generation_jobs.cost` jsonb 구조: [Source: docs/seeding-bot/ARCHITECTURE.md#2.7-bot_generation_jobs]
- `uploadImage()` 함수 시그니처 및 subdir 목록: [Source: apps/api/src/services/storage/index.ts]
- `extractFirstImageUrl()` 동작 방식: [Source: apps/api/src/lib/extract-first-image.ts]
- `createPost()` 내 썸네일 추출 흐름: [Source: apps/api/src/routes/v1/posts/service.ts#createPost]
- `AiProvider.generateImage` 인터페이스: [Source: docs/seeding-bot/ARCHITECTURE.md#4-AI-추상화-레이어]
- 봇 env 키 목록: [Source: .env.example#시딩-봇-섹션]
- `ALLOWED_IMAGE_TYPES` 상수: [Source: apps/api/src/services/storage/index.ts]
- 페르소나별 이미지 성향 (`rainy03` AI 이미지 단골, `냉장고털이` 밈): [Source: docs/seeding-bot-design.md#3-캐릭터-라인업-확정]
- Story 11.8 AC 전체: [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.8]
- 그룹 B 의존성 (A 완료 후 병렬 가능): [Source: docs/seeding-bot/EPICS-AND-STORIES.md#스토리-그룹-의존성]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (2026-06-30)

### Debug Log References

- typecheck 0 에러 (tsc --noEmit)
- vitest 22 tests passed (strategy.test.ts)

### Completion Notes List

1. **디렉터리 `image/` vs `images/`**: 스토리 본문은 `images/`이나 실제 스텁·package.json exports는 `image/`(without s). 사용자 프롬프트의 "스텁 index.ts 존재" 지시에 따라 `src/image/`에 구현.
2. **Task 1 (env.ts)**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY` 모두 이미 존재. 수정 불필요.
3. **uploadImage 주입 패턴**: `apps/api/src/services/storage` 직접 import 불가(패키지 경계). `UploadImageFn` 타입 정의 후 `FetchBotImageParams.uploadFn?`으로 주입받도록 설계. Story 11.9 파이프라인이 `uploadImage`를 주입.
4. **genImage (11.6 stub)**: `ai/index.ts`가 stub이므로 `getProvider()` 대신 OpenAI DALL-E 3를 직접 fetch로 구현. 11.6 완성 시 교체 가능하도록 주석 명시.
5. **비용 기록**: `COALESCE || jsonb` 패턴으로 `bot_generation_jobs.cost` 병합. DB 오류는 graceful skip.
6. **Unsplash fire-and-forget**: `void fetch(downloadUrl).catch()` 패턴 사용.
7. **`noUnusedLocals` / `noUnusedParameters`**: 엄격 TypeScript strict 모드 하에 모든 import·파라미터 사용 확인.

### File List

```
packages/server-bot/src/image/strategy.ts       (신규)
packages/server-bot/src/image/stock.ts          (신규)
packages/server-bot/src/image/generate.ts       (신규)
packages/server-bot/src/image/tiptap.ts         (신규)
packages/server-bot/src/image/index.ts          (stub 교체)
packages/server-bot/src/image/strategy.test.ts  (신규, 22 tests)
packages/config/src/env.ts                      (변경 없음 — 이미 필요한 키 존재)
```

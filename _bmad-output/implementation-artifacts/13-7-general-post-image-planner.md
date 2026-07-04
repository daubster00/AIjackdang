# Story 13.7: 일반 글 사후 이미지 플래너 (모드 B)

Status: done

---

## Story

As a 시딩 봇(일반 글 작성 페르소나),
I want 글 본문을 완성한 뒤 그 내용을 읽고 "몇 개의 이미지를, 어느 자리에, 어떤 내용으로" 넣을지 스스로 판단해 삽입하기를,
so that 이미지 개수·위치가 글마다 자연스럽게 달라지고, 단순히 상단에 1장만 붙는 방식보다 글과 이미지가 맥락상 잘 맞는다.

---

## Acceptance Criteria

**AC 1 — 사후 이미지 플래너 실행 조건**
- 일반 글 생성 후 자기검열(`runSelfCensor`(자기검열 서비스)) 통과 + `contentGuard`(콘텐츠 가드) 통과 조건에서,
- **가이드 챕터(`guideChapter`(커리큘럼 강의 챕터))** 가 `null`이고, **큐레이션 모드(`effectiveCuration`(실효 큐레이션 모드))** 가 `null`인 일반 게시글 경로에만 플래너가 실행된다.
- 가이드·큐레이션 경로는 기존 로직(각각 `insertInlineImagesByMarker`(마커 자리 인라인 삽입)/`prependYoutubeToTiptapDoc`(유튜브 노드 맨 앞 삽입))을 **그대로 유지한다**. 회귀 없음.

**AC 2 — 이미지 플래너의 분석 및 계획 반환**
- `planImagesForPost(body, titleSeed, modelAssignment, callModelFn, opts)`(사후 이미지 계획 함수)는 완성된 Tiptap JSON 본문(`body`)과 주제 제목(`titleSeed`)을 입력으로 받는다.
- 내부에서 LLM(생성 모델 `modelAssignment`(봇 모델 할당))을 1회 호출해, 본문을 분석한 결과를 JSON으로 반환하게 한다:
  - 본문에 `[[IMG:planned-N]]`(N=0부터 순번) 마커를 삽입한 **수정 본문 마크다운**, 그리고
  - 각 마커에 대한 `ImagePlanItem`(이미지 계획 항목) 배열: `{ key, kind, diagramPrompt?, searchQuery?, positionHint? }`.
- `kind`(이미지 종류)는 `'ai_diagram'`(AI 도식) 또는 `'stock'`/`'web'`(스톡·웹 이미지). 도식 위주.
- **0개도 정상 결과**다. 글이 짧거나 설명이 단순하면 이미지 없이 반환한다.
- `opts.maxImages`(최대 이미지 수, 기본값 3)를 초과하지 않는다.
- LLM 파싱 실패·오류 시 빈 계획(`items: []`, `bodyWithMarkers = 원본`)을 반환한다(봇 게시 차단 금지).

**AC 3 — 이미지 생성 및 인라인 삽입**
- 계획된 각 `ImagePlanItem`(이미지 계획 항목)에 대해 이미지를 생성·업로드한다:
  - `kind === 'ai_diagram'`: `genImage({ prompt: item.diagramPrompt, jobId, imageModel })`(AI 이미지 생성) 호출 → 버킷 업로드 → URL 획득. 생성 실패 시 해당 항목 건너뜀(글 게시 계속).
  - `kind === 'stock'`: `pickStock(item.searchQuery)`(스톡 이미지 검색) 호출.
  - `kind === 'web'`: `searchWebImage(item.searchQuery)`(웹 이미지 검색) 호출.
- 성공한 항목만 `GuideAssetManifest`(가이드 에셋 매니페스트) 형식의 딕셔너리에 담는다.
- 기존 `insertInlineImagesByMarker(bodyWithMarkers, manifest)`(마커 자리 인라인 삽입)를 그대로 호출해 마커를 실제 이미지 노드+캡션으로 치환한다. 이미지가 없는 마커는 텍스트만 남기고 렌더된다(빈 자리 없게).

**AC 4 — 도식 프롬프트 품질 (§10 함정 방지)**
- `diagramPrompt`(AI 도식 생성 프롬프트)에는:
  - 한국어 라벨을 **"따옴표로 감싸 정확히 명시**"한다 (`"단계1"`, `"설정 화면"` 식). 은유(broom 등 상징) 사용 금지.
  - 영어 라벨이 나올 수 없도록 "모든 텍스트는 한국어로" 지시를 포함한다.
  - 라벨 없는 추상 도식/아이콘은 깨짐 위험이 있으니, 번호 붙은 단계·흐름도·표 형식을 우선한다.
- LLM이 플래너 프롬프트를 생성할 때 이 규칙을 지시에 포함해야 한다.

**AC 5 — 비용·검열·contentGuard 기존 경로 통과**
- 각 `genImage`(AI 이미지 생성) 호출 비용은 기존 `imageCost` 합산 패턴으로 `bot_generation_jobs.cost`(생성 작업 비용 jsonb)에 누적한다.
- 검열(`runSelfCensor`)·`contentGuard`는 기존 텍스트 경로 그대로 유지한다(이미지 삽입 전 텍스트로만 검열).
- 플래너 LLM 1회 호출 비용도 `onCostAccumulated`(비용 누적 콜백) 또는 `imageCost`에 합산한다.

---

## Tasks / Subtasks

### Task 1: `packages/server-bot/src/image/planner.ts` 신규 구현 (AC: #2, #4)

- [ ] 1.1 파일 생성: `packages/server-bot/src/image/planner.ts`

- [ ] 1.2 타입 정의:
  ```typescript
  /** 이미지 계획 1건 — 마커 키, 종류, 생성 지시 또는 검색어. */
  export interface ImagePlanItem {
    /** 본문 마커 키 (예: "planned-0"). [[IMG:planned-0]] 형태로 본문에 삽입됨. */
    key: string;
    /** 이미지 종류. */
    kind: 'ai_diagram' | 'stock' | 'web';
    /**
     * AI 도식용 생성 프롬프트.
     * 반드시 한국어 라벨을 quote로 명시, 은유 금지, "모든 텍스트 한국어"로 지시.
     * kind='ai_diagram'일 때 필수.
     */
    diagramPrompt?: string;
    /** 스톡/웹 이미지 검색어 (kind='stock'|'web'일 때 사용). */
    searchQuery?: string;
    /** 이미지가 들어갈 위치 앞 문단의 핵심 텍스트 (맥락 참조용, 선택). */
    positionHint?: string;
  }

  /** planImagesForPost 반환값. */
  export interface PostImagePlan {
    /** [[IMG:planned-N]] 마커가 삽입된 수정된 Tiptap JSON 본문. */
    bodyWithMarkers: Record<string, unknown>;
    /** 각 마커에 대한 이미지 계획 (0건 가능). */
    items: ImagePlanItem[];
    /** 플래너 LLM 1회 호출 비용 (USD). */
    plannerCostUsd: number;
  }

  export interface PlanImagesOptions {
    /** 최대 이미지 수 (기본값: 3). */
    maxImages?: number;
    /** 도식 우선 안내 여부 (기본값: true). */
    preferDiagram?: boolean;
  }
  ```

- [ ] 1.3 플래너 시스템 프롬프트 상수 정의 (`PLANNER_SYSTEM_PROMPT`):
  - 역할: "당신은 봇 글의 이미지 배치 전문가입니다."
  - 출력 지시: JSON 스키마 고정 출력 (`{ bodyMarkdown, items: [{ key, kind, diagramPrompt?, searchQuery?, positionHint? }] }`).
  - 도식 라벨 규칙: "diagramPrompt에는 한국어 라벨을 쌍따옴표로 감싸 정확히 명시. 은유 아이콘 금지. '모든 텍스트는 한국어로' 명시."
  - 개수 제한: `opts.maxImages`를 초과하지 말 것.
  - 0건 허용: "글이 짧거나 설명이 단순하면 items를 빈 배열로 반환."
  - 도식 우선: "실제 스크린샷이 필요한 경우가 아니면 ai_diagram을 선택."

- [ ] 1.4 플래너 유저 프롬프트 빌더 함수 (`buildPlannerUserPrompt(bodyText, titleSeed, maxImages)`):
  - 본문 평문 텍스트(`bodyText`, `extractTextFromTiptap`으로 추출)와 주제 제목을 넣어 플래너 LLM에 분석을 요청한다.
  - "다음 글 본문을 읽고 이미지가 도움될 자리를 최대 N개 찾아 [[IMG:planned-0]], [[IMG:planned-1]], ... 마커를 삽입한 수정 본문과 각 마커의 이미지 스펙(JSON)을 반환하라"는 구조.

- [ ] 1.5 `parsePlannerResponse(responseText)` — LLM 응답 파싱:
  - JSON 블록 추출 (`json ... ` 감지) 및 `JSON.parse`.
  - `bodyMarkdown` 필드를 `parseMarkdownLines`(파이프라인 내부 함수)로 재파싱해 Tiptap JSON으로 변환 — **단, parseMarkdownLines는 post-pipeline.ts 내부 함수이므로 직접 import 불가**. 대신 파서를 `PlanImagesOptions.markdownToTiptapFn` 콜백으로 주입받는다(패키지 경계 준수).
  - 파싱 실패·항목 미존재 시 빈 계획 반환.
  - `items` 배열의 각 항목에서 `kind`가 `ai_diagram|stock|web` 이외의 값이면 `ai_diagram`으로 강제.

- [ ] 1.6 `planImagesForPost(body, titleSeed, modelAssignment, callModelFn, opts?)` 메인 함수:
  ```typescript
  import type { BotModelAssignment } from '../ai/types.js'; // 패키지 내부 AI 타입
  import { extractTextFromTiptap } from '@ai-jakdang/bot-core';

  export async function planImagesForPost(
    body: Record<string, unknown>,
    titleSeed: string,
    modelAssignment: BotModelAssignment,
    callModelFn: (assignment: BotModelAssignment, prompt: AiPrompt) => Promise<AiResponse>,
    opts?: PlanImagesOptions & {
      /** 마크다운→Tiptap 변환 함수 (post-pipeline이 주입). */
      markdownToTiptapFn?: (markdown: string) => Record<string, unknown>;
    },
  ): Promise<PostImagePlan>
  ```
  구현 흐름:
  1. `extractTextFromTiptap(body)`로 본문 평문 추출.
  2. `buildPlannerUserPrompt(bodyText, titleSeed, maxImages)` 생성.
  3. `callModelFn(modelAssignment, { system: PLANNER_SYSTEM_PROMPT, user: userPrompt, maxTokens: 800 })` 호출.
  4. `parsePlannerResponse(response.text, opts?.markdownToTiptapFn)` 파싱.
  5. 파싱 성공이면 `{ bodyWithMarkers, items, plannerCostUsd: response.costUsd }` 반환.
  6. 오류 시 `{ bodyWithMarkers: body, items: [], plannerCostUsd: 0 }` 반환(fail-safe).

### Task 2: `packages/server-bot/src/image/index.ts` 수출 추가 (AC: #2, #3)

- [ ] 2.1 `planner.ts`의 공개 타입·함수를 `index.ts`에 re-export 추가:
  ```typescript
  export type { ImagePlanItem, PostImagePlan, PlanImagesOptions } from './planner.js';
  export { planImagesForPost } from './planner.js';
  ```
  기존 export는 **일체 변경 없음**.

### Task 3: `apps/api/src/services/bot/post-pipeline.ts` 수정 (AC: #1, #3, #5)

- [ ] 3.1 import 추가:
  ```typescript
  import {
    // 기존 유지
    decideImageStrategy, fetchBotImage, prependImageToTiptapDoc,
    prependImageWithSourceToTiptapDoc, prependYoutubeToTiptapDoc,
    insertInlineImagesByMarker,
    // 신규
    planImagesForPost,
  } from '@ai-jakdang/server-bot/image';
  import type {
    // 기존 유지
    PostKind, ImageStrategy, ImageStrategyOptions, GuideAssetManifest,
    // 신규
    PostImagePlan,
  } from '@ai-jakdang/server-bot/image';
  ```

- [ ] 3.2 `parseMarkdownLines`(마크다운→Tiptap 파서) 함수를 `planImagesForPost` 콜백으로 주입:
  - `post-pipeline.ts` 내에 이미 `parseMarkdownLines`가 정의되어 있다(파이프라인 내부 헬퍼).
  - `planImagesForPost` 호출 시 `opts.markdownToTiptapFn: (md) => ({ type: 'doc', content: parseMarkdownLines(md) })` 를 전달한다.

- [ ] 3.3 검열 통과 분기(`censorResult.overall === "pass"`) 내부 이미지 처리 블록 수정:

  **수정 전 (현재 "상단 1장" 방식):**
  ```typescript
  // 현재: imageStrategy !== 'none'이면 fetchBotImage로 단일 이미지 URL 획득 후 prepend
  if (imageStrategy !== 'none') {
    const imageResult = await fetchBotImage({ ... });
    imageUrl = imageResult.imageUrl;
    ...
  }
  ...
  if (guideChapter) {
    finalContentJson = insertInlineImagesByMarker(draftJson, manifest).doc;
  } else if (curatedVideo) {
    finalContentJson = prependYoutubeToTiptapDoc(draftJson, curatedVideo.url, ...);
  } else if (imageUrl) {
    finalContentJson = imageSource
      ? prependImageWithSourceToTiptapDoc(...)
      : prependImageToTiptapDoc(...);
  } else {
    finalContentJson = draftJson;
  }
  ```

  **수정 후 (사후 플래너 + 기존 경로 공존):**
  ```typescript
  // ── 이미지 처리 ──────────────────────────────────────────────────────────
  let finalContentJson: Record<string, unknown>;
  let imageCost = 0; // 이미지 전체 비용 합산용

  if (curatedVideo) {
    // 모드 C: 유튜브 큐레이션 — 기존 유튜브 노드 삽입(변경 없음)
    finalContentJson = prependYoutubeToTiptapDoc(draftJson, curatedVideo.url, {
      channel: curatedVideo.channel,
      sourceUrl: curatedVideo.pageUrl,
    });

  } else if (imageStrategy !== 'none') {
    // 모드 B: 일반 글 사후 이미지 플래너 ← 신규
    try {
      const plan: PostImagePlan = await planImagesForPost(
        draftJson,
        topicResult.topic.titleSeed,
        genAssignment,
        (assignment, prompt) => callModel(assignment, prompt),
        {
          maxImages: 3,
          preferDiagram: true,
          markdownToTiptapFn: (md) => ({ type: 'doc', content: parseMarkdownLines(md) }),
        },
      );
      imageCost += plan.plannerCostUsd; // 플래너 호출 비용 합산

      if (plan.items.length > 0) {
        // 각 계획 항목에 대해 이미지 생성·업로드
        const manifest: GuideAssetManifest = {};
        for (const item of plan.items) {
          try {
            if (item.kind === 'ai_diagram' && item.diagramPrompt) {
              const result = await genImage({
                prompt: item.diagramPrompt,
                jobId,
                imageModel,
              });
              if (result) {
                const uploaded = await uploadImage(
                  { filename: `bot-diagram-${item.key}.png`, mimetype: result.mimetype, data: result.data },
                  'editor-images',
                );
                manifest[item.key] = {
                  url: uploaded.url,
                  caption: item.positionHint ?? undefined,
                };
                imageCost += result.costUsd;
              }
            } else if ((item.kind === 'stock' || item.kind === 'web') && item.searchQuery) {
              const imgResult = await fetchBotImage({
                persona: personaContext,
                board,
                postKind: imagePostKind,
                keyword: item.searchQuery,
                webQuery: item.searchQuery,
                strategyOptions: { preferWeb: item.kind === 'web' },
                jobId,
                uploadFn: uploadImage,
                imageModel,
              });
              if (imgResult.imageUrl) {
                manifest[item.key] = {
                  url: imgResult.imageUrl,
                  caption: item.positionHint ?? undefined,
                  sourceLabel: imgResult.source?.label ?? undefined,
                  sourceUrl: imgResult.source?.url ?? undefined,
                };
              }
            }
          } catch (itemErr) {
            console.warn('[post-pipeline] 이미지 생성 항목 실패 (건너뜀):', item.key, (itemErr as Error).message);
          }
        }
        // 마커 자리에 이미지 인라인 삽입
        if (Object.keys(manifest).length > 0) {
          finalContentJson = insertInlineImagesByMarker(plan.bodyWithMarkers, manifest).doc;
        } else {
          // 이미지 생성이 모두 실패한 경우 — 마커 없이 원본 본문 사용
          finalContentJson = draftJson;
        }
      } else {
        // 플래너가 0개 결정 → 이미지 없이 게시
        finalContentJson = draftJson;
      }
    } catch (plannerErr) {
      // 플래너 자체 실패 → 이미지 없이 게시(기존 none과 동일)
      console.warn('[post-pipeline] 이미지 플래너 실패 (이미지 없이 계속):', (plannerErr as Error).message);
      finalContentJson = draftJson;
    }

  } else {
    // imageStrategy === 'none': 이미지 없음
    finalContentJson = draftJson;
  }
  ```

  > Story 13.3 이후 모드 A(커리큘럼)는 `post-pipeline.ts`에서 완전히 분리되어 `packages/server-bot/src/curriculum-publish.ts`의 `publishChapter`가 담당한다. 13.7은 `guideChapter`·`GUIDE_ASSET_MANIFEST_KEY`·`getBotSetting` 경로를 다시 추가하지 않는다.

- [ ] 3.4 비용 누적 블록 수정: `imageCost`가 이미 선언·합산되므로, 기존 `totalCost` 계산에 그대로 포함된다. (`groundingCost + genCostUsd + censorCostUsd + imageCost`)

- [ ] 3.5 `genImage`(AI 이미지 생성) import 추가 (패키지 경계 준수 확인):
  - `genImage`는 `@ai-jakdang/server-bot/image`에서 이미 export됨(`index.ts` line 44). 추가 import만 하면 됨.
  - `uploadImage`는 `../../services/storage/index.js`에서 이미 import됨. 변경 없음.

### Task 4: 타입체크 및 회귀 검증 (AC: #1, #5)

- [ ] 4.1 `pnpm --filter @ai-jakdang/server-bot typecheck` 에러 없음.
- [ ] 4.2 `pnpm --filter @ai-jakdang/api typecheck` 에러 없음.
- [ ] 4.3 기존 `packages/server-bot/src/image/strategy.test.ts`(22개), `tiptap.test.ts`(10개) 모두 통과 확인(수정 없이).
- [ ] 4.4 `planner.ts` 단위 테스트 파일 `planner.test.ts` 신규 작성:
  - LLM 응답 파싱 성공 → `items`, `bodyWithMarkers` 반환 확인.
  - LLM 응답 파싱 실패(깨진 JSON) → `{ items: [], bodyWithMarkers: 원본 }` 반환 확인.
  - `maxImages` 초과 항목은 잘라내기 확인.
  - `kind`가 알 수 없는 값이면 `ai_diagram`으로 강제 확인.

---

## Dev Notes

### 1. 현재 "상단 1장" 방식과의 관계 — 무엇이 바뀌고 무엇이 유지되나

```
13.3 이후 현재 파이프라인 (post-pipeline.ts, 검열 통과 후 이미지 블록):

  if (curatedVideo) → prependYoutubeToTiptapDoc      ← 모드 C: 변경 없음
  else if (imageUrl) → prependImageToTiptapDoc      ← 모드 B [기존 단일 상단 1장]
  else → 이미지 없음

이 스토리 후:

  if (curatedVideo) → prependYoutubeToTiptapDoc      ← 모드 C: 변경 없음
  else if (imageStrategy !== 'none')               ← 모드 B [사후 플래너로 교체]
       → planImagesForPost → genImage/fetchBotImage 루프
       → insertInlineImagesByMarker
  else → 이미지 없음
```

모드 A(커리큘럼)는 13.3에서 `post-pipeline.ts` 밖으로 분리되므로 이 표에 포함하지 않는다.

기존 `fetchBotImage` 단일 상단 이미지 경로는 일반 글 분기에서 **사후 플래너로 완전 대체**된다. `meme` 전략은 `imageStrategy`로 여전히 결정되지만, 현재 `meme`은 `fetchBotImage` 내부에서 `stock`으로 폴백되므로 동작 변화는 없다.

`decideImageStrategy`(이미지 전략 결정)→`imageStrategy`(이미지 조달 전략) 결정 로직은 **그대로 유지**. 단, `imageStrategy !== 'none'`인 경우 fetchBotImage 1회 단독 호출 대신 플래너가 동적으로 판단한다.

### 2. 개수·위치 동적 결정 방식

플래너 LLM 호출의 핵심 아이디어:
- 모델에게 "본문을 읽고 `[[IMG:planned-N]]` 마커를 직접 삽입한 수정 본문 + 각 마커의 이미지 스펙 JSON"을 함께 반환하도록 지시한다.
- 마커 삽입 위치는 모델이 맥락을 읽어 결정하므로, 개수(0~maxImages)와 위치가 글마다 달라진다.
- 반환된 마커 삽입 수정 본문은 다시 Tiptap JSON으로 변환된다. 이때 `markdownToTiptapFn` 콜백으로 `post-pipeline.ts`의 `parseMarkdownLines`(마크다운→Tiptap 변환 헬퍼)를 주입받아 재사용한다(패키지 경계 위반 없이).
- 이후 `insertInlineImagesByMarker`(마커 자리 인라인 삽입)로 마커→실제 이미지 치환한다(가이드 시리즈와 동일한 함수, 이미 검증됨).

### 3. AI 도식 라벨 함정 (§10 실증 사례, 재발 방지 필수)

설계문서 §10에 실증 기록된 함정들:
- Gemini 이미지 모델은 **프롬프트에 명시적 라벨이 없으면 영어 라벨을 생성하거나 글자가 깨진다**.
- 은유(예: `broom` = 청소) 를 사용하면 **방청소 체크리스트** 같은 엉뚱한 그림이 나온다.
- `[[IMG:planned-0]]` 자리에 "단계별 흐름도"가 필요하다면:

  ```
  ❌ 나쁜 예: "a diagram showing the workflow steps"
  ✅ 좋은 예: "흐름도: 상자들이 화살표로 연결됨.
               상자1: \"파일 열기\", 상자2: \"설정 확인\", 상자3: \"실행\".
               모든 텍스트는 한국어로. 영어 없음."
  ```

- `PLANNER_SYSTEM_PROMPT`와 `buildPlannerUserPrompt`에 이 규칙을 명시적으로 넣어야 한다.

### 4. 회귀 방지 체크리스트

| 확인 항목 | 방법 |
|---|---|
| 가이드 챕터 경로(`guideChapter !== null`) | 코드 분기 확인 — 플래너 미실행 |
| 큐레이션 경로(`curatedVideo !== null`) | 코드 분기 확인 — 플래너 미실행 |
| `imageStrategy === 'none'` 경로 | 플래너 미호출 → `draftJson` 그대로 |
| 플래너 LLM 오류 | `try/catch` → `finalContentJson = draftJson` |
| 개별 이미지 생성 실패 | `try/catch` → 해당 항목 `manifest` 미포함 → 마커 건너뜀 |
| 기존 `strategy.test.ts` | 수정 없는 파일이므로 무관 — 22개 통과 확인만 |

### 5. 건드릴 파일 목록

| 파일 | 변경 유형 | 비고 |
|---|---|---|
| `packages/server-bot/src/image/planner.ts` | **신규** | 사후 이미지 플래너 |
| `packages/server-bot/src/image/planner.test.ts` | **신규** | 단위 테스트 |
| `packages/server-bot/src/image/index.ts` | **수정** | planner re-export 추가 |
| `apps/api/src/services/bot/post-pipeline.ts` | **수정** | 이미지 처리 블록 교체 |

**건드리지 않는 파일**:
```
packages/server-bot/src/image/strategy.ts   (decideImageStrategy 로직 유지)
packages/server-bot/src/image/tiptap.ts     (insertInlineImagesByMarker 재사용)
packages/server-bot/src/image/generate.ts   (genImage 재사용)
packages/server-bot/src/image/stock.ts      (pickStock 재사용)
packages/server-bot/src/image/web.ts        (searchWebImage 재사용)
apps/api/src/services/bot/censor.ts         (변경 없음)
apps/api/src/middleware/contentGuard.ts     (변경 없음)
```

### 6. 비용 추적 경로 (기존 패턴 재사용)

```
planImagesForPost → LLM 1회 → plan.plannerCostUsd
genImage per item → result.costUsd (누적)
fetchBotImage per item → 내부 비용 미반환(stock/web는 API 비용 추적 없음)
합계 → imageCost → bot_generation_jobs.cost.image 업데이트
      (groundingCost + genCostUsd + censorCostUsd + imageCost = totalCost)
```

`genImage`의 `jobId` 전달로 내부에서 `bot_generation_jobs.cost` jsonb COALESCE 병합이 자동 호출된다(기존 패턴). 단, 한 `jobId`에 여러 번 `genImage`를 호출하면 `imageGen` 키가 덮어쓰여진다. 누적이 필요하면 `cost.imageDiagram0`, `cost.imageDiagram1` 식으로 키를 다르게 쓰거나, 파이프라인에서 `imageCost` 합산 후 마지막에 일괄 갱신하는 방식을 택한다. **권장**: `jobId`를 `genImage`에 전달하지 않고(`undefined`), 파이프라인에서 `imageCost += result.costUsd`로 합산 후 `bot_generation_jobs.cost` 블록 업데이트 시 함께 기록.

### 7. `planImagesForPost`의 마크다운→Tiptap 의존성 주입 이유

`parseMarkdownLines`(마크다운→Tiptap 변환 헬퍼)는 `apps/api/src/services/bot/post-pipeline.ts` 내부 함수다. `packages/server-bot`이 `apps/api`를 직접 import하면 패키지 경계 위반(worker 격리 원칙). 따라서 `PlanImagesOptions.markdownToTiptapFn` 콜백으로 주입받는다. 주입하지 않으면 `parsePlannerResponse`가 마커 삽입 수정 본문을 `parseResponseToTiptap`(Tiptap JSON 변환 함수) 없이 처리할 수 없으므로 원본 `body`를 그대로 반환한다.

---

### References

- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#7-사후-이미지-플래너] — 모드 B 설계 전체 흐름
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#1-봇-글-이미지-3-모드] — 3-모드 중 B만 이 스토리 범위 (A=13.3~13.6, C=13.8)
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#8-스크린샷-이미지-조달-수단] — 즉석 스크린샷 불가, 도식 위주
- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#10-현재-구현-상태] — 한국어 라벨 quote 함정, 도식 깨짐 사례
- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-13.7] — AC 원문
- [Source: packages/server-bot/src/image/tiptap.ts#insertInlineImagesByMarker] — 마커 치환 함수 (재사용)
- [Source: packages/server-bot/src/image/tiptap.ts#GuideAssetManifest] — 매니페스트 타입 (재사용)
- [Source: packages/server-bot/src/image/generate.ts#genImage] — AI 이미지 생성 함수 (재사용)
- [Source: packages/server-bot/src/image/strategy.ts#decideImageStrategy] — 이미지 전략 결정 (변경 없음)
- [Source: packages/server-bot/src/image/index.ts] — 이미지 모듈 진입점
- [Source: apps/api/src/services/bot/post-pipeline.ts#Step-6b] — imageStrategy 결정 및 이미지 처리 블록 (수정 대상)
- [Source: apps/api/src/services/bot/post-pipeline.ts#parseMarkdownLines] — 마크다운→Tiptap 변환 헬퍼 (콜백 주입)
- [Source: apps/api/src/services/bot/censor.ts] — 검열 경로 (이 스토리에서 변경 없음)

---

## Dev Agent Record

### Agent Model Used

(미기재)

### Debug Log References

(미기재)

### Completion Notes List

(미기재)

### File List

(미기재)

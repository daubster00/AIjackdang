# Story 13.4: 이미지 슬롯 워크플로우 (🟢자동 / 🟡캡처 / 🔵업로드)

Status: done

## Story

As a 커리큘럼 운영자(관리자),
I want 각 이미지 슬롯의 `source_kind`(슬롯 출처 종류)에 따라 자동 조달·화면 캡처·직접 업로드 세 경로로 이미지를 채우고 버킷에 올리기,
so that 커리큘럼 챕터의 모든 `[[IMG:키]]`(본문 이미지 마커) 자리에 설명과 정확히 일치하는 이미지가 준비되고, 예약 게시 직전 `insertInlineImagesByMarker`(마커 기반 인라인 삽입)가 즉시 완성본을 조립할 수 있다.

---

## Acceptance Criteria

1. **`source_kind`(슬롯 출처 종류)별 조달**: 슬롯마다 하나의 경로로 이미지를 조달해 `bot_curriculum_image_slots.image_url`(버킷 업로드 결과 URL)에 저장하고 `status`(슬롯 상태)를 `ready`(완료)로 승격한다.
   - 🟢 `ai_diagram`(AI 도식 자동 생성): `diagram_prompt`(AI 도식 생성 프롬프트) 기반으로 `genImage()`(프로바이더 라우팅 이미지 생성 어댑터)를 호출한다. 기본 프로바이더는 `DEFAULT_IMAGE_MODEL`(`google/gemini-3.1-flash-image`(구글 Gemini 기본 이미지 모델))이며, 관리자가 `imageModel`(이미지 모델 할당값)을 지정하면 그 모델로 라우팅한다. 반환된 이미지 바이트(Buffer)를 `uploadImage(file, 'editor-images')`(본문 이미지 업로드 경로)로 업로드 → `image_url` 저장 → `status=ready`.
   - 🟢 `web_download`(공식문서 이미지 다운로드): `source_url`(원본 다운로드 URL)에서 `fetch`로 이미지 바이트를 다운로드(타임아웃 30초, `User-Agent` 헤더 필수) → `uploadImage(file, 'editor-images')` 업로드 → `image_url` 저장 → `status=ready`. 출처 표기는 슬롯의 `caption`(캡션 문자열)과 `source_url`로 보관하며, 챕터 게시 시 `insertInlineImagesByMarker`가 캡션 문단을 이미지 아래에 삽입(13.3 스코프).
   - 🟡 `capture`(화면 캡처, 사람 세팅 필요): `source_url`이 있으면 Playwright(`chromium.launch({ headless: true })`)로 웹 페이지 스크린샷, `source_url`이 없으면(로컬 터미널·데스크톱 앱) PowerShell 캡처 스크립트(`capture-slot.ts`)를 별도 CLI로 실행해 결과 PNG를 업로드 API에 수동 제출. 두 경우 모두 캡처 성공 버퍼 → `uploadImage(file, 'editor-images')` → `image_url` 저장 → `status=ready`. 사람이 환경(앱 설치·로그인·화면 정돈)을 먼저 준비한 뒤 요청해야 하므로 "지시 시 실행" 정책 적용.
   - 🔵 `user_upload`(직접 업로드): 관리자가 이미지 파일을 `POST /api/v1/admin/bots/curriculum/slots/:slotId/upload`(슬롯 이미지 업로드 엔드포인트)에 multipart 전송 → `ALLOWED_IMAGE_TYPES`(허용 이미지 MIME 타입) 검증 → `uploadImage(file, 'editor-images')` → `image_url` 저장 → `status=ready`. 자동 조달 없음, 사람이 파일을 직접 첨부.
   - **기존 `build-guide-assets.ts`(에셋 조달 프로토타입)의 핵심 로직을 정식화**한다. 기존 `bot_settings.guide_asset_manifest`(설정값 기반 매니페스트) 저장 경로를 제거하고 `bot_curriculum_image_slots.image_url`(DB 슬롯 필드)에 직접 저장한다.

2. **지시 시 생성(미리 만들지 않음)**: 슬롯 레코드가 생성될 때(`status=pending`(대기)) 이미지를 사전 생성하지 않는다. 🟢·🟡 모두 관리자가 "지금 생성"을 클릭하거나 스크립트(`build-guide-assets.ts`)를 실행하는 명시적 요청이 있을 때만 `fillImageSlot()`(슬롯 이미지 조달 함수)이 실행된다. 이미 `status=ready`인 슬롯은 `force=true`(강제 재조달) 플래그 없이는 덮어쓰지 않는다.

3. **사람용 상세 안내문(`guidance`(안내 텍스트)) 자동 생성**: 슬롯 레코드 INSERT 또는 UPDATE 시 `generateSlotGuidance(slot)`(안내문 자동 생성 함수)를 호출해 `bot_curriculum_image_slots.guidance` 필드에 저장한다. 사람이 별도로 호출할 필요 없이 자동으로 채워진다. `source_kind`별 안내문 포맷:
   - `ai_diagram`: "AI(Gemini)가 다음 프롬프트로 도식을 자동 생성합니다.\n프롬프트: {diagram_prompt}\n[관리자에서 '지금 생성' 버튼으로 즉시 실행 가능]"
   - `web_download`: "공식문서 URL에서 이미지를 자동 다운로드합니다.\nURL: {source_url}\n캡션(출처): {caption}"
   - `capture`: "사람이 다음 환경을 준비한 뒤 캡처를 요청해 주세요.\n위치 안내: {position_hint}\n캡처 대상: {source_url이 있으면 해당 웹 URL / 없으면 로컬 데스크톱}"
   - `user_upload`: "이 이미지는 사람이 직접 만들어 업로드해야 합니다.\n설명: {caption}\n위치: {position_hint}"
   - 관리자 화면(13.5 스코프)에서 슬롯 카드에 🟢🟡🔵 배지와 함께 `guidance` 텍스트를 표시한다(이 스토리에서는 데이터 저장까지).

4. **워터마크·출처 캡션 규칙 기존 유지**:
   - `uploadImage(file, 'editor-images')` 호출 경로에서 `watermarkImage()`(워터마크 합성 함수)가 **자동으로** 우측 하단 흰색 반투명 로고를 합성한다. 이 스토리에서 워터마크 코드를 새로 작성하지 않는다.
   - GIF·소형 이미지(`<240px`)·처리 실패 시 `watermarkImage`가 원본을 그대로 반환(업로드를 막지 않음).
   - `web_download` 슬롯의 출처 캡션(`caption` + `source_url`)은 슬롯 필드에 보관하고, 실제 챕터 본문 삽입(`insertInlineImagesByMarker`)은 13.3의 게시 실행 단계에서 처리한다(이 스토리 범위 외).

---

## Tasks / Subtasks

### Task 1: 슬롯 조달 서비스 신규 생성 (AC: #1, #2)

- [ ] 1.1 `apps/api/src/services/bot/slot-filler.ts` 신규 생성 — 공개 진입점: `fillImageSlot(slotId: string, opts?: FillSlotOptions): Promise<FillSlotResult>`
  ```typescript
  export interface FillSlotOptions {
    /** 이미 ready 슬롯도 강제 재조달. */
    force?: boolean;
    /** 🟢 ai_diagram 전용: 관리자 지정 이미지 모델. 미지정 시 DEFAULT_IMAGE_MODEL. */
    imageModel?: { provider: string; model: string };
    /** 🟢 ai_diagram 전용: 이번 요청에서만 사용할 프롬프트 override. */
    diagramPrompt?: string;
    /** 비용 기록용 job_id (선택). */
    jobId?: string;
  }
  export interface FillSlotResult {
    ok: boolean;
    /** 업로드된 버킷 URL. 실패·skip 시 null. */
    imageUrl: string | null;
    /** 'filled'=이미지 조달·저장 완료 / 'skipped'=이미 ready + force 미설정 / 'failed'=조달 실패. */
    outcome: 'filled' | 'skipped' | 'failed';
    reason?: string;
  }
  ```
  - DB에서 슬롯 조회(`bot_curriculum_image_slots`) → `source_kind` 분기 → 조달 함수 호출 → 성공 시 `image_url`, `status='ready'`, `updated_at` UPDATE. 실패 시 슬롯 상태 변경 없음.
  - 이미 `status=ready`면 `opts.force !== true` 시 `{ ok: true, imageUrl: slot.image_url, outcome: 'skipped' }` 즉시 반환.

- [ ] 1.2 🟢 `fillAiDiagram(slot, opts?)` 내부 함수 (AC: #1)
  - `prompt = opts?.diagramPrompt ?? slot.diagram_prompt` 계산. 프롬프트가 없으면 `{ outcome: 'failed', reason: 'diagram_prompt 없음' }` 반환.
  - `genImage({ prompt, imageModel: opts?.imageModel ?? DEFAULT_IMAGE_MODEL, jobId: opts?.jobId })` 호출. 반환 null → 실패.
  - `uploadImage({ filename: \`slot-ai-\${slot.asset_key}.\${mimetype.split('/')[1] ?? 'png'}\`, mimetype, data }, 'editor-images')` → `{ url }` 취득.
  - `UPDATE bot_curriculum_image_slots SET image_url=url, status='ready', updated_at=now WHERE id=slot.id`.
  - 반환: `{ ok: true, imageUrl: url, outcome: 'filled' }`.

- [ ] 1.3 🟢 `fillWebDownload(slot)` 내부 함수 (AC: #1)
  - `slot.source_url`(원본 다운로드 URL) 없으면 실패.
  - `fetch(slot.source_url, { headers: { 'User-Agent': 'Mozilla/5.0 (aijackdang-guide-asset-fetch)' }, signal: AbortSignal.timeout(30_000) })`.
  - HTTP 비OK·fetch 예외 → null 반환(try/catch, 게시 파이프라인 차단 금지).
  - Content-Type에서 `mimetype` 추출. `image/` 비prefix 시 `image/png` 기본값.
  - `uploadImage` → UPDATE → `{ ok: true, imageUrl, outcome: 'filled' }`.

- [ ] 1.4 🟡 `fillCapture(slot)` 내부 함수 (AC: #1)
  - `slot.source_url`이 있으면(웹 URL) Playwright 경로:
    ```typescript
    import { chromium } from 'playwright';
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(slot.source_url, { waitUntil: 'networkidle', timeout: 30_000 });
    const screenshot = await page.screenshot({ fullPage: false });
    await browser.close();
    // → uploadImage({ data: screenshot, mimetype: 'image/png', filename: 'capture.png' }, 'editor-images')
    ```
  - `slot.source_url`이 없으면(로컬 데스크톱) API에서 자동 실행 불가 → `{ outcome: 'failed', reason: '로컬 캡처는 capture-slot.ts CLI로 수동 실행 후 /upload 엔드포인트로 제출하세요' }` 반환.
  - Playwright 예외(타임아웃·로그인 벽 등) → try/catch → `{ outcome: 'failed', reason }`.

- [ ] 1.5 🔵 `user_upload` 경로는 이 함수가 아닌 **Story 13.5의 `/upload` 엔드포인트**가 담당. `fillImageSlot`이 `user_upload` 타입을 수신하면 `{ outcome: 'failed', reason: '직접 업로드는 /slots/:id/upload 엔드포인트 사용' }` 반환.

- [ ] 1.6 패키지 경계 확인: `slot-filler.ts`는 `apps/api/src/` 내부이므로 `apps/api/src/services/storage/index.ts`(`uploadImage`)를 직접 import 가능. `packages/server-bot/src/image/generate.ts`(`genImage`)는 `@ai-jakdang/server-bot/image` 패키지로 import.

### Task 2: `guidance`(안내문) 자동 생성 함수 (AC: #3)

- [ ] 2.1 `packages/bot-core/src/slot-guidance.ts` 신규 생성 — `generateSlotGuidance(slot: SlotInput): string` 순수 함수(DB 접근 없음, 사이드 이펙트 없음).
  ```typescript
  export interface SlotInput {
    source_kind: 'ai_diagram' | 'web_download' | 'capture' | 'user_upload';
    caption: string;
    diagram_prompt?: string | null;
    source_url?: string | null;
    position_hint?: string | null;
  }
  ```
  - `ai_diagram`: "AI(Gemini)가 다음 프롬프트로 도식을 자동 생성합니다.\n프롬프트: {diagram_prompt ?? '(미입력)'}\n[관리자에서 '지금 생성' 버튼으로 즉시 실행 가능]"
  - `web_download`: "공식문서 URL에서 이미지를 자동 다운로드합니다.\nURL: {source_url ?? '(미입력)'}\n캡션(출처): {caption}"
  - `capture`: "사람이 다음 환경을 준비한 뒤 캡처를 요청해 주세요.\n위치 안내: {position_hint ?? '(없음)'}\n캡처 대상: {source_url 있으면 해당 웹 URL + URL 값 / 없으면 '로컬 데스크톱 (앱 설치·로그인·화면 정돈 필요)'}"
  - `user_upload`: "이 이미지는 사람이 직접 만들어 업로드해야 합니다.\n설명: {caption}\n위치: {position_hint ?? '(없음)'}"

- [ ] 2.2 단위 테스트 4종 `packages/bot-core/src/slot-guidance.test.ts` — `source_kind`별 포맷 검증, `null` 필드 fallback 동작.

- [ ] 2.3 슬롯 레코드 저장 시 자동 적용:
  - 13.1 시드 스크립트가 `bot_curriculum_image_slots` INSERT 시 `guidance = generateSlotGuidance(slot)` 계산 후 함께 삽입.
  - 13.3 챕터 초안 생성 시 슬롯이 INSERT 되는 경우도 동일.
  - 이 스토리에서는 함수 구현 및 테스트까지. 실제 호출 지점(13.1·13.3)에는 이 스토리에서 연결 시점에 맞게 처리하거나, 시드 스크립트가 이 스토리 완료 이전에 작성된 경우 `guidance = generateSlotGuidance(slot)` 호출을 해당 스크립트에 추가한다.

### Task 3: 13.5 관리자 API 연결 계약 명시 (AC: #1, #2, #4)

- [ ] 3.1 `fillImageSlot`은 `apps/api/src/services/bot/slot-filler.ts`에 위치한다. 이 함수는 `apps/api`의 `uploadImage()`·워터마크 경로를 사용하므로 `apps/worker`에서 직접 import하지 않는다.

- [ ] 3.2 Story 13.5의 `POST /admin/bots/curriculum/chapters/:chapterId/slots/:slotId/generate` 엔드포인트가 `fillImageSlot(slotId, { force, imageModel })`을 직접 호출하고, 성공 후 Story 13.3의 `checkAndPromoteChapter(chapterId)`를 호출한다.

- [ ] 3.3 관리자 HTTP 엔드포인트는 **Story 13.5 소유**로 둔다. 이 스토리는 `fillImageSlot` 서비스만 제공하고, `/admin/bots/curriculum/.../upload|generate|complete` 라우트는 13.5가 구현해 중복 소유를 방지한다.

### Task 4: `build-guide-assets.ts`(프로토타입) → DB 슬롯 연결 리팩터 (AC: #1)

- [ ] 4.1 `apps/api/src/scripts/build-guide-assets.ts` 수정 — `collectAssetKeys()`(curriculum.ts 정적 슬롯 목록) 대신 `bot_curriculum_image_slots` DB 쿼리로 슬롯 목록 조회.
  - `getSlotsPending(opts: { force?: boolean; only?: string[] })` 헬퍼 추가: `status='pending'` 슬롯 조회 (FORCE 시 전체, ONLY 시 `asset_key IN (...)`).
  - 각 슬롯에 `fillImageSlot(slot.id, { force: FORCE, imageModel })` 호출. 결과 로그.

- [ ] 4.2 기존 `getBotSetting(MANIFEST_KEY)` / `setBotSetting(MANIFEST_KEY, manifest)` 호출 제거. `bot_settings.guide_asset_manifest`(설정값 매니페스트) 저장 로직 삭제.

- [ ] 4.3 스크립트 주석 업데이트:
  ```bash
  # 모든 pending 슬롯 조달
  pnpm --filter @ai-jakdang/api tsx src/scripts/build-guide-assets.ts
  # ready 슬롯도 포함 강제 재조달
  FORCE=1 pnpm --filter @ai-jakdang/api tsx src/scripts/build-guide-assets.ts
  # 특정 asset_key만 조달
  ONLY=vibe-concept-nl-to-code,auto-schedule-filter pnpm --filter @ai-jakdang/api tsx src/scripts/build-guide-assets.ts
  ```

- [ ] 4.4 기존 `procureBytes()` 내부 로직은 Task 1 구현 완료 시 이미 `slot-filler.ts`에 이관됨 → `build-guide-assets.ts`에서 중복 코드 삭제.

### Task 5: 타입 검사 + 단위 테스트 (AC: 전체)

- [ ] 5.1 `pnpm -r tsc --noEmit` 에러 0.
- [ ] 5.2 `packages/bot-core/src/slot-guidance.test.ts` — 4종 source_kind 포맷, null 필드 fallback.
- [ ] 5.3 `apps/api/src/services/bot/slot-filler.test.ts` — `fillAiDiagram` 성공/실패, `fillWebDownload` 다운로드 실패·mimetype 폴백, `fillImageSlot` 이미 ready + force=false skip 동작 (genImage·uploadImage·fetch 모킹).

---

## Dev Notes

### 선행 의존성

| 의존 스토리 | 이유 |
|---|---|
| 13.1 | `bot_curriculum_image_slots` 테이블 + `source_kind`(슬롯 출처 종류) enum + `image_url`(버킷 URL)·`status`(슬롯 상태)·`guidance`(안내 텍스트)·`diagram_prompt`(도식 프롬프트)·`source_url`(원본 URL)·`asset_key`(마커 키)·`position_hint`(위치 힌트) 필드 존재 |
| 13.2 | 슬롯 Zod 계약(contracts). 미완료 시 13.2를 먼저 완료하고, 이 스토리에서 임시 인라인 타입을 만들지 않는다 |
| 11.8 | `genImage()`(이미지 생성 어댑터) + `DEFAULT_IMAGE_MODEL`(기본 이미지 모델) + `uploadImage()`(업로드 진입점) 재사용 |

### 조달 수단별 제약 (§8 표 기반)

| `source_kind` | 배지 | 조달 방법 | 무엇을 찍나 | 주요 제약 |
|---|---|---|---|---|
| `ai_diagram` | 🟢 자동 | `genImage({ prompt: slot.diagram_prompt })` → Gemini inlineData(base64) → upload | 개념·흐름·구조·표 도식 | **한국어 라벨을 프롬프트에 정확한 quote로 박아야 함**(§10 함정). `GEMINI_API_KEY` 필요. 실제 UI 스샷 불가 |
| `web_download` | 🟢 자동 | `fetch(slot.source_url, { User-Agent })` → upload | 공식문서에 이미 실린 실제 캡처 | 문서에 이미지가 있어야 함. Claude Code docs는 스샷 전무 → 이 kind 불가. Make 도움말은 이미지 있음 |
| `capture` | 🟡 세팅필요 | 웹=Playwright `chromium.launch({ headless:true })`, 로컬=PowerShell + 수동 `/upload` | 웹페이지 실제 화면 / 터미널·데스크톱 앱 | 로그인 벽(Make 편집기 등) 자격증명 필요. 로컬 데스크톱은 사람이 앱 설치·정돈 후 진행. 텍스트 전용 페이지는 무의미 → `ai_diagram` 권장 |
| `user_upload` | 🔵 업로드 | Admin multipart POST `/upload` → `uploadImage('editor-images')` | 사람이 직접 만든 이미지 | 자동화 없음. `ALLOWED_IMAGE_TYPES`·5MB 제한 적용 |

### §10 Gemini 한국어 라벨 함정 — 재발 방지 필수

`diagram_prompt`(AI 도식 생성 프롬프트)에 **한국어 라벨을 단따옴표(')로 직접 삽입**하고, 영어 번역을 금지하는 지시를 명시해야 한다.

```
// 잘못된 예 — 영어 번역·은유 포함 시 글자 깨짐·오해 발생
"A flow with Input → AI → Output"

// 올바른 예 — Korean 라벨 quote로 박기 (실제 curriculum.ts §10 검증 통과)
"...left-to-right flow, stage 1 labeled '자연어 지시', stage 2 labeled 'AI',
 stage 3 labeled '코드 작성', stage 4 labeled '검토·승인'.
 (render Korean precisely, do NOT translate to English, do NOT invent other words)
 No other text anywhere."
```

실제 프로토타입 dev 검증 결과: Gemini 도식 품질 양호, 파일트리·플로우·표 한국어 라벨 정확.
`broom` 같은 은유 아이콘 지시 → `방청소 체크리스트` 오해 → **은유 배제, 직관적 아이콘 + 정확한 라벨** 조합 사용.

[Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#10]

### 워터마크 경계 — 기존 구현 완전 재사용

```
fillImageSlot()
    ↓ (ai_diagram / web_download / capture)
uploadImage(file, 'editor-images')          ← apps/api/src/services/storage/index.ts
    ↓ (subdir === 'editor-images' 조건)
watermarkImage(data, mimetype)              ← apps/api/src/services/storage/watermark.ts
    우측 하단 흰색 반투명 로고 35% 합성
    GIF·소형(<240px)·처리실패 → 원본 그대로
    ↓
S3(MinIO/R2) 공개 버킷 업로드 → image_url
```

이 스토리에서 워터마크 코드 신규 작성 **완전 불필요**. `uploadImage(file, 'editor-images')` 호출만으로 자동 적용.

[Source: apps/api/src/services/storage/index.ts#uploadImage]
[Source: apps/api/src/services/storage/watermark.ts]

### `genImage()` 인터페이스 — `fillAiDiagram` 구현 참고

```typescript
// packages/server-bot/src/image/generate.ts
import { genImage, DEFAULT_IMAGE_MODEL } from '@ai-jakdang/server-bot/image';

// ai_diagram 슬롯 조달 예시
const result = await genImage({
  prompt: slot.diagram_prompt!,
  imageModel: opts?.imageModel ?? DEFAULT_IMAGE_MODEL, // 기본: google/gemini-3.1-flash-image
  jobId: opts?.jobId,  // 비용 기록용 (선택)
});
if (!result) return { ok: false, imageUrl: null, outcome: 'failed', reason: 'genImage 실패' };

const ext = result.mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
const { url } = await uploadImage(
  { filename: `slot-ai-${slot.asset_key}.${ext}`, mimetype: result.mimetype, data: result.data },
  'editor-images',
);
```

`genImage()` 실패(크레딧 소진·키 미설정) 시 내부에서 텔레그램 알림 자동 발송 후 null 반환 — 슬롯 조달 실패로 처리하되 봇 파이프라인은 계속.

[Source: packages/server-bot/src/image/generate.ts]

### 웹 다운로드 — User-Agent 헤더 필수

공식 도움말 이미지 서버(AWS S3, CDN 등)는 브라우저처럼 보이는 UA가 없으면 403 반환.
프로토타입 `build-guide-assets.ts`의 `downloadImage()`에서 검증된 패턴:

```typescript
await fetch(slot.source_url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (aijackdang-guide-asset-fetch)' },
  signal: AbortSignal.timeout(30_000),
});
```

[Source: apps/api/src/scripts/build-guide-assets.ts#downloadImage]

### Playwright 캡처 — capture kind 웹 URL 경로

```typescript
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(slot.source_url!, { waitUntil: 'networkidle', timeout: 30_000 });
  const screenshot = await page.screenshot({ fullPage: false });
  // screenshot: Buffer (PNG)
  const { url } = await uploadImage(
    { filename: `slot-cap-${slot.asset_key}.png`, mimetype: 'image/png', data: screenshot },
    'editor-images',
  );
  return { ok: true, imageUrl: url, outcome: 'filled' };
} catch (err) {
  return { ok: false, imageUrl: null, outcome: 'failed', reason: String(err) };
} finally {
  await browser.close();
}
```

Playwright는 이 프로젝트에 이미 설치됨(`apps/admin` E2E 테스트 사용). `capture` 타입 중 웹 URL이 있는 경우에만 서버에서 자동 실행 가능. 로그인 벽(Make 편집기 등) → 실패 반환 후 사람이 직접 `/upload` 엔드포인트로 제출.

### 로컬 데스크톱 캡처 흐름 (`capture` + source_url 없음)

1. 관리자가 캡처 대상(터미널 출력·데스크톱 앱)을 준비(앱 설치·로그인·화면 정돈).
2. `pnpm --filter @ai-jakdang/api tsx src/scripts/capture-slot.ts --slot-id <id>` 실행 → PowerShell `System.Windows.Forms.Screen` 또는 `Add-Type` 기반 캡처 → 결과 PNG 파일 저장. *(스크립트는 로컬 환경 전용, 배포 서버에서 실행 불가)*
3. 관리자 화면의 🔵 업로드 버튼 또는 `curl`로 `POST /api/v1/admin/bots/curriculum/slots/:id/upload`에 PNG 파일 전송.
4. 슬롯 `status=ready` 승격.

이 스크립트(`capture-slot.ts`)는 이 스토리 범위 내 **설명 및 TODO 주석만** 남기고, 실제 PowerShell 연동은 운영 실행 시 사용자 가이드 참조.

### 건드릴 파일 목록

| 작업 | 파일 |
|---|---|
| 신규 생성 | `apps/api/src/services/bot/slot-filler.ts` |
| 신규 생성 | `apps/api/src/services/bot/slot-filler.test.ts` |
| 신규 생성 | `packages/bot-core/src/slot-guidance.ts` |
| 신규 생성 | `packages/bot-core/src/slot-guidance.test.ts` |
| 수정 | `apps/api/src/scripts/build-guide-assets.ts` (slot-filler 연결, manifest 저장 제거) |
| 건드리지 않음 | `apps/api/src/services/storage/index.ts` (uploadImage 그대로 재사용) |
| 건드리지 않음 | `apps/api/src/services/storage/watermark.ts` (watermarkImage 그대로 재사용) |
| 건드리지 않음 | `packages/server-bot/src/image/generate.ts` (genImage·DEFAULT_IMAGE_MODEL 재사용) |
| 건드리지 않음 | `packages/server-bot/src/image/tiptap.ts` (insertInlineImagesByMarker — 13.3 스코프) |
| 건드리지 않음 | `apps/api/src/services/bot/curriculum.ts` (13.1 시드 스크립트로 이관 예정, 이 스토리 범위 외) |

### References

- 이미지 슬롯 3+1 분류·배지·준비 방법: [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#3]
- 조달 수단 4종 표(수단·무엇을·제약): [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#8]
- 프로토타입 현황·함정(한국어 라벨·마커 분할 삽입·검열 오탐): [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#10]
- 에셋 조달 프로토타입(정식화 대상): [Source: apps/api/src/scripts/build-guide-assets.ts]
- `genImage` 시그니처·Gemini/OpenAI 라우팅·크레딧 소진 알림: [Source: packages/server-bot/src/image/generate.ts]
- `uploadImage` + 워터마크 자동 합성 경계: [Source: apps/api/src/services/storage/index.ts#uploadImage]
- `watermarkImage` 합성 로직·GIF·소형 이미지 예외: [Source: apps/api/src/services/storage/watermark.ts]
- `ALLOWED_IMAGE_TYPES`·`MAX_UPLOAD_BYTES`·`ParsedFile` 타입: [Source: apps/api/src/services/storage/index.ts]
- `bot_curriculum_image_slots` 필드 전체(source_kind enum·status enum): [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#4]
- Story 13.4 AC 원문: [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-13.4]
- `insertInlineImagesByMarker`(마커→이미지 삽입, 13.3 스코프): [Source: packages/server-bot/src/image/tiptap.ts]
- 커리큘럼 `GuideImageSlot` 인터페이스(prototype): [Source: apps/api/src/services/bot/curriculum.ts#GuideImageSlot]
- 스테이징 워크플로우 전체(①플랜→⑥스케줄 게시): [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md#2]

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

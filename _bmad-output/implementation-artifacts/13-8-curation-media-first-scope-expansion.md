# Story 13.8: 퍼오기(미디어 우선) 모드 범위 확장

Status: done

## Story

As a 운영자(슈퍼관리자),
I want 퍼오기(미디어 우선) 큐레이션을 `ai-creation`(AI 창작마당) 외 다른 게시판에도 설정으로 켤 수 있기를,
so that 유튜브 AI 영상·밈 소개 게시글이 의도한 여러 게시판에 자율 게시되고 저작권 위험 글은 관리자 보류 큐에서 검토할 수 있다.

---

## Acceptance Criteria

### AC 1 — `decideCurationMode`(퍼오기 방식 결정) 설정 기반 라우팅 확장

1. **기존 하드코딩 제거**: `apps/api/src/services/bot/curation.ts`의 `CURATION_BOARD = "ai-creation"` 상수와 `decideCurationMode()`(퍼오기 방식 결정) 내부 `board !== CURATION_BOARD` 조건을 제거한다. 이 함수는 더 이상 특정 게시판 이름을 직접 참조하지 않는다.

2. **설정 기반 판단**: `decideCurationMode()`가 3번째 파라미터로 `curationConfig?: BoardCurationConfig`(게시판별 퍼오기 설정)를 받도록 시그니처를 확장한다. `curationConfig`가 `null` / `undefined`이거나 `enabled=false`(퍼오기 비활성)이면 `null`을 반환(기존 동작 유지). `enabled=true`이면 `weights`(가중치, 합 100) 값을 사용해 `youtube`·`meme`·`ai` 중 하나를 확률 추출한다. `weights`가 없거나 불완전하면 기존 `CURATION_WEIGHTS`(`{ youtube: 45, meme: 40, ai: 15 }`)를 기본값으로 사용한다.

3. **관리자 페르소나 차단 유지**: `isAdminPersona`(관리자 페르소나 여부)=true이면 `curationConfig`와 무관하게 `null` 반환(기존 정책 유지).

4. **DB 스키마 확장**: `packages/database/src/schema/bot.ts`의 `bot_persona_boards`(담당 게시판) 테이블에 다음 두 컬럼을 추가한다.
   - `curation_enabled` boolean NOT NULL DEFAULT false — 이 게시판에서 퍼오기 모드를 켤지 여부.
   - `curation_weights` jsonb — 퍼오기 가중치(`{ youtube?: number, meme?: number, ai?: number }`). null이면 기본값 사용.
   `db:generate` → `db:migrate` 성공(번호 고정 금지 — 최신 마이그레이션 번호 확인 후 다음 번호 자동 부여, 봇 스키마 변경만 포함).

5. **`ai-creation` 시드 정합**: 기존 `apps/api/src/scripts/seed-bots.ts`(또는 `ensureBotUser` 시드)에서 `ai-creation` 게시판 행의 `curation_enabled=true`, `curation_weights=null`(기본값 사용)로 초기화해 기존 동작을 유지한다.

---

### AC 2 — 미디어 우선 확보 → 소개글 → 출처 표기 임베드 파이프라인 유지

1. **`post-pipeline.ts`(글 생성 파이프라인) Step 2.5 수정**: 기존 `decideCurationMode(board, isAdminPersona)` 호출을 아래 순서로 교체한다.
   - `bot_persona_boards`(담당 게시판) 테이블에서 `(personaId, board)` 행의 `curation_enabled`·`curation_weights`를 조회한다.
   - `decideCurationMode(board, isAdminPersona, boardCurationConfig)` 형태로 호출한다.
   - 이후 `curatedVideo`(큐레이션 영상) 확보·`effectiveCuration`(실효 퍼오기 모드) 계산·이미지 전략 오버라이드·`curationContext`(소개글 컨텍스트) 조립은 기존 로직을 그대로 사용한다(**코드 중복 없음**).

2. **기존 미디어 임베드 재사용**: 유튜브 → `prependYoutubeToTiptapDoc`(본문 앞에 유튜브 임베드 삽입), 밈/이미지 → `prependImageWithSourceToTiptapDoc`(출처 캡션 포함 이미지 삽입), 소개글 컨텍스트 → `buildCurationUserPrompt`(소개글 프롬프트)·`CurationContext`(소개글 컨텍스트 타입). 이 함수들은 **신규 구현 없이 기존 호출 경로를 그대로 사용**한다.

3. **확장 게시판 실측**: `ai-creation` 외 게시판(예: `talk`(작당 수다방))에 `curation_enabled=true`로 설정하면 해당 봇이 해당 게시판에 유튜브·밈 퍼오기 글을 생성·게시할 수 있어야 한다.

---

### AC 3 — `copyright_risk`(저작권 위험) 보류 경로 유지 및 연결

1. **밈 퍼오기 저작권 감지**: `effectiveCuration === "meme"`(밈 퍼오기 모드)이고 웹 이미지 소스 URL이 고가 스톡 사이트(`shutterstock.com`, `gettyimages.com`, `istockphoto.com`, `alamy.com`, `stock.adobe.com`)를 포함하는 경우를 저작권 위험으로 판정한다.

2. **보류 큐 적재**: 위험 판정 시 `bot_hold_queue`(보류 큐) 테이블에 `reason: "copyright_risk"`(저작권 위험 보류 사유)로 INSERT하고, `bot_generation_jobs.status`를 `held`(보류)로 갱신하며 `bot_activity_log`(봇 활동 로그)에 기록한다. 파이프라인은 `{ status: "held", jobId }` 반환으로 즉시 중단한다. 이미 `botHoldReason` enum에 `"copyright_risk"` 값이 존재하므로 스키마 변경 없음.

3. **저작권 안전 이미지**: 위험 URL이 아닌 경우(Brave 검색 일반 웹 이미지 등)에는 기존대로 `prependImageWithSourceToTiptapDoc`으로 삽입하고 정상 게시한다.

---

### AC 4 — 관리자 API 확장 (봇 담당 게시판 설정에 퍼오기 필드 추가)

1. `PUT /api/v1/admin/bots/:id/boards`(담당 게시판 일괄 교체) 요청 스키마에 게시판 항목당 `curationEnabled?: boolean`(기본 false)·`curationWeights?: { youtube?: number; meme?: number; ai?: number }`(기본 null)를 추가한다.

2. `GET /api/v1/admin/bots/:id/rhythm`(활동 리듬 + 담당 게시판 조회) 응답에 각 게시판 항목의 `curationEnabled`·`curationWeights` 필드를 포함한다.

3. 두 엔드포인트 모두 `requireSuperAdmin`(슈퍼관리자 전용) preHandler 유지.

---

### AC 5 — 관리자 UI — 담당 게시판 퍼오기 설정 추가

1. `apps/admin/app/bots/[id]/_components/BotActivitySection.tsx`의 담당 게시판 목록 각 행에 **"퍼오기 ON/OFF" 토글**과 **가중치 입력 3개**(`youtube`·`meme`·`ai`, 합계 100 안내)를 추가한다. 토글이 OFF이면 가중치 입력은 비활성(회색).

2. "활동 설정 저장" 버튼이 `PUT boards` 호출 시 변경된 `curationEnabled`·`curationWeights`를 함께 전송한다.

3. 기존 `Select`(커스텀 드롭다운)·`notifyDialog`·토스트 패턴 유지(메모리 규칙).

---

## Tasks / Subtasks

- [ ] **Task 1: DB 스키마 + 마이그레이션** (AC: 1.4)
  - [ ] `packages/database/src/schema/bot.ts` — `botPersonaBoards`(담당 게시판 테이블)에 `curationEnabled boolean NOT NULL DEFAULT false`·`curationWeights jsonb` 컬럼 추가
  - [ ] `db:generate`로 마이그레이션 파일 생성(봇 스키마 변경만, 번호 고정 금지)
  - [ ] `db:migrate` 성공 확인
  - [ ] `BotPersonaBoardRow`·`NewBotPersonaBoardRow` 추론 타입 자동 반영 확인

- [ ] **Task 2: `curation.ts` 확장** (AC: 1.1, 1.2, 1.3)
  - [ ] `BoardCurationConfig`(게시판 퍼오기 설정) 인터페이스 export: `{ enabled: boolean; weights?: Partial<Record<CurationMode, number>> }`
  - [ ] `decideCurationMode(board: string, isAdminPersona: boolean, curationConfig?: BoardCurationConfig | null): CurationMode | null` 시그니처 변경
  - [ ] `CURATION_BOARD = "ai-creation"` 상수·`board !== CURATION_BOARD` 하드코딩 제거
  - [ ] `curationConfig?.enabled`이 false/null이면 null 반환; true이면 `weights`(또는 `CURATION_WEIGHTS` 기본값) 사용해 추출
  - [ ] `isAdminPersona=true` → null 반환 정책 유지
  - [ ] `checkCurationCopyrightRisk(sourceUrl: string): boolean` 헬퍼 추가 (AC: 3.1 URL 패턴 목록)

- [ ] **Task 3: `post-pipeline.ts` 수정** (AC: 2.1, 3.2, 3.3)
  - [ ] Step 2.5 (`decideCurationMode` 호출 직전): `db`에서 `bot_persona_boards` 행 조회 → `boardCurationConfig: BoardCurationConfig | null` 구성
  - [ ] `decideCurationMode(board, isAdminPersona, boardCurationConfig)` 호출로 교체
  - [ ] `effectiveCuration === "meme"` + 이미지 확보 후: `imageSource?.url`에 `checkCurationCopyrightRisk()` 적용
  - [ ] 위험 판정 시: `db.insert(schema.botHoldQueue).values({ jobId, reason: "copyright_risk" })` → `job status=held` → `logActivity(..., "held", ..., { reason: "copyright_risk" })` → `return { status: "held", jobId }`
  - [ ] 기존 `curatedVideo`·`prependYoutubeToTiptapDoc`·`prependImageWithSourceToTiptapDoc`·`curationContext` 로직 **변경 없음**(재사용)

- [ ] **Task 4: `contracts` 스키마 확장** (AC: 4)
  - [ ] `packages/contracts/src/bot.ts`의 `botPersonaBoardUpsertSchema`(담당 게시판 upsert 스키마) 항목에 `curationEnabled: z.boolean().optional().default(false)`·`curationWeights: z.object({ youtube: z.number().optional(), meme: z.number().optional(), ai: z.number().optional() }).nullable().optional()` 추가
  - [ ] 응답 타입(`botPersonaBoardSchema`가 있다면) 동일하게 확장
  - [ ] 배럴 export 확인

- [ ] **Task 5: API 라우트 확장** (AC: 4.1, 4.2, 4.3)
  - [ ] `apps/api/src/routes/admin/bots/activity-config.ts`의 `PUT /admin/bots/:id/boards` — boards 배열 항목에 `curationEnabled`·`curationWeights` 받아 `bot_persona_boards` INSERT에 포함
  - [ ] `GET /admin/bots/:id/rhythm` 응답에 각 게시판 항목의 `curationEnabled`·`curationWeights` SELECT 추가
  - [ ] `requireSuperAdmin` preHandler 기존 적용 확인

- [ ] **Task 6: 시드 정합** (AC: 1.5)
  - [ ] `apps/api/src/scripts/seed-bots.ts`(또는 봇 시드 스크립트)에서 `ai-creation` 게시판 행을 `curation_enabled=true`로 upsert(멱등)

- [ ] **Task 7: 관리자 UI 확장** (AC: 5.1, 5.2, 5.3)
  - [ ] `apps/admin/app/bots/[id]/_components/BotActivitySection.tsx` — 게시판 행 상태에 `curationEnabled`, `curationWeights` 필드 추가
  - [ ] 게시판 목록 행 UI: `curationEnabled` 체크박스/토글 + OFF일 때 가중치 입력 비활성
  - [ ] `youtube`·`meme`·`ai` 숫자 입력(합계 100 안내 문구, 비워두면 기본값)
  - [ ] "활동 설정 저장" → `PUT boards` 호출에 `curationEnabled`·`curationWeights` 포함
  - [ ] GET boards 응답에서 초기값 로드

- [ ] **Task 8: 타입 검사** (전체 AC)
  - [ ] `apps/api` typecheck — 신규/수정 파일 오류 없음
  - [ ] `apps/admin` typecheck — 통과
  - [ ] `packages/database` typecheck 확인

---

## Dev Notes

### 기존 구현 vs 신규 확장 — 명확한 경계

| 항목 | 기존(변경 금지) | 이번 스토리 신규/확장 |
|---|---|---|
| `decideCurationMode()`(퍼오기 방식 결정) | `ai-creation` 하드코딩 체크, 파라미터 2개 | 3번째 `curationConfig` 파라미터 추가, 하드코딩 제거 |
| `CURATION_WEIGHTS`(기본 가중치) | `{ youtube:45, meme:40, ai:15 }` 상수 | 유지(미지정 시 폴백으로 재사용) |
| `curationVideoQuery()`·`curationMemeQuery()` | 검색어 풀 함수 | 변경 없음 |
| `prependYoutubeToTiptapDoc`(유튜브 임베드) | `server-bot/image` | 호출 위치·인자 변경 없음 |
| `prependImageWithSourceToTiptapDoc` | `server-bot/image` | 호출 위치·인자 변경 없음 |
| `bot_hold_queue.reason = "copyright_risk"` | enum 값 존재, 미사용 | post-pipeline.ts에서 실제 INSERT 연결 |
| `bot_persona_boards` 테이블 | `id, personaId, board, weight` | `curationEnabled, curationWeights` 2컬럼 추가(마이그레이션) |

### `decideCurationMode()` 확장 시 호환성

- 기존 호출부(`post-pipeline.ts`)가 `decideCurationMode(board, isAdminPersona)` 2개 인자로 호출하던 코드는 `curationConfig` 파라미터가 optional이므로 컴파일 오류 없이 동작한다. 단, Task 3에서 반드시 3번째 인자를 주입하도록 수정한다.
- 단위 테스트가 있다면 기존 `ai-creation` 케이스에 `curationConfig: { enabled: true }` 인자를 추가해 동일한 결과를 보장.

### `boardCurationConfig` 조회 패턴 (post-pipeline.ts Step 2.5)

```ts
// Step 2.5 앞에 위치
const boardRow = await db
  .select({
    curationEnabled: schema.botPersonaBoards.curationEnabled,
    curationWeights: schema.botPersonaBoards.curationWeights,
  })
  .from(schema.botPersonaBoards)
  .where(
    and(
      eq(schema.botPersonaBoards.personaId, personaId),
      eq(schema.botPersonaBoards.board, board),
    ),
  )
  .limit(1);

const boardCurationConfig: BoardCurationConfig | null = boardRow[0]
  ? {
      enabled: boardRow[0].curationEnabled,
      weights: (boardRow[0].curationWeights as Partial<Record<CurationMode, number>> | null) ?? undefined,
    }
  : null;

const curationMode = decideCurationMode(board, isAdminPersona, boardCurationConfig);
```

### `copyright_risk`(저작권 위험) 감지 위치

`checkCurationCopyrightRisk(sourceUrl: string): boolean`는 `curation.ts`에 추가한다. URL 판단이라 DB·AI 호출 없는 순수 함수이므로 같은 파일에 두어도 무방하다.

```ts
const PAID_STOCK_HOSTS = [
  "shutterstock.com", "gettyimages.com", "istockphoto.com",
  "alamy.com", "stock.adobe.com",
];
export function checkCurationCopyrightRisk(sourceUrl: string): boolean {
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase();
    return PAID_STOCK_HOSTS.some((h) => host.endsWith(h));
  } catch { return false; }
}
```

삽입 위치: `post-pipeline.ts`에서 `imageSource`가 확보된 직후(`effectiveCuration === "meme"` && `imageSource !== null` 조건 안에서 `imageSource.url` 대상으로 호출).

### 저작권 보류 INSERT 패턴

```ts
if (effectiveCuration === "meme" && imageSource?.url && checkCurationCopyrightRisk(imageSource.url)) {
  await db.insert(schema.botHoldQueue).values({ jobId, reason: "copyright_risk", decided: false });
  await db.update(schema.botGenerationJobs)
    .set({ status: "held", updatedAt: new Date() })
    .where(eq(schema.botGenerationJobs.id, jobId));
  await logActivity(db, personaId, "held", jobId, { reason: "copyright_risk", sourceUrl: imageSource.url });
  pipelineResult = { status: "held", jobId };
  break; // 생성 루프 중단
}
```

이 블록은 `if (censorResult.overall === "pass") { ... }` 내부의 `imageUrl` 확보 직후, `finalContentJson` 조립 이전에 삽입한다.

### `bot_persona_boards` 마이그레이션 패턴

```ts
// packages/database/src/schema/bot.ts (기존 botPersonaBoards에 추가)
curationEnabled: boolean("curation_enabled").notNull().default(false),
curationWeights: jsonb("curation_weights"),
```

`db:generate` 실행 전 현재 최신 마이그레이션 번호를 `packages/database/migrations/meta/_journal.json`에서 확인한다(번호 고정 금지). 이미 운영 DB에 `bot_persona_boards`가 존재하므로 생성된 마이그레이션이 `ALTER TABLE ... ADD COLUMN` SQL을 포함하는지 검증한다.

### Admin UI 게시판 행 확장 패턴

기존 `BotActivitySection.tsx`의 게시판 추가 행 state 타입:
```ts
// 기존
type BoardEntry = { board: string; weight: number };
// 확장 후
type BoardEntry = {
  board: string;
  weight: number;
  curationEnabled: boolean;
  curationWeights: { youtube?: number; meme?: number; ai?: number } | null;
};
```

게시판 행 렌더링에 토글과 가중치 3개 입력을 추가한다. `curationEnabled=false`이면 `<input disabled>` 처리.

### 파일 배치

| 파일 | 작업 | 중복 구현 금지 확인 |
|---|---|---|
| `packages/database/src/schema/bot.ts` | `botPersonaBoards` 2컬럼 추가 | 기존 컬럼 보존 |
| `packages/database/migrations/` | `db:generate` 자동 생성 | 번호 자동 부여 |
| `apps/api/src/services/bot/curation.ts` | `BoardCurationConfig` 인터페이스, `decideCurationMode` 시그니처 확장, 하드코딩 제거, `checkCurationCopyrightRisk` 추가 | `CURATION_WEIGHTS`·검색어 풀 함수 보존 |
| `apps/api/src/services/bot/post-pipeline.ts` | Step 2.5에 board curation config 조회 + `decideCurationMode` 3인자 호출 + copyright_risk 분기 | 기존 `curatedVideo`·`prependYoutubeToTiptapDoc` 경로 보존 |
| `packages/contracts/src/bot.ts` | `botPersonaBoardUpsertSchema`에 `curationEnabled`·`curationWeights` 추가 | 기존 `board`·`weight` 필드 보존 |
| `apps/api/src/routes/admin/bots/activity-config.ts` | boards PUT/GET에 curation 필드 추가 | `requireSuperAdmin` 유지 |
| `apps/api/src/scripts/seed-bots.ts` | `ai-creation` 행 `curation_enabled=true` upsert 추가 | 다른 게시판 시드 보존 |
| `apps/admin/app/bots/[id]/_components/BotActivitySection.tsx` | 게시판 행에 퍼오기 토글 + 가중치 입력 추가 | 기존 리듬·게시판 저장 로직 보존 |

### References

- [Source: docs/seeding-bot/GUIDE-CURRICULUM-AND-IMAGE-MODES.md§1] — 이미지 3-모드 설계; C(미디어 우선)는 이미 `curation.ts`에 구현, Epic 13에서는 적용 범위만 확장
- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-13.8] — AC 원문(3개 AC)
- [Source: apps/api/src/services/bot/curation.ts] — `decideCurationMode`(퍼오기 방식 결정), `CURATION_WEIGHTS`(기본 가중치), `curationVideoQuery`, `curationMemeQuery` 현재 구현
- [Source: apps/api/src/services/bot/post-pipeline.ts#Step-2.5] — `decideCurationMode` 호출 지점, `effectiveCuration`(실효 퍼오기 모드), `curatedVideo`(큐레이션 영상), `curationContext`(소개글 컨텍스트) 전달, `prependYoutubeToTiptapDoc`·`prependImageWithSourceToTiptapDoc` 사용처
- [Source: packages/database/src/schema/bot.ts#botPersonaBoards] — 현재 `id, personaId, board, weight` 4컬럼, `botHoldReason` enum `copyright_risk` 존재 확인
- [Source: packages/server-bot/src/search/brave-video.ts] — `searchYoutubeVideo`(유튜브 영상 검색), `CuratedVideo`(큐레이션 영상 타입)
- [Source: packages/contracts/src/bot.ts] — `botPersonaBoardUpsertSchema`(담당 게시판 upsert 스키마) 현재 구조
- [Source: apps/api/src/routes/admin/bots/activity-config.ts] — `PUT /boards`, `GET /rhythm` 기존 구현, `requireSuperAdmin` 패턴
- [Source: apps/admin/app/bots/[id]/_components/BotActivitySection.tsx] — 담당 게시판 목록 UI, `BoardEntry` 상태 타입, 저장 버튼 로직
- [Source: _bmad-output/implementation-artifacts/11-15-activity-config-boards-topics-models-ui.md] — 설정 기반 대상 제어 패턴, `BOARD_OPTIONS` 구성, `Select` 컴포넌트 사용법

---

## Dev Agent Record

### Agent Model Used

_(구현 시 기입)_

### Debug Log References

_(구현 시 기입)_

### Completion Notes List

_(구현 시 기입)_

### File List

_(구현 시 기입)_

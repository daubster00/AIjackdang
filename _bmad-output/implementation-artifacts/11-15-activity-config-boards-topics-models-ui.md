# Story 11.15: 활동 설정·담당 게시판 + 주제 풀 + 모델 할당 UI

Status: ready-for-dev

## Story

As a 슈퍼관리자,
I want `/bots/[id]` 상세 페이지에서 봇별 활동 리듬(글/주·댓글 빈도·활동 시간대·요일)·담당 게시판·고정 주제 풀·AI 모델 할당을 설정하기,
so that 각 봇 캐릭터가 의도된 주기·게시판·주제·모델로 자율 활동한다.

## Acceptance Criteria

1. **활동 설정 탭** — `bot_activity_rhythm`(활동 리듬) + `bot_persona_boards`(담당 게시판)
   - 글/주(`posts_per_week`), 댓글/주(`comments_per_week`) 숫자 입력.
   - 활동 시간대(`active_hours`) 다중 추가/삭제(시작 시·종료 시 쌍, `from/to=0~23`, 자정 넘김은 `crossesMidnight` 체크박스로 명시). `to > 24` 입력 금지.
   - 활동 요일 성향(`active_days`) — 주중(`weekday`) / 주말(`weekend`) 가중치 숫자 입력(합계 1.0 권장 안내).
   - 담당 게시판 추가/제거 — `BOARD_OPTIONS`(= `BOARDS` + 특수 게시판 `qna`·`resource:<type>`)에서 커스텀 드롭다운으로 선택 후 추가, 가중치(`weight`, 1~10) 입력, 기존 목록에서 삭제.
   - "활동 설정 저장" → `PATCH /api/v1/admin/bots/:id/rhythm`, `PUT /api/v1/admin/bots/:id/boards` 각각 호출.

2. **주제 풀 탭** — `bot_topics`(주제 풀)
   - 봇의 `fixed`(고정) 주제 목록 표시 — `title_seed`(주제 출발점 텍스트), `board`(게시판), `status`(`unused`/`used`/`cooling`), `used_at`(마지막 사용 시각).
   - 주제 추가 폼: `title_seed`, `board`(커스텀 드롭다운 — **`BOARD_OPTIONS` = BOARDS + 특수 게시판 `qna`·`resource:<type>`**, Dev Notes §특수 게시판), `topic_kind`(커스텀 드롭다운, `fixed` 기본값), `series_group`(선택).
   - 주제 개별 수정(인라인), 삭제.
   - `bot_auto_refill_topics`(자동 주제 보충) ON/OFF 토글 — 현재 봇의 설정 값을 표시하고 `PATCH /api/v1/admin/bots/:id/auto-refill` 로 저장.

3. **모델 할당 탭** — `bot_model_assignments`(모델 할당)
   - 글 생성용(`generation`)·검열관용(`censor`) 두 행 표시.
   - 각 행에서 프로바이더(`provider`: `openai` / `anthropic` / `google`) 선택 → 커스텀 드롭다운.
   - 모델명(`model`) 텍스트 입력.
   - 활성화(`is_active`) 토글.
   - 비고(`note`) 텍스트 입력.
   - "모델 저장" → `PUT /api/v1/admin/bots/:id/model-assignments` 일괄 upsert.

4. **공통 규칙**
   - 모든 선택 UI는 `@/components/ui/Select`(커스텀 드롭다운)만 사용. 브라우저 native `<select>` 직접 노출 금지.
   - 저장 성공/실패는 화면 중앙 토스트(기존 Toast 컴포넌트 패턴).
   - 이 탭들은 11.14에서 생성된 `/bots/[id]` 페이지의 탭 패널로 추가된다.
   - 모든 API는 `adminGuard`(관리자 인증) + `requireSuperAdmin`(슈퍼관리자 전용) preHandler 적용.
   - 타입은 `@ai-jakdang/contracts`의 `bot*` 스키마만 사용(즉석 `z.object()` 금지).

## Tasks / Subtasks

- [ ] Task 1: API 라우트 — 활동 리듬 + 담당 게시판 엔드포인트 (AC: 1, 4)
  - [ ] `PATCH /api/v1/admin/bots/:id/rhythm` — `botRhythmUpdateSchema`로 검증 후 `bot_activity_rhythm` upsert (persona_id 기준)
  - [ ] `PUT /api/v1/admin/bots/:id/boards` — `botPersonaBoardUpsertSchema`로 검증 후 기존 행 삭제 + 일괄 삽입 (트랜잭션, `bot_persona_boards` 전체 교체)
  - [ ] `GET /api/v1/admin/bots/:id/rhythm` — 현재 리듬 + 담당 게시판 목록 응답
  - [ ] `requireSuperAdmin` preHandler 적용
  - [ ] `apps/api/src/routes/admin/bots/index.ts`에 위 3개 라우트 등록

- [ ] Task 2: API 라우트 — 주제 풀 엔드포인트 (AC: 2, 4)
  - [ ] `GET /api/v1/admin/bots/:id/topics` — `bot_topics` 전체 목록(`topic_kind=fixed` 포함 전량), `status`·`board` 필터 optional
  - [ ] `POST /api/v1/admin/bots/:id/topics` — `botTopicCreateSchema` 검증, `persona_id` 강제 주입 후 INSERT
  - [ ] `PATCH /api/v1/admin/bots/:id/topics/:topicId` — `botTopicCreateSchema.partial()` 검증 후 UPDATE
  - [ ] `DELETE /api/v1/admin/bots/:id/topics/:topicId` — DELETE (본인 persona 소유 확인)
  - [ ] `PATCH /api/v1/admin/bots/:id/auto-refill` — `{autoRefill: z.boolean()}` body → `bot_settings`의 `bot_auto_refill_topics` 키 upsert (site_settings 패턴 재사용)
  - [ ] `requireSuperAdmin` preHandler 전체 적용
  - [ ] 위 라우트 `index.ts`에 등록

- [ ] Task 3: API 라우트 — 모델 할당 엔드포인트 (AC: 3, 4)
  - [ ] `GET /api/v1/admin/bots/:id/model-assignments` — 해당 persona의 `bot_model_assignments` 목록(`WHERE persona_id = :id`, purpose별). 모델 할당은 `persona_id`로 역참조하는 구조(#5 정합)
  - [ ] `PUT /api/v1/admin/bots/:id/model-assignments` — `botModelAssignmentUpsertSchema` 배열 검증 후 **해당 persona 행만** 전체 교체(트랜잭션: `WHERE persona_id = :id` DELETE + INSERT). `persona_id`는 URL의 `:id`로 강제 주입(body 값 신뢰 금지). **unique `(persona_id, purpose)`** 보장 — 같은 purpose 중복 배열 입력은 검증에서 거부(generation/censor/image 각 1개)
  - [ ] `requireSuperAdmin` preHandler 적용
  - [ ] 위 라우트 `index.ts`에 등록

- [ ] Task 4: 관리자 라우트 등록 (AC: 4)
  - [ ] `apps/api/src/routes/admin/bots/index.ts` 파일이 11.14에서 생성되어 있는지 확인
  - [ ] 없으면 신규 생성 후 `registerAdminBotsRoutes(app)` 함수로 Task 1~3 라우트 등록
  - [ ] `apps/api/src/routes/admin/index.ts`에 `import`·`await registerAdminBotsRoutes(app)` 추가

- [ ] Task 5: 프론트엔드 — `/bots/[id]` 탭 패널 추가 (AC: 1~4)
  - [ ] 11.14가 생성한 `/bots/[id]/page.tsx`에서 탭 구조(`line-tabs`, `data-tab-panel`) 파악 후 "활동 설정", "주제 풀", "모델 할당" 탭 버튼 추가
  - [ ] 탭 전환은 React 상태(`activeTab`)로 제어(DOM 직접 조작 금지)

- [ ] Task 6: 활동 설정 탭 UI (AC: 1, 4)
  - [ ] `BotActivitySection` 컴포넌트(파일 내부 정의 가능)
  - [ ] `GET /api/v1/admin/bots/:id/rhythm` 호출로 초기값 로드
  - [ ] 글/주·댓글/주 입력 필드 (`<input type="number">`)
  - [ ] 활동 시간대 다중 추가/삭제 UI (from-to 쌍; 추가 버튼 → 배열에 push, × 버튼으로 삭제)
  - [ ] 활동 요일 가중치 두 입력 (주중/주말, 실수 입력, 합계 안내 문구)
  - [ ] 담당 게시판 섹션
    - [ ] 현재 담당 게시판 목록 표시 (board slug, 가중치, × 삭제)
    - [ ] 추가 행: `<Select>` 드롭다운(**`BOARD_OPTIONS` = BOARDS 배열 + 특수 게시판** label/value 매핑 — 아래 Dev Notes §특수 게시판 참조) + 가중치 숫자 입력 + "추가" 버튼
    - [ ] **특수 게시판 옵션 포함**: `qna`(묻고답하기)와 `resource:prompt`·`resource:mcp`·`resource:rules-config`·`resource:template-checklist`(실전자료 4종). 11.5가 페르소나에 이 board들을 시드하고 11.9가 작성 경로로 라우팅하므로(#6) 드롭다운에서 반드시 선택 가능해야 한다(BOARDS 키만 노출하면 Q&A·자료 담당 봇을 설정할 수 없음)
    - [ ] 이미 추가된 board는 드롭다운 옵션에서 disabled 또는 제외
  - [ ] "활동 설정 저장" 버튼 → `PATCH rhythm` + `PUT boards` 순차 호출

- [ ] Task 7: 주제 풀 탭 UI (AC: 2, 4)
  - [ ] `BotTopicsSection` 컴포넌트
  - [ ] `GET /api/v1/admin/bots/:id/topics` 호출로 목록 로드
  - [ ] 테이블 컬럼: 주제 텍스트(`title_seed`), 게시판(`board`), 종류(`topic_kind`), 상태(`status`·배지), 마지막 사용(`used_at`), 수정·삭제 버튼
  - [ ] `status` 배지: `unused`→badge-green "미사용", `used`→badge-gray "사용됨", `cooling`→badge-orange "재사용대기"
  - [ ] 인라인 수정: 행 클릭/편집 버튼으로 `title_seed`, `board`(커스텀 드롭다운), `series_group` 편집 후 `PATCH` 저장
  - [ ] 추가 폼 (테이블 하단 또는 모달): `title_seed` 입력, `board` 커스텀 드롭다운(**BOARD_OPTIONS** = BOARDS + 특수 게시판), `topic_kind` 커스텀 드롭다운(`fixed`/`realtime`/`auto`), `series_group` 선택입력 → `POST` 저장
  - [ ] 자동 보충 ON/OFF 토글 스위치 (label: "주제 자동 보충") — 초기값은 `bot_settings`에서 `bot_auto_refill_topics` 조회(`GET /api/v1/admin/bots/settings` 또는 상위 상세 API 활용), 변경 시 `PATCH auto-refill`

- [ ] Task 8: 모델 할당 탭 UI (AC: 3, 4)
  - [ ] `BotModelSection` 컴포넌트
  - [ ] `GET /api/v1/admin/bots/:id/model-assignments` 호출로 초기값 로드
  - [ ] 글 생성용(`generation`)·검열관용(`censor`) 두 행의 카드 또는 테이블 행 표시
  - [ ] 각 행: `provider` 커스텀 드롭다운(`openai`→"OpenAI", `anthropic`→"Claude(Anthropic)", `google`→"Gemini(Google)"), `model` 텍스트 입력, `is_active` 토글, `note` 텍스트 입력
  - [ ] "모델 저장" 버튼 → `PUT model-assignments`
  - [ ] 이미지 생성용(`image`) purpose 행은 선택 옵션으로 추가 가능하도록 설계

- [ ] Task 9: 타입 검사 및 빌드 검증 (AC: 4)
  - [ ] `apps/admin`에서 `pnpm tsc --noEmit` 통과 확인
  - [ ] `apps/api`에서 `pnpm tsc --noEmit` 통과 확인
  - [ ] 11.14 페이지와 탭 연결 무결성 확인 (존재하지 않는 탭 패널 참조 없음)

## Dev Notes

### 11.14 의존 사항 (착수 전 확인 필수)

이 스토리는 11.14(`관리자 봇 라우트·목록/상세 + 캐릭터·프롬프트 편집`)가 완료된 후 실행한다.

11.14가 생성한 내용:
- `apps/api/src/routes/admin/bots/index.ts` — `registerAdminBotsRoutes` 함수 + `GET /admin/bots`, `GET /admin/bots/:id`, `PATCH /admin/bots/:id` (캐릭터/프롬프트)
- `apps/admin/app/bots/page.tsx` — 봇 목록 페이지
- `apps/admin/app/bots/[id]/page.tsx` — 봇 상세 페이지 (탭: "캐릭터·프롬프트" 이미 존재)
- `apps/api/src/routes/admin/index.ts`에 `registerAdminBotsRoutes` 이미 등록됨

11.14가 없을 경우 이 스토리에서 위 파일도 생성해야 한다 (11.14 스토리 파일 확인).

### AdminShell activeKey

`apps/admin/components/layout/AdminShell.tsx`의 `NAV_GROUPS`에 "활동 봇" 메뉴가 없다면 추가 필요:
```ts
// AdminShell.tsx NAV_GROUPS에 추가 (예시)
{
  label: "Bot",
  items: [
    { key: "bots", href: "/bots", icon: "ri-robot-line", label: "활동 봇" },
  ],
},
```
`SUPER_ADMIN_ONLY_KEYS`에 `"bots"` 추가 (`apps/admin/components/layout/AdminShell.tsx` 96번째 줄 근처).

### 탭 구조 패턴 (11.14 페이지에 추가)

`/bots/[id]/page.tsx`에서 기존 탭 패널 패턴 준수:
```tsx
// 탭 버튼 (line-tabs)
<div className="line-tabs" role="tablist">
  <button className={`line-tab ${activeTab === "character" ? "active" : ""}`} onClick={() => setActiveTab("character")}>캐릭터·프롬프트</button>
  <button className={`line-tab ${activeTab === "activity" ? "active" : ""}`} onClick={() => setActiveTab("activity")}>활동 설정</button>
  <button className={`line-tab ${activeTab === "topics" ? "active" : ""}`} onClick={() => setActiveTab("topics")}>주제 풀</button>
  <button className={`line-tab ${activeTab === "models" ? "active" : ""}`} onClick={() => setActiveTab("models")}>모델 할당</button>
</div>

// 탭 패널 (React 상태 activeTab으로 display 제어)
<div style={{ display: activeTab === "activity" ? undefined : "none" }}>
  <BotActivitySection botId={botId} />
</div>
```

### 커스텀 Select 사용법 (메모리 규칙: native select 직접 노출 금지)

`@/components/ui/Select`의 `Select` 컴포넌트만 사용:
```tsx
import { Select } from "@/components/ui/Select";
import { BOARDS } from "@/lib/boards";

// 담당 게시판 선택 — BOARD_OPTIONS = BOARDS + 특수 게시판(qna·resource:<type>)
// (Q&A·자료 담당 봇 설정에 필수 — §특수 게시판 참조)
const SPECIAL_BOARD_OPTIONS = [
  { value: "qna", label: "묻고답하기 (Q&A)" },
  { value: "resource:prompt", label: "실전자료 · 프롬프트" },
  { value: "resource:mcp", label: "실전자료 · MCP" },
  { value: "resource:rules-config", label: "실전자료 · 룰/설정" },
  { value: "resource:template-checklist", label: "실전자료 · 템플릿/체크리스트" },
];
const BOARD_OPTIONS = [
  ...BOARDS.map((b) => ({ value: b.apiBoard ?? b.slug, label: b.label })),
  ...SPECIAL_BOARD_OPTIONS,
];
<Select
  label="게시판"
  options={BOARD_OPTIONS}
  value={selectedBoard}
  onChange={(v) => setSelectedBoard(v)}
  placeholder="게시판 선택"
/>

// 프로바이더 선택
const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Claude (Anthropic)" },
  { value: "google", label: "Gemini (Google)" },
];
<Select options={PROVIDER_OPTIONS} value={provider} onChange={setProvider} label="프로바이더" />

// 주제 종류 선택
const TOPIC_KIND_OPTIONS = [
  { value: "fixed", label: "고정(fixed)" },
  { value: "realtime", label: "실시간(realtime)" },
  { value: "auto", label: "자동 보충(auto)" },
];
```
`Select.tsx` 경로: `apps/admin/components/ui/Select/Select.tsx` — `controlled` 모드(value + onChange prop 전달)로 사용.

### 특수 게시판 — `qna` · `resource:<type>` (담당 게시판/주제 board 값)

`bot_persona_boards.board`·`bot_topics.board` 컬럼은 일반 `BOARDS` 키 **외에** 특수값을 허용한다(Story 11.1 varchar, 11.5 시드):
- `qna` — 묻고답하기(Q&A). 11.9가 감지해 `createQuestionAsBot`으로 라우팅(#6).
- `resource:<type>` — 실전자료. `resource:prompt`·`resource:mcp`·`resource:rules-config`·`resource:template-checklist`. 11.9가 `resource:` 접두사 감지해 `createResourceAsBot`으로 라우팅(#6).

> ⚠️ **드롭다운에서 이 특수 게시판들을 제외하지 말 것**(과거 설계가 "일반 게시판으로 제한"이라 했으나 폐기 — #6/11.5와 모순). `BOARD_OPTIONS = BOARDS + SPECIAL_BOARD_OPTIONS`로 항상 선택 가능해야 Q&A·자료 담당 봇을 설정할 수 있다.

`apps/admin/lib/boards.ts`의 `BOARDS` 상수:
- `apiBoard` 필드가 있으면 DB `posts.board` 값이 `apiBoard`임(예: `{ slug: "vibe-guide", apiBoard: "vibe-coding-guide" }`).
- 일반 게시판의 `bot_persona_boards.board` 값은 **`packages/contracts/board.ts`의 BOARDS 키**, 특수 게시판은 위 `qna`/`resource:<type>` 리터럴을 그대로 저장한다.
- 실무 처리: 일반 board는 `boardApiParam(slug)`로 admin slug → DB board 변환 후 전송. 특수 board(`qna`/`resource:*`)는 변환 없이 그대로 전송.

### API 라우트 패턴

`apps/api/src/routes/admin/grades/index.ts` 패턴 준수:
```ts
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
import { botRhythmUpdateSchema, botPersonaBoardUpsertSchema, botTopicCreateSchema, botModelAssignmentUpsertSchema } from "@ai-jakdang/contracts";

// PATCH /admin/bots/:id/rhythm
app.patch("/admin/bots/:id/rhythm", { preHandler: [requireSuperAdmin] }, async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = botRhythmUpdateSchema.parse(req.body);
  // bot_activity_rhythm upsert (persona_id = id, onConflictDoUpdate)
  // ...
});
```
타입은 `@ai-jakdang/contracts`의 `bot*` 스키마. 즉석 Zod 스키마 정의 금지.

### bot_activity_rhythm upsert 패턴

```ts
// Drizzle onConflictDoUpdate (bot_activity_rhythm의 persona_id는 UNIQUE)
await db.insert(botActivityRhythm)
  .values({ personaId: id, postsPerWeek, commentsPerWeek, activeHours, activeDays })
  .onConflictDoUpdate({
    target: botActivityRhythm.personaId,
    set: { postsPerWeek, commentsPerWeek, activeHours, activeDays, updatedAt: new Date() }
  });
```

### bot_persona_boards 전체 교체 (트랜잭션)

```ts
await db.transaction(async (tx) => {
  await tx.delete(botPersonaBoards).where(eq(botPersonaBoards.personaId, id));
  if (boards.length > 0) {
    await tx.insert(botPersonaBoards).values(boards.map(b => ({ personaId: id, board: b.board, weight: b.weight })));
  }
});
```

### bot_settings의 auto_refill 패턴

`bot_settings`는 key-value JSONB `site_settings` 패턴 재사용:
```ts
// PATCH /admin/bots/:id/auto-refill
const { autoRefill } = req.body as { autoRefill: boolean };
await db.insert(botSettings)
  .values({ key: "bot_auto_refill_topics", value: autoRefill })
  .onConflictDoUpdate({ target: botSettings.key, set: { value: autoRefill } });
```
주의: `bot_settings`가 per-persona 설정인지 전역 설정인지 ARCHITECTURE §2.10 확인 필요. §2.10에서 `bot_settings`는 전역 설정(봇 전체에 하나)이므로 봇별 자동 보충 토글이 전역 키인지 봇별 키인지 명확화 필요.
→ ARCHITECTURE §2.10의 `bot_auto_refill_topics`는 전역 키이다. 봇별 적용이 필요하면 UI에서 "전역 설정(모든 봇에 적용)"임을 명시하는 안내 문구를 표시.

### Toast 컴포넌트

기존 `members/[id]/page.tsx`의 `Toast` 컴포넌트 복사 또는 인라인 정의:
- 위치: 화면 **중앙**(메모리 규칙 — 우측 하단 금지)
- `position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)"`
- `SettingsTabPanels.tsx`의 Toast 스타일 참고

### confirmDialog / notifyDialog

삭제 확인은 `@/lib/dialog`의 `confirmDialog`(두 번째 클릭으로 실제 삭제) 사용:
```ts
import { confirmDialog, notifyDialog } from "@/lib/dialog";
const ok = await confirmDialog({ title: "주제 삭제", message: "이 주제를 삭제하시겠습니까?", tone: "danger" });
if (!ok) return;
```

### 자동 보충 토글에 사용할 현재 설정 조회

`bot_settings`(봇 전역 설정)의 `bot_auto_refill_topics` 값은 11.16 운영 패널에서도 다룬다. 이 스토리에서는 상세 페이지의 주제 풀 탭에 토글을 배치하고, `GET /api/v1/admin/bots/settings`(11.16에서 구현될 수 있음)가 없으면 직접 `bot_settings` 테이블을 조회하는 전용 엔드포인트를 임시 구현한다.

### 11.2 contracts 스키마 의존

다음 스키마가 `@ai-jakdang/contracts`에서 export되어 있어야 한다(11.2 완료 전제):
- `botRhythmUpdateSchema` — `{postsPerWeek, commentsPerWeek, activeHours, activeDays}`
- `botPersonaBoardUpsertSchema` — `{boards: [{board, weight}]}`
- `botTopicCreateSchema` — `{personaId, board, titleSeed, topicKind, seriesGroup?}`
- `botModelAssignmentUpsertSchema` — `{personaId, provider, model, purpose, isActive, note?}`
- `botTopicSchema` — 주제 목록 항목 타입
- `botModelAssignmentSchema` — 모델 할당 항목 타입
- `botActivityRhythmSchema` — 활동 리듬 응답 타입

11.2가 미완료인 경우 위 스키마를 이 스토리에서 임시 로컬 정의하지 말고, 11.2를 먼저 완료할 것.

### 파일 배치

| 파일 | 작업 |
|---|---|
| `apps/api/src/routes/admin/bots/index.ts` | Task 1~3 라우트 추가 (11.14에 이어서) |
| `apps/api/src/routes/admin/index.ts` | `registerAdminBotsRoutes` 이미 등록 여부 확인 |
| `apps/admin/app/bots/[id]/page.tsx` | 탭 버튼 + 탭 패널 3개 추가 |
| `apps/admin/components/layout/AdminShell.tsx` | "활동 봇" nav 항목 + `SUPER_ADMIN_ONLY_KEYS` 추가 (11.14에서 했을 경우 생략) |

### Project Structure Notes

- `apps/admin/components/ui/Select/Select.tsx` — 커스텀 드롭다운. `import { Select } from "@/components/ui/Select"` 경로 사용.
- `apps/admin/lib/boards.ts` — `BOARDS` 배열, `boardApiParam(slug)` 헬퍼. 담당 게시판 선택 시 `apiBoard ?? slug` 값을 API에 전달.
- `apps/admin/lib/api.ts` — `API_BASE_URL` (`process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4003"`).
- `apps/api/src/plugins/adminGuard.ts` — `requireSuperAdmin` preHandler import 경로.
- `packages/database/src/schema/bot.ts` — `botActivityRhythm`, `botPersonaBoards`, `botTopics`, `botModelAssignments`, `botSettings` Drizzle 테이블 객체(11.1에서 생성).

### References

- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story-11.15] — AC 원문(3개 AC)
- [Source: docs/seeding-bot/ARCHITECTURE.md#2-데이터-모델] — §2.3 `bot_persona_boards`, §2.4 `bot_activity_rhythm`, §2.5 `bot_topics`, §2.6 `bot_model_assignments`, §2.10 `bot_settings` 전체 필드
- [Source: docs/seeding-bot/ARCHITECTURE.md#10-관리자-대시보드] — 탭 구조(캐릭터·프롬프트/활동설정/주제풀/모델할당/운영패널), adminGuard+requireSuperAdmin, 리스트=상세페이지 규약
- [Source: docs/seeding-bot/ARCHITECTURE.md#0-설계-원칙] — §0.7 타입 contracts 단일 진입점, §0.2 DB 접근 api/worker만
- [Source: apps/admin/components/ui/Select/Select.tsx] — 커스텀 드롭다운 컴포넌트 API (SelectOption, controlled mode)
- [Source: apps/admin/lib/boards.ts] — BOARDS 상수, boardApiParam, dbBoardToAdminSlug 헬퍼
- [Source: apps/admin/app/members/[id]/page.tsx] — Toast 컴포넌트 패턴, Modal 패턴, line-tabs 탭 패턴
- [Source: apps/admin/app/ranks/[tier]/page.tsx] — confirmDialog/notifyDialog 사용, PATCH/DELETE 패턴, AdminShell activeKey
- [Source: apps/admin/app/settings/_components/SettingsTabPanels.tsx] — activeTab React 상태 제어 패턴, Select import 방식, 화면 중앙 Toast
- [Source: apps/admin/components/layout/AdminShell.tsx] — NAV_GROUPS 구조, SUPER_ADMIN_ONLY_KEYS, activeKey 패턴
- [Source: apps/api/src/routes/admin/grades/index.ts] — requireSuperAdmin, getDb(), Drizzle 패턴
- [Source: apps/api/src/routes/admin/index.ts] — adminRoutes 함수 + registerAdmin* 등록 패턴
- [Source: _bmad-output/implementation-artifacts/11-2-bot-zod-contracts.md] — bot contracts 스키마 목록 및 필드명 camelCase 규칙

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

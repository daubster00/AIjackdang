# Story 11.19: AI 사용량·비용 관측 (사용 로그 ledger + 대시보드 위젯 + AI 관리 사용량 페이지)

Status: ready-for-dev

## Story

As a 슈퍼관리자(`super_admin`),
I want 모든 AI 호출(글 생성·검열·이미지·검색 요약·번역)의 비용과 토큰 사용량을 모델·제공자·용도별로 집계해 메인 대시보드와 AI 관리 화면에서 확인하기,
so that AI를 얼마나 쓰고 있는지(오늘/이번 주/이번 달, 어떤 모델이 비싼지)를 한눈에 파악하고 비용 상한 대비 잔여를 관리할 수 있다.

---

## 배경 (왜 이 스토리가 필요한가)

기존 비용 추적은 **봇 글 1건 단위(`bot_generation_jobs.cost`)**와 **`bot_activity_log`의 `cost` 이벤트(costUsd만)**에 머문다. 11.16 운영 패널·11.17 일일 리포트가 이를 7일·일별 **합계**로 보여주지만, 다음이 빠져 있다:

- **모델·제공자·용도별 분해**(어떤 모델/단계가 돈을 많이 쓰는지) 불가 — costUsd만 있고 provider/model/purpose/token이 없음.
- **메인 관리자 대시보드에 AI 비용 노출 없음** — 운영 패널까지 들어가야만 보임.
- **토큰 사용량 관측 없음** — 비용 급증 원인(입력/출력 토큰 폭증) 진단 불가.
- **봇 외 AI 사용 확장 대비 없음** — 향후 다른 AI 기능이 생겨도 같은 곳에 기록할 ledger가 없음.

이 스토리는 **호출 단위 AI 사용 로그(ledger)**를 신설하고, 그 위에 집계 API·대시보드 위젯·AI 관리 사용량 페이지를 얹는다. 기존 `bot_activity_log` `cost` 이벤트는 **그대로 유지**(11.17 리포트 호환)하되, 세밀 관측의 source of truth는 이 ledger로 둔다.

---

## Acceptance Criteria

1. **AI 사용 로그 테이블 신설**: `ai_usage_log`(AI 사용 로그) 테이블을 마이그레이션으로 추가한다. 컬럼:
   - `id`(uuid, PK)
   - `feature`(text) — AI 사용 기능 구분: `'seeding-bot'`(시딩 봇) 등. 향후 비봇 기능도 같은 표에 기록할 수 있게 generic하게 둔다.
   - `provider`(text) — `'openai'|'anthropic'|'google'` 등 모델 제공자
   - `model`(text) — 실제 모델명(예: `gpt-4o-mini`, `claude-haiku-4-5`)
   - `purpose`(text) — 호출 용도: `'generation'`(글 생성)·`'censor'`(검열)·`'image'`(이미지)·`'search_summary'`(검색 요약)·`'translation'`(번역) 등
   - `persona_id`(uuid, **nullable**) — 봇 페르소나 연계(있을 때만)
   - `job_id`(uuid, **nullable**) — `bot_generation_jobs` 연계(있을 때만)
   - `input_tokens`(integer, 기본 0)·`output_tokens`(integer, 기본 0)
   - `cost_usd`(numeric(10,6), 기본 0) — 이 호출 비용(달러)
   - `created_at`(timestamptz, 기본 now())
   - 인덱스: `created_at`, `(provider, model)`, `purpose`, `feature`. (집계 쿼리 대비)
   - 마이그레이션 번호는 **착수 시점의 다음 가용 번호**를 사용한다(현재 최신은 0028, Epic 11 선행 스토리들이 마이그를 추가하면 그 뒤 번호). 하드코딩 금지.

2. **호출 단위 기록 헬퍼**: server-only AI 경계(11.6)에 `recordAiUsage(entry)` 헬퍼를 추가하고, `callModel()`이 **매 호출 성공 후** 이를 호출해 `ai_usage_log`에 1행 INSERT한다. 이미지 생성(11.8)·검색 요약(11.7 `summarizeFacts`)·번역(11.9) 호출도 동일하게 기록한다. **기록 실패가 본 기능(글 생성 등)을 막지 않는다**(try/catch, best-effort — 로그만 남김). 기존 `bot_activity_log` `cost` 이벤트 기록은 제거하지 않는다(11.17 호환).

3. **집계 API**: `GET /api/v1/admin/ai-usage?range=today|7d|30d|month`(`requireSuperAdmin`)가 다음을 반환한다:
   - `totals`: 기간 총 `costUsd`·`inputTokens`·`outputTokens`·`callCount`
   - `byProvider[]`·`byModel[]`·`byPurpose[]`·`byFeature[]`: 각 그룹별 `costUsd`·`callCount`·`tokens`
   - `daily[]`: 일별 `{ date, costUsd, callCount }` 시계열(차트용)
   - `todayVsLimit`: `{ todayCostUsd, dailyLimitUsd }` — `bot_settings.bot_daily_cost_limit_usd`(일일 비용 상한) 대비 오늘 누적
   - KST 날짜 경계로 집계한다(11.17 `getKstDayBounds` 재사용).

4. **메인 대시보드 위젯**: 관리자 메인 대시보드(`apps/admin/app/dashboard/page.tsx`)에 **AI 비용 요약 카드**를 추가한다 — 오늘 누적 비용·이번 달 누적 비용·일일 상한 대비 진행바 + 7일 미니 추이(`createLineChart` 재사용, Recharts 금지). 데이터는 `GET /admin/ai-usage?range=7d`·`?range=month`. API 404/오류 시 "집계 대기 중" 플레이스홀더.

5. **AI 관리 사용량 페이지**: `apps/admin/app/bots/ai-usage/page.tsx` 신규(`"use client"`). 기간 토글(오늘/7일/30일/이번 달) + 다음 표시:
   - 상단 요약 4종(총 비용·총 호출 수·총 토큰·일일 상한 대비)
   - **모델별/제공자별/용도별 비용·호출·토큰 표** 3종(디자인 시스템 `data-table`, 비용 내림차순)
   - 일별 비용 추이 차트(`createLineChart`)
   - 비용 상한 게이지(오늘 누적 vs `bot_daily_cost_limit_usd`)

6. **내비게이션**: `AdminShell`(관리자 공통 레이아웃)의 "활동 봇"(Seeding Bot) nav 그룹 children에 `{ href: "/bots/ai-usage", label: "AI 사용량" }` 항목을 추가한다(11.16에서 만든 그룹에 append; 그룹 없으면 생성).

---

## Tasks / Subtasks

### Task 1: `ai_usage_log` 스키마 + 마이그레이션 (AC: #1)

- [x] 1.1 `packages/database/src/schema/bot.ts`에 `aiUsageLog` 테이블 정의 추가 — 완료(메인 선처리).
- [x] 1.2 배럴(`packages/database/src/schema/index.ts`)에 `aiUsageLog` export 확인 — `export * from "./bot"` 포함.
- [x] 1.3 마이그레이션(0030) 적용 완료 — 메인 선처리.
- [x] 1.4 `pnpm db:migrate` 적용 완료 — 메인 선처리.

### Task 2: `recordAiUsage` 헬퍼 + `callModel` 훅 (AC: #2)

- [x] 2.1 `packages/server-bot/src/ai/index.ts`에 `AiUsageEntry` 인터페이스 + `recordAiUsage()` 추가. try/catch 내부, throw 금지.
- [x] 2.2 `callModel()` opts에 `usageContext?: { feature?; purpose? }` 추가 + 응답 직후 `recordAiUsage` 호출(fire-and-forget).
- [x] 2.3 검색요약·번역 등은 `callModel`을 경유하면 자동 기록됨(usageContext.purpose 주입 대기). 이미지 경로(11.8)는 직접 호출 시 purpose='image' 주입 필요 — 11.8 담당.
- [x] 2.4 기존 `bot_activity_log` cost 이벤트 제거 안 함(11.17 호환 유지).

### Task 3: 집계 서비스 + GET 엔드포인트 (AC: #3)

- [x] 3.1 `apps/api/src/routes/admin/bots/ai-usage.ts` 신규 — `registerAiUsageRoutes(app)` export.
- [x] 3.2 `buildAiUsageReport(range, db?)` 구현 — KST 경계 계산, in-memory 집계(totals·byProvider·byModel·byPurpose·byFeature·daily·todayVsLimit).
- [x] 3.3 `GET /admin/ai-usage` 라우트 — `requireSuperAdmin`, range Zod 검증(기본 7d).
- [ ] 3.4 라우트 등록 — `apps/api/src/routes/admin/bots/index.ts`에 `await registerAiUsageRoutes(app)` 추가 필요(메인 담당).
- [x] 3.5 `aiUsageReportSchema` + `AiUsageReport` type — `packages/contracts/src/bot.ts` 추가 완료.

### Task 4: 메인 대시보드 AI 비용 위젯 (AC: #4)

- [x] 4.1 `apps/admin/app/dashboard/_components/AiCostWidget.tsx` 신규 — "use client", 7d/month fetch, 오늘·월 비용 카드·진행바·미니 차트·오류 시 플레이스홀더.
- [x] 4.2 `apps/admin/app/dashboard/page.tsx`에 `<AiCostWidget />` 삽입 — 기존 dashboard-grid 아래 별도 섹션.

### Task 5: AI 관리 사용량 페이지 (AC: #5)

- [x] 5.1 `apps/admin/app/bots/ai-usage/page.tsx` 신규 ("use client").
- [x] 5.2 기간 토글(.line-tabs, 오늘/7일/30일/이번달) — range 변경 시 API 재호출.
- [x] 5.3 상단 요약 카드 4종(총 비용·총 호출·총 토큰·일일상한).
- [x] 5.4 집계 표 3종(제공자별·모델별·용도별, 비용 내림차순, JS 데이터 정렬).
- [x] 5.5 일별 추이 차트(createLineChart) + 비용 상한 게이지.
- [x] 5.6 next/headers import 없음, 토스트 미사용(조용한 오류 처리).

### Task 6: 내비게이션 (AC: #6)

- [ ] 6.1 `AdminShell.tsx` nav에 AI 사용량 항목 추가 — 메인 담당(파일 소유권 제한).

### Task 7: 타입체크·검증

- [x] 7.1 `pnpm --filter @ai-jakdang/database typecheck` — 통과(메인 선처리).
- [x] 7.2 `pnpm --filter @ai-jakdang/api typecheck` — 통과.
- [x] 7.3 `pnpm --filter @ai-jakdang/admin typecheck` + `build` — 통과. `/bots/ai-usage` 정적 페이지 생성 확인.
- [x] 7.4 `recordAiUsage` — try/catch 내부, throw 안 함(코드 검증).
- [x] 7.5 `buildAiUsageReport` 단위 테스트 8건 통과 (totals·byProvider·byModel·byPurpose·daily·todayVsLimit·range).
- [ ] 7.6 브라우저 검수 — 메인 담당(실로그인 검증).

---

## Dev Notes

### 선행 의존성

| 스토리 | 제공 인터페이스 | 미완성 시 |
|---|---|---|
| **11.1** | `packages/database/src/schema/bot.ts` 파일 + 배럴. 본 스토리가 `aiUsageLog` 테이블 추가 | 파일 없으면 이 스토리가 생성하되 봇 테이블 본체는 11.1 소유 |
| **11.2** | `packages/contracts/src/bot.ts` — `aiUsageReportSchema` 추가 대상 | 로컬 임시 타입 + TODO |
| **11.6** | `callModel` + server-only AI 경계 — `recordAiUsage` 추가 위치, `callModel` 훅 | 본 스토리의 Task 2는 11.6 산출물에 의존. 11.6 완료 후 착수 |
| **11.7/11.8/11.9** | 검색 요약·이미지·번역 호출 경로(여기에도 usage 기록) | 해당 경로 미구현이면 callModel 호출분만 우선 기록, 나머지는 각 스토리 완료 시 연결 |
| **11.12/11.16** | `getBotSetting`/`getAllBotSettings` — `bot_daily_cost_limit_usd` 읽기 | 신규 조회 함수 만들지 말고 재사용 |
| **11.14** | `apps/api/src/routes/admin/bots/index.ts` — 라우트 등록 지점 | 11.16과 동일하게 graceful 처리 |
| **11.16** | `BotCostChart.tsx` 골격 + AdminShell "활동 봇" nav 그룹 | 위젯·페이지 차트는 이 골격 재사용, nav는 append |

### 응답 구조 (`aiUsageReportSchema`)

```ts
// packages/contracts/src/bot.ts 에 추가
const usageGroupSchema = z.object({
  key: z.string(),              // provider/model/purpose/feature 값
  costUsd: z.number(),
  callCount: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
});

export const aiUsageReportSchema = z.object({
  range: z.enum(['today', '7d', '30d', 'month']),
  totals: z.object({
    costUsd: z.number(),
    callCount: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
  }),
  byProvider: z.array(usageGroupSchema),
  byModel: z.array(usageGroupSchema),
  byPurpose: z.array(usageGroupSchema),
  byFeature: z.array(usageGroupSchema),
  daily: z.array(z.object({
    date: z.string(),           // "YYYY-MM-DD" (KST)
    costUsd: z.number(),
    callCount: z.number(),
  })),
  todayVsLimit: z.object({
    todayCostUsd: z.number(),
    dailyLimitUsd: z.number(),  // bot_settings.bot_daily_cost_limit_usd
  }),
});
export type AiUsageReport = z.infer<typeof aiUsageReportSchema>;
```

### 기존 비용 추적과의 관계 (중복 아님 — 역할 분리)

| 기록처 | 단위 | 용도 | 이 스토리 |
|---|---|---|---|
| `bot_generation_jobs.cost`(jsonb) | 글 1건(잡) | 잡별 비용 스냅샷 | 유지 |
| `bot_activity_log`(event_type='cost') | 잡 이벤트 | 일일 리포트(11.17) 합계 | **유지**(제거 금지) |
| `ai_usage_log` (신규) | **AI 호출 1건** | 모델·제공자·용도·토큰 세밀 관측 | **신설** |

11.17 일일 리포트의 `totalCostUsd`는 계속 `bot_activity_log`로 집계해도 되고, 원하면 `ai_usage_log` SUM으로 교체 가능(값 일치 확인 후). 본 스토리는 11.17을 **수정하지 않는다**(독립).

### 비용 계산 단가 출처

`cost_usd`는 본 스토리가 새로 계산하지 않는다 — `callModel`(11.6)·`genImage`(11.8)·검색 어댑터(11.7)가 이미 산출해 반환하는 `costUsd`를 그대로 기록한다. 단가 테이블·토큰 환산은 11.6 소유. 본 스토리는 **수집·집계·표시**만 담당.

### `createLineChart` / RSC / 이중 prefix (기존 메모리 규칙 준수)

- 차트는 `@ai-jakdang/admin-design-system/js/chart.js`의 `createLineChart`만 사용(Recharts 금지) — 11.16 `BotCostChart.tsx` 골격 그대로 재사용.
- 위젯·페이지 모두 `"use client"`, `next/headers` import 금지(메모리: admin-rsc-boundary-build-traps).
- admin fetch는 `${API_BASE_URL}/api/v1/admin/ai-usage` 형식 — 핸들러 등록은 `/admin/ai-usage`(prefix 없이). 이중 prefix(`/api/v1/api/v1/...`) 404 주의(메모리: revision-batch-125-134).
- 모든 봇/AI admin 라우트는 `requireSuperAdmin`(슈퍼 관리자 전용) preHandler 필수.

### 토큰·비용 nullable 처리

이미지 호출은 토큰 개념이 없을 수 있다 → `input_tokens`/`output_tokens` 기본 0. 검색 어댑터 자체 호출(요약 전 단계)은 `provider='google'|'naver'`, `purpose='search'`로 별도 기록할지 여부는 선택(검색 API 비용은 11.7 상수 추정치) — 기본은 **AI 모델 호출만** 기록하고 검색 API 호출 비용은 11.7의 `onCostAccumulated` 경로 유지. 과도한 세분화는 피한다.

### Project Structure Notes

| 파일 | 변경 |
|---|---|
| `packages/database/src/schema/bot.ts` | **수정** — `aiUsageLog` 테이블 추가 |
| `packages/database/migrations/00NN_*.sql` | **신규** — 다음 가용 번호 |
| `packages/contracts/src/bot.ts` | **수정** — `aiUsageReportSchema` 추가 |
| server-only AI 경계(11.6) | **수정** — `recordAiUsage` + `callModel` 훅 |
| `apps/api/src/routes/admin/bots/ai-usage.ts` | **신규** — 집계 GET |
| `apps/api/src/routes/admin/bots/index.ts` | **수정** — 라우트 등록 |
| `apps/admin/app/dashboard/_components/AiCostWidget.tsx` | **신규** — 대시보드 위젯 |
| `apps/admin/app/dashboard/page.tsx` | **수정** — 위젯 삽입 |
| `apps/admin/app/bots/ai-usage/page.tsx` | **신규** — AI 사용량 페이지 |
| `apps/admin/components/layout/AdminShell.tsx` | **수정** — nav 항목 추가 |

### References

- [Source: _bmad-output/implementation-artifacts/11-16-operations-panel.md] — `BotCostChart`(createLineChart) 골격, `bot_settings` 키, requireSuperAdmin·RSC·토스트 패턴
- [Source: _bmad-output/implementation-artifacts/11-17-daily-report-api-hold-queue-actions.md] — `getKstDayBounds` KST 경계, 비용 집계 원천, 기존 cost 이벤트
- [Source: _bmad-output/implementation-artifacts/11-6-ai-abstraction-layer.md] — `callModel` 시그니처·`usage`·`costUsd` 반환, 단가 테이블 소유
- [Source: _bmad-output/implementation-artifacts/11-12-kill-switch-rate-cost-guards.md] — `getBotSetting`·일일 비용 상한 게이트
- [Source: docs/seeding-bot/ARCHITECTURE.md §2.9~2.10] — bot_activity_log·bot_settings
- [Source: apps/admin/components/stats/VisitorTrendChart.tsx] — createLineChart 사용 패턴
- [Source: apps/admin/app/dashboard/page.tsx] — KPI 카드 그리드(위젯 삽입 위치)
- [Source: .claude/memory/admin-rsc-boundary-build-traps.md] [Source: .claude/memory/revision-batch-125-134-admin-auth-and-analytics.md] [Source: .claude/memory/toast-notifications-center.md] [Source: .claude/memory/legacy-designsystem-js-vs-react-dom-conflict.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (2026-06-30)

### Debug Log References

- 초기 Mock DB 설계 오류: `where().limit()` 체인이 Promise에서 undefined — thenable 패턴으로 재설계(ai-usage.test.ts)
- `todayKstStr` 미사용 선언 → 제거; `selectWhere` 미사용 선언 → 제거 (typecheck)
- Dashboard page: 잘못된 빈 grid 섹션 삽입 → 재수정

### Completion Notes List

- `registerAiUsageRoutes` export만, `bots/index.ts` 배선은 메인 담당
- `AdminShell.tsx` nav 항목 추가 미수행 — 메인 담당 (파일 소유 제한)
- `callModel` `usageContext.purpose` 주입: 호출자가 opts.usageContext를 전달해야 함(현재 미주입 시 기본 'generation' 사용)
- 이미지 경로(11.8 genImage) recordAiUsage 직접 통합은 11.8 담당

### File List

- `packages/server-bot/src/ai/index.ts` — `AiUsageEntry` 인터페이스, `recordAiUsage()`, `callModel` opts.usageContext 확장
- `packages/contracts/src/bot.ts` — `usageGroupSchema`, `aiUsageReportSchema`, `AiUsageReport` type 추가
- `apps/api/src/routes/admin/bots/ai-usage.ts` — 신규: `buildAiUsageReport`, `registerAiUsageRoutes`
- `apps/api/src/routes/admin/bots/ai-usage.test.ts` — 신규: 8개 단위 테스트
- `apps/admin/app/dashboard/_components/AiCostWidget.tsx` — 신규: 대시보드 AI 비용 위젯
- `apps/admin/app/dashboard/page.tsx` — `AiCostWidget` import + 삽입
- `apps/admin/app/bots/ai-usage/page.tsx` — 신규: AI 사용량 페이지

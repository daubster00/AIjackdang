# Story 11.16: 운영 패널 (킬스위치·속도·비용·보류큐 요약)

Status: done

## Story

As a 슈퍼관리자(`super_admin`),
I want 봇 킬스위치·관찰 모드·속도 안전선·비용 상한 설정과 오늘 활동 요약·보류 큐를 한 화면에서 제어,
so that 봇 이상 시 즉시 멈추고 일일 운영 현황을 빠르게 파악할 수 있다.

## Acceptance Criteria

1. `GET /api/v1/admin/bots/settings`가 `bot_settings`(봇 전역 설정) 테이블 전체를 flat 객체로 반환한다 (`requireSuperAdmin` 적용).
2. `PATCH /api/v1/admin/bots/settings`가 전달된 키만 `bot_settings`에 UPSERT하고, 수정 키의 Redis 캐시를 무효화한다 (`requireSuperAdmin` 적용).
3. `GET /api/v1/admin/bots/hold-queue?decided=false`가 결정 대기 보류 항목 목록을 반환한다 — 내용 미리보기(첫 150자)·봇 닉네임 포함 (`requireSuperAdmin` 적용).
4. `/bots/operations` 페이지가 운영 패널 UI를 렌더한다 — `AdminShell`로 감싸고, 세션 없으면 AdminShell의 기존 authGuard가 `/login`으로 redirect.
5. **킬 스위치 카드**: `bot_master_enabled`(킬 스위치 — 봇 전체 가동 ON/OFF) 토글 → 변경 즉시 `PATCH /api/v1/admin/bots/settings` 저장 + 화면 중앙 토스트.
6. **관찰 모드 카드**: `bot_observation_mode`(관찰 모드 — 전량 보류 후 운영자 검토) 토글 → 변경 즉시 저장.
7. **속도 안전선 카드**: `bot_daily_post_limit`(하루 최대 글 수) · `bot_daily_comment_limit`(하루 최대 댓글 수) 숫자 입력 + 저장 버튼.
8. **비용 상한 카드**: `bot_daily_cost_limit_usd`(일일 비용 상한, 달러) 숫자 입력 + 저장 버튼; 오늘 누적 비용은 일일 리포트 API 응답에서 가져와 표시.
9. **비용 추이 차트**: `createLineChart`(디자인 시스템 꺾은선 차트 함수) 재사용(Recharts 금지) — 7일 일별 비용(달러) 차트. 데이터는 `GET /api/v1/admin/bots/report?range=7d`(11.17 구현 예정) 호출. 11.17 미완성(404) 시 플레이스홀더 유지.
10. **일일 리포트 요약 카드**: 오늘 날짜로 `GET /api/v1/admin/bots/report?date=YYYY-MM-DD`(11.17 구현 예정) 호출 → 글 N·댓글 M·보류 건수·차단 건수·누적 비용 표시. API 미응답 시 "집계 대기 중" 표시.
11. **보류 큐 테이블**: `GET /api/v1/admin/bots/hold-queue?decided=false` 호출 → 사유(`reason`)·내용 미리보기·봇 닉네임·보류 시각 표시. "통과" 버튼 → `confirmDialog` 확인 → `POST /api/v1/admin/bots/hold-queue/:id/approve`(11.17 구현 예정) 호출 후 목록 재조회. "폐기" 버튼 → `confirmDialog({tone:'danger'})` → `POST .../discard`(11.17 구현 예정).
12. `AdminShell`(관리자 공통 레이아웃) nav에 "활동 봇" 그룹 아래 `href="/bots/operations"` "운영 패널" 항목이 존재한다 (11.14에서 추가 예정; 누락 시 이 스토리에서 추가).

## Tasks / Subtasks

- [x] **Task 1: `apps/api/src/lib/botSettings.ts` 신규 생성 (AC: #1, #2)**
  - [x] 1.1~1.5 — 11.12에서 이미 완전 구현됨(`getAllBotSettings`, `setBotSetting`, `invalidateBotSetting`). 중복 구현 없이 재사용.

- [x] **Task 2: `apps/api/src/routes/admin/bots/settings.ts` 신규 생성 (AC: #1, #2)**
  - [x] 2.1 `registerAdminBotSettingsRoutes(app)` export
  - [x] 2.2 `GET /admin/bots/settings` — requireSuperAdmin → `getAllBotSettings()` 반환
  - [x] 2.3 `PATCH /admin/bots/settings` — requireSuperAdmin → `botSettingsPatchSchema`(contracts) Zod 검증 → `setBotSetting(key, value)` (invalidate 내포) → `200 { ok: true, updated: [] }`
  - [x] 2.4 contracts에 `botSettingsPatchSchema` 이미 존재(11.2 완료) — 로컬 정의 불필요

- [x] **Task 3: `apps/api/src/routes/admin/bots/hold-queue.ts` (AC: #3)**
  - [x] 3.1~3.5 — 11.17에서 `hold-queue-actions.ts`에 이미 완전 구현됨(GET + PATCH approve + PATCH discard). 신규 파일 불필요, 기존 파일 소비.

- [x] **Task 4: `apps/api/src/routes/admin/bots/index.ts` 수정 (AC: #1, #2, #3)**
  - [x] 4.1 `registerAdminBotSettingsRoutes(app)` import 및 호출 추가. hold-queue·report는 이미 등록됨.
  - [x] 4.2 admin/index.ts는 이미 `registerAdminBotsRoutes` 등록 완료 — 추가 수정 불필요.

- [x] **Task 5: `apps/admin/app/bots/operations/page.tsx` 신규 생성 (AC: #4~#11)**
  - [x] 5.1 `"use client"` 선언
  - [x] 5.2 `getAllBotSettings` 호출 → 8종 설정값 상태 초기화
  - [x] 5.3 킬 스위치 카드 (`bot_master_enabled` 토글 → 즉시 PATCH + 토스트)
  - [x] 5.4 관찰 모드 카드 (`bot_observation_mode` 토글 → 즉시 PATCH)
  - [x] 5.5 속도 안전선 카드 (post/comment limit 입력 + 저장 버튼)
  - [x] 5.6 비용 상한 카드 (cost limit 입력 + 저장 + 오늘 누적 비용 표시)
  - [x] 5.7 일일 리포트 요약 카드 (오늘 날짜 report API → "집계 대기 중" fallback)
  - [x] 5.8 보류 큐 테이블 (confirmDialog → PATCH approve/discard → refetch)
  - [x] 5.9 BotCostChart 컴포넌트 삽입
  - [x] 5.10 Toast 중앙 고정 (position:fixed; top:50%; left:50%; transform:translate(-50%,-50%))

- [x] **Task 6: `apps/admin/app/bots/operations/BotCostChart.tsx` 신규 생성 (AC: #9)**
  - [x] 6.1~6.6 — createLineChart 재사용, ?range=7d 404 graceful fallback, destroy cleanup

- [x] **Task 7: `apps/admin/components/layout/AdminShell.tsx` 수정 (AC: #12)**
  - [x] 7.2 "활동 봇" 항목에 children 추가: 봇 목록(subKey:"") + 운영 패널(subKey:"operations")

- [x] **Task 8: TypeScript 타입 검사 (AC: 전체)**
  - [x] `pnpm --filter @ai-jakdang/api tsc --noEmit` 통과 (0 오류)
  - [x] `pnpm --filter @ai-jakdang/admin tsc --noEmit` 통과 (0 오류)
  - [x] `pnpm --filter @ai-jakdang/admin build` 통과 — /bots/operations 정적 라우트 생성 확인

## Dev Notes

### 의존 스토리 착수 전 확인 사항

| 스토리 | 확인 대상 | 미완성 시 대응 |
|---|---|---|
| **11.1** | `packages/database/src/schema/bot.ts` → `botSettings`·`botHoldQueue`·`botGenerationJobs`·`botPersonas` 테이블 정의 | 이 스토리 착수 불가 — 11.1 먼저 |
| **11.2** | `packages/contracts/src/bot.ts` → `botSettingsPatchSchema`(설정 PATCH 요청)·`botSettingsResponseSchema`(설정 응답)·`botHoldQueueItemSchema`(보류 큐 항목)·`paginatedBotHoldQueueSchema` | 로컬 임시 타입으로 대체 + TODO 주석 |
| **11.12** | `apps/api/src/services/bot/gates.ts` → `getBotSetting(key)` 함수 | 이 스토리의 `botSettings.ts`가 DB 직접 조회로 대체 가능 |
| **11.14** | `apps/api/src/routes/admin/bots/index.ts` + `apps/admin/app/bots/` 폴더 구조 + AdminShell nav "활동 봇" 그룹 | Task 4.2 + Task 7 에서 처리 |
| **11.17** | `GET /api/v1/admin/bots/report?date=`, `POST .../hold-queue/:id/approve`, `POST .../discard` | UI에서 graceful fallback(404/에러 → "대기 중" 표시) |

[Source: docs/seeding-bot/EPICS-AND-STORIES.md] [Source: _bmad-output/implementation-artifacts/11-12-kill-switch-rate-cost-guards.md]

---

### `createLineChart` 사용 패턴 (핵심)

```
위치: @ai-jakdang/admin-design-system/js/chart.js
참조 구현: apps/admin/components/stats/VisitorTrendChart.tsx
         apps/admin/components/dashboard/TrafficChart.tsx
         apps/admin/app/ads/[id]/page.tsx (광고 성과 차트)
```

BotCostChart.tsx 골격 (VisitorTrendChart.tsx 기반):

```typescript
"use client";
import { useEffect, useRef } from "react";
import { createLineChart } from "@ai-jakdang/admin-design-system/js/chart.js";
import { API_BASE_URL } from "@/lib/api";

type ChartInstance = ReturnType<typeof createLineChart>;

export function BotCostChart() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const css     = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary-600").trim() || "#2563eb";

    const placeholder = {
      labels: ["..."],
      series: [{ values: [0], color: primary, fill: "rgba(37,99,235,0.18)" }],
    };

    let chart: ChartInstance = createLineChart(canvasRef.current, placeholder);
    let destroyed = false;

    const loadData = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/admin/bots/report?range=7d`,
          { credentials: "include" },
        );
        if (!res.ok || destroyed) return;
        const data = await res.json();
        if (destroyed) return;
        chart.setData({
          labels: (data.days ?? []).map((d: { date: string }) => d.date.slice(5)), // MM-DD
          series: [{
            values: (data.days ?? []).map((d: { costUsd: number }) => d.costUsd ?? 0),
            color: primary,
            fill: "rgba(37,99,235,0.18)",
          }],
        });
      } catch { /* 조용히 무시 */ }
    };

    loadData();
    return () => { destroyed = true; chart.destroy(); };
  }, []);

  return (
    <article className="card">
      <div className="card-header">
        <h2 className="card-title">7일 비용 추이</h2>
      </div>
      <div className="card-body">
        <div className="chart-wrap">
          <canvas ref={canvasRef} aria-label="7일 봇 비용 추이 꺾은선 차트" />
        </div>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "var(--primary-600)" }} />
            일별 비용(달러)
          </span>
        </div>
      </div>
    </article>
  );
}
```

**Recharts 사용 절대 금지** — 메모리 규칙(메모리: Epic9 관리자 재검수 32건 일괄).
[Source: apps/admin/components/stats/VisitorTrendChart.tsx] [Source: apps/admin/app/ads/[id]/page.tsx]

---

### `bot_settings` 테이블 키 목록 (ARCHITECTURE §2.10)

| key | 한국어 뜻 | 타입 | 기본값 |
|---|---|---|---|
| `bot_master_enabled` | 킬 스위치(봇 전체 가동) | boolean | false |
| `bot_daily_post_limit` | 하루 최대 글 수 | number | 10 |
| `bot_daily_comment_limit` | 하루 최대 댓글 수 | number | 40 |
| `bot_daily_cost_limit_usd` | 일일 비용 상한(달러) | number | 5.0 |
| `bot_exclude_from_ranking` | 봇 랭킹 제외 | boolean | true |
| `bot_auto_refill_topics` | 주제 자동 보충 | boolean | true |
| `bot_observation_mode` | 관찰 모드(전량 보류) | boolean | true |
| `bot_push_channel` | 푸시 채널 | string | "telegram" |

운영 패널 UI 표시 범위: 처음 6종 + 관찰 모드. `bot_push_channel`(푸시 채널)은 11.18 범위. `bot_exclude_from_ranking`(랭킹 제외)은 운영 패널에서도 표시 권장(boolean 토글 추가).

[Source: docs/seeding-bot/ARCHITECTURE.md#2.10]

---

### `botSettings.ts` 구현 가이드 (siteSettings.ts 패턴 복제)

```typescript
// apps/api/src/lib/botSettings.ts
// 참조: apps/api/src/lib/siteSettings.ts (동일 패턴, 테이블만 bot_settings로 교체)

import { getDb } from "@ai-jakdang/database";
import { botSettings } from "@ai-jakdang/database/schema"; // Story 11.1 export
import { eq } from "drizzle-orm";
import { getApiRedis } from "./redis.js";

const CACHE_PREFIX = "bot_settings:";
const CACHE_TTL_SECONDS = 60;

// getAllBotSettings(): 전체 flat 객체
// upsertBotSetting(key, value): drizzle onConflictDoUpdate
// invalidateBotSetting(key): Redis del
```

`getBotSetting(key)` 단건 조회는 `apps/api/src/services/bot/gates.ts`(11.12 구현)에 이미 있음.
중복 구현 금지 — `botSettings.ts`에서 필요하면 `gates.ts`의 함수를 re-export.

[Source: apps/api/src/lib/siteSettings.ts] [Source: _bmad-output/implementation-artifacts/11-12-kill-switch-rate-cost-guards.md#Task1.2]

---

### 보류 큐 JOIN 쿼리 (Task 3)

```typescript
// 테이블: botHoldQueue, botGenerationJobs, botPersonas (packages/database/src/schema/bot.ts, 11.1)
const items = await db
  .select({
    id:              botHoldQueue.id,
    jobId:           botHoldQueue.jobId,
    reason:          botHoldQueue.reason,
    decided:         botHoldQueue.decided,
    createdAt:       botHoldQueue.createdAt,
    draftContent:    botGenerationJobs.draftContent, // jsonb (Tiptap JSON)
    personaNickname: botPersonas.nickname,
  })
  .from(botHoldQueue)
  .leftJoin(botGenerationJobs, eq(botHoldQueue.jobId, botGenerationJobs.id))
  .leftJoin(botPersonas, eq(botGenerationJobs.personaId, botPersonas.id))
  .where(eq(botHoldQueue.decided, decided ?? false))
  .orderBy(desc(botHoldQueue.createdAt))
  .limit(pageSize).offset((page - 1) * pageSize);
```

`draftContent`(Tiptap JSON 초안)에서 미리보기 텍스트 추출:
```typescript
function tiptapToPreview(json: unknown, maxLen = 150): string {
  const str = typeof json === "string" ? json : JSON.stringify(json);
  return str.replace(/"[^"]*":/g, "").replace(/[{}\[\],"]/g, " ").trim().slice(0, maxLen);
}
```
(정교한 Tiptap 파서보다 단순 JSON 텍스트 추출이 이 용도에 충분함)

---

### `requireSuperAdmin` 적용 패턴

```typescript
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
// 기존 참조: apps/api/src/routes/admin/admin-members/index.ts (line 27)
//            apps/api/src/routes/admin/settings/index.ts (line 14)

app.get("/admin/bots/settings", { preHandler: [requireSuperAdmin] }, async (req, reply) => { ... });
app.patch("/admin/bots/settings", { preHandler: [requireSuperAdmin] }, async (req, reply) => { ... });
app.get("/admin/bots/hold-queue", { preHandler: [requireSuperAdmin] }, async (req, reply) => { ... });
```

[Source: apps/api/src/routes/admin/admin-members/index.ts] [Source: apps/api/src/routes/admin/settings/index.ts]

---

### 이중 prefix 방지 (메모리 규칙)

라우트 등록 경로는 `/admin/bots/settings` (prefix 없이) — `apps/api/src/app.ts`가 `/api/v1` prefix를 붙여 최종 `/api/v1/admin/bots/settings`가 됨.

핸들러 내부나 admin 클라이언트에서 `/api/v1`을 직접 붙이면 `/api/v1/api/v1/...` 이중 prefix 404 발생.
admin 클라이언트 fetch는 반드시 `${API_BASE_URL}/api/v1/admin/bots/...` 형식 사용 (`API_BASE_URL` = 환경변수 기준).

[Source: .claude/memory/revision-batch-125-134-admin-auth-and-analytics.md]

---

### RSC 경계 주의

`apps/admin/app/bots/operations/page.tsx`는 반드시 `"use client"` 파일이어야 함:
- `createLineChart`, `useEffect`, `useRef`, `useState`, `fetch` 등 브라우저 API 사용
- `next/headers`(`cookies()` 등) import 금지 — 빌드 크래시 원인 (메모리: admin-rsc-boundary-build-traps)

[Source: .claude/memory/admin-rsc-boundary-build-traps.md]

---

### `confirmDialog` 사용 패턴

```typescript
import { confirmDialog } from "@/lib/dialog";
// [Source: apps/admin/lib/dialog.tsx]

// 통과(approve) 버튼
const ok = await confirmDialog({
  title: "보류 항목 통과",
  message: "이 항목을 게시하겠습니까?",
  confirmText: "통과",
  tone: "default",
});
if (!ok) return;
const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots/hold-queue/${id}/approve`, {
  method: "POST",
  credentials: "include",
});

// 폐기(discard) 버튼
const ok2 = await confirmDialog({
  title: "보류 항목 폐기",
  message: "이 항목을 영구 폐기하겠습니까? 복구할 수 없습니다.",
  confirmText: "폐기",
  tone: "danger",
});
```

`notifyDialog`(알림 전용 모달)도 저장 성공/실패 피드백에 사용 가능. `window.confirm`/`window.alert` 금지.

---

### 토스트 중앙 고정 패턴

```typescript
// apps/admin/app/settings/_components/SettingsTabPanels.tsx의 Toast 인라인 구현 참조
// 또는 page.tsx 내부에서 동일하게 구현:

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed",
      top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 99999,
      background: type === "success" ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
      // ...
    }}>
      {message}
    </div>
  );
}
```

토스트 위치는 **화면 정중앙** — 우측 하단 금지(메모리 규칙: toast-notifications-center).

[Source: apps/admin/app/settings/_components/SettingsTabPanels.tsx] [Source: .claude/memory/toast-notifications-center.md]

---

### Project Structure Notes

**신규 생성 파일:**
- `apps/api/src/lib/botSettings.ts` — `getAllBotSettings`·`upsertBotSetting`·`invalidateBotSetting`
- `apps/api/src/routes/admin/bots/settings.ts` — `GET/PATCH /admin/bots/settings`
- `apps/api/src/routes/admin/bots/hold-queue.ts` — `GET /admin/bots/hold-queue`
- `apps/admin/app/bots/operations/page.tsx` — 운영 패널 페이지
- `apps/admin/app/bots/operations/BotCostChart.tsx` — 비용 추이 차트 컴포넌트

**수정 예상 파일:**
- `apps/api/src/routes/admin/bots/index.ts` — settings·hold-queue route 등록 추가 (11.14 생성 예정)
- `apps/api/src/routes/admin/index.ts` — `registerAdminBotRoutes` 등록 (11.14 추가 예정; 누락 시 이 스토리에서 처리)
- `apps/admin/components/layout/AdminShell.tsx` — "운영 패널" nav 항목 추가 (11.14 추가 예정; 누락 시 처리)

**건드리지 말아야 할 파일:**
- `apps/api/src/services/bot/gates.ts` (11.12 소유 — `getBotSetting` 단건 함수 있음, 수정 금지)
- `apps/api/src/routes/admin/bots/report.ts` (11.17 소유 예정 — 이 스토리에서 생성 금지)
- 보류 큐 `approve`/`discard` POST 엔드포인트 (11.17 소유 예정)

---

### 검증 체크리스트

1. `GET /api/v1/admin/bots/settings` → 200, `bot_master_enabled` 등 키 응답 확인
2. `PATCH /api/v1/admin/bots/settings` Body `{ "bot_master_enabled": false }` → 200, Redis `del('bot_settings:bot_master_enabled')` 호출 확인
3. `/bots/operations` 페이지 로드 → 킬 스위치 현재 값 표시 + 토글 시 즉시 저장 토스트 확인
4. 보류 큐 항목이 없으면 "보류 항목 없음" 빈 상태 표시 확인
5. `pnpm --filter @ai-jakdang/admin build` 통과 — RSC 경계 트랩 없음 확인
6. `pnpm --filter @ai-jakdang/api tsc --noEmit` 통과

---

### References

- [Source: docs/seeding-bot/ARCHITECTURE.md#2.10] — `bot_settings` 테이블 키 목록 전체
- [Source: docs/seeding-bot/ARCHITECTURE.md#10] — 관리자 대시보드 탭 구조·`createLineChart` 재사용 규약
- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#그룹E] — Story 11.16 AC + 그룹 E 공통 규칙
- [Source: apps/admin/components/stats/VisitorTrendChart.tsx] — `createLineChart` 사용 패턴 기준
- [Source: apps/admin/components/dashboard/TrafficChart.tsx] — `createLineChart` 대체 참조
- [Source: apps/admin/app/ads/[id]/page.tsx] — `createLineChart` 복수 시리즈 적용 예
- [Source: apps/api/src/lib/siteSettings.ts] — `getAllSiteSettings`·`invalidateSiteSetting` 복제 기준
- [Source: apps/api/src/routes/admin/settings/index.ts] — `requireSuperAdmin` + `getAllSiteSettings` 패턴
- [Source: apps/api/src/routes/admin/admin-members/index.ts] — `requireSuperAdmin` import 경로
- [Source: apps/api/src/routes/admin/index.ts] — `adminRoutes()` 봇 route 등록 위치
- [Source: apps/admin/lib/dialog.tsx] — `confirmDialog`·`notifyDialog` API
- [Source: apps/admin/app/settings/_components/SettingsTabPanels.tsx] — Toast 중앙 고정 패턴
- [Source: _bmad-output/implementation-artifacts/11-12-kill-switch-rate-cost-guards.md] — `getBotSetting` 위치 및 역할 분리
- [Source: _bmad-output/implementation-artifacts/11-2-bot-zod-contracts.md#Task5] — `botSettingsPatchSchema`·`paginatedBotHoldQueueSchema` 위치

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

없음 — 사전 구현된 의존성(botSettings.ts, hold-queue-actions.ts, report.ts)이 완전하여 신규 구현만 추가.

### Completion Notes List

- Task 1: `botSettings.ts`는 11.12에서 이미 `getAllBotSettings`·`setBotSetting`·`invalidateBotSetting` 완전 구현됨 — 재사용.
- Task 3: `hold-queue-actions.ts`(11.17)가 GET + PATCH approve + PATCH discard 모두 구현됨 — 별도 파일 불필요.
- Task 4: `admin/index.ts`는 이미 `registerAdminBotsRoutes` 등록 완료. bots/index.ts에 settings 등록만 추가.
- AdminShell의 "활동 봇" 항목이 children 없는 단순 링크였음 → children 배열(봇 목록 + 운영 패널) 추가.
- 보류 큐 액션 엔드포인트가 PATCH(approve/discard)임을 확인 — 스토리 스펙의 POST와 다름. UI에서 `method: "PATCH"` 사용.
- build 확인: `/bots/operations` 정적(○) 라우트로 생성됨.

### File List

- `apps/api/src/routes/admin/bots/settings.ts` (신규 — `registerAdminBotSettingsRoutes`)
- `apps/api/src/routes/admin/bots/index.ts` (수정 — settings route 등록 추가)
- `apps/admin/app/bots/operations/page.tsx` (신규 — 운영 패널 페이지)
- `apps/admin/app/bots/operations/BotCostChart.tsx` (신규 — 비용 추이 차트)
- `apps/admin/components/layout/AdminShell.tsx` (수정 — 운영 패널 nav 항목 추가)

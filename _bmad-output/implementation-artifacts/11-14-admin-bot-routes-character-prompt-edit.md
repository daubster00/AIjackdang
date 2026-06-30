# Story 11.14: 관리자 봇 라우트·목록/상세 + 캐릭터·프롬프트 편집

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 슈퍼관리자,
I want 봇 목록과 상세 페이지에서 각 봇의 활동 현황을 보고 캐릭터 시트·사전 프롬프트를 편집하기,
So that 봇 생성 콘텐츠의 품질과 캐릭터 일관성을 운영 중에도 실시간으로 조정할 수 있다.

## Acceptance Criteria

1. **API 라우트 4종** 신규 생성 (`apps/api/src/routes/admin/bots/index.ts`):
   - `GET    /admin/bots` — 목록 (쿼리: `q`(닉네임 검색), `status`(`active|inactive|all`), `page`, `pageSize`)
   - `GET    /admin/bots/:id` — 상세 (캐릭터 시트 전체)
   - `PATCH  /admin/bots/:id` — 캐릭터 시트 partial 수정
   - `PATCH  /admin/bots/:id/toggle` — `is_active`(활성 여부) 토글
   - **전체에 `{ preHandler: [requireSuperAdmin] }` 적용**. `requireSuperAdmin` 미적용 라우트 없음.

2. `GET /admin/bots` 응답 형식: `{ items: AdminBotListItem[], meta: { page, pageSize, totalItems, totalPages } }`.
   - `AdminBotListItem`(봇 목록 항목) 필드: `id`, `nickname`(닉네임), `isActive`(활성 여부), `isAdminPersona`(관리자 페르소나 여부), `lastActiveAt`(최근 활동 시각, `bot_activity_log`(활동 로그) 테이블 해당 `persona_id`(페르소나 ID) 기준 `MAX(created_at)`), `postCount`(누적 게시글 수, `bot_activity_log` `event_type='post.published'` 집계), `commentCount`(누적 댓글 수, `event_type='comment.published'` 집계).
   - `status=active` 필터 시 `is_active=true` 조건, `inactive` 시 `is_active=false`, `all` 또는 미전달 시 전체.
   - 정렬: `is_active DESC, nickname ASC`.

3. `GET /admin/bots/:id` 응답: `bot_personas`(봇 페르소나) 레코드 전체 컬럼 + `lastActiveAt`, `postCount`, `commentCount`. `id`가 존재하지 않으면 `404 { error: { code: "NOT_FOUND", message } }`.

4. `PATCH /admin/bots/:id` — 캐릭터 시트 partial 업데이트:
   - 수정 가능 필드: `nickname`(닉네임), `hiddenIdentity`(숨은 정체성), `ageJob`(나이대·직업), `tone`(말투·입버릇), `personaPrompt`(사전 프롬프트), `infoRatio`(정보 비율, 0–100 정수), `intentionalFlaws`(의도적 약점·버릇).
   - `infoRatio`가 0~100 범위를 벗어나면 `400 VALIDATION_ERROR`.
   - 성공 시 업데이트된 `bot_personas` 레코드 전체 반환. 변경은 즉시 DB에 반영되어 **다음 생성 잡부터 반영** (캐시 없음).

5. `PATCH /admin/bots/:id/toggle` — `is_active` 값 반전. 응답: `{ id, isActive, updatedAt }`. NOT_FOUND 시 404.

6. **`apps/admin/app/bots/page.tsx`** 신규 생성 — 봇 목록 페이지:
   - `AdminShell`(`activeKey="bots"`, `breadcrumb={["관리자", "활동 봇"]}`) 사용.
   - `useSearchParams` 사용 → 반드시 `<Suspense>` 래핑 (Next.js 15 필수).
   - 테이블 컬럼: 닉네임 / 관리자봇 여부(뱃지) / 상태(활성·비활성 뱃지) / 최근 활동 시각 / 누적 글 수 / 누적 댓글 수 / 토글 버튼 / 상세보기 링크.
   - 상태(status) 필터는 **`Select` 컴포넌트(`@/components/ui/Select`)** 사용. `<select>` native 태그 사용 절대 금지.
   - 토글 버튼 클릭 시 `PATCH /api/v1/admin/bots/:id/toggle` 호출 → 성공·실패 토스트(화면 중앙). 목록 즉시 갱신.
   - 페이지네이션: `{ meta.totalPages > 1 }` 조건으로 표시, 기존 `members/page.tsx` 패턴 동일.
   - `fetch` 호출 시 `credentials: "include"` 필수.

7. **`apps/admin/app/bots/[id]/page.tsx`** 신규 생성 — 봇 상세·편집 페이지:
   - `AdminShell`(`activeKey="bots"`, `breadcrumb={["관리자", "활동 봇", nickname]}`) 사용.
   - 상단 요약 카드: 닉네임, 상태(활성·비활성 뱃지), 최근 활동 시각, 누적 글/댓글 수, 관리자봇 여부.
   - **캐릭터 시트 편집 폼** (인라인 편집, 모달 아님 — 리스트=상세페이지 규약):
     - `nickname`(닉네임): `<input type="text" className="control" />`
     - `hidden_identity`(숨은 정체성): `<textarea className="control" rows={3} />`
     - `age_job`(나이대·직업): `<input type="text" className="control" />`
     - `tone`(말투·입버릇): `<textarea className="control" rows={3} />`
     - `persona_prompt`(사전 프롬프트): `<textarea className="control" rows={10} />` — **핵심 편집 대상**, 큰 영역 확보
     - `info_ratio`(정보 비율 0~100): `<input type="number" min={0} max={100} className="control" />`
     - `intentional_flaws`(의도적 약점·버릇): `<textarea className="control" rows={3} />`
   - "저장" 버튼(`btn btn-primary`) 클릭 → `PATCH /api/v1/admin/bots/:id` 호출. 성공·실패 모두 화면 중앙 토스트 표시.
   - 초기 데이터: 마운트 시 `GET /api/v1/admin/bots/:id` 호출. 404이면 "존재하지 않는 봇입니다" 안내.

8. **`AdminShell.tsx`** (`apps/admin/components/layout/AdminShell.tsx`) 수정 — NAV_GROUPS에 "활동 봇" 추가:
   - `Engagement` 그룹(또는 `Business` 그룹 상단) `items`에 추가:
     ```ts
     { key: "bots", href: "/bots", icon: "ri-robot-line", label: "활동 봇" }
     ```
   - `SUPER_ADMIN_ONLY_KEYS` Set에 `"bots"` 포함 (스태프(staff) 미노출).

9. **`apps/api/src/routes/admin/index.ts`** 수정 — `registerAdminBotsRoutes` import 및 등록:
   ```ts
   import { registerAdminBotsRoutes } from "./bots/index.js";
   // adminRoutes 함수 내부:
   await registerAdminBotsRoutes(app);
   ```

10. `pnpm --filter @ai-jakdang/admin tsc --noEmit` 및 `pnpm --filter @ai-jakdang/api tsc --noEmit` 모두 통과.

## Tasks / Subtasks

- [ ] Task 1: API 서비스 레이어 구현 (AC: #2, #3, #4, #5)
  - [ ] `apps/api/src/routes/admin/bots/service.ts` 신규 생성
  - [ ] `listBots(query)` 구현: `bot_personas`(봇 페르소나 테이블)을 `LEFT JOIN bot_activity_log`로 집계 — `lastActiveAt`(`MAX(created_at)`), `postCount`(`COUNT(event_type='post.published')`), `commentCount`(`COUNT(event_type='comment.published')`). Drizzle `getDb()` + `eq`, `ilike`, `count`, `max`, `sql` 활용.
  - [ ] `getBot(id)` 구현: `bot_personas` 단건 조회 + 동일 집계 join. 미존재 시 `throw Object.assign(new Error("봇을 찾을 수 없습니다."), { code: "NOT_FOUND" })`.
  - [ ] `updateBot(id, data)` 구현: `db.update(botPersonas).set({...data, updatedAt: new Date()}).where(eq(id)).returning()`. 미존재 시 NOT_FOUND throw.
  - [ ] `toggleBot(id)` 구현: `getBot(id)` 후 `isActive` 반전, `returning()` 활용.
  - [ ] contracts 타입(`AdminBotListQuery`, `AdminBotListItem`, `AdminBotDetail`, `AdminBotUpdateInput` — 11.2에서 정의됨)을 `@ai-jakdang/contracts`에서 import. 타입 직접 정의 금지.

- [ ] Task 2: API 라우트 등록 (AC: #1, #9)
  - [ ] `apps/api/src/routes/admin/bots/index.ts` 신규 생성
  - [ ] `registerAdminBotsRoutes(app: FastifyInstance)` 함수 export
  - [ ] `GET /admin/bots` 구현: `adminBotListQuerySchema.safeParse(request.query)` → `listBots()` 호출
  - [ ] `GET /admin/bots/:id` 구현: `getBot(id)` 호출, NOT_FOUND → 404
  - [ ] `PATCH /admin/bots/:id/toggle` — 경로 충돌 방지: `:id` 앞에 등록 (ads 패턴 동일)
  - [ ] `PATCH /admin/bots/:id` 구현: `adminBotUpdateSchema.safeParse(request.body)` → `updateBot()` 호출
  - [ ] 모든 라우트에 `{ preHandler: [requireSuperAdmin] }` 적용 확인
  - [ ] `apps/api/src/routes/admin/index.ts`에 `registerAdminBotsRoutes` import·등록 추가

- [ ] Task 3: `/bots` 목록 페이지 구현 (AC: #6)
  - [ ] `apps/admin/app/bots/page.tsx` 신규 생성
  - [ ] `BotListContent` (내부 컴포넌트) + `AdminBotsPage` (Suspense 래핑) 분리
  - [ ] `useSearchParams`로 `status`, `q`, `page` 쿼리 파라미터 읽기
  - [ ] `fetchBots()`: `fetch(\`\${API_BASE_URL}/api/v1/admin/bots?...\`, { credentials: "include" })`
  - [ ] 상태 필터 — `Select` 컴포넌트 (options: 전체/활성/비활성). native `<select>` 금지
  - [ ] 테이블 행마다 토글 버튼: 클릭 → `PATCH /api/v1/admin/bots/:id/toggle` → 로컬 state 갱신 + 토스트
  - [ ] `<Link href={\`/bots/\${bot.id}\`}>상세보기</Link>` 링크 포함
  - [ ] 페이지네이션 (members 패턴 동일)

- [ ] Task 4: `/bots/[id]` 상세·편집 페이지 구현 (AC: #7)
  - [ ] `apps/admin/app/bots/[id]/page.tsx` 신규 생성
  - [ ] `useParams()`로 `id` 추출 → 마운트 시 `GET /api/v1/admin/bots/:id` fetch
  - [ ] 폼 state: 7개 편집 필드를 `useState` 관리 (`nickname`, `hiddenIdentity`, `ageJob`, `tone`, `personaPrompt`, `infoRatio`, `intentionalFlaws`)
  - [ ] 저장 버튼 → `PATCH /api/v1/admin/bots/:id` (body: 변경된 필드만 — 혹은 전체 포함) → 성공/실패 토스트(화면 중앙)
  - [ ] `persona_prompt`(사전 프롬프트) textarea는 충분한 높이(`rows={10}` 이상) 확보
  - [ ] 404 응답 시 "존재하지 않는 봇입니다." 안내 문구 표시
  - [ ] `<Link href="/bots">← 목록으로</Link>` 뒤로가기 링크

- [ ] Task 5: AdminShell 네비게이션 추가 (AC: #8)
  - [ ] `apps/admin/components/layout/AdminShell.tsx` 수정
  - [ ] `NAV_GROUPS` 내 `"Engagement"` 그룹 또는 `"Operation"` 그룹에 `{ key: "bots", href: "/bots", icon: "ri-robot-line", label: "활동 봇" }` 추가
  - [ ] `SUPER_ADMIN_ONLY_KEYS` Set에 `"bots"` 추가

- [ ] Task 6: TypeScript 타입 검사 통과 (AC: #10)
  - [ ] `pnpm --filter @ai-jakdang/api tsc --noEmit` 통과
  - [ ] `pnpm --filter @ai-jakdang/admin tsc --noEmit` 통과
  - [ ] `@ai-jakdang/contracts`에서 `AdminBotListQuery`, `AdminBotListItem`, `AdminBotDetail`, `AdminBotUpdateInput` 모두 정상 export 되어 있는지 확인. 없으면 11.2 담당자와 협의 또는 인라인 임시 타입 정의 후 주석 표기.

## Dev Notes

### 의존 스토리 (선행 완료 필수)

- **Story 11.1** (`apps/api/src/db/schema/` 또는 `packages/database/src/schema/bot.ts`): `bot_personas`(봇 페르소나), `bot_activity_log`(활동 로그) 테이블 존재 필수. 마이그레이션 적용 완료 상태여야 함.
- **Story 11.2** (`packages/contracts/src/bot.ts`): `adminBotListQuerySchema`, `AdminBotListItem`, `AdminBotDetail`, `AdminBotUpdateInput` Zod 스키마·타입 export 필수. 11.2 미완료 시 service.ts에 로컬 임시 타입 정의 후 TODO 주석 표기.

### 주요 아키텍처 규칙 (위반 시 review reject)

1. **DB 접근은 `apps/api`에서만.** admin 페이지가 DB를 직접 import하는 것 절대 금지.
2. **선택박스(Select)는 반드시 디자인시스템 커스텀 드롭다운.** `<select>` native 태그 금지. `@/components/ui/Select` 컴포넌트만 사용.
3. **`useSearchParams`는 반드시 `<Suspense>` 래핑.** 미적용 시 Next.js 15 빌드 깨짐 (Epic9 Codex 2차 메모리 기록).
4. **리스트=상세페이지 규약.** `/bots/[id]`는 별도 페이지로 구현. 상세를 모달로 구현 금지. 액션(저장) 폼만 모달 허용이지만, 이 스토리에서는 인라인 편집으로 충분.
5. **토스트는 화면 중앙.** `bottom: 24, right: 24` 고정 금지. 메모리 규칙 준수.
6. **requireSuperAdmin 전용.** 봇 라우트 전체에 `preHandler: [requireSuperAdmin]` 적용. 스태프(staff)는 접근 불가.
7. **PATCH 경로 충돌 방지.** `PATCH /admin/bots/:id/toggle`을 `PATCH /admin/bots/:id`보다 **먼저** 등록 (ads 패턴 참조: `D:\projects\AIjackdang\apps\api\src\routes\admin\ads\index.ts` 56~80번째 줄).

### API 구현 패턴 (기존 ads 라우트 기반)

```ts
// apps/api/src/routes/admin/bots/index.ts

import type { FastifyInstance } from "fastify";
import { requireSuperAdmin } from "../../../plugins/adminGuard.js";
// contracts에서 import (11.2 완료 후)
import { adminBotListQuerySchema, adminBotUpdateSchema } from "@ai-jakdang/contracts";
import { listBots, getBot, updateBot, toggleBot } from "./service.js";

export async function registerAdminBotsRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/bots
  app.get("/admin/bots", { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const parsed = adminBotListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() } });
    }
    try {
      return reply.send(await listBots(parsed.data));
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // PATCH /admin/bots/:id/toggle — 충돌 방지: /:id 앞에 등록
  app.patch("/admin/bots/:id/toggle", { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return reply.send(await toggleBot(id));
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (e.code === "NOT_FOUND") return reply.status(404).send({ error: { code: "NOT_FOUND", message: e.message } });
      request.log.error(err);
      return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
    }
  });

  // ... GET /:id, PATCH /:id 동일 패턴
}
```

### admin 페이지 구현 패턴 (기존 ads·members 기반)

```tsx
// apps/admin/app/bots/page.tsx

"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { Select } from "@/components/ui/Select";   // ← 반드시 이것만
import { API_BASE_URL } from "../../lib/api";

function BotsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // ...
}

export default function AdminBotsPage() {
  return (
    <Suspense>          {/* useSearchParams → Suspense 필수 */}
      <BotsContent />
    </Suspense>
  );
}
```

### 컬럼명 매핑 (DB snake_case → JS camelCase)

| DB 컬럼 | JS 프로퍼티 | 의미 |
|---|---|---|
| `is_active` | `isActive` | 활성 여부 |
| `is_admin_persona` | `isAdminPersona` | 관리자 캐릭터 여부 |
| `persona_prompt` | `personaPrompt` | 사전 프롬프트 |
| `hidden_identity` | `hiddenIdentity` | 숨은 정체성(내부 전용) |
| `age_job` | `ageJob` | 나이대·직업 |
| `info_ratio` | `infoRatio` | 정보형 vs 잡담형 비율(0~100) |
| `intentional_flaws` | `intentionalFlaws` | 의도적 약점·버릇 |

> ⚠️ `bot_personas`에는 `gen_model_id`/`censor_model_id` 컬럼이 **없다**(#5 정합, 2026-06-29). 봇별 모델 할당은 `bot_model_assignments`가 `persona_id`로 역참조하며, 편집 UI는 Story 11.15의 "모델 할당" 탭(`/bots/:id/model-assignments`, `(persona_id, purpose)` 단위)에서 처리한다. 본 스토리(11.14)의 캐릭터 시트 편집에는 모델 FK 필드가 포함되지 않는다.

### service.ts Drizzle 집계 패턴 예시

```ts
import { getDb } from "@ai-jakdang/database";
import { botPersonas, botActivityLog } from "@ai-jakdang/database/schema";
import { eq, max, count, sql } from "drizzle-orm";

export async function listBots(query: AdminBotListQuery) {
  const db = getDb();
  // bot_personas에 bot_activity_log LEFT JOIN 후 GROUP BY
  const rows = await db
    .select({
      id: botPersonas.id,
      nickname: botPersonas.nickname,
      isActive: botPersonas.isActive,
      isAdminPersona: botPersonas.isAdminPersona,
      lastActiveAt: max(botActivityLog.createdAt),
      postCount: count(
        sql`CASE WHEN ${botActivityLog.eventType} = 'post.published' THEN 1 END`,
      ),
      commentCount: count(
        sql`CASE WHEN ${botActivityLog.eventType} = 'comment.published' THEN 1 END`,
      ),
    })
    .from(botPersonas)
    .leftJoin(botActivityLog, eq(botPersonas.id, botActivityLog.personaId))
    // .where(...)  ← status·q 조건 추가
    .groupBy(botPersonas.id);
  // ...
}
```

### 신규 생성 파일 목록

| 파일 경로 | 용도 |
|---|---|
| `apps/api/src/routes/admin/bots/index.ts` | API 라우트 등록 |
| `apps/api/src/routes/admin/bots/service.ts` | DB 조회·수정 서비스 레이어 |
| `apps/admin/app/bots/page.tsx` | 봇 목록 페이지 |
| `apps/admin/app/bots/[id]/page.tsx` | 봇 상세·캐릭터 편집 페이지 |

### 수정 파일 목록

| 파일 경로 | 수정 내용 |
|---|---|
| `apps/api/src/routes/admin/index.ts` | `registerAdminBotsRoutes` import·등록 추가 |
| `apps/admin/components/layout/AdminShell.tsx` | "활동 봇" 메뉴 항목 + `SUPER_ADMIN_ONLY_KEYS` 추가 |

### Project Structure Notes

- **봇 스키마 위치**: Story 11.1에서 생성. `packages/database/src/schema/bot.ts` 또는 `apps/api/src/db/schema/seeding-bot.ts` 중 실제 위치를 착수 전 확인 (`glob **/*bot*.ts` 또는 `**/*seeding*`).
- **contracts 위치**: `packages/contracts/src/bot.ts`. 배럴은 `packages/contracts/src/index.ts`.
- **adminGuard 위치**: `apps/api/src/plugins/adminGuard.ts` — `requireSuperAdmin` import 경로 `"../../../plugins/adminGuard.js"` (ads 패턴 동일).
- **API_BASE_URL**: admin 앱의 `apps/admin/lib/api.ts`에서 import (existing pattern).
- **admin 앱 nav icon**: Remixicon(`ri-robot-line`) 사용 — admin-design-system이 Remixicon을 CDN으로 로드.
- **토스트 위치 규칙**: 기존 members/page.tsx의 Toast 컴포넌트는 `bottom: 24, right: 24` 하드코딩이지만, 프로젝트 메모리 규칙상 **화면 중앙** 위치 사용. `style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}` 또는 기존 프로젝트에 중앙 토스트 구현체가 있다면 그것 사용.

### References

- [Source: docs/seeding-bot/EPICS-AND-STORIES.md#Story 11.14] — AC 원문
- [Source: docs/seeding-bot/ARCHITECTURE.md#2.2 bot_personas] — 캐릭터 시트 컬럼 전체 정의
- [Source: docs/seeding-bot/ARCHITECTURE.md#2.9 bot_activity_log] — `event_type` 값(`post.published`, `comment.published`) 기반 집계
- [Source: docs/seeding-bot/ARCHITECTURE.md#10 관리자 대시보드] — `requireSuperAdmin` 전용, 리스트=상세페이지 규약, 차트=`createLineChart`(이 스토리에는 차트 없음)
- [Source: apps/api/src/routes/admin/ads/index.ts] — `requireSuperAdmin` 전 라우트 적용 패턴, `/toggle` 경로 충돌 방지(먼저 등록) 패턴
- [Source: apps/api/src/routes/admin/ads/service.ts] — `getDb()`, Drizzle 조건 빌딩, NOT_FOUND throw 패턴
- [Source: apps/api/src/routes/admin/index.ts] — `registerAdminBotsRoutes` 등록 위치
- [Source: apps/admin/app/members/page.tsx] — `AdminShell`, `Select`, `Suspense`, `fetch credentials:"include"`, 페이지네이션 패턴
- [Source: apps/admin/app/ads/[id]/page.tsx] — 상세 페이지 + 인라인 편집 패턴
- [Source: apps/admin/components/layout/AdminShell.tsx] — `NAV_GROUPS`, `SUPER_ADMIN_ONLY_KEYS` 수정 위치
- [Source: apps/api/src/routes/admin/admin-members/index.ts] — `requireSuperAdmin` + `ZodTypeProvider` 조합 예시
- [Source: packages/contracts/src/bot.ts (Story 11.2 산출물)] — `adminBotListQuerySchema`, `AdminBotUpdateInput` 등

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

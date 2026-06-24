---
baseline_commit: d264b7835d0b8c532a3b3e5ebde520cd8db22306
---

# Story 6.5: 랭킹 — 주간/월간 기여자 TOP · 페이지 + 위젯

Status: review

## Story

As a 회원·방문자,
I want 주간·월간 기여자 TOP를 위젯·랭킹 페이지에서 보기를,
so that 활발한 기여자가 자연스럽게 드러난다.

## Acceptance Criteria

1. BullMQ `ranking` 큐의 `ranking.compute` 잡을 소비하는 worker processor가 존재하며, 소비 시:
   - `rankingWindowDates(period, now)` (6.1 순수 함수)로 기간 경계 계산
   - 해당 기간 `points_ledger`에서 `user_id` 별 `SUM(delta)` 집계 (delta > 0만 포함)
   - `computeRanking(rows, 10)` (6.1 순수 함수)로 TOP 10 산출
   - 각 userId에 대해 `users.nickname`, 현재 `grade.level`, `grade.name` 조회 (N+1 방지: `inArray` 배치 쿼리)
   - Redis에 `ranking:weekly` / `ranking:monthly` 키로 TTL 1h 저장 (`rankingResponseSchema` 형태)
   - 동일 잡 재실행 시 동일 결과 (멱등)

2. 매일 자정(UTC 00:00) cron으로 `ranking.compute?period=weekly` + `ranking.compute?period=monthly` 잡이 enqueue된다. 초기 실행 시 1회 seed 실행.

3. `GET /api/v1/gamification/ranking?period=weekly|monthly&limit=N` 엔드포인트:
   - Redis에 캐시 있으면 바로 반환 (`rankingResponseSchema` 응답)
   - miss 시 DB 즉석 계산 후 Redis 저장 + 반환
   - `limit` 쿼리 파라미터 지원 (기본값 10, 최대 10)
   - `RankEntry`= `{ rank, userId, nickname, gradeLevel, gradeName, totalDelta }`

4. 메인 위젯 호출 시 `?period=weekly&limit=5` 로 TOP 5 subset 반환.

5. `/ranking` 페이지 (SSR):
   - 주간·월간 탭 TOP 10 테이블 (비회원 열람 가능)
   - `<table>` 마크업 사용: `<th>` 순위/닉네임/등급/기여 포인트, `<tbody>` 각 행
   - 숫자 컬럼 `tabular-nums` CSS
   - 각 순위 셀: 숫자(`aria-label="1위"`) + 텍스트
   - `aria-label="주간 기여자 랭킹"` 또는 `"월간 기여자 랭킹"` on `<table>`
   - `generateMetadata`: title/description/OG 고유값, noindex 미적용 (검색 색인 허용)

6. 어뷰징(일일 상한 초과·자기 좋아요) 포인트는 6.2에서 이미 미적립 → 랭킹에 미반영(업스트림 처리). 이 스토리에서 추가 방어 불필요.

## Tasks / Subtasks

- [x] Task 1: ranking.compute worker processor (AC: #1)
  - [x] `apps/worker/src/processors/rankingCompute.processor.ts` 신규 생성 (NEW)
  - [x] payload 타입: `{ period: 'weekly' | 'monthly' }` — `packages/contracts`에 `rankingComputeJobSchema` 추가
  - [x] `rankingWindowDates(period, new Date())` 호출로 `{ start, end }` 산출
  - [x] DB 쿼리: `SELECT user_id, SUM(delta) as total FROM points_ledger WHERE created_at >= $start AND created_at < $end AND delta > 0 GROUP BY user_id`
  - [x] `computeRanking(rows, 10)` 호출로 TOP 10 산출
  - [x] userId 배열로 users.nickname + 현재 grade 배치 조회 (단일 `inArray` 쿼리 2개)
  - [x] `RankEntry[]` 구성 후 `rankingResponseSchema` 형태로 Redis SET (`ranking:weekly` / `ranking:monthly`, EX 3600)
  - [x] `apps/worker/src/index.ts` UPDATE: ranking processor 등록
  - [x] 멱등 테스트: 동일 period로 2회 실행 시 결과 동일

- [x] Task 2: cron 스케줄 설정 (AC: #2)
  - [x] `apps/worker/src/schedules/ranking.cron.ts` 신규 생성 (NEW)
  - [x] BullMQ repeat job으로 매일 UTC 00:00 `ranking.compute` weekly+monthly enqueue
  - [x] 초기 1회 seed: worker 기동 시 Redis에 캐시가 없으면 즉시 enqueue
  - [x] `apps/worker/src/index.ts` UPDATE: cron 스케줄 등록

- [x] Task 3: ranking API 엔드포인트 (AC: #3, #4)
  - [x] `apps/api/src/routes/v1/gamification/gamification.routes.ts` UPDATE (6.3 파일에 추가)
  - [x] `GET /api/v1/gamification/ranking` 라우트: Query 파라미터, Redis hit/miss, Zod 검증
  - [x] limit 파라미터: Redis 저장은 항상 10개, 응답 시 slice 처리

- [x] Task 4: `/ranking` 페이지 신규 생성 (AC: #5)
  - [x] `apps/web/app/ranking/page.tsx` 신규 생성 (NEW)
  - [x] `apps/web/app/ranking/ranking.module.css` 신규 생성 (NEW)
  - [x] SSR 서버 컴포넌트: 주간·월간 병렬 패칭
  - [x] searchParams 기반 탭 전환 (URL 공유 가능, SEO 친화)
  - [x] `<table>` 마크업: aria-label, tabular-nums, EmptyState
  - [x] `generateMetadata`: noindex 없음, 검색 색인 허용
  - [x] 비회원 열람 가능 (인증 불필요)
  - [x] `RankBadge` 컴포넌트 재사용 (gradeLevel → RankTier 매핑)

- [x] Task 5: 메인 페이지 랭킹 위젯 (AC: #4)
  - [x] `apps/web/app/page.tsx` 확인 (lounge 섹션 앞에 ranking 섹션 배치)
  - [x] `apps/web/features/gamification/RankingWidget.tsx` 신규 생성 (NEW)
  - [x] `GET /api/v1/gamification/ranking?period=weekly|monthly&limit=5` 호출
  - [x] TOP 5 닉네임 + 등급 배지 + 기여 포인트 표시
  - [x] 주간/월간 탭 스위치 (클라이언트 상태)
  - [x] 로딩: `Skeleton` (레이아웃 일치)

- [x] Task 6: Redis 연결 확인 (AC: #1)
  - [x] `apps/api/src/lib/redis.ts` 신규 생성: `ioredis` 인스턴스 singleton
  - [x] ranking API 라우트에서 redis 인스턴스 주입

## Dev Notes

### Redis 키 설계

| 키 | 값 형태 | TTL |
|---|---|---|
| `ranking:weekly` | JSON (rankingResponseSchema) | 3600s (1h) |
| `ranking:monthly` | JSON (rankingResponseSchema) | 3600s (1h) |

### computeRanking 동점 처리

6.1 `computeRanking` 구현에서 동점 처리 방식:
- 동점이면 같은 rank 부여 (1, 1, 3 — dense rank 또는 standard rank 중 선택)
- 권장: standard rank (동점이면 같은 번호, 다음 번호는 건너뜀)
- 구현 예: `.sort((a,b) => b.total - a.total).map((row, i) => ({ ...row, rank: i + 1 }))`
  → 더 엄밀히는 동점 감지 후 rank 복사

### BullMQ cron 설정

BullMQ v5의 repeat 옵션:
```typescript
await rankingQueue.add('ranking.compute', { period: 'weekly' }, {
  repeat: { pattern: '0 0 * * *' }, // 매일 00:00 UTC
  jobId: 'ranking-weekly-cron',
})
```

### 랭킹 페이지 SSR vs CSR

- `/ranking` 페이지는 공개 + SEO 색인 허용 → SSR 서버 컴포넌트 우선
- 탭 전환(주간/월간): `searchParams.get('period')` 활용해 서버 렌더 (URL 공유 가능, SEO 친화)
- 또는 Tab 상태를 클라이언트로 두고 초기 데이터는 서버에서 수화 (선택)

### 접근성 (UX-DR-U13 준수)

- `<table>` 마크업 필수 (`<div>` 그리드 대체 금지)
- 순위 셀: 숫자와 텍스트 동반 (`aria-label="1위"`)
- RankBadge에 `aria-label="등급: 실전러"` 필수
- 색만으로 순위 표현 금지 (숫자 + 시각 구분)

### 현재 메인 페이지 구조

`apps/web/app/page.tsx`가 존재하나 내용 미확인. 착수 전 반드시 파일 완독:
- 기존 6섹션 구조 파악
- 랭킹 위젯이 어느 섹션 위치인지 확인
- 기존 UI 계약(레이아웃·버튼 배치) 변경 금지

### Project Structure Notes

- `apps/web/features/gamification/` 폴더 신규 생성 (현재 미존재)
- `apps/web/app/ranking/` 폴더 신규 생성 (현재 미존재)
- Worker cron 스케줄: `apps/worker/src/schedules/` 폴더 신규 생성
- API Redis 연결: `apps/api/src/lib/redis.ts` 또는 `src/plugins/redis.ts` — Fastify 플러그인으로 등록 권장

### References

- [Source: epics.md#Story-6.5 L1984~2019]
- [Source: architecture.md#캐싱 — Redis ranking/조회수 캐싱]
- [Source: architecture.md#Background-Jobs BullMQ 큐명 ranking]
- [Source: packages/core/src/ranking.ts — 6.1에서 구현된 rankingWindowDates/computeRanking]
- [Source: project-context.md#SEO — 공개 페이지 SSR + generateMetadata]
- [Source: apps/web/lib/ranks.ts — gradeLevel→RankTier 매핑]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- 타입 오류 수정: `nicknameMap` / `totalPointsMap` 을 `new Map<string, string>()` / `new Map<string, number>()` 으로 명시적 제네릭 지정
- API 테스트 캐시 hit 케이스: `rankingResponseSchema.safeParse` 파싱 실패 시 DB fallback으로 가는 구조 파악 → 테스트를 DB mock 포함 형태로 수정
- `rankingComputeProcessor`에서 `pg.Pool.query`와 `pg.Pool.connect` 혼재 방지 — `pool.query` 직접 사용 (connect 미사용)

### Completion Notes List
- AC#1: `rankingCompute.processor.ts` — `rankingWindowDates`·`computeRanking` 주입, pg Pool 배치 쿼리(users 1회 + totalPoints 1회 + grades 1회), Redis SET EX 3600, 멱등
- AC#2: `ranking.cron.ts` — BullMQ `{ repeat: { pattern: '0 0 * * *' } }` weekly+monthly, 기동 시 Redis EXISTS 체크 후 seed
- AC#3: `GET /api/v1/gamification/ranking` — `// ── [6.5] ...` 블록으로 6.4와 구분, Redis hit→반환/miss→DB 집계→저장→반환, limit slice
- AC#4: `RankingWidget.tsx` — 클라이언트 탭 전환, TOP5, Skeleton 로딩
- AC#5: `/ranking` 페이지 — SSR, searchParams 탭, aria-label, tabular-nums, generateMetadata(noindex 없음), EmptyState
- 게이트: `pnpm typecheck` 통과(오류 0), `pnpm --filter @ai-jakdang/api test` 165/165 통과, `pnpm --filter @ai-jakdang/worker test` 29/29 통과

### File List
packages/contracts/src/gamification.ts (수정 — rankingComputeJobSchema, RankingComputeJobPayload 추가)
packages/contracts/src/index.ts (수정 — 6.5 export 추가)
apps/worker/src/processors/rankingCompute.processor.ts (신규)
apps/worker/src/processors/rankingCompute.processor.test.ts (신규)
apps/worker/src/schedules/ranking.cron.ts (신규)
apps/worker/src/index.ts (수정 — ranking.compute case, cron 등록 추가)
apps/api/src/lib/redis.ts (신규)
apps/api/src/routes/v1/gamification/gamification.service.ts (수정 — getRanking 함수 추가)
apps/api/src/routes/v1/gamification/gamification.routes.ts (수정 — GET /ranking 엔드포인트 추가)
apps/api/src/routes/v1/gamification/ranking.service.test.ts (신규)
apps/web/app/ranking/page.tsx (신규)
apps/web/app/ranking/ranking.module.css (신규)
apps/web/features/gamification/RankingWidget.tsx (신규)
apps/web/features/gamification/RankingWidget.module.css (신규)
apps/web/app/page.tsx (수정 — RankingWidget 섹션 삽입)
apps/web/app/page.module.css (수정 — rankingBand/rankingInner/rankingWidgetWrap 스타일 추가)

## Change Log

| 날짜 | 변경 내용 |
|---|---|
| 2026-06-24 | Story 6.5 구현 완료 — ranking.compute worker processor, BullMQ cron, GET /api/v1/gamification/ranking, /ranking SSR 페이지, RankingWidget 메인 배치 |

## Status

review

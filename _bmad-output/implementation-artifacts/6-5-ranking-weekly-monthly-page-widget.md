# Story 6.5: 랭킹 — 주간/월간 기여자 TOP · 페이지 + 위젯

Status: ready-for-dev

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

- [ ] Task 1: ranking.compute worker processor (AC: #1)
  - [ ] `apps/worker/src/processors/rankingCompute.processor.ts` 신규 생성 (NEW)
  - [ ] payload 타입: `{ period: 'weekly' | 'monthly' }` — `packages/contracts`에 `rankingComputeJobSchema` 추가
  - [ ] `rankingWindowDates(period, new Date())` 호출로 `{ start, end }` 산출
  - [ ] DB 쿼리: `SELECT user_id, SUM(delta) as total FROM points_ledger WHERE created_at >= $start AND created_at < $end AND delta > 0 GROUP BY user_id`
  - [ ] `computeRanking(rows, 10)` 호출로 TOP 10 산출
  - [ ] userId 배열로 users.nickname + 현재 grade 배치 조회 (단일 `inArray` 쿼리 2개)
  - [ ] `RankEntry[]` 구성 후 `rankingResponseSchema` 형태로 Redis SET (`ranking:weekly` / `ranking:monthly`, EX 3600)
  - [ ] `apps/worker/src/index.ts` UPDATE: ranking processor 등록
  - [ ] 멱등 테스트: 동일 period로 2회 실행 시 결과 동일

- [ ] Task 2: cron 스케줄 설정 (AC: #2)
  - [ ] `apps/worker/src/schedules/ranking.cron.ts` 신규 생성 (NEW)
  - [ ] BullMQ `QueueScheduler` 또는 `cron` 패키지로 매일 UTC 00:00 `ranking.compute` weekly+monthly enqueue
  - [ ] 초기 1회 seed: worker 기동 시 Redis에 캐시가 없으면 즉시 enqueue
  - [ ] `apps/worker/src/index.ts` UPDATE: cron 스케줄 등록

- [ ] Task 3: ranking API 엔드포인트 (AC: #3, #4)
  - [ ] `apps/api/src/routes/v1/gamification/gamification.routes.ts` UPDATE (6.3 파일에 추가)
  - [ ] `GET /api/v1/gamification/ranking` 라우트:
    - Query 파라미터: `period`(`weekly`|`monthly`, 기본 `weekly`), `limit`(number 1~10, 기본 10)
    - Redis `ranking:{period}` 키 조회
    - 캐시 hit: 파싱 후 `limit` 적용해 반환
    - 캐시 miss: DB 즉석 계산 → Redis SET EX 3600 → 반환
    - `rankingResponseSchema` 응답 Zod 검증
  - [ ] limit 파라미터: Redis 저장은 항상 10개, 응답 시 slice 처리

- [ ] Task 4: `/ranking` 페이지 신규 생성 (AC: #5)
  - [ ] `apps/web/app/ranking/page.tsx` 신규 생성 (NEW)
  - [ ] `apps/web/app/ranking/ranking.module.css` 신규 생성 (NEW)
  - [ ] SSR 서버 컴포넌트: `fetch('/api/v1/gamification/ranking?period=weekly')` + `?period=monthly` 병렬 호출
  - [ ] 주간/월간 탭 컨트롤 (클라이언트 상태 또는 searchParams 기반)
  - [ ] `<table>` 마크업:
    ```html
    <table aria-label="주간 기여자 랭킹">
      <thead>
        <tr><th>순위</th><th>회원</th><th>등급</th><th>기여 포인트</th></tr>
      </thead>
      <tbody>
        <tr>
          <td aria-label="1위" class={styles.rank}>1</td>
          <td>{nickname}</td>
          <td><RankBadge rank={tier} showLabel /></td>
          <td class={styles.points}>{totalDelta.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
    ```
  - [ ] `tabular-nums` 폰트 피처: `.rank`, `.points` 클래스에 `font-variant-numeric: tabular-nums` CSS
  - [ ] `generateMetadata`: `{ title: '기여자 랭킹 | AI작당', description: '...' }` — noindex 없음
  - [ ] 비회원 열람 가능 (인증 불필요)
  - [ ] EmptyState: 데이터 없을 때 `EmptyState icon="trophy-line" title="아직 랭킹 데이터가 없습니다"`
  - [ ] `RankBadge` 컴포넌트 재사용 (gradeLevel → RankTier 매핑 적용, 6.3에서 확립한 매핑 함수 사용)

- [ ] Task 5: 메인 페이지 랭킹 위젯 (AC: #4)
  - [ ] `apps/web/app/page.tsx` 또는 메인 섹션 컴포넌트 확인 (현재 구현 확인 필요)
  - [ ] 기존 메인 6섹션 중 랭킹 위젯 위치 파악
  - [ ] `apps/web/features/gamification/RankingWidget.tsx` 신규 생성 (NEW)
  - [ ] `GET /api/v1/gamification/ranking?period=weekly&limit=5` 호출
  - [ ] TOP 5 닉네임 + 등급 배지 + 기여 포인트 표시
  - [ ] 주간/월간 탭 스위치 (클라이언트 또는 탭별 fetch)
  - [ ] 로딩: `Skeleton` (레이아웃 일치)

- [ ] Task 6: Redis 연결 확인 (AC: #1)
  - [ ] `apps/api`에서 Redis 연결 설정 확인 (현재 worker는 ioredis 연결 있음, api에도 필요)
  - [ ] `apps/api/src/redis.ts` 신규 생성 (또는 기존 파일 확인): `ioredis` 인스턴스 singleton
  - [ ] ranking API 라우트에서 redis 인스턴스 주입

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

### Debug Log References

### Completion Notes List

### File List

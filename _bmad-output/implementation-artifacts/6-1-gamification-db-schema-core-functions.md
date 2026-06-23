# Story 6.1: 게이미피케이션 DB 스키마 + core 순수 함수 토대

Status: ready-for-dev

## Story

As a 개발팀,
I want `points_ledger`·`grades`·`badges`·`user_badges` 테이블과 `core` 순수 함수가 정착되기를,
so that 이후 모든 게이미피케이션 스토리가 일관된 스키마·규칙 위에서 구현된다.

## Acceptance Criteria

1. Drizzle 스키마(`packages/database/src/schema/gamification.ts`)에 4개 테이블이 정확히 정의되고 `drizzle-kit generate`로 마이그레이션 파일이 생성된다.
   - `points_ledger`: `id`(uuid PK) · `user_id`(FK→users.id) · `delta`(integer ±) · `reason`(text, `domain.action` 형식 예: `post.created`) · `source_type`(text) · `source_id`(uuid nullable) · `created_at`(timestamptz)
   - `grades`: `id`(uuid PK) · `level`(integer unique 1~5) · `name`(text) · `min_points`(integer) · `max_points`(integer nullable)
   - `badges`: `id`(uuid PK) · `slug`(text unique) · `name`(text) · `description`(text) · `icon_url`(text) · `is_auto`(boolean default true)
   - `user_badges`: `id`(uuid PK) · `user_id`(FK→users.id) · `badge_id`(FK→badges.id) · `granted_at`(timestamptz defaultNow) · `granted_by`(uuid nullable, FK→users.id) · UNIQUE(`user_id`, `badge_id`)

2. `grades` 시드 데이터 5개가 DB에 삽입된다: Lv1 새내기(0~99) / Lv2 작당원(100~499) / Lv3 실전러(500~1499) / Lv4 고수(1500~2999) / Lv5 마스터(3000~null).

3. `badges` 시드 데이터 7개가 DB에 삽입된다: `first-post`(첫 글, is_auto=true) / `resource-contributor`(자료 기여자, is_auto=true) / `popular-resource`(인기 자료 다운로드≥50, is_auto=true) / `popular-post`(인기글 좋아요≥20, is_auto=true) / `answer-pro`(답변러 답변≥5, is_auto=true) / `consistent`(꾸준러 4주 연속, is_auto=true) / `admin-special`(운영자 수여, is_auto=false).

4. `packages/core/src/points.ts`가 에픽 규칙에 맞게 **전면 재작성**된다(기존 파일 대체):
   - `POINT_RULES` 상수: `post.created`(+10) · `answer.created`(+5) · `comment.created`(+1) · `resource.created`(+20) · `reaction.received`(+2) · `download.given`(+1)
   - `DAILY_CAPS` 상수: 행동별 일일 상한 정의
   - `pointsForAction(reason: PointReason): number` 함수
   - `canEarnPoint({ reason, userId, todayCount }: CanEarnPointOpts): boolean` 함수 (일일 상한 초과 시 false)
   - `PointReason` union type export

5. `packages/core/src/grades.ts` 신규 생성:
   - `GradeRow` 타입 (DB Row 모양 미러)
   - `gradeForPoints(totalPoints: number, grades: GradeRow[]): GradeRow` 함수 (DB 미참조 순수 함수, grades 배열 주입)
   - `nextGrade(current: GradeRow, grades: GradeRow[]): GradeRow | null` 함수
   - `pointsToNextGrade(totalPoints: number, grades: GradeRow[]): number | null` 함수

6. `packages/core/src/badges.ts` 신규 생성:
   - `BadgeSlug` union type: `'first-post' | 'resource-contributor' | 'popular-resource' | 'popular-post' | 'answer-pro' | 'consistent' | 'admin-special'`
   - `BADGE_CONDITIONS` 상수: 각 BadgeSlug별 체크 조건 정의 객체
   - `shouldAwardBadge(opts: BadgeCheckOpts): BadgeSlug[]` 함수 (DB 미참조, 집계값 주입)

7. `packages/core/src/ranking.ts` 신규 생성:
   - `PeriodType` union: `'weekly' | 'monthly'`
   - `rankingWindowDates(period: PeriodType, now: Date): { start: Date; end: Date }` 함수
   - `computeRanking(ledgerRows: { userId: string; delta: number }[], limit: number): RankEntry[]` 함수 (userId별 SUM·정렬·rank 부여)

8. `packages/contracts/src/gamification.ts` 신규 생성 (Zod 스키마):
   - `gradeSchema` / `Grade` 타입
   - `badgeSchema` / `Badge` 타입
   - `userBadgeSchema` / `UserBadge` 타입
   - `pointsLedgerEntrySchema` / `PointsLedgerEntry` 타입
   - `rankEntrySchema` / `RankEntry` 타입: `{ rank, userId, nickname, gradeLevel, gradeName, totalDelta }`
   - `rankingResponseSchema` / `RankingResponse` 타입: `{ period, items: RankEntry[], generatedAt }`
   - `userBadgesResponseSchema` / `UserBadgesResponse` 타입

9. `pnpm typecheck && pnpm test --filter=core --filter=contracts` 통과: 타입 오류 0·테스트 통과.
   - `packages/core/src/index.ts` 배럴에 신규 모듈 등록 (개별 named export, `export *` 금지)
   - `packages/contracts/src/index.ts` 배럴에 gamification 스키마 등록

## Tasks / Subtasks

- [ ] Task 1: DB 스키마 정의 (AC: #1)
  - [ ] `packages/database/src/schema/gamification.ts` 신규 생성
  - [ ] `points_ledger` 테이블 Drizzle 정의 (integer `delta`, text `reason`, text `source_type`, uuid `source_id` nullable, timestamptz `created_at`)
  - [ ] `grades` 테이블 Drizzle 정의 (integer `level` unique, text `name`, integer `min_points`, integer `max_points` nullable)
  - [ ] `badges` 테이블 Drizzle 정의 (text `slug` unique, boolean `is_auto`)
  - [ ] `user_badges` 테이블 Drizzle 정의 (uuid `granted_by` nullable FK, uniqueIndex on `(user_id, badge_id)`)
  - [ ] `Row`/`NewRow` 타입 각 테이블마다 `$inferSelect`/`$inferInsert`로 export
  - [ ] `packages/database/src/schema/index.ts`에 gamification 스키마 re-export 추가 (UPDATE)
  - [ ] `drizzle-kit generate`로 마이그레이션 파일 생성

- [ ] Task 2: 시드 데이터 스크립트 작성 (AC: #2, #3)
  - [ ] `packages/database/src/seeds/gamification.ts` 신규 생성
  - [ ] grades 5개 insert (Lv1~Lv5: 새내기/작당원/실전러/고수/마스터, min_points: 0/100/500/1500/3000)
  - [ ] badges 7개 insert (위 슬러그·이름·아이콘 경로·is_auto 값)
  - [ ] 스크립트는 멱등 실행 가능 (`onConflictDoNothing` 또는 upsert)

- [ ] Task 3: `packages/core/src/points.ts` 전면 재작성 (AC: #4)
  - [ ] 기존 파일 삭제 후 신규 작성 (`PointAction` 구 타입 제거, `PointReason` 신규)
  - [ ] `POINT_RULES`: `{ 'post.created': 10, 'answer.created': 5, 'comment.created': 1, 'resource.created': 20, 'reaction.received': 2, 'download.given': 1 }`
  - [ ] `DAILY_CAPS`: `{ 'post.created': 10, 'answer.created': 10, 'comment.created': 20, 'resource.created': 5, 'reaction.received': 50, 'download.given': 30 }` (설계 후 확정값 기재)
  - [ ] `canEarnPoint` 구현: `todayCount >= DAILY_CAPS[reason]` 이면 false
  - [ ] `packages/core/src/points.test.ts` 전면 업데이트 (AC: #4): POINT_RULES 값 검증, DAILY_CAPS 경계 테스트, canEarnPoint 상한 초과/미만 테스트

- [ ] Task 4: `packages/core/src/grades.ts` 신규 생성 (AC: #5)
  - [ ] `GradeRow` 타입 정의 (id, level, name, minPoints, maxPoints)
  - [ ] `gradeForPoints(totalPoints, grades)`: level 내림차순 정렬 후 `minPoints <= totalPoints` 첫 매칭 반환
  - [ ] `nextGrade(current, grades)`: `level === current.level + 1` 반환
  - [ ] `pointsToNextGrade(totalPoints, grades)`: next가 있으면 `next.minPoints - totalPoints`
  - [ ] `packages/core/src/grades.test.ts` 신규 생성: 경계값 100·500·1500·3000 상/하위 단위 테스트

- [ ] Task 5: `packages/core/src/badges.ts` 신규 생성 (AC: #6)
  - [ ] `BadgeSlug` union type
  - [ ] `BadgeCheckOpts` 타입: `{ postCount, resourceCount, downloadCount, likeReceivedCount, answerCount, weeklyActiveCount, isAdminGrant }`
  - [ ] `BADGE_CONDITIONS` 객체: 각 BadgeSlug → 체크 함수 매핑
  - [ ] `shouldAwardBadge(opts)`: BADGE_CONDITIONS 순회해 달성한 BadgeSlug[] 반환 (admin-special은 항상 제외)
  - [ ] `packages/core/src/badges.test.ts` 신규 생성: 49/50 경계 테스트, 19/20 경계 테스트, 4/5 답변 경계 테스트

- [ ] Task 6: `packages/core/src/ranking.ts` 신규 생성 (AC: #7)
  - [ ] `PeriodType` 타입
  - [ ] `rankingWindowDates`: weekly = 직전 월요일 00:00 ~ 금주 일요일 23:59:59 UTC, monthly = 이번 달 1일 ~ 말일
  - [ ] `computeRanking`: userId별 delta SUM → 내림차순 정렬 → rank 1부터 부여 → limit 적용
  - [ ] `packages/core/src/ranking.test.ts` 신규 생성: 기간 경계, 동점 처리, limit 동작 테스트

- [ ] Task 7: `packages/contracts/src/gamification.ts` 신규 생성 (AC: #8)
  - [ ] 모든 스키마 Zod로 정의, 각 타입 `z.infer` export
  - [ ] `rankEntrySchema` 필드: rank(number), userId(uuid string), nickname(string), gradeLevel(number), gradeName(string), totalDelta(number)
  - [ ] `rankingResponseSchema` 필드: period(PeriodType), items(RankEntry[]), generatedAt(ISO string)

- [ ] Task 8: 배럴 등록 (AC: #9)
  - [ ] `packages/core/src/index.ts` UPDATE: `export { ... } from './points'` / `'./grades'` / `'./badges'` / `'./ranking'` (named export만, `export *` 금지)
  - [ ] `packages/contracts/src/index.ts` UPDATE: gamification 스키마 named export 추가
  - [ ] `pnpm typecheck` 통과 확인
  - [ ] `pnpm test --filter=core --filter=contracts` 통과 확인

## Dev Notes

### 기존 파일 상태 및 변경 내용

**`packages/core/src/points.ts` (UPDATE — 전면 대체)**
- 현재 상태: `PointAction`(구 4종), `POINT_TABLE`(post-created:5/answer-accepted:20/resource-uploaded:15/received-like:1), `gradeForPoints` (4등급), `MemberGrade` 타입 포함
- 삭제 대상: 구 `PointAction`, `MemberGrade`, `GRADE_THRESHOLDS`, `gradeForPoints`(grades.ts로 이동)
- 신규 추가: `PointReason`(점표기 `post.created` 등 6종), `POINT_RULES`, `DAILY_CAPS`, `pointsForAction`, `canEarnPoint`
- **주의**: Epic 6.2~6.6이 이 파일을 참조. 구 `PointAction` 타입은 즉시 삭제. 구 `points.test.ts`도 전면 교체.

**`packages/core/src/grades.ts` (NEW)**
- `gradeForPoints`는 DB Row를 직접 참조하지 않는다. 호출자가 grades 배열을 DB에서 조회해 주입.
- DB Row 형태는 `GradeRow`(camelCase Drizzle 프로퍼티 명명: `minPoints`, `maxPoints`)

**`packages/database/src/schema/gamification.ts` (NEW)**
- 테이블명 snake_case 복수형: `points_ledger`(원장이라 singular처럼 보이지만 실제로는 행 집합이므로 OK) · `grades` · `badges` · `user_badges`
- `points_ledger.delta`: integer (양수=적립, 음수=회수). Drizzle에서 `integer("delta").notNull()`
- `points_ledger.reason`: `text("reason").notNull()` — enum 대신 text (신규 reason 추가 시 마이그레이션 불필요)
- `user_badges.granted_by`: `uuid("granted_by")` nullable, `.references(() => users.id)` — 자동 수여 시 null, 운영자 수여 시 admin user id

### 아키텍처 패턴 (AR 준수)
- DB 스키마는 `packages/database`에만 정의, `apps/api`·`apps/worker`에서만 import
- core 순수 함수는 DB 미참조 (의존성 주입 방식으로 grades 배열·집계값 전달)
- 배럴 export는 named only, `export *` 금지 [Source: project-context.md#패키지-경계-격리]
- Zod 스키마는 `packages/contracts`에서만 정의 [Source: project-context.md#타입·검증]
- 트랜잭션은 `apps/api` service 레이어에서만 열기 [Source: architecture.md#Transaction--Data-Access]

### 테스트 표준
- 모든 core 순수 함수는 co-located `*.test.ts` Vitest로 작성
- 경계값 테스트 필수: 100점 미만 vs 100점(작당원 전환), 499 vs 500, 1499 vs 1500, 2999 vs 3000
- `canEarnPoint` 테스트: 상한 미만(todayCount=1, CAP=10) → true, 상한 동일(todayCount=10, CAP=10) → false

### Project Structure Notes

- `packages/database/src/schema/index.ts`는 현재 `export * from './users'`만 있음 → gamification 추가 시 `export { pointsLedger, grades, badges, userBadges, ... } from './gamification'` (named, export * 금지)
- 시드 파일 위치: `packages/database/src/seeds/` 폴더 신규 생성 (현재 미존재)
- `drizzle.config.ts` 경로 확인: `packages/database/drizzle.config.ts` 존재 확인 후 schema glob 패턴에 `gamification.ts` 포함되는지 확인
- `apps/web/lib/ranks.ts`의 `RANKS`/`RankTier` 타입은 **변경하지 않는다** — 프론트 디자인 시스템 기준이며 이 스토리의 `GradeRow.level`(1~5)과 매핑은 Story 6.6에서 처리

### References

- [Source: epics.md#Story-6.1 L1862~1890]
- [Source: architecture.md#Data-Modeling L162]
- [Source: project-context.md#패키지-경계-격리]
- [Source: packages/core/src/points.ts — 기존 구현 (전면 대체)]
- [Source: packages/database/src/schema/users.ts — FK 참조 대상]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---
baseline_commit: f1db68b129bc6e3c4c63ec06401b7658078250cd
---

# Story 6.3: 등급 시스템 — 도출 · 표시 · 변동 알림 이벤트

Status: review

## Story

As a 회원,
I want 누적 포인트에 따라 등급이 자동 도출되어 이름 옆·프로필에 표시되고 등급 변동 시 알림 이벤트가 발행되기를,
so that 활동이 늘수록 가벼운 명예가 쌓인다.

## Acceptance Criteria

1. `gradeForPoints(totalPoints, grades)` (6.1 순수 함수)에 DB에서 조회한 grades 배열을 주입하면 정확한 `GradeRow` 반환. 경계값 정확성: 100점 미만 → 새내기, 100점 → 작당원, 499점 → 작당원, 500점 → 실전러 (단위 테스트 6.1에서 완료, 이 스토리에서는 API 레이어 통합 검증).

2. 공개 프로필 SSR(`/u/[nickname]`) 로드 시 서버에서 등급 정보를 API로 조회해 닉네임 옆 `<RankBadge>` 컴포넌트로 등급명·레벨 배지를 렌더한다. 비회원 열람 가능.

3. 마이페이지(`/mypage`) 로그인 진입 시 사이드바에 등급명·레벨·포인트 합산·다음 등급까지 잔여 포인트가 표시된다. 포인트 숫자는 소형으로 비강조 처리.

4. `points_ledger` insert 후 `gradeForPoints(이전총점)` ≠ `gradeForPoints(신총점)` 감지 시 `ranking` BullMQ 큐에 `gamification.grade-up` 잡을 enqueue한다. worker가 이 잡을 소비해 Epic 7 알림 큐에 `grade.level-up` 이벤트를 발행한다(멱등 처리).

5. 등급 미잠금 원칙(FR-9.2): 어떤 라우트에도 `gradeLevel` 기반 접근 가드가 없다. Lv1 새내기도 모든 게시글 작성·댓글·다운로드 등 핵심 행동을 제한 없이 수행한다.

6. 포인트 원장(`points_ledger`) 직접 insert 엔드포인트가 공개 API에 존재하지 않는다. 관리자 수동 지급은 Epic 9 전용 어드민 API만 허용.

7. `GET /api/v1/gamification/me` (로그인 필요) 응답에 현재 등급 정보 포함:
   - `{ totalPoints, grade: { level, name }, nextGrade: { level, name } | null, pointsToNext: number | null }`
   - Zod `gradeSchema` 검증

## Tasks / Subtasks

- [x] Task 1: 등급 조회 API 서비스 (AC: #1, #7)
  - [x] `apps/api/src/routes/v1/gamification/gamification.service.ts` 신규 생성 (NEW)
  - [x] `getUserGrade(db, userId)` 함수:
    - `points_ledger` SUM(delta) WHERE user_id=userId → totalPoints
    - `grades` 전체 조회 (5행, 캐시 고려)
    - `gradeForPoints(totalPoints, grades)` 호출 → 현재 등급
    - `nextGrade(current, grades)`, `pointsToNextGrade(totalPoints, grades)` 호출
    - `{ totalPoints, grade, nextGrade, pointsToNext }` 반환
  - [x] `apps/api/src/routes/v1/gamification/gamification.routes.ts` 신규 생성 (NEW)
  - [x] `GET /api/v1/gamification/me` 라우트: 인증 필요, `getUserGrade` 호출, `gradeSchema` 응답 검증
  - [x] `GET /api/v1/gamification/user/:userId/grade` 라우트: 공개 (프로필 SSR용), userId로 조회

- [x] Task 2: 등급 변동 감지 + 큐 enqueue (AC: #4)
  - [x] `apps/api/src/routes/v1/gamification/points.service.ts` UPDATE (6.2에서 생성)
  - [x] `earnPoints` 함수 내 insert 성공 후:
    - 이전 totalPoints 계산 (insert 전 SUM)
    - 신규 totalPoints 계산 (insert 후 SUM)
    - `gradeForPoints(prev, grades)` vs `gradeForPoints(next, grades)` 비교
    - 등급 변동 시 `ranking` 큐에 `gamification.grade-up` enqueue: `{ userId, prevLevel, newLevel, newGradeName }`
  - [x] `apps/api/src/lib/queues.ts` UPDATE: `ranking` 큐 Producer(`getRankingQueue`) + 상수 추가
  - [x] `apps/worker/src/connection.ts` UPDATE: `QUEUE_NAMES`에 `ranking: 'ranking'` 추가

- [x] Task 3: Worker 등급 변동 잡 프로세서 (AC: #4)
  - [x] `apps/worker/src/processors/gradeUp.processor.ts` 신규 생성 (NEW)
  - [x] `gamification.grade-up` 잡 소비: payload `{ userId, prevLevel, newLevel, newGradeName }`
  - [x] 알림 큐(`notifications` 큐)에 `grade.level-up` 이벤트 enqueue: `{ userId, level: newLevel, gradeName, prevLevel }`
  - [x] 멱등: Redis key `grade-up-notified:{userId}:{newLevel}` TTL 24h dedup
  - [x] `apps/worker/src/index.ts` UPDATE: ranking worker 등록

- [x] Task 4: 공개 프로필 SSR 등급 연동 (AC: #2)
  - [x] `apps/web/app/u/[nickname]/page.tsx` UPDATE
  - [x] `fetchUserGrade(userId)` 헬퍼 추가 → `GET /api/v1/gamification/user/:userId/grade` 호출
  - [x] `RankBadge` 컴포넌트는 그대로 유지 — `rank` prop을 API 응답의 `grade.level`에서 `RankTier`로 매핑
  - [x] 레벨→RankTier 매핑: `LEVEL_TO_RANK_TIER` 상수 (Story 6.6 정식 통합)
  - [x] SSR에서 `notFound()` 처리 유지, 비회원 열람 가능 (인증 미필요 API)
  - [x] JSON-LD ProfilePage 스크립트 유지

- [x] Task 5: 마이페이지 등급 사이드바 API 연동 (AC: #3)
  - [x] `apps/web/app/mypage/page.tsx` UPDATE
  - [x] `GET /api/v1/gamification/me` useEffect로 호출 → `gradeData` state 저장
  - [x] `rankProgress` 계산 로직: API 응답값 기반으로 교체 (미조회 시 기존 로직 폴백)
  - [x] 등급 진행률 `pct` = `totalPoints / (totalPoints + remaining) * 100`
  - [x] 포인트 표시: API 응답 `totalPoints` 적용 (기존 0 → 실제값)
  - [x] 탭 구조, followingData, CSS 레이아웃 보존

- [x] Task 6: gamification 라우트를 v1 index에 등록 (AC: #6)
  - [x] `apps/api/src/routes/v1/index.ts` UPDATE: `gamificationRoutes` 등록 (prefix `/gamification`)
  - [x] 직접 points_ledger insert 엔드포인트 미노출 확인 (gamification.routes.ts에 없음)

## Dev Notes

### 기존 파일 상태 및 변경 내용

**`apps/web/app/mypage/page.tsx` (UPDATE)**
- 현재 상태: 전체 `"use client"` 컴포넌트, `useMockAuth` 로그인 상태, `profileExtra` 하드코딩, `rankProgress` 계산
- 변경 내용: 클라이언트 컴포넌트 유지 (마이페이지는 noindex, SSR 불필요), 로그인 후 `fetch('/api/v1/gamification/me')` 호출해 데이터 교체
- **보존할 것**: 탭 구조(posts/comments/bookmarks/likes/following/followers), stats grid, 팔로잉/팔로워 목업 (Epic 5에서 실제 구현), RankBadge 렌더, progressbar aria 속성
- **변경 금지**: 기존 레이아웃(`mypage.module.css`), 탭 키 순서, accountLinks

**`apps/web/app/u/[nickname]/page.tsx` (UPDATE)**
- 현재 상태: 서버 컴포넌트, MOCK_PROFILES 데이터, ProfileInteraction 클라이언트 분리
- 변경 내용: API 호출로 실제 프로필 + 등급 조회
- **보존할 것**: generateMetadata, generateStaticParams 패턴, JSON-LD, 배너·아바타·링크 렌더링, ProfileInteraction 임포트, profile.module.css
- RankBadge는 현재 `profile.rank: RankTier`를 prop으로 받음 → API 응답 `grade.level`에서 매핑

### 등급 변동 감지 성능 고려

`earnPoints` 내 등급 변동 감지 시 grades 배열을 매번 DB 조회하면 N+1 발생.
해결: `earnPoints` 호출 전 service 레이어에서 grades 배열을 1회 조회해 전달하거나, Redis 캐시로 grades 캐싱(TTL 1h, grades 테이블은 변경 빈도 매우 낮음).

### BullMQ ranking 큐

- 큐명: `'ranking'` (kebab 규칙, `QUEUE_NAMES.ranking`)
- 잡명: `'gamification.grade-up'` (domain.action 규칙)
- 페이로드 타입은 `packages/contracts/src/gamification.ts`에 `gradeUpJobSchema` 추가
- worker는 BullMQ Worker 클래스로 consuming

### 등급 미잠금 원칙 (FR-9.2)

어떤 API 라우트 핸들러에도 아래 코드가 없어야 함:
```typescript
if (user.gradeLevel < 2) throw forbidden(...)
```
게시글 작성·댓글·다운로드 등 모든 핵심 행동 라우트에 grade 체크 미존재 확인.

### 접근성 (UX-DR 준수)

- `RankBadge` 컴포넌트는 `aria-label="등급: 실전러"` 형태로 반드시 제공 (색 단독 전달 금지)
- 기존 `RankBadge` 컴포넌트가 `aria-label` 지원하는지 확인, 없으면 추가

### Project Structure Notes

- `apps/worker/src/processors/` 폴더 신규 생성 필요 (현재 미존재)
- `apps/api`에서 BullMQ Producer 초기화: `new Queue('ranking', { connection })` — 연결 설정은 `apps/worker/src/connection.ts`와 동일 redis URL 사용
- gamification 라우트 폴더: `apps/api/src/routes/v1/gamification/` (6.2에서 생성 시작, 이 스토리에서 routes.ts 추가)

### References

- [Source: epics.md#Story-6.3 L1920~1951]
- [Source: apps/web/app/mypage/page.tsx — 기존 등급 사이드바 구현]
- [Source: apps/web/app/u/[nickname]/page.tsx — 기존 공개 프로필 구현]
- [Source: apps/web/lib/ranks.ts — RankTier 매핑 레지스트리]
- [Source: architecture.md#Communication-Patterns BullMQ 큐명 규칙]
- [Source: project-context.md#통신-패턴 — ranking 큐 명시]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- points.service.test.ts: gradeForPoints mock 누락 → `vi.mock("@ai-jakdang/core")` 에 추가 해결
- gamification.service.test.ts: 미사용 `makeTestDb` 함수 TypeScript TS6133 오류 → 제거 해결
- mypage/page.tsx: levelToRankTier 컴포넌트 내 정의로 useMemo 의존성 경고 → 컴포넌트 외부 상수로 이동

### Completion Notes List
- AC#1, #7: `gamification.service.ts` + `gamification.routes.ts` 신규 생성. `getUserGrade`가 SUM(delta) + gradeForPoints 주입 방식으로 등급 도출.
- AC#2: `/u/[nickname]/page.tsx` SSR에서 `fetchUserGrade(profile.id)` 호출 → RankBadge에 실제 등급 레벨 전달.
- AC#3: `/mypage/page.tsx` 클라이언트 useEffect로 `/api/v1/gamification/me` 조회 → rankProgress 실제 데이터 적용. 포인트 소형 표시(`.rankShowcaseText span` CSS 재사용).
- AC#4: `points.service.ts` earnPoints 내 insert 후 prevTotal vs newTotal 비교 → 등급 변동 시 `ranking` 큐 enqueue. `gradeUp.processor.ts` 신규 — Redis dedup(TTL 24h) + notifications 큐 grade.level-up 발행.
- AC#5: gradeLevel 기반 접근 가드 없음 확인 (gamification.routes.ts에 gradeLevel 조건 없음).
- AC#6: points_ledger 직접 insert 엔드포인트 gamification.routes.ts에 없음 확인.
- `packages/contracts/src/gamification.ts` + `index.ts`: `gradeUpJobSchema` / `GradeUpJobPayload` 추가.
- 단위 테스트 9건 신규 작성 (경계값: 99→새내기, 100→작당원, 499→작당원, 500→실전러, 0→새내기, 5000→마스터, 큐 enqueue mock).

### File List
- apps/api/src/routes/v1/gamification/gamification.service.ts (NEW)
- apps/api/src/routes/v1/gamification/gamification.routes.ts (NEW)
- apps/api/src/routes/v1/gamification/gamification.service.test.ts (NEW)
- apps/api/src/routes/v1/gamification/points.service.ts (MODIFIED — earnPoints에 등급 변동 감지 + enqueue 추가)
- apps/api/src/routes/v1/gamification/points.service.test.ts (MODIFIED — gradeForPoints mock, gamification.service mock, getRankingQueue mock 추가)
- apps/api/src/lib/queues.ts (MODIFIED — getRankingQueue, RANKING_QUEUE_NAME, GRADE_UP_JOB_NAME 추가)
- apps/api/src/routes/v1/index.ts (MODIFIED — gamificationRoutes 등록)
- apps/worker/src/connection.ts (MODIFIED — QUEUE_NAMES.ranking 추가)
- apps/worker/src/processors/gradeUp.processor.ts (NEW)
- apps/worker/src/index.ts (MODIFIED — ranking worker 등록)
- packages/contracts/src/gamification.ts (MODIFIED — gradeUpJobSchema, GradeUpJobPayload 추가)
- packages/contracts/src/index.ts (MODIFIED — gradeUpJobSchema, GradeUpJobPayload export)
- apps/web/app/u/[nickname]/page.tsx (MODIFIED — fetchUserGrade 추가, RankBadge에 실제 등급 레벨 전달)
- apps/web/app/mypage/page.tsx (MODIFIED — gamification API 연동, rankProgress 실제 데이터 적용)

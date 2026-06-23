# Story 6.4: 뱃지 시스템 — 자동 수여 · 보유 뷰

Status: ready-for-dev

## Story

As a 회원,
I want 활동 조건 달성 시 뱃지가 자동 수여되고 `/mypage`(뱃지 탭)·공개 프로필에서 확인되기를,
so that 특정 기여를 인정받는 성취감을 느낀다.

## Acceptance Criteria

1. `shouldAwardBadge(opts)` 순수 함수(6.1 구현)에 집계값을 주입하면 달성한 `BadgeSlug[]`를 반환한다. 경계값 검증:
   - 다운로드 49회 → `popular-resource` 미포함
   - 다운로드 50회 → `popular-resource` 포함
   - 좋아요 19회 → `popular-post` 미포함
   - 좋아요 20회 → `popular-post` 포함
   - 답변 4개 → `answer-pro` 미포함
   - 답변 5개 → `answer-pro` 포함

2. 포인트·콘텐츠 이벤트 발생 후 BullMQ `ranking` 큐의 `gamification.badge-check` 잡이 소비될 때:
   - 해당 userId의 최신 집계값(postCount, resourceCount, downloadCount, likeReceivedCount, answerCount) 조회
   - `shouldAwardBadge(opts)` 호출 → 달성한 BadgeSlug[] 반환
   - 각 달성 뱃지 중 `user_badges`에 미존재하는 것만 insert (`is_auto=true` 뱃지만 대상)
   - 신규 수여마다 `notification` 큐에 `badge.awarded` 이벤트 enqueue: `{ userId, badgeSlug, badgeName }`
   - 멱등: 이미 보유한 뱃지는 skip (UNIQUE 제약이 있으므로 ON CONFLICT DO NOTHING)

3. `is_auto=false` 뱃지(`admin-special`)는 badge-check job에서 자동 평가 제외. 수여는 Epic 9 어드민 API 전용 (`granted_by` = 운영자 id).

4. `GET /api/v1/gamification/my-badges` (로그인 필요) 응답: 보유 뱃지 목록 `{ items: [{ badgeSlug, badgeName, iconUrl, grantedAt }] }`. `userBadgesResponseSchema`로 Zod 검증.

5. 공개 프로필 SSR (`/u/[nickname]`) 로드 시 해당 사용자의 보유 뱃지가 표시된다. 비회원 열람 가능.

6. 첫 글 삭제(soft-delete) 후에도 `first-post` 뱃지가 회수되지 않는다(단방향). `admin-special` 뱃지만 Epic 9 어드민 API에서 회수 가능.

7. `GET /api/v1/gamification/my-badges` 응답에서 미보유 뱃지 목록·달성 조건은 노출되지 않는다 (게이미피케이션 전면화 거부 원칙).

## Tasks / Subtasks

- [ ] Task 1: badge-check worker 프로세서 구현 (AC: #2, #3)
  - [ ] `apps/worker/src/processors/badgeCheck.processor.ts` 신규 생성 (NEW)
  - [ ] `gamification.badge-check` 잡 payload 타입: `{ userId: string }` — `packages/contracts`에 `badgeCheckJobSchema` 추가
  - [ ] 집계 쿼리 구현 (apps/worker에서 DB 직접 접근):
    - `postCount`: posts WHERE user_id=userId AND status != 'deleted' COUNT
    - `resourceCount`: resources WHERE user_id=userId AND status != 'deleted' COUNT
    - `downloadCount`: download_logs WHERE resource.user_id=userId (자료 소유자 기준) COUNT
    - `likeReceivedCount`: reactions WHERE target_user_id=userId AND type='like' (또는 points_ledger에서 reaction.received SUM) COUNT
    - `answerCount`: answers WHERE user_id=userId AND status != 'deleted' COUNT
    - `weeklyActiveCount`: 4주 연속 활동 여부 (매주 최소 1개 콘텐츠 생성 — 4개 ISO week 연속)
  - [ ] `shouldAwardBadge(opts)` 호출 (`@ai-jakdang/core` import)
  - [ ] `is_auto=true` 뱃지만 필터링 후 badges 테이블에서 slug→id 매핑 조회
  - [ ] `user_badges` INSERT ON CONFLICT DO NOTHING (멱등)
  - [ ] 신규 수여분 감지 후 notification 큐에 `badge.awarded` enqueue
  - [ ] `apps/worker/src/index.ts` UPDATE: badge-check worker 등록

- [ ] Task 2: badge-check 잡 enqueue 트리거 (AC: #2)
  - [ ] `apps/api/src/routes/v1/gamification/points.service.ts` UPDATE (6.2 파일)
  - [ ] `earnPoints` 성공 후 `ranking` 큐에 `gamification.badge-check` 잡 enqueue: `{ userId }`
  - [ ] 중복 enqueue 방지: BullMQ jobId를 `badge-check:{userId}:{date}` 패턴으로 설정 (같은 날 같은 유저 중복 체크 skip)

- [ ] Task 3: my-badges API 엔드포인트 (AC: #4, #7)
  - [ ] `apps/api/src/routes/v1/gamification/gamification.routes.ts` UPDATE (6.3 파일에 추가)
  - [ ] `GET /api/v1/gamification/my-badges` 라우트 구현:
    - 인증 필요 (세션에서 userId 추출)
    - `user_badges JOIN badges` 쿼리: `user_id=userId` + `badges.is_auto=true OR granted_by IS NOT NULL`
    - 반환: `{ items: [{ badgeSlug, badgeName, iconUrl, grantedAt }] }`
    - `userBadgesResponseSchema` 응답 검증
  - [ ] `GET /api/v1/gamification/user/:userId/badges` (공개, 프로필 SSR용): userId로 보유 뱃지 조회

- [ ] Task 4: `/mypage` 뱃지 탭 구현 (AC: #4)
  - [ ] `apps/web/app/mypage/page.tsx` UPDATE — 기존 탭 구조에 `badges` 탭 추가
  - [ ] `/me/badges` 별도 라우트 신규 생성 금지. `apps/web/app/me/` 폴더 생성 금지
  - [ ] 기존 탭키 순서(`posts`·`comments`·`bookmarks`·`likes`·`following`·`followers`) 유지하며 `badges` 탭 추가
  - [ ] `GET /api/v1/gamification/my-badges` 호출 → 보유 뱃지 카드 렌더
  - [ ] 0개면 `EmptyState` (원인 + 다음 행동 1개): `EmptyState icon="award-line" title="아직 획득한 뱃지가 없어요" description="활동을 이어가면 뱃지가 자동으로 수여됩니다."`
  - [ ] 뱃지 카드: 아이콘(icon_url) + 뱃지명 + 수여일
  - [ ] 로그인 필요 페이지: 비회원 → 로그인 유도 모달 + redirectTo
  - [ ] noindex 메타 설정 (마이페이지 계열)

- [ ] Task 5: 공개 프로필 뱃지 표시 (AC: #5)
  - [ ] `apps/web/app/u/[nickname]/page.tsx` UPDATE (6.3에서 이미 API 연동 중)
  - [ ] `GET /api/v1/gamification/user/:userId/badges` 호출해 보유 뱃지 목록 추가
  - [ ] 보유 뱃지 아이콘 row 렌더: 공개 프로필의 적절한 위치 (프로필 헤더 하단 또는 사이드)
  - [ ] 비회원 열람 가능, 보유 뱃지만 표시

- [ ] Task 6: 뱃지 단방향 원칙 확인 (AC: #6)
  - [ ] `revokePoints` 또는 soft-delete 처리 코드에서 `user_badges` 삭제 로직이 없음 확인
  - [ ] badge-check processor에 회수 로직 미포함 확인
  - [ ] 테스트: 첫 글 생성 → badge-check → user_badges에 first-post 존재 → 글 삭제 → user_badges first-post 여전히 존재

## Dev Notes

### 뱃지 자동 수여 흐름

```
콘텐츠 이벤트 발생
  → earnPoints (6.2 service)
  → points_ledger insert 성공
  → ranking 큐 gamification.badge-check enqueue {userId}
  → [비동기] worker badge-check processor 소비
  → 집계 조회 → shouldAwardBadge → 신규 뱃지 감지
  → user_badges insert
  → notification 큐 badge.awarded enqueue {userId, badgeSlug}
```

### 꾸준러(consistent) 뱃지 집계

4주 연속 활동은 복잡 쿼리:
```sql
-- 최근 4주의 ISO week 번호가 연속으로 모두 존재하는지 확인
WITH weeks AS (
  SELECT EXTRACT(week FROM created_at) AS wk
  FROM points_ledger
  WHERE user_id = $userId
    AND created_at >= NOW() - INTERVAL '28 days'
  GROUP BY wk
)
SELECT COUNT(*) = 4 AS is_consistent FROM weeks
-- 단, 주 경계를 정확히 처리해야 함 (연도 교차 주의)
```
구현 복잡도가 높으므로: 최초 구현에서 `weeklyActiveCount`를 최근 4개 ISO주에 모두 `delta>0` 행이 존재하는지로 단순화해도 됨.

### 멱등 보장

- `user_badges`에 `UNIQUE(user_id, badge_id)` 제약 존재 (6.1 스키마)
- Worker에서: `INSERT INTO user_badges ... ON CONFLICT (user_id, badge_id) DO NOTHING`
- "신규 수여" 감지: insert 결과 rowCount > 0인 것만 `badge.awarded` 발행

### BullMQ jobId 중복 방지

```typescript
await rankingQueue.add('gamification.badge-check', { userId }, {
  jobId: `badge-check:${userId}:${new Date().toISOString().slice(0,10)}`,
  // 같은 날 같은 유저에 대해 1번만 실행 (중복 방지)
})
```

### UX 원칙 — 게이미피케이션 거부

- 미보유 뱃지·달성 조건 노출 금지 (API 응답에도, 프론트에도)
- 뱃지 수여 팝업 미사용 (알림은 Epic 7 인앱 알림 채널로만)
- `/mypage` 뱃지 탭 내부에서만 뱃지 열람, 포인트 리더보드 미존재

### 접근성

- 뱃지 아이콘 img: `alt="뱃지명"` 필수 (색 단독 전달 금지)
- 아이콘 URL이 없을 경우 fallback: `<Icon name="award-line" aria-label="뱃지명">`

### Project Structure Notes

- 뱃지 열람은 `/mypage` 탭 구조 확장으로 처리. `apps/web/app/me/` 폴더 및 `/me/badges` 별도 라우트 생성 금지.
- `apps/web/app/mypage/page.tsx`의 기존 탭 배열에 `{ key: 'badges', label: '뱃지' }` 추가, 탭 컨텐츠 렌더 분기 처리
- 뱃지 아이콘 실제 파일: `public/badges/` 폴더에 이미 존재하는지 확인. 시드 데이터의 `icon_url`은 `/badges/{slug}.png` 패턴 사용

### References

- [Source: epics.md#Story-6.4 L1952~1983]
- [Source: architecture.md#Project-Directory-Structure me/badges]
- [Source: packages/core/src/badges.ts — 6.1에서 구현된 shouldAwardBadge]
- [Source: project-context.md#UX-에러-처리 — EmptyState 패턴]
- [Source: project-context.md#통신-패턴 — BullMQ 잡명 domain.action 규칙]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

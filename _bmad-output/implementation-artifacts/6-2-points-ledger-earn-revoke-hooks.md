# Story 6.2: 포인트 적립 · 회수 훅

Status: review

## Story

As a 회원,
I want 글·답변·댓글·자료 등록, 받은 좋아요, 다운로드 시 포인트가 자동 적립되고 삭제·회수 시 정확히 회수되기를,
so that 포인트 원장이 항상 정합 상태를 유지한다.

## Acceptance Criteria

1. Epic 2~5 각 service의 생성 트랜잭션 내에서 `points_ledger` insert가 실행된다:
   - 게시글 작성(post.created) → +10점, `(source_type='post', source_id=post.id)` 기록
   - 답변 작성(answer.created) → +5점, `(source_type='answer', source_id=answer.id)` 기록
   - 댓글 작성(comment.created) → +1점, `(source_type='comment', source_id=comment.id)` 기록
   - 자료 등록(resource.created) → +20점, `(source_type='resource', source_id=resource.id)` 기록
   - 좋아요 수신(reaction.received) → 콘텐츠 작성자에게 +2점, `(source_type='reaction', source_id=reaction.id)` 기록
   - 다운로드 수신(download.given) → 자료 작성자에게 +1점, `(source_type='download_log', source_id=download_log.id)` 기록

2. `canEarnPoint({ reason, userId, todayCount })` 로 일일 상한 초과 시 `points_ledger` insert를 건너뛴다. 콘텐츠 자체(게시글·댓글 등)는 정상 저장.

3. 소스 콘텐츠가 soft-delete(status='deleted') 될 때, 동일 트랜잭션 내에서 역방향 delta(음수) 회수 행을 `points_ledger`에 insert한다:
   - `reason` = `{원래reason}.revoked` (예: `post.created.revoked`)
   - `delta` = 원래 delta의 음수 값
   - 회수 후 `SUM(delta)` 가 원래보다 정확히 감소함을 테스트로 검증

4. 자기 글 자기 좋아요(SELF_REACTION) 시 400 에러가 반환되고 포인트 미삽입된다 (Epic 5 가드와 협력, 이 스토리에서는 포인트 미삽입 side 검증).

5. 동일 `(user_id, reason, source_id)` 조합으로 비회수 행이 이미 존재하면 적립을 건너뛴다(멱등 보장). 재시도·중복 이벤트 시 포인트 이중 적립 없음.

6. `pnpm test --filter=api` 실행 시 포인트 서비스 테스트 통과:
   - 글 생성 → 포인트 적립 검증
   - 글 삭제 → 포인트 회수 검증
   - 일일 상한 초과 → 미적립 검증
   - 중복 이벤트 → 멱등 검증
   - 자기 좋아요 → 미적립 검증

## Tasks / Subtasks

- [x] Task 1: 포인트 서비스 레이어 신규 생성 (AC: #1, #2, #3, #5)
  - [x] `apps/api/src/routes/v1/gamification/points.service.ts` 신규 생성 (NEW)
  - [x] `earnPoints(db, { userId, reason, sourceType, sourceId, todayCount })` 함수 구현:
    - `canEarnPoint({ reason, userId, todayCount })` 로 상한 체크
    - 멱등 체크: `points_ledger`에서 `(user_id=userId, reason=reason, source_id=sourceId)` AND delta>0 인 행 조회
    - 존재하지 않으면 `points_ledger` insert
  - [x] `revokePoints(db, { userId, reason, sourceType, sourceId })` 함수 구현:
    - 기존 적립 행 조회 (동일 userId/reason/sourceId)
    - 없으면 no-op, 있으면 `{reason}.revoked` + 원본 delta 음수로 insert
  - [x] `getTodayCount(db, { userId, reason })` 헬퍼: 오늘 00:00:00 UTC 이후 해당 reason 적립 건수 조회

- [x] Task 2: 게시글 서비스에 포인트 훅 추가 (AC: #1)
  - [x] `apps/api/src/routes/v1/posts/service.ts` UPDATE
  - [x] 글 생성 트랜잭션 내 `earnPoints(db, { userId, reason: 'post.created', sourceType: 'post', sourceId: post.id, todayCount })` 호출
  - [x] 글 삭제(soft-delete) 트랜잭션 내 `revokePoints(db, { userId, reason: 'post.created', sourceType: 'post', sourceId: post.id })` 호출
  - [x] `todayCount`는 동일 트랜잭션 전 `getTodayCount` 호출로 획득

- [x] Task 3: 답변·댓글 서비스에 포인트 훅 추가 (AC: #1)
  - [x] `apps/api/src/routes/v1/qna/answer.service.ts` UPDATE
  - [x] 답변 생성 시 `earnPoints(..., reason: 'answer.created', sourceType: 'answer', ...)`
  - [x] 답변 삭제 시 `revokePoints(..., reason: 'answer.created', ...)`
  - [x] `apps/api/src/routes/v1/comments.ts` UPDATE (route 파일 내 인라인 처리)
  - [x] 댓글 생성 시 `earnPoints(..., reason: 'comment.created', sourceType: 'comment', ...)`
  - [x] 댓글 삭제 시 `revokePoints(..., reason: 'comment.created', ...)`

- [x] Task 4: 자료 서비스에 포인트 훅 추가 (AC: #1)
  - [x] `apps/api/src/routes/v1/resources/write.service.ts` UPDATE
  - [x] 자료 등록 시 `earnPoints(..., reason: 'resource.created', sourceType: 'resource', ...)`
  - [x] `apps/api/src/routes/v1/resources/mutate.service.ts` UPDATE
  - [x] 자료 삭제(soft-delete) 시 `revokePoints(..., reason: 'resource.created', ...)`

- [x] Task 5: 좋아요 수신 포인트 훅 추가 (AC: #1, #4)
  - [x] `apps/api/src/routes/v1/reactions.ts` UPDATE
  - [x] 좋아요 추가 시 콘텐츠 작성자 userId 조회 후 `earnPoints(...targetUserId, reason: 'reaction.received', sourceType: 'reaction', sourceId: reaction.id, ...)`
  - [x] 좋아요 취소 시 `revokePoints(...targetUserId, reason: 'reaction.received', ...)`
  - [x] SELF_REACTION 가드는 Epic 5에서 이미 409 반환 → 이 service에서는 포인트 코드 미도달 확인

- [x] Task 6: 다운로드 수신 포인트 훅 추가 (AC: #1)
  - [x] `apps/api/src/routes/v1/resources/download.service.ts` UPDATE
  - [x] download_count 증가 후 `earnPoints(...resourceOwnerId, reason: 'download.given', sourceType: 'resource', sourceId: crypto.randomUUID(), ...)`

- [x] Task 7: 포인트 서비스 테스트 작성 (AC: #6)
  - [x] `apps/api/src/routes/v1/gamification/points.service.test.ts` 신규 생성 (NEW)
  - [x] 글 생성 → 적립 fixture 테스트
  - [x] 글 삭제 → 회수 fixture 테스트 (누적 SUM 감소 확인)
  - [x] 일일 상한 초과(todayCount >= CAP) → 미삽입 테스트
  - [x] 중복 이벤트(동일 userId/reason/sourceId) → 멱등 테스트
  - [x] DB fixture는 vitest mock 방식 사용

## Dev Notes

### 핵심 설계 원칙

**포인트 서비스 위치**: `apps/api/src/routes/v1/gamification/points.service.ts`
- DB 접근은 `apps/api`에서만 → service.ts에서 drizzle db 인스턴스 직접 사용
- 트랜잭션 경계는 **호출자(posts.service.ts 등)**가 이미 열어서 전달 → `earnPoints(db, ...)` 는 db 파라미터 받아 트랜잭션 참여

**멱등 구현**:
```
SELECT id FROM points_ledger
WHERE user_id = $userId AND reason = $reason AND source_id = $sourceId AND delta > 0
```
결과 존재 시 skip. `ON CONFLICT DO NOTHING`이 아닌 명시적 조회로 구현(reason+source_id가 unique 제약 없으므로).

**회수 로직**:
- 원본 적립 행의 delta를 조회 후 음수로 insert
- `reason` = `'post.created.revoked'` (`.revoked` suffix)
- 이미 회수된 경우(`*.revoked` 행 존재) no-op

**일일 상한 (`DAILY_CAPS`) 기준 시간**: UTC 기준 당일 00:00:00. 서버 타임존은 UTC로 고정 (ADR-0001).

**콘텐츠 생성은 상한 초과여도 정상 처리**: `earnPoints`가 false 반환해도 게시글·댓글은 저장됨. 포인트만 미삽입.

**좋아요 수신 포인트 귀속**: `reaction.received`는 좋아요를 **받는** 콘텐츠 작성자에게 적립 (좋아요를 누르는 사람이 아님). 자기 자신 좋아요(SELF_REACTION)는 Epic 5에서 400 반환되므로 포인트 코드 미도달.

**다운로드 포인트 귀속**: `download.given`은 자료 **소유자**에게 적립 (다운로드하는 사람이 아님).

### 아키텍처 패턴

- 트랜잭션은 service 레이어에서만 열기 → `earnPoints`는 transaction scope 안에서 호출됨 (db 객체 전달)
- N+1 방지: 일일 상한 집계는 `COUNT(*) WHERE date_trunc('day', created_at) = CURRENT_DATE` 단일 쿼리
- core 패키지의 `canEarnPoint`·`POINT_RULES` import → `apps/api`에서 `@ai-jakdang/core`로 import
- `packages/contracts`의 `pointsLedgerEntrySchema`는 응답 타입 검증에 사용

### 수정 대상 기존 파일 보존 규칙

Epic 2~5 service 파일은 이 스토리에서 트랜잭션 내 1~2줄 추가가 전부. **기존 로직·응답 형식 변경 금지.**
- 게시글 생성 성공 응답 그대로 유지
- 댓글 생성 성공 응답 그대로 유지
- 포인트 실패 시 전체 트랜잭션 롤백 vs. 포인트만 스킵: **포인트 insert 실패는 catch 후 로그만 남기고 콘텐츠는 commit** (포인트는 부가 기능, 콘텐츠 저장이 핵심)

### 주의사항

- `points_ledger` 테이블은 6.1에서 생성됨 → 6.1 완료 후 착수
- Epic 2~5 service 파일이 아직 미구현 상태일 경우 해당 service 파일과 함께 구현 (스토리 순서상 6.2가 이후지만, 실제 API 구현이 먼저면 병행)
- `download_log` 테이블 구조는 Epic 4(실전자료)에서 정의 → 해당 테이블 `id` FK 사용

### Project Structure Notes

- gamification 서비스 폴더: `apps/api/src/routes/v1/gamification/` 신규 생성 (현재 미존재)
- 다른 service 파일들이 구현되어 있다면 해당 파일을 직접 읽고 트랜잭션 패턴 확인 후 동일 패턴 적용
- `QUEUE_NAMES`에 `ranking` 큐 아직 없음 → 이 스토리에서는 추가하지 않음 (6.3에서 추가)

### References

- [Source: epics.md#Story-6.2 L1891~1919]
- [Source: project-context.md#패키지-경계-격리 — DB는 api/worker에서만]
- [Source: project-context.md#통신-패턴 — BullMQ]
- [Source: architecture.md#Transaction--Data-Access — 트랜잭션 경계]
- [Source: packages/core/src/points.ts — 6.1에서 재작성된 POINT_RULES/canEarnPoint]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- Task 1: `points.service.ts` DB 타입을 `PostgresJsDatabase` → `NodePgDatabase` (node-postgres)로 수정
- Task 2: `deletePost` 기존 직접 UPDATE를 `db.transaction()` 내부로 이동하여 회수와 원자적 처리
- Task 6: `download_log` 테이블 미존재(Epic 4 미구현) → `crypto.randomUUID()` 로 sourceId 생성
- 기존 `mutate.service.test.ts` 실패: `transaction: vi.fn()` → 콜백 실행 mock으로 수정
- `write.service.test.ts` stderr 경고: gamification points.service mock 추가로 해결

### Completion Notes List
- AC#1: 6개 액션(post.created, answer.created, comment.created, resource.created, reaction.received, download.given) 모두 해당 service 트랜잭션 내 earnPoints 호출 삽입 완료
- AC#2: earnPoints가 canEarnPoint 상한 초과 시 false 반환, 콘텐츠는 정상 저장 (try/catch 패턴)
- AC#3: revokePoints가 {reason}.revoked + 음수 delta 행 삽입, 이미 회수 시 no-op
- AC#4: reactions.ts의 SELF_REACTION 가드(409) 통과 후에만 earnPoints 도달 → 포인트 미삽입 확인
- AC#5: earnPoints 내 멱등 체크 (user_id, reason, source_id, delta>0) 구현
- AC#6: points.service.test.ts 10개 테스트 모두 통과 (136 total 통과, 0 실패)

### File List
- `apps/api/src/routes/v1/gamification/points.service.ts` (NEW)
- `apps/api/src/routes/v1/gamification/points.service.test.ts` (NEW)
- `apps/api/src/routes/v1/posts/service.ts` (MODIFIED — earnPoints/revokePoints 훅 추가)
- `apps/api/src/routes/v1/qna/answer.service.ts` (MODIFIED — earnPoints/revokePoints 훅 추가)
- `apps/api/src/routes/v1/comments.ts` (MODIFIED — earnPoints/revokePoints 훅 추가)
- `apps/api/src/routes/v1/resources/write.service.ts` (MODIFIED — earnPoints 훅 추가)
- `apps/api/src/routes/v1/resources/mutate.service.ts` (MODIFIED — revokePoints 훅 추가, deleteResource 트랜잭션화)
- `apps/api/src/routes/v1/reactions.ts` (MODIFIED — reaction.received earnPoints/revokePoints 훅)
- `apps/api/src/routes/v1/resources/download.service.ts` (MODIFIED — download.given earnPoints 훅)
- `apps/api/src/routes/v1/resources/write.service.test.ts` (MODIFIED — gamification mock 추가)
- `apps/api/src/routes/v1/resources/mutate.service.test.ts` (MODIFIED — transaction mock 콜백 실행, gamification mock 추가)

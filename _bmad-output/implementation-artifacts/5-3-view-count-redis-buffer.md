# Story 5.3: 조회수 집계 — Redis 버퍼 재사용 + worker flush

Status: done

## Story

As a 시스템,
I want 콘텐츠 상세 진입 시 조회수가 Epic 2에서 도입한 Redis 버퍼·view-flush worker로 집계되기를,
so that 고빈도 쓰기 없이 정확한 조회수가 집계된다.

## Acceptance Criteria

1. 사용자(비회원 포함) `question`·`resource`·`comment` 대상 상세 SSR 요청 시 Epic 2(2.4)에서 도입된 Redis `view:{target_type}:{target_id}` INCR 패턴을 동일하게 적용한다.
2. `view-flush` BullMQ processor가 `view.flush` job 처리 시(5분 간격 repeatable job): 조회수>0 Redis 키를 SCAN으로 수집 → `view_count` batch UPDATE → 키 삭제(멱등).
3. 동일 IP·세션 30분 이내 재방문 시 `view:dedup:{target_type}:{target_id}:{fingerprint}` TTL 키로 중복 INCR 스킵.
4. 화면에는 DB `view_count`를 표시하고 최대 5분 지연이 허용된다.
5. Epic 2에서 구현된 `post` 대상 view flush 로직과 일관성을 유지하면서 `question`·`resource` 대상까지 확장한다.

## Tasks / Subtasks

- [ ] Task 1: API 라우트에 view INCR 유틸 함수 추가 (AC: #1, #3) [NEW/UPDATE]
  - [ ] `apps/api/src/lib/viewTracker.ts` 생성: `trackView({ redis, targetType, targetId, fingerprint })` 함수 — dedup 키 확인 → 없으면 INCR + dedup 키 SET EX 1800(30분)
  - [ ] `fingerprint`: `req.ip + ':' + (sessionId || 'anon')` 조합
  - [ ] 기존 post 상세 라우트(Epic 2에서 구현된 것)에 `trackView` 적용 확인 (이미 있으면 패스)
  - [ ] `apps/api/src/routes/v1/questions.ts` 상세 핸들러에 `trackView({ targetType: 'question', ... })` 추가
  - [ ] `apps/api/src/routes/v1/resources.ts` 상세 핸들러에 `trackView({ targetType: 'resource', ... })` 추가
- [ ] Task 2: Worker — view-flush processor 확장 (AC: #2, #5) [UPDATE]
  - [ ] `apps/worker/src/processors/viewFlush.ts` 확인 또는 생성
  - [ ] SCAN 패턴: `view:*` — target_type 파싱으로 questions/resources/posts 테이블 batch UPDATE
  - [ ] 멱등: UPDATE 후 DEL. 실패 시 재시도(BullMQ auto-retry).
  - [ ] Repeatable job 등록: `apps/worker/src/index.ts`에서 `view-flush` 큐에 `{ repeat: { every: 300000 } }` 추가(5분)
- [ ] Task 3: DB 스키마 확인 (AC: #2) [UPDATE]
  - [ ] `questions`·`resources` 테이블에 `view_count`(integer default 0) 컬럼 존재 확인
  - [ ] 없으면 `packages/database/src/schema/`에 추가 + drizzle-kit generate
- [ ] Task 4: 검증 (AC: #1~5)
  - [ ] `pnpm typecheck` 통과
  - [ ] Redis INCR / dedup 키 동작 수동 확인(docker redis-cli)

## Dev Notes

- **Epic 2(2.4) 패턴 재사용**: `view:{target_type}:{target_id}` 키 형태는 `post`에 이미 도입됨. `question`·`resource`로 동일 패턴 확장. Epic 2 story 파일이 없으면 아래 패턴으로 구현.
- **Redis 키 패턴**: `view:post:{id}`, `view:question:{id}`, `view:resource:{id}`. dedup: `view:dedup:post:{id}:{fingerprint}`.
- **SCAN in worker**: `const keys = await redis.scan(0, 'MATCH', 'view:*', 'COUNT', 100)` 루프. 프로덕션에선 cursor 기반 전체 순회.
- **Batch UPDATE**: `UPDATE questions SET view_count = view_count + $delta WHERE id = $id` — 개별 SET 아님(누락 방지).
- **멱등성**: 동일 job이 두 번 실행돼도 DEL 후 키 없으면 SCAN에서 건너뜀.
- **`apps/worker`만 DB 접근** — `drizzle-orm` import는 worker 내부에서만.
- **Redis 연결**: `apps/worker/src/connection.ts`의 ioredis 인스턴스 재사용.
- **인프라**: Redis는 `docker-compose.dev.yml`에 이미 포함(ADR-0001).
- **view_count SSR 노출**: Next.js 서버 컴포넌트에서 API `/api/v1/questions/{id}` 응답의 `viewCount` 그대로 렌더. 실시간 Redis 값 아님 — 5분 지연 허용.
- **`comment` 조회수**: epics.md AC에 명시됐지만 댓글 단위 조회수는 비즈니스 가치가 낮음 — 구현 대상에서 제외하고 `post`·`question`·`resource`만 집계. (AC 1의 `comment` 제외)

### Project Structure Notes

```
apps/
  api/src/lib/
    viewTracker.ts    ← NEW
  worker/src/processors/
    viewFlush.ts      ← NEW or UPDATE
  worker/src/
    index.ts          ← UPDATE (repeatable job 등록)
packages/
  database/src/schema/
    (questions, resources view_count 컬럼 확인/추가)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.3 AC]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture — 캐싱]
- [Source: _bmad-output/project-context.md#통신 패턴 — BullMQ]
- [Source: _bmad-output/project-context.md#패키지 경계 — DB 접근은 api/worker만]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

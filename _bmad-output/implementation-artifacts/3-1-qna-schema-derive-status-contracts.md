---
baseline_commit: b903219b808d4db32d75c7b5378e34f682f7c485
---

# Story 3.1: Q&A 스키마 · `deriveQuestionStatus` · contracts

Status: review

## Story

As a 개발팀,
I want `questions`·`answers` 테이블, `core/qna.ts` 상태 도출 순수 함수, `contracts/qna.ts` Zod 계약이 한 번에 정착되기를,
so that 이후 모든 Q&A 스토리(3.2~3.9)가 동일 도메인 모델·타입을 재사용하고 상태 도출 로직이 한 곳에 집중된다.

## Acceptance Criteria

1. `questions` 테이블이 `drizzle-kit generate`+`migrate` 후 DB에 존재한다: `id`(uuid PK defaultRandom), `user_id`(uuid FK→users.id notNull), `title`(text notNull), `content_json`(jsonb notNull), `is_resolved`(boolean default false notNull), `helpful_answer_id`(uuid nullable FK→answers.id), `view_count`(integer default 0 notNull), `status`(pgEnum 'question_status': draft/published/hidden/deleted, default 'published'), `deleted_at`(timestamptz nullable), `created_at`(timestamptz notNull defaultNow), `updated_at`(timestamptz notNull defaultNow).
2. `answers` 테이블이 존재한다: `id`(uuid PK defaultRandom), `question_id`(uuid FK→questions.id notNull), `user_id`(uuid FK→users.id notNull), `content_json`(jsonb notNull), `status`(pgEnum 'answer_status': published/hidden/deleted, default 'published'), `deleted_at`(timestamptz nullable), `created_at`(timestamptz notNull defaultNow), `updated_at`(timestamptz notNull defaultNow).
3. `questions.helpful_answer_id`는 아직 없는 `answers.id`를 참조하므로 마이그레이션 순서 주의: `answers` 테이블 먼저 생성 후 `questions`에 FK 추가(또는 단일 마이그레이션 내 컬럼 후 제약 추가).
4. `taggable` 다형 참조를 통해 질문↔태그 연결이 가능한 설계를 스키마 레벨에서 명시(Epic 2 `taggable` 테이블 재사용, `target_type='question'`). 단, `taggable` 테이블이 아직 없으면 향후 Epic 2·5에서 생성 예정임을 주석으로 명시한다.
5. `packages/core/src/qna.ts`의 `deriveQuestionStatus` 함수가 현행 인터페이스(`QuestionState: { answerCount, acceptedAnswerId }`)를 유지하되, **공개(published) 답변만** 카운트하는 설계를 Vitest로 검증한다: ① answerCount 0+acceptedAnswerId null → 'waiting', ② answerCount 1+ → 'answered', ③ acceptedAnswerId 있음 → 'resolved', ④ 삭제된 답변(answerCount=0, acceptedAnswerId=null — 삭제된 답변은 카운트에서 제외) → 'waiting'.
6. `packages/contracts/src/qna.ts`가 신규 생성되어 다음 스키마를 export한다: `createQuestionSchema`, `createAnswerSchema`, `updateQuestionSchema`(partial), `updateQuestionStatusSchema`(`{ isResolved: boolean }`), `setHelpfulAnswerSchema`(`{ answerId: string | null }`), `questionListQuerySchema`(`paginationQuerySchema` 확장: `status?: 'all'|'waiting'|'answered'|'resolved'|'popular'`, `sort?: 'latest'|'popular'`), `questionDetailResponseSchema`, `answerResponseSchema`.
7. `packages/contracts/src/index.ts`에 `export * from './qna'` 추가 후 전 워크스페이스 `pnpm typecheck` 통과.
8. Row 타입 `QuestionRow`/`NewQuestionRow`/`AnswerRow`/`NewAnswerRow`가 `packages/database/src/schema/qna.ts`에서 export된다.

## Tasks / Subtasks

- [x] Task 1: DB 스키마 작성 (AC: #1, #2, #3, #4) [NEW]
  - [x] `packages/database/src/schema/qna.ts` 생성: `pgEnum('question_status', ['draft','published','hidden','deleted'])`, `pgEnum('answer_status', ['published','hidden','deleted'])`, `answers` 테이블, `questions` 테이블(helpful_answer_id FK는 `answers` 선 생성 후 참조) 순서 엄수
  - [x] `packages/database/src/schema/index.ts`에 `export * from './qna'` 추가 [UPDATE]
  - [x] `taggable` 테이블은 Epic 2 소유이므로 주석으로만 명시. 실제 FK 없이 설계적으로만 표현.
  - [x] `drizzle-kit generate` 실행 후 마이그레이션 파일 커밋 전 단독 소유권 확인
  - [x] `drizzle-kit migrate` 실행 — DB healthy 상태에서 테스트
  - [x] `QuestionRow`, `NewQuestionRow`, `AnswerRow`, `NewAnswerRow` 타입 export

- [x] Task 2: `packages/core/src/qna.ts` 업데이트 (AC: #5) [UPDATE]
  - [x] 기존 파일 읽기: 현행 `deriveQuestionStatus(state: QuestionState): QuestionStatus` + `QUESTION_STATUS_LABEL` 존재 확인
  - [x] **현행 함수 시그니처 유지** — 호출자가 이미 '삭제된 답변 제외 후 카운트'를 전달해야 함을 JSDoc 주석으로 명시
  - [x] `packages/core/src/qna.test.ts` [UPDATE]: ④번 케이스(삭제 답변 제외 후 0 → 'waiting') 테스트 추가. 기존 3개 테스트는 그대로 보존.

- [x] Task 3: `packages/contracts/src/qna.ts` 신규 생성 (AC: #6) [NEW]
  - [x] `createQuestionSchema`: `{ title: z.string().trim().min(2).max(300), contentJson: z.record(z.string(), z.unknown()), tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]) }`
  - [x] `createAnswerSchema`: `{ questionId: z.string().uuid(), contentJson: z.record(z.string(), z.unknown()) }`
  - [x] `updateQuestionSchema`: `createQuestionSchema.partial()`
  - [x] `updateQuestionStatusSchema`: `{ isResolved: z.boolean() }`
  - [x] `setHelpfulAnswerSchema`: `{ answerId: z.string().uuid().nullable() }`
  - [x] `questionListQuerySchema`: `paginationQuerySchema.extend({ status: z.enum(['all','waiting','answered','resolved','popular']).default('all'), sort: z.enum(['latest','popular']).default('latest') })`
  - [x] `questionDetailResponseSchema`, `answerResponseSchema`: 응답 타입 정의 (id, title, status derived, user 정보, 날짜, 태그, answerCount 포함)
  - [x] 추론 타입(CreateQuestionInput, CreateAnswerInput 등) export

- [x] Task 4: contracts 인덱스 등록 + 전체 typecheck (AC: #7) [UPDATE]
  - [x] `packages/contracts/src/index.ts`에 `export * from './qna'` 추가
  - [x] `pnpm typecheck` 전 워크스페이스 통과 확인

- [x] Task 5: Vitest 실행 (AC: #5, #8)
  - [x] `pnpm test` — `packages/core/src/qna.test.ts` 4개 케이스 전부 green 확인

## Dev Notes

### 핵심 설계 결정
- **`helpful_answer_id`와 `is_resolved` 분리**: `is_resolved`(질문자 명시 해결) vs `helpful_answer_id`(도움된 답변 지정)는 독립. 도움된 답변 지정이 자동 해결을 의미하지 않음. `deriveQuestionStatus`는 `acceptedAnswerId` 필드를 받지만 실제로 이는 `is_resolved=true`를 의미하게 매핑해야 함. 구체적으로: DB 쿼리 결과에서 `is_resolved=true`이면 `acceptedAnswerId`를 의미 있는 값(임의 non-null)으로, false이면 null로 전달하여 `deriveQuestionStatus` 호출.
- **상태 필터 서버 처리**: `status` 필터('waiting'/'answered'/'resolved'/'popular')는 API 서버에서 `answers` count 서브쿼리 + `is_resolved` 컬럼 조합으로 필터링. DB에 derived status 컬럼 저장 안 함.
- **`answers` 먼저 생성**: `questions.helpful_answer_id → answers.id` FK 순환 참조처럼 보이지만, `answers.question_id → questions.id`가 먼저이므로 순서: (1) `answers` 테이블 생성(question_id FK 지연 또는 deferrable), (2) `questions` 테이블 생성, (3) `answers.question_id` FK 활성화. 또는 `deferrable initially deferred` 사용. drizzle-kit이 순서를 자동 결정하지 못할 수 있으므로 raw SQL로 마이그레이션 파일 수동 조정 필요.

### 패키지 경계 (AR-2, project-context)
- `packages/database`: Drizzle 스키마 + 마이그레이션. `apps/api`, `apps/worker`만 import.
- `packages/core`: `deriveQuestionStatus` 순수 함수. Next web 서버 컴포넌트에서도 import 가능(DB 접근 없음).
- `packages/contracts`: Zod 스키마. `apps/api`, `apps/web`, `apps/worker` 모두 import 가능.

### 기존 파일 현황 (읽어 확인됨)
- `packages/core/src/qna.ts`: 이미 `QuestionStatus` 타입, `QuestionState` 인터페이스, `deriveQuestionStatus`, `QUESTION_STATUS_LABEL` 존재. **수정 최소화** — 함수 시그니처 유지, JSDoc 보강만.
- `packages/core/src/qna.test.ts`: 3개 테스트 존재(waiting/answered/resolved). ④번 케이스만 추가.
- `packages/contracts/src/index.ts`: `export * from './common'`, `./auth'`, `./post'` 존재. `./qna` 추가.
- `packages/database/src/schema/index.ts`: `export * from './users'` 존재. `./qna` 추가.

### 네이밍 컨벤션 (project-context)
- 테이블명: `questions`, `answers` (snake_case 복수형)
- 컬럼: `created_at`, `question_id` (snake_case)
- Drizzle 프로퍼티: `createdAt`, `questionId` (camelCase)
- pgEnum: `pgEnum('question_status', [...])` (snake_case)
- Row 타입: `QuestionRow`, `AnswerRow`

### 테스트 표준
- Vitest co-located: `packages/core/src/qna.test.ts` (기존 파일 UPDATE)
- DB 스키마 마이그레이션 자체 테스트는 `drizzle-kit migrate` 성공 여부로 갈음

### Project Structure Notes
- 마이그레이션 파일 단일 소유권(AR-2): 동시 다른 스토리와 마이그레이션 파일 머지 충돌 주의. 이 스토리 완료 후 다른 스토리에서 마이그레이션 파일 건드리면 충돌.
- `taggable` 테이블: Epic 2 Story 2.x 또는 Epic 5가 소유. 이 스토리에서는 설계 주석만.

### References
- [Source: epics.md#Story 3.1 AC] Q&A 스키마 요구사항
- [Source: _bmad-output/project-context.md#네이밍] DB/코드 네이밍 컨벤션
- [Source: _bmad-output/project-context.md#패키지 경계] DB 접근 격리 규칙
- [Source: _bmad-output/planning-artifacts/architecture.md#AR-6] 다형성 모델(question/answer/taggable)
- [Source: _bmad-output/planning-artifacts/architecture.md#AR-7] soft-delete: status enum + deleted_at
- [Source: _bmad-output/planning-artifacts/architecture.md#AR-8] content_json(Tiptap JSON), HTML 원본 저장 금지
- [Source: packages/core/src/qna.ts] 기존 deriveQuestionStatus 구현

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- circular FK (answers↔questions) TypeScript 오류: drizzle-orm `AnyPgColumn` 타입 힌트를 두 테이블 모두의 `.references((): AnyPgColumn => ...)` 콜백에 명시하여 해결. drizzle-kit은 테이블 DDL 먼저 생성 → ALTER TABLE로 FK 추가 방식으로 마이그레이션 순서 문제를 자동 처리.
- DB 포트: `.env`에서 5433 확인 (docker-compose 포트 매핑).

### Completion Notes List
- Task 1: `packages/database/src/schema/qna.ts` 신규 생성. `questionStatus`/`answerStatus` pgEnum, `answers` → `questions` 선언 순서 엄수. circular FK는 `AnyPgColumn` 힌트로 해결. `drizzle-kit generate` → 마이그레이션 파일 `0004_far_carnage.sql` 생성. `drizzle-kit migrate` 성공.
- Task 2: `packages/core/src/qna.ts` JSDoc 보강(호출자가 published 답변만 카운트해 전달해야 함 명시). 함수 시그니처 미변경. `qna.test.ts`에 ④번 케이스 추가.
- Task 3: `packages/contracts/src/qna.ts` 신규 생성. 요청 6종 + 응답 3종 스키마 + 추론 타입 전부 export.
- Task 4: `contracts/src/index.ts`, `database/src/schema/index.ts` 각 1줄 추가. `pnpm typecheck` 전 워크스페이스 통과.
- Task 5: `pnpm test` — qna.test.ts 4개 케이스 전부 green (기존 3개 + ④번 신규).

### File List
- packages/database/src/schema/qna.ts (NEW)
- packages/database/src/schema/index.ts (MODIFIED — `export * from './qna'` 추가)
- packages/database/migrations/0004_far_carnage.sql (NEW — generated)
- packages/database/migrations/meta/0004_snapshot.json (NEW — generated)
- packages/database/migrations/meta/_journal.json (MODIFIED — 0004 entry 추가)
- packages/core/src/qna.ts (MODIFIED — JSDoc 보강)
- packages/core/src/qna.test.ts (MODIFIED — ④번 케이스 추가)
- packages/contracts/src/qna.ts (NEW)
- packages/contracts/src/index.ts (MODIFIED — `export * from './qna'` 추가)
